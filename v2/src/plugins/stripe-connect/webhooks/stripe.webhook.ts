// FILE: src/plugins/stripe-connect/webhooks/stripe.webhook.ts
// PURPOSE: Stripe webhook handler for payment and account events
// STATUS: Production-ready

import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '.prisma/marketplace-client';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Prisma client for database operations
const prisma = new PrismaClient();

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

/**
 * Express middleware for handling Stripe webhooks
 * Mount this at /webhooks/stripe in your Express app
 */
export async function stripeWebhookHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body, // Must be raw body, not parsed JSON
      signature,
      WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    // Handle different event types
    switch (event.type) {
      // =======================================================================
      // ACCOUNT EVENTS
      // =======================================================================

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      // =======================================================================
      // PAYMENT INTENT EVENTS
      // =======================================================================

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      // =======================================================================
      // TRANSFER EVENTS (for manual payout mode)
      // =======================================================================

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(transfer);
        break;
      }

      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferFailed(transfer);
        break;
      }

      // =======================================================================
      // PAYOUT EVENTS
      // =======================================================================

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        console.log(`[Stripe Webhook] Payout paid: ${payout.id}`);
        // This is when funds actually reach the vendor's bank account
        // You may want to send a notification to the vendor
        break;
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        console.log(`[Stripe Webhook] Payout failed: ${payout.id}`);
        // Handle payout failure - may need to retry or notify admin
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
    res.status(500).send('Webhook processing failed');
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle account.updated event
 * Updates seller's Stripe status in the database
 */
async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  console.log(`[Stripe Webhook] Account updated: ${account.id}`);

  // Find seller by Stripe account ID
  const seller = await prisma.seller.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (!seller) {
    console.log(`[Stripe Webhook] No seller found for account: ${account.id}`);
    return;
  }

  // Determine status
  let status = 'pending';
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'enabled';
  } else if (account.requirements?.disabled_reason) {
    status = 'disabled';
  } else if (account.requirements?.currently_due?.length) {
    status = 'restricted';
  }

  // Update seller record
  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      stripeConnected: account.charges_enabled && account.payouts_enabled,
      stripeAccountStatus: status,
      stripePayoutsEnabled: account.payouts_enabled ?? false,
      stripeChargesEnabled: account.charges_enabled ?? false,
      stripeDetailsSubmitted: account.details_submitted ?? false,
      stripeOnboardingComplete: account.details_submitted && account.charges_enabled,
    },
  });

  console.log(`[Stripe Webhook] Updated seller ${seller.id} Stripe status to: ${status}`);
}

/**
 * Handle payment_intent.succeeded event
 * Updates order payment status and triggers order processing
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(`[Stripe Webhook] PaymentIntent succeeded: ${paymentIntent.id}`);

  const vendureOrderId = paymentIntent.metadata?.vendure_order_id;
  if (!vendureOrderId) {
    console.log('[Stripe Webhook] No vendure_order_id in metadata, skipping');
    return;
  }

  // Find order by Stripe payment intent ID or Vendure order ID
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { stripePaymentIntentId: paymentIntent.id },
        { vendureOrderId: vendureOrderId },
      ],
    },
  });

  if (!order) {
    console.log(`[Stripe Webhook] No order found for payment intent: ${paymentIntent.id}`);
    return;
  }

  // Update order status
  const payoutMode = paymentIntent.metadata?.payout_mode || 'instant';

  await prisma.order.update({
    where: { id: order.id },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus: 'PAID',
      paidAt: new Date(),
      status: 'CONFIRMED',
      payoutStatus: payoutMode === 'instant' ? 'transferred' : 'held',
      payoutMode,
    },
  });

  console.log(`[Stripe Webhook] Updated order ${order.id} to PAID`);

  // If instant mode, funds are already transferred to vendor
  if (payoutMode === 'instant') {
    console.log(`[Stripe Webhook] Order ${order.id} - instant payout completed`);
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(`[Stripe Webhook] PaymentIntent failed: ${paymentIntent.id}`);

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
  });

  if (order) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'FAILED',
        payoutStatus: 'failed',
      },
    });

    console.log(`[Stripe Webhook] Updated order ${order.id} to FAILED`);
  }
}

/**
 * Handle transfer.created event (manual payout mode)
 */
async function handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
  console.log(`[Stripe Webhook] Transfer created: ${transfer.id}`);

  const payoutId = transfer.metadata?.payout_id;
  if (payoutId) {
    await prisma.payout.update({
      where: { id: parseInt(payoutId, 10) },
      data: {
        stripeTransferId: transfer.id,
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Updated payout ${payoutId} with transfer ${transfer.id}`);
  }
}

/**
 * Handle transfer.failed event
 */
async function handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
  console.log(`[Stripe Webhook] Transfer failed: ${transfer.id}`);

  const payout = await prisma.payout.findFirst({
    where: { stripeTransferId: transfer.id },
  });

  if (payout) {
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'Transfer failed',
      },
    });

    // Also update the orders back to pending
    const orderIds = JSON.parse(payout.orderIds || '[]');
    if (orderIds.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { payoutStatus: 'pending' },
      });
    }

    console.log(`[Stripe Webhook] Updated payout ${payout.id} to FAILED`);
  }
}

// =============================================================================
// EXPRESS MIDDLEWARE SETUP
// =============================================================================

/**
 * Raw body parser for Stripe webhooks
 * Stripe requires the raw body for signature verification
 */
export function stripeRawBodyParser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.originalUrl === '/webhooks/stripe') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      (req as any).rawBody = data;
      req.body = data;
      next();
    });
  } else {
    next();
  }
}
