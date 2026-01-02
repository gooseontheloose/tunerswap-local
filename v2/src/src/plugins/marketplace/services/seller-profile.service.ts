import { Injectable, Inject } from '@nestjs/common';
import {
    TransactionalConnection,
    RequestContext,
    CustomerService,
    ID,
    EntityNotFoundError,
    UserService,
    isGraphQlErrorResult,
} from '@vendure/core';
import { SellerProfile } from '../entities/seller-profile.entity';
import { RegisterSellerInput, SellerProfileInput, MARKETPLACE_PLUGIN_OPTIONS, MarketplacePluginOptions } from '../types';
import { MarketplacePlugin } from '../marketplace.plugin';

/**
 * NOTE: Vendure admin access for sellers has been REMOVED.
 *
 * Sellers now authenticate ONLY through the Vendor API (port 3001) which uses
 * the MarketplaceDB for authentication. This provides true row-level isolation.
 *
 * The old approach created Vendure Administrator/Channel/Role entities for each
 * seller, but this had security issues (Channels don't provide row-level isolation).
 *
 * Now:
 * - Sellers register via Vendor API -> creates Seller in MarketplaceDB
 * - Sellers log in via Vendor API -> JWT with vendorId
 * - All seller operations go through Vendor API with vendorId filtering
 * - Optionally, a Customer account is created in Vendure for buyer activities
 */

