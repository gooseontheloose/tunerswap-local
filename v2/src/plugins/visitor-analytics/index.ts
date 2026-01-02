/**
 * Visitor Analytics Plugin
 *
 * @packageDocumentation
 *
 * Public exports for the Visitor Analytics plugin.
 *
 * Main exports:
 * - VisitorAnalyticsPlugin: The main plugin class
 * - Types and interfaces for configuration
 * - Permission definitions
 * - Entity classes (for custom queries)
 * - Service classes (for extending functionality)
 */

// Main plugin
export { VisitorAnalyticsPlugin } from './visitor-analytics.plugin';

// Types and configuration
export {
    VisitorAnalyticsOptions,
    GeolocationData,
    DeviceInfo,
    RecordVisitorEventInput,
    GetEventsOptions,
    DashboardStats,
    CountryVisitorData,
    DeviceBreakdown,
    TimeSeriesPoint,
    PageViewData,
    IPAccessRecord,
    CustomerIPHistory,
    IPCustomerData,
    SuspiciousActivityData,
    NewVisitorData,
    NewIPLoginData,
    VISITOR_ANALYTICS_OPTIONS,
    defaultVisitorAnalyticsOptions,
} from './types';

// Permissions
export {
    VisitorAnalyticsRead,
    VisitorAnalyticsSecurity,
    VisitorAnalyticsManage,
} from './permissions';

// Entities (for custom queries or extensions)
export { VisitorEvent } from './entities/visitor-event.entity';
export { IPGeolocationCache } from './entities/ip-geolocation-cache.entity';
export { DailyAggregate } from './entities/daily-aggregate.entity';

// Services (for extending functionality)
export { VisitorAnalyticsService } from './services/visitor-analytics.service';
export { GeolocationService } from './services/geolocation.service';
