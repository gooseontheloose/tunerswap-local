/**
 * TunerSwap MarketplacePlugin Types
 *
 * This file contains all TypeScript interfaces and types used by the MarketplacePlugin.
 *
 * @see README.md for full documentation
 */

/** Injection token for plugin options */
export const MARKETPLACE_PLUGIN_OPTIONS = 'MARKETPLACE_PLUGIN_OPTIONS';

/**
 * Configuration options for the MarketplacePlugin.
 *
 * These options are set at plugin initialization via `MarketplacePlugin.init()`.
 * They can be overridden at runtime using the `updateMarketplaceSettings` mutation.
 *
 * @example
 * ```typescript
 * // Development config - bypass all verification
 * MarketplacePlugin.init({
 *     autoApprove: true,
 *     autoVerifyEmail: true,
 *     autoVerifySeller: false,
 * })
 *
 * // Production config - manual approval required
 * MarketplacePlugin.init({
 *     autoApprove: false,
 *     autoVerifyEmail: false,
 *     autoVerifySeller: false,
 * })
 * ```
 */
export interface MarketplacePluginOptions {
    /**
     * If true, sellers are automatically approved upon registration.
     * If false, an admin must manually approve them via the `approveSeller` mutation.
     *
     * @default true
     *
     * @example
     * ```graphql
     * # Manual approval when autoApprove is false
     * mutation {
     *     approveSeller(id: "1") {
     *         id
     *         status
     *     }
     * }
     * ```
     */
    autoApprove: boolean;

    /**
     * If true, all new users (customers/sellers) bypass email verification.
     *
     * Use cases:
     * - Development environment where email isn't configured
     * - Emergency mode when email service is down
     * - Testing scenarios
     *
     * When enabled, new users are immediately marked as verified without
     * needing to click an email verification link.
     *
     * @default false
     *
     * @example
     * ```graphql
     * # Enable at runtime when email is down
     * mutation {
     *     updateMarketplaceSettings(autoVerifyEmail: true) {
     *         autoVerifyEmail
     *     }
     * }
     * ```
     */
    autoVerifyEmail: boolean;

    /**
     * If true, new sellers automatically receive the "verified" trust badge.
     *
     * This is different from email verification - this is the seller trust badge
     * that appears on their public profile indicating they are a trusted seller.
     *
     * Normally, the verified badge is granted manually by admins after reviewing
     * a seller's credentials, reputation, or completing a verification process.
     *
     * @default false
     *
     * @example
     * ```graphql
     * # Manual verification (normal flow)
     * mutation {
     *     verifySeller(id: "1") {
     *         id
     *         verified
     *     }
     * }
     *
     * # Or enable auto-verify for all new sellers
     * mutation {
     *     updateMarketplaceSettings(autoVerifySeller: true) {
     *         autoVerifySeller
     *     }
     * }
     * ```
     */
    autoVerifySeller: boolean;

    /**
     * If true, tuner requests are automatically approved and seller profiles created.
     * If false, an admin must manually review and approve each tuner request.
     *
     * @default false
     *
     * @example
     * ```graphql
     * # Enable auto-approval of tuner requests
     * mutation {
     *     updateMarketplaceSettings(autoApproveTunerRequests: true) {
     *         autoApproveTunerRequests
     *     }
     * }
     * ```
     */
    autoApproveTunerRequests: boolean;
}

/**
 * Runtime settings interface.
 *
 * These settings can be changed via the `updateMarketplaceSettings` mutation
 * and override the plugin options without requiring a server restart.
 *
 * Note: Runtime settings are stored in memory only and reset when the server restarts.
 * For persistent changes, update the plugin options in vendure-config.ts.
 */
export interface MarketplaceRuntimeSettings {
    autoVerifyEmail: boolean;
    autoVerifySeller: boolean;
    autoApprove: boolean;
    autoApproveTunerRequests: boolean;
}

