// TunerSwap My Garage Plugin - See PLUGIN_STRUCTURE_GUIDE.md before modifying
import { PluginCommonModule, VendurePlugin, Type } from '@vendure/core';
import { VehicleMake } from './entities/vehicle-make.entity';
import { VehicleModel } from './entities/vehicle-model.entity';
import { VehicleTrim } from './entities/vehicle-trim.entity';
import { VehicleEngine } from './entities/vehicle-engine.entity';
import { CustomerVehicle } from './entities/customer-vehicle.entity';
import { ProductFitment } from './entities/product-fitment.entity';
import { TaxonomyService } from './services/taxonomy.service';
import { GarageService } from './services/garage.service';
import { FitmentService } from './services/fitment.service';
import { SeedTaxonomyService } from './seed-data/seed-taxonomy.service';
import { GarageShopResolver } from './api/garage-shop.resolver';
import { GarageAdminResolver } from './api/garage-admin.resolver';
import { shopApiExtensions, adminApiExtensions } from './api/api-extensions';
import { MY_GARAGE_PLUGIN_OPTIONS, MyGaragePluginOptions } from './types';
import { myGaragePermissions } from './permissions';

const defaultOptions: MyGaragePluginOptions = {
    maxVehiclesPerCustomer: 10,
    enableVinStorage: true,
    enableACESImport: true,
    enableNHTSARefresh: true,
};

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [
        VehicleMake,
        VehicleModel,
        VehicleTrim,
        VehicleEngine,
        CustomerVehicle,
        ProductFitment,
    ],
    providers: [
        TaxonomyService,
        GarageService,
        FitmentService,
        SeedTaxonomyService,
        {
            provide: MY_GARAGE_PLUGIN_OPTIONS,
            useFactory: () => MyGaragePlugin.options,
        },
    ],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [GarageShopResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [GarageAdminResolver],
    },
    dashboard: './ui/routes.tsx',
    configuration: config => {
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...myGaragePermissions,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class MyGaragePlugin {
    static options: MyGaragePluginOptions = defaultOptions;

    static init(options?: Partial<MyGaragePluginOptions>): Type<MyGaragePlugin> {
        MyGaragePlugin.options = {
            ...defaultOptions,
            ...options,
        };
        return MyGaragePlugin;
    }
}

// Re-exports go AFTER the class (per PLUGIN_STRUCTURE_GUIDE.md)
export { myGaragePermissions } from './permissions';
