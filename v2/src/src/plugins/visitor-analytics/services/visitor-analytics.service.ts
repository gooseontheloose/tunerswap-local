/**
 * VisitorAnalyticsService
 *
 * Core service for visitor event tracking and analytics.
 * Handles event recording, enrichment, and all dashboard queries.
 */

import { Injectable, Inject } from '@nestjs/common';
import { TransactionalConnection, RequestContext, ID, CustomerService } from '@vendure/core';
import { Between, LessThan, MoreThan, In, Like, IsNull, Not } from 'typeorm';
import { VisitorEvent } from '../entities/visitor-event.entity';
import { DailyAggregate } from '../entities/daily-aggregate.entity';
import { GeolocationService } from './geolocation.service';
import {
    VISITOR_ANALYTICS_OPTIONS,
    VisitorAnalyticsOptions,
    RecordVisitorEventInput,
    GetEventsOptions,
    DashboardStats,
    CountryVisitorData,
    DeviceBreakdown,
    TimeSeriesPoint,
    PageViewData,
    CustomerIPHistory,
    IPCustomerData,
    IPAccessRecord,
} from '../types';

@Injectable()
export class VisitorAnalyticsService {
    constructor(
        private connection: TransactionalConnection,
        private geolocationService: GeolocationService,
        private customerService: CustomerService,
        @Inject(VISITOR_ANALYTICS_OPTIONS) private options: VisitorAnalyticsOptions,
    ) {}

    // =========================================================================
    // EVENT RECORDING
    // =========================================================================

    /**
     * Record a visitor event with full enrichment (geolocation, device parsing)
     */
    async recordEvent(
        ctx: RequestContext,
        input: RecordVisitorEventInput,
        ipAddress: string,
        userAgent: string,
        customerId?: ID,
    ): Promise<VisitorEvent> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        // Check if tracking is enabled
        if (!this.options.enabled) {
            throw new Error('Visitor tracking is disabled');
        }

        // Check if IP should be excluded
        if (this.shouldExcludeIP(ipAddress)) {
            throw new Error('IP address excluded from tracking');
        }

        // Check if user agent should be excluded (bots)
        if (this.shouldExcludeUserAgent(userAgent)) {
            throw new Error('User agent excluded from tracking');
        }

        // Get geolocation data
        let geoData = null;
        let geoStatus = 'skipped';

        if (ipAddress && !this.geolocationService.isPrivateIP(ipAddress)) {
            try {
                geoData = await this.geolocationService.getGeolocation(ctx, ipAddress);
                geoStatus = geoData ? 'success' : 'failed';
            } catch (error) {
                geoStatus = 'failed';
            }
        } else if (this.geolocationService.isPrivateIP(ipAddress)) {
            geoStatus = 'private_ip';
        }

        // Parse user agent for device info
        const deviceInfo = this.geolocationService.parseUserAgent(userAgent);

        // Create event
        const event = new VisitorEvent({
            sessionId: input.sessionId,
            anonymousId: input.anonymousId,
            ipAddress,
            customerId: customerId || null,
            channelId: ctx.channelId,
            eventType: input.eventType,
            pagePath: input.pagePath,
            pageTitle: input.pageTitle,
            referrer: input.referrer,
            eventData: input.eventData,
            countryCode: geoData?.countryCode,
            country: geoData?.country,
            region: geoData?.region,
            city: geoData?.city,
            latitude: geoData?.latitude,
            longitude: geoData?.longitude,
            timezone: geoData?.timezone,
            geoStatus,
            deviceType: input.deviceType || deviceInfo.deviceType,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            userAgent,
            screenResolution: input.screenResolution,
            language: input.language,
            eventTime: new Date(),
        });

        const saved = await repo.save(event);

        // Trigger hooks if configured
        if (this.options.hooks?.onNewVisitor && input.eventType === 'page_view') {
            // Check if this is a new visitor (first event with this anonymousId)
            const existingCount = await repo.count({
                where: { anonymousId: input.anonymousId },
            });
            if (existingCount === 1) {
                this.options.hooks.onNewVisitor({
                    sessionId: input.sessionId,
                    ipAddress,
                    geolocation: geoData,
                    deviceInfo,
                    timestamp: new Date(),
                });
            }
        }

