import { DeepPartial, VendureEntity, ID } from '@vendure/core';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SellerProfile } from './seller-profile.entity';

/**
 * SellerGalleryImage entity - stores gallery images for seller profiles.
 *
 * Features:
 * - Each seller can have multiple gallery images
 * - Images can be toggled for public display on seller profile
 * - Images can also be used for product listings
 * - Supports custom titles, descriptions, and categories
 * - Sortable via sortOrder field
 */
@Entity()
export class SellerGalleryImage extends VendureEntity {
    constructor(input?: DeepPartial<SellerGalleryImage>) {
        super(input);
    }

    @Index()
    @Column({ type: 'varchar' })
    sellerProfileId: ID;

    @ManyToOne(() => SellerProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sellerProfileId' })
    sellerProfile: SellerProfile;

    /**
     * The Vendure asset ID associated with this gallery image.
     * Used to reference the original asset for full-size retrieval.
     */
    @Column({ type: 'varchar', nullable: true })
    assetId: ID;

    /**
     * The public URL for the image.
     * Stored separately for quick access without joining to Asset table.
     */
    @Column()
    url: string;

    /**
     * Preview/thumbnail URL for the image.
     */
    @Column({ nullable: true })
    previewUrl: string;

    /**
     * User-provided title for the image.
     */
    @Column({ nullable: true })
    title: string;

    /**
     * User-provided description/caption for the image.
     */
    @Column({ type: 'text', nullable: true })
    description: string;

    /**
     * Category for organizing gallery images.
     * e.g., 'Builds', 'Dyno', 'Shop', 'Customer Cars', etc.
     */
    @Column({ nullable: true })
    category: string;

    /**
     * Whether this image is displayed on the public seller profile.
     * Sellers can toggle this on/off from their dashboard.
     */
    @Column({ default: true })
    isPublic: boolean;

    /**
     * Sort order for displaying images in the gallery.
     * Lower numbers appear first.
     */
    @Column({ default: 0 })
    sortOrder: number;

    /**
     * Original filename of the uploaded image.
     */
    @Column({ nullable: true })
    originalFilename: string;

    /**
     * MIME type of the image.
     */
    @Column({ nullable: true })
    mimeType: string;

    /**
     * File size in bytes.
     */
    @Column({ type: 'int', nullable: true })
    fileSize: number;

    /**
     * Width in pixels.
     */
    @Column({ type: 'int', nullable: true })
    width: number;

    /**
     * Height in pixels.
     */
    @Column({ type: 'int', nullable: true })
    height: number;
}
