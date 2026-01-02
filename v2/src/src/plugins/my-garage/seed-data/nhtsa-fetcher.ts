/**
 * NHTSA vPIC API Fetcher
 *
 * Fetches vehicle data from the National Highway Traffic Safety Administration
 * Vehicle Product Information Catalog (vPIC) API.
 *
 * Documentation: https://vpic.nhtsa.dot.gov/api/
 */

import * as fs from 'fs';
import * as path from 'path';

const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

interface NHTSAMake {
    Make_ID: number;
    Make_Name: string;
}

interface NHTSAModel {
    Make_ID: number;
    Make_Name: string;
    Model_ID: number;
    Model_Name: string;
}

interface NHTSAModelYear {
    Make_ID: number;
    Make_Name: string;
    Model_ID: number;
    Model_Name: string;
    Year: number;
}

interface VehicleMake {
    id: string;
    name: string;
    slug: string;
    country?: string;
}

interface VehicleModel {
    id: string;
    makeId: string;
    name: string;
    slug: string;
    yearStart: number;
    yearEnd: number;
}

/**
 * Fetch JSON from NHTSA API with error handling
 */
async function fetchNHTSA<T>(endpoint: string): Promise<T> {
    const url = `${NHTSA_BASE_URL}${endpoint}`;
    console.log(`Fetching: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`NHTSA API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.Results as T;
}

/**
 * Generate a URL-friendly slug
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Fetch all vehicle makes from NHTSA
 */
async function fetchMakes(): Promise<VehicleMake[]> {
    console.log('Fetching all vehicle makes...');
    const makes = await fetchNHTSA<NHTSAMake[]>('/GetAllMakes?format=json');

    // Filter to common passenger vehicle makes (exclude trucks, motorcycles, trailers, etc.)
    const commonMakes = makes.filter(make => {
        const name = make.Make_Name.toUpperCase();
        // Exclude obvious non-passenger vehicle makes
        return !name.includes('TRAILER') &&
               !name.includes('MOTORCYCLE') &&
               !name.includes('MOTOR HOME') &&
               !name.includes('BUS') &&
               !name.includes('INCOMPLETE') &&
               !name.includes('LSV') &&
               make.Make_Name.length > 1;
    });

    return commonMakes.map(make => ({
        id: make.Make_ID.toString(),
        name: make.Make_Name,
        slug: generateSlug(make.Make_Name),
    }));
}

/**
 * Fetch models for a specific make
 */
async function fetchModelsForMake(makeId: number, makeName: string): Promise<VehicleModel[]> {
    const models = await fetchNHTSA<NHTSAModel[]>(
        `/GetModelsForMakeId/${makeId}?format=json`
    );

    return models.map(model => ({
        id: model.Model_ID.toString(),
        makeId: makeId.toString(),
        name: model.Model_Name,
        slug: generateSlug(model.Model_Name),
        yearStart: 1995, // Default range, will be refined
        yearEnd: new Date().getFullYear() + 1,
    }));
}

/**
 * Fetch models for a year range (more specific data)
 */
async function fetchModelsForMakeYear(makeName: string, year: number): Promise<NHTSAModelYear[]> {
    return fetchNHTSA<NHTSAModelYear[]>(
        `/GetModelsForMakeYear/make/${encodeURIComponent(makeName)}/modelyear/${year}?format=json`
    );
}

/**
 * Priority makes to fetch first (most common in tuning market)
 */
const PRIORITY_MAKES = [
    'FORD', 'CHEVROLET', 'DODGE', 'RAM', 'GMC', 'CADILLAC', 'BUICK',
    'BMW', 'MERCEDES-BENZ', 'AUDI', 'VOLKSWAGEN', 'PORSCHE',
    'TOYOTA', 'HONDA', 'NISSAN', 'MAZDA', 'SUBARU', 'MITSUBISHI', 'LEXUS', 'INFINITI', 'ACURA',
    'HYUNDAI', 'KIA', 'GENESIS',
    'JEEP', 'CHRYSLER',
    'TESLA', 'RIVIAN', 'LUCID',
    'ALFA ROMEO', 'FIAT', 'MASERATI', 'FERRARI', 'LAMBORGHINI',
    'LAND ROVER', 'JAGUAR', 'ASTON MARTIN', 'BENTLEY', 'ROLLS-ROYCE',
    'VOLVO', 'SAAB',
    'MINI', 'SMART',
    'SCION',
];

/**
 * Main fetch function - fetches all data and saves to JSON files
 */
async function main() {
    const outputDir = __dirname;

    console.log('=== NHTSA Vehicle Data Fetcher ===\n');

    // Fetch all makes
    console.log('Step 1: Fetching all makes...');
    const allMakes = await fetchMakes();
    console.log(`Found ${allMakes.length} makes\n`);

    // Sort with priority makes first
    const sortedMakes = allMakes.sort((a, b) => {
        const aPriority = PRIORITY_MAKES.indexOf(a.name.toUpperCase());
        const bPriority = PRIORITY_MAKES.indexOf(b.name.toUpperCase());

        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return a.name.localeCompare(b.name);
    });

    // Save makes
    const makesPath = path.join(outputDir, 'vehicle-makes.json');
    fs.writeFileSync(makesPath, JSON.stringify(sortedMakes, null, 2));
    console.log(`Saved ${sortedMakes.length} makes to ${makesPath}\n`);

    // Fetch models for priority makes only (to avoid rate limiting)
    console.log('Step 2: Fetching models for priority makes...');
    const allModels: VehicleModel[] = [];

    for (const make of sortedMakes) {
        if (!PRIORITY_MAKES.includes(make.name.toUpperCase())) continue;

        try {
            console.log(`  Fetching models for ${make.name}...`);
            const models = await fetchModelsForMake(parseInt(make.id), make.name);
            allModels.push(...models);
            console.log(`    Found ${models.length} models`);

            // Small delay to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
            console.error(`  Error fetching models for ${make.name}:`, err);
        }
    }

    // Save models
    const modelsPath = path.join(outputDir, 'vehicle-models.json');
    fs.writeFileSync(modelsPath, JSON.stringify(allModels, null, 2));
    console.log(`\nSaved ${allModels.length} models to ${modelsPath}\n`);

    // Create empty files for trims and engines (these need more specialized data)
    const trimsPath = path.join(outputDir, 'vehicle-trims.json');
    const enginesPath = path.join(outputDir, 'vehicle-engines.json');

    if (!fs.existsSync(trimsPath)) {
        fs.writeFileSync(trimsPath, JSON.stringify([], null, 2));
        console.log(`Created empty trims file: ${trimsPath}`);
    }

    if (!fs.existsSync(enginesPath)) {
        fs.writeFileSync(enginesPath, JSON.stringify([], null, 2));
        console.log(`Created empty engines file: ${enginesPath}`);
    }

    console.log('\n=== Fetch Complete ===');
    console.log(`Total makes: ${sortedMakes.length}`);
    console.log(`Total models: ${allModels.length}`);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { fetchMakes, fetchModelsForMake, fetchModelsForMakeYear };