/**
 * Input for registering a new seller via the Shop API.
 *
 * This creates:
 * 1. A Vendure Seller entity
 * 2. A dedicated Channel for the seller
 * 3. A Role with seller permissions
 * 4. An Administrator account for dashboard access
 * 5. A Customer account (for buyer activities)
 * 6. A SellerProfile with tuning-specific info
 *
 * @example
 * ```graphql
 * mutation {
 *     registerSeller(input: {
 *         email: "tuner@example.com"
 *         password: "securepassword"
 *         firstName: "John"
 *         lastName: "Doe"
 *         businessName: "John's Performance"
 *         location: "Austin, TX"
 *         bio: "10+ years tuning GM trucks"
 *         experience: "10+"
 *         software: ["HP Tuners", "EFI Live"]
 *         vehiclePlatforms: ["GM", "Ford"]
 *         tuneTypes: ["Performance", "Tow/Haul"]
 *         hasDyno: "yes"
 *     }) {
 *         success
 *         sellerId
 *         channelToken
 *     }
 * }
 * ```
 */
export interface RegisterSellerInput {
    // Account info (required)
    /** Seller's email address - used for login and notifications */
    email: string;
    /** Password for the seller's account */
    password: string;

    // Personal info (required)
    /** Seller's first name */
    firstName: string;
    /** Seller's last name */
    lastName: string;
    /** Seller's phone number */
    phone?: string;
    /** Seller's location (e.g., "Austin, TX") */
    location?: string;

    // Business info (optional)
    /** Business name displayed on the seller's profile */
    businessName?: string;
    /** Business website URL */
    website?: string;
    /** Primary social media handle/URL */
    socialMedia?: string;
    /** Seller's bio/description */
    bio?: string;

    // Tuning info (optional)
    /** Years of tuning experience (e.g., "10+", "5-10", "1-3") */
    experience?: string;
    /** Tuning software platforms used (e.g., ["HP Tuners", "EFI Live"]) */
    software?: string[];
    /** Vehicle platforms supported (e.g., ["GM", "Ford", "Dodge"]) */
    vehiclePlatforms?: string[];
    /** Types of tunes offered (e.g., ["Performance", "Tow/Haul", "Economy"]) */
    tuneTypes?: string[];
    /** Whether the seller has a dyno (e.g., "yes", "no", "mobile") */
    hasDyno?: string;
    /** Desired URL slug for the seller profile (will be validated and normalized) */
    desiredSlug?: string;
}

/**
 * Input for updating a seller's profile.
 *
 * Used by both the seller (via `updateMySellerProfile`) and
 * admins (via direct database updates).
 *
 * @example
 * ```graphql
 * mutation {
 *     updateMySellerProfile(input: {
 *         bio: "Updated bio with more experience"
 *         software: ["HP Tuners", "EFI Live", "SCT"]
 *     }) {
 *         id
 *         bio
 *         software
 *     }
 * }
 * ```
 */
export interface SellerProfileInput {
    // Personal
    firstName?: string;
    lastName?: string;
    phone?: string;
    location?: string;
    address?: string;

    // Business
    businessName?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    bio?: string;

    // Tuning
    experience?: string;
    software?: string[];
    vehiclePlatforms?: string[];
    tuneTypes?: string[];
    hasDyno?: string;

    /**
     * Business hours as a JSON string.
     *
     * @example
     * ```json
     * {
     *     "monday": { "open": "09:00", "close": "17:00" },
     *     "tuesday": { "open": "09:00", "close": "17:00" },
     *     "saturday": { "closed": true }
     * }
     * ```
     */
    hours?: string;

    /**
     * Whether the seller has completed their business profile.
     * Set to true after the first-login modal is filled out with required fields.
     */
    profileComplete?: boolean;
}

/**
 * Possible seller statuses.
 *
 * - `pending` - Awaiting admin approval
 * - `approved` - Active and can sell
 * - `suspended` - Temporarily disabled by admin
 * - `rejected` - Registration was rejected
 *
 * @example
 * ```graphql
 * # List pending sellers
 * query {
 *     sellerProfiles(status: "pending") {
 *         items { id businessName }
 *         totalItems
 *     }
 * }
 *
 * # Approve a seller
 * mutation {
 *     approveSeller(id: "1") { status }
 * }
 *
 * # Suspend a seller
 * mutation {
 *     suspendSeller(id: "1") { status }
 * }
 * ```
 */
export type SellerStatus = 'pending' | 'approved' | 'suspended' | 'rejected';
