/**
 * IPGeolocationCache Entity
 *
 * Caches geolocation lookup results to reduce external API calls.
 * Each IP address is cached with a configurable TTL (default 24 hours).
 */

import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity('ip_geolocation_cache')
export class IPGeolocationCache extends VendureEntity {
    constructor(input?: DeepPartial<IPGeolocationCache>) {
        super(input);
    }

    // =========================================================================
    // IP ADDRESS
    // =========================================================================

    /**
     * IP address (IPv4 or IPv6)
     * Unique constraint ensures one cache entry per IP
     */
    @Index()
    @Column('varchar', { length: 45, unique: true })
    ipAddress: string;

    // =========================================================================
    // GEOLOCATION DATA
    // =========================================================================

    /**
     * ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB')
     */
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
     * Internet Service Provider name (optional)
     */
    @Column('varchar', { length: 100, nullable: true })
    isp: string;

    /**
     * Autonomous System Number (optional, for advanced security)
     */
    @Column('varchar', { length: 50, nullable: true })
    asn: string;

    // =========================================================================
    // CACHE METADATA
    // =========================================================================

    /**
     * When this cache entry expires
     * Entries past expiration should be refreshed on next lookup
     */
    @Index()
    @Column({ type: 'datetime' })
    expiresAt: Date;

    /**
     * Geolocation provider that populated this cache entry
     * 'ip-api', 'maxmind', 'ipstack', etc.
     */
    @Column('varchar', { length: 30, nullable: true })
    source: string;

    /**
     * Whether the lookup was successful
     * false if the provider returned an error or no data
     */
    @Column({ type: 'boolean', default: true })
    success: boolean;

    /**
     * Error message if lookup failed (for debugging)
     */
    @Column('varchar', { length: 255, nullable: true })
    errorMessage: string;

    // Note: VendureEntity provides createdAt and updatedAt automatically
}
