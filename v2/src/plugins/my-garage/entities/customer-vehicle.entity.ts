import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne, Unique } from 'typeorm';
import { VehicleMake } from './vehicle-make.entity';
import { VehicleModel } from './vehicle-model.entity';
import { VehicleTrim } from './vehicle-trim.entity';
import { VehicleEngine } from './vehicle-engine.entity';

/**
 * Customer's saved vehicle (their "garage")
 * Links a customer to their vehicles for fitment filtering
 */
@Entity('customer_vehicle')
@Unique(['customerId', 'makeId', 'modelId', 'year', 'trimId', 'engineId'])
export class CustomerVehicle extends VendureEntity {
    constructor(input?: DeepPartial<CustomerVehicle>) {
        super(input);
    }

    /**
     * Foreign key to the customer (Vendure Customer entity)
     */
    @Index()
    @Column({ type: 'varchar' })
    customerId: ID;

    // Note: We don't use @ManyToOne to Customer to avoid circular dependency
    // The relationship is managed through customerId

    /**
     * Foreign key to the make
     */
    @Index()
    @Column({ type: 'varchar' })
    makeId: ID;

    /**
     * Reference to the vehicle make
     */
    @ManyToOne(() => VehicleMake)
    make: VehicleMake;

    /**
     * Foreign key to the model
     */
    @Index()
    @Column({ type: 'varchar' })
    modelId: ID;

    /**
     * Reference to the vehicle model
     */
    @ManyToOne(() => VehicleModel)
    model: VehicleModel;

    /**
     * Model year of the vehicle
     * @example 2022
     */
    @Index()
    @Column({ type: 'int' })
    year: number;

    /**
     * Foreign key to the trim (optional)
     */
    @Column({ type: 'varchar', nullable: true })
    trimId: ID;

    /**
     * Reference to the vehicle trim (optional)
     */
    @ManyToOne(() => VehicleTrim, { nullable: true })
    trim: VehicleTrim;

    /**
     * Foreign key to the engine (optional)
     */
    @Column({ type: 'varchar', nullable: true })
    engineId: ID;

    /**
     * Reference to the vehicle engine (optional)
     */
    @ManyToOne(() => VehicleEngine, { nullable: true })
    engine: VehicleEngine;

    /**
     * Customer's nickname for this vehicle
     * @example "Daily Driver", "Track Car", "Project"
     */
    @Column({ nullable: true })
    nickname: string;

    /**
     * SHA-256 hash of VIN (NEVER store plaintext VIN)
     * Used for future features like service history lookup
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    vinHash: string;

    /**
     * Customer notes about the vehicle
     */
    @Column({ type: 'text', nullable: true })
    notes: string;

    /**
     * Whether this is the customer's primary/default vehicle
     * Used for automatic fitment filtering
     */
    @Column({ default: false })
    isPrimary: boolean;

    /**
     * List of modifications on the vehicle (JSON array)
     * @example ["Cold Air Intake", "Downpipe", "Stage 2 Tune"]
     */
    @Column({ type: 'simple-json', nullable: true })
    mods: string[];

    /**
     * URL to customer-uploaded vehicle image
     */
    @Column({ nullable: true })
    imageUrl: string;
}
