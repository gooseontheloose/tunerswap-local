import {
    ShippingEligibilityChecker,
    LanguageCode,
    Injector,
    ChannelService,
    EntityHydrator,
    idsAreEqual,
} from '@vendure/core';

let channelService: ChannelService;
let entityHydrator: EntityHydrator;

/**
 * TunerSwap Shipping Eligibility Checker
 *
 * This checker ensures that only shipping methods belonging to the correct seller
 * are shown as options for an order. Each seller has their own shipping methods
 * assigned to their channel.
 *
 * Logic:
 * 1. A shipping method is eligible if it's assigned to a seller's channel
 *    AND that seller has at least one order line in the current order
 * 2. This prevents customers from seeing shipping options from sellers
 *    whose products are not in their cart
 */
export const tunerSwapShippingEligibilityChecker = new ShippingEligibilityChecker({
    code: 'tunerswap-multivendor-checker',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Checks that the shipping method belongs to a seller with items in the order',
        },
    ],
    args: {},

    init(injector: Injector) {
        channelService = injector.get(ChannelService);
        entityHydrator = injector.get(EntityHydrator);
    },

    /**
     * Check if a shipping method is eligible for the given order.
     *
     * Returns true if:
     * - The shipping method is assigned to a seller's channel
     * - AND that seller has at least one order line in the order
     */
    check: async (ctx, order, args, method) => {
        // Hydrate the shipping method's channels
        await entityHydrator.hydrate(ctx, method, { relations: ['channels'] });

        // Hydrate the order lines with their seller channels
        await entityHydrator.hydrate(ctx, order, { relations: ['lines.sellerChannel'] });

        const defaultChannel = await channelService.getDefaultChannel();

        // Find the seller's channel (non-default channel) that this method is assigned to
        const sellerChannel = method.channels?.find(
            (c) => c.code !== '__default_channel__' && !idsAreEqual(c.id, defaultChannel.id),
        );

        // If no seller channel found, this is a global/marketplace shipping method
        // It might be eligible for items without a seller channel
        if (!sellerChannel) {
            // Check if there are any order lines without a seller channel
            const hasUnassignedLines = order.lines.some((line) => !line.sellerChannelId);
            return hasUnassignedLines;
        }

        // Check if any order line belongs to this seller's channel
        for (const line of order.lines) {
            if (line.sellerChannelId && idsAreEqual(line.sellerChannelId, sellerChannel.id)) {
                return true;
            }
        }

        // No order lines from this seller - shipping method not eligible
        return false;
    },
});
