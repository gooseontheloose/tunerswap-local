import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { ProductFitment } from '../entities/product-fitment.entity';
import { VehicleMake } from '../entities/vehicle-make.entity';
import { VehicleModel } from '../entities/vehicle-model.entity';
import { VehicleFilterInput, FitmentCheckResult, CreateFitmentInput, ImportResult } from '../types';

@Injectable()
export class FitmentService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * Get all fitment rules for a product variant
     */
    async getFitmentByVariant(ctx: RequestContext, productVariantId: ID): Promise<ProductFitment[]> {
        return this.connection.getRepository(ctx, ProductFitment).find({
            where: { productVariantId, isActive: true },
            relations: ['make', 'model'],
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Search fitment rules with optional filters
     */
    async searchFitmentRules(
        ctx: RequestContext,
        options: {
            makeId?: ID;
            modelId?: ID;
            productId?: ID;
            skip?: number;
            take?: number;
        },
    ): Promise<{ items: ProductFitment[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, ProductFitment)
            .createQueryBuilder('fitment')
            .leftJoinAndSelect('fitment.make', 'make')
            .leftJoinAndSelect('fitment.model', 'model');

        if (options.makeId) {
            qb.andWhere('fitment.makeId = :makeId', { makeId: options.makeId });
        }
        if (options.modelId) {
            qb.andWhere('fitment.modelId = :modelId', { modelId: options.modelId });
        }
        if (options.productId) {
            // Search by product ID (not variant ID) - need to join through variants
            qb.andWhere('fitment.productVariantId LIKE :productId', { productId: `%${options.productId}%` });
        }

        const totalItems = await qb.getCount();

        if (options.skip) {
            qb.skip(options.skip);
        }
        if (options.take) {
            qb.take(options.take);
        }

        const items = await qb.orderBy('fitment.createdAt', 'DESC').getMany();

        return { items, totalItems };
    }

    /**
     * Check if a product fits a specific vehicle configuration
     */
    async checkFitment(
        ctx: RequestContext,
        productVariantId: ID,
        vehicle: VehicleFilterInput,
    ): Promise<FitmentCheckResult> {
        // Find all applicable fitment rules for this product and make
        const rules = await this.connection
            .getRepository(ctx, ProductFitment)
            .createQueryBuilder('fitment')
            .where('fitment.productVariantId = :productVariantId', { productVariantId })
            .andWhere('fitment.makeId = :makeId', { makeId: vehicle.makeId })
            .andWhere('fitment.isActive = :isActive', { isActive: true })
            .getMany();

        if (rules.length === 0) {
            return {
                fits: false,
                confidence: 100,
                message: 'No fitment data available for this vehicle',
            };
        }

        // Find the best matching rule
        let bestMatch: ProductFitment | null = null;
        let bestScore = -1;

        for (const rule of rules) {
            let score = 0;
            let matches = true;

            // Check model match (null in rule = all models)
            if (rule.modelId) {
                if (vehicle.modelId && rule.modelId.toString() === vehicle.modelId.toString()) {
                    score += 10;
                } else {
                    matches = false;
                    continue;
                }
            } else {
                score += 1; // Wildcard match is less specific
            }

            // Check year range
            if (vehicle.year) {
                const yearFrom = rule.yearFrom || 1900;
                const yearTo = rule.yearTo || 9999;
                if (vehicle.year >= yearFrom && vehicle.year <= yearTo) {
                    score += 5;
                } else {
                    matches = false;
                    continue;
                }
            }

            // Check trim match
            if (rule.trimId) {
                if (vehicle.trimId && rule.trimId.toString() === vehicle.trimId.toString()) {
                    score += 3;
                } else {
                    matches = false;
                    continue;
                }
            }

            // Check engine match
            if (rule.engineId) {
                if (vehicle.engineId && rule.engineId.toString() === vehicle.engineId.toString()) {
                    score += 2;
                } else {
                    matches = false;
                    continue;
                }
            }

            if (matches && score > bestScore) {
                bestScore = score;
                bestMatch = rule;
            }
        }

        if (bestMatch) {
            return {
                fits: true,
                confidence: bestMatch.confidence,
                message: bestMatch.notes || 'This product fits your vehicle',
                fitmentId: bestMatch.id,
            };
        }

        return {
            fits: false,
            confidence: 80,
            message: 'This product may not fit your specific vehicle configuration',
        };
    }

    /**
     * Create a new fitment rule
     */
    async createFitment(ctx: RequestContext, input: CreateFitmentInput): Promise<ProductFitment> {
        const fitment = new ProductFitment({
            productVariantId: input.productVariantId,
            makeId: input.makeId,
            modelId: input.modelId,
            yearFrom: input.yearFrom,
            yearTo: input.yearTo,
            trimId: input.trimId,
            engineId: input.engineId,
            requiredOptions: input.requiredOptions,
            exclusions: input.exclusions,
            source: input.source || 'manual',
            confidence: input.confidence ?? 100,
            isActive: true,
        });

        return this.connection.getRepository(ctx, ProductFitment).save(fitment);
    }

    /**
     * Update a fitment rule
     */
    async updateFitment(
        ctx: RequestContext,
        id: ID,
        input: Partial<ProductFitment>,
    ): Promise<ProductFitment> {
        const repo = this.connection.getRepository(ctx, ProductFitment);
        await repo.update(id, input);
        return repo.findOneOrFail({
            where: { id },
            relations: ['make', 'model'],
        });
    }

    /**
     * Delete a fitment rule
     */
    async deleteFitment(ctx: RequestContext, id: ID): Promise<boolean> {
        const result = await this.connection.getRepository(ctx, ProductFitment).delete(id);
        return (result.affected ?? 0) > 0;
    }

    /**
     * Bulk upsert fitment entries (for imports)
     */
    async bulkUpsertFitment(
        ctx: RequestContext,
        entries: Array<{
            productVariantSku: string;
            makeName: string;
            modelName?: string;
            yearFrom?: number;
            yearTo?: number;
            trimName?: string;
            engineCode?: string;
            source: string;
        }>,
    ): Promise<ImportResult> {
        const startTime = Date.now();
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const entry of entries) {
            try {
                // Look up make by name
                const make = await this.connection.getRepository(ctx, VehicleMake).findOne({
                    where: { name: entry.makeName },
                });

                if (!make) {
                    skipped++;
                    errors.push(`Make not found: ${entry.makeName}`);
                    continue;
                }

                // Look up model by name (if provided)
                let modelId: ID | undefined;
                if (entry.modelName) {
                    const model = await this.connection.getRepository(ctx, VehicleModel).findOne({
                        where: { name: entry.modelName, makeId: make.id },
                    });
                    if (model) {
                        modelId = model.id;
                    }
                }

                // TODO: Look up product variant by SKU
                // For now, we'll skip this as it requires ProductVariant access
                skipped++;
                errors.push(`Product variant lookup not implemented: ${entry.productVariantSku}`);
            } catch (err) {
                skipped++;
                errors.push(`Error processing entry: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        return {
            success: errors.length === 0,
            imported,
            skipped,
            errors: errors.slice(0, 10), // Limit errors to first 10
            duration: Date.now() - startTime,
        };
    }

    /**
     * Get total count of fitment rules (for stats)
     */
    async getTotalFitmentRules(ctx: RequestContext): Promise<number> {
        return this.connection.getRepository(ctx, ProductFitment).count();
    }
}
