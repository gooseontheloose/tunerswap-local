import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne, OneToMany, Unique } from 'typeorm';
import { VehicleMake } from './vehicle-make.entity';
import { VehicleTrim } from './vehicle-trim.entity';

/**
 * Vehicle model (e.g., 3 Series, Mustang, Camry)
 */
@Entity('vehicle_model')
@Unique(['makeId', 'slug'])
export class VehicleModel extends VendureEntity {
    constructor(input?: DeepPartial<VehicleModel>) {
        super(input);
    }

    /**
     * Foreign key to the make
     */
    @Index()
    @Column({ type: 'varchar' })
    makeId: ID;

    /**
     * Reference to the parent make
     */
    @ManyToOne(() => VehicleMake, make => make.models, { onDelete: 'CASCADE' })
    make: VehicleMake;

    /**
     * Display name of the model
     * @example "3 Series", "Mustang", "Camry"
     */
    @Column()
    name: string;

    /**
     * URL-friendly slug (unique within make)
     * @example "3-series", "mustang", "camry"
     */
    @Index()
    @Column()
    slug: string;

    /**
     * Body style category (optional)
     * @example "Sedan", "Coupe", "SUV", "Truck"
     */
    @Column({ nullable: true })
    bodyStyle: string;

    /**
     * Vehicle category/segment (optional)
     * @example "Compact", "Mid-size", "Full-size", "Sports"
     */
    @Column({ nullable: true })
    category: string;

    /**
     * Whether this model is active and should appear in searches
     */
    @Column({ default: true })
    isActive: boolean;

    /**
     * Trims available for this model
     */
    @OneToMany(() => VehicleTrim, trim => trim.model)
    trims: VehicleTrim[];
}
