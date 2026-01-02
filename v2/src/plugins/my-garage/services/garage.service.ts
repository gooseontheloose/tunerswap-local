import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CustomerVehicle } from '../entities/customer-vehicle.entity';
import { MY_GARAGE_PLUGIN_OPTIONS, MyGaragePluginOptions, AddVehicleInput, UpdateVehicleInput } from '../types';

/**
 * Hashes a VIN using SHA-256 (we NEVER store plaintext VINs)
 */
function hashVin(vin: string): string {
    return createHash('sha256').update(vin.toUpperCase().trim()).digest('hex');
}

@Injectable()
export class GarageService {
    constructor(
        private connection: TransactionalConnection,
        @Inject(MY_GARAGE_PLUGIN_OPTIONS) private options: MyGaragePluginOptions,
    ) {}

    /**
     * Get all vehicles in a customer's garage
     */
    async getVehiclesByCustomer(ctx: RequestContext, customerId: ID): Promise<CustomerVehicle[]> {
        return this.connection.getRepository(ctx, CustomerVehicle).find({
            where: { customerId },
            relations: ['make', 'model', 'trim', 'engine'],
            order: { isPrimary: 'DESC', createdAt: 'DESC' },
        });
    }

    /**
     * Get a single vehicle by ID (with ownership check)
     */
    async getVehicle(ctx: RequestContext, id: ID, customerId: ID): Promise<CustomerVehicle | null> {
        const vehicle = await this.connection.getRepository(ctx, CustomerVehicle).findOne({
            where: { id, customerId },
            relations: ['make', 'model', 'trim', 'engine'],
        });
        return vehicle;
    }

    /**
     * Get the customer's primary vehicle
     */
    async getPrimaryVehicle(ctx: RequestContext, customerId: ID): Promise<CustomerVehicle | null> {
        return this.connection.getRepository(ctx, CustomerVehicle).findOne({
            where: { customerId, isPrimary: true },
            relations: ['make', 'model', 'trim', 'engine'],
        });
    }

    /**
     * Add a vehicle to customer's garage
     */
    async addVehicle(ctx: RequestContext, customerId: ID, input: AddVehicleInput): Promise<CustomerVehicle> {
        // Check max vehicles limit
        const existingCount = await this.connection
            .getRepository(ctx, CustomerVehicle)
            .count({ where: { customerId } });

        if (existingCount >= this.options.maxVehiclesPerCustomer) {
            throw new Error(
                `Maximum of ${this.options.maxVehiclesPerCustomer} vehicles allowed in garage`,
            );
        }

        // If this is the first vehicle or isPrimary is true, handle primary status
        const shouldBePrimary = input.isPrimary || existingCount === 0;

        if (shouldBePrimary) {
            // Clear any existing primary vehicle
            await this.connection
                .getRepository(ctx, CustomerVehicle)
                .update({ customerId, isPrimary: true }, { isPrimary: false });
        }

        // Hash VIN if provided and VIN storage is enabled
        let vinHash: string | undefined;
        if (input.vin && this.options.enableVinStorage) {
            vinHash = hashVin(input.vin);
        }

        const vehicle = new CustomerVehicle({
            customerId,
            makeId: input.makeId,
            modelId: input.modelId,
            year: input.year,
            trimId: input.trimId,
            engineId: input.engineId,
            nickname: input.nickname,
            vinHash,
            notes: input.notes,
            mods: input.mods,
            imageUrl: input.imageUrl,
            isPrimary: shouldBePrimary,
        });

        const saved = await this.connection.getRepository(ctx, CustomerVehicle).save(vehicle);

        // Reload with relations
        return this.connection.getRepository(ctx, CustomerVehicle).findOneOrFail({
            where: { id: saved.id },
            relations: ['make', 'model', 'trim', 'engine'],
        });
    }

    /**
     * Update a vehicle in customer's garage
     */
    async updateVehicle(
        ctx: RequestContext,
        id: ID,
        customerId: ID,
        input: UpdateVehicleInput,
    ): Promise<CustomerVehicle> {
        // Verify ownership
        const existing = await this.connection.getRepository(ctx, CustomerVehicle).findOne({
            where: { id, customerId },
        });

        if (!existing) {
            throw new Error('Vehicle not found or not owned by customer');
        }

        // Handle VIN hash update
        let vinHash: string | undefined;
        if (input.vin !== undefined) {
            vinHash = input.vin && this.options.enableVinStorage ? hashVin(input.vin) : undefined;
        }

        // Handle primary status
        if (input.isPrimary) {
            await this.connection
                .getRepository(ctx, CustomerVehicle)
                .update({ customerId, isPrimary: true }, { isPrimary: false });
        }

        const updateData: Partial<CustomerVehicle> = {};
        if (input.trimId !== undefined) updateData.trimId = input.trimId;
        if (input.engineId !== undefined) updateData.engineId = input.engineId;
        if (input.nickname !== undefined) updateData.nickname = input.nickname;
        if (vinHash !== undefined) updateData.vinHash = vinHash;
        if (input.notes !== undefined) updateData.notes = input.notes;
        if (input.mods !== undefined) updateData.mods = input.mods;
        if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
        if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;

        await this.connection.getRepository(ctx, CustomerVehicle).update(id, updateData);

        return this.connection.getRepository(ctx, CustomerVehicle).findOneOrFail({
            where: { id },
            relations: ['make', 'model', 'trim', 'engine'],
        });
    }

    /**
     * Remove a vehicle from customer's garage
     */
    async removeVehicle(ctx: RequestContext, id: ID, customerId: ID): Promise<boolean> {
        // Verify ownership
        const existing = await this.connection.getRepository(ctx, CustomerVehicle).findOne({
            where: { id, customerId },
        });

        if (!existing) {
            throw new Error('Vehicle not found or not owned by customer');
        }

        const wasPrimary = existing.isPrimary;
        const result = await this.connection.getRepository(ctx, CustomerVehicle).delete(id);

        // If removed vehicle was primary, promote the next most recent vehicle
        if (wasPrimary && (result.affected ?? 0) > 0) {
            const nextVehicle = await this.connection.getRepository(ctx, CustomerVehicle).findOne({
                where: { customerId },
                order: { createdAt: 'DESC' },
            });
            if (nextVehicle) {
                await this.connection
                    .getRepository(ctx, CustomerVehicle)
                    .update(nextVehicle.id, { isPrimary: true });
            }
        }

        return (result.affected ?? 0) > 0;
    }

    /**
     * Set a vehicle as the primary vehicle
     */
    async setPrimaryVehicle(ctx: RequestContext, id: ID, customerId: ID): Promise<CustomerVehicle> {
        // Verify ownership
        const existing = await this.connection.getRepository(ctx, CustomerVehicle).findOne({
            where: { id, customerId },
        });

        if (!existing) {
            throw new Error('Vehicle not found or not owned by customer');
        }

        // Clear any existing primary
        await this.connection
            .getRepository(ctx, CustomerVehicle)
            .update({ customerId, isPrimary: true }, { isPrimary: false });

        // Set this one as primary
        await this.connection.getRepository(ctx, CustomerVehicle).update(id, { isPrimary: true });

        return this.connection.getRepository(ctx, CustomerVehicle).findOneOrFail({
            where: { id },
            relations: ['make', 'model', 'trim', 'engine'],
        });
    }

    /**
     * Get total count of customer vehicles (for stats)
     */
    async getTotalCustomerVehicles(ctx: RequestContext): Promise<number> {
        return this.connection.getRepository(ctx, CustomerVehicle).count();
    }
}
