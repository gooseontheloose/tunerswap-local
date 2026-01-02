import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity()
export class BuyerMessage extends VendureEntity {
    constructor(input?: DeepPartial<BuyerMessage>) {
        super(input);
    }

    @Index()
    @Column('varchar')
    senderId: string;

    @Index()
    @Column('varchar')
    receiverId: string;

    @Column('text')
    content: string;

    @Column({ default: false })
    read: boolean;

    @Column({ nullable: true })
    orderId: string;

    @Column({ nullable: true })
    productId: string;

    @Column({ default: 'general' })
    messageType: string; // 'general', 'order', 'quote', 'support'

    @Column({ nullable: true })
    parentMessageId: string; // For threading

    @Column('simple-json', { nullable: true })
    attachments: string[]; // URLs to attached files

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    sentAt: Date;
}
