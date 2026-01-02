import { Args, Mutation, Query, Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Ctx, RequestContext, Allow, Permission, Transaction, TransactionalConnection, CustomerService, ProductService, ProductVariantService, OrderService, LanguageCode, TaxCategoryService, ChannelService, Zone, EventBus } from '@vendure/core';
import { GlobalFlag } from '@vendure/common/lib/generated-types';
import { SellerProfileService } from '../services/seller-profile.service';
import { SellerProfile } from '../entities/seller-profile.entity';
import { TunerRequest } from '../entities/tuner-request.entity';
import { RegisterSellerInput, SellerProfileInput } from '../types';
import { MarketplacePlugin } from '../marketplace.plugin';
import { PrismaClient } from '.prisma/marketplace-client';
import { InvoicePaymentRequestEvent } from '../../../email/dynamic-email-handlers';

/**
 * Field resolver for SellerProfile to parse JSON fields
 */
@Resolver('SellerProfile')
export class SellerProfileFieldResolver {
    @ResolveField('customBadges')
    customBadges(@Parent() seller: SellerProfile): Array<{ icon: string; text: string; color: string }> | null {
        if (!seller.customBadges) {
            return null;
        }
        try {
            return JSON.parse(seller.customBadges);
        } catch {
            return null;
        }
    }
}

@Resolver()
export class SellerProfileShopResolver {
    private prisma: PrismaClient;

    constructor(
        private sellerProfileService: SellerProfileService,
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private productService: ProductService,
        private productVariantService: ProductVariantService,
        private orderService: OrderService,
        private taxCategoryService: TaxCategoryService,
        private channelService: ChannelService,
        private eventBus: EventBus,
    ) {
        this.prisma = new PrismaClient();
    }

