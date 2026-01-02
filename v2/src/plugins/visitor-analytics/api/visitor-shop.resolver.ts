/**
 * Shop API Resolver for Visitor Analytics
 *
 * Handles public tracking mutations for recording visitor events.
 * - Captures IP address server-side from request headers
 * - Extracts user agent for device detection
 * - Links to customer if authenticated
 * - Applies rate limiting to prevent abuse
 */

import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction } from '@vendure/core';
import { Request } from 'express';
import { Inject } from '@nestjs/common';
import { VisitorAnalyticsService } from '../services/visitor-analytics.service';
import {
    VISITOR_ANALYTICS_OPTIONS,
    VisitorAnalyticsOptions,
    RecordVisitorEventInput,
} from '../types';

/**
 * Simple in-memory rate limiter
 * Tracks request counts per IP with sliding window
 */
class RateLimiter {
    private requests: Map<string, { count: number; resetAt: number }> = new Map();

    constructor(private readonly limitPerMinute: number) {}

    isAllowed(ip: string): boolean {
        const now = Date.now();
        const entry = this.requests.get(ip);

        // Clean up old entries periodically
        if (this.requests.size > 10000) {
            this.cleanup(now);
        }

        if (!entry || entry.resetAt < now) {
            // Start new window
            this.requests.set(ip, { count: 1, resetAt: now + 60000 });
            return true;
        }

        if (entry.count >= this.limitPerMinute) {
            return false;
        }

        entry.count++;
        return true;
    }

    private cleanup(now: number): void {
        for (const [ip, entry] of this.requests.entries()) {
            if (entry.resetAt < now) {
                this.requests.delete(ip);
            }
        }
    }
}

@Resolver()
export class VisitorShopResolver {
    private rateLimiter: RateLimiter;

    constructor(
        private visitorAnalyticsService: VisitorAnalyticsService,
        @Inject(VISITOR_ANALYTICS_OPTIONS) private options: VisitorAnalyticsOptions,
    ) {
        this.rateLimiter = new RateLimiter(options.rateLimitPerMinute || 60);
    }

    /**
     * Record a single visitor event
     * Rate-limited by IP address
     */
    @Transaction()
    @Mutation()
    async recordVisitorEvent(
        @Ctx() ctx: RequestContext,
        @Args('input') input: RecordVisitorEventInput,
    ): Promise<{ success: boolean; eventId?: string; message?: string }> {
        // Check if tracking is enabled
        if (!this.options.enabled) {
            return { success: false, message: 'Visitor tracking is disabled' };
        }

        // Extract request info
        const req = ctx.req as Request;
        const ipAddress = this.extractIP(req);
        const userAgent = this.extractUserAgent(req);

        // Check rate limit
        if (!this.rateLimiter.isAllowed(ipAddress)) {
            return { success: false, message: 'Rate limit exceeded' };
        }

        // Check if IP is excluded
        if (this.isExcludedIP(ipAddress)) {
            return { success: true, message: 'IP excluded from tracking' };
        }

        // Check if user agent is excluded (bots, crawlers)
        if (this.isExcludedUserAgent(userAgent)) {
            return { success: true, message: 'User agent excluded from tracking' };
        }

        try {
            // Get customer ID if authenticated
            const customerId = ctx.activeUserId ? ctx.activeUserId : undefined;

            // Record the event
            const event = await this.visitorAnalyticsService.recordEvent(
                ctx,
                input,
                ipAddress,
                userAgent,
                customerId,
            );

            return {
                success: true,
                eventId: event.id.toString(),
            };
        } catch (error) {
            console.error('Failed to record visitor event:', error);
            return {
                success: false,
                message: 'Failed to record event',
            };
        }
    }

