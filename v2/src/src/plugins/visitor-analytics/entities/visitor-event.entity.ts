/**
 * VisitorEvent Entity
 *
 * Core event storage for visitor tracking. Stores every visit (page view, action)
 * with full context including:
 * - Session and identity information
 * - Event details (type, page, referrer)
 * - Geolocation data (country, city, coordinates)
 * - Device information (type, browser, OS)
 */

import { DeepPartial, VendureEntity, ID } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity('visitor_event')
export class VisitorEvent extends VendureEntity {
    constructor(input?: DeepPartial<VisitorEvent>) {
        super(input);
    }

    // =========================================================================
    // SESSION & IDENTITY
    // =========================================================================

    /**
     * Client-generated session ID (stored in sessionStorage)
     * Used to group events within a single visit
     */
    @Index()
    @Column('varchar', { length: 64 })
    sessionId: string;

    /**
     * Persistent anonymous ID (stored in localStorage)
     * Used to track returning visitors across sessions
     */
    @Column('varchar', { length: 64, nullable: true })
    anonymousId: string;

    /**
     * IP address (IPv4 or IPv6)
     * Captured server-side from request headers
     */
    @Index()
    @Column('varchar', { length: 45, nullable: true })
    ipAddress: string;

    /**
     * Link to Customer entity if authenticated
     */
    @Index()
    @Column({ type: 'int', nullable: true })
    customerId: ID;

    /**
     * Vendure channel ID where the event occurred
     */
    @Column({ type: 'int', nullable: true })
    channelId: ID;

    // =========================================================================
    // EVENT DETAILS
    // =========================================================================

    /**
     * Type of event: 'page_view', 'product_view', 'search', 'add_to_cart',
     * 'checkout', 'login', 'register', 'order_placed', etc.
     */
    @Index()
    @Column('varchar', { length: 50 })
    eventType: string;

    /**
     * Page URL path (e.g., '/products/tune-123', '/collections/tunes')
     */
    @Column('varchar', { length: 500, nullable: true })
    pagePath: string;

    /**
     * Page title from document.title
     */
    @Column('varchar', { length: 255, nullable: true })
    pageTitle: string;

    /**
     * Referrer URL (where the visitor came from)
     */
    @Column('varchar', { length: 1000, nullable: true })
    referrer: string;

    /**
     * Additional event-specific data stored as JSON
     * Examples: { productId, searchTerm, resultCount, cartTotal }
     */
    @Column('simple-json', { nullable: true })
    eventData: Record<string, any>;

    // =========================================================================
    // GEOLOCATION
    // =========================================================================

    /**
     * ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'DE')
     */
    @Index()
    @Column('varchar', { length: 2, nullable: true })
    countryCode: string;

    /**
     * Full country name
     */
    @Column('varchar', { length: 100, nullable: true })
    country: string;

    /**
     * State/Province/Region name
     */
    @Column('varchar', { length: 100, nullable: true })
    region: string;

    /**
     * City name
     */
    @Column('varchar', { length: 100, nullable: true })
    city: string;

    /**
     * Geographic latitude
     */
    @Column('decimal', { precision: 10, scale: 6, nullable: true })
    latitude: number;

    /**
     * Geographic longitude
     */
    @Column('decimal', { precision: 10, scale: 6, nullable: true })
    longitude: number;

    /**
     * Timezone identifier (e.g., 'America/New_York')
     */
    @Column('varchar', { length: 50, nullable: true })
    timezone: string;

    /**
     * Status of geolocation resolution
     * 'success', 'failed', 'cached', 'skipped', 'private_ip'
     */
    @Column('varchar', { length: 20, default: 'pending' })
    geoStatus: string;

    // =========================================================================
    // DEVICE INFORMATION
    // =========================================================================

    /**
     * Device type: 'desktop', 'mobile', 'tablet', 'unknown'
     */
    @Index()
    @Column('varchar', { length: 20, nullable: true })
    deviceType: string;

    /**
     * Browser name and version (e.g., 'Chrome 120', 'Safari 17')
     */
    @Column('varchar', { length: 100, nullable: true })
    browser: string;

    /**
     * Operating system name and version (e.g., 'Windows 11', 'macOS 14')
     */
    @Column('varchar', { length: 100, nullable: true })
    os: string;

    /**
     * Full user agent string (for debugging/advanced analysis)
     */
    @Column('varchar', { length: 500, nullable: true })
    userAgent: string;

    /**
     * Screen resolution (e.g., '1920x1080')
     */
    @Column('varchar', { length: 20, nullable: true })
    screenResolution: string;

    /**
     * Browser language preference (e.g., 'en-US')
     */
    @Column('varchar', { length: 10, nullable: true })
    language: string;

    // =========================================================================
    // TIMESTAMPS
    // =========================================================================

    /**
     * When the event occurred (client timestamp or server receive time)
     */
    @Index()
    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    eventTime: Date;

    // Note: VendureEntity provides createdAt and updatedAt automatically
}
