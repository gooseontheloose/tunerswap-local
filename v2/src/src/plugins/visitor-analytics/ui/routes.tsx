/**
 * ============================================================================
 * VISITOR ANALYTICS - ADMIN DASHBOARD UI
 * ============================================================================
 *
 * Admin dashboard pages for visitor analytics:
 *
 * 1. DASHBOARD PAGE (Overview)
 *    - Stats cards: Total visits, unique visitors, today's traffic
 *    - Traffic chart: Time series with granularity selector
 *    - Country breakdown: Table with country, visits, percentage
 *    - Device breakdown: Device type, browser, OS pie charts
 *
 * 2. EVENTS PAGE (Event Log)
 *    - Filterable event list with pagination
 *    - Filters: date range, event type, country, device, IP
 *    - Event detail modal with full context
 *
 * 3. SECURITY PAGE (IP/Customer Correlation)
 *    - Customer IP history lookup
 *    - IP-to-customer mapping
 *    - Suspicious activity alerts
 *
 * VERSION: 1.0.0 (2024-12-12)
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
    defineDashboardExtension,
    api,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableCell,
    TableBody,
    Badge,
} from '@vendure/dashboard';
import {
    BarChart3,
    Globe,
    Users,
    Activity,
    Eye,
    Shield,
    AlertTriangle,
    Search,
    Filter,
    RefreshCw,
    Calendar,
    Smartphone,
    Monitor,
    Tablet,
    ChevronLeft,
    Settings,
    Copy,
    ChevronRight,
    Clock,
    MapPin,
    User,
    Laptop,
    Chrome,
    Apple,
    Bot,
    AlertCircle,
    CheckCircle,
    XCircle,
    Bug,
    Trash2,
    Info,
    X,
    Terminal,
    Lightbulb,
    Server,
    AlertOctagon,
    FileCode,
} from 'lucide-react';
import { gql } from 'graphql-tag';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_DASHBOARD_STATS = gql`
    query GetDashboardStats($startDate: DateTime, $endDate: DateTime) {
        visitorDashboardStats(startDate: $startDate, endDate: $endDate) {
            totalEvents
            todayEvents
            pageViews
            uniqueSessions
            uniqueIPs
            uniqueVisitors
            uniqueCustomers
            authenticatedEvents
            anonymousEvents
            percentChange
        }
    }
`;

const GET_VISITORS_BY_COUNTRY = gql`
    query GetVisitorsByCountry($startDate: DateTime, $endDate: DateTime, $limit: Int) {
        visitorsByCountry(startDate: $startDate, endDate: $endDate, limit: $limit) {
            countryCode
            country
            totalEvents
            uniqueSessions
            uniqueVisitors
            percentage
        }
    }
`;

const GET_DEVICE_BREAKDOWN = gql`
    query GetDeviceBreakdown($startDate: DateTime, $endDate: DateTime) {
        visitorDeviceBreakdown(startDate: $startDate, endDate: $endDate) {
            devices {
                deviceType
                count
                percentage
            }
            browsers {
                browser
                count
                percentage
            }
            operatingSystems {
                os
                count
                percentage
            }
        }
    }
`;

const GET_TRAFFIC_OVER_TIME = gql`
    query GetTrafficOverTime($startDate: DateTime!, $endDate: DateTime!, $granularity: String) {
        visitorTrafficOverTime(startDate: $startDate, endDate: $endDate, granularity: $granularity) {
            timestamp
            label
            totalEvents
            pageViews
            uniqueSessions
            uniqueVisitors
        }
    }
`;

const GET_TOP_PAGES = gql`
    query GetTopPages($startDate: DateTime, $endDate: DateTime, $limit: Int) {
        visitorTopPages(startDate: $startDate, endDate: $endDate, limit: $limit) {
            pagePath
            pageTitle
            views
            uniqueVisitors
            percentage
        }
    }
`;

const GET_VISITOR_EVENTS = gql`
    query GetVisitorEvents($filter: VisitorEventFilterInput, $skip: Int, $take: Int) {
        visitorEvents(filter: $filter, skip: $skip, take: $take) {
            items {
                id
                sessionId
                anonymousId
                ipAddress
                customerId
                eventType
                pagePath
                pageTitle
                referrer
                countryCode
                country
                city
                deviceType
                browser
                os
                eventTime
            }
            totalItems
        }
    }
`;

const GET_CUSTOMER_IP_HISTORY = gql`
    query GetCustomerIPHistory($customerId: ID!) {
        customerIPHistory(customerId: $customerId) {
            customerId
            totalIPs
            ipEntries {
                ipAddress
                countryCode
                country
                city
                firstSeen
                lastSeen
                eventCount
            }
            countries
            suspicious
            suspiciousReasons
        }
    }
`;

const GET_CUSTOMERS_BY_IP = gql`
    query GetCustomersByIP($ipAddress: String!) {
        customersByIP(ipAddress: $ipAddress) {
            ipAddress
            countryCode
            country
            city
            totalCustomers
            totalEvents
            customers {
                customerId
                customerEmail
                firstSeen
                lastSeen
                eventCount
            }
            suspicious
        }
    }
`;

const GET_SUSPICIOUS_ACTIVITY = gql`
    query GetSuspiciousActivity($startDate: DateTime, $endDate: DateTime) {
        suspiciousActivityReport(startDate: $startDate, endDate: $endDate) {
            totalAlerts
            highSeverity
            mediumSeverity
            lowSeverity
            entries {
                type
                description
                severity
                ipAddress
                customerId
                details
                detectedAt
            }
        }
    }
`;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format number with commas for display
 */
