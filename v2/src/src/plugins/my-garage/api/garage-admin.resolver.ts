import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Allow, Permission } from '@vendure/core';
import { TaxonomyService } from '../services/taxonomy.service';
import { GarageService } from '../services/garage.service';
import { FitmentService } from '../services/fitment.service';
import { SeedTaxonomyService } from '../seed-data/seed-taxonomy.service';
import {
    GarageReadPermission,
    GarageFitmentPermission,
    GarageTaxonomyPermission,
    GarageImportPermission,
} from '../permissions';

@Resolver()
export class GarageAdminResolver {
    constructor(
        private taxonomyService: TaxonomyService,
        private garageService: GarageService,
        private fitmentService: FitmentService,
        private seedTaxonomyService: SeedTaxonomyService,
    ) {}

    // ==========================================
    // Stats & Overview
    // ==========================================

    @Query()
    @Allow(Permission.ReadCatalog, GarageReadPermission.Permission)
    async garageTaxonomyStats(@Ctx() ctx: RequestContext) {
        const taxonomyStats = await this.taxonomyService.getStats(ctx);
        const totalCustomerVehicles = await this.garageService.getTotalCustomerVehicles(ctx);
        const totalFitmentRules = await this.fitmentService.getTotalFitmentRules(ctx);

        return {
            ...taxonomyStats,
            totalCustomerVehicles,
            totalFitmentRules,
        };
    }

    // ==========================================
    // Taxonomy Queries
    // ==========================================

    @Query()
    @Allow(Permission.ReadCatalog, GarageReadPermission.Permission)
    async garageAllMakes(
        @Ctx() ctx: RequestContext,
        @Args() args: { includeInactive?: boolean },
    ) {
        return this.taxonomyService.getAllMakes(ctx, args.includeInactive ?? false);
    }

    @Query()
    @Allow(Permission.ReadCatalog, GarageReadPermission.Permission)
    async garageAllModels(
        @Ctx() ctx: RequestContext,
        @Args() args: { makeId: string; includeInactive?: boolean },
    ) {
        return this.taxonomyService.getModelsByMake(ctx, args.makeId, args.includeInactive ?? false);
    }

    @Query()
    @Allow(Permission.ReadCatalog, GarageReadPermission.Permission)
    async garageAllTrims(
        @Ctx() ctx: RequestContext,
        @Args() args: { modelId: string; includeInactive?: boolean },
    ) {
        return this.taxonomyService.getTrimsByModel(ctx, args.modelId, undefined, args.includeInactive ?? false);
    }

    @Query()
    @Allow(Permission.ReadCatalog, GarageReadPermission.Permission)
    async garageAllEngines(
        @Ctx() ctx: RequestContext,
        @Args() args: { trimId: string; includeInactive?: boolean },
    ) {
        return this.taxonomyService.getEnginesByTrim(ctx, args.trimId, args.includeInactive ?? false);
    }

    // ==========================================
    // Fitment Queries
    // ==========================================

    @Query()
    @Allow(Permission.ReadCatalog, GarageFitmentPermission.Permission)
    async fitmentByVariant(
        @Ctx() ctx: RequestContext,
        @Args() args: { productVariantId: string },
    ) {
        const items = await this.fitmentService.getFitmentByVariant(ctx, args.productVariantId);
        return {
            items,
            totalItems: items.length,
        };
    }

    @Query()
    @Allow(Permission.ReadCatalog, GarageFitmentPermission.Permission)
    async searchFitmentRules(
        @Ctx() ctx: RequestContext,
        @Args() args: { makeId?: string; modelId?: string; productId?: string; skip?: number; take?: number },
    ) {
        return this.fitmentService.searchFitmentRules(ctx, args);
    }

    // ==========================================
    // Make CRUD
    // ==========================================

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async createVehicleMake(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.taxonomyService.createMake(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async updateVehicleMake(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: any },
    ) {
        return this.taxonomyService.updateMake(ctx, args.id, args.input);
    }

    @Mutation()
    @Allow(Permission.DeleteCatalog, GarageTaxonomyPermission.Permission)
    async deleteVehicleMake(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.taxonomyService.deleteMake(ctx, args.id);
    }

    // ==========================================
    // Model CRUD
    // ==========================================

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async createVehicleModel(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.taxonomyService.createModel(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async updateVehicleModel(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: any },
    ) {
        return this.taxonomyService.updateModel(ctx, args.id, args.input);
    }

    @Mutation()
    @Allow(Permission.DeleteCatalog, GarageTaxonomyPermission.Permission)
    async deleteVehicleModel(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.taxonomyService.deleteModel(ctx, args.id);
    }

    // ==========================================
    // Trim CRUD
    // ==========================================

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async createVehicleTrim(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.taxonomyService.createTrim(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async updateVehicleTrim(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: any },
    ) {
        return this.taxonomyService.updateTrim(ctx, args.id, args.input);
    }

    @Mutation()
    @Allow(Permission.DeleteCatalog, GarageTaxonomyPermission.Permission)
    async deleteVehicleTrim(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.taxonomyService.deleteTrim(ctx, args.id);
    }

    // ==========================================
    // Engine CRUD
    // ==========================================

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async createVehicleEngine(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.taxonomyService.createEngine(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageTaxonomyPermission.Permission)
    async updateVehicleEngine(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: any },
    ) {
        return this.taxonomyService.updateEngine(ctx, args.id, args.input);
    }

    @Mutation()
    @Allow(Permission.DeleteCatalog, GarageTaxonomyPermission.Permission)
    async deleteVehicleEngine(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.taxonomyService.deleteEngine(ctx, args.id);
    }

    // ==========================================
    // Fitment CRUD
    // ==========================================

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageFitmentPermission.Permission)
    async createProductFitment(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.fitmentService.createFitment(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageFitmentPermission.Permission)
    async updateProductFitment(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: any },
    ) {
        return this.fitmentService.updateFitment(ctx, args.id, args.input);
    }

    @Mutation()
    @Allow(Permission.DeleteCatalog, GarageFitmentPermission.Permission)
    async deleteProductFitment(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.fitmentService.deleteFitment(ctx, args.id);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageImportPermission.Permission)
    async bulkUpsertFitment(@Ctx() ctx: RequestContext, @Args() args: { entries: any[] }) {
        return this.fitmentService.bulkUpsertFitment(ctx, args.entries);
    }

    // ==========================================
    // Import Operations
    // ==========================================

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageImportPermission.Permission)
    async importACESFile(@Ctx() ctx: RequestContext, @Args() args: { fileContent: string }) {
        // TODO: Implement ACES XML parsing
        return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: ['ACES import not yet implemented'],
            duration: 0,
        };
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, GarageImportPermission.Permission)
    async importTaxonomyData(@Ctx() ctx: RequestContext, @Args() args: { data: string }) {
        // TODO: Implement taxonomy data import
        return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: ['Taxonomy import not yet implemented'],
            duration: 0,
        };
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async seedVehicleTaxonomyFromFiles(@Ctx() ctx: RequestContext) {
        try {
            console.log('Starting seedVehicleTaxonomyFromFiles mutation...');
            console.log('Context channel:', ctx.channel?.code);
            console.log('Context user:', ctx.activeUserId);
            const result = await this.seedTaxonomyService.seedFromFiles(ctx);
            console.log('Seed result:', result);
            return result;
        } catch (error) {
            console.error('Seed mutation error:', error);
            return {
                success: false,
                imported: 0,
                skipped: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error in seed mutation'],
                duration: 0,
            };
        }
    }
}
