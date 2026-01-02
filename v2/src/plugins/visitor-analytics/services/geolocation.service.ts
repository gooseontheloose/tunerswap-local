/**
 * GeolocationService
 *
 * Handles IP-to-geolocation resolution with caching and user agent parsing.
 * Uses ip-api.com (free tier: 45 requests/minute) by default.
 */

import { Injectable, Inject } from '@nestjs/common';
import { TransactionalConnection, RequestContext } from '@vendure/core';
import { LessThan, MoreThan } from 'typeorm';
import { IPGeolocationCache } from '../entities/ip-geolocation-cache.entity';
import {
    VISITOR_ANALYTICS_OPTIONS,
    VisitorAnalyticsOptions,
    GeolocationData,
    DeviceInfo,
} from '../types';

@Injectable()
export class GeolocationService {
    constructor(
        private connection: TransactionalConnection,
        @Inject(VISITOR_ANALYTICS_OPTIONS) private options: VisitorAnalyticsOptions,
    ) {}

    /**
     * Get geolocation data for an IP address.
     * Checks cache first, then queries external provider if not cached or expired.
     */
    async getGeolocation(ctx: RequestContext, ipAddress: string): Promise<GeolocationData | null> {
        // Skip if geolocation is disabled
        if (this.options.geolocation.provider === 'none') {
            return null;
        }

        // Normalize and validate IP
        const normalizedIP = this.normalizeIP(ipAddress);
        if (!normalizedIP) {
            return null;
        }

        // Skip private/local IPs
        if (this.isPrivateIP(normalizedIP)) {
            return null;
        }

        // Check cache first
        const cached = await this.getCachedGeolocation(ctx, normalizedIP);
        if (cached) {
            return cached;
        }

        // Query external provider
        const geoData = await this.fetchGeolocation(normalizedIP);

        // Cache the result (even failures, to avoid repeated API calls)
        await this.cacheGeolocation(ctx, normalizedIP, geoData);

        return geoData;
    }

    /**
     * Get cached geolocation if available and not expired
     */
    private async getCachedGeolocation(ctx: RequestContext, ipAddress: string): Promise<GeolocationData | null> {
        const repo = this.connection.getRepository(ctx, IPGeolocationCache);

        const cached = await repo.findOne({
            where: {
                ipAddress,
                expiresAt: MoreThan(new Date()),
                success: true,
            },
        });

        if (cached) {
            return {
                countryCode: cached.countryCode,
                country: cached.country,
                region: cached.region,
                city: cached.city,
                latitude: cached.latitude,
                longitude: cached.longitude,
                timezone: cached.timezone,
                isp: cached.isp,
            };
        }

        return null;
    }

    /**
     * Cache geolocation result
     */
    private async cacheGeolocation(
        ctx: RequestContext,
        ipAddress: string,
        geoData: GeolocationData | null,
    ): Promise<void> {
        const repo = this.connection.getRepository(ctx, IPGeolocationCache);

        // Calculate expiration
        const ttlHours = this.options.geolocation.cacheTTLHours || 24;
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

        // Upsert cache entry
        const existing = await repo.findOne({ where: { ipAddress } });

        if (existing) {
            // Update existing
            await repo.update(existing.id, {
                countryCode: geoData?.countryCode ?? undefined,
                country: geoData?.country ?? undefined,
                region: geoData?.region ?? undefined,
                city: geoData?.city ?? undefined,
                latitude: geoData?.latitude ?? undefined,
                longitude: geoData?.longitude ?? undefined,
                timezone: geoData?.timezone ?? undefined,
                isp: geoData?.isp ?? undefined,
                expiresAt,
                success: !!geoData,
                source: this.options.geolocation.provider,
            });
        } else {
            // Create new
            const cache = new IPGeolocationCache({
                ipAddress,
                countryCode: geoData?.countryCode ?? undefined,
                country: geoData?.country ?? undefined,
                region: geoData?.region ?? undefined,
                city: geoData?.city ?? undefined,
                latitude: geoData?.latitude ?? undefined,
                longitude: geoData?.longitude ?? undefined,
                timezone: geoData?.timezone ?? undefined,
                isp: geoData?.isp ?? undefined,
                expiresAt,
                success: !!geoData,
                source: this.options.geolocation.provider,
            });
            await repo.save(cache);
        }
    }

    /**
     * Fetch geolocation from external provider
     */
    private async fetchGeolocation(ipAddress: string): Promise<GeolocationData | null> {
        try {
            switch (this.options.geolocation.provider) {
                case 'ip-api':
                    return await this.fetchFromIPApi(ipAddress);
                case 'ipstack':
                    return await this.fetchFromIPStack(ipAddress);
                case 'maxmind':
                    // MaxMind requires local database - not implemented yet
                    console.warn('MaxMind provider not implemented, falling back to ip-api');
                    return await this.fetchFromIPApi(ipAddress);
                default:
                    return null;
            }
        } catch (error) {
            console.error('Geolocation lookup failed:', error);
            return null;
        }
    }

    /**
     * Fetch from ip-api.com (free tier: 45 requests/minute)
     * http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,as
     */
    private async fetchFromIPApi(ipAddress: string): Promise<GeolocationData | null> {
        const url = `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,as`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'fail') {
            console.warn(`ip-api lookup failed for ${ipAddress}: ${data.message}`);
            return null;
        }

