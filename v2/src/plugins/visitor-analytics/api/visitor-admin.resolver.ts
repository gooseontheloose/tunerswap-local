/**
 * Admin API Resolver for Visitor Analytics
 *
 * Handles admin-only analytics queries protected by permissions:
 * - VisitorAnalyticsRead: Basic stats and aggregated data
 * - VisitorAnalyticsSecurity: Raw IP data and customer correlation
 * - VisitorAnalyticsManage: Cleanup and settings operations
 */

import { Args, Query, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction, Allow, Permission } from '@vendure/core';
import { VisitorAnalyticsService } from '../services/visitor-analytics.service';
import { GeolocationService } from '../services/geolocation.service';
import {
    VisitorAnalyticsRead,
    VisitorAnalyticsSecurity,
    VisitorAnalyticsManage,
} from '../permissions';
import {
    DashboardStats,
    CountryVisitorData,
    DeviceBreakdown,
    TimeSeriesPoint,
    PageViewData,
    CustomerIPHistory,
    IPCustomerData,
} from '../types';
import { VisitorEvent } from '../entities/visitor-event.entity';

interface VisitorEventFilterInput {
    eventType?: string;
    countryCode?: string;
    deviceType?: string;
    browser?: string;
    ipAddress?: string;
    customerId?: string;
    sessionId?: string;
    anonymousId?: string;
    pagePath?: string;
    authenticatedOnly?: boolean;
    startDate?: Date;
    endDate?: Date;
}

interface VisitorEventSortInput {
    field: string;
    direction: string;
}

@Resolver()
export class VisitorAdminResolver {
    constructor(
        private visitorAnalyticsService: VisitorAnalyticsService,
        private geolocationService: GeolocationService,
    ) {}

    // =========================================================================
    // DASHBOARD QUERIES
    // =========================================================================

    /**
     * Get dashboard overview statistics
     */
    @Allow(VisitorAnalyticsRead)
    @Query()
    async visitorDashboardStats(
        @Ctx() ctx: RequestContext,
        @Args('startDate') startDate?: Date,
        @Args('endDate') endDate?: Date,
        @Args('channelId') _channelId?: string,
    ): Promise<DashboardStats> {
        return this.visitorAnalyticsService.getDashboardStats(ctx, {
            startDate,
            endDate,
        });
    }

    /**
     * Get paginated list of visitor events
     */
    @Allow(VisitorAnalyticsRead)
    @Query()
    async visitorEvents(
        @Ctx() ctx: RequestContext,
        @Args('filter') filter?: VisitorEventFilterInput,
        @Args('sort') _sort?: VisitorEventSortInput,
        @Args('skip') skip?: number,
        @Args('take') take?: number,
    ): Promise<{ items: VisitorEvent[]; totalItems: number }> {
        // Map GraphQL filter to service options
        return this.visitorAnalyticsService.getEvents(ctx, {
            skip: skip || 0,
            take: take || 50,
            startDate: filter?.startDate,
            endDate: filter?.endDate,
            eventType: filter?.eventType,
            countryCode: filter?.countryCode,
            deviceType: filter?.deviceType,
            ipAddress: filter?.ipAddress,
            sessionId: filter?.sessionId,
            customerId: filter?.customerId,
            hasCustomer: filter?.authenticatedOnly,
        });
    }

    /**
     * Get visitor breakdown by country
     */
    @Allow(VisitorAnalyticsRead)
    @Query()
    async visitorsByCountry(
        @Ctx() ctx: RequestContext,
        @Args('startDate') startDate?: Date,
        @Args('endDate') endDate?: Date,
        @Args('limit') _limit?: number,
    ): Promise<CountryVisitorData[]> {
        return this.visitorAnalyticsService.getVisitorsByCountry(ctx, {
            startDate,
            endDate,
        });
    }

