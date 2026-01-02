import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity()
export class CalendarEvent extends VendureEntity {
    constructor(input?: DeepPartial<CalendarEvent>) {
        super(input);
    }

    @Index()
    @Column('varchar')
    customerId: string; // The buyer

    @Column('varchar', { nullable: true })
    sellerId: string; // The seller (for service appointments)

    @Column()
    title: string;

    @Column('text', { nullable: true })
    description: string;

    @Column()
    eventType: string; // 'service_appointment', 'tune_session', 'pickup', 'delivery', 'reminder'

    @Column({ type: 'datetime' })
    startTime: Date;

    @Column({ type: 'datetime', nullable: true })
    endTime: Date;

    @Column({ nullable: true })
    location: string;

    @Column({ default: 'pending' })
    status: string; // 'pending', 'confirmed', 'completed', 'cancelled'

    @Column({ nullable: true })
    orderId: string; // Related order if applicable

    @Column({ nullable: true })
    vehicleId: string; // Which vehicle this is for

    @Column('simple-json', { nullable: true })
    reminders: { type: string; minutesBefore: number }[]; // email, sms reminders

    @Column({ nullable: true })
    notes: string;

    @Column({ default: false })
    allDay: boolean;

    @Column({ nullable: true })
    color: string; // For calendar display
}
