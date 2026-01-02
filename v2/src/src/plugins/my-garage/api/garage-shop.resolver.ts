import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Allow, Permission } from '@vendure/core';
import { TaxonomyService } from '../services/taxonomy.service';
import { GarageService } from '../services/garage.service';
import { FitmentService } from '../services/fitment.service';

@Resolver()
export class GarageShopResolver {
    constructor(
        private taxonomyService: TaxonomyService,
        private garageService: GarageService,
        private fitmentService: FitmentService,
    ) {}

    // ==========================================
    // Garage Queries (require authenticated customer)
    // ==========================================

    @Query()
    @Allow(Permission.Owner)
    async myGarage(@Ctx() ctx: RequestContext) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new Error('Must be logged in to access garage');
        }
        const items = await this.garageService.getVehiclesByCustomer(ctx, customerId);
        return {
            items,
            totalItems: items.length,
        };
    }

    @Query()
    @Allow(Permission.Owner)
    async myVehicle(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new Error('Must be logged in to access garage');
        }
        return this.garageService.getVehicle(ctx, args.id, customerId);
    }

    @Query()
    @Allow(Permission.Owner)
    async myPrimaryVehicle(@Ctx() ctx: RequestContext) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new Error('Must be logged in to access garage');
        }
        return this.garageService.getPrimaryVehicle(ctx, customerId);
    }

    // ==========================================
    // Taxonomy Queries (public - no auth required)
    // ==========================================

    @Query()
    async searchVehicleMakes(
        @Ctx() ctx: RequestContext,
        @Args() args: { term: string; limit?: number },
    ) {
        return this.taxonomyService.searchMakes(ctx, args.term, args.limit || 10);
    }

    @Query()
    async vehicleMakes(@Ctx() ctx: RequestContext) {
        return this.taxonomyService.getAllMakes(ctx, false);
    }

    @Query()
    async searchVehicleModels(
        @Ctx() ctx: RequestContext,
        @Args() args: { makeId: string; term: string; limit?: number },
    ) {
        return this.taxonomyService.searchModels(ctx, args.makeId, args.term, args.limit || 10);
    }

    @Query()
    async vehicleModels(@Ctx() ctx: RequestContext, @Args() args: { makeId: string }) {
        return this.taxonomyService.getModelsByMake(ctx, args.makeId, false);
    }

    @Query()
    async vehicleYearRange(
        @Ctx() ctx: RequestContext,
        @Args() args: { makeId: string; modelId: string },
    ) {
        return this.taxonomyService.getYearRange(ctx, args.makeId, args.modelId);
    }

    @Query()
    async vehicleYears(
        @Ctx() ctx: RequestContext,
        @Args() args: { makeId: string; modelId?: string },
    ) {
        return this.taxonomyService.getAvailableYears(ctx, args.makeId, args.modelId);
    }

    @Query()
    async searchVehicleTrims(
        @Ctx() ctx: RequestContext,
        @Args() args: { modelId: string; year: number; term?: string; limit?: number },
    ) {
        return this.taxonomyService.searchTrims(ctx, args.modelId, args.year, args.term, args.limit || 10);
    }

    @Query()
    async vehicleTrims(
        @Ctx() ctx: RequestContext,
        @Args() args: { modelId: string; year: number },
    ) {
        return this.taxonomyService.getTrimsByModel(ctx, args.modelId, args.year, false);
    }

    @Query()
    async vehicleEngines(@Ctx() ctx: RequestContext, @Args() args: { trimId: string }) {
        return this.taxonomyService.getEnginesByTrim(ctx, args.trimId, false);
    }

    // ==========================================
    // Fitment Queries (public)
    // ==========================================

    @Query()
    async checkProductFitment(
        @Ctx() ctx: RequestContext,
        @Args() args: { productVariantId: string; vehicle: any },
    ) {
        return this.fitmentService.checkFitment(ctx, args.productVariantId, args.vehicle);
    }

    // ==========================================
    // Garage Mutations (require authenticated customer)
    // ==========================================

    @Mutation()
    @Allow(Permission.Owner)
    async addVehicleToGarage(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new Error('Must be logged in to add vehicles');
        }
        return this.garageService.addVehicle(ctx, customerId, args.input);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async updateGarageVehicle(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: any },
    ) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new Error('Must be logged in to update vehicles');
        }
        return this.garageService.updateVehicle(ctx, args.id, customerId, args.input);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async removeVehicleFromGarage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new Error('Must be logged in to remove vehicles');
        }
        return this.garageService.removeVehicle(ctx, args.id, customerId);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async setPrimaryGarageVehicle(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new Error('Must be logged in to set primary vehicle');
        }
        return this.garageService.setPrimaryVehicle(ctx, args.id, customerId);
    }
}
