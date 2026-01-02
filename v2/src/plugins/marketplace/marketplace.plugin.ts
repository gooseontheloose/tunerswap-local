// TunerSwap Marketplace Plugin - See PLUGIN_STRUCTURE_GUIDE.md before modifying
import {
    PluginCommonModule,
    VendurePlugin,
    Type,
    LanguageCode,
    RequestContext,
    TransactionalConnection,
    ChannelService,
    CollectionService,
    Collection,
} from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellerGalleryImage } from './entities/seller-gallery-image.entity';
import { BuyerMessage } from './entities/buyer-message.entity';
import { BuyerConnection } from './entities/buyer-connection.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { TunerRequest } from './entities/tuner-request.entity';
import { SellerProfileService } from './services/seller-profile.service';
import { OrderSyncService } from './services/order-sync.service';
import { shopApiExtensions, adminApiExtensions } from './api/api-extensions';
import { SellerProfileShopResolver, SellerProfileFieldResolver } from './api/seller-profile-shop.resolver';
import { SellerProfileAdminResolver } from './api/seller-profile-admin.resolver';
import { AssetUploadResolver } from './api/asset-upload.resolver';
import { GalleryResolver } from './api/gallery.resolver';
import { MARKETPLACE_PLUGIN_OPTIONS, MarketplacePluginOptions } from './types';
import { MarketplaceAdminPermission } from './permissions';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [SellerProfile, SellerGalleryImage, BuyerMessage, BuyerConnection, CalendarEvent, TunerRequest],
    providers: [
        SellerProfileService,
        OrderSyncService,
        {
            provide: MARKETPLACE_PLUGIN_OPTIONS,
            useFactory: () => MarketplacePlugin.options,
        },
    ],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [SellerProfileShopResolver, SellerProfileFieldResolver, AssetUploadResolver, GalleryResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [SellerProfileAdminResolver, SellerProfileFieldResolver],
    },
    // Dashboard extension - points to the source file for Vite to compile
    dashboard: './ui/routes.tsx',
    configuration: config => {
        // Add custom fields to Customer for buyer-specific data
        config.customFields.Customer = [
            ...(config.customFields.Customer || []),
            {
                name: 'isSeller',
                type: 'boolean',
                defaultValue: false,
                label: [{ languageCode: LanguageCode.en, value: 'Is Seller' }],
                description: [{ languageCode: LanguageCode.en, value: 'Whether this customer is also a seller' }],
            },
            {
                name: 'sellerProfileId',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Seller Profile ID' }],
                description: [{ languageCode: LanguageCode.en, value: 'Reference to the seller profile if this customer is a seller' }],
            },
            {
                name: 'vehicles',
                type: 'text',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Vehicles (JSON)' }],
                description: [{ languageCode: LanguageCode.en, value: 'JSON array of vehicles in the buyer garage' }],
            },
            {
                name: 'location',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Location' }],
                description: [{ languageCode: LanguageCode.en, value: 'City, State location' }],
            },
            {
                name: 'savedSellers',
                type: 'text',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Saved Sellers (JSON)' }],
                description: [{ languageCode: LanguageCode.en, value: 'JSON array of saved/favorited seller IDs' }],
            },
            {
                name: 'notificationPrefs',
                type: 'text',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Notification Preferences (JSON)' }],
                description: [{ languageCode: LanguageCode.en, value: 'JSON object with notification settings' }],
            },
            {
                name: 'isAdminViewer',
                type: 'boolean',
                defaultValue: false,
                label: [{ languageCode: LanguageCode.en, value: 'Admin Viewer' }],
                description: [{ languageCode: LanguageCode.en, value: 'Can view other sellers/buyers panels (dev/admin access)' }],
            },
            {
                name: 'pendingTunerRequestId',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Pending Tuner Request ID' }],
                description: [{ languageCode: LanguageCode.en, value: 'Reference to pending tuner application if any' }],
            },
            {
                name: 'profileImageUrl',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Profile Image URL' }],
                description: [{ languageCode: LanguageCode.en, value: 'URL to the customer profile image' }],
            },
        ];

        // Add custom fields to Product for marketplace categorization
        config.customFields.Product = [
            ...(config.customFields.Product || []),
            {
                name: 'productType',
                type: 'string',
                defaultValue: 'tune',
                options: [
                    { value: 'tune' },
                    { value: 'part' },
                    { value: 'service' },
                    { value: 'invoice' },
                ],
                label: [{ languageCode: LanguageCode.en, value: 'Product Type' }],
                description: [{ languageCode: LanguageCode.en, value: 'Type of product: tune (digital), part (physical), service (in-person), or invoice (one-time payment link)' }],
                ui: { component: 'select-form-input' },
            },
            {
                name: 'isDigital',
                type: 'boolean',
                defaultValue: false,
                label: [{ languageCode: LanguageCode.en, value: 'Digital Product' }],
                description: [{ languageCode: LanguageCode.en, value: 'Whether this is a digital/downloadable product (no shipping required)' }],
            },
            {
                name: 'sellerId',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Seller ID' }],
                description: [{ languageCode: LanguageCode.en, value: 'The ID of the seller who created this product' }],
            },
            // Tune-specific custom fields
            {
                name: 'platform',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Vehicle Platform' }],
                description: [{ languageCode: LanguageCode.en, value: 'Vehicle platform this tune is for (e.g., GM, Ford, etc.)' }],
            },
            {
                name: 'software',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Tuning Software' }],
                description: [{ languageCode: LanguageCode.en, value: 'Software used for this tune (e.g., HP Tuners, EFI Live)' }],
            },
            {
                name: 'hpGain',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Expected HP Gain' }],
                description: [{ languageCode: LanguageCode.en, value: 'Expected horsepower gain from this tune' }],
            },
            {
                name: 'torqueGain',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Expected Torque Gain' }],
                description: [{ languageCode: LanguageCode.en, value: 'Expected torque gain from this tune' }],
            },
            {
                name: 'requiredMods',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Required Modifications' }],
                description: [{ languageCode: LanguageCode.en, value: 'Required vehicle modifications for this tune' }],
            },
            // Pricing options
            {
                name: 'contactForPricing',
                type: 'boolean',
                defaultValue: false,
                label: [{ languageCode: LanguageCode.en, value: 'Contact for Pricing' }],
                description: [{ languageCode: LanguageCode.en, value: 'Hide price and display "Contact for Pricing" instead' }],
            },
            // Service pricing options
            {
                name: 'pricingType',
                type: 'string',
                defaultValue: 'flat_rate',
                options: [
                    { value: 'flat_rate' },
                    { value: 'hourly' },
                    { value: 'hourly_with_setup' },
                ],
                label: [{ languageCode: LanguageCode.en, value: 'Pricing Type' }],
                description: [{ languageCode: LanguageCode.en, value: 'How this service is priced' }],
            },
            {
                name: 'hourlyRate',
                type: 'int',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Hourly Rate (cents)' }],
                description: [{ languageCode: LanguageCode.en, value: 'Hourly rate in cents for hourly services' }],
            },
            {
                name: 'setupFee',
                type: 'int',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Setup Fee (cents)' }],
                description: [{ languageCode: LanguageCode.en, value: 'One-time setup fee in cents' }],
            },
            {
                name: 'minimumHours',
                type: 'float',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Minimum Hours' }],
                description: [{ languageCode: LanguageCode.en, value: 'Minimum hours for hourly services' }],
            },
            {
                name: 'allowHourSelection',
                type: 'boolean',
                defaultValue: true,
                label: [{ languageCode: LanguageCode.en, value: 'Allow Hour Selection' }],
                description: [{ languageCode: LanguageCode.en, value: 'Allow customers to select hours at checkout' }],
            },
            {
                name: 'maxHours',
                type: 'int',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Maximum Hours' }],
                description: [{ languageCode: LanguageCode.en, value: 'Maximum hours customer can book at once' }],
            },
            // Invoice-specific custom fields
            {
                name: 'invoiceToken',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Invoice Token' }],
                description: [{ languageCode: LanguageCode.en, value: 'Unique token for one-time invoice payment link' }],
            },
            {
                name: 'recipientCustomerId',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Recipient Customer ID' }],
                description: [{ languageCode: LanguageCode.en, value: 'The customer ID this invoice is sent to' }],
            },
            {
                name: 'recipientEmail',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Recipient Email' }],
                description: [{ languageCode: LanguageCode.en, value: 'Email address of the invoice recipient' }],
            },
            {
                name: 'invoiceStatus',
                type: 'string',
                defaultValue: 'draft',
                options: [
                    { value: 'draft' },
                    { value: 'sent' },
                    { value: 'paid' },
                    { value: 'expired' },
                    { value: 'cancelled' },
                ],
                label: [{ languageCode: LanguageCode.en, value: 'Invoice Status' }],
                description: [{ languageCode: LanguageCode.en, value: 'Current status of the invoice' }],
            },
            {
                name: 'invoiceExpiresAt',
                type: 'datetime',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Invoice Expires At' }],
                description: [{ languageCode: LanguageCode.en, value: 'When this invoice link expires' }],
            },
            {
                name: 'invoicePaidAt',
                type: 'datetime',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Invoice Paid At' }],
                description: [{ languageCode: LanguageCode.en, value: 'When this invoice was paid' }],
            },
            {
                name: 'invoiceNotes',
                type: 'text',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Invoice Notes' }],
                description: [{ languageCode: LanguageCode.en, value: 'Additional notes visible to the customer on the invoice' }],
            },
            {
                name: 'invoiceLineItems',
                type: 'text',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Invoice Line Items' }],
                description: [{ languageCode: LanguageCode.en, value: 'JSON array of line items for itemized invoices' }],
            },
        ];

        // Add custom fields to ProductVariant for delivery/service specifics
        config.customFields.ProductVariant = [
            ...(config.customFields.ProductVariant || []),
            {
                name: 'downloadUrl',
                type: 'string',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Download URL' }],
                description: [{ languageCode: LanguageCode.en, value: 'URL for digital product download (for tunes)' }],
            },
            {
                name: 'serviceLocationRequired',
                type: 'boolean',
                defaultValue: false,
                label: [{ languageCode: LanguageCode.en, value: 'Requires Location' }],
                description: [{ languageCode: LanguageCode.en, value: 'Whether this service requires an in-person location' }],
            },
            {
                name: 'serviceDurationMinutes',
                type: 'int',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Service Duration (minutes)' }],
                description: [{ languageCode: LanguageCode.en, value: 'Estimated duration in minutes for service appointments' }],
            },
        ];

        // Register custom permission
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            MarketplaceAdminPermission,
        ];

        return config;
    },
    compatibility: '^3.0.0',
})
export class MarketplacePlugin {
    /**
     * Plugin options set at startup via `MarketplacePlugin.init()`.
     * These are the default values that can be overridden by runtime settings.
     */
    static options: MarketplacePluginOptions = {
        autoApprove: true,
        autoVerifyEmail: false,
        autoVerifySeller: false,
        autoApproveTunerRequests: false,
    };