@Injectable()
export class SellerProfileService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private userService: UserService,
        @Inject(MARKETPLACE_PLUGIN_OPTIONS) private options: MarketplacePluginOptions,
    ) {}

    /**
     * DEPRECATED: This method is kept for backward compatibility but should NOT be used.
     *
     * Seller registration now happens through the Vendor API (port 3001):
     * - POST /graphql with `registerSeller` mutation
     * - Creates seller in MarketplaceDB with password hash
     * - Returns JWT token for authentication
     *
     * This legacy method only creates:
     * 1. A Vendure Customer account (for buyer activities on the storefront)
     * 2. A SellerProfile entity (for reference, but auth is through MarketplaceDB)
     *
     * The actual seller data lives in MarketplaceDB and is accessed via Vendor API.
     *
     * @deprecated Use Vendor API `registerSeller` mutation instead
     */
    async registerSeller(ctx: RequestContext, input: RegisterSellerInput): Promise<{ profile: SellerProfile; vendorApiUrl: string }> {
        // Use desired slug if provided, otherwise generate from business name or full name
        let slug = input.desiredSlug
            ? this.generateSlug(input.desiredSlug)
            : this.generateSlug(input.businessName || `${input.firstName} ${input.lastName}`);

        // 1. Create a Customer account for the seller (for buyer activities on storefront)
        // This allows sellers to also purchase items as customers
        let customerId: ID | undefined;
        try {
            const customerResult = await this.customerService.create(ctx, {
                firstName: input.firstName,
                lastName: input.lastName,
                emailAddress: input.email,
                phoneNumber: input.phone,
            }, input.password);

            if (!isGraphQlErrorResult(customerResult)) {
                customerId = customerResult.id;
                // Mark customer as a seller
                await this.customerService.update(ctx, {
                    id: customerId,
                    customFields: {
                        isSeller: true,
                    },
                });

                // Auto-verify email if setting is enabled
                const settings = MarketplacePlugin.getEffectiveSettings();
                if (settings.autoVerifyEmail && customerResult.user) {
                    try {
                        // Mark user as verified
                        customerResult.user.verified = true;
                        await this.connection.rawConnection
                            .getRepository(customerResult.user.constructor)
                            .save(customerResult.user);

                        // Clear verification token from native auth method
                        const { NativeAuthenticationMethod } = await import('@vendure/core');
                        const authMethods = await this.connection.getRepository(ctx, NativeAuthenticationMethod).find({
                            where: { user: { id: customerResult.user.id } },
                        });
                        if (authMethods.length > 0) {
                            authMethods[0].verificationToken = null;
                            await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(authMethods[0]);
                        }
                        console.log(`[AutoVerify] Email auto-verified for seller: ${input.email}`);
                    } catch (verifyError) {
                        console.log(`Note: Could not auto-verify email for ${input.email}:`, verifyError);
                    }
                }
            } else {
                // GraphQL error result - customer might already exist, try to find them
                console.log(`[RegisterSeller] Customer creation returned error for ${input.email}, looking up existing customer...`);
                const { Customer } = await import('@vendure/core');
                const existingCustomer = await this.connection.getRepository(ctx, Customer).findOne({
                    where: { emailAddress: input.email },
                });
                if (existingCustomer) {
                    customerId = existingCustomer.id;
                    console.log(`[RegisterSeller] Found existing customer ${customerId} for ${input.email}`);
                    // Mark as seller if not already
                    await this.customerService.update(ctx, {
                        id: customerId,
                        customFields: {
                            isSeller: true,
                        },
                    });
                } else {
                    console.log(`[RegisterSeller] Could not find existing customer for ${input.email}`);
                }
            }
        } catch (error) {
            // Exception thrown - customer might already exist with same email, look them up
            console.log(`Note: Exception creating customer account for seller ${input.email}, looking up existing customer...`);
            try {
                const { Customer } = await import('@vendure/core');
                const existingCustomer = await this.connection.getRepository(ctx, Customer).findOne({
                    where: { emailAddress: input.email },
                });
                if (existingCustomer) {
                    customerId = existingCustomer.id;
                    console.log(`[RegisterSeller] Found existing customer ${customerId} for ${input.email}`);
                    // Mark as seller if not already
                    await this.customerService.update(ctx, {
                        id: customerId,
                        customFields: {
                            isSeller: true,
                        },
                    });
                }
            } catch (lookupError) {
                console.log(`Note: Could not look up existing customer:`, lookupError);
            }
        }

        // 2. Create a SellerProfile in Vendure DB (for backward compatibility)
        // NOTE: The actual seller data should be in MarketplaceDB via Vendor API
        const effectiveSettings = MarketplacePlugin.getEffectiveSettings();

        const sellerProfile = new SellerProfile({
            customerId: customerId,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            location: input.location,
            businessName: input.businessName,
            website: input.website,
            instagram: input.socialMedia,
            bio: input.bio,
            experience: input.experience,
            software: input.software || [],
            vehiclePlatforms: input.vehiclePlatforms || [],
            tuneTypes: input.tuneTypes || [],
            hasDyno: input.hasDyno,
            status: effectiveSettings.autoApprove ? 'approved' : 'pending',
            verified: effectiveSettings.autoVerifySeller,
            slug,
            // NO Vendure admin entities - sellers use Vendor API for dashboard
            sellerId: null,
            channelId: null,
            administratorId: null,
            stockLocationId: null,
        });

        const savedProfile = await this.connection.getRepository(ctx, SellerProfile).save(sellerProfile);

        // Update customer with seller profile reference if customer was created
        if (customerId) {
            await this.customerService.update(ctx, {
                id: customerId,
                customFields: {
                    sellerProfileId: savedProfile.id.toString(),
                },
            });
        }

        // Return profile and URL to complete registration via Vendor API
        const vendorApiUrl = process.env.VENDOR_API_URL || 'http://localhost:3001/graphql';

        console.log(`
[Seller Registration] Profile created for ${input.email}
  - Customer ID: ${customerId || 'none'}
  - Profile ID: ${savedProfile.id}
  - Complete registration at: ${vendorApiUrl}

NOTE: Sellers must complete registration via Vendor API:
  mutation {
    registerSeller(input: {
      email: "${input.email}"
      password: "..."
      firstName: "${input.firstName}"
      lastName: "${input.lastName}"
    }) {
      token
      seller { id }
    }
  }
`);

        return {
            profile: savedProfile,
            vendorApiUrl,
        };
    }

    /**
     * Get seller profile by customer ID
     */
    async getByCustomerId(ctx: RequestContext, customerId: ID): Promise<SellerProfile | null> {
        return this.connection.getRepository(ctx, SellerProfile).findOne({
            where: { customerId },
        });
    }

    /**
     * Get seller profile by ID
     */
    async getById(ctx: RequestContext, id: ID): Promise<SellerProfile | null> {
        return this.connection.getRepository(ctx, SellerProfile).findOne({
            where: { id },
        });
    }

    /**
     * Get seller profile by administrator ID.
     *
     * @deprecated Sellers no longer have Vendure Administrator accounts.
     * Use the Vendor API for seller authentication and data access.
     * This method is kept for backward compatibility during migration.
     */
    async getByAdministratorId(ctx: RequestContext, administratorId: ID): Promise<SellerProfile | null> {
        // Returns null since new sellers don't have administratorId set
        return this.connection.getRepository(ctx, SellerProfile).findOne({
            where: { administratorId },
        });
    }

    /**
     * Get seller profile by slug
     */
    async getBySlug(ctx: RequestContext, slug: string): Promise<SellerProfile | null> {
        return this.connection.getRepository(ctx, SellerProfile).findOne({
            where: { slug },
            relations: ['customer'],
        });
    }

    /**
     * Update seller profile
     */
    async update(ctx: RequestContext, id: ID, input: SellerProfileInput): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }

        // Update fields
        if (input.firstName !== undefined) profile.firstName = input.firstName;
        if (input.lastName !== undefined) profile.lastName = input.lastName;
        if (input.phone !== undefined) profile.phone = input.phone;
        if (input.location !== undefined) profile.location = input.location;
        if (input.address !== undefined) profile.address = input.address;
        if (input.businessName !== undefined) profile.businessName = input.businessName;
        if (input.website !== undefined) profile.website = input.website;
        if (input.instagram !== undefined) profile.instagram = input.instagram;
        if (input.facebook !== undefined) profile.facebook = input.facebook;
        if (input.youtube !== undefined) profile.youtube = input.youtube;
        if (input.bio !== undefined) profile.bio = input.bio;
        if (input.experience !== undefined) profile.experience = input.experience;
        if (input.software !== undefined) profile.software = input.software;
        if (input.vehiclePlatforms !== undefined) profile.vehiclePlatforms = input.vehiclePlatforms;
        if (input.tuneTypes !== undefined) profile.tuneTypes = input.tuneTypes;
        if (input.hasDyno !== undefined) profile.hasDyno = input.hasDyno;
        if (input.hours !== undefined) profile.hours = input.hours;
        if (input.profileComplete !== undefined) profile.profileComplete = input.profileComplete;

        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Get all approved sellers (for public listing)
     */
    async findAllApproved(ctx: RequestContext, options?: { skip?: number; take?: number }): Promise<{ items: SellerProfile[]; totalItems: number }> {
        const [items, totalItems] = await this.connection.getRepository(ctx, SellerProfile).findAndCount({
            where: { status: 'approved' },
            relations: ['customer'],
            skip: options?.skip || 0,
            take: options?.take || 20,
            order: { rating: 'DESC' },
        });

        return { items, totalItems };
    }

    /**
     * Admin: Get all sellers
     */
    async findAll(ctx: RequestContext, options?: { skip?: number; take?: number; status?: string }): Promise<{ items: SellerProfile[]; totalItems: number }> {
        const where: any = {};
        if (options?.status) {
            where.status = options.status;
        }

        const [items, totalItems] = await this.connection.getRepository(ctx, SellerProfile).findAndCount({
            where,
            relations: ['customer'],
            skip: options?.skip || 0,
            take: options?.take || 50,
            order: { createdAt: 'DESC' },
        });

        return { items, totalItems };
    }

    /**
     * Admin: Approve a seller
     */
    async approve(ctx: RequestContext, id: ID): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }
        profile.status = 'approved';
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Admin: Reject a seller
     */
    async reject(ctx: RequestContext, id: ID): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }
        profile.status = 'rejected';
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Admin: Suspend a seller
     */
    async suspend(ctx: RequestContext, id: ID): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }
        profile.status = 'suspended';
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Admin: Verify a seller (grant verified badge)
     */
    async verify(ctx: RequestContext, id: ID): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }
        profile.verified = true;
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Admin: Unverify a seller (remove verified badge)
     */
    async unverify(ctx: RequestContext, id: ID): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }
        profile.verified = false;
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Admin: Enable a seller (unsuspend/reactivate)
     */
    async enable(ctx: RequestContext, id: ID): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }
        // Restore to approved status (from suspended/rejected)
        profile.status = 'approved';
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Admin: Disable a seller (same as suspend but clearer naming)
     */
    async disable(ctx: RequestContext, id: ID): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }
        profile.status = 'suspended';
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Generate a URL-friendly slug
     */
    private generateSlug(name: string): string {
        const baseSlug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Add random suffix to ensure uniqueness
        const suffix = Math.random().toString(36).substring(2, 8);
        return `${baseSlug}-${suffix}`;
    }

    /**
     * Update seller statistics (called after orders, reviews, etc.)
     */
    async updateStats(ctx: RequestContext, id: ID, stats: Partial<{
        rating: number;
        reviewCount: number;
        tunesSold: number;
        totalOrders: number;
        totalRevenue: number;
    }>): Promise<SellerProfile> {
        const profile = await this.getById(ctx, id);
        if (!profile) {
            throw new EntityNotFoundError('SellerProfile', id);
        }

        if (stats.rating !== undefined) profile.rating = stats.rating;
        if (stats.reviewCount !== undefined) profile.reviewCount = stats.reviewCount;
        if (stats.tunesSold !== undefined) profile.tunesSold = stats.tunesSold;
        if (stats.totalOrders !== undefined) profile.totalOrders = stats.totalOrders;
        if (stats.totalRevenue !== undefined) profile.totalRevenue = stats.totalRevenue;

        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }
}