        return {
            countryCode: data.countryCode,
            country: data.country,
            region: data.regionName || data.region,
            city: data.city,
            latitude: data.lat,
            longitude: data.lon,
            timezone: data.timezone,
            isp: data.isp,
        };
    }

    /**
     * Fetch from ipstack.com (requires API key)
     */
    private async fetchFromIPStack(ipAddress: string): Promise<GeolocationData | null> {
        const apiKey = this.options.geolocation.apiKey;
        if (!apiKey) {
            console.error('IPStack API key not configured');
            return null;
        }

        const url = `http://api.ipstack.com/${ipAddress}?access_key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.warn(`ipstack lookup failed for ${ipAddress}: ${data.error.info}`);
            return null;
        }

        return {
            countryCode: data.country_code,
            country: data.country_name,
            region: data.region_name,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.time_zone?.id,
            isp: data.connection?.isp,
        };
    }

    /**
     * Parse user agent string into device information
     */
    parseUserAgent(userAgent: string): DeviceInfo {
        if (!userAgent) {
            return {
                deviceType: 'unknown',
                browser: 'Unknown',
                browserVersion: '',
                os: 'Unknown',
                osVersion: '',
            };
        }

        const ua = userAgent.toLowerCase();

        // Detect device type
        let deviceType: DeviceInfo['deviceType'] = 'desktop';
        if (/tablet|ipad|playbook|silk/i.test(ua)) {
            deviceType = 'tablet';
        } else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|opera mobi/i.test(ua)) {
            deviceType = 'mobile';
        }

        // Detect browser
        let browser = 'Unknown';
        let browserVersion = '';

        if (/edg/i.test(ua)) {
            browser = 'Edge';
            browserVersion = this.extractVersion(userAgent, /edg\/(\d+(\.\d+)?)/i);
        } else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) {
            browser = 'Chrome';
            browserVersion = this.extractVersion(userAgent, /chrome\/(\d+(\.\d+)?)/i);
        } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
            browser = 'Safari';
            browserVersion = this.extractVersion(userAgent, /version\/(\d+(\.\d+)?)/i);
        } else if (/firefox/i.test(ua)) {
            browser = 'Firefox';
            browserVersion = this.extractVersion(userAgent, /firefox\/(\d+(\.\d+)?)/i);
        } else if (/opera|opr/i.test(ua)) {
            browser = 'Opera';
            browserVersion = this.extractVersion(userAgent, /(?:opera|opr)\/(\d+(\.\d+)?)/i);
        } else if (/msie|trident/i.test(ua)) {
            browser = 'Internet Explorer';
            browserVersion = this.extractVersion(userAgent, /(?:msie |rv:)(\d+(\.\d+)?)/i);
        }

        // Detect OS
        let os = 'Unknown';
        let osVersion = '';

        if (/windows nt 10/i.test(ua)) {
            os = 'Windows';
            osVersion = '10/11'; // Can't distinguish 10 from 11 via UA
        } else if (/windows nt 6\.3/i.test(ua)) {
            os = 'Windows';
            osVersion = '8.1';
        } else if (/windows nt 6\.2/i.test(ua)) {
            os = 'Windows';
            osVersion = '8';
        } else if (/windows nt 6\.1/i.test(ua)) {
            os = 'Windows';
            osVersion = '7';
        } else if (/mac os x/i.test(ua)) {
            os = 'macOS';
            osVersion = this.extractVersion(userAgent, /mac os x (\d+[._]\d+)/i).replace('_', '.');
        } else if (/iphone os|ipad.*os/i.test(ua)) {
            os = 'iOS';
            osVersion = this.extractVersion(userAgent, /(?:iphone os|ipad.*os) (\d+[._]\d+)/i).replace('_', '.');
        } else if (/android/i.test(ua)) {
            os = 'Android';
            osVersion = this.extractVersion(userAgent, /android (\d+(\.\d+)?)/i);
        } else if (/linux/i.test(ua)) {
            os = 'Linux';
        }

        return {
            deviceType,
            browser: browserVersion ? `${browser} ${browserVersion}` : browser,
            browserVersion,
            os: osVersion ? `${os} ${osVersion}` : os,
            osVersion,
        };
    }

    /**
     * Extract version number from user agent using regex
     */
    private extractVersion(userAgent: string, regex: RegExp): string {
        const match = userAgent.match(regex);
        return match ? match[1] : '';
    }

    /**
     * Normalize and validate IP address
     */
    normalizeIP(ip: string): string | null {
        if (!ip) return null;

        // Trim whitespace
        ip = ip.trim();

        // Handle X-Forwarded-For format (take first IP)
        if (ip.includes(',')) {
            ip = ip.split(',')[0].trim();
        }

        // Basic validation
        // IPv4: 0-255.0-255.0-255.0-255
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        // IPv6: simplified check
        const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

        if (ipv4Regex.test(ip)) {
            // Validate each octet is 0-255
            const octets = ip.split('.').map(Number);
            if (octets.every(o => o >= 0 && o <= 255)) {
                return ip;
            }
        }

        if (ipv6Regex.test(ip) || ip === '::1') {
            return ip;
        }

        return null;
    }

    /**
     * Check if IP is private/local (not geolocation-able)
     */
    isPrivateIP(ip: string): boolean {
        // IPv4 private ranges
        if (
            ip.startsWith('10.') ||
            ip.startsWith('192.168.') ||
            ip.startsWith('127.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
        ) {
            return true;
        }

        // IPv6 localhost
        if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc00:')) {
            return true;
        }

        return false;
    }

    /**
     * Clean up expired cache entries
     */
    async cleanupExpiredCache(ctx: RequestContext): Promise<{ deleted: number }> {
        const repo = this.connection.getRepository(ctx, IPGeolocationCache);

        const result = await repo.delete({
            expiresAt: LessThan(new Date()),
        });

        return { deleted: result.affected || 0 };
    }

    /**
     * Extract domain from referrer URL
     */
    extractReferrerDomain(referrer: string): string | null {
        if (!referrer) return null;

        try {
            const url = new URL(referrer);
            return url.hostname;
        } catch {
            return null;
        }
    }
}