    /**
     * Get device/browser/OS breakdown
     */
    @Allow(VisitorAnalyticsRead)
    @Query()
    async visitorDeviceBreakdown(
        @Ctx() ctx: RequestContext,
        @Args('startDate') startDate?: Date,
        @Args('endDate') endDate?: Date,
    ): Promise<DeviceBreakdown> {
        return this.visitorAnalyticsService.getDeviceBreakdown(ctx, {
            startDate,
            endDate,
        });
    }

    /**
     * Get traffic over time
     */
    @Allow(VisitorAnalyticsRead)
    @Query()
    async visitorTrafficOverTime(
        @Ctx() ctx: RequestContext,
        @Args('startDate') startDate: Date,
        @Args('endDate') endDate: Date,
        @Args('granularity') granularity?: string,
    ): Promise<TimeSeriesPoint[]> {
        return this.visitorAnalyticsService.getTrafficOverTime(ctx, {
            startDate,
            endDate,
            granularity: granularity as 'hour' | 'day' | 'week' | 'month' || 'day',
        });
    }

    /**
     * Get top pages by views
     */
    @Allow(VisitorAnalyticsRead)
    @Query()
    async visitorTopPages(
        @Ctx() ctx: RequestContext,
        @Args('startDate') startDate?: Date,
        @Args('endDate') endDate?: Date,
        @Args('limit') limit?: number,
    ): Promise<PageViewData[]> {
        return this.visitorAnalyticsService.getTopPages(ctx, {
            startDate,
            endDate,
            limit: limit || 20,
        });
    }

    // =========================================================================
    // SECURITY QUERIES (requires VisitorAnalyticsSecurity permission)
    // =========================================================================

    /**
     * Get IP history for a specific customer
     * Useful for security review and detecting suspicious activity
     */
    @Allow(VisitorAnalyticsSecurity)
    @Query()
    async customerIPHistory(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: string,
    ): Promise<CustomerIPHistory> {
        return this.visitorAnalyticsService.getCustomerIPHistory(ctx, customerId);
    }

    /**
     * Get customers associated with an IP address
     * Useful for detecting multi-account abuse
     */
    @Allow(VisitorAnalyticsSecurity)
    @Query()
    async customersByIP(
        @Ctx() ctx: RequestContext,
        @Args('ipAddress') ipAddress: string,
    ): Promise<IPCustomerData> {
        return this.visitorAnalyticsService.getCustomersByIP(ctx, ipAddress);
    }

