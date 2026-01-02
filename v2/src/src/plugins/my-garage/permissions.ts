import { PermissionDefinition } from '@vendure/core';

/**
 * Permission to read vehicle taxonomy (makes, models, trims, engines)
 * This is typically granted to all users for search/filter functionality
 */
export const GarageReadPermission = new PermissionDefinition({
    name: 'GarageRead',
    description: 'Allows reading vehicle taxonomy data (makes, models, trims, engines)',
});

/**
 * Permission to manage product fitment rules
 * Typically granted to sellers and admins
 */
export const GarageFitmentPermission = new PermissionDefinition({
    name: 'GarageFitment',
    description: 'Allows creating and managing product fitment rules',
});

/**
 * Permission to manage vehicle taxonomy (CRUD on makes, models, trims, engines)
 * Typically granted to admins only
 */
export const GarageTaxonomyPermission = new PermissionDefinition({
    name: 'GarageTaxonomy',
    description: 'Allows managing vehicle taxonomy (add/edit/delete makes, models, trims, engines)',
});

/**
 * Permission to import vehicle data (ACES, PIES, NHTSA refresh)
 * Typically granted to admins only
 */
export const GarageImportPermission = new PermissionDefinition({
    name: 'GarageImport',
    description: 'Allows importing vehicle taxonomy and fitment data from external sources',
});

/**
 * All permissions exported for plugin registration
 */
export const myGaragePermissions = [
    GarageReadPermission,
    GarageFitmentPermission,
    GarageTaxonomyPermission,
    GarageImportPermission,
];
