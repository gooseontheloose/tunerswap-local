import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Allow, Transaction, CustomerService, Permission, TransactionalConnection, NativeAuthenticationMethod, AdministratorService, UserService, EventBus, AccountRegistrationEvent, ProductService, ProductVariantService, LanguageCode } from '@vendure/core';
import { GlobalFlag } from '@vendure/common/lib/generated-types';
import { SellerProfileService } from '../services/seller-profile.service';
import { SellerProfile } from '../entities/seller-profile.entity';
import { TunerRequest } from '../entities/tuner-request.entity';
import { MarketplaceAdminPermission } from '../permissions';
import { SellerProfileInput } from '../types';
import { MarketplacePlugin } from '../marketplace.plugin';
import { Like, In } from 'typeorm';

/**
 * Admin resolver for marketplace management.
 *
 * All operations require the MarketplaceAdmin permission, which is NOT granted
 * to regular seller administrators. Only superadmins or users with explicit
 * MarketplaceAdmin permission can access these endpoints.
 *
 * This ensures sellers cannot:
 * - View other sellers' profiles
 * - Approve/reject/suspend other sellers
 * - Access marketplace-wide settings
 */
@Resolver()
export class SellerProfileAdminResolver {
    constructor(
        private sellerProfileService: SellerProfileService,
        private customerService: CustomerService,
        private connection: TransactionalConnection,
        private administratorService: AdministratorService,
        private userService: UserService,
        private eventBus: EventBus,
        private productService: ProductService,
        private productVariantService: ProductVariantService,
    ) {}

    @Query()
    @Allow(MarketplaceAdminPermission.Permission)
    async sellerProfiles(
        @Ctx() ctx: RequestContext,
        @Args() args: { skip?: number; take?: number; status?: string },
    ): Promise<{ items: SellerProfile[]; totalItems: number }> {
        return this.sellerProfileService.findAll(ctx, {
            skip: args.skip,
            take: args.take,
            status: args.status,
        });
    }

