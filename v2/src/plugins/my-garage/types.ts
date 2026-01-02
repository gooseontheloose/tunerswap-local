import { ID } from '@vendure/core';

/**
 * Injection token for MyGarage plugin options
 */
export const MY_GARAGE_PLUGIN_OPTIONS = Symbol('MY_GARAGE_PLUGIN_OPTIONS');

/**
 * Configuration options for the MyGarage plugin
 */
export interface MyGaragePluginOptions {
    /**
     * Maximum number of vehicles a customer can save to their garage
     * @default 10
     */
    maxVehiclesPerCustomer: number;

    /**
     * Whether to allow storing VIN hashes (SHA-256 only, never plaintext)
     * @default true
     */
    enableVinStorage: boolean;

    /**
     * Whether to enable ACES/PIES file import for fitment data
     * @default true
     */
    enableACESImport: boolean;

    /**
     * Whether to enable NHTSA API integration for taxonomy refresh
     * @default true
     */
    enableNHTSARefresh: boolean;
}

/**
 * Input for adding a vehicle to customer's garage
 */
export interface AddVehicleInput {
    makeId: ID;
    modelId: ID;
    year: number;
    trimId?: ID;
    engineId?: ID;
    nickname?: string;
    vin?: string; // Will be hashed before storage
    notes?: string;
    mods?: string[];
    imageUrl?: string;
    isPrimary?: boolean;
}

/**
 * Input for updating a garage vehicle
 */
export interface UpdateVehicleInput {
    trimId?: ID;
    engineId?: ID;
    nickname?: string;
    vin?: string;
    notes?: string;
    mods?: string[];
    imageUrl?: string;
    isPrimary?: boolean;
}

/**
 * Input for vehicle filter (used in fitment checks and search)
 */
export interface VehicleFilterInput {
    makeId: ID;
    modelId?: ID;
    year?: number;
    trimId?: ID;
    engineId?: ID;
}

/**
 * Result of a fitment compatibility check
 */
export interface FitmentCheckResult {
    fits: boolean;
    confidence: number;
    message?: string;
    fitmentId?: ID;
    requiredOptions?: Record<string, string>;
    exclusions?: Record<string, string>;
}

/**
 * Input for creating/updating product fitment rules
 */
export interface CreateFitmentInput {
    productVariantId: ID;
    makeId: ID;
    modelId?: ID;
    yearFrom?: number;
    yearTo?: number;
    trimId?: ID;
    engineId?: ID;
    requiredOptions?: Record<string, string>;
    exclusions?: Record<string, string>;
    source?: string;
    confidence?: number;
}

/**
 * Input for bulk fitment import
 */
export interface BulkFitmentEntry {
    productVariantSku: string;
    makeName: string;
    modelName?: string;
    yearFrom?: number;
    yearTo?: number;
    trimName?: string;
    engineCode?: string;
    source: string;
}

/**
 * Result of import operations
 */
export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    duration: number;
}

/**
 * Taxonomy statistics for admin dashboard
 */
export interface TaxonomyStats {
    totalMakes: number;
    totalModels: number;
    totalTrims: number;
    totalEngines: number;
    totalCustomerVehicles: number;
    totalFitmentRules: number;
}

/**
 * Year range for vehicle selection
 */
export interface YearRange {
    minYear: number;
    maxYear: number;
    years: number[];
}
