// FILE: src/plugins/stripe-connect/handlers/stripe-connect.handler.ts
// PURPOSE: Vendure PaymentMethodHandler for Stripe Connect payments
// STATUS: Production-ready

import {
  PaymentMethodHandler,
  LanguageCode,
  CreatePaymentResult,
  SettlePaymentResult,
  CreateRefundResult,
  CreatePaymentErrorResult,
  SettlePaymentErrorResult,
} from '@vendure/core';
import Stripe from 'stripe';
import { PrismaClient } from '.prisma/marketplace-client';

// Initialize Stripe
const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  });
};

// Get Prisma client for MarketplaceDB
const getPrisma = () => new PrismaClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the commission rate for a product type from the database
 */
async function getCommissionRate(prisma: PrismaClient, productType: string): Promise<number> {
  const config = await prisma.commissionConfig.findUnique({
    where: { productType: productType.toUpperCase() },
  });
  return config?.commissionRate ?? 0.10; // Default 10%
}

/**
 * Get the current payout mode from platform settings
 */
async function getPayoutMode(prisma: PrismaClient): Promise<'instant' | 'manual'> {
  const setting = await prisma.platformSettings.findUnique({
    where: { key: 'payout_mode' },
  });
  return (setting?.value as 'instant' | 'manual') || 'instant';
}

/**
 * Get vendor's Stripe account ID from their seller ID
 */
async function getVendorStripeAccountId(
  prisma: PrismaClient,
  vendureSellerId: string
): Promise<string | null> {
  const seller = await prisma.seller.findFirst({
    where: { vendureSellerId },
    select: { stripeAccountId: true, stripeConnected: true },
  });

  if (!seller?.stripeConnected || !seller.stripeAccountId) {
    return null;
  }

  return seller.stripeAccountId;
}

/**
 * Calculate commission for order based on product types
 */
async function calculateOrderCommission(
  prisma: PrismaClient,
  orderLines: Array<{ productType?: string; linePrice: number }>
): Promise<{ totalCommission: number; effectiveRate: number }> {
  let totalAmount = 0;
  let totalCommission = 0;

  for (const line of orderLines) {
    const productType = line.productType || 'PART';
    const rate = await getCommissionRate(prisma, productType);
    const lineCommission = Math.round(line.linePrice * rate);

    totalAmount += line.linePrice;
    totalCommission += lineCommission;
  }

  const effectiveRate = totalAmount > 0 ? totalCommission / totalAmount : 0.10;

  return { totalCommission, effectiveRate };
}

/**
 * Sync order to marketplace DB for seller/buyer dashboards
 * Called after payment is settled
 */