    @Query()
    @Allow(MarketplaceAdminPermission.Permission)
    async sellerProfile(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile | null> {
        return this.sellerProfileService.getById(ctx, args.id);
    }

    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async approveSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        return this.sellerProfileService.approve(ctx, args.id);
    }

    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async rejectSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        return this.sellerProfileService.reject(ctx, args.id);
    }

    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async suspendSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        return this.sellerProfileService.suspend(ctx, args.id);
    }

    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async verifySeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        return this.sellerProfileService.verify(ctx, args.id);
    }

    /**
     * Remove verified badge from a seller.
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async unverifySeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        return this.sellerProfileService.unverify(ctx, args.id);
    }

    // =========================================================================
    // Custom Badge Management
    // =========================================================================

    /**
     * Get available badge icons for admin UI
     */
    @Query()
    @Allow(MarketplaceAdminPermission.Permission)
    async badgeIconOptions(): Promise<{ value: string; label: string }[]> {
        return [
            { value: 'star', label: 'Star' },
            { value: 'trophy', label: 'Trophy' },
            { value: 'fire', label: 'Fire' },
            { value: 'bolt', label: 'Bolt' },
            { value: 'shield', label: 'Shield' },
            { value: 'heart', label: 'Heart' },
            { value: 'crown', label: 'Crown' },
            { value: 'diamond', label: 'Diamond' },
            { value: 'rocket', label: 'Rocket' },
            { value: 'wrench', label: 'Wrench' },
            { value: 'check', label: 'Check' },
            { value: 'zap', label: 'Zap' },
            { value: 'medal', label: 'Medal' },
            { value: 'sparkles', label: 'Sparkles' },
            { value: 'lightning', label: 'Lightning' },
        ];
    }

    /**
     * Get available badge colors for admin UI
     */
    @Query()
    @Allow(MarketplaceAdminPermission.Permission)
    async badgeColorOptions(): Promise<{ value: string; label: string; hex: string }[]> {
        return [
            { value: 'gold', label: 'Gold', hex: '#FFD700' },
            { value: 'silver', label: 'Silver', hex: '#C0C0C0' },
            { value: 'bronze', label: 'Bronze', hex: '#CD7F32' },
            { value: 'red', label: 'Red', hex: '#EF4444' },
            { value: 'blue', label: 'Blue', hex: '#3B82F6' },
            { value: 'green', label: 'Green', hex: '#22C55E' },
            { value: 'purple', label: 'Purple', hex: '#A855F7' },
            { value: 'orange', label: 'Orange', hex: '#F97316' },
            { value: 'pink', label: 'Pink', hex: '#EC4899' },
            { value: 'cyan', label: 'Cyan', hex: '#06B6D4' },
        ];
    }

    /**
     * Update all custom badges for a seller (replaces existing badges)
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async updateSellerBadges(
        @Ctx() ctx: RequestContext,
        @Args() args: { sellerId: string; badges: Array<{ icon: string; text: string; color: string }> },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.sellerId);
        if (!profile) {
            throw new Error('Seller profile not found');
        }

        profile.customBadges = JSON.stringify(args.badges);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Add a single badge to a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async addSellerBadge(
        @Ctx() ctx: RequestContext,
        @Args() args: { sellerId: string; badge: { icon: string; text: string; color: string } },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.sellerId);
        if (!profile) {
            throw new Error('Seller profile not found');
        }

        const existingBadges = profile.customBadges ? JSON.parse(profile.customBadges) : [];
        existingBadges.push(args.badge);
        profile.customBadges = JSON.stringify(existingBadges);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Remove a badge from a seller by index
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async removeSellerBadge(
        @Ctx() ctx: RequestContext,
        @Args() args: { sellerId: string; badgeIndex: number },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.sellerId);
        if (!profile) {
            throw new Error('Seller profile not found');
        }

        const existingBadges = profile.customBadges ? JSON.parse(profile.customBadges) : [];
        if (args.badgeIndex >= 0 && args.badgeIndex < existingBadges.length) {
            existingBadges.splice(args.badgeIndex, 1);
        }
        profile.customBadges = JSON.stringify(existingBadges);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    // =========================================================================
    // Advanced Moderation Actions
    // =========================================================================

    /**
     * Hard suspend a seller - visible on public profile
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async hardSuspendSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; reason?: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.hardSuspended = true;
        profile.hardSuspendedReason = args.reason || undefined;
        profile.hardSuspendedAt = new Date();
        this.addModerationHistory(profile, 'hard_suspended', args.reason || null, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Remove hard suspension from a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async unHardSuspendSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.hardSuspended = false;
        profile.hardSuspendedReason = undefined;
        profile.hardSuspendedAt = undefined;
        this.addModerationHistory(profile, 'hard_suspension_removed', null, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Ban a seller - permanent with reason shown on public profile
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async banSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; reason: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.banned = true;
        profile.banReason = args.reason;
        profile.bannedAt = new Date();
        profile.bannedBy = ctx.activeUserId?.toString() || 'admin';
        profile.status = 'suspended'; // Also suspend the account
        this.addModerationHistory(profile, 'banned', args.reason, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Unban a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async unbanSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.banned = false;
        profile.banReason = undefined;
        profile.bannedAt = undefined;
        profile.bannedBy = undefined;
        this.addModerationHistory(profile, 'unbanned', null, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Issue a warning to a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async warnSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; message: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.warningCount = (profile.warningCount || 0) + 1;
        profile.lastWarning = args.message;
        profile.lastWarningAt = new Date();
        this.addModerationHistory(profile, 'warned', args.message, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Clear warning count for a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async clearWarnings(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.warningCount = 0;
        profile.lastWarning = undefined;
        profile.lastWarningAt = undefined;
        this.addModerationHistory(profile, 'warnings_cleared', null, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Update admin notes for a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async updateAdminNotes(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; notes: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.adminNotes = args.notes;
        profile.lastReviewedAt = new Date();
        profile.lastReviewedBy = ctx.activeUserId?.toString() || 'admin';
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Toggle featured status for a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async toggleFeatured(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.featured = !profile.featured;
        this.addModerationHistory(profile, profile.featured ? 'featured' : 'unfeatured', null, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Toggle trusted status for a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async toggleTrusted(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.trusted = !profile.trusted;
        this.addModerationHistory(profile, profile.trusted ? 'trusted' : 'untrusted', null, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Toggle priority support for a seller
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async togglePrioritySupport(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        const profile = await this.sellerProfileService.getById(ctx, args.id);
        if (!profile) {
            throw new Error('Seller profile not found');
        }
        profile.prioritySupport = !profile.prioritySupport;
        this.addModerationHistory(profile, profile.prioritySupport ? 'priority_support_granted' : 'priority_support_removed', null, ctx);
        return this.connection.getRepository(ctx, SellerProfile).save(profile);
    }

    /**
     * Helper to add moderation history entry
     */
    private addModerationHistory(
        profile: SellerProfile,
        action: string,
        reason: string | null,
        ctx: RequestContext,
    ): void {
        const history = profile.moderationHistory ? JSON.parse(profile.moderationHistory) : [];
        history.push({
            action,
            reason,
            by: ctx.activeUserId?.toString() || 'admin',
            at: new Date().toISOString(),
        });
        // Keep last 50 entries
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }
        profile.moderationHistory = JSON.stringify(history);
    }

    /**
     * Enable a seller account (unsuspend/reactivate).
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async enableSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        return this.sellerProfileService.enable(ctx, args.id);
    }

    /**
     * Disable a seller account (suspend).
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async disableSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SellerProfile> {
        return this.sellerProfileService.disable(ctx, args.id);
    }

    /**
     * Enable a customer account.
     * This unfreezes a disabled customer account.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async enableCustomer(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: string },
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const customer = await this.customerService.findOne(ctx, args.customerId, ['user']);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }
            if (!customer.user) {
                return { success: false, message: 'Customer has no associated user account' };
            }

            // Unset the deletedAt field to re-enable the user
            // In Vendure, soft-deleted users have a deletedAt timestamp
            await this.connection.rawConnection
                .createQueryBuilder()
                .update('user')
                .set({ deletedAt: null })
                .where('id = :id', { id: customer.user.id })
                .execute();

            return { success: true, message: 'Customer account enabled successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to enable customer' };
        }
    }

    /**
     * Disable a customer account.
     * This soft-deletes the user, preventing login.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async disableCustomer(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: string },
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const customer = await this.customerService.findOne(ctx, args.customerId, ['user']);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }
            if (!customer.user) {
                return { success: false, message: 'Customer has no associated user account' };
            }

            // Soft-delete the user by setting deletedAt
            await this.connection.rawConnection
                .createQueryBuilder()
                .update('user')
                .set({ deletedAt: new Date() })
                .where('id = :id', { id: customer.user.id })
                .execute();

            return { success: true, message: 'Customer account disabled successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to disable customer' };
        }
    }

    /**
     * Resend verification email to a customer.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async resendVerificationEmail(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: string },
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const customer = await this.customerService.findOne(ctx, args.customerId, ['user']);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }
            if (!customer.user) {
                return { success: false, message: 'Customer has no associated user account' };
            }

            // Check if already verified
            const authMethods = await this.connection.getRepository(ctx, NativeAuthenticationMethod).find({
                where: { user: { id: customer.user.id } },
            });

            if (authMethods.length === 0) {
                return { success: false, message: 'No native authentication method found' };
            }

            const authMethod = authMethods[0];
            if (!authMethod.verificationToken) {
                return { success: false, message: 'Email is already verified' };
            }

            // Generate a new verification token
            const newToken = this.generateToken();
            authMethod.verificationToken = newToken;
            await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(authMethod);

            // Emit AccountRegistrationEvent to trigger email sending
            // Note: This requires an email handler to be configured in Vendure
            await this.eventBus.publish(new AccountRegistrationEvent(ctx, customer.user));

            return { success: true, message: 'Verification email resent successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to resend verification email' };
        }
    }

    /**
     * Get current marketplace settings.
     */
    @Query()
    @Allow(Permission.SuperAdmin)
    async marketplaceSettings(): Promise<{
        autoVerifyEmail: boolean;
        autoVerifySeller: boolean;
        autoApprove: boolean;
        autoApproveTunerRequests: boolean;
    }> {
        const settings = MarketplacePlugin.getEffectiveSettings();
        return {
            autoVerifyEmail: settings.autoVerifyEmail,
            autoVerifySeller: settings.autoVerifySeller,
            autoApprove: settings.autoApprove,
            autoApproveTunerRequests: settings.autoApproveTunerRequests,
        };
    }

    /**
     * Update marketplace settings at runtime.
     * These settings override the plugin options without requiring a restart.
     */
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updateMarketplaceSettings(
        @Args() args: {
            autoVerifyEmail?: boolean;
            autoVerifySeller?: boolean;
            autoApprove?: boolean;
            autoApproveTunerRequests?: boolean;
        },
    ): Promise<{
        autoVerifyEmail: boolean;
        autoVerifySeller: boolean;
        autoApprove: boolean;
        autoApproveTunerRequests: boolean;
    }> {
        // Update runtime settings
        if (args.autoVerifyEmail !== undefined) {
            MarketplacePlugin.runtimeSettings.autoVerifyEmail = args.autoVerifyEmail;
        }
        if (args.autoVerifySeller !== undefined) {
            MarketplacePlugin.runtimeSettings.autoVerifySeller = args.autoVerifySeller;
        }
        if (args.autoApprove !== undefined) {
            MarketplacePlugin.runtimeSettings.autoApprove = args.autoApprove;
        }
        if (args.autoApproveTunerRequests !== undefined) {
            MarketplacePlugin.runtimeSettings.autoApproveTunerRequests = args.autoApproveTunerRequests;
        }

        // Return current effective settings
        const settings = MarketplacePlugin.getEffectiveSettings();
        return {
            autoVerifyEmail: settings.autoVerifyEmail,
            autoVerifySeller: settings.autoVerifySeller,
            autoApprove: settings.autoApprove,
            autoApproveTunerRequests: settings.autoApproveTunerRequests,
        };
    }

    /**
     * Helper to generate a random token
     */
    private generateToken(): string {
        return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    /**
     * Manually verify a customer's email address.
     * This is useful when email verification links don't work or for testing.
     * Only superadmins can use this mutation.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async verifyCustomerEmail(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: string },
    ): Promise<{ success: boolean; message?: string }> {
        try {
            // Get the customer with user relation
            const customer = await this.customerService.findOne(ctx, args.customerId, ['user']);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            // Get the user associated with this customer
            if (!customer.user) {
                return { success: false, message: 'Customer has no associated user account' };
            }

            // Find the native authentication method
            const nativeAuthMethod = customer.user.authenticationMethods?.find(
                (m): m is NativeAuthenticationMethod => m instanceof NativeAuthenticationMethod
            );

            if (!nativeAuthMethod) {
                // Try to find it directly from database
                const authMethods = await this.connection.getRepository(ctx, NativeAuthenticationMethod).find({
                    where: { user: { id: customer.user.id } },
                });

                if (authMethods.length === 0) {
                    return { success: false, message: 'No native authentication method found' };
                }

                const authMethod = authMethods[0];

                // Check if already verified
                if (!authMethod.verificationToken) {
                    return { success: false, message: 'Email is already verified' };
                }

                // Clear the verification token to mark as verified
                authMethod.verificationToken = null;
                await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(authMethod);

                // Also mark the user as verified
                customer.user.verified = true;
                await this.connection.rawConnection.getRepository(customer.user.constructor).save(customer.user);

                return { success: true, message: 'Customer email verified successfully' };
            }

            // Check if already verified
            if (!nativeAuthMethod.verificationToken) {
                return { success: false, message: 'Email is already verified' };
            }

            // Clear the verification token to mark as verified
            nativeAuthMethod.verificationToken = null;
            await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod);

            // Also mark the user as verified
            customer.user.verified = true;
            await this.connection.rawConnection.getRepository(customer.user.constructor).save(customer.user);

            return { success: true, message: 'Customer email verified successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Verification failed' };
        }
    }

    /**
     * Convert a regular customer to a seller.
     * This creates a SellerProfile for the customer without going through
     * the normal registration flow. Useful for dev/testing.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async convertCustomerToSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: {
            customerId: string;
            businessName?: string;
        },
    ): Promise<{ success: boolean; message?: string; sellerProfileId?: string }> {
        try {
            const customer = await this.customerService.findOne(ctx, args.customerId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            // Check if already a seller
            const existingProfile = await this.sellerProfileService.getByCustomerId(ctx, args.customerId);
            if (existingProfile) {
                return { success: false, message: 'Customer is already a seller', sellerProfileId: existingProfile.id.toString() };
            }

            // Generate slug
            const businessName = args.businessName || `${customer.firstName} ${customer.lastName}`;
            const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const suffix = Math.random().toString(36).substring(2, 8);
            const slug = `${baseSlug}-${suffix}`;

            // Get effective settings
            const settings = MarketplacePlugin.getEffectiveSettings();

            // Create seller profile
            const sellerProfile = new SellerProfile({
                customerId: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phoneNumber || '',
                businessName: businessName,
                status: settings.autoApprove ? 'approved' : 'pending',
                verified: settings.autoVerifySeller,
                slug,
                // No Vendure admin entities
                sellerId: null,
                channelId: null,
                administratorId: null,
                stockLocationId: null,
            });

            const saved = await this.connection.getRepository(ctx, SellerProfile).save(sellerProfile);

            // Update customer custom fields
            await this.customerService.update(ctx, {
                id: customer.id,
                customFields: {
                    isSeller: true,
                    sellerProfileId: saved.id.toString(),
                },
            });

            return {
                success: true,
                message: `Customer converted to seller successfully. Profile status: ${saved.status}`,
                sellerProfileId: saved.id.toString(),
            };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to convert customer to seller' };
        }
    }

    /**
     * Get list of all customers with pagination and search.
     * For the customer management admin page.
     */
    @Query()
    @Allow(Permission.SuperAdmin)
    async customersForManagement(
        @Ctx() ctx: RequestContext,
        @Args() args: {
            skip?: number;
            take?: number;
            searchTerm?: string;
            filterVerified?: boolean;
            filterSeller?: boolean;
        },
    ): Promise<{ items: any[]; totalItems: number }> {
        const take = args.take || 25;
        const skip = args.skip || 0;

        // Build filter
        const filter: any = {};
        if (args.searchTerm) {
            filter.emailAddress = { contains: args.searchTerm };
        }

        const result = await this.customerService.findAll(ctx, {
            skip,
            take,
            filter,
        }, ['user']);

        // Map customers with additional info
        const items = await Promise.all(result.items.map(async (customer) => {
            // Check if customer is a seller
            const sellerProfile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);

            return {
                id: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                emailAddress: customer.emailAddress,
                phoneNumber: customer.phoneNumber,
                createdAt: customer.createdAt,
                user: customer.user ? {
                    id: customer.user.id,
                    verified: customer.user.verified,
                    // Check if user is disabled (soft-deleted)
                    enabled: !customer.user.deletedAt,
                    lastLogin: customer.user.lastLogin,
                } : null,
                isSeller: !!sellerProfile,
                sellerProfileId: sellerProfile?.id?.toString(),
                sellerStatus: sellerProfile?.status,
                sellerVerified: sellerProfile?.verified,
            };
        }));

        // Apply post-query filters
        let filteredItems = items;
        if (args.filterVerified !== undefined) {
            filteredItems = filteredItems.filter(c => c.user?.verified === args.filterVerified);
        }
        if (args.filterSeller !== undefined) {
            filteredItems = filteredItems.filter(c => c.isSeller === args.filterSeller);
        }

        return {
            items: filteredItems,
            totalItems: result.totalItems,
        };
    }

    // =========================================================================
    // Seller's Own Profile Endpoints (for seller dashboard)
    // These don't require MarketplaceAdmin permission - just authentication
    // =========================================================================

    /**
     * Get the current seller's own profile.
     * This is accessible to any authenticated admin user.
     * Returns null if the admin is not associated with a seller profile.
     */
    @Query()
    @Allow(Permission.Authenticated)
    async mySellerProfile(
        @Ctx() ctx: RequestContext,
    ): Promise<SellerProfile | null> {
        if (!ctx.activeUserId) {
            return null;
        }

        // Find admin by user ID
        const admins = await this.administratorService.findAll(ctx, {
            filter: {
                // @ts-ignore - filter by user relation
            },
        });

        // Find the admin whose user ID matches
        const currentAdmin = admins.items.find(admin => admin.user?.id === ctx.activeUserId);
        if (!currentAdmin) {
            return null;
        }

        // Get seller profile by administrator ID
        return this.sellerProfileService.getByAdministratorId(ctx, currentAdmin.id);
    }

    /**
     * Update the current seller's own profile.
     * Sellers can only update their own profile through this endpoint.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async updateMySellerProfile(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: SellerProfileInput },
    ): Promise<SellerProfile> {
        if (!ctx.activeUserId) {
            throw new Error('Not authenticated');
        }

        // Find current admin
        const admins = await this.administratorService.findAll(ctx, {});
        const currentAdmin = admins.items.find(admin => admin.user?.id === ctx.activeUserId);
        if (!currentAdmin) {
            throw new Error('Administrator not found');
        }

        // Get seller profile by administrator ID
        const profile = await this.sellerProfileService.getByAdministratorId(ctx, currentAdmin.id);
        if (!profile) {
            throw new Error('Seller profile not found. You must be registered as a seller to update your profile.');
        }

        return this.sellerProfileService.update(ctx, profile.id, args.input);
    }

    // =========================================================================
    // Tuner Request Management Endpoints
    // =========================================================================

    /**
     * Get all tuner requests with filtering
     */
    @Query()
    @Allow(MarketplaceAdminPermission.Permission)
    async tunerRequests(
        @Ctx() ctx: RequestContext,
        @Args() args: { skip?: number; take?: number; status?: string },
    ): Promise<{ items: any[]; totalItems: number }> {
        const take = args.take || 25;
        const skip = args.skip || 0;

        const where: any = {};
        if (args.status) {
            where.status = args.status;
        }

        const [items, totalItems] = await this.connection.getRepository(ctx, TunerRequest).findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take,
        });

        // Enrich with customer email
        const enrichedItems = await Promise.all(items.map(async (item) => {
            const customer = await this.customerService.findOne(ctx, item.customerId as any);
            return {
                ...item,
                customerEmail: customer?.emailAddress,
            };
        }));

        return { items: enrichedItems, totalItems };
    }

    /**
     * Get a single tuner request by ID
     */
    @Query()
    @Allow(MarketplaceAdminPermission.Permission)
    async tunerRequest(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<any | null> {
        const request = await this.connection.getRepository(ctx, TunerRequest).findOne({
            where: { id: args.id as any },
        });

        if (!request) {
            return null;
        }

        const customer = await this.customerService.findOne(ctx, request.customerId as any);
        return {
            ...request,
            customerEmail: customer?.emailAddress,
        };
    }

    /**
     * Approve a tuner request and create seller profile
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async approveTunerRequest(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; adminNotes?: string },
    ): Promise<{ success: boolean; message?: string; request?: any; sellerProfileId?: string }> {
        try {
            const request = await this.connection.getRepository(ctx, TunerRequest).findOne({
                where: { id: args.id as any },
            });

            if (!request) {
                return { success: false, message: 'Tuner request not found' };
            }

            if (request.status !== 'pending') {
                return { success: false, message: `Cannot approve request with status: ${request.status}` };
            }

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
            request.adminNotes = args.adminNotes || request.adminNotes;
            request.reviewedAt = new Date();
            request.reviewedBy = ctx.activeUserId?.toString() || 'admin';
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

            return {
                success: true,
                message: 'Tuner request approved successfully',
                request,
                sellerProfileId: savedProfile.id.toString(),
            };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to approve tuner request' };
        }
    }

    /**
     * Reject a tuner request
     */
    @Transaction()
    @Mutation()
    @Allow(MarketplaceAdminPermission.Permission)
    async rejectTunerRequest(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; adminNotes?: string },
    ): Promise<{ success: boolean; message?: string; request?: any }> {
        try {
            const request = await this.connection.getRepository(ctx, TunerRequest).findOne({
                where: { id: args.id as any },
            });

            if (!request) {
                return { success: false, message: 'Tuner request not found' };
            }

            if (request.status !== 'pending') {
                return { success: false, message: `Cannot reject request with status: ${request.status}` };
            }

            // Update request
            request.status = 'rejected';
            request.adminNotes = args.adminNotes || request.adminNotes;
            request.reviewedAt = new Date();
            request.reviewedBy = ctx.activeUserId?.toString() || 'admin';
            await this.connection.getRepository(ctx, TunerRequest).save(request);

            // Clear pending request from customer
            await this.customerService.update(ctx, {
                id: request.customerId as any,
                customFields: {
                    pendingTunerRequestId: null,
                },
            });

            return {
                success: true,
                message: 'Tuner request rejected',
                request,
            };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to reject tuner request' };
        }
    }

    // =========================================================================
    // Admin Viewer Management Endpoints
    // =========================================================================

    /**
     * Get all customers with admin viewer access
     */
    @Query()
    @Allow(Permission.SuperAdmin)
    async adminViewers(
        @Ctx() ctx: RequestContext,
        @Args() args: { skip?: number; take?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        const take = args.take || 50;
        const skip = args.skip || 0;

        // Query ALL customers then filter by isAdminViewer custom field
        // We need to fetch more to ensure we find all admin viewers
        const result = await this.customerService.findAll(ctx, {
            skip: 0,
            take: 1000, // Fetch more to find all admin viewers
        });

        // Filter by isAdminViewer custom field
        const allAdminViewers = result.items.filter(c => (c as any).customFields?.isAdminViewer === true);

        // Apply pagination to filtered results
        const paginatedViewers = allAdminViewers.slice(skip, skip + take);

        return {
            items: paginatedViewers.map(c => ({
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                emailAddress: c.emailAddress,
                isAdminViewer: true,
                createdAt: c.createdAt,
            })),
            totalItems: allAdminViewers.length,
        };
    }

    /**
     * Search customers to grant admin viewer access
     * Searches by email, first name, or last name
     */
    @Query()
    @Allow(Permission.SuperAdmin)
    async searchCustomersForAdminViewer(
        @Ctx() ctx: RequestContext,
        @Args() args: { searchTerm: string },
    ): Promise<any[]> {
        const searchTerm = args.searchTerm.toLowerCase().trim();

        // Fetch more customers and filter in memory for flexible search
        // This handles email, first name, and last name matching
        const result = await this.customerService.findAll(ctx, {
            take: 100, // Fetch more to search through
        });

        const filtered = result.items.filter(c => {
            const email = (c.emailAddress || '').toLowerCase();
            const firstName = (c.firstName || '').toLowerCase();
            const lastName = (c.lastName || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`;

            return email.includes(searchTerm) ||
                   firstName.includes(searchTerm) ||
                   lastName.includes(searchTerm) ||
                   fullName.includes(searchTerm);
        }).slice(0, 20); // Return top 20 matches

        return filtered.map(c => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            emailAddress: c.emailAddress,
            isAdminViewer: (c as any).customFields?.isAdminViewer === true,
            createdAt: c.createdAt,
        }));
    }

    /**
     * Grant admin viewer access to a customer
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async grantAdminViewerAccess(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: string },
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const customer = await this.customerService.findOne(ctx, args.customerId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            await this.customerService.update(ctx, {
                id: args.customerId as any,
                customFields: {
                    isAdminViewer: true,
                },
            });

            return { success: true, message: 'Admin viewer access granted' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to grant access' };
        }
    }

    /**
     * Revoke admin viewer access from a customer
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async revokeAdminViewerAccess(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: string },
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const customer = await this.customerService.findOne(ctx, args.customerId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            await this.customerService.update(ctx, {
                id: args.customerId as any,
                customFields: {
                    isAdminViewer: false,
                },
            });

            return { success: true, message: 'Admin viewer access revoked' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to revoke access' };
        }
    }

    /**
     * Create a seller profile directly for seeding/testing purposes.
     * Returns the created SellerProfile with its ID that can be used for product association.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createSellerProfile(
        @Ctx() ctx: RequestContext,
        @Args() args: {
            input: {
                firstName: string;
                lastName: string;
                businessName?: string;
                bio?: string;
                location?: string;
                phone?: string;
                website?: string;
                instagram?: string;
                facebook?: string;
                youtube?: string;
                experience?: string;
                software?: string[];
                vehiclePlatforms?: string[];
                tuneTypes?: string[];
                hasDyno?: string;
                status?: string;
                verified?: boolean;
                slug?: string;
            };
        },
    ): Promise<SellerProfile> {
        const input = args.input;

        // Generate slug if not provided
        const businessName = input.businessName || `${input.firstName} ${input.lastName}`;
        const baseSlug = (input.slug || businessName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const suffix = Math.random().toString(36).substring(2, 8);
        const slug = input.slug ? input.slug : `${baseSlug}-${suffix}`;

        const sellerProfile = new SellerProfile({
            firstName: input.firstName,
            lastName: input.lastName,
            businessName: input.businessName,
            bio: input.bio,
            location: input.location,
            phone: input.phone,
            website: input.website,
            instagram: input.instagram,
            facebook: input.facebook,
            youtube: input.youtube,
            experience: input.experience,
            software: input.software,
            vehiclePlatforms: input.vehiclePlatforms,
            tuneTypes: input.tuneTypes,
            hasDyno: input.hasDyno,
            status: (input.status || 'approved') as 'pending' | 'approved' | 'suspended' | 'rejected',
            verified: input.verified ?? true,
            slug,
            rating: 4.5,
            reviewCount: 0,
            tunesSold: 0,
            totalOrders: 0,
            totalRevenue: 0,
        });

        const saved = await this.connection.getRepository(ctx, SellerProfile).save(sellerProfile);
        console.log(`[createSellerProfile] Created SellerProfile ID: ${saved.id}, slug: ${saved.slug}`);
        return saved;
    }

    /**
     * Fix products that are missing variants.
     * Products MUST have at least one variant to appear in search and be purchasable.
     * This mutation creates a default variant for products that don't have any.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async fixProductsWithoutVariants(
        @Ctx() ctx: RequestContext,
    ): Promise<{ success: boolean; message?: string; fixedCount: number; products: string[] }> {
        try {
            // Get all products
            const allProducts = await this.productService.findAll(ctx, {
                take: 1000, // Get up to 1000 products
            });

            const fixedProducts: string[] = [];
            let fixedCount = 0;

            for (const product of allProducts.items) {
                // Check if product has variants - returns PaginatedList
                const variantsResult = await this.productVariantService.getVariantsByProductId(ctx, product.id);
                const variantCount = variantsResult.items?.length || 0;

                if (variantCount === 0) {
                    // Create a default variant for this product
                    const productType = (product as any).customFields?.productType || 'tune';
                    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
                    const sku = `${productType.toUpperCase()}-${suffix}`;

                    // Get product name from translations
                    const productName = product.translations?.[0]?.name || 'Product';

                    await this.productVariantService.create(ctx, [{
                        productId: product.id,
                        sku,
                        price: 0, // Default price, can be updated later
                        translations: [{
                            languageCode: ctx.languageCode || LanguageCode.en,
                            name: productName,
                        }],
                        stockOnHand: productType === 'tune' ? 999999 : 100,
                        trackInventory: productType === 'tune' ? GlobalFlag.FALSE : GlobalFlag.TRUE,
                    }]);

                    fixedProducts.push(`${productName} (ID: ${product.id})`);
                    fixedCount++;
                }
            }

            if (fixedCount === 0) {
                return {
                    success: true,
                    message: 'All products already have variants',
                    fixedCount: 0,
                    products: [],
                };
            }

            return {
                success: true,
                message: `Created variants for ${fixedCount} products`,
                fixedCount,
                products: fixedProducts,
            };
        } catch (error: any) {
            console.error('Error fixing products without variants:', error);
            return {
                success: false,
                message: error.message || 'Failed to fix products',
                fixedCount: 0,
                products: [],
            };
        }
    }
}
