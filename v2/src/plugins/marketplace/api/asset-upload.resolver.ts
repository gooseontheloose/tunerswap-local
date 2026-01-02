import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    Ctx,
    RequestContext,
    Allow,
    Permission,
    Transaction,
    TransactionalConnection,
    CustomerService,
    AssetService,
} from '@vendure/core';
import { SellerProfileService } from '../services/seller-profile.service';
import { SellerProfile } from '../entities/seller-profile.entity';

interface UploadResult {
    success: boolean;
    url?: string;
    assetId?: string;
    error?: string;
}

/**
 * Resolver for handling profile image uploads.
 * Uses Vendure's built-in AssetService to manage uploaded files.
 */
@Resolver()
export class AssetUploadResolver {
    constructor(
        private sellerProfileService: SellerProfileService,
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private assetService: AssetService,
    ) {}

    /**
     * Upload a profile image for the current seller.
     * The image is stored via Vendure's asset server and the URL is saved to the seller profile.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async uploadSellerProfileImage(
        @Ctx() ctx: RequestContext,
        @Args() args: { file: any },
    ): Promise<UploadResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Get the seller profile
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, error: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, error: 'Seller profile not found' };
            }

            // Create asset from uploaded file
            const asset = await this.assetService.create(ctx, {
                file: args.file,
                tags: ['profile-image', 'seller'],
            });

            if (!asset || 'message' in asset) {
                return { success: false, error: 'Failed to create asset' };
            }

            // Construct full URL for the asset
            const assetBaseUrl = process.env.ASSET_SERVER_URL || `http://localhost:${process.env.PORT || 3000}/assets`;
            const fullPreviewUrl = asset.preview.startsWith('http')
                ? asset.preview
                : `${assetBaseUrl}/${asset.preview.replace(/\\/g, '/')}`;

            // Update the seller profile with the new image URL
            await this.connection.getRepository(ctx, SellerProfile).update(profile.id, {
                profileImageUrl: fullPreviewUrl,
            });

            console.log(`[AssetUpload] Uploaded seller profile image for ${profile.id}: ${fullPreviewUrl}`);

            return {
                success: true,
                url: fullPreviewUrl,
                assetId: asset.id.toString(),
            };
        } catch (error: any) {
            console.error('[AssetUpload] Error uploading seller profile image:', error);
            return { success: false, error: error.message || 'Upload failed' };
        }
    }

    /**
     * Upload a banner image for the current seller.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async uploadSellerBannerImage(
        @Ctx() ctx: RequestContext,
        @Args() args: { file: any },
    ): Promise<UploadResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Get the seller profile
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, error: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, error: 'Seller profile not found' };
            }

            // Create asset from uploaded file
            const asset = await this.assetService.create(ctx, {
                file: args.file,
                tags: ['banner-image', 'seller'],
            });

            if (!asset || 'message' in asset) {
                return { success: false, error: 'Failed to create asset' };
            }

            // Construct full URL for the asset
            const assetBaseUrl = process.env.ASSET_SERVER_URL || `http://localhost:${process.env.PORT || 3000}/assets`;
            const fullPreviewUrl = asset.preview.startsWith('http')
                ? asset.preview
                : `${assetBaseUrl}/${asset.preview.replace(/\\/g, '/')}`;

            // Update the seller profile with the new banner URL
            await this.connection.getRepository(ctx, SellerProfile).update(profile.id, {
                bannerImageUrl: fullPreviewUrl,
            });

            console.log(`[AssetUpload] Uploaded seller banner image for ${profile.id}: ${fullPreviewUrl}`);

            return {
                success: true,
                url: fullPreviewUrl,
                assetId: asset.id.toString(),
            };
        } catch (error: any) {
            console.error('[AssetUpload] Error uploading seller banner image:', error);
            return { success: false, error: error.message || 'Upload failed' };
        }
    }

    /**
     * Upload a profile image for the current buyer (customer).
     * Stores the image URL in customer custom fields.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async uploadBuyerProfileImage(
        @Ctx() ctx: RequestContext,
        @Args() args: { file: any },
    ): Promise<UploadResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Get the customer
            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, error: 'Customer not found' };
            }

            // Create asset from uploaded file
            const asset = await this.assetService.create(ctx, {
                file: args.file,
                tags: ['profile-image', 'buyer'],
            });

            if (!asset || 'message' in asset) {
                return { success: false, error: 'Failed to create asset' };
            }

            // Construct full URL for the asset
            const assetBaseUrl = process.env.ASSET_SERVER_URL || `http://localhost:${process.env.PORT || 3000}/assets`;
            const fullPreviewUrl = asset.preview.startsWith('http')
                ? asset.preview
                : `${assetBaseUrl}/${asset.preview.replace(/\\/g, '/')}`;

            // Update customer with the new profile image URL using custom fields
            await this.customerService.update(ctx, {
                id: customer.id,
                customFields: {
                    profileImageUrl: fullPreviewUrl,
                },
            });

            console.log(`[AssetUpload] Uploaded buyer profile image for customer ${customer.id}: ${fullPreviewUrl}`);

            return {
                success: true,
                url: fullPreviewUrl,
                assetId: asset.id.toString(),
            };
        } catch (error: any) {
            console.error('[AssetUpload] Error uploading buyer profile image:', error);
            return { success: false, error: error.message || 'Upload failed' };
        }
    }
}
