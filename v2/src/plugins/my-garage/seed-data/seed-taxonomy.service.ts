import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import * as fs from 'fs';
import * as path from 'path';
import { VehicleMake } from '../entities/vehicle-make.entity';
import { VehicleModel } from '../entities/vehicle-model.entity';
import { VehicleTrim } from '../entities/vehicle-trim.entity';
import { VehicleEngine } from '../entities/vehicle-engine.entity';
import { ImportResult } from '../types';

interface SeedMake {
    id: string;
    name: string;
    slug: string;
    country?: string;
}

interface SeedModel {
    id: string;
    makeId: string;
    name: string;
    slug: string;
    yearStart?: number;
    yearEnd?: number;
    bodyStyle?: string;
}

interface SeedTrim {
    id: string;
    modelId: string;
    name: string;
    slug: string;
    yearStart: number;
    yearEnd: number;
    bodyCode?: string;
    transmission?: string;
    driveType?: string;
}

interface SeedEngine {
    id: string;
    trimId: string;
    code: string;
    displacement?: string;
    cylinders?: number;
    configuration?: string;
    aspiration?: string;
    fuelType?: string;
    horsepower?: number;
    torque?: number;
}

@Injectable()
export class SeedTaxonomyService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * Find the seed data directory - tries multiple locations
     */
    private findSeedDataDir(): string {
        // Try multiple possible locations
        const possiblePaths = [
            // From compiled dist folder, look up to src
            path.join(__dirname, '..', '..', '..', '..', 'src', 'plugins', 'my-garage', 'seed-data'),
            // Direct src path from project root
            path.join(process.cwd(), 'src', 'plugins', 'my-garage', 'seed-data'),
            // If running from src directly
            path.join(__dirname),
            // Relative to dist
            path.join(__dirname, '..', '..', 'src', 'plugins', 'my-garage', 'seed-data'),
        ];

        for (const testPath of possiblePaths) {
            const makesFile = path.join(testPath, 'vehicle-makes.json');
            if (fs.existsSync(makesFile)) {
                console.log(`Found seed data at: ${testPath}`);
                return testPath;
            }
        }

        console.error('Seed data directory not found. Tried:', possiblePaths);
        throw new Error(`Seed data directory not found. Ensure vehicle-makes.json exists in the seed-data folder.`);
    }

    /**
     * Seed taxonomy from JSON files in the seed-data directory
     */
    async seedFromFiles(ctx: RequestContext): Promise<ImportResult> {
        const startTime = Date.now();
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        let seedDataDir: string;
        try {
            seedDataDir = this.findSeedDataDir();
        } catch (error) {
            return {
                success: false,
                imported: 0,
                skipped: 0,
                errors: [error instanceof Error ? error.message : 'Failed to find seed data directory'],
                duration: Date.now() - startTime,
            };
        }

        try {
            // Seed makes
            const makesResult = await this.seedMakes(ctx, seedDataDir);
            imported += makesResult.imported;
            skipped += makesResult.skipped;
            errors.push(...makesResult.errors);

            // Seed models
            const modelsResult = await this.seedModels(ctx, seedDataDir);
            imported += modelsResult.imported;
            skipped += modelsResult.skipped;
            errors.push(...modelsResult.errors);

            // Seed trims (if file exists)
            const trimsResult = await this.seedTrims(ctx, seedDataDir);
            imported += trimsResult.imported;
            skipped += trimsResult.skipped;
            errors.push(...trimsResult.errors);

            // Seed engines (if file exists)
            const enginesResult = await this.seedEngines(ctx, seedDataDir);
            imported += enginesResult.imported;
            skipped += enginesResult.skipped;
            errors.push(...enginesResult.errors);

        } catch (err) {
            errors.push(`Seed error: ${err instanceof Error ? err.message : String(err)}`);
        }

        return {
            success: errors.length === 0,
            imported,
            skipped,
            errors: errors.slice(0, 20), // Limit to first 20 errors
            duration: Date.now() - startTime,
        };
    }

    private async seedMakes(ctx: RequestContext, dir: string): Promise<ImportResult> {
        const filePath = path.join(dir, 'vehicle-makes.json');
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (!fs.existsSync(filePath)) {
            return { success: true, imported: 0, skipped: 0, errors: ['vehicle-makes.json not found'], duration: 0 };
        }

        const makes: SeedMake[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log(`Seeding ${makes.length} makes...`);

        const repo = this.connection.getRepository(ctx, VehicleMake);

        for (const make of makes) {
            try {
                // Check if already exists
                const existing = await repo.findOne({ where: { slug: make.slug } });
                if (existing) {
                    skipped++;
                    continue;
                }

                const entity = new VehicleMake({
                    name: make.name,
                    slug: make.slug,
                    country: make.country,
                    isActive: true,
                    sortOrder: 0,
                });

                await repo.save(entity);
                imported++;
            } catch (err) {
                skipped++;
                errors.push(`Make ${make.name}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        console.log(`Makes: ${imported} imported, ${skipped} skipped`);
        return { success: true, imported, skipped, errors, duration: 0 };
    }

    private async seedModels(ctx: RequestContext, dir: string): Promise<ImportResult> {
        const filePath = path.join(dir, 'vehicle-models.json');
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        if (!fs.existsSync(filePath)) {
            return { success: true, imported: 0, skipped: 0, errors: ['vehicle-models.json not found'], duration: 0 };
        }

        const models: SeedModel[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log(`Seeding ${models.length} models...`);

        const modelRepo = this.connection.getRepository(ctx, VehicleModel);
        const makeRepo = this.connection.getRepository(ctx, VehicleMake);

        // Build make lookup by NHTSA ID (stored in seed file)
        const makeIdMap = new Map<string, VehicleMake>();
        const allMakes = await makeRepo.find();

        // Load seed makes to get NHTSA ID mapping
        const seedMakesPath = path.join(dir, 'vehicle-makes.json');
        const seedMakes: SeedMake[] = JSON.parse(fs.readFileSync(seedMakesPath, 'utf-8'));

        for (const seedMake of seedMakes) {
            const dbMake = allMakes.find(m => m.slug === seedMake.slug);
            if (dbMake) {
                makeIdMap.set(seedMake.id, dbMake);
            }
        }

        for (const model of models) {
            try {
                const make = makeIdMap.get(model.makeId);
                if (!make) {
                    skipped++;
                    continue;
                }

                // Check if already exists
                const existing = await modelRepo.findOne({
                    where: { makeId: make.id, slug: model.slug }
                });
                if (existing) {
                    skipped++;
                    continue;
                }

                const entity = new VehicleModel({
                    makeId: make.id,
                    name: model.name,
                    slug: model.slug,
                    bodyStyle: model.bodyStyle,
                    isActive: true,
                });

                await modelRepo.save(entity);
                imported++;
            } catch (err) {
                skipped++;
                if (errors.length < 10) {
                    errors.push(`Model ${model.name}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }

        console.log(`Models: ${imported} imported, ${skipped} skipped`);
        return { success: true, imported, skipped, errors, duration: 0 };
    }

    private async seedTrims(ctx: RequestContext, dir: string): Promise<ImportResult> {
        const filePath = path.join(dir, 'vehicle-trims.json');

        if (!fs.existsSync(filePath)) {
            return { success: true, imported: 0, skipped: 0, errors: [], duration: 0 };
        }

        const trims: SeedTrim[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (trims.length === 0) {
            return { success: true, imported: 0, skipped: 0, errors: [], duration: 0 };
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        console.log(`Seeding ${trims.length} trims...`);
        const repo = this.connection.getRepository(ctx, VehicleTrim);

        for (const trim of trims) {
            try {
                const entity = new VehicleTrim({
                    modelId: trim.modelId,
                    name: trim.name,
                    slug: trim.slug,
                    yearStart: trim.yearStart,
                    yearEnd: trim.yearEnd,
                    bodyCode: trim.bodyCode,
                    transmission: trim.transmission,
                    driveType: trim.driveType,
                    isActive: true,
                });

                await repo.save(entity);
                imported++;
            } catch (err) {
                skipped++;
            }
        }

        console.log(`Trims: ${imported} imported, ${skipped} skipped`);
        return { success: true, imported, skipped, errors, duration: 0 };
    }

    private async seedEngines(ctx: RequestContext, dir: string): Promise<ImportResult> {
        const filePath = path.join(dir, 'vehicle-engines.json');

        if (!fs.existsSync(filePath)) {
            return { success: true, imported: 0, skipped: 0, errors: [], duration: 0 };
        }

        const engines: SeedEngine[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (engines.length === 0) {
            return { success: true, imported: 0, skipped: 0, errors: [], duration: 0 };
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        console.log(`Seeding ${engines.length} engines...`);
        const repo = this.connection.getRepository(ctx, VehicleEngine);

        for (const engine of engines) {
            try {
                const entity = new VehicleEngine({
                    trimId: engine.trimId,
                    code: engine.code,
                    displacement: engine.displacement,
                    cylinders: engine.cylinders,
                    configuration: engine.configuration,
                    aspiration: engine.aspiration,
                    fuelType: engine.fuelType,
                    horsepower: engine.horsepower,
                    torque: engine.torque,
                    isActive: true,
                });

                await repo.save(entity);
                imported++;
            } catch (err) {
                skipped++;
            }
        }

        console.log(`Engines: ${imported} imported, ${skipped} skipped`);
        return { success: true, imported, skipped, errors, duration: 0 };
    }
}
