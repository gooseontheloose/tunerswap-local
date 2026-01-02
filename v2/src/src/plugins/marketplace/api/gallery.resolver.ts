import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Ctx,
    RequestContext,
    Allow,
    Permission,
    Transaction,
    TransactionalConnection,
    CustomerService,
    AssetService,
    ID,
} from '@vendure/core';
import { SellerProfileService } from '../services/seller-profile.service';
import { SellerGalleryImage } from '../entities/seller-gallery-image.entity';
import { In } from 'typeorm';

interface GalleryResult {
    success: boolean;
    message?: string;
    image?: SellerGalleryImage;
}

interface UploadGalleryImageInput {
    title?: string;
    description?: string;
    category?: string;
    isPublic?: boolean;
}

interface UpdateGalleryImageInput {
    title?: string;
    description?: string;
    category?: string;
    isPublic?: boolean;
    sortOrder?: number;
}

interface SellerGalleryImageList {
    items: SellerGalleryImage[];
    totalItems: number;
}

/**
 * Resolver for handling seller gallery image operations.
 * Allows sellers to upload, manage, and organize their gallery images.
 */
@Resolver()
export class GalleryResolver {
    constructor(
        private sellerProfileService: SellerProfileService,
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private assetService: AssetService,
    ) {}

    /**
     * Get the current seller's gallery images.
     * By default, returns all images including private ones.
     */
    @Query()
    @Allow(Permission.Authenticated)
    async myGalleryImages(
        @Ctx() ctx: RequestContext,
        @Args() args: { category?: string; includePrivate?: boolean },
    ): Promise<SellerGalleryImageList> {
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

        const queryBuilder = this.connection
            .getRepository(ctx, SellerGalleryImage)
            .createQueryBuilder('image')
            .where('image.sellerProfileId = :profileId', { profileId: profile.id });

        // Filter by category if specified
        if (args.category) {
            queryBuilder.andWhere('image.category = :category', { category: args.category });
        }

        // By default, include all images (private and public)
        // If includePrivate is explicitly false, only show public
        if (args.includePrivate === false) {
            queryBuilder.andWhere('image.isPublic = :isPublic', { isPublic: true });
        }

        queryBuilder.orderBy('image.sortOrder', 'ASC');
        queryBuilder.addOrderBy('image.createdAt', 'DESC');

        const [items, totalItems] = await queryBuilder.getManyAndCount();

        return { items, totalItems };
    }

    /**
     * Get public gallery images for a seller by seller profile ID.
     * Only returns images marked as public.
     */
    @Query()
    async sellerGalleryImages(
        @Ctx() ctx: RequestContext,
        @Args() args: { sellerId: ID },
    ): Promise<SellerGalleryImage[]> {
        const images = await this.connection
            .getRepository(ctx, SellerGalleryImage)
            .find({
                where: {
                    sellerProfileId: args.sellerId,
                    isPublic: true,
                },
                order: {
                    sortOrder: 'ASC',
                    createdAt: 'DESC',
                },
            });

        return images;
    }

