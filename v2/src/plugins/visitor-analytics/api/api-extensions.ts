/**
 * GraphQL API Extensions for Visitor Analytics Plugin
 *
 * Defines GraphQL schema for:
 * - Shop API: Public tracking mutations (recordVisitorEvent, recordVisitorEventsBatch)
 * - Admin API: Analytics queries (dashboard stats, events, country breakdown, security)
 */

import gql from 'graphql-tag';

// =============================================================================
// SHOP API EXTENSIONS
// =============================================================================

/**
 * Shop API - Public tracking endpoint for recording visitor events.
 * Rate-limited to prevent abuse. IP captured server-side.
 */
export const shopApiExtensions = gql`
    # Input for recording a single visitor event
    input RecordVisitorEventInput {
        "Client-generated session ID (stored in sessionStorage)"
        sessionId: String!
        "Persistent anonymous ID (stored in localStorage)"
        anonymousId: String
        "Event type: page_view, product_view, search, add_to_cart, etc."
        eventType: String!
        "Page URL path"
        pagePath: String
        "Page title from document.title"
        pageTitle: String
        "Referrer URL"
        referrer: String
        "Additional event-specific data as JSON"
        eventData: JSON
        "Screen resolution (e.g., '1920x1080')"
        screenResolution: String
        "Browser language preference"
        language: String
        "Client timestamp (ISO string)"
        timestamp: String
    }

    # Result of recording a visitor event
    type RecordVisitorEventResult {
        success: Boolean!
        eventId: ID
        message: String
    }

    # Result of batch recording
    type BatchRecordResult {
        success: Boolean!
        recorded: Int!
        failed: Int!
        errors: [String!]
    }

    extend type Mutation {
        "Record a single visitor event (rate-limited)"
        recordVisitorEvent(input: RecordVisitorEventInput!): RecordVisitorEventResult!
        "Record multiple visitor events in batch (rate-limited)"
        recordVisitorEventsBatch(events: [RecordVisitorEventInput!]!): BatchRecordResult!
    }
`;

// =============================================================================
// ADMIN API EXTENSIONS
// =============================================================================

/**
 * Admin API - Protected analytics queries for dashboards and security.
 * Requires VisitorAnalyticsRead permission for basic stats,
 * VisitorAnalyticsSecurity for raw IP data.
 */
