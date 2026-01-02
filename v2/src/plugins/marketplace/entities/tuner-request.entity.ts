import { DeepPartial, VendureEntity, Customer, ID } from '@vendure/core';
import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';

/**
 * TunerRequest entity - stores pending seller/tuner applications.
 *
 * When a customer submits a "Become a Seller" request, it creates a TunerRequest.
 * The request goes through approval flow (manual or auto) before converting
 * the customer to a seller.
 *
 * Status flow:
 * - pending: Awaiting review
 * - approved: Approved, seller profile created
 * - rejected: Rejected by admin
 * - cancelled: Cancelled by applicant
 */
@Entity()
export class TunerRequest extends VendureEntity {
    constructor(input?: DeepPartial<TunerRequest>) {
        super(input);
    }

    // === Link to Customer ===
    @Column({ type: 'varchar' })
    customerId: ID;

    @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
    @JoinColumn()
    customer: Customer;

    // === Personal Information ===
    @Column({ default: '' })
    firstName: string;

    @Column({ default: '' })
    lastName: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ nullable: true })
    location: string;

    @Column({ nullable: true })
    address: string;

    // === Business Information ===
    @Column({ nullable: true })
    businessName: string;

    @Column({ nullable: true })
    website: string;

    @Column({ nullable: true })
    instagram: string;

    @Column({ nullable: true })
    facebook: string;

    @Column({ type: 'text', nullable: true })
    bio: string;

    // === Tuning Information ===
    @Column({ nullable: true })
    experience: string;

    @Column({ type: 'simple-array', nullable: true })
    software: string[];

    @Column({ type: 'simple-array', nullable: true })
    vehiclePlatforms: string[];

    @Column({ type: 'simple-array', nullable: true })
    tuneTypes: string[];

    @Column({ nullable: true })
    hasDyno: string;

    // === Business Hours (stored as JSON string) ===
    @Column({ type: 'text', nullable: true })
    hours: string;

    // === Request Status ===
    @Column({ default: 'pending' })
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';

    // === Admin Notes ===
    @Column({ type: 'text', nullable: true })
    adminNotes: string;

    // === Review Information ===
    @Column({ nullable: true })
    reviewedBy: string;

    @Column({ type: 'datetime', nullable: true })
    reviewedAt: Date;

    // === Created Seller Profile (after approval) ===
    @Column({ type: 'varchar', nullable: true })
    sellerProfileId: ID;
}