async function syncOrderToMarketplace(
  order: any,
  payment: any,
  paymentIntent: any
): Promise<void> {
  const prisma = getPrisma();

  try {
    // Group order lines by seller
    const sellerLines = new Map<string, any[]>();

    for (const line of order.lines || []) {
      const sellerId = line.productVariant?.product?.customFields?.sellerId;
      if (!sellerId) continue;

      if (!sellerLines.has(sellerId)) {
        sellerLines.set(sellerId, []);
      }
      sellerLines.get(sellerId)!.push(line);
    }

    // Get payment metadata
    const metadata = payment.metadata || {};
    const commissionRate = parseFloat(metadata.commissionRate || '0.10');
    const payoutMode = metadata.payoutMode || 'manual';

    // Create order record for each seller
    for (const [sellerId, lines] of sellerLines) {
      const sellerIdNum = parseInt(sellerId, 10);
      if (isNaN(sellerIdNum)) continue;

      // Calculate totals for this seller
      const subtotal = lines.reduce((sum: number, line: any) => sum + (line.linePriceWithTax || 0), 0);
      const commissionAmount = Math.round(subtotal * commissionRate);
      const vendorPayout = subtotal - commissionAmount;

      // Check if order already exists
      const existing = await prisma.order.findFirst({
        where: {
          vendureOrderId: String(order.id),
          vendorId: sellerIdNum,
        },
      });

      if (existing) {
        console.log(`[OrderSync] Order ${order.code} for seller ${sellerId} already exists`);
        continue;
      }

      // Create marketplace order
      const marketplaceOrder = await prisma.order.create({
        data: {
          orderNumber: order.code,
          vendureOrderId: String(order.id),
          vendorId: sellerIdNum,
          buyerId: order.customer?.id ? String(order.customer.id) : '0',
          buyerEmail: order.customer?.emailAddress || '',
          buyerName: order.customer
            ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Guest'
            : 'Guest',
          subtotal: subtotal / 100,
          total: subtotal / 100,
          platformFee: commissionAmount / 100,
          vendorPayout: vendorPayout / 100,
          commissionRate,
          commissionAmount: commissionAmount / 100,
          stripePaymentIntentId: paymentIntent.id,
          payoutMode,
          payoutStatus: 'pending',
          status: 'confirmed',
          paymentStatus: 'paid',
          fulfillmentStatus: 'unfulfilled',
          shippingAddress: JSON.stringify(order.shippingAddress || {}),
          placedAt: order.orderPlacedAt || new Date(),
          paidAt: new Date(),
        },
      });

      console.log(`[OrderSync] Created marketplace order ${marketplaceOrder.id} for seller ${sellerId}`);

      // Create order lines
      for (const line of lines) {
        await prisma.orderLine.create({
          data: {
            orderId: marketplaceOrder.id,
            productName: line.productVariant?.name || 'Unknown Product',
            productSku: line.productVariant?.sku || 'N/A',
            productType: line.productVariant?.product?.customFields?.productType || 'unknown',
            quantity: line.quantity,
            unitPrice: (line.unitPriceWithTax || 0) / 100,
            lineTotal: (line.linePriceWithTax || 0) / 100,
            vendureOrderLineId: String(line.id),
          },
        });
      }

      // Update seller stats
      await prisma.seller.update({
        where: { id: sellerIdNum },
        data: {
          totalOrders: { increment: 1 },
          totalRevenue: { increment: vendorPayout / 100 },
        },
      });
    }

    console.log(`[OrderSync] Synced order ${order.code} to marketplace DB`);
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================================================
// PAYMENT METHOD HANDLER
// =============================================================================

export const stripeConnectPaymentHandler = new PaymentMethodHandler({
  code: 'stripe-connect',
  description: [
    { languageCode: LanguageCode.en, value: 'Stripe Connect Payments' },
  ],
  args: {},

  /**
   * Create a payment - called when customer initiates checkout
   */
  createPayment: async (ctx, order, amount, _args, metadata): Promise<CreatePaymentResult | CreatePaymentErrorResult> => {
    const prisma = getPrisma();

    try {
      const stripe = getStripe();
      const payoutMode = await getPayoutMode(prisma);

      // Get product types from order lines for commission calculation
      const orderLines = order.lines.map(line => ({
        productType: (line.productVariant?.product?.customFields as any)?.productType || 'part',
        linePrice: line.proratedLinePrice,
      }));

      const { totalCommission, effectiveRate } = await calculateOrderCommission(prisma, orderLines);

      // Get vendor info from order
      // In multi-vendor scenario, the order may be split by seller
      const sellerChannel = order.channels?.find(c => c.code !== '__default_channel__');
      let vendorStripeAccountId: string | null = null;

      if (sellerChannel?.seller?.id) {
        vendorStripeAccountId = await getVendorStripeAccountId(prisma, String(sellerChannel.seller.id));
      }

      // If we have a vendor with Stripe connected and in instant mode, use direct transfer
      if (payoutMode === 'instant' && vendorStripeAccountId) {
        // Create PaymentIntent with automatic transfer to vendor
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: order.currencyCode.toLowerCase(),
          application_fee_amount: totalCommission,
          transfer_data: {
            destination: vendorStripeAccountId,
          },
          metadata: {
            vendure_order_id: order.id.toString(),
            vendure_order_code: order.code,
            vendor_account_id: vendorStripeAccountId,
            payout_mode: 'instant',
            commission_rate: effectiveRate.toFixed(4),
            platform: 'tunerswap',
          },
        });

        return {
          amount,
          state: 'Authorized' as const,
          transactionId: paymentIntent.id,
          metadata: {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            payoutMode: 'instant',
            vendorAccountId: vendorStripeAccountId,
            commissionAmount: totalCommission.toString(),
            commissionRate: effectiveRate.toFixed(4),
          },
        };
      } else {
        // Manual mode or no vendor Stripe account - platform holds funds
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: order.currencyCode.toLowerCase(),
          metadata: {
            vendure_order_id: order.id.toString(),
            vendure_order_code: order.code,
            payout_mode: 'manual',
            commission_rate: effectiveRate.toFixed(4),
            platform: 'tunerswap',
          },
        });

        return {
          amount,
          state: 'Authorized' as const,
          transactionId: paymentIntent.id,
          metadata: {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            payoutMode: 'manual',
            commissionAmount: totalCommission.toString(),
            commissionRate: effectiveRate.toFixed(4),
          },
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StripeConnect] createPayment error:', errorMessage);

      return {
        amount,
        state: 'Error' as const,
        errorMessage,
        metadata: {
          error: errorMessage,
        },
      };
    } finally {
      await prisma.$disconnect();
    }
  },

  /**
   * Settle a payment - called when payment is confirmed
   * For Stripe, this happens via webhook when PaymentIntent succeeds
   * Also syncs the order to marketplace DB for seller/buyer dashboards
   */
  settlePayment: async (_ctx, order, payment, _args): Promise<SettlePaymentResult | SettlePaymentErrorResult> => {
    // The payment is settled by Stripe webhook when customer completes payment
    // This handler is called to confirm the settlement

    const paymentIntentId = payment.transactionId;
    if (!paymentIntentId) {
      return {
        success: false,
        errorMessage: 'No PaymentIntent ID found',
      };
    }

    try {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') {
        let finalStatus: string = paymentIntent.status;
        let chargeId = typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;

        // Capture if needed
        if (paymentIntent.status === 'requires_capture') {
          const capturedIntent = await stripe.paymentIntents.capture(paymentIntentId);
          finalStatus = capturedIntent.status;
        }

        // Sync order to marketplace DB for seller/buyer dashboards
        try {
          await syncOrderToMarketplace(order, payment, paymentIntent);
        } catch (syncError) {
          console.error('[StripeConnect] Order sync failed (non-fatal):', syncError);
          // Don't fail the payment settlement if sync fails
        }

        return {
          success: true,
          metadata: {
            stripeStatus: finalStatus,
            chargeId,
          },
        };
      } else {
        return {
          success: false,
          errorMessage: `Payment not in valid state for settlement: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StripeConnect] settlePayment error:', errorMessage);
      return {
        success: false,
        errorMessage,
      };
    }
  },

  /**
   * Create a refund
   */
  createRefund: async (_ctx, _input, amount, order, payment, _args): Promise<CreateRefundResult> => {
    const paymentIntentId = payment.transactionId;
    if (!paymentIntentId) {
      return {
        state: 'Failed' as const,
        metadata: {
          error: 'No PaymentIntent ID found',
        },
      };
    }

    try {
      const stripe = getStripe();

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount, // In cents
        reason: 'requested_by_customer',
        reverse_transfer: true, // Reverse the transfer to vendor
        refund_application_fee: true, // Refund the platform fee
      });

      return {
        state: 'Settled' as const,
        transactionId: refund.id,
        metadata: {
          refundId: refund.id,
          refundStatus: refund.status,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StripeConnect] createRefund error:', errorMessage);

      return {
        state: 'Failed' as const,
        transactionId: undefined,
        metadata: {
          error: errorMessage,
        },
      };
    }
  },
});
