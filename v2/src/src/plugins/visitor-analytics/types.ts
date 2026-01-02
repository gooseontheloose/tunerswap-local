/**
 * Visitor Analytics Plugin - Types and Configuration
 *
 * Defines plugin options, interfaces, and constants for the visitor tracking system.
 */

import { ID } from '@vendure/core';

// Plugin options injection token
export const VISITOR_ANALYTICS_OPTIONS = 'VISITOR_ANALYTICS_OPTIONS';

/**
 * Geolocation data returned from IP lookup
 */
export interface GeolocationData {
    countryCode: string;
    country: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
    timezone: string;
    isp?: string;
}

/**
 * Device information parsed from user agent
 */
export interface DeviceInfo {
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
}

/**
 * Input for recording a visitor event
 */
export interface RecordVisitorEventInput {
    sessionId: string;
    eventType: string;
    pagePath?: string;
    pageTitle?: string;
    referrer?: string;
    eventData?: Record<string, any>;
    deviceType?: string;
    screenResolution?: string;
    language?: string;
    anonymousId?: string;
}

/**
 * Options for filtering visitor events
 */
export interface GetEventsOptions {
    skip?: number;
    take?: number;
    startDate?: Date;
    endDate?: Date;
    eventType?: string;
    countryCode?: string;
    deviceType?: string;
    hasCustomer?: boolean;
    ipAddress?: string;
    sessionId?: string;
    customerId?: ID;
}

/**
 * Dashboard statistics summary - matches GraphQL VisitorDashboardStats type
 */
export interface DashboardStats {
    totalEvents: number;
    todayEvents: number;
    pageViews: number;
    uniqueSessions: number;
    uniqueIPs: number;
    uniqueVisitors: number;
    uniqueCustomers: number;
    authenticatedEvents: number;
    anonymousEvents: number;
    percentChange: number | null;
}

/**
 * Country visitor data for heatmap/breakdown - matches GraphQL CountryVisitorData type
 */
export interface CountryVisitorData {
    countryCode: string;
    country: string;
    totalEvents: number;
    uniqueSessions: number;
    uniqueVisitors: number;
    percentage: number;
}

/**
 * Device breakdown statistics - matches GraphQL DeviceBreakdown type
 */
export interface DeviceBreakdown {
    devices: { deviceType: string; count: number; percentage: number }[];
    browsers: { browser: string; count: number; percentage: number }[];
    operatingSystems: { os: string; count: number; percentage: number }[];
}

/**
 * Time series data point for charts - matches GraphQL TrafficTimeSeriesPoint type
 */
export interface TimeSeriesPoint {
    timestamp: Date;
    label: string;
    totalEvents: number;
    pageViews: number;
    uniqueSessions: number;
    uniqueVisitors: number;
}

/**
 * Page view data for top pages report
 */
export interface PageViewData {
    pagePath: string;
    pageTitle?: string;
    views: number;
    uniqueVisitors: number;
    percentage: number;
}

/**
 * Customer IP access record for security view
 */
export interface IPAccessRecord {
    ipAddress: string;
    country: string | null;
    city: string | null;
    firstSeen: Date;
    lastSeen: Date;
    visitCount: number;
    isCurrent: boolean;
}

/**
 * Customer IP history for security review
 */
export interface CustomerIPHistory {
    customerId: ID;
    customerEmail: string | null;
    ips: IPAccessRecord[];
    totalUniqueIPs: number;
    flagged: boolean;
    flagReason: string | null;
}

/**
 * IP to customer mapping for fraud detection
 */
export interface IPCustomerData {
    ipAddress: string;
    geolocation: GeolocationData | null;
    customers: {
        customerId: ID;
        email: string;
        firstName: string | null;
        lastName: string | null;
        firstSeen: Date;
        lastSeen: Date;
        visitCount: number;
    }[];
    totalCustomers: number;
    flagged: boolean;
    flagReason: string | null;
}

/**
 * Suspicious activity alert types
 */
export interface SuspiciousActivityData {
    type: 'multiple_accounts_per_ip' | 'rapid_ip_change' | 'unusual_geolocation' | 'impossible_travel';
    severity: 'low' | 'medium' | 'high';
    customerId?: ID;
    ipAddress?: string;
    details: Record<string, any>;
    timestamp: Date;
}

/**
 * New visitor event data (for hooks)
 */
export interface NewVisitorData {
    sessionId: string;
    ipAddress: string;
    geolocation: GeolocationData | null;
    deviceInfo: DeviceInfo;
    timestamp: Date;
}

/**
 * New IP login event data (for hooks)
 */
export interface NewIPLoginData {
    customerId: ID;
    customerEmail: string;
    ipAddress: string;
    geolocation: GeolocationData | null;
    previousIPs: string[];
    isFirstLogin: boolean;
    timestamp: Date;
}

/**
 * Plugin configuration options
 */
export interface VisitorAnalyticsOptions {
    /**
     * Enable/disable visitor tracking
     * @default true
     */
    enabled: boolean;

    /**
     * Rate limit for tracking endpoint (requests per minute per IP)
     * @default 60
     */
    rateLimitPerMinute: number;

    /**
     * Days to retain raw events (older events are deleted)
     * @default 90
     */
    eventRetentionDays: number;

    /**
     * Geolocation provider configuration
     */
    geolocation: {
        /**
         * Provider: 'ip-api' (free, 45 req/min), 'maxmind', 'ipstack'
         * @default 'ip-api'
         */
        provider: 'ip-api' | 'maxmind' | 'ipstack' | 'none';

        /**
         * API key (required for maxmind, ipstack)
         */
        apiKey?: string;

        /**
         * Cache TTL in hours
         * @default 24
         */
        cacheTTLHours: number;
    };

    /**
     * IP addresses/ranges to exclude from tracking (admin IPs, etc.)
     */
    excludeIPs?: string[];

    /**
     * User agent regex patterns to exclude (bots, crawlers)
     */
    excludeUserAgents?: RegExp[];

    /**
     * User agent string patterns to exclude (simpler matching)
     * @deprecated Use excludeUserAgents with RegExp for more precise matching
     */
    excludeUserAgentPatterns?: string[];

    /**
     * Hooks for future features and integrations
     */
    hooks?: {
        /**
         * Called when suspicious activity is detected
         */
        onSuspiciousActivity?: (data: SuspiciousActivityData) => void | Promise<void>;

        /**
         * Called on first visit from a new visitor
         */
        onNewVisitor?: (data: NewVisitorData) => void | Promise<void>;

        /**
         * Called when a customer logs in from a new IP
         */
        onNewIPLogin?: (data: NewIPLoginData) => void | Promise<void>;
    };
}

/**
 * Default plugin options
 */
export const defaultVisitorAnalyticsOptions: VisitorAnalyticsOptions = {
    enabled: true,
    rateLimitPerMinute: 60,
    eventRetentionDays: 90,
    geolocation: {
        provider: 'ip-api',
        cacheTTLHours: 24,
    },
    excludeIPs: [],
    excludeUserAgentPatterns: [
        'bot', 'crawler', 'spider', 'googlebot', 'bingbot', 'slurp',
        'duckduckbot', 'baiduspider', 'yandexbot', 'facebookexternalhit',
    ],
};
