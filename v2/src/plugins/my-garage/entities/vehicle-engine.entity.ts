import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { VehicleTrim } from './vehicle-trim.entity';

/**
 * Vehicle engine configuration (e.g., B58, 5.0L Coyote, 2JZ-GTE)
 */
@Entity('vehicle_engine')
export class VehicleEngine extends VendureEntity {
    constructor(input?: DeepPartial<VehicleEngine>) {
        super(input);
    }

    /**
     * Foreign key to the trim
     */
    @Index()
    @Column({ type: 'varchar' })
    trimId: ID;

    /**
     * Reference to the parent trim
     */
    @ManyToOne(() => VehicleTrim, trim => trim.engines, { onDelete: 'CASCADE' })
    trim: VehicleTrim;

    /**
     * Engine code or common name
     * @example "B58", "5.0L Coyote", "2JZ-GTE", "LS3"
     */
    @Column()
    code: string;

    /**
     * Engine displacement
     * @example "3.0L", "5.0L", "6.2L"
     */
    @Column({ nullable: true })
    displacement: string;

    /**
     * Number of cylinders
     * @example 4, 6, 8
     */
    @Column({ type: 'int', nullable: true })
    cylinders: number;

    /**
     * Engine configuration
     * @example "I4", "I6", "V6", "V8", "Flat-4", "Rotary"
     */
    @Column({ nullable: true })
    configuration: string;

    /**
     * Aspiration type
     * @example "Naturally Aspirated", "Turbocharged", "Supercharged", "Twin-Turbo"
     */
    @Column({ nullable: true })
    aspiration: string;

    /**
     * Fuel type
     * @example "Gasoline", "Diesel", "Hybrid", "Electric"
     */
    @Column({ nullable: true })
    fuelType: string;

    /**
     * Factory horsepower rating
     * @example 335, 450, 670
     */
    @Column({ type: 'int', nullable: true })
    horsepower: number;

    /**
     * Factory torque rating (lb-ft)
     * @example 369, 410, 590
     */
    @Column({ type: 'int', nullable: true })
    torque: number;

    /**
     * Whether this engine is active and should appear in searches
     */
    @Column({ default: true })
    isActive: boolean;
}
