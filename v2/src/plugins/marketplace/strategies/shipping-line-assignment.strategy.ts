import {
    ShippingLineAssignmentStrategy,
    RequestContext,
    ShippingLine,
    Order,
    OrderLine,
    Injector,
    ChannelService,
    EntityHydrator,
    idsAreEqual,
} from '@vendure/core';

/**
 * TunerSwap Shipping Line Assignment Strategy
 *
 * This strategy determines which order lines should be associated with each shipping line.
 * It handles the multi-vendor scenario where:
 * - Each seller has their own shipping methods
 * - Digital products (tunes) don't need shipping
 * - Physical products (parts) need shipping from the seller
 * - Services are location-based, no shipping required
 */
export class TunerSwapShippingLineAssignmentStrategy implements ShippingLineAssignmentStrategy {
    private channelService: ChannelService;
    private entityHydrator: EntityHydrator;

    init(injector: Injector) {
        this.channelService = injector.get(ChannelService);
        this.entityHydrator = injector.get(EntityHydrator);
    }

    /**
     * Assigns a shipping line to the appropriate order lines.
     *
     * Logic:
     * 1. If the shipping method is assigned to a seller's channel, only assign
     *    order lines from that seller's channel
     * 2. Skip digital products (productType = 'tune' or isDigital = true)
     * 3. Skip services (productType = 'service')
     * 4. Only physical parts need shipping
     */
    async assignShippingLineToOrderLines(
        ctx: RequestContext,
        shippingLine: ShippingLine,
        order: Order,
    ): Promise<OrderLine[]> {
        const defaultChannel = await this.channelService.getDefaultChannel();

        // Hydrate the shipping method's channels
        await this.entityHydrator.hydrate(ctx, shippingLine, {
            relations: ['shippingMethod.channels'],
        });

        // Hydrate order lines with product variant and custom fields
        await this.entityHydrator.hydrate(ctx, order, {
            relations: ['lines.productVariant.product'],
        });

        const { channels } = shippingLine.shippingMethod;

        // If the shipping method is assigned to exactly 2 channels,
        // one is the default and one is the seller's channel
        if (channels && channels.length === 2) {
            const sellerChannel = channels.find((c) => !idsAreEqual(c.id, defaultChannel.id));

            if (sellerChannel) {
                // Filter order lines that:
                // 1. Belong to this seller's channel
                // 2. Are physical products (not digital tunes or services)
                return order.lines.filter((line) => {
                    // Check if line belongs to this seller
                    if (!idsAreEqual(line.sellerChannelId, sellerChannel.id)) {
                        return false;
                    }

                    // Check product type - skip digital and services
                    const product = line.productVariant?.product;
                    const customFields = product?.customFields as any;

                    if (customFields) {
                        // Skip digital products
                        if (customFields.isDigital === true) {
                            return false;
                        }
                        // Skip tunes (digital) and services (no shipping)
                        if (customFields.productType === 'tune' || customFields.productType === 'service') {
                            return false;
                        }
                    }

                    // Physical parts need shipping
                    return true;
                });
            }
        }

        // Default behavior: assign all physical product lines to the shipping line
        return order.lines.filter((line) => {
            const product = line.productVariant?.product;
            const customFields = product?.customFields as any;

            if (customFields) {
                if (customFields.isDigital === true) {
                    return false;
                }
                if (customFields.productType === 'tune' || customFields.productType === 'service') {
                    return false;
                }
            }

            return true;
        });
    }
}