    /**
     * Runtime settings that can be changed via `updateMarketplaceSettings` mutation.
     * These override plugin options and persist until server restart.
     *
     * @example
     * ```graphql
     * mutation {
     *     updateMarketplaceSettings(autoVerifyEmail: true) {
     *         autoVerifyEmail
     *     }
     * }
     * ```
     */
    static runtimeSettings: {
        autoVerifyEmail?: boolean;
        autoVerifySeller?: boolean;
        autoApprove?: boolean;
        autoApproveTunerRequests?: boolean;
    } = {};

    /**
     * Get the effective settings by merging plugin options with runtime overrides.
     * Runtime settings take precedence over plugin options.
     *
     * @returns The merged settings object
     *
     * @example
     * ```typescript
     * const settings = MarketplacePlugin.getEffectiveSettings();
     * if (settings.autoVerifyEmail) {
     *     // Skip email verification
     * }
     * ```
     */
    static getEffectiveSettings(): MarketplacePluginOptions {
        return {
            autoApprove: MarketplacePlugin.runtimeSettings.autoApprove ?? MarketplacePlugin.options.autoApprove,
            autoVerifyEmail: MarketplacePlugin.runtimeSettings.autoVerifyEmail ?? MarketplacePlugin.options.autoVerifyEmail,
            autoVerifySeller: MarketplacePlugin.runtimeSettings.autoVerifySeller ?? MarketplacePlugin.options.autoVerifySeller,
            autoApproveTunerRequests: MarketplacePlugin.runtimeSettings.autoApproveTunerRequests ?? MarketplacePlugin.options.autoApproveTunerRequests,
        };
    }

