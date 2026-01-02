/**
 * My Garage Seed Data Runner
 *
 * This script seeds the vehicle taxonomy from JSON files.
 *
 * Usage:
 *   npm run seed:vehicles
 *
 * Prerequisites:
 *   - JSON seed files must exist (run npm run seed:vehicles:fetch first)
 *   - Vendure server must be built
 */

import { NestFactory } from '@nestjs/core';
import { bootstrap, VendureConfig } from '@vendure/core';
import { config } from '../../../vendure-config';
import { SeedTaxonomyService } from './seed-taxonomy.service';
import { RequestContext } from '@vendure/core';

async function runSeed() {
    console.log('=== My Garage Vehicle Taxonomy Seeder ===\n');

    // Bootstrap Vendure to get access to the database
    const app = await bootstrap(config);

    try {
        // Get the seed service
        const seedService = app.get(SeedTaxonomyService);

        // Create a context (we need a minimal context for the service)
        // Since this is a CLI script, we create an admin context
        const ctx = RequestContext.empty();

        console.log('Starting seed...\n');
        const result = await seedService.seedFromFiles(ctx);

        console.log('\n=== Seed Complete ===');
        console.log(`Success: ${result.success}`);
        console.log(`Imported: ${result.imported}`);
        console.log(`Skipped: ${result.skipped}`);
        console.log(`Duration: ${result.duration}ms`);

        if (result.errors.length > 0) {
            console.log('\nErrors:');
            result.errors.forEach(err => console.log(`  - ${err}`));
        }
    } catch (err) {
        console.error('Seed failed:', err);
    } finally {
        await app.close();
    }
}

// Export for programmatic use
export { runSeed };

// Run if called directly
if (require.main === module) {
    runSeed().catch(console.error);
}
