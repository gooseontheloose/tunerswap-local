// Order Sync Service - Syncs Vendure orders to Marketplace DB for seller/buyer dashboards
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventBus, OrderStateTransitionEvent, TransactionalConnection, Order, RequestContext } from '@vendure/core';
import { PrismaClient } from '.prisma/marketplace-client';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * OrderSyncService listens for Vendure order state transitions and syncs
 * completed orders to the marketplace database for seller/buyer dashboards.
 */
@Injectable()
export class OrderSyncService implements OnModuleInit, OnModuleDestroy {
    private prisma: PrismaClient;
    private subscription: Subscription;

    constructor(
        private eventBus: EventBus,
        private connection: TransactionalConnection,
    ) {
        this.prisma = new PrismaClient();
    }

    async onModuleInit() {
        // Subscribe to order state transitions
        this.subscription = this.eventBus
            .ofType(OrderStateTransitionEvent)
            .pipe(
                // Only process orders transitioning to PaymentSettled state
                filter(event => event.toState === 'PaymentSettled')
            )
            .subscribe(event => {
                this.syncOrderToMarketplace(event.ctx, event.order).catch(err => {
                    console.error('[OrderSync] Error syncing order:', err);
                });
            });

        console.log('[OrderSync] Service initialized - listening for order events');
    }

    async onModuleDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        await this.prisma.$disconnect();
    }

    /**
     * Sync a Vendure order to the marketplace database
     */
    async syncOrderToMarketplace(ctx: RequestContext, order: Order): Promise<void> {
        console.log(`[OrderSync] Syncing order ${order.code} to marketplace DB`);

        // Load order with all relations
        const fullOrder = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: order.id },
            relations: [
                'lines',
                'lines.productVariant',
                'lines.productVariant.product',
                'customer',
                'payments',
            ],
        });

        if (!fullOrder) {
            console.error(`[OrderSync] Order ${order.id} not found`);
            return;
        }

        // Group order lines by seller
        const sellerLineMap = new Map<string, typeof fullOrder.lines>();

        for (const line of fullOrder.lines) {
            const sellerId = (line.productVariant?.product as any)?.customFields?.sellerId;
            if (!sellerId) continue;

            if (!sellerLineMap.has(sellerId)) {
                sellerLineMap.set(sellerId, []);
            }
            sellerLineMap.get(sellerId)!.push(line);
        }

        // Get payment details
        const payment = fullOrder.payments?.[0];
        const paymentMetadata = payment?.metadata || {};

        // Create order record for each seller
        for (const [sellerId, lines] of sellerLineMap) {
            const sellerIdNum = parseInt(sellerId, 10);
            if (isNaN(sellerIdNum)) continue;

            // Calculate totals for this seller's items
            const subtotal = lines.reduce((sum, line) => sum + line.linePriceWithTax, 0);
            const commissionRate = parseFloat(paymentMetadata.commissionRate || '0.10');
            const commissionAmount = Math.round(subtotal * commissionRate);
            const vendorPayout = subtotal - commissionAmount;

            // Check if order already exists
            const existing = await this.prisma.order.findFirst({
                where: {
                    vendureOrderId: String(fullOrder.id),
                    vendorId: sellerIdNum,
                },
            });

            if (existing) {
                console.log(`[OrderSync] Order ${order.code} for seller ${sellerId} already exists`);
                continue;
            }

            // Create marketplace order record
            try {
                await this.prisma.order.create({
                    data: {
                        orderNumber: fullOrder.code,
                        vendureOrderId: String(fullOrder.id),
                        vendureParentOrderId: null,
                        vendorId: sellerIdNum,
                        buyerId: fullOrder.customer?.id ? String(fullOrder.customer.id) : '0',
                        buyerEmail: fullOrder.customer?.emailAddress || '',
                        buyerName: fullOrder.customer
                            ? `${fullOrder.customer.firstName} ${fullOrder.customer.lastName}`
                            : 'Guest',
                        subtotal: subtotal / 100, // Convert to dollars
                        shippingTotal: 0,
                        taxTotal: 0,
                        discountTotal: 0,
                        total: subtotal / 100,
                        platformFee: commissionAmount / 100,
                        vendorPayout: vendorPayout / 100,
                        commissionRate: commissionRate,
                        commissionAmount: commissionAmount / 100,
                        stripePaymentIntentId: paymentMetadata.paymentIntentId || null,
                        stripeTransferId: null,
                        stripePayoutId: null,
                        payoutMode: paymentMetadata.payoutMode || 'manual',
                        payoutStatus: 'pending',
                        payoutScheduledAt: null,
                        payoutCompletedAt: null,
                        status: 'confirmed',
                        paymentStatus: 'paid',
                        fulfillmentStatus: 'unfulfilled',
                        shippingAddress: JSON.stringify(fullOrder.shippingAddress || {}),
                        shippingMethod: null,
                        trackingNumber: null,
                        trackingUrl: null,
                        customerNotes: null,
                        internalNotes: null,
                        placedAt: fullOrder.orderPlacedAt || new Date(),
                        paidAt: new Date(),
                        fulfilledAt: null,
                        cancelledAt: null,
                        refundedAt: null,
                    },
                });

                console.log(`[OrderSync] Created marketplace order for seller ${sellerId}: ${order.code}`);

                // Update seller statistics
                await this.prisma.seller.update({
                    where: { id: sellerIdNum },
                    data: {
                        totalOrders: { increment: 1 },
                        totalRevenue: { increment: vendorPayout / 100 },
                    },
                });

                // Get the created order ID
                const createdOrder = await this.prisma.order.findFirst({
                    where: { vendureOrderId: String(fullOrder.id), vendorId: sellerIdNum }
                });

                if (!createdOrder) {
                    console.error(`[OrderSync] Created order not found for seller ${sellerId}`);
                    continue;
                }

                // Create order line records
                for (const line of lines) {
                    await this.prisma.orderLine.create({
                        data: {
                            orderId: createdOrder.id,
                            productId: null, // Link to marketplace product if exists
                            productName: line.productVariant?.name || 'Unknown Product',
                            productSku: line.productVariant?.sku || 'N/A',
                            productType: (line.productVariant?.product as any)?.customFields?.productType || 'unknown',
                            quantity: line.quantity,
                            unitPrice: line.unitPriceWithTax / 100,
                            lineTotal: line.linePriceWithTax / 100,
                            vendureOrderLineId: String(line.id),
                        },
                    });
                }

            } catch (error) {
                console.error(`[OrderSync] Error creating order for seller ${sellerId}:`, error);
            }
        }
    }

    /**
     * Manually sync an order (for testing or recovery)
     */
    async syncOrderById(ctx: RequestContext, orderId: number): Promise<boolean> {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId },
        });

        if (!order) {
            return false;
        }

        await this.syncOrderToMarketplace(ctx, order);
        return true;
    }
}
