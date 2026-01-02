/**
 * DailyAggregate Entity
 *
 * Pre-computed daily rollups for fast dashboard queries.
 * Aggregated nightly (or on-demand) to avoid expensive real-time queries.
 *
 * Each row represents a specific dimension value for a given date:
 * - dimension='total': Overall totals for the day
 * - dimension='country': Breakdown by country (dimensionValue='US', 'GB', etc.)
 * - dimension='device': Breakdown by device type (dimensionValue='mobile', 'desktop', etc.)
 * - dimension='event_type': Breakdown by event type
 * - dimension='page_path': Top pages breakdown
 */

import { DeepPartial, VendureEntity, ID } from '@vendure/core';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity('visitor_daily_aggregate')
@Unique(['date', 'dimension', 'dimensionValue', 'channelId'])
export class DailyAggregate extends VendureEntity {
    constructor(input?: DeepPartial<DailyAggregate>) {
        super(input);
    }

    // =========================================================================
    // DIMENSION KEYS
    // =========================================================================

    /**
     * Date in YYYY-MM-DD format
     */
    @Index()
    @Column('varchar', { length: 10 })
    date: string;

    /**
     * Dimension type: 'total', 'country', 'device', 'browser', 'os',
     * 'event_type', 'page_path', 'referrer_domain'
     */
    @Index()
    @Column('varchar', { length: 30 })
    dimension: string;

    /**
     * Dimension value (e.g., 'US' for country, 'mobile' for device)
     * NULL for dimension='total'
     */
    @Index()
    @Column('varchar', { length: 255, nullable: true })
    dimensionValue: string;

    /**
     * Optional channel ID for multi-channel setups
     */
    @Column({ type: 'int', nullable: true })
    channelId: ID;

    // =========================================================================
    // VISITOR METRICS
    // =========================================================================

    /**
     * Total number of events recorded
     */
    @Column('int', { default: 0 })
    totalEvents: number;

    /**
     * Unique session IDs (approximate unique visitors within the day)
     */
    @Column('int', { default: 0 })
    uniqueSessions: number;

    /**
     * Unique IP addresses
     */
    @Column('int', { default: 0 })
    uniqueIPs: number;

    /**
     * Unique anonymous IDs (persistent visitor tracking)
     */
    @Column('int', { default: 0 })
    uniqueAnonymousIds: number;

    /**
     * Events where customerId was set (authenticated users)
     */
    @Column('int', { default: 0 })
    authenticatedEvents: number;

    /**
     * Unique customer IDs (authenticated visitors)
     */
    @Column('int', { default: 0 })
    uniqueCustomers: number;

    /**
     * Events without customerId (anonymous users)
     */
    @Column('int', { default: 0 })
    anonymousEvents: number;

    // =========================================================================
    // ENGAGEMENT METRICS
    // =========================================================================

    /**
     * Page view events only
     */
    @Column('int', { default: 0 })
    pageViews: number;

    /**
     * Product view events
     */
    @Column('int', { default: 0 })
    productViews: number;

    /**
     * Search events
     */
    @Column('int', { default: 0 })
    searches: number;

    /**
     * Add to cart events
     */
    @Column('int', { default: 0 })
    addToCarts: number;

    /**
     * Checkout started events
     */
    @Column('int', { default: 0 })
    checkoutStarts: number;

    /**
     * Orders placed events
     */
    @Column('int', { default: 0 })
    ordersPlaced: number;

    // =========================================================================
    // TOP LISTS (JSON)
    // =========================================================================

    /**
     * Top 10 pages by view count
     * [{ path: string, count: number }, ...]
     */
    @Column('simple-json', { nullable: true })
    topPages: { path: string; title?: string; count: number }[];

    /**
     * Top 10 referrer domains
     * [{ domain: string, count: number }, ...]
     */
    @Column('simple-json', { nullable: true })
    topReferrers: { domain: string; count: number }[];

    /**
     * Top 10 countries (for dimension='total' only)
     * [{ code: string, country: string, count: number }, ...]
     */
    @Column('simple-json', { nullable: true })
    topCountries: { code: string; country: string; count: number }[];

    /**
     * Top 10 products viewed (for product analytics)
     * [{ productId: string, name: string, count: number }, ...]
     */
    @Column('simple-json', { nullable: true })
    topProducts: { productId: string; name?: string; count: number }[];

    /**
     * Top 10 search terms
     * [{ term: string, count: number }, ...]
     */
    @Column('simple-json', { nullable: true })
    topSearchTerms: { term: string; count: number }[];

    // =========================================================================
    // METADATA
    // =========================================================================

    /**
     * When this aggregate was computed
     */
    @Column({ type: 'datetime', nullable: true })
    computedAt: Date;

    /**
     * Whether this is a complete day (vs partial/in-progress)
     */
    @Column({ type: 'boolean', default: false })
    isComplete: boolean;

    // Note: VendureEntity provides createdAt and updatedAt automatically
}