export const adminApiExtensions = gql`
    # =========================================================================
    # DASHBOARD STATS
    # =========================================================================

    "Dashboard overview statistics"
    type VisitorDashboardStats {
        "Total events in the period"
        totalEvents: Int!
        "Total events today"
        todayEvents: Int!
        "Page views in the period"
        pageViews: Int!
        "Unique session IDs"
        uniqueSessions: Int!
        "Unique IP addresses"
        uniqueIPs: Int!
        "Unique anonymous IDs (persistent visitors)"
        uniqueVisitors: Int!
        "Unique authenticated customers"
        uniqueCustomers: Int!
        "Events from authenticated users"
        authenticatedEvents: Int!
        "Events from anonymous users"
        anonymousEvents: Int!
        "Percentage change from previous period"
        percentChange: Float
    }

    # =========================================================================
    # EVENT LIST & FILTERS
    # =========================================================================

    "A single visitor event"
    type VisitorEvent {
        id: ID!
        sessionId: String!
        anonymousId: String
        ipAddress: String
        customerId: ID
        channelId: ID
        eventType: String!
        pagePath: String
        pageTitle: String
        referrer: String
        eventData: JSON
        countryCode: String
        country: String
        region: String
        city: String
        latitude: Float
        longitude: Float
        timezone: String
        geoStatus: String
        deviceType: String
        browser: String
        os: String
        userAgent: String
        screenResolution: String
        language: String
        eventTime: DateTime!
        createdAt: DateTime!
    }

    "Paginated list of visitor events"
    type VisitorEventList {
        items: [VisitorEvent!]!
        totalItems: Int!
    }

    "Filter options for visitor events"
    input VisitorEventFilterInput {
        "Filter by event type"
        eventType: String
        "Filter by country code"
        countryCode: String
        "Filter by device type"
        deviceType: String
        "Filter by browser (partial match)"
        browser: String
        "Filter by IP address (exact or partial)"
        ipAddress: String
        "Filter by customer ID"
        customerId: ID
        "Filter by session ID"
        sessionId: String
        "Filter by anonymous ID"
        anonymousId: ID
        "Filter by page path (partial match)"
        pagePath: String
        "Only authenticated events"
        authenticatedOnly: Boolean
        "Start date"
        startDate: DateTime
        "End date"
        endDate: DateTime
    }

    "Sort options for visitor events"
    input VisitorEventSortInput {
        field: String!
        direction: String!
    }

    # =========================================================================
    # COUNTRY & GEOGRAPHY
    # =========================================================================

    "Visitor data by country"
    type CountryVisitorData {
        countryCode: String!
        country: String!
        totalEvents: Int!
        uniqueSessions: Int!
        uniqueVisitors: Int!
        percentage: Float!
    }

    # =========================================================================
    # DEVICE BREAKDOWN
    # =========================================================================

    "Device type breakdown"
    type DeviceTypeData {
        deviceType: String!
        count: Int!
        percentage: Float!
    }

    "Browser breakdown"
    type BrowserData {
        browser: String!
        count: Int!
        percentage: Float!
    }

    "Operating system breakdown"
    type OSData {
        os: String!
        count: Int!
        percentage: Float!
    }

    "Complete device breakdown"
    type DeviceBreakdown {
        devices: [DeviceTypeData!]!
        browsers: [BrowserData!]!
        operatingSystems: [OSData!]!
    }

    # =========================================================================
    # TRAFFIC & TIME SERIES
    # =========================================================================

    "Time series data point"
    type TrafficTimeSeriesPoint {
        timestamp: DateTime!
        label: String!
        totalEvents: Int!
        pageViews: Int!
        uniqueSessions: Int!
        uniqueVisitors: Int!
    }

    # =========================================================================
    # PAGE ANALYTICS
    # =========================================================================

    "Page view data"
    type PageViewData {
        pagePath: String!
        pageTitle: String
        views: Int!
        uniqueVisitors: Int!
        percentage: Float!
    }

    # =========================================================================
    # SECURITY QUERIES
    # =========================================================================

    "IP entry for customer history"
    type CustomerIPEntry {
        ipAddress: String!
        countryCode: String
        country: String
        city: String
        firstSeen: DateTime!
        lastSeen: DateTime!
        eventCount: Int!
    }

    "Customer IP history"
    type CustomerIPHistory {
        customerId: ID!
        totalIPs: Int!
        ipEntries: [CustomerIPEntry!]!
        "Countries this customer has connected from"
        countries: [String!]!
        "Flag if customer has suspicious activity"
        suspicious: Boolean!
        suspiciousReasons: [String!]
    }

    "Customer entry for IP lookup"
    type IPCustomerEntry {
        customerId: ID!
        customerEmail: String
        firstSeen: DateTime!
        lastSeen: DateTime!
        eventCount: Int!
    }

    "Data for customers sharing an IP"
    type IPCustomerData {
        ipAddress: String!
        countryCode: String
        country: String
        city: String
        totalCustomers: Int!
        totalEvents: Int!
        customers: [IPCustomerEntry!]!
        "Flag if multiple customers is suspicious"
        suspicious: Boolean!
    }

    "Suspicious activity entry"
    type SuspiciousActivityEntry {
        type: String!
        description: String!
        severity: String!
        ipAddress: String
        customerId: ID
        details: JSON
        detectedAt: DateTime!
    }

    "Suspicious activity report"
    type SuspiciousActivityReport {
        totalAlerts: Int!
        highSeverity: Int!
        mediumSeverity: Int!
        lowSeverity: Int!
        entries: [SuspiciousActivityEntry!]!
    }

    # =========================================================================
    # ADMIN QUERIES
    # =========================================================================

    extend type Query {
        "Get dashboard overview statistics"
        visitorDashboardStats(
            startDate: DateTime
            endDate: DateTime
            channelId: ID
        ): VisitorDashboardStats!

        "Get paginated list of visitor events"
        visitorEvents(
            filter: VisitorEventFilterInput
            sort: VisitorEventSortInput
            skip: Int
            take: Int
        ): VisitorEventList!

        "Get visitor breakdown by country"
        visitorsByCountry(
            startDate: DateTime
            endDate: DateTime
            limit: Int
        ): [CountryVisitorData!]!

        "Get device/browser/OS breakdown"
        visitorDeviceBreakdown(
            startDate: DateTime
            endDate: DateTime
        ): DeviceBreakdown!

        "Get traffic over time"
        visitorTrafficOverTime(
            startDate: DateTime!
            endDate: DateTime!
            granularity: String
        ): [TrafficTimeSeriesPoint!]!

        "Get top pages by views"
        visitorTopPages(
            startDate: DateTime
            endDate: DateTime
            limit: Int
        ): [PageViewData!]!

        "Get IP history for a specific customer (requires Security permission)"
        customerIPHistory(customerId: ID!): CustomerIPHistory!

        "Get customers associated with an IP address (requires Security permission)"
        customersByIP(ipAddress: String!): IPCustomerData!

        "Get suspicious activity report (requires Security permission)"
        suspiciousActivityReport(
            startDate: DateTime
            endDate: DateTime
        ): SuspiciousActivityReport!
    }

    # =========================================================================
    # ADMIN MUTATIONS
    # =========================================================================

    "Result of cleanup operation"
    type CleanupResult {
        success: Boolean!
        deleted: Int!
        message: String
    }

    extend type Mutation {
        "Clean up old visitor events (requires Manage permission)"
        cleanupVisitorEvents(olderThanDays: Int): CleanupResult!

        "Clean up expired geolocation cache entries"
        cleanupGeolocationCache: CleanupResult!
    }
`;