    /**
     * Upload a gallery image for the current seller.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async uploadGalleryImage(
        @Ctx() ctx: RequestContext,
        @Args() args: { file: any; input?: UploadGalleryImageInput },
    ): Promise<GalleryResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, message: 'Not authenticated' };
            }

            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            // Create asset from uploaded file
            const asset = await this.assetService.create(ctx, {
                file: args.file,
                tags: ['gallery', 'seller', `seller-${profile.id}`],
            });

            if (!asset || 'message' in asset) {
                return { success: false, message: 'Failed to create asset' };
            }

            // Get the next sort order
            const maxSortOrder = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .createQueryBuilder('image')
                .select('MAX(image.sortOrder)', 'max')
                .where('image.sellerProfileId = :profileId', { profileId: profile.id })
                .getRawOne();

            const nextSortOrder = (maxSortOrder?.max ?? -1) + 1;

            // Construct full URLs for the asset
            // asset.source and asset.preview are relative paths, we need to prefix with asset server URL
            const assetBaseUrl = process.env.ASSET_SERVER_URL || `http://localhost:${process.env.PORT || 3000}/assets`;
            const fullSourceUrl = asset.source.startsWith('http')
                ? asset.source
                : `${assetBaseUrl}/${asset.source.replace(/\\/g, '/')}`;
            const fullPreviewUrl = asset.preview.startsWith('http')
                ? asset.preview
                : `${assetBaseUrl}/${asset.preview.replace(/\\/g, '/')}`;

            // Create the gallery image record
            const galleryImage = new SellerGalleryImage({
                sellerProfileId: profile.id,
                assetId: asset.id,
                url: fullSourceUrl,
                previewUrl: fullPreviewUrl,
                title: args.input?.title || '',
                description: args.input?.description || '',
                category: args.input?.category || '',
                isPublic: args.input?.isPublic ?? true,
                sortOrder: nextSortOrder,
                originalFilename: asset.name,
                mimeType: asset.mimeType,
                fileSize: asset.fileSize,
                width: asset.width,
                height: asset.height,
            });

            const savedImage = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .save(galleryImage);

            console.log(`[Gallery] Uploaded gallery image for seller ${profile.id}: ${asset.preview}`);

            return {
                success: true,
                message: 'Image uploaded successfully',
                image: savedImage,
            };
        } catch (error: any) {
            console.error('[Gallery] Error uploading gallery image:', error);
            return { success: false, message: error.message || 'Upload failed' };
        }
    }

    /**
     * Update a gallery image's metadata.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async updateGalleryImage(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID; input: UpdateGalleryImageInput },
    ): Promise<GalleryResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, message: 'Not authenticated' };
            }

            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            // Get the image and verify ownership
            const image = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .findOne({ where: { id: args.id } });

            if (!image) {
                return { success: false, message: 'Image not found' };
            }

            if (image.sellerProfileId !== profile.id) {
                return { success: false, message: 'Not authorized to update this image' };
            }

            // Update the image
            const updateData: Partial<SellerGalleryImage> = {};
            if (args.input.title !== undefined) updateData.title = args.input.title;
            if (args.input.description !== undefined) updateData.description = args.input.description;
            if (args.input.category !== undefined) updateData.category = args.input.category;
            if (args.input.isPublic !== undefined) updateData.isPublic = args.input.isPublic;
            if (args.input.sortOrder !== undefined) updateData.sortOrder = args.input.sortOrder;

            await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .update(args.id, updateData);

            const updatedImage = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .findOne({ where: { id: args.id } });

            return {
                success: true,
                message: 'Image updated successfully',
                image: updatedImage!,
            };
        } catch (error: any) {
            console.error('[Gallery] Error updating gallery image:', error);
            return { success: false, message: error.message || 'Update failed' };
        }
    }

    /**
     * Delete a gallery image.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async deleteGalleryImage(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<GalleryResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, message: 'Not authenticated' };
            }

            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            // Get the image and verify ownership
            const image = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .findOne({ where: { id: args.id } });

            if (!image) {
                return { success: false, message: 'Image not found' };
            }

            if (image.sellerProfileId !== profile.id) {
                return { success: false, message: 'Not authorized to delete this image' };
            }

            // Delete the gallery image record
            await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .delete(args.id);

            // Note: The underlying asset is NOT deleted as it may be used elsewhere
            // To fully clean up, we'd need to also delete the asset, but that's risky

            console.log(`[Gallery] Deleted gallery image ${args.id} for seller ${profile.id}`);

            return {
                success: true,
                message: 'Image deleted successfully',
            };
        } catch (error: any) {
            console.error('[Gallery] Error deleting gallery image:', error);
            return { success: false, message: error.message || 'Delete failed' };
        }
    }

    /**
     * Reorder gallery images by providing an array of image IDs in the desired order.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async reorderGalleryImages(
        @Ctx() ctx: RequestContext,
        @Args() args: { imageIds: ID[] },
    ): Promise<GalleryResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, message: 'Not authenticated' };
            }

            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            // Verify all images belong to this seller
            const images = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .find({
                    where: {
                        id: In(args.imageIds),
                        sellerProfileId: profile.id,
                    },
                });

            if (images.length !== args.imageIds.length) {
                return { success: false, message: 'Some images not found or not authorized' };
            }

            // Update sort order based on position in array
            for (let i = 0; i < args.imageIds.length; i++) {
                await this.connection
                    .getRepository(ctx, SellerGalleryImage)
                    .update(args.imageIds[i], { sortOrder: i });
            }

            return {
                success: true,
                message: 'Images reordered successfully',
            };
        } catch (error: any) {
            console.error('[Gallery] Error reordering gallery images:', error);
            return { success: false, message: error.message || 'Reorder failed' };
        }
    }

    /**
     * Toggle the visibility of a gallery image (public/private).
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async toggleGalleryImageVisibility(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<GalleryResult> {
        try {
            if (!ctx.activeUserId) {
                return { success: false, message: 'Not authenticated' };
            }

            const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const profile = await this.sellerProfileService.getByCustomerId(ctx, customer.id);
            if (!profile) {
                return { success: false, message: 'Seller profile not found' };
            }

            // Get the image and verify ownership
            const image = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .findOne({ where: { id: args.id } });

            if (!image) {
                return { success: false, message: 'Image not found' };
            }

            if (image.sellerProfileId !== profile.id) {
                return { success: false, message: 'Not authorized to update this image' };
            }

            // Toggle visibility
            const newVisibility = !image.isPublic;
            await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .update(args.id, { isPublic: newVisibility });

            const updatedImage = await this.connection
                .getRepository(ctx, SellerGalleryImage)
                .findOne({ where: { id: args.id } });

            console.log(`[Gallery] Toggled visibility for image ${args.id}: now ${newVisibility ? 'public' : 'private'}`);

            return {
                success: true,
                message: `Image is now ${newVisibility ? 'visible on your public profile' : 'hidden from your public profile'}`,
                image: updatedImage!,
            };
        } catch (error: any) {
            console.error('[Gallery] Error toggling gallery image visibility:', error);
            return { success: false, message: error.message || 'Toggle failed' };
        }
    }
}
