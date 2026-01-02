import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity()
@Unique(['buyerId', 'sellerId'])
export class BuyerConnection extends VendureEntity {
    constructor(input?: DeepPartial<BuyerConnection>) {
        super(input);
    }

    @Index()
    @Column('varchar')
    buyerId: string;

    @Index()
    @Column('varchar')
    sellerId: string;

    @Column({ default: 'saved' })
    connectionType: string; // 'saved', 'following', 'blocked'

    @Column({ nullable: true })
    notes: string; // Buyer's private notes about this seller

    @Column({ default: true })
    notifyOnNewProducts: boolean;

    @Column({ default: true })
    notifyOnSales: boolean;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    connectedAt: Date;

    @Column({ type: 'datetime', nullable: true })
    lastInteractionAt: Date;
}
