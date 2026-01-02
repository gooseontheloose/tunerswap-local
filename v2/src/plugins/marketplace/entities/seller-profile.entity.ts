import { DeepPartial, VendureEntity, Customer, ID } from '@vendure/core';
import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';

/**
 * SellerProfile entity - stores tuner/seller-specific information in Vendure DB.
 *
 * NOTE: As of the Vendor API migration, this entity is used for backward compatibility
 * and public seller listings only. The authoritative seller data is in MarketplaceDB.
 *
 * Architecture:
 * - Vendor API (port 3001) -> MarketplaceDB -> `sellers` table (auth & dashboard)
 * - Vendure Shop API -> Vendure DB -> SellerProfile (public listings, legacy)
 *
 * For new sellers:
 * - Register via Vendor API `registerSeller` mutation
 * - Login via Vendor API `loginSeller` mutation
 * - Dashboard data from Vendor API (myProducts, myOrders, etc.)
 *
 * The Vendure admin integration fields (sellerId, channelId, administratorId, stockLocationId)
 * are DEPRECATED and will be null for new sellers.
 */
@Entity()
export class SellerProfile extends VendureEntity {
    constructor(input?: DeepPartial<SellerProfile>) {
        super(input);
    }

    @Column({ type: 'varchar', nullable: true })
    customerId: ID;

    @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
    @JoinColumn()
    customer: Customer;

    // === Personal Information ===
    @Column({ default: '' })
    firstName: string;

    @Column({ default: '' })
    lastName: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ nullable: true })
    location: string;

    @Column({ nullable: true })
    address: string;

    // === Business Information ===
    @Column({ nullable: true })
    businessName: string;

    @Column({ nullable: true })
    website: string;

    @Column({ nullable: true })
    instagram: string;

    @Column({ nullable: true })
    facebook: string;

    @Column({ nullable: true })
    youtube: string;

    @Column({ type: 'text', nullable: true })
    bio: string;

    // === Tuning Information ===
    @Column({ nullable: true })
    experience: string;

    @Column({ type: 'simple-array', nullable: true })
    software: string[];

    @Column({ type: 'simple-array', nullable: true })
    vehiclePlatforms: string[];

    @Column({ type: 'simple-array', nullable: true })
    tuneTypes: string[];

    @Column({ nullable: true })
    hasDyno: string;

    // === Business Hours (stored as JSON string) ===
    @Column({ type: 'text', nullable: true })
    hours: string;

    // === Status & Verification ===
    @Column({ default: 'pending' })
    status: 'pending' | 'approved' | 'suspended' | 'rejected';

    @Column({ default: false })
    verified: boolean;

    /**
     * Whether the seller has completed their business profile.
     * Set to true after first-login modal is filled out with required fields.
     */
    @Column({ default: false })
    profileComplete: boolean;

    // === Profile Images ===
    @Column({ nullable: true })
    profileImageUrl: string;

    @Column({ nullable: true })
    bannerImageUrl: string;

    // === Statistics (cached for performance) ===
    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    rating: number;

    @Column({ default: 0 })
    reviewCount: number;

    @Column({ default: 0 })
    tunesSold: number;

    @Column({ default: 0 })
    totalOrders: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    totalRevenue: number;

    // === Payment Integration ===
    @Column({ default: false })
    stripeConnected: boolean;

    @Column({ nullable: true })
    stripeAccountId: string;

    @Column({ default: false })
    paypalConnected: boolean;

    @Column({ nullable: true })
    paypalEmail: string;

    // === Public Profile Slug ===
    @Column({ unique: true, nullable: true })
    slug: string;

    // === Custom Badges (JSON array) ===
    // Format: [{ icon: 'star', text: 'Top Performer', color: 'gold' }, ...]
    // Preset icons: star, trophy, fire, bolt, shield, heart, crown, diamond, rocket, wrench
    @Column({ type: 'text', nullable: true })
    customBadges: string;

    // === Moderation Fields ===
    /**
     * Hard suspended - shows suspension notice on public profile.
     * Different from regular suspend which just logs them out.
     */
    @Column({ default: false })
    hardSuspended: boolean;

    @Column({ nullable: true })
    hardSuspendedReason?: string;

    @Column({ type: 'datetime', nullable: true })
    hardSuspendedAt?: Date;

    /**
     * Banned - permanent ban with reason shown on public profile.
     */
    @Column({ default: false })
    banned: boolean;

    @Column({ nullable: true })
    banReason?: string;

    @Column({ type: 'datetime', nullable: true })
    bannedAt?: Date;

    @Column({ nullable: true })
    bannedBy?: string;

    /**
     * Admin notes - internal notes about this seller (not shown to seller)
     */
    @Column({ type: 'text', nullable: true })
    adminNotes?: string;

    /**
     * Warning/strike count for policy violations
     */
    @Column({ default: 0 })
    warningCount: number;

    /**
     * Last warning message sent to seller
     */
    @Column({ type: 'text', nullable: true })
    lastWarning?: string;

    @Column({ type: 'datetime', nullable: true })
    lastWarningAt?: Date;

    /**
     * Moderation history (JSON array of actions)
     * Format: [{ action: 'warned', reason: '...', by: 'admin', at: '...' }, ...]
     */
    @Column({ type: 'text', nullable: true })
    moderationHistory?: string;

    /**
     * Featured seller - shown prominently on homepage/search
     */
    @Column({ default: false })
    featured: boolean;

    /**
     * Priority support - gets faster response times
     */
    @Column({ default: false })
    prioritySupport: boolean;

    /**
     * Trusted seller - bypasses some moderation checks
     */
    @Column({ default: false })
    trusted: boolean;

    /**
     * Last reviewed by admin
     */
    @Column({ type: 'datetime', nullable: true })
    lastReviewedAt?: Date;

    @Column({ nullable: true })
    lastReviewedBy?: string;

    // === DEPRECATED: Vendure Multivendor Integration ===
    // These fields are NO LONGER USED for new sellers.
    // Sellers now authenticate via the Vendor API (MarketplaceDB).
    // Kept for backward compatibility with existing sellers only.

    /**
     * @deprecated Sellers no longer get Vendure Seller entities.
     * New sellers will have this field as null.
     */
    @Column({ type: 'varchar', nullable: true })
    sellerId: ID;

    /**
     * @deprecated Sellers no longer get dedicated Vendure Channels.
     * New sellers will have this field as null.
     */
    @Column({ type: 'varchar', nullable: true })
    channelId: ID;

    /**
     * @deprecated Sellers no longer get Vendure Administrator accounts.
     * Authentication is now handled by Vendor API with MarketplaceDB.
     * New sellers will have this field as null.
     */
    @Column({ type: 'varchar', nullable: true })
    administratorId: ID;

    /**
     * @deprecated Sellers no longer get dedicated StockLocations.
     * New sellers will have this field as null.
     */
    @Column({ type: 'varchar', nullable: true })
    stockLocationId: ID;
}
