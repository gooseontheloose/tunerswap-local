import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { VehicleModel } from './vehicle-model.entity';
import { VehicleEngine } from './vehicle-engine.entity';

/**
 * Vehicle trim level with year range (e.g., 330i 2019-2023, GT 2015-2024)
 */
@Entity('vehicle_trim')
export class VehicleTrim extends VendureEntity {
    constructor(input?: DeepPartial<VehicleTrim>) {
        super(input);
    }

    /**
     * Foreign key to the model
     */
    @Index()
    @Column({ type: 'varchar' })
    modelId: ID;

    /**
     * Reference to the parent model
     */
    @ManyToOne(() => VehicleModel, model => model.trims, { onDelete: 'CASCADE' })
    model: VehicleModel;

    /**
     * Display name of the trim
     * @example "330i", "GT", "LE", "Sport"
     */
    @Column()
    name: string;

    /**
     * URL-friendly slug
     * @example "330i", "gt", "le", "sport"
     */
    @Column()
    slug: string;

    /**
     * First year this trim was available
     * @example 2019
     */
    @Index()
    @Column({ type: 'int' })
    yearStart: number;

    /**
     * Last year this trim was available (9999 for current/ongoing)
     * @example 2023
     */
    @Index()
    @Column({ type: 'int' })
    yearEnd: number;

    /**
     * Factory body/chassis code (optional)
     * @example "G20", "S550", "XV70"
     */
    @Column({ nullable: true })
    bodyCode: string;

    /**
     * Transmission type (optional)
     * @example "Manual", "Automatic", "DCT"
     */
    @Column({ nullable: true })
    transmission: string;

    /**
     * Drive type (optional)
     * @example "RWD", "FWD", "AWD", "4WD"
     */
    @Column({ nullable: true })
    driveType: string;

    /**
     * Whether this trim is active and should appear in searches
     */
    @Column({ default: true })
    isActive: boolean;

    /**
     * Engines available for this trim
     */
    @OneToMany(() => VehicleEngine, engine => engine.trim)
    engines: VehicleEngine[];
}
