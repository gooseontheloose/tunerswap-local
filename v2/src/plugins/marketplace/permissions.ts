import { PermissionDefinition } from '@vendure/core';

/**
 * Custom permission for marketplace administration.
 * Only superadmins or users with this permission can access marketplace management features.
 * Regular sellers will NOT have this permission.
 */
export const MarketplaceAdminPermission = new PermissionDefinition({
    name: 'MarketplaceAdmin',
    description: 'Grants access to marketplace administration features (seller management, global settings)',
});
