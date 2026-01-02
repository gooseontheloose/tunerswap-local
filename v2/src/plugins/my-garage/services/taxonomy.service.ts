import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { In, Like } from 'typeorm';
import { VehicleMake } from '../entities/vehicle-make.entity';
import { VehicleModel } from '../entities/vehicle-model.entity';
import { VehicleTrim } from '../entities/vehicle-trim.entity';
import { VehicleEngine } from '../entities/vehicle-engine.entity';

/**
 * Generates a URL-friendly slug from a string
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

@Injectable()
export class TaxonomyService {
    constructor(private connection: TransactionalConnection) {}

    // ==========================================
    // Make Operations
    // ==========================================

    async getAllMakes(ctx: RequestContext, includeInactive = false): Promise<VehicleMake[]> {
        const where = includeInactive ? {} : { isActive: true };
        return this.connection.getRepository(ctx, VehicleMake).find({
            where,
            order: { sortOrder: 'ASC', name: 'ASC' },
        });
    }

    async searchMakes(ctx: RequestContext, term: string, limit = 10): Promise<VehicleMake[]> {
        return this.connection.getRepository(ctx, VehicleMake).find({
            where: {
                name: Like(`%${term}%`),
                isActive: true,
            },
            order: { sortOrder: 'ASC', name: 'ASC' },
            take: limit,
        });
    }

    async getMakeById(ctx: RequestContext, id: ID): Promise<VehicleMake | null> {
        return this.connection.getRepository(ctx, VehicleMake).findOne({
            where: { id },
        });
    }

    async getMakeBySlug(ctx: RequestContext, slug: string): Promise<VehicleMake | null> {
        return this.connection.getRepository(ctx, VehicleMake).findOne({
            where: { slug },
        });
    }

    async createMake(
        ctx: RequestContext,
        input: {
            name: string;
            slug?: string;
            logoUrl?: string;
            country?: string;
            isActive?: boolean;
            sortOrder?: number;
        },
    ): Promise<VehicleMake> {
        const make = new VehicleMake({
            name: input.name,
            slug: input.slug || generateSlug(input.name),
            logoUrl: input.logoUrl,
            country: input.country,
            isActive: input.isActive ?? true,
            sortOrder: input.sortOrder ?? 0,
        });
        return this.connection.getRepository(ctx, VehicleMake).save(make);
    }

    async updateMake(ctx: RequestContext, id: ID, input: Partial<VehicleMake>): Promise<VehicleMake> {
        const repo = this.connection.getRepository(ctx, VehicleMake);
        await repo.update(id, input);
        return repo.findOneOrFail({ where: { id } });
    }

    async deleteMake(ctx: RequestContext, id: ID): Promise<boolean> {
        const result = await this.connection.getRepository(ctx, VehicleMake).delete(id);
        return (result.affected ?? 0) > 0;
    }

    // ==========================================
    // Model Operations
    // ==========================================

    async getModelsByMake(ctx: RequestContext, makeId: ID, includeInactive = false): Promise<VehicleModel[]> {
        const where: any = { makeId };
        if (!includeInactive) {
            where.isActive = true;
        }
        return this.connection.getRepository(ctx, VehicleModel).find({
            where,
            order: { name: 'ASC' },
            relations: ['make'],
        });
    }

    async searchModels(ctx: RequestContext, makeId: ID, term: string, limit = 10): Promise<VehicleModel[]> {
        return this.connection.getRepository(ctx, VehicleModel).find({
            where: {
                makeId,
                name: Like(`%${term}%`),
                isActive: true,
            },
            order: { name: 'ASC' },
            take: limit,
            relations: ['make'],
        });
    }

    async getModelById(ctx: RequestContext, id: ID): Promise<VehicleModel | null> {
        return this.connection.getRepository(ctx, VehicleModel).findOne({
            where: { id },
            relations: ['make'],
        });
    }

    async createModel(
        ctx: RequestContext,
        input: {
            makeId: ID;
            name: string;
            slug?: string;
            bodyStyle?: string;
            category?: string;
            isActive?: boolean;
        },
    ): Promise<VehicleModel> {
        const model = new VehicleModel({
            makeId: input.makeId,
            name: input.name,
            slug: input.slug || generateSlug(input.name),
            bodyStyle: input.bodyStyle,
            category: input.category,
            isActive: input.isActive ?? true,
        });
        return this.connection.getRepository(ctx, VehicleModel).save(model);
    }

    async updateModel(ctx: RequestContext, id: ID, input: Partial<VehicleModel>): Promise<VehicleModel> {
        const repo = this.connection.getRepository(ctx, VehicleModel);
        await repo.update(id, input);
        return repo.findOneOrFail({ where: { id }, relations: ['make'] });
    }

    async deleteModel(ctx: RequestContext, id: ID): Promise<boolean> {
        const result = await this.connection.getRepository(ctx, VehicleModel).delete(id);
        return (result.affected ?? 0) > 0;
    }

    // ==========================================
    // Trim Operations
    // ==========================================

    async getTrimsByModel(
        ctx: RequestContext,
        modelId: ID,
        year?: number,
        includeInactive = false,
    ): Promise<VehicleTrim[]> {
        const qb = this.connection
            .getRepository(ctx, VehicleTrim)
            .createQueryBuilder('trim')
            .leftJoinAndSelect('trim.model', 'model')
            .leftJoinAndSelect('model.make', 'make')
            .where('trim.modelId = :modelId', { modelId });

        if (!includeInactive) {
            qb.andWhere('trim.isActive = :isActive', { isActive: true });
        }

        if (year) {
            qb.andWhere('trim.yearStart <= :year AND trim.yearEnd >= :year', { year });
        }

        return qb.orderBy('trim.name', 'ASC').getMany();
    }

    async searchTrims(
        ctx: RequestContext,
        modelId: ID,
        year: number,
        term?: string,
        limit = 10,
    ): Promise<VehicleTrim[]> {
        const qb = this.connection
            .getRepository(ctx, VehicleTrim)
            .createQueryBuilder('trim')
            .leftJoinAndSelect('trim.model', 'model')
            .where('trim.modelId = :modelId', { modelId })
            .andWhere('trim.yearStart <= :year AND trim.yearEnd >= :year', { year })
            .andWhere('trim.isActive = :isActive', { isActive: true });

        if (term) {
            qb.andWhere('trim.name LIKE :term', { term: `%${term}%` });
        }

        return qb.orderBy('trim.name', 'ASC').take(limit).getMany();
    }

    async getTrimById(ctx: RequestContext, id: ID): Promise<VehicleTrim | null> {
        return this.connection.getRepository(ctx, VehicleTrim).findOne({
            where: { id },
            relations: ['model', 'model.make'],
        });
    }

    async createTrim(
        ctx: RequestContext,
        input: {
            modelId: ID;
            name: string;
            slug?: string;
            yearStart: number;
            yearEnd: number;
            bodyCode?: string;
            transmission?: string;
            driveType?: string;
            isActive?: boolean;
        },
    ): Promise<VehicleTrim> {
        const trim = new VehicleTrim({
            modelId: input.modelId,
            name: input.name,
            slug: input.slug || generateSlug(input.name),
            yearStart: input.yearStart,
            yearEnd: input.yearEnd,
            bodyCode: input.bodyCode,
            transmission: input.transmission,
            driveType: input.driveType,
            isActive: input.isActive ?? true,
        });
        return this.connection.getRepository(ctx, VehicleTrim).save(trim);
    }

    async updateTrim(ctx: RequestContext, id: ID, input: Partial<VehicleTrim>): Promise<VehicleTrim> {
        const repo = this.connection.getRepository(ctx, VehicleTrim);
        await repo.update(id, input);
        return repo.findOneOrFail({ where: { id }, relations: ['model', 'model.make'] });
    }

    async deleteTrim(ctx: RequestContext, id: ID): Promise<boolean> {
        const result = await this.connection.getRepository(ctx, VehicleTrim).delete(id);
        return (result.affected ?? 0) > 0;
    }

    // ==========================================
    // Engine Operations
    // ==========================================

    async getEnginesByTrim(ctx: RequestContext, trimId: ID, includeInactive = false): Promise<VehicleEngine[]> {
        const where: any = { trimId };
        if (!includeInactive) {
            where.isActive = true;
        }
        return this.connection.getRepository(ctx, VehicleEngine).find({
            where,
            order: { code: 'ASC' },
            relations: ['trim'],
        });
    }

    async getEngineById(ctx: RequestContext, id: ID): Promise<VehicleEngine | null> {
        return this.connection.getRepository(ctx, VehicleEngine).findOne({
            where: { id },
            relations: ['trim', 'trim.model', 'trim.model.make'],
        });
    }

    async createEngine(
        ctx: RequestContext,
        input: {
            trimId: ID;
            code: string;
            displacement?: string;
            cylinders?: number;
            configuration?: string;
            aspiration?: string;
            fuelType?: string;
            horsepower?: number;
            torque?: number;
            isActive?: boolean;
        },
    ): Promise<VehicleEngine> {
        const engine = new VehicleEngine({
            trimId: input.trimId,
            code: input.code,
            displacement: input.displacement,
            cylinders: input.cylinders,
            configuration: input.configuration,
            aspiration: input.aspiration,
            fuelType: input.fuelType,
            horsepower: input.horsepower,
            torque: input.torque,
            isActive: input.isActive ?? true,
        });
        return this.connection.getRepository(ctx, VehicleEngine).save(engine);
    }

    async updateEngine(ctx: RequestContext, id: ID, input: Partial<VehicleEngine>): Promise<VehicleEngine> {
        const repo = this.connection.getRepository(ctx, VehicleEngine);
        await repo.update(id, input);
        return repo.findOneOrFail({ where: { id }, relations: ['trim'] });
    }

    async deleteEngine(ctx: RequestContext, id: ID): Promise<boolean> {
        const result = await this.connection.getRepository(ctx, VehicleEngine).delete(id);
        return (result.affected ?? 0) > 0;
    }

    // ==========================================
    // Year Range Operations
    // ==========================================

    async getYearRange(ctx: RequestContext, makeId: ID, modelId?: ID): Promise<{ minYear: number; maxYear: number; years: number[] }> {
        const qb = this.connection
            .getRepository(ctx, VehicleTrim)
            .createQueryBuilder('trim')
            .leftJoin('trim.model', 'model')
            .where('model.makeId = :makeId', { makeId })
            .andWhere('trim.isActive = :isActive', { isActive: true });

        if (modelId) {
            qb.andWhere('trim.modelId = :modelId', { modelId });
        }

        const result = await qb
            .select('MIN(trim.yearStart)', 'minYear')
            .addSelect('MAX(trim.yearEnd)', 'maxYear')
            .getRawOne();

        const minYear = result?.minYear || new Date().getFullYear() - 30;
        // Cap maxYear at current year + 1 (for next year models)
        const maxYear = Math.min(result?.maxYear || new Date().getFullYear(), new Date().getFullYear() + 1);

        // Generate array of years
        const years: number[] = [];
        for (let y = maxYear; y >= minYear; y--) {
            years.push(y);
        }

        return { minYear, maxYear, years };
    }

    async getAvailableYears(ctx: RequestContext, makeId: ID, modelId?: ID): Promise<number[]> {
        const range = await this.getYearRange(ctx, makeId, modelId);
        return range.years;
    }

    // ==========================================
    // Stats
    // ==========================================

    async getStats(ctx: RequestContext): Promise<{
        totalMakes: number;
        totalModels: number;
        totalTrims: number;
        totalEngines: number;
    }> {
        const [totalMakes, totalModels, totalTrims, totalEngines] = await Promise.all([
            this.connection.getRepository(ctx, VehicleMake).count(),
            this.connection.getRepository(ctx, VehicleModel).count(),
            this.connection.getRepository(ctx, VehicleTrim).count(),
            this.connection.getRepository(ctx, VehicleEngine).count(),
        ]);

        return { totalMakes, totalModels, totalTrims, totalEngines };
    }
}
