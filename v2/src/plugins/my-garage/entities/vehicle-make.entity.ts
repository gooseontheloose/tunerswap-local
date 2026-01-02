import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { VehicleModel } from './vehicle-model.entity';

/**
 * Vehicle manufacturer/make (e.g., BMW, Ford, Toyota)
 */
@Entity('vehicle_make')
export class VehicleMake extends VendureEntity {
    constructor(input?: DeepPartial<VehicleMake>) {
        super(input);
    }

    /**
     * Display name of the make
     * @example "BMW", "Ford", "Toyota"
     */
    @Index()
    @Column({ unique: true })
    name: string;

    /**
     * URL-friendly slug
     * @example "bmw", "ford", "toyota"
     */
    @Index()
    @Column({ unique: true })
    slug: string;

    /**
     * Optional logo URL for display in UI
     */
    @Column({ nullable: true })
    logoUrl: string;

    /**
     * Whether this make is active and should appear in searches
     */
    @Column({ default: true })
    isActive: boolean;

    /**
     * Sort order for display (lower = higher priority)
     */
    @Column({ default: 0 })
    sortOrder: number;

    /**
     * Country of origin (optional)
     * @example "Germany", "USA", "Japan"
     */
    @Column({ nullable: true })
    country: string;

    /**
     * Models belonging to this make
     */
    @OneToMany(() => VehicleModel, model => model.make)
    models: VehicleModel[];
}
