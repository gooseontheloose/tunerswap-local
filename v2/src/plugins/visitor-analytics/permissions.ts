/**
 * Visitor Analytics Plugin - Custom Permissions
 *
 * Defines permissions for accessing analytics data in the admin panel.
 */

import { PermissionDefinition, Permission } from '@vendure/core';

/**
 * Permission to read visitor analytics data (stats, events, country breakdown)
 * Does NOT include access to raw IP addresses
 */
export const VisitorAnalyticsReadDef = new PermissionDefinition({
    name: 'VisitorAnalyticsRead',
    description: 'Read visitor analytics data (stats, charts, aggregates)',
});

/**
 * Permission to read security-sensitive data (raw IPs, customer IP history)
 * Should be restricted to administrators
 */
export const VisitorAnalyticsSecurityDef = new PermissionDefinition({
    name: 'VisitorAnalyticsSecurity',
    description: 'Read security data including raw IP addresses and customer IP history',
});

/**
 * Permission to manage analytics settings (retention, rate limits, cleanup)
 */
export const VisitorAnalyticsManageDef = new PermissionDefinition({
    name: 'VisitorAnalyticsManage',
    description: 'Manage visitor analytics settings and perform cleanup operations',
});

/**
 * Permission name strings for use with @Allow() decorator
 */
export const VisitorAnalyticsRead = 'VisitorAnalyticsRead' as Permission;
export const VisitorAnalyticsSecurity = 'VisitorAnalyticsSecurity' as Permission;
export const VisitorAnalyticsManage = 'VisitorAnalyticsManage' as Permission;

/**
 * All visitor analytics permission definitions for registration
 */
export const visitorAnalyticsPermissions = [
    VisitorAnalyticsReadDef,
    VisitorAnalyticsSecurityDef,
    VisitorAnalyticsManageDef,
];
