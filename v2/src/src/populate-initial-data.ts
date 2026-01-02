import { bootstrap, ChannelService, CountryService, TaxCategoryService, TaxRateService, ZoneService, RequestContext, LanguageCode } from '@vendure/core';
import { config } from './vendure-config';

/**
 * This script sets up the initial data required for Vendure to function properly.
 * Run this ONCE after creating a fresh database.
 *
 * Usage: npx ts-node src/populate-initial-data.ts
 */
async function populateInitialData() {
    console.log('Starting initial data population...');

    const app = await bootstrap(config);

    const channelService = app.get(ChannelService);
    const countryService = app.get(CountryService);
    const zoneService = app.get(ZoneService);
    const taxCategoryService = app.get(TaxCategoryService);
    const taxRateService = app.get(TaxRateService);

    // Create an admin context using the default channel
    const defaultChannel = await channelService.getDefaultChannel();
    const ctx = new RequestContext({
        apiType: 'admin',
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
        channel: defaultChannel,
        languageCode: LanguageCode.en,
    });

    try {
        console.log(`Default channel: ${defaultChannel.code}`);

        // Check if we already have tax categories
        const existingTaxCategories = await taxCategoryService.findAll(ctx);
        if (existingTaxCategories.totalItems > 0) {
            console.log('Tax categories already exist, skipping...');
        } else {
            // Create a default tax category
            console.log('Creating default tax category...');
            await taxCategoryService.create(ctx, {
                name: 'Standard',
                isDefault: true,
            });
            console.log('Created "Standard" tax category');
        }

        // Check if we have zones
        const existingZones = await zoneService.findAll(ctx);
        if (existingZones.totalItems > 0) {
            console.log('Zones already exist, skipping...');
        } else {
            // Create USA country first
            console.log('Creating USA country...');
            const usa = await countryService.create(ctx, {
                code: 'US',
                enabled: true,
                translations: [{ languageCode: LanguageCode.en, name: 'United States' }],
            });

            // Create a default zone
            console.log('Creating default zone...');
            const defaultZone = await zoneService.create(ctx, {
                name: 'USA',
                memberIds: [usa.id],
            });
            console.log(`Created zone: ${defaultZone.name}`);

            // Set the default zone for the channel
            console.log('Setting default tax zone for channel...');
            await channelService.update(ctx, {
                id: defaultChannel.id,
                defaultTaxZoneId: defaultZone.id,
                defaultShippingZoneId: defaultZone.id,
            });
            console.log('Default tax zone set');
        }

        // Check if we have tax rates
        const existingTaxRates = await taxRateService.findAll(ctx);
        if (existingTaxRates.totalItems > 0) {
            console.log('Tax rates already exist, skipping...');
        } else {
            // Get the tax category and zone
            const taxCategories = await taxCategoryService.findAll(ctx);
            const zones = await zoneService.findAll(ctx);

            if (taxCategories.items.length > 0 && zones.items.length > 0) {
                // Create a 0% tax rate (no tax for digital goods)
                console.log('Creating tax rate...');
                await taxRateService.create(ctx, {
                    name: 'Standard Rate',
                    enabled: true,
                    value: 0, // 0% tax
                    categoryId: taxCategories.items[0].id,
                    zoneId: zones.items[0].id,
                });
                console.log('Created 0% tax rate');
            }
        }

        console.log('\n=== Initial data population complete! ===');
        console.log('You can now restart Vendure and create products.');

    } catch (error) {
        console.error('Error populating initial data:', error);
    } finally {
        await app.close();
    }
}

populateInitialData();
