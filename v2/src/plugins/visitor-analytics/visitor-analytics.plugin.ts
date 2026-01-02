// See ../PLUGIN_STRUCTURE_GUIDE.md before modifying this plugin
/**
 * Visitor Analytics Plugin
 *
 * Comprehensive visitor tracking and analytics for Vendure storefronts.
 *
 * Features:
 * - Track every visit (anonymous and authenticated) with full context
 * - IP geolocation with caching (ip-api.com, ipstack, MaxMind)
 * - Device, browser, and OS detection from user agent
 * - Real-time dashboard with stats, charts, and heatmaps
 * - Security features: IP/customer correlation, suspicious activity detection
 * - Hooks for future features (2FA prompts, anomaly alerts)
 *
 * Usage:
 * ```typescript
 * import { VisitorAnalyticsPlugin } from './plugins/visitor-analytics';
 *
 * export const config: VendureConfig = {
 *     plugins: [
 *         VisitorAnalyticsPlugin.init({
 *             enabled: true,
 *             rateLimitPerMinute: 60,
 *             eventRetentionDays: 90,
 *             geolocation: {
 *                 provider: 'ip-api',
 *                 cacheTTLHours: 24,
 *             },
 *         }),
 *     ],
 * };
 * ```
 *
 * Admin UI:
 * - Dashboard: Traffic overview, country breakdown, device stats
 * - Events: Full event log with filters
 * - Security: IP/customer correlation, suspicious activity
 *
 * Frontend Integration:
 * See visitor-tracker.ts for client-side tracking implementation.
 */

import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { VisitorEvent } from './entities/visitor-event.entity';
import { IPGeolocationCache } from './entities/ip-geolocation-cache.entity';
import { DailyAggregate } from './entities/daily-aggregate.entity';
import { VisitorAnalyticsService } from './services/visitor-analytics.service';
import { GeolocationService } from './services/geolocation.service';
import { VisitorShopResolver } from './api/visitor-shop.resolver';
import { VisitorAdminResolver } from './api/visitor-admin.resolver';
import { shopApiExtensions, adminApiExtensions } from './api/api-extensions';
import {
    VISITOR_ANALYTICS_OPTIONS,
    VisitorAnalyticsOptions,
} from './types';
import {
    visitorAnalyticsPermissions,
} from './permissions';

/**
 * Default plugin options
 */
const defaultOptions: VisitorAnalyticsOptions = {
    enabled: true,
    rateLimitPerMinute: 60,
    eventRetentionDays: 90,
    geolocation: {
        provider: 'ip-api',
        cacheTTLHours: 24,
    },
    excludeIPs: [],
    excludeUserAgents: [],
};

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [VisitorEvent, IPGeolocationCache, DailyAggregate],
    providers: [
        VisitorAnalyticsService,
        GeolocationService,
        {
            provide: VISITOR_ANALYTICS_OPTIONS,
            useFactory: () => VisitorAnalyticsPlugin.options,
        },
    ],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [VisitorShopResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [VisitorAdminResolver],
    },
    // Dashboard extension - points to the source file for Vite to compile
    dashboard: './ui/routes.tsx',
    configuration: config => {
        // Register custom permissions
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...visitorAnalyticsPermissions,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class VisitorAnalyticsPlugin {
    /**
     * Plugin options - merged with defaults
     */
    static options: VisitorAnalyticsOptions = defaultOptions;

    /**
     * Initialize the plugin with custom options
     *
     * @param options - Partial options to override defaults
     * @returns The plugin class for use in Vendure config
     *
     * @example
     * ```typescript
     * VisitorAnalyticsPlugin.init({
     *     enabled: true,
     *     eventRetentionDays: 180, // 6 months
     *     geolocation: {
     *         provider: 'ipstack',
     *         apiKey: 'your-api-key',
     *         cacheTTLHours: 48,
     *     },
     *     excludeIPs: ['127.0.0.1', '192.168.*'],
     *     hooks: {
     *         onSuspiciousActivity: async (data) => {
     *             // Send alert email
     *         },
     *     },
     * })
     * ```
     */
    static init(options: Partial<VisitorAnalyticsOptions>): Type<VisitorAnalyticsPlugin> {
        this.options = {
            ...defaultOptions,
            ...options,
            geolocation: {
                ...defaultOptions.geolocation,
                ...options.geolocation,
            },
        };
        return VisitorAnalyticsPlugin;
    }

}
