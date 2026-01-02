import {
    dummyPaymentHandler,
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    VendureConfig,
    defaultCollectionFilters,
    TypeORMHealthCheckStrategy,
    HttpHealthCheckStrategy,
} from '@vendure/core';
import { productTypeCollectionFilter } from './plugins/marketplace/filters/product-type-collection-filter';
import { EmailPlugin, FileBasedTemplateLoader, defaultEmailHandlers } from '@vendure/email-plugin';
import { dynamicEmailHandlers } from './email/dynamic-email-handlers';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import { MarketplacePlugin } from './plugins/marketplace';
import { VisitorAnalyticsPlugin } from './plugins/visitor-analytics';
import { MyGaragePlugin } from './plugins/my-garage';
import {
    TunerSwapOrderSellerStrategy,
    TunerSwapShippingLineAssignmentStrategy,
    tunerSwapShippingEligibilityChecker,
} from './plugins/marketplace/strategies';
import 'dotenv/config';
import path from 'path';

const IS_DEV = process.env.APP_ENV === 'dev';
const serverPort = +process.env.PORT || 3000;

// Email template path
const emailTemplatePath = path.join(__dirname, '../static/email/templates');

// Log configuration on startup
console.log(`[Vendure Config] IS_DEV: ${IS_DEV}`);
console.log(`[Vendure Config] Email template path: ${emailTemplatePath}`);

export const config: VendureConfig = {
    apiOptions: {
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_DEV ? false : 1,
        // CORS configuration for frontend
        cors: {
            origin: IS_DEV
                ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                    // In dev, allow any localhost origin (handles dynamic ports)
                    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                        callback(null, true);
                    } else {
                        callback(new Error('Not allowed by CORS'));
                    }
                }
                : ['https://tuner-swap.com', 'https://www.tuner-swap.com'],
            credentials: true,
        },
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV ? {
            adminApiDebug: true,
            shopApiDebug: true,
        } : {}),
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
          secret: process.env.COOKIE_SECRET,
        },
        // In dev mode, don't require email verification so test accounts work immediately
        requireVerification: !true,
    },
    dbConnectionOptions: {
        type: 'better-sqlite3',
        // See the README.md "Migrations" section for an explanation of
        // the `synchronize` and `migrations` options.
        // Set to true to auto-create new tables for marketplace plugin
        synchronize: true,
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: false,
        database: path.join(__dirname, '../vendure.sqlite'),
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    // Multi-vendor order handling: splits orders by seller and assigns order lines to correct seller channels
    orderOptions: {
        orderSellerStrategy: new TunerSwapOrderSellerStrategy(),
    },
    // Multi-vendor shipping: assigns shipping methods to correct seller and handles digital/physical/service products
    shippingOptions: {
        shippingLineAssignmentStrategy: new TunerSwapShippingLineAssignmentStrategy(),
        shippingEligibilityCheckers: [tunerSwapShippingEligibilityChecker],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {},
    // Add custom collection filter for product types (tune, part, service)
    catalogOptions: {
        collectionFilters: [
            ...defaultCollectionFilters,
            productTypeCollectionFilter,
        ],
    },
    // Health check monitoring for system status
    systemOptions: {
        healthChecks: [
            new TypeORMHealthCheckStrategy({ key: 'database', timeout: 5000 }),
            // Note: Asset server is part of the main Vendure process and doesn't have a separate health endpoint
            // The database health check is sufficient for monitoring the main server
        ],
    },
    plugins: [
        GraphiqlPlugin.init(),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, '../static/assets'),
            // For local dev, the correct value for assetUrlPrefix should
            // be guessed correctly, but for production it will usually need
            // to be set manually to match your production url.
            assetUrlPrefix: IS_DEV ? undefined : 'https://www.my-shop.com/assets/',
        }),
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            // Use SMTP transport for real email sending
            transport: {
                type: 'smtp',
                host: process.env.SMTP_HOST || 'smtp.dreamhost.com',
                port: +(process.env.SMTP_PORT || 465),
                secure: true, // true for port 465 (SSL)
                auth: {
                    user: process.env.SMTP_USER || '',
                    pass: process.env.SMTP_PASSWORD || '',
                },
            },
            // Use dynamic handlers for auth emails (reads port at send time)
            // Plus the order confirmation handler from defaults
            handlers: [
                ...dynamicEmailHandlers,
                defaultEmailHandlers.find(h => h.type === 'order-confirmation')!,
            ].filter(Boolean),
            templateLoader: new FileBasedTemplateLoader(emailTemplatePath),
            globalTemplateVars: {
                // Only fromAddress is needed globally - URLs are set dynamically per-handler
                fromAddress: process.env.SMTP_FROM_ADDRESS || '"TunerSwap" <noreply@tuner-swap.com>',
            },
        }),
        // Multi-vendor marketplace plugin - must be loaded BEFORE DashboardPlugin
        // so the dashboard can discover and include its UI extensions
        MarketplacePlugin.init({
            autoApprove: true, // Auto-approve sellers (change to false for manual approval)
        }),
        VisitorAnalyticsPlugin.init({
            enabled: true,
            rateLimitPerMinute: 60,
            eventRetentionDays: 90,
            geolocation: {
                provider: 'ip-api', // Free tier: 45 req/min
                cacheTTLHours: 24,
            },
        }),
        // My Garage plugin - customer vehicle management and product fitment
        MyGaragePlugin.init({
            maxVehiclesPerCustomer: 10,
            enableVinStorage: true,
            enableACESImport: true,
            enableNHTSARefresh: true,
        }),
        // DashboardPlugin should be LAST to pick up all dashboard extensions from other plugins
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: IS_DEV
                ? path.join(__dirname, '../dist/dashboard')
                : path.join(__dirname, 'dashboard'),
        }),
    ],
};