    @Query()
    async activeSellerProfile(
        @Ctx() ctx: RequestContext,
    ): Promise<SellerProfile | null> {
        if (!ctx.activeUserId) {
            return null;
        }
        // Get the Customer entity from the session User ID
        // IMPORTANT: ctx.activeUserId is the User ID, not the Customer ID
        // We need to look up the Customer by User ID first
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return null;
        }
        return this.sellerProfileService.getByCustomerId(ctx, customer.id);
    }

    @Query()
    async sellerBySlug(
        @Ctx() ctx: RequestContext,
        @Args() args: { slug: string },
    ): Promise<SellerProfile | null> {
        return this.sellerProfileService.getBySlug(ctx, args.slug);
    }

    @Query()
    async sellerById(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile | null> {
        return this.sellerProfileService.getById(ctx, args.id);
    }

    /**
     * Check if a slug is available for use
     * Normalizes the slug and checks against existing sellers
     */
    @Query()
    async checkSlugAvailability(
        @Ctx() ctx: RequestContext,
        @Args() args: { slug: string },
    ): Promise<{ available: boolean; normalizedSlug: string; message?: string }> {
        // Normalize the slug: lowercase, replace spaces/special chars with hyphens, remove consecutive hyphens
        const normalizedSlug = args.slug
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .replace(/-+/g, '-');

        // Check minimum length
        if (normalizedSlug.length < 3) {
            return {
                available: false,
                normalizedSlug,
                message: 'URL must be at least 3 characters long',
            };
        }

        // Check maximum length
        if (normalizedSlug.length > 50) {
            return {
                available: false,
                normalizedSlug: normalizedSlug.substring(0, 50),
                message: 'URL must be 50 characters or less',
            };
        }

        // Reserved slugs that shouldn't be used
        const reservedSlugs = ['admin', 'api', 'dashboard', 'login', 'signup', 'register', 'settings', 'profile', 'account', 'help', 'support', 'about', 'contact', 'terms', 'privacy', 'tunerswap', 'seller', 'sellers', 'buyer', 'buyers', 'product', 'products', 'tune', 'tunes', 'part', 'parts', 'service', 'services'];

        if (reservedSlugs.includes(normalizedSlug)) {
            return {
                available: false,
                normalizedSlug,
                message: 'This URL is reserved and cannot be used',
            };
        }

        // Check if slug exists in database
        const existing = await this.sellerProfileService.getBySlug(ctx, normalizedSlug);

        if (existing) {
            return {
                available: false,
                normalizedSlug,
                message: 'This URL is already taken by another seller',
            };
        }

        return {
            available: true,
            normalizedSlug,
        };
    }

    @Query()
    async sellers(
        @Ctx() ctx: RequestContext,
        @Args() args: { skip?: number; take?: number },
    ): Promise<{ items: SellerProfile[]; totalItems: number }> {
        return this.sellerProfileService.findAllApproved(ctx, {
            skip: args.skip,
            take: args.take,
        });
    }

    /**
     * Get ALL products by type - bypasses Vendure Shop API channel filtering
     * This is for the /collections/tunes, /collections/parts, /collections/services pages
     */
    @Query()
    async productsByType(
        @Ctx() ctx: RequestContext,
        @Args() args: { productType: string; take?: number; skip?: number },
    ): Promise<any> {
        try {
            const take = args.take || 100;
            const skip = args.skip || 0;

            console.log(`[ProductsByType] Fetching ${args.productType} products (take: ${take}, skip: ${skip})`);

            // Direct database query to get ALL products of this type
            const rawProducts = await this.connection.rawConnection
                .getRepository('product')
                .createQueryBuilder('product')
                .leftJoinAndSelect('product.featuredAsset', 'featuredAsset')
                .leftJoinAndSelect('product.translations', 'translations')
                .where('product.customFieldsProducttype = :productType', { productType: args.productType })
                .andWhere('product.enabled = :enabled', { enabled: true })
                .andWhere('product.deletedAt IS NULL')
                .orderBy('product.createdAt', 'DESC')
                .skip(skip)
                .take(take)
                .getMany();

            // Get total count
            const totalCount = await this.connection.rawConnection
                .getRepository('product')
                .createQueryBuilder('product')
                .where('product.customFieldsProducttype = :productType', { productType: args.productType })
                .andWhere('product.enabled = :enabled', { enabled: true })
                .andWhere('product.deletedAt IS NULL')
                .getCount();

            console.log(`[ProductsByType] Found ${rawProducts.length} ${args.productType} products (total: ${totalCount})`);

            // Map to product format with variants
            const products = await Promise.all(rawProducts.map(async (product: any) => {
                // Get variants for pricing
                const variantResult = await this.productVariantService.getVariantsByProductId(ctx, product.id);
                const defaultVariant = variantResult.items[0];

                // Get product info from translations
                const translation = product.translations?.[0];
                const name = translation?.name || 'Unnamed Product';
                const slug = translation?.slug || '';
                const description = translation?.description || '';

                // Custom fields
                const cf = product.customFields || {};
                const sellerId = cf.sellerId || product.customFieldsSellerid;
                const contactForPricing = cf.contactForPricing || product.customFieldsContactforpricing || false;

                return {
                    id: product.id.toString(),
                    name,
                    slug,
                    description,
                    featuredAsset: product.featuredAsset ? {
                        preview: product.featuredAsset.preview,
                    } : null,
                    variants: defaultVariant ? [{
                        id: defaultVariant.id.toString(),
                        name: (defaultVariant as any).name || name,
                        sku: (defaultVariant as any).sku || '',
                        price: defaultVariant.price || 0,
                        priceWithTax: defaultVariant.priceWithTax || defaultVariant.price || 0,
                        stockLevel: (defaultVariant as any).stockOnHand > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                    }] : [],
                    customFields: {
                        productType: args.productType,
                        sellerId,
                        contactForPricing,
                        isDigital: args.productType === 'tune',
                    },
                };
            }));

            return {
                items: products,
                totalItems: totalCount,
            };
        } catch (error: any) {
            console.error('[ProductsByType] Error:', error.message);
            return { items: [], totalItems: 0, error: error.message };
        }
    }

    /**
     * Debug query to check all products and their custom fields
     */
    @Query()
    async debugProducts(
        @Ctx() ctx: RequestContext,
    ): Promise<any> {
        try {
            // Get ALL products directly from the connection to bypass any filters
            const allProducts = await this.connection.rawConnection
                .getRepository('product')
                .createQueryBuilder('product')
                .select(['product.id', 'product.enabled', 'product.customFieldsProducttype', 'product.customFieldsSellerid'])
                .orderBy('product.id', 'DESC')
                .take(20)
                .getRawMany();

            console.log('[DEBUG] Last 20 products in database:', JSON.stringify(allProducts, null, 2));

            // Also check via Vendure service
            const vendureProducts = await this.productService.findAll(ctx, { take: 100 });
            console.log('[DEBUG] Vendure findAll returned:', vendureProducts.items.length, 'products');
            console.log('[DEBUG] Sample products with customFields:', vendureProducts.items.slice(-5).map(p => ({
                id: p.id,
                name: p.name,
                enabled: p.enabled,
                customFields: (p as any).customFields,
            })));

            return {
                rawCount: allProducts.length,
                vendureCount: vendureProducts.items.length,
                lastProducts: allProducts,
            };
        } catch (error: any) {
            console.error('[DEBUG] Error:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Get public products for a seller by seller ID
     * This is used on public seller profile pages
     * Uses direct database query to bypass Vendure's channel filtering
     */
    @Query()
    async sellerProducts(
        @Ctx() ctx: RequestContext,
        @Args() args: { sellerId: string },
    ): Promise<any[]> {
        try {
            console.log(`[SellerProducts] Fetching products for seller: ${args.sellerId}`);
            console.log(`[SellerProducts] Channel ID: ${ctx.channelId}, API Type: ${ctx.apiType}`);

            // Use direct database query to get ALL products for this seller
            // This bypasses any Vendure channel/collection filtering
            const rawProducts = await this.connection.rawConnection
                .getRepository('product')
                .createQueryBuilder('product')
                .leftJoinAndSelect('product.featuredAsset', 'featuredAsset')
                .leftJoinAndSelect('product.translations', 'translations')
                .where('product.customFieldsSellerid = :sellerId', { sellerId: args.sellerId.toString() })
                .andWhere('product.enabled = :enabled', { enabled: true })
                .andWhere('product.deletedAt IS NULL')
                .orderBy('product.createdAt', 'DESC')
                .getMany();

            console.log(`[SellerProducts] Direct DB query found ${rawProducts.length} products for seller ${args.sellerId}`);

            if (rawProducts.length > 0) {
                console.log(`[SellerProducts] First product:`, {
                    id: rawProducts[0].id,
                    enabled: rawProducts[0].enabled,
                    customFields: (rawProducts[0] as any).customFields,
                });
            }

            // Also try Vendure query for comparison
            const vendureResult = await this.productService.findAll(ctx, { take: 100 });
            console.log(`[SellerProducts] Vendure findAll returned ${vendureResult.items.length} products total`);

            // Map raw products to our format
            const sellerProducts = rawProducts;

            // Map to SellerProduct type with variant pricing
            // Note: Raw DB entities have custom fields as columns (e.g., customFieldsProducttype)
            const products = await Promise.all(sellerProducts.map(async (product: any) => {
                // Get variants for pricing
                const variantResult = await this.productVariantService.getVariantsByProductId(ctx, product.id);
                const defaultVariant = variantResult.items[0];

                // Get product name from translations
                const translation = product.translations?.[0];
                const name = translation?.name || product.name || 'Unnamed Product';
                const slug = translation?.slug || product.slug || '';
                const description = translation?.description || product.description || '';

                // Custom fields are stored as direct columns in raw entities
                const cf = product.customFields || {};
                const productType = cf.productType || product.customFieldsProducttype || 'tune';
                const sellerId = cf.sellerId || product.customFieldsSellerid;
                const platform = cf.platform || product.customFieldsPlatform;
                const software = cf.software || product.customFieldsSoftware;
                const hpGain = cf.hpGain || product.customFieldsHpgain;
                const torqueGain = cf.torqueGain || product.customFieldsTorquegain;
                const contactForPricing = cf.contactForPricing || product.customFieldsContactforpricing || false;
                const pricingType = cf.pricingType || product.customFieldsPricingtype || 'flat_rate';
                const hourlyRate = cf.hourlyRate || product.customFieldsHourlyrate;
                const setupFee = cf.setupFee || product.customFieldsSetupfee;
                const minimumHours = cf.minimumHours || product.customFieldsMinimumhours;
                const allowHourSelection = cf.allowHourSelection ?? product.customFieldsAllowhourselection ?? true;
                const maxHours = cf.maxHours || product.customFieldsMaxhours;

                return {
                    id: product.id.toString(),
                    name,
                    slug,
                    description,
                    price: defaultVariant?.price || 0,
                    priceWithTax: defaultVariant?.priceWithTax || defaultVariant?.price || 0,
                    productType,
                    status: product.enabled ? 'active' : 'disabled',
                    featuredAsset: product.featuredAsset ? {
                        id: product.featuredAsset.id.toString(),
                        preview: product.featuredAsset.preview,
                    } : null,
                    featuredAssetUrl: product.featuredAsset?.preview || null,
                    sales: 0, // TODO: Calculate from orders
                    rating: null,
                    reviewCount: 0,
                    stock: (defaultVariant as any)?.stockOnHand || 0,
                    inStock: ((defaultVariant as any)?.stockOnHand || 0) > 0,
                    platform,
                    software,
                    hpGain,
                    torqueGain,
                    category: null,
                    brand: null,
                    duration: null,
                    serviceType: null,
                    pricingType,
                    hourlyRate,
                    setupFee,
                    minimumHours,
                    allowHourSelection,
                    maxHours,
                    contactForPricing,
                    createdAt: product.createdAt,
                };
            }));

            console.log(`[SellerProducts] Returning ${products.length} products for seller ${args.sellerId}`);
            return products;
        } catch (error: any) {
            console.error('[SellerProducts] Error fetching products:', error.message);
            return [];
        }
    }

    /**
     * Register a new seller.
     *
     * NOTE: This mutation creates a Customer account in Vendure for buyer activities.
     * The actual seller registration should be done via the Vendor API (port 3001)
     * which creates the seller in MarketplaceDB with proper authentication.
     *
     * Flow:
     * 1. Call this mutation to create Customer account (optional)
     * 2. Call Vendor API `registerSeller` to create seller in MarketplaceDB
     * 3. Seller logs in via Vendor API to get JWT
     * 4. Seller dashboard uses Vendor API for all operations
     *
     * @deprecated For seller authentication, use Vendor API at /graphql (port 3001)
     */
    @Transaction()
    @Mutation()
    async registerSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: RegisterSellerInput },
    ): Promise<{
        success: boolean;
        message?: string;
        sellerId?: string;
        adminUrl?: string;
        adminEmail?: string;
        channelToken?: string;
    }> {
        try {
            const result = await this.sellerProfileService.registerSeller(ctx, args.input);
            const profile = result.profile;
            const vendorApiUrl = result.vendorApiUrl;

            // Direct sellers to the Vendor API dashboard, NOT Vendure Admin
            const dashboardUrl = process.env.SELLER_DASHBOARD_URL || 'http://localhost:5173/selleradmin';

            return {
                success: true,
                sellerId: profile.id.toString(),
                message: profile.status === 'approved'
                    ? `Registration started! Complete your seller setup at the Vendor API (${vendorApiUrl}) then access your dashboard at ${dashboardUrl}`
                    : `Registration started! Complete your seller setup at the Vendor API (${vendorApiUrl}). Your application will be reviewed.`,
                adminUrl: dashboardUrl, // Now points to seller dashboard, not Vendure Admin
                adminEmail: args.input.email,
                channelToken: undefined, // No longer using Vendure channels for sellers
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Registration failed',
            };
        }
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async updateSellerProfile(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: SellerProfileInput },
    ): Promise<SellerProfile> {
        if (!ctx.activeUserId) {
            throw new Error('Not authenticated');
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new Error('Customer not found');
        }

        const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }

        return this.sellerProfileService.update(ctx, profile.id, args.input);
    }

    // =========================================================================
    // Tuner Request Endpoints
    // =========================================================================

    /**
     * Get the current user's pending tuner request (if any)
     */
    @Query()
    @Allow(Permission.Authenticated)
    async myTunerRequest(
        @Ctx() ctx: RequestContext,
    ): Promise<TunerRequest | null> {
        if (!ctx.activeUserId) {
            return null;
        }

        // Get customer from User ID to find pendingTunerRequestId
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return null;
        }

        const requestId = (customer as any).customFields?.pendingTunerRequestId;
        if (!requestId) {
            return null;
        }

        return this.connection.getRepository(ctx, TunerRequest).findOne({
            where: { id: requestId },
        });
    }

    /**
     * Submit a request to become a tuner/seller
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async submitTunerRequest(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: any },
    ): Promise<{ success: boolean; message?: string; requestId?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            // Check if customer already has a pending request
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            // Check if already a seller
            const existingProfile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (existingProfile) {
                return { success: false, message: 'You are already a registered seller' };
            }

            // Check for existing pending request
            const existingRequest = (customer as any).customFields?.pendingTunerRequestId;
            if (existingRequest) {
                const req = await this.connection.getRepository(ctx, TunerRequest).findOne({
                    where: { id: existingRequest },
                });
                if (req && req.status === 'pending') {
                    return { success: false, message: 'You already have a pending tuner request' };
                }
            }

            // Create the tuner request
            const request = new TunerRequest({
                customerId: customer.id,
                firstName: args.input.firstName,
                lastName: args.input.lastName,
                phone: args.input.phone,
                location: args.input.location,
                address: args.input.address,
                businessName: args.input.businessName,
                website: args.input.website,
                instagram: args.input.instagram,
                facebook: args.input.facebook,
                bio: args.input.bio,
                experience: args.input.experience,
                software: args.input.software,
                vehiclePlatforms: args.input.vehiclePlatforms,
                tuneTypes: args.input.tuneTypes,
                hasDyno: args.input.hasDyno,
                hours: args.input.hours,
                status: 'pending',
            });

            const saved = await this.connection.getRepository(ctx, TunerRequest).save(request);

            // Update customer with pending request ID
            await this.customerService.update(ctx, {
                id: customer.id,
                customFields: {
                    pendingTunerRequestId: saved.id.toString(),
                },
            });

            // Check if auto-approve is enabled
            const settings = MarketplacePlugin.getEffectiveSettings();
            if (settings.autoApproveTunerRequests) {
                // Auto-approve: create seller profile
                await this.autoApproveTunerRequest(ctx, saved);
                return {
                    success: true,
                    message: 'Your tuner request has been automatically approved! You are now a seller.',
                    requestId: saved.id.toString(),
                };
            }

            return {
                success: true,
                message: 'Your tuner request has been submitted and is pending review.',
                requestId: saved.id.toString(),
            };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to submit tuner request' };
        }
    }

    /**
     * Cancel a pending tuner request
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async cancelTunerRequest(
        @Ctx() ctx: RequestContext,
    ): Promise<{ success: boolean; message?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const requestId = (customer as any).customFields?.pendingTunerRequestId;
            if (!requestId) {
                return { success: false, message: 'No pending tuner request found' };
            }

            const request = await this.connection.getRepository(ctx, TunerRequest).findOne({
                where: { id: requestId },
            });

            if (!request || request.status !== 'pending') {
                return { success: false, message: 'No pending tuner request found' };
            }

            // Update request status
            request.status = 'cancelled';
            await this.connection.getRepository(ctx, TunerRequest).save(request);

            // Clear pending request ID from customer
            await this.customerService.update(ctx, {
                id: customer.id,
                customFields: {
                    pendingTunerRequestId: null,
                },
            });

            return { success: true, message: 'Tuner request cancelled successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to cancel tuner request' };
        }
    }

    /**
     * Helper to auto-approve a tuner request
     */
    private async autoApproveTunerRequest(ctx: RequestContext, request: TunerRequest): Promise<void> {
        // Generate slug
        const businessName = request.businessName || `${request.firstName} ${request.lastName}`;
        const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const suffix = Math.random().toString(36).substring(2, 8);
        const slug = `${baseSlug}-${suffix}`;

        const settings = MarketplacePlugin.getEffectiveSettings();

        // Create seller profile
        const sellerProfile = new SellerProfile({
            customerId: request.customerId,
            firstName: request.firstName,
            lastName: request.lastName,
            phone: request.phone,
            location: request.location,
            address: request.address,
            businessName: request.businessName,
            website: request.website,
            instagram: request.instagram,
            facebook: request.facebook,
            bio: request.bio,
            experience: request.experience,
            software: request.software,
            vehiclePlatforms: request.vehiclePlatforms,
            tuneTypes: request.tuneTypes,
            hasDyno: request.hasDyno,
            hours: request.hours,
            status: 'approved',
            verified: settings.autoVerifySeller,
            slug,
        });

        const savedProfile = await this.connection.getRepository(ctx, SellerProfile).save(sellerProfile);

        // Update tuner request
        request.status = 'approved';
        request.sellerProfileId = savedProfile.id;
        request.reviewedAt = new Date();
        await this.connection.getRepository(ctx, TunerRequest).save(request);

        // Update customer
        await this.customerService.update(ctx, {
            id: request.customerId as any,
            customFields: {
                isSeller: true,
                sellerProfileId: savedProfile.id.toString(),
                pendingTunerRequestId: null,
            },
        });
    }

    // =========================================================================
    // Seller Products & Orders Endpoints
    // =========================================================================

    /**
     * Get current seller's products
     */
    @Query()
    @Allow(Permission.Authenticated)
    async mySellerProducts(
        @Ctx() ctx: RequestContext,
        @Args() args: { productType?: string; skip?: number; take?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return { items: [], totalItems: 0 };
        }

        // Get seller profile
        const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
        if (!profile) {
            return { items: [], totalItems: 0 };
        }

        console.log(`[mySellerProducts] Fetching products for seller profile: ${profile.id}`);

        // Use direct database query to bypass Vendure's limit restrictions
        const sellerIdStr = profile.id.toString();

        // Build query with optional productType filter
        let queryBuilder = this.connection.rawConnection
            .getRepository('product')
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.featuredAsset', 'featuredAsset')
            .leftJoinAndSelect('product.translations', 'translations')
            .where('product.customFieldsSellerid = :sellerId', { sellerId: sellerIdStr })
            .andWhere('product.deletedAt IS NULL')
            .orderBy('product.createdAt', 'DESC');

        if (args.productType) {
            queryBuilder = queryBuilder.andWhere('product.customFieldsProducttype = :productType', { productType: args.productType });
        }

        // Get total count
        const totalCount = await queryBuilder.getCount();

        // Apply pagination
        const skip = args.skip || 0;
        const take = args.take || 50;
        const rawProducts = await queryBuilder.skip(skip).take(take).getMany();

        console.log(`[mySellerProducts] Found ${totalCount} total, returning ${rawProducts.length}`);

        // Map to SellerProduct type with variants and all custom fields
        const items = await Promise.all(rawProducts.map(async (product: any) => {
            // Get variants for pricing
            const variantResult = await this.productVariantService.getVariantsByProductId(ctx, product.id);
            const defaultVariant = variantResult.items[0];

            // Get product info from translations
            const translation = product.translations?.[0];
            const name = translation?.name || 'Unnamed Product';
            const slug = translation?.slug || '';
            const description = translation?.description || '';

            // Custom fields - check both camelCase and lowercase column names
            const cf = product.customFields || {};
            const productType = cf.productType || product.customFieldsProducttype || 'tune';
            const contactForPricing = cf.contactForPricing ?? product.customFieldsContactforpricing ?? false;

            // Tune-specific fields
            const platform = cf.platform || product.customFieldsPlatform;
            const software = cf.software || product.customFieldsSoftware;
            const hpGain = cf.hpGain || product.customFieldsHpgain;
            const torqueGain = cf.torqueGain || product.customFieldsTorquegain;
            const requiredMods = cf.requiredMods || product.customFieldsRequiredmods;

            // Part-specific fields
            const brand = cf.brand || product.customFieldsBrand;
            const category = cf.category || product.customFieldsCategory;
            const condition = cf.condition || product.customFieldsCondition;
            const sku = cf.sku || product.customFieldsSku;
            const weight = cf.weight || product.customFieldsWeight;
            const dimensions = cf.dimensions || product.customFieldsDimensions;
            const compatibleVehicles = cf.compatibleVehicles || product.customFieldsCompatiblevehicles;
            const trackInventory = cf.trackInventory ?? product.customFieldsTrackinventory;
            const freeShipping = cf.freeShipping ?? product.customFieldsFreeshipping ?? false;
            const localPickup = cf.localPickup ?? product.customFieldsLocalpickup ?? false;

            // Service-specific fields
            const serviceType = cf.serviceType || product.customFieldsServicetype;
            const duration = cf.duration || product.customFieldsDuration;
            const whatsIncluded = cf.whatsIncluded || product.customFieldsWhatsincluded;
            const requirements = cf.requirements || product.customFieldsRequirements;
            const appointmentRequired = cf.appointmentRequired ?? product.customFieldsAppointmentrequired ?? true;
            const weekendsAvailable = cf.weekendsAvailable ?? product.customFieldsWeekendsavailable ?? false;
            const mobileService = cf.mobileService ?? product.customFieldsMobileservice ?? false;
            const depositRequired = cf.depositRequired ?? product.customFieldsDepositrequired ?? false;
            const depositAmount = cf.depositAmount || product.customFieldsDepositamount;
            const pricingType = cf.pricingType || product.customFieldsPricingtype || 'flat_rate';
            const hourlyRate = cf.hourlyRate || product.customFieldsHourlyrate;
            const setupFee = cf.setupFee || product.customFieldsSetupfee;
            const minimumHours = cf.minimumHours || product.customFieldsMinimumhours;
            const maxHours = cf.maxHours || product.customFieldsMaxhours;
            const allowHourSelection = cf.allowHourSelection ?? product.customFieldsAllowhourselection ?? true;

            return {
                id: product.id.toString(),
                name,
                slug,
                description,
                price: defaultVariant?.price || 0,
                priceWithTax: defaultVariant?.priceWithTax || defaultVariant?.price || 0,
                productType,
                status: product.enabled ? 'active' : 'disabled',
                featuredAsset: product.featuredAsset ? {
                    id: product.featuredAsset.id.toString(),
                    preview: product.featuredAsset.preview,
                } : null,
                featuredAssetUrl: product.featuredAsset?.preview || null,
                sales: 0, // TODO: Calculate from orders
                rating: null,
                reviewCount: 0,
                stock: (defaultVariant as any)?.stockOnHand || 0,
                inStock: ((defaultVariant as any)?.stockOnHand || 0) > 0,
                // Tune fields
                platform,
                software,
                hpGain,
                torqueGain,
                requiredMods,
                // Part fields
                brand,
                category,
                condition,
                sku,
                weight,
                dimensions,
                compatibleVehicles,
                trackInventory,
                freeShipping,
                localPickup,
                // Service fields
                serviceType,
                duration,
                whatsIncluded,
                requirements,
                appointmentRequired,
                weekendsAvailable,
                mobileService,
                depositRequired,
                depositAmount,
                pricingType,
                hourlyRate,
                setupFee,
                minimumHours,
                maxHours,
                allowHourSelection,
                contactForPricing,
                createdAt: product.createdAt,
            };
        }));

        return {
            items,
            totalItems: totalCount,
        };
    }

    /**
     * Get current seller's orders from MarketplaceDB
     * Uses Prisma to query orders synced from Vendure
     */
    @Query()
    @Allow(Permission.Authenticated)
    async mySellerOrders(
        @Ctx() ctx: RequestContext,
        @Args() args: { status?: string; productType?: string; skip?: number; take?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return { items: [], totalItems: 0 };
        }

        // Find the marketplace seller by Vendure customer ID
        const marketplaceSeller = await this.prisma.seller.findFirst({
            where: {
                OR: [
                    { vendureCustomerId: String(customer.id) },
                    { email: customer.emailAddress },
                ],
            },
        });

        if (!marketplaceSeller) {
            return { items: [], totalItems: 0 };
        }

        // Build where clause for orders
        const whereClause: any = { vendorId: marketplaceSeller.id };

        if (args.status) {
            whereClause.status = args.status.toUpperCase();
        }

        // Query orders from marketplace DB
        const [orders, totalItems] = await Promise.all([
            this.prisma.order.findMany({
                where: whereClause,
                include: {
                    lines: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: args.skip || 0,
                take: args.take || 20,
            }),
            this.prisma.order.count({ where: whereClause }),
        ]);

        // Map to SellerOrder format
        const items = orders.map(order => ({
            id: String(order.id),
            code: order.orderNumber,
            customerName: order.buyerName,
            customerEmail: order.buyerEmail,
            total: Math.round(order.total * 100), // Convert to cents for consistency
            status: order.status,
            lines: order.lines.map(line => ({
                id: String(line.id),
                productName: line.productName,
                productType: line.productType,
                quantity: line.quantity,
                unitPrice: Math.round(line.unitPrice * 100),
                lineTotal: Math.round(line.lineTotal * 100),
            })),
            createdAt: order.createdAt,
        }));

        return { items, totalItems };
    }

    /**
     * Get current buyer's orders from marketplace sellers
     * Uses Prisma to query orders synced from Vendure
     */
    @Query()
    @Allow(Permission.Authenticated)
    async myBuyerOrders(
        @Ctx() ctx: RequestContext,
        @Args() args: { status?: string; skip?: number; take?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return { items: [], totalItems: 0 };
        }

        // Build where clause for buyer orders
        const whereClause: any = {
            OR: [
                { buyerId: String(customer.id) },
                { buyerEmail: customer.emailAddress },
            ],
        };

        if (args.status) {
            whereClause.status = args.status.toUpperCase();
        }

        // Query orders from marketplace DB
        const [orders, totalItems] = await Promise.all([
            this.prisma.order.findMany({
                where: whereClause,
                include: {
                    lines: true,
                    vendor: {
                        select: {
                            id: true,
                            businessName: true,
                            firstName: true,
                            lastName: true,
                            slug: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: args.skip || 0,
                take: args.take || 20,
            }),
            this.prisma.order.count({ where: whereClause }),
        ]);

        // Map to BuyerOrder format
        const items = orders.map(order => ({
            id: String(order.id),
            code: order.orderNumber,
            vendureOrderId: order.vendureOrderId,
            sellerId: String(order.vendorId),
            sellerName: order.vendor.businessName || `${order.vendor.firstName} ${order.vendor.lastName}`,
            sellerSlug: order.vendor.slug,
            total: Math.round(order.total * 100), // Convert to cents
            platformFee: Math.round(order.platformFee * 100),
            status: order.status,
            paymentStatus: order.paymentStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            lines: order.lines.map(line => ({
                id: String(line.id),
                productName: line.productName,
                productType: line.productType,
                quantity: line.quantity,
                unitPrice: Math.round(line.unitPrice * 100),
                lineTotal: Math.round(line.lineTotal * 100),
            })),
            shippingAddress: order.shippingAddress,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl,
            placedAt: order.placedAt,
            paidAt: order.paidAt,
        }));

        return { items, totalItems };
    }

    /**
     * Check if current customer is an admin viewer
     */
    @Query()
    @Allow(Permission.Authenticated)
    async isAdminViewer(
        @Ctx() ctx: RequestContext,
    ): Promise<boolean> {
        if (!ctx.activeUserId) {
            return false;
        }

        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        return (customer as any)?.customFields?.isAdminViewer === true;
    }

    /**
     * Get all sellers for admin viewer dropdown
     */
    @Query()
    @Allow(Permission.Authenticated)
    async allSellersForViewer(
        @Ctx() ctx: RequestContext,
    ): Promise<SellerProfile[]> {
        if (!ctx.activeUserId) {
            return [];
        }

        // Verify caller is admin viewer
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!(customer as any)?.customFields?.isAdminViewer) {
            return [];
        }

        const result = await this.sellerProfileService.findAllApproved(ctx, { take: 100 });
        return result.items;
    }

    /**
     * Get a seller's products for admin viewer
     */
    @Query()
    @Allow(Permission.Authenticated)
    async sellerProductsForViewer(
        @Ctx() ctx: RequestContext,
        @Args() args: { sellerId: string; productType?: string },
    ): Promise<{ items: any[]; totalItems: number }> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }

        // Verify caller is admin viewer
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!(customer as any)?.customFields?.isAdminViewer) {
            return { items: [], totalItems: 0 };
        }

        // Get the target seller profile
        const sellerProfile = await this.sellerProfileService.getById(ctx, args.sellerId);
        if (!sellerProfile) {
            return { items: [], totalItems: 0 };
        }

        // Query products for this seller
        // For now, return empty - need proper seller-product association
        return { items: [], totalItems: 0 };
    }

    /**
     * Get a seller's orders for admin viewer
     */
    @Query()
    @Allow(Permission.Authenticated)
    async sellerOrdersForViewer(
        @Ctx() ctx: RequestContext,
        @Args() args: { sellerId: string; status?: string },
    ): Promise<{ items: any[]; totalItems: number }> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }

        // Verify caller is admin viewer
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!(customer as any)?.customFields?.isAdminViewer) {
            return { items: [], totalItems: 0 };
        }

        // Return empty for now - need proper order-seller association
        return { items: [], totalItems: 0 };
    }

    // =========================================================================
    // Product Creation Endpoints
    // =========================================================================

    /**
     * Create a tune listing
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async createTuneListing(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: any },
    ): Promise<{ success: boolean; message?: string; productId?: string; slug?: string }> {
        return this.createProductListing(ctx, args.input, 'tune');
    }

    /**
     * Create a parts listing
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async createPartsListing(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: any },
    ): Promise<{ success: boolean; message?: string; productId?: string; slug?: string }> {
        return this.createProductListing(ctx, args.input, 'part');
    }

    /**
     * Create a service listing
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async createServiceListing(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: any },
    ): Promise<{ success: boolean; message?: string; productId?: string; slug?: string }> {
        return this.createProductListing(ctx, args.input, 'service');
    }

    /**
     * Helper to create a product listing with variant
     * In Vendure, products MUST have at least one variant to be visible and purchasable
     */
    private async createProductListing(
        ctx: RequestContext,
        input: any,
        productType: string,
    ): Promise<{ success: boolean; message?: string; productId?: string; slug?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }
            console.log(`[Seller Product] Starting ${productType} creation for customer ${customer.id}`);

            // Verify seller
            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile || profile.status !== 'approved') {
                console.log(`[Seller Product] Rejected: Seller not approved (profile status: ${profile?.status || 'none'})`);
                return { success: false, message: 'You must be an approved seller to create listings' };
            }

            console.log(`[Seller Product] Seller verified: ${profile.id} (${profile.businessName})`);

            // Generate slug
            const baseSlug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const suffix = Math.random().toString(36).substring(2, 8);
            const slug = `${baseSlug}-${suffix}`;

            // Generate SKU
            const sku = `${productType.toUpperCase()}-${suffix.toUpperCase()}`;

            console.log(`[Seller Product] Generated slug: ${slug}, SKU: ${sku}`);

            // Build custom fields, including tune-specific fields if applicable
            const customFields: any = {
                productType,
                isDigital: productType === 'tune',
                sellerId: profile.id.toString(),
                contactForPricing: input.contactForPricing || false,
            };

            // Add tune-specific metadata
            if (productType === 'tune') {
                if (input.platform) customFields.platform = input.platform;
                if (input.software) customFields.software = input.software;
                if (input.hpGain) customFields.hpGain = input.hpGain;
                if (input.torqueGain) customFields.torqueGain = input.torqueGain;
                if (input.requiredMods) customFields.requiredMods = input.requiredMods;
            }

            // Add service-specific pricing fields
            if (productType === 'service') {
                customFields.pricingType = input.pricingType || 'flat_rate';
                if (input.hourlyRate) customFields.hourlyRate = input.hourlyRate;
                if (input.setupFee) customFields.setupFee = input.setupFee;
                if (input.minimumHours) customFields.minimumHours = input.minimumHours;
                if (input.allowHourSelection !== undefined) customFields.allowHourSelection = input.allowHourSelection;
                if (input.maxHours) customFields.maxHours = input.maxHours;
            }

            console.log(`[Seller Product] Custom fields:`, JSON.stringify(customFields, null, 2));

            // Create the product - IMPORTANT: Set enabled=true so it's visible in the storefront
            const product = await this.productService.create(ctx, {
                enabled: true, // Product must be enabled to appear in queries
                translations: [{
                    languageCode: ctx.languageCode || LanguageCode.en,
                    name: input.name,
                    slug,
                    description: input.description || '',
                }],
                customFields,
                featuredAssetId: input.featuredAssetId,
            });

            console.log(`[Seller Product] Product created: ${product.id}, enabled: true`);

            // CRITICAL: Create a default product variant
            // Without a variant, the product won't appear in search or be purchasable
            // Note: Frontend already converts to cents, so we just round here
            const priceInCents = Math.round(input.price || 0);

            console.log(`[Seller Product] Creating variant with price: ${priceInCents} cents`);

            // Get default tax category to avoid "no-active-tax-zone" error
            let taxCategoryId: string | undefined;
            try {
                const taxCategories = await this.taxCategoryService.findAll(ctx);
                if (taxCategories.items.length > 0) {
                    // Use the first tax category (usually "standard")
                    taxCategoryId = taxCategories.items[0].id.toString();
                    console.log(`[Seller Product] Using tax category: ${taxCategoryId}`);
                }
            } catch (taxError) {
                console.log(`[Seller Product] Could not get tax category, proceeding without one`);
            }

            const variants = await this.productVariantService.create(ctx, [{
                productId: product.id,
                sku,
                price: priceInCents,
                taxCategoryId,
                translations: [{
                    languageCode: ctx.languageCode || LanguageCode.en,
                    name: input.name,
                }],
                stockOnHand: productType === 'tune' ? 999999 : (input.stock || 100), // Digital products have unlimited stock
                trackInventory: productType === 'tune' ? GlobalFlag.FALSE : GlobalFlag.TRUE, // Don't track inventory for digital products
            }]);

            console.log(`[Seller Product] Variant created: ${variants[0]?.id}`);

            // CRITICAL: Assign product and variant to the current channel
            // Without this, products won't be visible in shop API queries
            try {
                await this.channelService.assignToCurrentChannel(product, ctx);
                console.log(`[Seller Product] Product ${product.id} assigned to channel ${ctx.channelId}`);

                // Also assign the variant to the channel with the price
                if (variants[0]) {
                    await this.channelService.assignToCurrentChannel(variants[0], ctx);
                    console.log(`[Seller Product] Variant ${variants[0].id} assigned to channel ${ctx.channelId}`);
                }
            } catch (channelError: any) {
                console.log(`[Seller Product] Channel assignment note: ${channelError.message}`);
                // Products might already be assigned to default channel automatically
            }

            console.log(`[Seller Product] SUCCESS: Created ${productType} product ${product.id} with variant for seller ${profile.id}`);

            return {
                success: true,
                message: 'Product created successfully',
                productId: product.id.toString(),
                slug,
            };
        } catch (error: any) {
            console.error(`[Seller Product] FAILED: Error creating ${productType} listing:`, error.message);
            console.error(`[Seller Product] Stack trace:`, error.stack);
            return { success: false, message: error.message || 'Failed to create product' };
        }
    }

    /**
     * Update a product listing with all fields
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async updateProductListing(
        @Ctx() ctx: RequestContext,
        @Args() args: {
            productId: string;
            name?: string;
            description?: string;
            price?: number;
            contactForPricing?: boolean;
            status?: string;
            // Tune fields
            platform?: string;
            software?: string;
            hpGain?: string;
            torqueGain?: string;
            requiredMods?: string;
            // Part fields
            brand?: string;
            category?: string;
            condition?: string;
            sku?: string;
            stock?: number;
            weight?: number;
            dimensions?: string;
            compatibleVehicles?: string;
            trackInventory?: boolean;
            freeShipping?: boolean;
            localPickup?: boolean;
            // Service fields
            serviceType?: string;
            duration?: string;
            whatsIncluded?: string;
            requirements?: string;
            appointmentRequired?: boolean;
            weekendsAvailable?: boolean;
            mobileService?: boolean;
            depositRequired?: boolean;
            depositAmount?: number;
            pricingType?: string;
            hourlyRate?: number;
            setupFee?: number;
            minimumHours?: number;
            maxHours?: number;
            allowHourSelection?: boolean;
        },
    ): Promise<{ success: boolean; message?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }
            // Verify seller owns this product
            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile || profile.status !== 'approved') {
                return { success: false, message: 'You must be an approved seller to update listings' };
            }

            // Get the product and verify ownership
            const product = await this.productService.findOne(ctx, args.productId);
            if (!product) {
                return { success: false, message: 'Product not found' };
            }
            if ((product.customFields as any)?.sellerId !== profile.id.toString()) {
                return { success: false, message: 'You can only edit your own products' };
            }

            // Build the update input
            const updateInput: any = { id: args.productId };

            // Update translations if name or description provided
            if (args.name !== undefined || args.description !== undefined) {
                updateInput.translations = [{
                    languageCode: ctx.languageCode || LanguageCode.en,
                    name: args.name,
                    description: args.description,
                }];
            }

            // Update enabled status if status provided
            if (args.status !== undefined) {
                updateInput.enabled = args.status === 'active';
            }

            // Build custom fields update
            const customFieldsUpdate: any = {};

            // Common fields
            if (args.contactForPricing !== undefined) customFieldsUpdate.contactForPricing = args.contactForPricing;

            // Tune-specific fields
            if (args.platform !== undefined) customFieldsUpdate.platform = args.platform;
            if (args.software !== undefined) customFieldsUpdate.software = args.software;
            if (args.hpGain !== undefined) customFieldsUpdate.hpGain = args.hpGain;
            if (args.torqueGain !== undefined) customFieldsUpdate.torqueGain = args.torqueGain;
            if (args.requiredMods !== undefined) customFieldsUpdate.requiredMods = args.requiredMods;

            // Part-specific fields
            if (args.brand !== undefined) customFieldsUpdate.brand = args.brand;
            if (args.category !== undefined) customFieldsUpdate.category = args.category;
            if (args.condition !== undefined) customFieldsUpdate.condition = args.condition;
            if (args.sku !== undefined) customFieldsUpdate.sku = args.sku;
            if (args.weight !== undefined) customFieldsUpdate.weight = args.weight;
            if (args.dimensions !== undefined) customFieldsUpdate.dimensions = args.dimensions;
            if (args.compatibleVehicles !== undefined) customFieldsUpdate.compatibleVehicles = args.compatibleVehicles;
            if (args.trackInventory !== undefined) customFieldsUpdate.trackInventory = args.trackInventory;
            if (args.freeShipping !== undefined) customFieldsUpdate.freeShipping = args.freeShipping;
            if (args.localPickup !== undefined) customFieldsUpdate.localPickup = args.localPickup;

            // Service-specific fields
            if (args.serviceType !== undefined) customFieldsUpdate.serviceType = args.serviceType;
            if (args.duration !== undefined) customFieldsUpdate.duration = args.duration;
            if (args.whatsIncluded !== undefined) customFieldsUpdate.whatsIncluded = args.whatsIncluded;
            if (args.requirements !== undefined) customFieldsUpdate.requirements = args.requirements;
            if (args.appointmentRequired !== undefined) customFieldsUpdate.appointmentRequired = args.appointmentRequired;
            if (args.weekendsAvailable !== undefined) customFieldsUpdate.weekendsAvailable = args.weekendsAvailable;
            if (args.mobileService !== undefined) customFieldsUpdate.mobileService = args.mobileService;
            if (args.depositRequired !== undefined) customFieldsUpdate.depositRequired = args.depositRequired;
            if (args.depositAmount !== undefined) customFieldsUpdate.depositAmount = args.depositAmount;
            if (args.pricingType !== undefined) customFieldsUpdate.pricingType = args.pricingType;
            if (args.hourlyRate !== undefined) customFieldsUpdate.hourlyRate = args.hourlyRate;
            if (args.setupFee !== undefined) customFieldsUpdate.setupFee = args.setupFee;
            if (args.minimumHours !== undefined) customFieldsUpdate.minimumHours = args.minimumHours;
            if (args.maxHours !== undefined) customFieldsUpdate.maxHours = args.maxHours;
            if (args.allowHourSelection !== undefined) customFieldsUpdate.allowHourSelection = args.allowHourSelection;

            // Only add customFields to update if there are fields to update
            if (Object.keys(customFieldsUpdate).length > 0) {
                updateInput.customFields = customFieldsUpdate;
            }

            // Update the product
            await this.productService.update(ctx, updateInput);

            // Update variant price and stock if provided
            const variantsResult = await this.productVariantService.getVariantsByProductId(ctx, args.productId as any);
            if (variantsResult.items && variantsResult.items.length > 0) {
                const variantUpdate: any = { id: variantsResult.items[0].id };

                if (args.price !== undefined) {
                    variantUpdate.price = args.price;
                }
                if (args.stock !== undefined) {
                    variantUpdate.stockOnHand = args.stock;
                }

                if (Object.keys(variantUpdate).length > 1) { // More than just id
                    await this.productVariantService.update(ctx, [variantUpdate]);
                }
            }

            console.log(`[Seller Product] Updated product ${args.productId} successfully`);
            return { success: true, message: 'Product updated successfully' };
        } catch (error: any) {
            console.error('[Seller Product] Update error:', error);
            return { success: false, message: error.message || 'Failed to update product' };
        }
    }

    /**
     * Delete a product listing
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async deleteProductListing(
        @Ctx() ctx: RequestContext,
        @Args() args: { productId: string },
    ): Promise<{ success: boolean; message?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }
            // Verify seller owns this product
            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile || profile.status !== 'approved') {
                return { success: false, message: 'You must be an approved seller to delete listings' };
            }

            await this.productService.softDelete(ctx, args.productId);

            return { success: true, message: 'Product deleted successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to delete product' };
        }
    }

    /**
     * Update the current seller's URL slug
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async updateSellerSlug(
        @Ctx() ctx: RequestContext,
        @Args() args: { slug: string },
    ): Promise<{ success: boolean; message?: string; newSlug?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            // Get seller profile
            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            // Normalize the slug
            const normalizedSlug = args.slug
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .replace(/-+/g, '-');

            // Validation checks
            if (normalizedSlug.length < 3) {
                return { success: false, message: 'URL must be at least 3 characters long' };
            }

            if (normalizedSlug.length > 50) {
                return { success: false, message: 'URL must be 50 characters or less' };
            }

            // Reserved slugs
            const reservedSlugs = ['admin', 'api', 'dashboard', 'login', 'signup', 'register', 'settings', 'profile', 'account', 'help', 'support', 'about', 'contact', 'terms', 'privacy', 'tunerswap', 'seller', 'sellers', 'buyer', 'buyers', 'product', 'products', 'tune', 'tunes', 'part', 'parts', 'service', 'services'];

            if (reservedSlugs.includes(normalizedSlug)) {
                return { success: false, message: 'This URL is reserved and cannot be used' };
            }

            // Check if slug is the same as current
            if (profile.slug === normalizedSlug) {
                return { success: true, message: 'URL unchanged', newSlug: normalizedSlug };
            }

            // Check if slug is taken by another seller
            const existing = await this.sellerProfileService.getBySlug(ctx, normalizedSlug);
            if (existing && existing.id !== profile.id) {
                return { success: false, message: 'This URL is already taken by another seller' };
            }

            // Update the slug
            await this.connection.getRepository(ctx, SellerProfile).update(
                { id: profile.id },
                { slug: normalizedSlug }
            );

            console.log(`[Seller Profile] Updated slug for seller ${profile.id}: ${profile.slug} -> ${normalizedSlug}`);

            return {
                success: true,
                message: 'URL updated successfully',
                newSlug: normalizedSlug,
            };
        } catch (error: any) {
            console.error('[Seller Profile] Slug update error:', error);
            return { success: false, message: error.message || 'Failed to update URL' };
        }
    }

    // =========================================================================
    // Invoice Endpoints
    // =========================================================================

    /**
     * Create a custom invoice (one-time payment link)
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async createInvoiceListing(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: any },
    ): Promise<{ success: boolean; message?: string; invoice?: any; paymentUrl?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            // Verify seller
            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile || profile.status !== 'approved') {
                return { success: false, message: 'You must be an approved seller to create invoices' };
            }

            console.log(`[Invoice] Creating invoice for seller ${profile.id}`);

            // Generate unique token for payment URL
            const token = this.generateInvoiceToken();

            // Calculate expiration date
            const expirationDays = args.input.expirationDays || 30;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expirationDays);

            // Generate slug and SKU
            const baseSlug = args.input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const suffix = Math.random().toString(36).substring(2, 8);
            const slug = `invoice-${baseSlug}-${suffix}`;
            const sku = `INV-${suffix.toUpperCase()}`;

            // Build custom fields for invoice
            const customFields: any = {
                productType: 'invoice',
                isDigital: true,
                sellerId: profile.id.toString(),
                contactForPricing: false,
                invoiceToken: token,
                recipientCustomerId: args.input.recipientCustomerId || null,
                recipientEmail: args.input.recipientEmail,
                invoiceStatus: 'draft',
                invoiceExpiresAt: expiresAt,
                invoiceNotes: args.input.notes || null,
                invoiceLineItems: args.input.lineItems || null,
            };

            // Create the product (invoice as a product)
            const product = await this.productService.create(ctx, {
                enabled: true,
                translations: [{
                    languageCode: ctx.languageCode || LanguageCode.en,
                    name: args.input.name,
                    slug,
                    description: args.input.description || '',
                }],
                customFields,
            });

            console.log(`[Invoice] Product created: ${product.id}`);

            // Create variant with price
            const priceInCents = Math.round(args.input.price || 0);

            // Get default tax category
            let taxCategoryId: string | undefined;
            try {
                const taxCategories = await this.taxCategoryService.findAll(ctx);
                if (taxCategories.items.length > 0) {
                    taxCategoryId = taxCategories.items[0].id.toString();
                }
            } catch (taxError) {
                console.log(`[Invoice] Could not get tax category`);
            }

            await this.productVariantService.create(ctx, [{
                productId: product.id,
                sku,
                price: priceInCents,
                taxCategoryId,
                translations: [{
                    languageCode: ctx.languageCode || LanguageCode.en,
                    name: args.input.name,
                }],
                stockOnHand: 1, // Single use invoice
                trackInventory: GlobalFlag.TRUE,
            }]);

            // Assign to channel
            try {
                await this.channelService.assignToCurrentChannel(product, ctx);
            } catch (channelError: any) {
                console.log(`[Invoice] Channel assignment note: ${channelError.message}`);
            }

            // Build payment URL
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const paymentUrl = `${baseUrl}/pay/${token}`;

            // Find marketplace seller
            const marketplaceSeller = await this.prisma.seller.findFirst({
                where: {
                    OR: [
                        { vendureCustomerId: String(customer.id) },
                        { email: customer.emailAddress },
                    ],
                },
            });

            // Calculate commission (10% default for invoices)
            const commissionRate = 0.10;
            const commissionAmount = Math.round(priceInCents * commissionRate) / 100; // in dollars
            const vendorPayout = (priceInCents / 100) - commissionAmount;

            // Generate invoice number
            const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${suffix.toUpperCase()}`;

            // Sync invoice to marketplace database
            if (marketplaceSeller) {
                try {
                    await this.prisma.invoice.create({
                        data: {
                            invoiceNumber,
                            token,
                            vendureProductId: String(product.id),
                            vendorId: marketplaceSeller.id,
                            recipientEmail: args.input.recipientEmail,
                            recipientName: args.input.recipientName || null,
                            recipientCustomerId: args.input.recipientCustomerId || null,
                            name: args.input.name,
                            description: args.input.description || null,
                            notes: args.input.notes || null,
                            lineItems: args.input.lineItems ? JSON.stringify(args.input.lineItems) : null,
                            subtotal: priceInCents / 100,
                            total: priceInCents / 100,
                            platformFee: commissionAmount,
                            vendorPayout,
                            commissionRate,
                            commissionAmount,
                            status: args.input.sendEmail ? 'sent' : 'draft',
                            expiresAt,
                            sentAt: args.input.sendEmail ? new Date() : null,
                        },
                    });
                    console.log(`[Invoice] Synced invoice to marketplace DB: ${invoiceNumber}`);
                } catch (syncError: any) {
                    console.error(`[Invoice] Failed to sync to marketplace DB:`, syncError.message);
                    // Non-fatal - continue with invoice creation
                }
            }

            // If sendEmail is true, send the email and mark as sent
            if (args.input.sendEmail) {
                await this.connection.rawConnection.query(
                    `UPDATE product SET "customFieldsInvoicestatus" = ? WHERE id = ?`,
                    ['sent', product.id]
                );

                // Parse line items if present
                let parsedLineItems: any[] = [];
                if (args.input.lineItems) {
                    try {
                        parsedLineItems = typeof args.input.lineItems === 'string'
                            ? JSON.parse(args.input.lineItems)
                            : args.input.lineItems;
                    } catch (e) {
                        // Ignore parse errors
                    }
                }

                // Send invoice email via EventBus
                await this.eventBus.publish(new InvoicePaymentRequestEvent(ctx, {
                    id: product.id.toString(),
                    token,
                    name: args.input.name,
                    description: args.input.description,
                    price: priceInCents,
                    recipientEmail: args.input.recipientEmail,
                    recipientName: args.input.recipientName,
                    notes: args.input.notes,
                    lineItems: parsedLineItems.length > 0 ? parsedLineItems : undefined,
                    expiresAt,
                    seller: {
                        id: profile.id.toString(),
                        businessName: profile.businessName,
                        firstName: profile.firstName,
                        lastName: profile.lastName,
                    },
                }));
                console.log(`[Invoice] Email sent to ${args.input.recipientEmail}`);
            }

            const invoiceDetails = {
                id: product.id.toString(),
                productId: product.id.toString(),
                token,
                name: args.input.name,
                description: args.input.description || '',
                price: priceInCents,
                recipientCustomerId: args.input.recipientCustomerId,
                recipientEmail: args.input.recipientEmail,
                notes: args.input.notes,
                lineItems: args.input.lineItems,
                status: args.input.sendEmail ? 'sent' : 'draft',
                createdAt: new Date(),
                expiresAt,
                paidAt: null,
                seller: profile,
                paymentUrl,
            };

            console.log(`[Invoice] SUCCESS: Created invoice ${product.id} with token ${token}`);

            return {
                success: true,
                message: args.input.sendEmail ? 'Invoice created and sent' : 'Invoice created',
                invoice: invoiceDetails,
                paymentUrl,
            };
        } catch (error: any) {
            console.error(`[Invoice] FAILED:`, error.message);
            return { success: false, message: error.message || 'Failed to create invoice' };
        }
    }

    /**
     * Cancel an invoice
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async cancelInvoice(
        @Ctx() ctx: RequestContext,
        @Args() args: { invoiceId: string },
    ): Promise<{ success: boolean; message?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            // Verify seller
            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            // Get the invoice product
            const product = await this.productService.findOne(ctx, args.invoiceId);
            if (!product) {
                return { success: false, message: 'Invoice not found' };
            }

            const customFields = product.customFields as any;
            if (customFields?.productType !== 'invoice') {
                return { success: false, message: 'Not an invoice' };
            }

            if (customFields?.sellerId !== profile.id.toString()) {
                return { success: false, message: 'You can only cancel your own invoices' };
            }

            if (customFields?.invoiceStatus === 'paid') {
                return { success: false, message: 'Cannot cancel a paid invoice' };
            }

            // Update status to cancelled
            await this.connection.rawConnection.query(
                `UPDATE product SET "customFieldsInvoicestatus" = ? WHERE id = ?`,
                ['cancelled', args.invoiceId]
            );

            console.log(`[Invoice] Cancelled invoice ${args.invoiceId}`);

            return { success: true, message: 'Invoice cancelled' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to cancel invoice' };
        }
    }

    /**
     * Resend invoice email notification
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async resendInvoiceEmail(
        @Ctx() ctx: RequestContext,
        @Args() args: { invoiceId: string },
    ): Promise<{ success: boolean; message?: string }> {
        if (!ctx.activeUserId) {
            return { success: false, message: 'Not authenticated' };
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            const product = await this.productService.findOne(ctx, args.invoiceId);
            if (!product) {
                return { success: false, message: 'Invoice not found' };
            }

            const customFields = product.customFields as any;
            if (customFields?.productType !== 'invoice') {
                return { success: false, message: 'Not an invoice' };
            }

            if (customFields?.sellerId !== profile.id.toString()) {
                return { success: false, message: 'You can only resend your own invoices' };
            }

            if (customFields?.invoiceStatus === 'paid') {
                return { success: false, message: 'Invoice is already paid' };
            }

            if (customFields?.invoiceStatus === 'cancelled') {
                return { success: false, message: 'Invoice is cancelled' };
            }

            // Check if expired
            if (customFields?.invoiceExpiresAt && new Date(customFields.invoiceExpiresAt) < new Date()) {
                return { success: false, message: 'Invoice has expired' };
            }

            // Update status to sent
            await this.connection.rawConnection.query(
                `UPDATE product SET "customFieldsInvoicestatus" = ? WHERE id = ?`,
                ['sent', args.invoiceId]
            );

            // TODO: Actually send email via email service
            console.log(`[Invoice] Would resend email for invoice ${args.invoiceId} to ${customFields?.recipientEmail}`);

            return { success: true, message: 'Invoice email resent' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to resend invoice' };
        }
    }

    /**
     * Get current seller's invoices
     */
    @Query()
    @Allow(Permission.Authenticated)
    async mySellerInvoices(
        @Ctx() ctx: RequestContext,
        @Args() args: { status?: string; skip?: number; take?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }

        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return { items: [], totalItems: 0 };
        }

        const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
        if (!profile) {
            return { items: [], totalItems: 0 };
        }

        try {
            let queryBuilder = this.connection.rawConnection
                .getRepository('product')
                .createQueryBuilder('product')
                .leftJoinAndSelect('product.translations', 'translations')
                .where('product.customFieldsSellerid = :sellerId', { sellerId: profile.id.toString() })
                .andWhere('product.customFieldsProducttype = :productType', { productType: 'invoice' })
                .andWhere('product.deletedAt IS NULL')
                .orderBy('product.createdAt', 'DESC');

            if (args.status) {
                queryBuilder = queryBuilder.andWhere('product.customFieldsInvoicestatus = :status', { status: args.status });
            }

            const totalCount = await queryBuilder.getCount();
            const skip = args.skip || 0;
            const take = args.take || 50;
            const rawInvoices = await queryBuilder.skip(skip).take(take).getMany();

            // Get variants for pricing
            const items = await Promise.all(rawInvoices.map(async (product: any) => {
                const variantResult = await this.productVariantService.getVariantsByProductId(ctx, product.id);
                const defaultVariant = variantResult.items[0];

                const translation = product.translations?.[0];
                const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

                return {
                    id: product.id.toString(),
                    productId: product.id.toString(),
                    token: product.customFieldsInvoicetoken,
                    name: translation?.name || 'Unnamed Invoice',
                    description: translation?.description || '',
                    price: defaultVariant?.price || 0,
                    recipientCustomerId: product.customFieldsRecipientcustomerid,
                    recipientEmail: product.customFieldsRecipientemail,
                    notes: product.customFieldsInvoicenotes,
                    lineItems: product.customFieldsInvoicelineitems,
                    status: product.customFieldsInvoicestatus || 'draft',
                    createdAt: product.createdAt,
                    expiresAt: product.customFieldsInvoiceexpiresat,
                    paidAt: product.customFieldsInvoicepaidat,
                    seller: profile,
                    paymentUrl: `${baseUrl}/pay/${product.customFieldsInvoicetoken}`,
                };
            }));

            return { items, totalItems: totalCount };
        } catch (error: any) {
            console.error('[Invoice] Error fetching seller invoices:', error);
            return { items: [], totalItems: 0 };
        }
    }

    /**
     * Get invoice by payment token (public - for payment page)
     */
    @Query()
    async invoiceByToken(
        @Ctx() ctx: RequestContext,
        @Args() args: { token: string },
    ): Promise<any | null> {
        try {
            // Use raw SQL to ensure correct column name mapping
            const products = await this.connection.rawConnection.query(
                `SELECT p.*, t.name as translationName, t.description as translationDescription
                 FROM product p
                 LEFT JOIN product_translation t ON t.baseId = p.id
                 WHERE p.customFieldsInvoicetoken = ?
                 AND p.customFieldsProducttype = 'invoice'
                 AND p.deletedAt IS NULL
                 LIMIT 1`,
                [args.token]
            );

            if (!products || products.length === 0) {
                console.log('[Invoice] Not found for token:', args.token);
                return null;
            }

            const rawProduct = products[0];
            console.log('[Invoice] Found product:', rawProduct.id, 'recipientEmail:', rawProduct.customFieldsRecipientemail);

            // Get variant for pricing
            const variantResult = await this.productVariantService.getVariantsByProductId(ctx, rawProduct.id);
            const defaultVariant = variantResult.items[0];

            const sellerId = rawProduct.customFieldsSellerid;

            // Get seller profile
            const seller = sellerId ? await this.sellerProfileService.getById(ctx, sellerId) : null;

            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4000';

            return {
                id: rawProduct.id.toString(),
                productId: rawProduct.id.toString(),
                token: rawProduct.customFieldsInvoicetoken,
                name: rawProduct.translationName || 'Invoice',
                description: rawProduct.translationDescription || '',
                price: defaultVariant?.price || 0,
                recipientCustomerId: rawProduct.customFieldsRecipientcustomerid || null,
                recipientEmail: rawProduct.customFieldsRecipientemail || '',
                notes: rawProduct.customFieldsInvoicenotes || null,
                lineItems: rawProduct.customFieldsInvoicelineitems || null,
                status: rawProduct.customFieldsInvoicestatus || 'draft',
                createdAt: new Date(rawProduct.createdAt.replace(' ', 'T') + 'Z'),
                expiresAt: rawProduct.customFieldsInvoiceexpiresat
                    ? new Date(rawProduct.customFieldsInvoiceexpiresat.replace(' ', 'T') + 'Z')
                    : null,
                paidAt: rawProduct.customFieldsInvoicepaidat
                    ? new Date(rawProduct.customFieldsInvoicepaidat.replace(' ', 'T') + 'Z')
                    : null,
                seller: seller ? {
                    id: seller.id.toString(),
                    name: `${seller.firstName} ${seller.lastName}`,
                    businessName: seller.businessName || null,
                } : null,
                paymentUrl: `${baseUrl}/pay/${args.token}`,
            };
        } catch (error: any) {
            console.error('[Invoice] Error fetching by token:', error);
            return null;
        }
    }

    /**
     * Search customers by email/name for invoice recipient
     */
    @Query()
    @Allow(Permission.Authenticated)
    async searchCustomersForInvoice(
        @Ctx() ctx: RequestContext,
        @Args() args: { query: string; take?: number },
    ): Promise<any[]> {
        if (!ctx.activeUserId || !args.query || args.query.length < 2) {
            return [];
        }

        try {
            const take = args.take || 10;
            const searchTerm = `%${args.query}%`;

            // Search customers by email, firstName, or lastName
            const customers = await this.connection.rawConnection
                .getRepository('customer')
                .createQueryBuilder('customer')
                .where('customer.deletedAt IS NULL')
                .andWhere(
                    '(customer.emailAddress LIKE :search OR customer.firstName LIKE :search OR customer.lastName LIKE :search)',
                    { search: searchTerm }
                )
                .take(take)
                .getMany();

            return customers.map((c: any) => ({
                id: c.id.toString(),
                email: c.emailAddress,
                firstName: c.firstName,
                lastName: c.lastName,
                fullName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.emailAddress,
            }));
        } catch (error: any) {
            console.error('[Invoice] Customer search error:', error);
            return [];
        }
    }

    /**
     * Get invoices received by the current customer
     */
    @Query()
    @Allow(Permission.Authenticated)
    async myReceivedInvoices(
        @Ctx() ctx: RequestContext,
        @Args() args: { status?: string },
    ): Promise<any[]> {
        if (!ctx.activeUserId) {
            return [];
        }

        try {
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return [];
            }

            let queryBuilder = this.connection.rawConnection
                .getRepository('product')
                .createQueryBuilder('product')
                .leftJoinAndSelect('product.translations', 'translations')
                .where('product.customFieldsProducttype = :productType', { productType: 'invoice' })
                .andWhere('product.deletedAt IS NULL')
                .andWhere(
                    '(product.customFieldsRecipientcustomerid = :customerId OR product.customFieldsRecipientemail = :email)',
                    { customerId: customer.id.toString(), email: (customer as any).emailAddress }
                )
                .orderBy('product.createdAt', 'DESC');

            if (args.status) {
                queryBuilder = queryBuilder.andWhere('product.customFieldsInvoicestatus = :status', { status: args.status });
            }

            const rawInvoices = await queryBuilder.getMany();

            const invoices = await Promise.all(rawInvoices.map(async (product: any) => {
                const variantResult = await this.productVariantService.getVariantsByProductId(ctx, product.id);
                const defaultVariant = variantResult.items[0];

                const translation = product.translations?.[0];
                const sellerId = product.customFieldsSellerid;
                const seller = sellerId ? await this.sellerProfileService.getById(ctx, sellerId) : null;

                const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

                return {
                    id: product.id.toString(),
                    productId: product.id.toString(),
                    token: product.customFieldsInvoicetoken,
                    name: translation?.name || 'Invoice',
                    description: translation?.description || '',
                    price: defaultVariant?.price || 0,
                    recipientCustomerId: product.customFieldsRecipientcustomerid,
                    recipientEmail: product.customFieldsRecipientemail,
                    notes: product.customFieldsInvoicenotes,
                    lineItems: product.customFieldsInvoicelineitems,
                    status: product.customFieldsInvoicestatus || 'draft',
                    createdAt: product.createdAt,
                    expiresAt: product.customFieldsInvoiceexpiresat,
                    paidAt: product.customFieldsInvoicepaidat,
                    seller,
                    paymentUrl: `${baseUrl}/pay/${product.customFieldsInvoicetoken}`,
                };
            }));

            return invoices;
        } catch (error: any) {
            console.error('[Invoice] Error fetching received invoices:', error);
            return [];
        }
    }

    /**
     * Process invoice payment - creates a Stripe checkout session
     */
    @Mutation()
    async processInvoicePayment(
        @Ctx() ctx: RequestContext,
        @Args() args: { token: string },
    ): Promise<{ success: boolean; checkoutUrl?: string; message?: string }> {
        try {
            // Look up the invoice by token
            const rawProduct = await this.connection.rawConnection
                .getRepository('product')
                .createQueryBuilder('product')
                .leftJoinAndSelect('product.translations', 'translations')
                .where('product.customFieldsInvoicetoken = :token', { token: args.token })
                .andWhere('product.customFieldsProducttype = :productType', { productType: 'invoice' })
                .andWhere('product.deletedAt IS NULL')
                .getOne();

            if (!rawProduct) {
                return { success: false, message: 'Invoice not found' };
            }

            const invoiceProduct = rawProduct as any;

            // Check status
            const status = invoiceProduct.customFieldsInvoicestatus;
            if (status === 'paid') {
                return { success: false, message: 'Invoice has already been paid' };
            }
            if (status === 'cancelled') {
                return { success: false, message: 'Invoice has been cancelled' };
            }

            // Check expiration
            const expiresAt = invoiceProduct.customFieldsInvoiceexpiresat;
            if (expiresAt && new Date(expiresAt) < new Date()) {
                return { success: false, message: 'Invoice has expired' };
            }

            // Get variant for price
            const variantResult = await this.productVariantService.getVariantsByProductId(ctx, invoiceProduct.id);
            const variant = variantResult.items[0];
            if (!variant) {
                return { success: false, message: 'Invoice pricing not found' };
            }

            const priceInCents = variant.price;
            const translation = invoiceProduct.translations?.[0];
            const invoiceName = translation?.name || 'Invoice Payment';
            const sellerId = invoiceProduct.customFieldsSellerid;

            // Get seller profile for Stripe account
            const sellerProfile = sellerId ? await this.sellerProfileService.getById(ctx, sellerId) : null;

            // Get marketplace seller for Stripe account ID
            let stripeAccountId: string | null = null;
            if (sellerId) {
                const marketplaceSeller = await this.prisma.seller.findFirst({
                    where: { id: parseInt(sellerId, 10) },
                });
                stripeAccountId = marketplaceSeller?.stripeAccountId || null;
            }

            // Initialize Stripe
            const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeSecretKey) {
                return { success: false, message: 'Payment system not configured' };
            }

            const stripe = require('stripe')(stripeSecretKey);

            // Build return URLs
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const successUrl = `${baseUrl}/pay/${args.token}?success=true`;
            const cancelUrl = `${baseUrl}/pay/${args.token}?cancelled=true`;

            // Calculate commission (10% default for invoices)
            const commissionRate = 0.10;
            const commissionAmount = Math.round(priceInCents * commissionRate);

            // Create Stripe Checkout session
            let sessionConfig: any = {
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: invoiceName,
                            description: translation?.description || `Invoice from ${sellerProfile?.businessName || 'TunerSwap Seller'}`,
                        },
                        unit_amount: priceInCents,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    invoice_token: args.token,
                    vendure_product_id: invoiceProduct.id.toString(),
                    seller_id: sellerId,
                    type: 'invoice_payment',
                },
            };

            // If seller has Stripe Connect, use destination charges
            if (stripeAccountId) {
                sessionConfig.payment_intent_data = {
                    application_fee_amount: commissionAmount,
                    transfer_data: {
                        destination: stripeAccountId,
                    },
                };
            }

            const session = await stripe.checkout.sessions.create(sessionConfig);

            console.log(`[Invoice] Created Stripe checkout session: ${session.id} for invoice token ${args.token}`);

            return {
                success: true,
                checkoutUrl: session.url,
            };
        } catch (error: any) {
            console.error('[Invoice] Payment processing error:', error);
            return { success: false, message: error.message || 'Payment processing failed' };
        }
    }

    /**
     * Generate a unique invoice token
     */
    private generateInvoiceToken(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        const random2 = Math.random().toString(36).substring(2, 10);
        return `${timestamp}-${random}-${random2}`;
    }
}
