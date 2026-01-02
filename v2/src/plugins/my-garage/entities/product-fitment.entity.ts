import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { VehicleMake } from './vehicle-make.entity';
import { VehicleModel } from './vehicle-model.entity';

/**
 * Product fitment rule - defines which vehicles a product is compatible with
 * Supports wildcards (null values mean "all" for that field)
 */
@Entity('product_fitment')
@Index(['productVariantId', 'makeId', 'modelId'])
export class ProductFitment extends VendureEntity {
    constructor(input?: DeepPartial<ProductFitment>) {
        super(input);
    }

    /**
     * Foreign key to the ProductVariant (Vendure entity)
     */
    @Index()
    @Column({ type: 'varchar' })
    productVariantId: ID;

    // Note: We don't use @ManyToOne to ProductVariant to avoid circular dependency
    // The relationship is managed through productVariantId

    /**
     * Foreign key to the make (required)
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
     * Foreign key to the model (null = all models of this make)
     */
    @Column({ type: 'varchar', nullable: true })
    modelId: ID;

    /**
     * Reference to the vehicle model (optional)
     */
    @ManyToOne(() => VehicleModel, { nullable: true })
    model: VehicleModel;

    /**
     * Start year for fitment range (null = no lower bound)
     * @example 2015
     */
    @Index()
    @Column({ type: 'int', nullable: true })
    yearFrom: number;

    /**
     * End year for fitment range (null = no upper bound)
     * @example 2024
     */
    @Column({ type: 'int', nullable: true })
    yearTo: number;

    /**
     * Foreign key to specific trim (null = all trims)
     */
    @Column({ type: 'varchar', nullable: true })
    trimId: ID;

    /**
     * Foreign key to specific engine (null = all engines)
     */
    @Column({ type: 'varchar', nullable: true })
    engineId: ID;

    /**
     * Required options/features for this fitment
     * @example { "transmission": "manual", "package": "M Sport" }
     */
    @Column({ type: 'simple-json', nullable: true })
    requiredOptions: Record<string, string>;

    /**
     * Exclusions that prevent fitment
     * @example { "package": "xDrive" } means doesn't fit xDrive models
     */
    @Column({ type: 'simple-json', nullable: true })
    exclusions: Record<string, string>;

    /**
     * Source of this fitment data
     * @example "manual", "aces", "pies", "seller"
     */
    @Column({ default: 'manual' })
    source: string;

    /**
     * Confidence score (0-100) for this fitment rule
     * Higher = more certain. Manual entries default to 100.
     * @example 100 for manual, 95 for ACES, 80 for automated
     */
    @Column({ type: 'int', default: 100 })
    confidence: number;

    /**
     * Whether this fitment rule is active
     */
    @Column({ default: true })
    isActive: boolean;

    /**
     * Optional notes about this fitment
     * @example "Requires M Sport suspension", "Does not fit convertible"
     */
    @Column({ type: 'text', nullable: true })
    notes: string;
}