    /**
     * Record multiple visitor events in batch
     * Useful for offline/buffered event submission
     */
    @Transaction()
    @Mutation()
    async recordVisitorEventsBatch(
        @Ctx() ctx: RequestContext,
        @Args('events') events: RecordVisitorEventInput[],
    ): Promise<{ success: boolean; recorded: number; failed: number; errors: string[] }> {
        // Check if tracking is enabled
        if (!this.options.enabled) {
            return {
                success: false,
                recorded: 0,
                failed: events.length,
                errors: ['Visitor tracking is disabled'],
            };
        }

        // Extract request info
        const req = ctx.req as Request;
        const ipAddress = this.extractIP(req);
        const userAgent = this.extractUserAgent(req);

        // Check rate limit (counts as one request per batch)
        if (!this.rateLimiter.isAllowed(ipAddress)) {
            return {
                success: false,
                recorded: 0,
                failed: events.length,
                errors: ['Rate limit exceeded'],
            };
        }

        // Check exclusions
        if (this.isExcludedIP(ipAddress) || this.isExcludedUserAgent(userAgent)) {
            return {
                success: true,
                recorded: 0,
                failed: 0,
                errors: [],
            };
        }

        // Limit batch size to prevent abuse
        const maxBatchSize = 50;
        if (events.length > maxBatchSize) {
            events = events.slice(0, maxBatchSize);
        }

        try {
            const customerId = ctx.activeUserId ? ctx.activeUserId : undefined;

            const result = await this.visitorAnalyticsService.recordEventsBatch(
                ctx,
                events,
                ipAddress,
                userAgent,
                customerId,
            );

            return {
                success: true,
                recorded: result.recorded,
                failed: result.errors.length,
                errors: result.errors,
            };
        } catch (error) {
            console.error('Failed to record visitor events batch:', error);
            return {
                success: false,
                recorded: 0,
                failed: events.length,
                errors: ['Failed to record events'],
            };
        }
    }

    /**
     * Extract client IP address from request headers
     * Handles proxy/load balancer scenarios
     */
    private extractIP(req: Request): string {
        if (!req) return 'unknown';

        // Check common proxy headers
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
            const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
            return ips[0].trim();
        }

        // Check other common headers
        const realIP = req.headers['x-real-ip'];
        if (realIP) {
            return Array.isArray(realIP) ? realIP[0] : realIP;
        }

        // Cloudflare
        const cfIP = req.headers['cf-connecting-ip'];
        if (cfIP) {
            return Array.isArray(cfIP) ? cfIP[0] : cfIP;
        }

        // Fall back to socket address
        const socketAddress = req.socket?.remoteAddress;
        if (socketAddress) {
            // Handle IPv6 mapped IPv4 addresses
            if (socketAddress.startsWith('::ffff:')) {
                return socketAddress.substring(7);
            }
            return socketAddress;
        }

        return 'unknown';
    }

    /**
     * Extract user agent string from request
     */
    private extractUserAgent(req: Request): string {
        if (!req) return '';
        const ua = req.headers['user-agent'];
        return ua ? (Array.isArray(ua) ? ua[0] : ua) : '';
    }

    /**
     * Check if IP should be excluded from tracking
     */
    private isExcludedIP(ip: string): boolean {
        if (!this.options.excludeIPs || this.options.excludeIPs.length === 0) {
            return false;
        }

        return this.options.excludeIPs.some(pattern => {
            // Exact match
            if (pattern === ip) return true;

            // CIDR notation support (basic)
            if (pattern.includes('/')) {
                // For now, just check prefix
                const prefix = pattern.split('/')[0];
                return ip.startsWith(prefix.replace(/\.\d+$/, '.'));
            }

            // Wildcard support (e.g., 192.168.*)
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                return regex.test(ip);
            }

            return false;
        });
    }

    /**
     * Check if user agent should be excluded (bots, crawlers)
     */
    private isExcludedUserAgent(ua: string): boolean {
        if (!ua) return false;

        // Built-in bot detection
        const botPatterns = [
            /bot/i,
            /crawler/i,
            /spider/i,
            /scraper/i,
            /curl/i,
            /wget/i,
            /python-requests/i,
            /go-http-client/i,
            /java\//i,
            /headless/i,
            /phantom/i,
            /selenium/i,
            /puppeteer/i,
            /googlebot/i,
            /bingbot/i,
            /slurp/i,
            /duckduckbot/i,
            /baiduspider/i,
            /yandex/i,
            /facebookexternalhit/i,
            /twitterbot/i,
            /linkedinbot/i,
            /pinterest/i,
        ];

        // Check built-in patterns
        if (botPatterns.some(pattern => pattern.test(ua))) {
            return true;
        }

        // Check custom patterns from options
        if (this.options.excludeUserAgents && this.options.excludeUserAgents.length > 0) {
            return this.options.excludeUserAgents.some(pattern => pattern.test(ua));
        }

        return false;
    }
}