    constructor(private moduleRef: ModuleRef) {}

    /**
     * Initialize the plugin with custom options.
     *
     * @param options - Partial options to override defaults
     * @returns The configured MarketplacePlugin class
     *
     * @example
     * ```typescript
     * // Production config
     * MarketplacePlugin.init({
     *     autoApprove: false,
     *     autoVerifyEmail: false,
     * })
     *
     * // Development config
     * MarketplacePlugin.init({
     *     autoApprove: true,
     *     autoVerifyEmail: true,
     * })
     * ```
     */
    static init(options?: Partial<MarketplacePluginOptions>): Type<MarketplacePlugin> {
        MarketplacePlugin.options = {
            ...MarketplacePlugin.options,
            ...options,
        };
        return MarketplacePlugin;
    }

    /**
     * On application bootstrap, ensure the 3 global collections exist:
     * - Tunes (for digital tune files)
     * - Parts (for physical automotive parts)
     * - Services (for in-person tuning services)
     */
    async onApplicationBootstrap(): Promise<void> {
        const connection = this.moduleRef.get(TransactionalConnection, { strict: false });
        const channelService = this.moduleRef.get(ChannelService, { strict: false });
        const collectionService = this.moduleRef.get(CollectionService, { strict: false });

        // Get the default channel for global collections
        const defaultChannel = await channelService.getDefaultChannel();

        // Create a proper RequestContext for the default channel
        const ctx = new RequestContext({
            apiType: 'admin',
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            channel: defaultChannel,
        });

        // Define the 3 global collections with their product type filters
        const globalCollections = [
            {
                name: 'Tunes',
                slug: 'tunes',
                description: 'Digital tune files for ECU tuning',
                productTypeFilter: 'tune',
            },
            {
                name: 'Parts',
                slug: 'parts',
                description: 'Physical automotive parts and accessories',
                productTypeFilter: 'part',
            },
            {
                name: 'Services',
                slug: 'services',
                description: 'In-person tuning and automotive services',
                productTypeFilter: 'service',
            },
        ];

        for (const collectionDef of globalCollections) {
            // Check if collection already exists by querying translations
            const existing = await connection
                .rawConnection
                .getRepository(Collection)
                .createQueryBuilder('collection')
                .leftJoinAndSelect('collection.translations', 'translation')
                .where('translation.slug = :slug', { slug: collectionDef.slug })
                .getOne();

            if (!existing) {
                try {
                    // Create the collection with a filter based on productType custom field
                    await collectionService.create(ctx, {
                        translations: [
                            {
                                languageCode: LanguageCode.en,
                                name: collectionDef.name,
                                slug: collectionDef.slug,
                                description: collectionDef.description,
                            },
                        ],
                        filters: [
                            {
                                code: 'product-type-filter',
                                arguments: [
                                    { name: 'productType', value: collectionDef.productTypeFilter },
                                ],
                            },
                        ],
                        isPrivate: false,
                    });
                    console.log(`Created global collection: ${collectionDef.name}`);
                } catch (error) {
                    // Collection filter might not exist yet, create without filter
                    // The filter can be added manually in the admin UI
                    console.log(`Note: Could not create collection filter for ${collectionDef.name}. You may need to set up the filter manually.`);
                }
            }
        }
    }
}

// Re-export for convenience
export { MarketplaceAdminPermission } from './permissions';
