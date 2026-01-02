import {
    OrderSellerStrategy,
    SplitOrderContents,
    RequestContext,
    OrderLine,
    Order,
    Channel,
    Injector,
    ChannelService,
    EntityHydrator,
    idsAreEqual,
    ID,
} from '@vendure/core';

/**
 * TunerSwap Order Seller Strategy
 *
 * This strategy handles the multi-vendor order flow:
 * 1. When an item is added to cart, assigns the OrderLine to the correct seller's channel
 * 2. At checkout, splits the order into separate orders per seller
 * 3. After splitting, can apply platform fees (placeholder for now)
 */
export class TunerSwapOrderSellerStrategy implements OrderSellerStrategy {
    private channelService: ChannelService;
    private entityHydrator: EntityHydrator;

    init(injector: Injector) {
        this.channelService = injector.get(ChannelService);
        this.entityHydrator = injector.get(EntityHydrator);
    }

    /**
     * Called when an item is added to an order via addItemToOrder mutation.
     * Determines which seller's channel this order line belongs to.
     *
     * Products are assigned to both the default channel AND the seller's channel.
     * We find the seller's channel (the non-default one) and return it.
     */
    async setOrderLineSellerChannel(
        ctx: RequestContext,
        orderLine: OrderLine,
    ): Promise<Channel | undefined> {
        // Hydrate the product variant's channels
        await this.entityHydrator.hydrate(ctx, orderLine.productVariant, {
            relations: ['channels'],
        });

        const defaultChannel = await this.channelService.getDefaultChannel();

        // If a ProductVariant is assigned to exactly 2 Channels, then one is the default Channel
        // and the other is the seller's Channel.
        if (orderLine.productVariant.channels.length === 2) {
            const sellerChannel = orderLine.productVariant.channels.find(
                (c) => !idsAreEqual(c.id, defaultChannel.id),
            );
            if (sellerChannel) {
                return sellerChannel;
            }
        }

        // If the product is only in the default channel or multiple seller channels,
        // we don't assign a seller channel (treated as marketplace-owned product)
        return undefined;
    }

    /**
     * Called at checkout to split the order into multiple orders (one per seller).
     *
     * Groups order lines by their sellerChannelId and creates a SplitOrderContents
     * for each group.
     */
    async splitOrder(ctx: RequestContext, order: Order): Promise<SplitOrderContents[]> {
        await this.entityHydrator.hydrate(ctx, order, {
            relations: ['lines.sellerChannel', 'shippingLines.shippingMethod.channels'],
        });

        const defaultChannel = await this.channelService.getDefaultChannel();

        // Group order lines by seller channel
        const linesByChannel = new Map<ID | 'default', OrderLine[]>();

        for (const line of order.lines) {
            const channelId = line.sellerChannelId ?? 'default';
            const existing = linesByChannel.get(channelId) || [];
            existing.push(line);
            linesByChannel.set(channelId, existing);
        }

        // Create split contents for each seller
        const splitContents: SplitOrderContents[] = [];

        for (const [channelId, lines] of linesByChannel.entries()) {
            if (channelId === 'default') {
                // Lines without a seller channel stay in the default/aggregate order
                continue;
            }

            // Find shipping lines that belong to this seller
            const sellerShippingLines = order.shippingLines.filter((sl) => {
                if (!sl.shippingMethod?.channels) return false;
                return sl.shippingMethod.channels.some(
                    (c) => idsAreEqual(c.id, channelId) && !idsAreEqual(c.id, defaultChannel.id),
                );
            });

            splitContents.push({
                channelId: channelId as ID,
                state: 'ArrangingPayment' as const,
                lines,
                shippingLines: sellerShippingLines,
            });
        }

        return splitContents;
    }

    /**
     * Called after seller orders are created from the split.
     * Can be used to apply platform fees, notify sellers, etc.
     *
     * For now, this is a placeholder. Platform fees would be implemented here
     * when Stripe Connect or similar payment splitting is added.
     */
    async afterSellerOrdersCreated(
        ctx: RequestContext,
        aggregateOrder: Order,
        sellerOrders: Order[],
    ): Promise<void> {
        // Placeholder for platform fee calculation
        // In a full implementation, you would:
        // 1. Calculate the platform fee (e.g., 10% of order total)
        // 2. Apply surcharges to each seller order
        // 3. Record the fee for payment disbursement

        for (const sellerOrder of sellerOrders) {
            console.log(
                `Seller order ${sellerOrder.code} created from aggregate ${aggregateOrder.code}`,
            );
        }
    }
}