    /**
     * Get suspicious activity report
     * Detects anomalies like rapid geo changes, multi-account IPs, etc.
     */
    @Allow(VisitorAnalyticsSecurity)
    @Query()
    async suspiciousActivityReport(
        @Ctx() ctx: RequestContext,
        @Args('startDate') startDate?: Date,
        @Args('endDate') endDate?: Date,
    ): Promise<{
        totalAlerts: number;
        highSeverity: number;
        mediumSeverity: number;
        lowSeverity: number;
        entries: Array<{
            type: string;
            description: string;
            severity: string;
            ipAddress?: string;
            customerId?: string;
            details?: any;
            detectedAt: Date;
        }>;
    }> {
        // Generate suspicious activity report by analyzing events
        const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate || new Date();

        const entries: Array<{
            type: string;
            description: string;
            severity: string;
            ipAddress?: string;
            customerId?: string;
            details?: any;
            detectedAt: Date;
        }> = [];

        // 1. Find IPs with multiple customer accounts
        const multiAccountIPs = await this.findMultiAccountIPs(ctx, start, end);
        for (const ip of multiAccountIPs) {
            if (ip.customerCount >= 5) {
                entries.push({
                    type: 'multi_account_ip',
                    description: `IP ${ip.ipAddress} has ${ip.customerCount} different customer accounts`,
                    severity: ip.customerCount >= 10 ? 'high' : 'medium',
                    ipAddress: ip.ipAddress,
                    details: { customerCount: ip.customerCount, country: ip.country },
                    detectedAt: new Date(),
                });
            }
        }

        // 2. Find customers with rapid geo changes
        const rapidGeoChanges = await this.findRapidGeoChanges(ctx, start, end);
        for (const change of rapidGeoChanges) {
            entries.push({
                type: 'rapid_geo_change',
                description: `Customer changed location from ${change.fromCountry} to ${change.toCountry} in ${change.hoursApart} hours`,
                severity: change.hoursApart < 1 ? 'high' : 'medium',
                customerId: change.customerId,
                details: {
                    fromCountry: change.fromCountry,
                    toCountry: change.toCountry,
                    hoursApart: change.hoursApart,
                },
                detectedAt: new Date(change.detectedAt),
            });
        }

        // 3. Find unusually high activity from single IP
        const highActivityIPs = await this.findHighActivityIPs(ctx, start, end);
        for (const ip of highActivityIPs) {
            if (ip.eventCount >= 10000) {
                entries.push({
                    type: 'high_activity_ip',
                    description: `IP ${ip.ipAddress} has ${ip.eventCount} events (possible bot/scraper)`,
                    severity: ip.eventCount >= 50000 ? 'high' : 'low',
                    ipAddress: ip.ipAddress,
                    details: { eventCount: ip.eventCount, country: ip.country },
                    detectedAt: new Date(),
                });
            }
        }

        // Sort by severity
        const severityOrder = { high: 0, medium: 1, low: 2 };
        entries.sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]);

        return {
            totalAlerts: entries.length,
            highSeverity: entries.filter(e => e.severity === 'high').length,
            mediumSeverity: entries.filter(e => e.severity === 'medium').length,
            lowSeverity: entries.filter(e => e.severity === 'low').length,
            entries,
        };
    }

    // =========================================================================
    // ADMIN MUTATIONS
    // =========================================================================

    /**
     * Clean up old visitor events
     */
    @Allow(VisitorAnalyticsManage)
    @Transaction()
    @Mutation()
    async cleanupVisitorEvents(
        @Ctx() ctx: RequestContext,
        @Args('olderThanDays') olderThanDays?: number,
    ): Promise<{ success: boolean; deleted: number; message?: string }> {
        try {
            const result = await this.visitorAnalyticsService.cleanupOldEvents(
                ctx,
                olderThanDays,
            );
            return {
                success: true,
                deleted: result.deleted,
                message: `Deleted ${result.deleted} events older than ${olderThanDays || 90} days`,
            };
        } catch (error) {
            console.error('Failed to cleanup visitor events:', error);
            return {
                success: false,
                deleted: 0,
                message: 'Cleanup failed',
            };
        }
    }

    /**
     * Clean up expired geolocation cache entries
     */
    @Allow(VisitorAnalyticsManage)
    @Transaction()
    @Mutation()
    async cleanupGeolocationCache(
        @Ctx() ctx: RequestContext,
    ): Promise<{ success: boolean; deleted: number; message?: string }> {
        try {
            const result = await this.geolocationService.cleanupExpiredCache(ctx);
            return {
                success: true,
                deleted: result.deleted,
                message: `Deleted ${result.deleted} expired cache entries`,
            };
        } catch (error) {
            console.error('Failed to cleanup geolocation cache:', error);
            return {
                success: false,
                deleted: 0,
                message: 'Cleanup failed',
            };
        }
    }

    // =========================================================================
    // HELPER METHODS FOR SUSPICIOUS ACTIVITY DETECTION
    // =========================================================================

    /**
     * Find IPs associated with multiple customer accounts
     */
    private async findMultiAccountIPs(
        ctx: RequestContext,
        startDate: Date,
        endDate: Date,
    ): Promise<Array<{ ipAddress: string; customerCount: number; country?: string }>> {
        const repo = this.visitorAnalyticsService.getEventRepository(ctx);

        const results = await repo
            .createQueryBuilder('event')
            .select('event.ipAddress', 'ipAddress')
            .addSelect('event.country', 'country')
            .addSelect('COUNT(DISTINCT event.customerId)', 'customerCount')
            .where('event.eventTime >= :startDate', { startDate })
            .andWhere('event.eventTime <= :endDate', { endDate })
            .andWhere('event.customerId IS NOT NULL')
            .andWhere('event.ipAddress IS NOT NULL')
            .groupBy('event.ipAddress')
            .addGroupBy('event.country')
            .having('COUNT(DISTINCT event.customerId) >= 3')
            .orderBy('customerCount', 'DESC')
            .limit(100)
            .getRawMany();

        return results.map(r => ({
            ipAddress: r.ipAddress,
            customerCount: parseInt(r.customerCount, 10),
            country: r.country,
        }));
    }

    /**
     * Find customers with rapid geographical changes
     * (e.g., login from US then UK within an hour - physically impossible)
     */
    private async findRapidGeoChanges(
        ctx: RequestContext,
        startDate: Date,
        endDate: Date,
    ): Promise<Array<{
        customerId: string;
        fromCountry: string;
        toCountry: string;
        hoursApart: number;
        detectedAt: string;
    }>> {
        // This is a simplified version - a production implementation would be more sophisticated
        const repo = this.visitorAnalyticsService.getEventRepository(ctx);

        // Get events with country changes for authenticated users
        const events = await repo
            .createQueryBuilder('event')
            .select([
                'event.customerId',
                'event.countryCode',
                'event.country',
                'event.eventTime',
            ])
            .where('event.eventTime >= :startDate', { startDate })
            .andWhere('event.eventTime <= :endDate', { endDate })
            .andWhere('event.customerId IS NOT NULL')
            .andWhere('event.countryCode IS NOT NULL')
            .orderBy('event.customerId', 'ASC')
            .addOrderBy('event.eventTime', 'ASC')
            .getMany();

        const results: Array<{
            customerId: string;
            fromCountry: string;
            toCountry: string;
            hoursApart: number;
            detectedAt: string;
        }> = [];

        // Group by customer and detect rapid changes
        let currentCustomer: string | null = null;
        let lastCountry: string | null = null;
        let lastTime: Date | null = null;

        for (const event of events) {
            if (event.customerId?.toString() !== currentCustomer) {
                // New customer
                currentCustomer = event.customerId?.toString() || null;
                lastCountry = event.countryCode;
                lastTime = event.eventTime;
                continue;
            }

            if (event.countryCode && event.countryCode !== lastCountry && lastTime) {
                // Country changed - check time difference
                const hoursApart = (event.eventTime.getTime() - lastTime.getTime()) / (1000 * 60 * 60);

                // Flag if different country within 6 hours (physically unlikely)
                if (hoursApart < 6) {
                    results.push({
                        customerId: currentCustomer!,
                        fromCountry: lastCountry || 'Unknown',
                        toCountry: event.country || event.countryCode,
                        hoursApart: Math.round(hoursApart * 10) / 10,
                        detectedAt: event.eventTime.toISOString(),
                    });
                }
            }

            lastCountry = event.countryCode;
            lastTime = event.eventTime;
        }

        return results.slice(0, 50); // Limit results
    }

    /**
     * Find IPs with unusually high activity (potential bots/scrapers)
     */
    private async findHighActivityIPs(
        ctx: RequestContext,
        startDate: Date,
        endDate: Date,
    ): Promise<Array<{ ipAddress: string; eventCount: number; country?: string }>> {
        const repo = this.visitorAnalyticsService.getEventRepository(ctx);

        const results = await repo
            .createQueryBuilder('event')
            .select('event.ipAddress', 'ipAddress')
            .addSelect('event.country', 'country')
            .addSelect('COUNT(*)', 'eventCount')
            .where('event.eventTime >= :startDate', { startDate })
            .andWhere('event.eventTime <= :endDate', { endDate })
            .andWhere('event.ipAddress IS NOT NULL')
            .groupBy('event.ipAddress')
            .addGroupBy('event.country')
            .having('COUNT(*) >= 5000')
            .orderBy('eventCount', 'DESC')
            .limit(50)
            .getRawMany();

        return results.map(r => ({
            ipAddress: r.ipAddress,
            eventCount: parseInt(r.eventCount, 10),
            country: r.country,
        }));
    }
}