        return saved;
    }

    /**
     * Batch record multiple events
     */
    async recordEventsBatch(
        ctx: RequestContext,
        events: RecordVisitorEventInput[],
        ipAddress: string,
        userAgent: string,
        customerId?: ID,
    ): Promise<{ recorded: number; errors: string[] }> {
        let recorded = 0;
        const errors: string[] = [];

        for (const event of events) {
            try {
                await this.recordEvent(ctx, event, ipAddress, userAgent, customerId);
                recorded++;
            } catch (error) {
                errors.push(error instanceof Error ? error.message : 'Unknown error');
            }
        }

        return { recorded, errors };
    }

    // =========================================================================
    // DASHBOARD QUERIES
    // =========================================================================

    /**
     * Get summary statistics for dashboard cards
     * Returns fields matching the GraphQL VisitorDashboardStats type
     */
    async getDashboardStats(
        ctx: RequestContext,
        options: { startDate?: Date; endDate?: Date } = {},
    ): Promise<DashboardStats> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startDate = options.startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const endDate = options.endDate || now;

        // Total events in period
        const totalEvents = await repo.count({
            where: {
                eventTime: Between(startDate, endDate),
                channelId: ctx.channelId,
            },
        });

        // Today's events
        const todayEvents = await repo.count({
            where: {
                eventTime: MoreThan(todayStart),
                channelId: ctx.channelId,
            },
        });

        // Page views (page_view events only)
        const pageViews = await repo.count({
            where: {
                eventTime: Between(startDate, endDate),
                channelId: ctx.channelId,
                eventType: 'page_view',
            },
        });

        // Unique sessions
        const uniqueSessionsResult = await repo
            .createQueryBuilder('event')
            .select('COUNT(DISTINCT event.sessionId)', 'count')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .getRawOne();
        const uniqueSessions = parseInt(uniqueSessionsResult?.count || '0', 10);

        // Unique IPs
        const uniqueIPsResult = await repo
            .createQueryBuilder('event')
            .select('COUNT(DISTINCT event.ipAddress)', 'count')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('event.ipAddress IS NOT NULL')
            .getRawOne();
        const uniqueIPs = parseInt(uniqueIPsResult?.count || '0', 10);

        // Unique visitors (by anonymousId - persistent across sessions)
        const uniqueVisitorsResult = await repo
            .createQueryBuilder('event')
            .select('COUNT(DISTINCT event.anonymousId)', 'count')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .getRawOne();
        const uniqueVisitors = parseInt(uniqueVisitorsResult?.count || '0', 10);

        // Unique customers (authenticated users)
        const uniqueCustomersResult = await repo
            .createQueryBuilder('event')
            .select('COUNT(DISTINCT event.customerId)', 'count')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('event.customerId IS NOT NULL')
            .getRawOne();
        const uniqueCustomers = parseInt(uniqueCustomersResult?.count || '0', 10);

        // Authenticated events (events with customerId)
        const authenticatedEvents = await repo.count({
            where: {
                eventTime: Between(startDate, endDate),
                channelId: ctx.channelId,
                customerId: Not(IsNull()),
            },
        });

        // Anonymous events
        const anonymousEvents = totalEvents - authenticatedEvents;

        // Period comparison (previous period of same length)
        const periodLength = endDate.getTime() - startDate.getTime();
        const previousStart = new Date(startDate.getTime() - periodLength);
        const previousEnd = startDate;

        const previousPeriodEvents = await repo.count({
            where: {
                eventTime: Between(previousStart, previousEnd),
                channelId: ctx.channelId,
            },
        });

        const percentChange = previousPeriodEvents > 0
            ? Math.round(((totalEvents - previousPeriodEvents) / previousPeriodEvents) * 1000) / 10
            : totalEvents > 0 ? 100 : 0;

        return {
            totalEvents,
            todayEvents,
            pageViews,
            uniqueSessions,
            uniqueIPs,
            uniqueVisitors,
            uniqueCustomers,
            authenticatedEvents,
            anonymousEvents,
            percentChange,
        };
    }

    /**
     * Get paginated list of visitor events with filtering
     */
    async getEvents(
        ctx: RequestContext,
        options: GetEventsOptions = {},
    ): Promise<{ items: VisitorEvent[]; totalItems: number }> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        const where: any = { channelId: ctx.channelId };

        if (options.startDate && options.endDate) {
            where.eventTime = Between(options.startDate, options.endDate);
        } else if (options.startDate) {
            where.eventTime = MoreThan(options.startDate);
        } else if (options.endDate) {
            where.eventTime = LessThan(options.endDate);
        }

        if (options.eventType) {
            where.eventType = options.eventType;
        }

        if (options.countryCode) {
            where.countryCode = options.countryCode;
        }

        if (options.deviceType) {
            where.deviceType = options.deviceType;
        }

        if (options.hasCustomer === true) {
            where.customerId = Not(IsNull());
        } else if (options.hasCustomer === false) {
            where.customerId = IsNull();
        }

        if (options.ipAddress) {
            where.ipAddress = options.ipAddress;
        }

        if (options.sessionId) {
            where.sessionId = options.sessionId;
        }

        if (options.customerId) {
            where.customerId = options.customerId;
        }

        const [items, totalItems] = await repo.findAndCount({
            where,
            order: { eventTime: 'DESC' },
            skip: options.skip || 0,
            take: options.take || 50,
        });

        return { items, totalItems };
    }

    /**
     * Get visitor counts by country for heatmap/breakdown
     * Returns structure matching GraphQL CountryVisitorData type
     */
    async getVisitorsByCountry(
        ctx: RequestContext,
        options: { startDate?: Date; endDate?: Date } = {},
    ): Promise<CountryVisitorData[]> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = options.endDate || new Date();

        const results = await repo
            .createQueryBuilder('event')
            .select('event.countryCode', 'countryCode')
            .addSelect('event.country', 'country')
            .addSelect('COUNT(*)', 'totalEvents')
            .addSelect('COUNT(DISTINCT event.sessionId)', 'uniqueSessions')
            .addSelect('COUNT(DISTINCT event.anonymousId)', 'uniqueVisitors')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('event.countryCode IS NOT NULL')
            .groupBy('event.countryCode')
            .addGroupBy('event.country')
            .orderBy('totalEvents', 'DESC')
            .getRawMany();

        const total = results.reduce((sum, r) => sum + parseInt(r.totalEvents, 10), 0);

        return results.map(r => ({
            countryCode: r.countryCode,
            country: r.country || r.countryCode,
            totalEvents: parseInt(r.totalEvents, 10),
            uniqueSessions: parseInt(r.uniqueSessions, 10),
            uniqueVisitors: parseInt(r.uniqueVisitors, 10),
            percentage: total > 0 ? Math.round((parseInt(r.totalEvents, 10) / total) * 1000) / 10 : 0,
        }));
    }

    /**
     * Get device breakdown statistics
     * Returns structure matching GraphQL DeviceBreakdown type
     */
    async getDeviceBreakdown(
        ctx: RequestContext,
        options: { startDate?: Date; endDate?: Date } = {},
    ): Promise<DeviceBreakdown> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = options.endDate || new Date();

        // Device type breakdown
        const deviceResults = await repo
            .createQueryBuilder('event')
            .select('event.deviceType', 'deviceType')
            .addSelect('COUNT(*)', 'count')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .groupBy('event.deviceType')
            .orderBy('count', 'DESC')
            .getRawMany();

        const totalDevices = deviceResults.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

        // Browser breakdown
        const browserResults = await repo
            .createQueryBuilder('event')
            .select('event.browser', 'browser')
            .addSelect('COUNT(*)', 'count')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('event.browser IS NOT NULL')
            .groupBy('event.browser')
            .orderBy('count', 'DESC')
            .limit(10)
            .getRawMany();

        const totalBrowsers = browserResults.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

        // OS breakdown
        const osResults = await repo
            .createQueryBuilder('event')
            .select('event.os', 'os')
            .addSelect('COUNT(*)', 'count')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('event.os IS NOT NULL')
            .groupBy('event.os')
            .orderBy('count', 'DESC')
            .limit(10)
            .getRawMany();

        const totalOS = osResults.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

        return {
            devices: deviceResults.map(r => ({
                deviceType: r.deviceType || 'unknown',
                count: parseInt(r.count, 10),
                percentage: totalDevices > 0 ? Math.round((parseInt(r.count, 10) / totalDevices) * 1000) / 10 : 0,
            })),
            browsers: browserResults.map(r => ({
                browser: r.browser,
                count: parseInt(r.count, 10),
                percentage: totalBrowsers > 0 ? Math.round((parseInt(r.count, 10) / totalBrowsers) * 1000) / 10 : 0,
            })),
            operatingSystems: osResults.map(r => ({
                os: r.os,
                count: parseInt(r.count, 10),
                percentage: totalOS > 0 ? Math.round((parseInt(r.count, 10) / totalOS) * 1000) / 10 : 0,
            })),
        };
    }

    /**
     * Get traffic over time for charts
     * Returns structure matching GraphQL TrafficTimeSeriesPoint type
     */
    async getTrafficOverTime(
        ctx: RequestContext,
        options: {
            startDate: Date;
            endDate: Date;
            granularity?: 'hour' | 'day' | 'week' | 'month';
        },
    ): Promise<TimeSeriesPoint[]> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);
        const granularity = options.granularity || 'day';

        // Use SQLite-compatible date functions
        let dateFormat: string;
        switch (granularity) {
            case 'hour':
                dateFormat = '%Y-%m-%d %H:00:00';
                break;
            case 'day':
                dateFormat = '%Y-%m-%d';
                break;
            case 'week':
                dateFormat = '%Y-W%W';
                break;
            case 'month':
                dateFormat = '%Y-%m';
                break;
        }

        const results = await repo
            .createQueryBuilder('event')
            .select(`strftime('${dateFormat}', event.eventTime)`, 'period')
            .addSelect('COUNT(*)', 'totalEvents')
            .addSelect('SUM(CASE WHEN event.eventType = \'page_view\' THEN 1 ELSE 0 END)', 'pageViews')
            .addSelect('COUNT(DISTINCT event.sessionId)', 'uniqueSessions')
            .addSelect('COUNT(DISTINCT event.anonymousId)', 'uniqueVisitors')
            .where('event.eventTime BETWEEN :start AND :end', {
                start: options.startDate,
                end: options.endDate,
            })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .groupBy('period')
            .orderBy('period', 'ASC')
            .getRawMany();

        return results.map(r => ({
            timestamp: new Date(r.period),
            label: r.period,
            totalEvents: parseInt(r.totalEvents, 10),
            pageViews: parseInt(r.pageViews || '0', 10),
            uniqueSessions: parseInt(r.uniqueSessions, 10),
            uniqueVisitors: parseInt(r.uniqueVisitors, 10),
        }));
    }

    /**
     * Get top pages by view count
     */
    async getTopPages(
        ctx: RequestContext,
        options: { startDate?: Date; endDate?: Date; limit?: number } = {},
    ): Promise<PageViewData[]> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = options.endDate || new Date();
        const limit = options.limit || 10;

        const results = await repo
            .createQueryBuilder('event')
            .select('event.pagePath', 'pagePath')
            .addSelect('event.pageTitle', 'pageTitle')
            .addSelect('COUNT(*)', 'views')
            .addSelect('COUNT(DISTINCT event.sessionId)', 'uniqueVisitors')
            .where('event.eventTime BETWEEN :start AND :end', { start: startDate, end: endDate })
            .andWhere('event.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('event.pagePath IS NOT NULL')
            .andWhere('event.eventType = :type', { type: 'page_view' })
            .groupBy('event.pagePath')
            .addGroupBy('event.pageTitle')
            .orderBy('views', 'DESC')
            .limit(limit)
            .getRawMany();

        const totalViews = results.reduce((sum, r) => sum + parseInt(r.views, 10), 0);

        return results.map(r => {
            const views = parseInt(r.views, 10);
            return {
                pagePath: r.pagePath,
                pageTitle: r.pageTitle,
                views,
                uniqueVisitors: parseInt(r.uniqueVisitors, 10),
                percentage: totalViews > 0 ? Math.round((views / totalViews) * 1000) / 10 : 0,
            };
        });
    }

    // =========================================================================
    // SECURITY QUERIES
    // =========================================================================

    /**
     * Get IP history for a specific customer (security review)
     */
    async getCustomerIPHistory(ctx: RequestContext, customerId: ID): Promise<CustomerIPHistory> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        // Get customer details
        const customer = await this.customerService.findOne(ctx, customerId);
        const customerEmail = customer?.emailAddress || null;

        // Get all IPs used by this customer
        const results = await repo
            .createQueryBuilder('event')
            .select('event.ipAddress', 'ipAddress')
            .addSelect('event.country', 'country')
            .addSelect('event.city', 'city')
            .addSelect('MIN(event.eventTime)', 'firstSeen')
            .addSelect('MAX(event.eventTime)', 'lastSeen')
            .addSelect('COUNT(*)', 'visitCount')
            .where('event.customerId = :customerId', { customerId })
            .andWhere('event.ipAddress IS NOT NULL')
            .groupBy('event.ipAddress')
            .addGroupBy('event.country')
            .addGroupBy('event.city')
            .orderBy('lastSeen', 'DESC')
            .getRawMany();

        // Determine current IP (most recent)
        const currentIP = results.length > 0 ? results[0].ipAddress : null;

        const ips: IPAccessRecord[] = results.map(r => ({
            ipAddress: r.ipAddress,
            country: r.country,
            city: r.city,
            firstSeen: new Date(r.firstSeen),
            lastSeen: new Date(r.lastSeen),
            visitCount: parseInt(r.visitCount, 10),
            isCurrent: r.ipAddress === currentIP,
        }));

        // Check for suspicious patterns
        let flagged = false;
        let flagReason: string | null = null;

        // Flag if more than 5 different countries
        const uniqueCountries = new Set(ips.filter(ip => ip.country).map(ip => ip.country));
        if (uniqueCountries.size > 5) {
            flagged = true;
            flagReason = `Accessed from ${uniqueCountries.size} different countries`;
        }

        // Flag if more than 20 unique IPs in last 30 days
        const recentIPs = ips.filter(ip => {
            const daysSince = (Date.now() - ip.lastSeen.getTime()) / (24 * 60 * 60 * 1000);
            return daysSince <= 30;
        });
        if (recentIPs.length > 20) {
            flagged = true;
            flagReason = `${recentIPs.length} unique IPs in the last 30 days`;
        }

        return {
            customerId,
            customerEmail,
            ips,
            totalUniqueIPs: ips.length,
            flagged,
            flagReason,
        };
    }

    /**
     * Get all customers who have used a specific IP (fraud detection)
     */
    async getCustomersByIP(ctx: RequestContext, ipAddress: string): Promise<IPCustomerData> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);

        // Get geolocation for this IP
        const geoData = await this.geolocationService.getGeolocation(ctx, ipAddress);

        // Get all customers who have used this IP
        const results = await repo
            .createQueryBuilder('event')
            .select('event.customerId', 'customerId')
            .addSelect('MIN(event.eventTime)', 'firstSeen')
            .addSelect('MAX(event.eventTime)', 'lastSeen')
            .addSelect('COUNT(*)', 'visitCount')
            .where('event.ipAddress = :ip', { ip: ipAddress })
            .andWhere('event.customerId IS NOT NULL')
            .groupBy('event.customerId')
            .orderBy('lastSeen', 'DESC')
            .getRawMany();

        // Enrich with customer details
        const customers = await Promise.all(
            results.map(async r => {
                const customer = await this.customerService.findOne(ctx, r.customerId);
                return {
                    customerId: r.customerId,
                    email: customer?.emailAddress || 'Unknown',
                    firstName: customer?.firstName || null,
                    lastName: customer?.lastName || null,
                    firstSeen: new Date(r.firstSeen),
                    lastSeen: new Date(r.lastSeen),
                    visitCount: parseInt(r.visitCount, 10),
                };
            }),
        );

        // Flag if more than 3 customers share this IP
        const flagged = customers.length > 3;
        const flagReason = flagged ? `${customers.length} different customer accounts used this IP` : null;

        return {
            ipAddress,
            geolocation: geoData,
            customers,
            totalCustomers: customers.length,
            flagged,
            flagReason,
        };
    }

    // =========================================================================
    // CLEANUP & MAINTENANCE
    // =========================================================================

    /**
     * Delete old events beyond retention period
     */
    async cleanupOldEvents(ctx: RequestContext, retentionDays?: number): Promise<{ deleted: number }> {
        const repo = this.connection.getRepository(ctx, VisitorEvent);
        const days = retentionDays || this.options.eventRetentionDays;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const result = await repo.delete({
            eventTime: LessThan(cutoffDate),
        });

        return { deleted: result.affected || 0 };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Check if IP should be excluded from tracking
     */
    private shouldExcludeIP(ipAddress: string): boolean {
        if (!this.options.excludeIPs || this.options.excludeIPs.length === 0) {
            return false;
        }

        return this.options.excludeIPs.some(excluded => {
            // Exact match
            if (excluded === ipAddress) return true;
            // CIDR range matching could be added here
            return false;
        });
    }

    /**
     * Check if user agent should be excluded (bots)
     */
    private shouldExcludeUserAgent(userAgent: string): boolean {
        if (!this.options.excludeUserAgentPatterns || this.options.excludeUserAgentPatterns.length === 0) {
            return false;
        }

        const ua = userAgent.toLowerCase();
        return this.options.excludeUserAgentPatterns.some(pattern =>
            ua.includes(pattern.toLowerCase()),
        );
    }

    /**
     * Get the event repository for custom queries (used by admin resolver)
     */
    getEventRepository(ctx: RequestContext) {
        return this.connection.getRepository(ctx, VisitorEvent);
    }
}