function formatNumber(num: number): string {
    return num.toLocaleString();
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * Format datetime for display
 */
function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Get date range for presets
 */
function getDateRange(preset: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now.setHours(23, 59, 59, 999));
    let start: Date;

    switch (preset) {
        case 'today':
            start = new Date(now.setHours(0, 0, 0, 0));
            break;
        case '7days':
            start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30days':
            start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90days':
            start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            break;
        default:
            start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
}

/**
 * Country code to flag emoji
 */
function countryFlag(code: string): string {
    if (!code || code.length !== 2) return '🌍';
    const offset = 127397;
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

/**
 * Device type icon
 */
function DeviceIcon({ type }: { type: string }) {
    switch (type?.toLowerCase()) {
        case 'mobile':
            return <Smartphone className="w-4 h-4" />;
        case 'tablet':
            return <Tablet className="w-4 h-4" />;
        case 'desktop':
            return <Monitor className="w-4 h-4" />;
        default:
            return <Laptop className="w-4 h-4" />;
    }
}

// ============================================================================
// Debug Log System
// ============================================================================

const VISITOR_DEBUG_LOGS_KEY = 'visitorAnalyticsDebugLogs';

interface DebugLog {
    id: string;
    timestamp: number;
    service: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    details?: string;
    dismissed: boolean;
    count: number;
    firstOccurrence: number;
    lastOccurrence: number;
}

const VISITOR_SERVICES = [
    'Dashboard Query',
    'Events Query',
    'Security Query',
    'Geolocation Lookup',
    'Event Recording',
    'Data Cleanup',
    'GraphQL Query',
];

function normalizeMessage(msg: string): string {
    return msg
        .replace(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?/gi, '')
        .replace(/[a-f0-9-]{36}/gi, '[ID]')
        .replace(/\d+ms/gi, '[TIME]')
        .replace(/\d{13,}/g, '[TIMESTAMP]')
        .trim();
}

function getVisitorDebugLogs(): DebugLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(VISITOR_DEBUG_LOGS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addVisitorDebugLog(log: Partial<DebugLog>): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getVisitorDebugLogs();
        const now = Date.now();
        const normalizedNew = normalizeMessage(log.message || '');

        // Find existing matching log for deduplication
        const existingIndex = logs.findIndex(existing =>
            existing.service === log.service &&
            existing.type === log.type &&
            normalizeMessage(existing.message) === normalizedNew
        );

        if (existingIndex !== -1) {
            // Increment count instead of adding duplicate
            logs[existingIndex].count += 1;
            logs[existingIndex].lastOccurrence = now;
            if (log.details) {
                logs[existingIndex].details = log.details;
            }
        } else {
            // Add new entry
            logs.push({
                id: `log-${now}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: now,
                service: log.service || 'Unknown',
                type: log.type || 'info',
                message: log.message || '',
                details: log.details,
                dismissed: false,
                count: 1,
                firstOccurrence: now,
                lastOccurrence: now,
            });
        }

        // Keep last 100 logs
        const trimmed = logs.slice(-100);
        localStorage.setItem(VISITOR_DEBUG_LOGS_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save debug log:', err);
    }
}

function deleteVisitorDebugLog(id: string): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getVisitorDebugLogs().filter(log => log.id !== id);
        localStorage.setItem(VISITOR_DEBUG_LOGS_KEY, JSON.stringify(logs));
    } catch (err) {
        console.error('Failed to delete debug log:', err);
    }
}

function clearVisitorDebugLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(VISITOR_DEBUG_LOGS_KEY, JSON.stringify([]));
}

// Service Info for enhanced debug reports
interface VisitorServiceInfo {
    description: string;
    endpoint: string;
    fileLocations: string[];
    dependencies: string[];
    affectedAreas: string[];
    recommendedActions: string[];
    debugCommands: { label: string; command: string }[];
}

const VISITOR_SERVICE_INFO: Record<string, VisitorServiceInfo> = {
    'Dashboard Query': {
        description: 'Fetches visitor statistics, traffic data, device breakdown, and top pages for the analytics dashboard',
        endpoint: 'POST /admin-api (GraphQL)',
        fileLocations: [
            'v2/src/plugins/visitor-analytics/api/visitor-admin.resolver.ts',
            'v2/src/plugins/visitor-analytics/services/visitor-analytics.service.ts',
        ],
        dependencies: ['Vendure API', 'Database'],
        affectedAreas: ['Analytics Dashboard', 'Traffic Reports', 'Device Statistics', 'Geographic Data'],
        recommendedActions: [
            'Check if Vendure server is running',
            'Verify visitor_event table has data',
            'Check date range parameters are valid',
            'Review browser console for network errors',
        ],
        debugCommands: [
            { label: 'Count visitor events', command: 'sqlite3 v2/vendure.sqlite "SELECT COUNT(*) FROM visitor_event"' },
            { label: 'Check recent events', command: 'sqlite3 v2/vendure.sqlite "SELECT * FROM visitor_event ORDER BY createdAt DESC LIMIT 5"' },
        ],
    },
    'Events Query': {
        description: 'Retrieves paginated list of visitor events with filtering options',
        endpoint: 'POST /admin-api (GraphQL)',
        fileLocations: [
            'v2/src/plugins/visitor-analytics/api/visitor-admin.resolver.ts',
            'v2/src/plugins/visitor-analytics/services/visitor-analytics.service.ts',
        ],
        dependencies: ['Vendure API', 'Database'],
        affectedAreas: ['Events List', 'Event Filtering', 'Pagination'],
        recommendedActions: [
            'Check filter parameters format',
            'Verify pagination values (skip, take)',
            'Check if event types match schema enum',
        ],
        debugCommands: [
            { label: 'List event types', command: 'sqlite3 v2/vendure.sqlite "SELECT DISTINCT eventType FROM visitor_event"' },
        ],
    },
    'Security Query': {
        description: 'Analyzes suspicious activity patterns and customer IP history',
        endpoint: 'POST /admin-api (GraphQL)',
        fileLocations: [
            'v2/src/plugins/visitor-analytics/api/visitor-admin.resolver.ts',
            'v2/src/plugins/visitor-analytics/services/visitor-analytics.service.ts',
        ],
        dependencies: ['Vendure API', 'Database'],
        affectedAreas: ['Security Dashboard', 'IP Analysis', 'Fraud Detection'],
        recommendedActions: [
            'Check if IP addresses are being recorded',
            'Verify customer association logic',
            'Review threshold settings for suspicious activity',
        ],
        debugCommands: [
            { label: 'Check IP diversity', command: 'sqlite3 v2/vendure.sqlite "SELECT ipAddress, COUNT(*) FROM visitor_event GROUP BY ipAddress LIMIT 10"' },
        ],
    },
    'Geolocation Lookup': {
        description: 'Resolves IP addresses to geographic locations using external API',
        endpoint: 'External API (ip-api.com)',
        fileLocations: [
            'v2/src/plugins/visitor-analytics/services/visitor-analytics.service.ts',
        ],
        dependencies: ['Internet Connection', 'ip-api.com API'],
        affectedAreas: ['Country Detection', 'Geographic Reports', 'Location Badges'],
        recommendedActions: [
            'Check internet connectivity',
            'Verify ip-api.com service is accessible',
            'Check API rate limits (45 requests/minute)',
            'Consider fallback to ipstack if primary fails',
        ],
        debugCommands: [
            { label: 'Test geolocation API', command: 'curl http://ip-api.com/json/8.8.8.8' },
        ],
    },
    'Event Recording': {
        description: 'Records visitor events from the frontend tracking script',
        endpoint: 'POST /shop-api (GraphQL Mutation)',
        fileLocations: [
            'v2/src/plugins/visitor-analytics/api/visitor-shop.resolver.ts',
            'website/app/components/VisitorTracker.tsx',
        ],
        dependencies: ['Shop API', 'Database', 'Frontend Script'],
        affectedAreas: ['All Analytics Data', 'Real-time Tracking', 'Session Recording'],
        recommendedActions: [
            'Verify VisitorTracker component is mounted',
            'Check browser console for tracking errors',
            'Verify CORS settings allow tracking requests',
            'Check that events are reaching the server',
        ],
        debugCommands: [
            { label: 'Check frontend script', command: 'grep -r "VisitorTracker" website/app' },
            { label: 'Test recording endpoint', command: 'curl -X POST http://localhost:3000/shop-api -H "Content-Type: application/json" -d \'{"query":"{ __typename }"}\'' },
        ],
    },
    'Data Cleanup': {
        description: 'Removes old visitor events and optimizes storage',
        endpoint: 'Internal Service / Scheduled Job',
        fileLocations: [
            'v2/src/plugins/visitor-analytics/services/visitor-analytics.service.ts',
        ],
        dependencies: ['Database', 'Vendure Job Queue'],
        affectedAreas: ['Database Size', 'Query Performance', 'Historical Data'],
        recommendedActions: [
            'Check retention policy settings',
            'Verify job queue is processing',
            'Monitor database disk usage',
        ],
        debugCommands: [
            { label: 'Check database size', command: 'ls -lh v2/vendure.sqlite' },
            { label: 'Count old events', command: 'sqlite3 v2/vendure.sqlite "SELECT COUNT(*) FROM visitor_event WHERE createdAt < datetime(\'now\', \'-30 days\')"' },
        ],
    },
    'GraphQL Query': {
        description: 'Generic GraphQL query operation for visitor analytics',
        endpoint: 'POST /admin-api (GraphQL)',
        fileLocations: [
            'v2/src/plugins/visitor-analytics/api/visitor-admin.resolver.ts',
        ],
        dependencies: ['Vendure API', 'Database'],
        affectedAreas: ['Admin Dashboard', 'Data Display'],
        recommendedActions: [
            'Check if Vendure server is running',
            'Review query parameters',
            'Check authentication/permissions',
        ],
        debugCommands: [
            { label: 'Test API connection', command: 'curl http://localhost:3000/admin-api' },
        ],
    },
};

function getVisitorServiceInfo(serviceName: string): VisitorServiceInfo {
    return VISITOR_SERVICE_INFO[serviceName] || {
        description: 'Unknown service',
        endpoint: 'Unknown',
        fileLocations: [],
        dependencies: [],
        affectedAreas: [],
        recommendedActions: ['Contact developer for assistance'],
        debugCommands: [],
    };
}

// ============================================================================
// DASHBOARD PAGE
// ============================================================================

function VisitorDashboardPage() {
    const [dateRange, setDateRange] = useState('7days');
    const [stats, setStats] = useState<any>(null);
    const [countries, setCountries] = useState<any[]>([]);
    const [deviceBreakdown, setDeviceBreakdown] = useState<any>(null);
    const [trafficData, setTrafficData] = useState<any[]>([]);
    const [topPages, setTopPages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, [dateRange]);

    async function loadDashboardData() {
        setLoading(true);
        const { start, end } = getDateRange(dateRange);

        try {
            // Load all dashboard data in parallel
            const [statsResult, countriesResult, devicesResult, trafficResult, pagesResult] =
                await Promise.all([
                    api.query(GET_DASHBOARD_STATS, {
                        startDate: start.toISOString(),
                        endDate: end.toISOString(),
                    }),
                    api.query(GET_VISITORS_BY_COUNTRY, {
                        startDate: start.toISOString(),
                        endDate: end.toISOString(),
                        limit: 10,
                    }),
                    api.query(GET_DEVICE_BREAKDOWN, {
                        startDate: start.toISOString(),
                        endDate: end.toISOString(),
                    }),
                    api.query(GET_TRAFFIC_OVER_TIME, {
                        startDate: start.toISOString(),
                        endDate: end.toISOString(),
                        granularity: dateRange === 'today' ? 'hour' : 'day',
                    }),
                    api.query(GET_TOP_PAGES, {
                        startDate: start.toISOString(),
                        endDate: end.toISOString(),
                        limit: 10,
                    }),
                ]);

            setStats(statsResult.visitorDashboardStats);
            setCountries(countriesResult.visitorsByCountry || []);
            setDeviceBreakdown(devicesResult.visitorDeviceBreakdown);
            setTrafficData(trafficResult.visitorTrafficOverTime || []);
            setTopPages(pagesResult.visitorTopPages || []);

            // Log warnings if data is missing
            if (!statsResult.visitorDashboardStats) {
                addVisitorDebugLog({
                    service: 'Dashboard Query',
                    type: 'warning',
                    message: 'visitorDashboardStats returned null or undefined',
                    details: JSON.stringify(statsResult, null, 2),
                });
            }
        } catch (error: any) {
            console.error('Failed to load dashboard data:', error);
            addVisitorDebugLog({
                service: 'Dashboard Query',
                type: 'error',
                message: `Failed to load dashboard data: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="w-6 h-6" />
                        Visitor Analytics
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Track visitor activity, geography, and engagement
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={dateRange}
                        onChange={e => setDateRange(e.target.value)}
                        className="px-3 py-2 border rounded-md"
                    >
                        <option value="today">Today</option>
                        <option value="7days">Last 7 days</option>
                        <option value="30days">Last 30 days</option>
                        <option value="90days">Last 90 days</option>
                    </select>
                    <Button onClick={loadDashboardData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Total Events
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.totalEvents || 0)}
                        </div>
                        {stats?.percentChange != null && (
                            <p
                                className={`text-xs ${stats.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                                {stats.percentChange >= 0 ? '+' : ''}
                                {stats.percentChange.toFixed(1)}% vs previous
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Today</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.todayEvents || 0)}
                        </div>
                        <p className="text-xs text-gray-500">events today</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Unique Visitors
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.uniqueVisitors || 0)}
                        </div>
                        <p className="text-xs text-gray-500">
                            {formatNumber(stats?.uniqueCustomers || 0)} authenticated
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Page Views
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.pageViews || 0)}
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats?.uniqueSessions || 0} sessions
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Traffic Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Traffic Over Time
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {trafficData.length > 0 ? (
                        <div className="h-64">
                            <TrafficChart data={trafficData} />
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            No traffic data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Country Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5" />
                            Visitors by Country
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {countries.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Country</TableHead>
                                        <TableHead className="text-right">Visitors</TableHead>
                                        <TableHead className="text-right">%</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {countries.map(country => (
                                        <TableRow key={country.countryCode}>
                                            <TableCell>
                                                <span className="mr-2">
                                                    {countryFlag(country.countryCode)}
                                                </span>
                                                {country.country}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatNumber(country.uniqueVisitors)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {country.percentage.toFixed(1)}%
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-8 text-center text-gray-500">
                                No country data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Device Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Smartphone className="w-5 h-5" />
                            Device Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {deviceBreakdown ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Device Type</h4>
                                    {deviceBreakdown.devices?.map((d: any) => (
                                        <div
                                            key={d.deviceType}
                                            className="flex items-center justify-between py-1"
                                        >
                                            <div className="flex items-center gap-2">
                                                <DeviceIcon type={d.deviceType} />
                                                <span className="capitalize">{d.deviceType}</span>
                                            </div>
                                            <span>
                                                {formatNumber(d.count)} ({d.percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Top Browsers</h4>
                                    {deviceBreakdown.browsers?.slice(0, 5).map((b: any) => (
                                        <div
                                            key={b.browser}
                                            className="flex items-center justify-between py-1"
                                        >
                                            <span>{b.browser}</span>
                                            <span>
                                                {formatNumber(b.count)} ({b.percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-gray-500">
                                No device data available
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Top Pages */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Top Pages
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {topPages.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Page</TableHead>
                                    <TableHead className="text-right">Views</TableHead>
                                    <TableHead className="text-right">Visitors</TableHead>
                                    <TableHead className="text-right">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {topPages.map(page => (
                                    <TableRow key={page.pagePath}>
                                        <TableCell>
                                            <div className="font-mono text-sm">{page.pagePath}</div>
                                            {page.pageTitle && (
                                                <div className="text-xs text-gray-500">
                                                    {page.pageTitle}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatNumber(page.views)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatNumber(page.uniqueVisitors)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {page.percentage.toFixed(1)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="py-8 text-center text-gray-500">No page data available</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Simple SVG line chart for traffic data
 */
function TrafficChart({ data }: { data: any[] }) {
    if (!data.length) return null;

    const maxEvents = Math.max(...data.map(d => d.totalEvents), 1);
    const width = 100;
    const height = 100;
    const padding = 5;

    const points = data
        .map((d, i) => {
            const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
            const y = height - padding - (d.totalEvents / maxEvents) * (height - padding * 2);
            return `${x},${y}`;
        })
        .join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-blue-500"
                points={points}
            />
            {data.map((d, i) => {
                const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
                const y = height - padding - (d.totalEvents / maxEvents) * (height - padding * 2);
                return <circle key={i} cx={x} cy={y} r="1" className="fill-blue-500" />;
            })}
        </svg>
    );
}

// ============================================================================
// EVENTS PAGE
// ============================================================================

function VisitorEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        eventType: '',
        countryCode: '',
        deviceType: '',
        ipAddress: '',
        startDate: '',
        endDate: '',
    });

    const pageSize = 25;

    useEffect(() => {
        loadEvents();
    }, [page, filter]);

    async function loadEvents() {
        setLoading(true);
        try {
            const filterInput: any = {};
            if (filter.eventType) filterInput.eventType = filter.eventType;
            if (filter.countryCode) filterInput.countryCode = filter.countryCode;
            if (filter.deviceType) filterInput.deviceType = filter.deviceType;
            if (filter.ipAddress) filterInput.ipAddress = filter.ipAddress;
            if (filter.startDate) filterInput.startDate = new Date(filter.startDate).toISOString();
            if (filter.endDate) filterInput.endDate = new Date(filter.endDate).toISOString();

            const result = await api.query(GET_VISITOR_EVENTS, {
                filter: Object.keys(filterInput).length ? filterInput : undefined,
                skip: page * pageSize,
                take: pageSize,
            });

            setEvents(result.visitorEvents?.items || []);
            setTotalItems(result.visitorEvents?.totalItems || 0);

            if (!result.visitorEvents) {
                addVisitorDebugLog({
                    service: 'Events Query',
                    type: 'warning',
                    message: 'visitorEvents query returned null',
                    details: JSON.stringify({ filter: filterInput, page, pageSize }, null, 2),
                });
            }
        } catch (error: any) {
            console.error('Failed to load events:', error);
            addVisitorDebugLog({
                service: 'Events Query',
                type: 'error',
                message: `Failed to load events: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
        } finally {
            setLoading(false);
        }
    }

    const totalPages = Math.ceil(totalItems / pageSize);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="w-6 h-6" />
                        Event Log
                    </h1>
                    <p className="text-gray-500 mt-1">View and filter all visitor events</p>
                </div>
                <Button onClick={loadEvents} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Filter className="w-4 h-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <label className="text-sm text-gray-500">Event Type</label>
                            <select
                                value={filter.eventType}
                                onChange={e =>
                                    setFilter({ ...filter, eventType: e.target.value })
                                }
                                className="w-full px-3 py-2 border rounded-md mt-1"
                            >
                                <option value="">All</option>
                                <option value="page_view">Page View</option>
                                <option value="product_view">Product View</option>
                                <option value="search">Search</option>
                                <option value="add_to_cart">Add to Cart</option>
                                <option value="checkout">Checkout</option>
                                <option value="login">Login</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">Country</label>
                            <input
                                type="text"
                                value={filter.countryCode}
                                onChange={e =>
                                    setFilter({ ...filter, countryCode: e.target.value })
                                }
                                placeholder="US, GB..."
                                className="w-full px-3 py-2 border rounded-md mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">Device</label>
                            <select
                                value={filter.deviceType}
                                onChange={e =>
                                    setFilter({ ...filter, deviceType: e.target.value })
                                }
                                className="w-full px-3 py-2 border rounded-md mt-1"
                            >
                                <option value="">All</option>
                                <option value="desktop">Desktop</option>
                                <option value="mobile">Mobile</option>
                                <option value="tablet">Tablet</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">IP Address</label>
                            <input
                                type="text"
                                value={filter.ipAddress}
                                onChange={e => setFilter({ ...filter, ipAddress: e.target.value })}
                                placeholder="Search IP..."
                                className="w-full px-3 py-2 border rounded-md mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">Start Date</label>
                            <input
                                type="date"
                                value={filter.startDate}
                                onChange={e => setFilter({ ...filter, startDate: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">End Date</label>
                            <input
                                type="date"
                                value={filter.endDate}
                                onChange={e => setFilter({ ...filter, endDate: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md mt-1"
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setFilter({
                                    eventType: '',
                                    countryCode: '',
                                    deviceType: '',
                                    ipAddress: '',
                                    startDate: '',
                                    endDate: '',
                                });
                                setPage(0);
                            }}
                        >
                            Clear Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Events Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Event</TableHead>
                                <TableHead>Page</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Device</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead>Customer</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map(event => (
                                <TableRow key={event.id}>
                                    <TableCell className="whitespace-nowrap">
                                        {formatDateTime(event.eventTime)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                event.eventType === 'page_view'
                                                    ? 'secondary'
                                                    : 'default'
                                            }
                                        >
                                            {event.eventType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                                        {event.pagePath}
                                    </TableCell>
                                    <TableCell>
                                        {event.countryCode && (
                                            <span className="flex items-center gap-1">
                                                {countryFlag(event.countryCode)}
                                                <span className="text-xs">
                                                    {event.city || event.country}
                                                </span>
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1">
                                            <DeviceIcon type={event.deviceType} />
                                            <span className="text-xs">{event.browser}</span>
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {event.ipAddress}
                                    </TableCell>
                                    <TableCell>
                                        {event.customerId ? (
                                            <Badge variant="outline">#{event.customerId}</Badge>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {events.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        No events found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalItems)}{' '}
                        of {formatNumber(totalItems)}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="px-4">
                            Page {page + 1} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(page + 1)}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// SECURITY PAGE
// ============================================================================

function VisitorSecurityPage() {
    const [customerSearch, setCustomerSearch] = useState('');
    const [ipSearch, setIpSearch] = useState('');
    const [customerHistory, setCustomerHistory] = useState<any>(null);
    const [ipData, setIpData] = useState<any>(null);
    const [suspiciousReport, setSuspiciousReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSuspiciousReport();
    }, []);

    async function loadSuspiciousReport() {
        try {
            const result = await api.query(GET_SUSPICIOUS_ACTIVITY, {
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString(),
            });
            setSuspiciousReport(result.suspiciousActivityReport);

            if (!result.suspiciousActivityReport) {
                addVisitorDebugLog({
                    service: 'Security Query',
                    type: 'warning',
                    message: 'suspiciousActivityReport query returned null',
                });
            }
        } catch (error: any) {
            console.error('Failed to load suspicious activity:', error);
            addVisitorDebugLog({
                service: 'Security Query',
                type: 'error',
                message: `Failed to load suspicious activity: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
        }
    }

    async function searchCustomer() {
        if (!customerSearch) return;
        setLoading(true);
        try {
            const result = await api.query(GET_CUSTOMER_IP_HISTORY, {
                customerId: customerSearch,
            });
            setCustomerHistory(result.customerIPHistory);

            if (!result.customerIPHistory) {
                addVisitorDebugLog({
                    service: 'Security Query',
                    type: 'warning',
                    message: `No IP history found for customer ${customerSearch}`,
                });
            }
        } catch (error: any) {
            console.error('Failed to search customer:', error);
            addVisitorDebugLog({
                service: 'Security Query',
                type: 'error',
                message: `Failed to search customer ${customerSearch}: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
        } finally {
            setLoading(false);
        }
    }

    async function searchIP() {
        if (!ipSearch) return;
        setLoading(true);
        try {
            const result = await api.query(GET_CUSTOMERS_BY_IP, {
                ipAddress: ipSearch,
            });
            setIpData(result.customersByIP);

            if (!result.customersByIP) {
                addVisitorDebugLog({
                    service: 'Security Query',
                    type: 'warning',
                    message: `No data found for IP ${ipSearch}`,
                });
            }
        } catch (error: any) {
            console.error('Failed to search IP:', error);
            addVisitorDebugLog({
                service: 'Security Query',
                type: 'error',
                message: `Failed to search IP ${ipSearch}: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="w-6 h-6" />
                    Security & IP Analysis
                </h1>
                <p className="text-gray-500 mt-1">
                    Investigate customer activity and detect suspicious patterns
                </p>
            </div>

            {/* Suspicious Activity Summary */}
            {suspiciousReport && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Suspicious Activity (Last 7 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className="text-2xl font-bold">
                                    {suspiciousReport.totalAlerts}
                                </div>
                                <div className="text-sm text-gray-500">Total Alerts</div>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                                <div className="text-2xl font-bold text-red-600">
                                    {suspiciousReport.highSeverity}
                                </div>
                                <div className="text-sm text-gray-500">High</div>
                            </div>
                            <div className="text-center p-4 bg-amber-50 rounded-lg">
                                <div className="text-2xl font-bold text-amber-600">
                                    {suspiciousReport.mediumSeverity}
                                </div>
                                <div className="text-sm text-gray-500">Medium</div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">
                                    {suspiciousReport.lowSeverity}
                                </div>
                                <div className="text-sm text-gray-500">Low</div>
                            </div>
                        </div>

                        {suspiciousReport.entries?.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Severity</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Detected</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suspiciousReport.entries.slice(0, 10).map((entry: any, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        entry.severity === 'high'
                                                            ? 'destructive'
                                                            : entry.severity === 'medium'
                                                              ? 'default'
                                                              : 'secondary'
                                                    }
                                                >
                                                    {entry.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {entry.type}
                                            </TableCell>
                                            <TableCell>{entry.description}</TableCell>
                                            <TableCell>
                                                {formatDateTime(entry.detectedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Customer IP History Lookup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Customer IP History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={customerSearch}
                                onChange={e => setCustomerSearch(e.target.value)}
                                placeholder="Enter Customer ID..."
                                className="flex-1 px-3 py-2 border rounded-md"
                                onKeyDown={e => e.key === 'Enter' && searchCustomer()}
                            />
                            <Button onClick={searchCustomer} disabled={loading}>
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>

                        {customerHistory && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-500">
                                        {customerHistory.totalIPs} unique IPs from{' '}
                                        {customerHistory.countries?.join(', ')}
                                    </div>
                                    {customerHistory.suspicious && (
                                        <Badge variant="destructive">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Suspicious
                                        </Badge>
                                    )}
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>IP Address</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Events</TableHead>
                                            <TableHead>Last Seen</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customerHistory.ipEntries?.map((entry: any) => (
                                            <TableRow key={entry.ipAddress}>
                                                <TableCell className="font-mono text-xs">
                                                    {entry.ipAddress}
                                                </TableCell>
                                                <TableCell>
                                                    {entry.countryCode && countryFlag(entry.countryCode)}{' '}
                                                    {entry.city || entry.country}
                                                </TableCell>
                                                <TableCell>{entry.eventCount}</TableCell>
                                                <TableCell>
                                                    {formatDateTime(entry.lastSeen)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* IP to Customer Lookup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5" />
                            IP to Customer Lookup
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={ipSearch}
                                onChange={e => setIpSearch(e.target.value)}
                                placeholder="Enter IP Address..."
                                className="flex-1 px-3 py-2 border rounded-md"
                                onKeyDown={e => e.key === 'Enter' && searchIP()}
                            />
                            <Button onClick={searchIP} disabled={loading}>
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>

                        {ipData && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-500">
                                        {countryFlag(ipData.countryCode)} {ipData.city},{' '}
                                        {ipData.country} • {ipData.totalEvents} events
                                    </div>
                                    {ipData.suspicious && (
                                        <Badge variant="destructive">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Multi-Account
                                        </Badge>
                                    )}
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Events</TableHead>
                                            <TableHead>Last Seen</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ipData.customers?.map((customer: any) => (
                                            <TableRow key={customer.customerId}>
                                                <TableCell>#{customer.customerId}</TableCell>
                                                <TableCell>{customer.customerEmail || '-'}</TableCell>
                                                <TableCell>{customer.eventCount}</TableCell>
                                                <TableCell>
                                                    {formatDateTime(customer.lastSeen)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// SETUP PAGE (Documentation & Integration Guide)
// ============================================================================

function VisitorSetupPage() {
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const trackerInitCode = `// In your app's root component (e.g., root.tsx or _app.tsx)
import { useEffect } from 'react';
import { initTracker, trackPageView } from '~/utils/visitor-tracker';

export default function App() {
    useEffect(() => {
        // Initialize the tracker once on app load
        const tracker = initTracker({
            endpoint: '/shop-api',  // Your Vendure shop API endpoint
            flushInterval: 5000,    // Send events every 5 seconds
            batchSize: 10,          // Or when 10 events are queued
            debug: false,           // Set true for console logging
        });

        // Track initial page view
        trackPageView();

        // Cleanup on unmount
        return () => tracker.destroy();
    }, []);

    return <Outlet />;
}`;

    const pageViewCode = `// Track page views on route changes
import { useLocation } from '@remix-run/react';
import { trackPageView } from '~/utils/visitor-tracker';

function usePageTracking() {
    const location = useLocation();

    useEffect(() => {
        trackPageView({
            path: location.pathname,
            title: document.title,
        });
    }, [location.pathname]);
}`;

    const eventTrackingCode = `// Track custom events
import { getTracker, trackEvent } from '~/utils/visitor-tracker';

// Product view
getTracker()?.trackProductView('product-123', 'BMW M3 Stage 2 Tune');

// Search
getTracker()?.trackSearch('bmw m3', 42);

// Add to cart
getTracker()?.trackAddToCart('product-123', 1, 'variant-456');

// Checkout start
getTracker()?.trackCheckoutStart(299.99, 2);

// Order placed
getTracker()?.trackOrderPlaced('order-789', 599.98);

// Login/Register
getTracker()?.trackLogin('customer-123');
getTracker()?.trackRegister('customer-456');

// Custom event
trackEvent('custom_event', { key: 'value' });`;

    const apiConfigCode = `// vendure-config.ts
import { VisitorAnalyticsPlugin } from './plugins/visitor-analytics';

export const config: VendureConfig = {
    plugins: [
        VisitorAnalyticsPlugin.init({
            enabled: true,
            rateLimitPerMinute: 60,      // Max requests per IP per minute
            eventRetentionDays: 90,       // Auto-delete events older than 90 days
            geolocation: {
                provider: 'ip-api',       // Free: 45 req/min
                // provider: 'ipstack',   // Requires API key
                // apiKey: 'your-key',
                cacheTTLHours: 24,        // Cache geo lookups for 24 hours
            },
            excludeIPs: [
                '127.0.0.1',              // Localhost
                '192.168.*',              // Local network
            ],
            // Hooks for custom integrations
            hooks: {
                onSuspiciousActivity: async (data) => {
                    // Send alert email, Slack notification, etc.
                    console.log('Suspicious activity:', data);
                },
                onNewIPLogin: async (data) => {
                    // Trigger 2FA or send security email
                    console.log('New IP login:', data);
                },
            },
        }),
    ],
};`;

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="w-6 h-6" />
                    Tracker Setup Guide
                </h1>
                <p className="text-gray-500 mt-1">
                    Learn how to integrate visitor tracking into your storefront
                </p>
            </div>

            {/* Status Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Plugin Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-green-600 font-semibold">Active</div>
                            <div className="text-xs text-gray-500">Tracking Status</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-blue-600 font-semibold">ip-api</div>
                            <div className="text-xs text-gray-500">Geo Provider</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-purple-600 font-semibold">60/min</div>
                            <div className="text-xs text-gray-500">Rate Limit</div>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded-lg">
                            <div className="text-amber-600 font-semibold">90 days</div>
                            <div className="text-xs text-gray-500">Retention</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Start */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Start</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</div>
                        <div>
                            <h4 className="font-medium">Copy the tracker utility</h4>
                            <p className="text-sm text-gray-500">
                                The tracker file is located at <code className="bg-gray-100 px-1 rounded">website/app/utils/visitor-tracker.ts</code>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">2</div>
                        <div>
                            <h4 className="font-medium">Initialize in your app root</h4>
                            <p className="text-sm text-gray-500">
                                Add the initialization code to your root component (see below)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">3</div>
                        <div>
                            <h4 className="font-medium">Track events throughout your app</h4>
                            <p className="text-sm text-gray-500">
                                Use the provided methods to track page views, product views, searches, etc.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Initialization Code */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>1. Initialize Tracker</CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(trackerInitCode, 'init')}
                    >
                        {copied === 'init' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied === 'init' ? 'Copied!' : 'Copy'}
                    </Button>
                </CardHeader>
                <CardContent>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{trackerInitCode}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Page View Tracking */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>2. Track Page Views on Route Changes</CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(pageViewCode, 'pageview')}
                    >
                        {copied === 'pageview' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied === 'pageview' ? 'Copied!' : 'Copy'}
                    </Button>
                </CardHeader>
                <CardContent>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{pageViewCode}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Event Tracking */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>3. Track Custom Events</CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(eventTrackingCode, 'events')}
                    >
                        {copied === 'events' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied === 'events' ? 'Copied!' : 'Copy'}
                    </Button>
                </CardHeader>
                <CardContent>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{eventTrackingCode}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Plugin Configuration */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Plugin Configuration (Backend)</CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(apiConfigCode, 'config')}
                    >
                        {copied === 'config' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied === 'config' ? 'Copied!' : 'Copy'}
                    </Button>
                </CardHeader>
                <CardContent>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{apiConfigCode}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Event Types Reference */}
            <Card>
                <CardHeader>
                    <CardTitle>Supported Event Types</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event Type</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">page_view</code></TableCell>
                                <TableCell><code>trackPageView()</code></TableCell>
                                <TableCell>Track page loads and navigation</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">product_view</code></TableCell>
                                <TableCell><code>trackProductView()</code></TableCell>
                                <TableCell>Track product detail page views</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">search</code></TableCell>
                                <TableCell><code>trackSearch()</code></TableCell>
                                <TableCell>Track search queries and results</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">add_to_cart</code></TableCell>
                                <TableCell><code>trackAddToCart()</code></TableCell>
                                <TableCell>Track items added to cart</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">checkout_start</code></TableCell>
                                <TableCell><code>trackCheckoutStart()</code></TableCell>
                                <TableCell>Track checkout initiation</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">order_placed</code></TableCell>
                                <TableCell><code>trackOrderPlaced()</code></TableCell>
                                <TableCell>Track successful orders</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">login</code></TableCell>
                                <TableCell><code>trackLogin()</code></TableCell>
                                <TableCell>Track user logins</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">register</code></TableCell>
                                <TableCell><code>trackRegister()</code></TableCell>
                                <TableCell>Track new registrations</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">custom</code></TableCell>
                                <TableCell><code>track(type, data)</code></TableCell>
                                <TableCell>Track any custom event</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Geolocation Providers */}
            <Card>
                <CardHeader>
                    <CardTitle>Geolocation Providers</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Provider</TableHead>
                                <TableHead>Rate Limit</TableHead>
                                <TableHead>API Key</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell><code className="bg-blue-100 px-1 rounded">ip-api</code></TableCell>
                                <TableCell>45/min</TableCell>
                                <TableCell>Not required</TableCell>
                                <TableCell>Default, good for development and small sites</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">ipstack</code></TableCell>
                                <TableCell>Varies</TableCell>
                                <TableCell>Required</TableCell>
                                <TableCell>Paid service, higher limits available</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">maxmind</code></TableCell>
                                <TableCell>Unlimited</TableCell>
                                <TableCell>Local DB</TableCell>
                                <TableCell>Not yet implemented - coming soon</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><code className="bg-gray-100 px-1 rounded">none</code></TableCell>
                                <TableCell>N/A</TableCell>
                                <TableCell>N/A</TableCell>
                                <TableCell>Disable geolocation entirely</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// DEBUG LOGS PAGE - Enhanced with Service Info, Affected Areas, Debug Commands
// ============================================================================

function VisitorDebugLogsPage() {
    const [logs, setLogs] = useState<DebugLog[]>([]);
    const [filterService, setFilterService] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [selectedLog, setSelectedLog] = useState<DebugLog | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    function loadLogs() {
        setLogs(getVisitorDebugLogs());
    }

    function handleDelete(id: string) {
        deleteVisitorDebugLog(id);
        loadLogs();
        if (selectedLog?.id === id) setSelectedLog(null);
    }

    function handleClearAll() {
        clearVisitorDebugLogs();
        loadLogs();
        setShowClearConfirm(false);
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        setCopiedCommand(text);
        setTimeout(() => setCopiedCommand(null), 2000);
    }

    const filteredLogs = logs
        .filter(log => !filterService || log.service === filterService)
        .filter(log => !filterType || log.type === filterType)
        .sort((a, b) => b.lastOccurrence - a.lastOccurrence);

    const errorCount = logs.filter(l => l.type === 'error').length;
    const warningCount = logs.filter(l => l.type === 'warning').length;
    const infoCount = logs.filter(l => l.type === 'info').length;

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    function getTypeIcon(type: DebugLog['type']) {
        switch (type) {
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500" />;
        }
    }

    function getTypeBgColor(type: DebugLog['type']): string {
        switch (type) {
            case 'error': return 'bg-red-500/10 border-red-500/30';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
            case 'info': return 'bg-blue-500/10 border-blue-500/30';
        }
    }

    function getSeverityLabel(type: DebugLog['type']): string {
        switch (type) {
            case 'error': return 'Critical';
            case 'warning': return 'Warning';
            case 'info': return 'Informational';
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bug className="w-6 h-6" />
                        Debug Logs - Visitor Analytics
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Plugin operations, errors, and debugging information with contextual help
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={loadLogs}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowClearConfirm(true)}
                        disabled={logs.length === 0}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear All
                    </Button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-500">{errorCount} errors</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-500">{warningCount} warnings</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-500">{infoCount} info</span>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Filter:</span>
                        </div>
                        <select
                            value={filterService}
                            onChange={(e) => setFilterService(e.target.value)}
                            className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                        >
                            <option value="">All Services</option>
                            {VISITOR_SERVICES.map(service => (
                                <option key={service} value={service}>{service}</option>
                            ))}
                        </select>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                        >
                            <option value="">All Types</option>
                            <option value="error">Errors</option>
                            <option value="warning">Warnings</option>
                            <option value="info">Info</option>
                        </select>
                        {(filterService || filterType) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setFilterService(''); setFilterType(''); }}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Logs List */}
            <Card>
                <CardContent className="p-0">
                    {filteredLogs.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Bug className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium">No debug logs yet</p>
                            <p className="text-sm mt-1">
                                Logs will appear here when plugin operations are performed
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {filteredLogs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`p-4 ${getTypeBgColor(log.type)} border-l-4 ${
                                        log.type === 'error' ? 'border-l-red-500' :
                                        log.type === 'warning' ? 'border-l-yellow-500' :
                                        'border-l-blue-500'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {getTypeIcon(log.type)}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-sm">{log.service}</span>
                                                    {log.count > 1 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            x{log.count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-foreground/80 mt-1 break-words">
                                                    {log.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatTime(log.lastOccurrence)}</span>
                                                    {log.count > 1 && (
                                                        <span className="text-muted-foreground/60">
                                                            (first: {formatTime(log.firstOccurrence)})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedLog(log)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                View Report
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(log.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Enhanced Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <CardHeader className="border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {getTypeIcon(selectedLog.type)}
                                    <div>
                                        <CardTitle className="text-lg">{selectedLog.service} - Debug Report</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            {getSeverityLabel(selectedLog.type)} • {formatTime(selectedLog.lastOccurrence)}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Incident Overview */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">Severity</div>
                                    <div className={`font-semibold mt-1 ${
                                        selectedLog.type === 'error' ? 'text-red-500' :
                                        selectedLog.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                                    }`}>
                                        {getSeverityLabel(selectedLog.type)}
                                    </div>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">Occurrences</div>
                                    <div className="font-semibold mt-1">{selectedLog.count}x</div>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">First Seen</div>
                                    <div className="font-mono text-sm mt-1">{new Date(selectedLog.firstOccurrence).toLocaleTimeString()}</div>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">Last Seen</div>
                                    <div className="font-mono text-sm mt-1">{new Date(selectedLog.lastOccurrence).toLocaleTimeString()}</div>
                                </div>
                            </div>

                            {/* Error Message */}
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Terminal className="h-4 w-4" /> Error Message
                                </h3>
                                <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-300">
                                    <p>{selectedLog.message}</p>
                                </div>
                            </div>

                            {/* Technical Details */}
                            {selectedLog.details && (
                                <div>
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <FileCode className="h-4 w-4" /> Technical Details
                                    </h3>
                                    <pre className="bg-zinc-900 rounded-lg p-4 font-mono text-xs text-zinc-300 overflow-auto max-h-48 whitespace-pre-wrap">
                                        {selectedLog.details}
                                    </pre>
                                </div>
                            )}

                            {/* Service Information */}
                            {(() => {
                                const info = getVisitorServiceInfo(selectedLog.service);
                                return (
                                    <>
                                        <div>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <Server className="h-4 w-4" /> Service Details
                                            </h3>
                                            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                                <div>
                                                    <span className="text-xs text-muted-foreground uppercase">Description</span>
                                                    <p className="text-sm mt-1">{info.description}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-xs text-muted-foreground uppercase">Endpoint</span>
                                                        <p className="font-mono text-sm mt-1">{info.endpoint}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-muted-foreground uppercase">Dependencies</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {info.dependencies.map(dep => (
                                                                <Badge key={dep} variant="outline" className="text-xs">{dep}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {info.fileLocations.length > 0 && (
                                            <div>
                                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                    <FileCode className="h-4 w-4 text-cyan-500" /> Related Files
                                                </h3>
                                                <div className="bg-zinc-900 rounded-lg p-4 space-y-1">
                                                    {info.fileLocations.map((file, i) => (
                                                        <div key={i} className="font-mono text-sm text-cyan-400 flex items-center gap-2">
                                                            <span className="text-zinc-500">→</span> {file}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <AlertOctagon className="h-4 w-4 text-red-500" /> Affected Areas
                                            </h3>
                                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    This error may impact the following functionality:
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {info.affectedAreas.map(area => (
                                                        <Badge key={area} className="bg-red-500/20 text-red-400 border-red-500/30">
                                                            {area}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <Lightbulb className="h-4 w-4 text-yellow-500" /> Recommended Actions
                                            </h3>
                                            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
                                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                                    {info.recommendedActions.map((action, i) => (
                                                        <li key={i}>{action}</li>
                                                    ))}
                                                    {selectedLog.type === 'error' && (
                                                        <li className="text-red-400 font-medium">This is a critical error - address immediately</li>
                                                    )}
                                                </ol>
                                            </div>
                                        </div>

                                        {info.debugCommands.length > 0 && (
                                            <div>
                                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                    <Terminal className="h-4 w-4 text-cyan-500" /> Debug Commands
                                                </h3>
                                                <div className="bg-zinc-900 rounded-lg p-4 space-y-3">
                                                    {info.debugCommands.map((cmd, i) => (
                                                        <div key={i}>
                                                            <div className="text-zinc-400 text-xs mb-1"># {cmd.label}</div>
                                                            <div className="flex items-center gap-2">
                                                                <code className="text-green-400 flex-1 font-mono text-sm">{cmd.command}</code>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-2"
                                                                    onClick={() => copyToClipboard(cmd.command)}
                                                                >
                                                                    {copiedCommand === cmd.command ? (
                                                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                                                    ) : (
                                                                        <Copy className="h-3 w-3" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            <div className="flex justify-between items-center pt-4 border-t">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(selectedLog.id)}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete This Log
                                </Button>
                                <Button variant="default" size="sm" onClick={() => setSelectedLog(null)}>
                                    Close Report
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="font-semibold text-lg">Clear All Logs?</h3>
                        </div>
                        <p className="text-muted-foreground mb-6">
                            This will permanently delete all {logs.length} debug log entries. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleClearAll}>
                                Clear All
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// DASHBOARD EXTENSION DEFINITION
// ============================================================================

defineDashboardExtension({
    navSections: [
        {
            id: 'visitor-analytics',
            title: 'Analytics',
            icon: BarChart3,
            order: 80,
        },
    ],
    routes: [
        {
            path: '/visitor-dashboard',
            component: () => <VisitorDashboardPage />,
            navMenuItem: {
                sectionId: 'visitor-analytics',
                id: 'visitor-dashboard',
                title: 'Dashboard',
                icon: BarChart3,
            },
        },
        {
            path: '/visitor-events',
            component: () => <VisitorEventsPage />,
            navMenuItem: {
                sectionId: 'visitor-analytics',
                id: 'visitor-events',
                title: 'Events',
                icon: Activity,
            },
        },
        {
            path: '/visitor-security',
            component: () => <VisitorSecurityPage />,
            navMenuItem: {
                sectionId: 'visitor-analytics',
                id: 'visitor-security',
                title: 'Security',
                icon: Shield,
            },
        },
        {
            path: '/visitor-setup',
            component: () => <VisitorSetupPage />,
            navMenuItem: {
                sectionId: 'visitor-analytics',
                id: 'visitor-setup',
                title: 'Setup Guide',
                icon: Settings,
            },
        },
        {
            path: '/visitor-debug-logs',
            component: () => <VisitorDebugLogsPage />,
            navMenuItem: {
                sectionId: 'visitor-analytics',
                id: 'visitor-debug-logs',
                title: 'Debug Logs',
                icon: Bug,
            },
        },
    ],
});
