// FILE: src/plugins/stripe-connect/services/stripe-connect.service.ts
// PURPOSE: Stripe Connect API service for vendor onboarding and payments
// STATUS: Production-ready

import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateConnectAccountInput {
  email: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
}

export interface ConnectAccountStatus {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: 'pending' | 'enabled' | 'restricted' | 'disabled';
}

export interface OnboardingLinkResult {
  url: string;
  expiresAt: Date;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export interface TransferResult {
  transferId: string;
  amount: number;
  status: string;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class StripeConnectService {
  private stripe: Stripe | null = null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.warn('[StripeConnect] STRIPE_SECRET_KEY not set - Stripe Connect will not function');
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-12-15.clover',
      });
    }
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }
    return this.stripe;
  }

  // ===========================================================================
  // ACCOUNT MANAGEMENT
  // ===========================================================================

  /**
   * Create a Stripe Connect Express account for a vendor
   */
  async createConnectAccount(input: CreateConnectAccountInput): Promise<string> {
    const account = await this.getStripe().accounts.create({
      type: 'express',
      country: input.country || 'US',
      email: input.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: input.businessName,
      },
      individual: input.firstName && input.lastName ? {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
      } : undefined,
      metadata: {
        platform: 'tunerswap',
      },
    });

    return account.id;
  }

  /**
   * Generate an onboarding link for a Connect account
   */
  async getOnboardingLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<OnboardingLinkResult> {
    const accountLink = await this.getStripe().accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return {
      url: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000),
    };
  }

  /**
   * Generate a login link to the Stripe Express Dashboard
   */
  async getDashboardLink(accountId: string): Promise<string> {
    const loginLink = await this.getStripe().accounts.createLoginLink(accountId);
    return loginLink.url;
  }

  /**
   * Get the current status of a Connect account
   */
  async getAccountStatus(accountId: string): Promise<ConnectAccountStatus> {
    const account = await this.getStripe().accounts.retrieve(accountId);

    let status: ConnectAccountStatus['status'] = 'pending';
    if (account.charges_enabled && account.payouts_enabled) {
      status = 'enabled';
    } else if (account.requirements?.disabled_reason) {
      status = 'disabled';
    } else if (account.requirements?.currently_due?.length) {
      status = 'restricted';
    }

    return {
      accountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
      status,
    };
  }

  /**
   * Delete/disconnect a Connect account (for testing)
   */
  async deleteAccount(accountId: string): Promise<void> {
    await this.getStripe().accounts.del(accountId);
  }

  // ===========================================================================
  // PAYMENT INTENTS - INSTANT MODE (Direct Charges with Transfer)
  // ===========================================================================

  /**
   * Create a PaymentIntent with automatic transfer to the vendor
   * Platform fee is deducted from the vendor's portion
   *
   * @param amountCents - Total amount in cents
   * @param vendorAccountId - Vendor's Stripe Connect account ID
   * @param platformFeeCents - Platform commission in cents
   * @param currency - Currency code (default: usd)
   * @param metadata - Additional metadata to store
   */
  async createPaymentIntentWithTransfer(
    amountCents: number,
    vendorAccountId: string,
    platformFeeCents: number,
    currency: string = 'usd',
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntentResult> {
    const paymentIntent = await this.getStripe().paymentIntents.create({
      amount: amountCents,
      currency,
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: vendorAccountId,
      },
      metadata: {
        ...metadata,
        platform: 'tunerswap',
        payout_mode: 'instant',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  // ===========================================================================
  // PAYMENT INTENTS - MANUAL MODE (Platform holds funds)
  // ===========================================================================

  /**
   * Create a PaymentIntent without automatic transfer
   * Funds are held by the platform for manual payout later
   */
  async createPaymentIntentManual(
    amountCents: number,
    currency: string = 'usd',
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntentResult> {
    const paymentIntent = await this.getStripe().paymentIntents.create({
      amount: amountCents,
      currency,
      metadata: {
        ...metadata,
        platform: 'tunerswap',
        payout_mode: 'manual',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Retrieve a PaymentIntent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.getStripe().paymentIntents.retrieve(paymentIntentId);
  }

  // ===========================================================================
  // TRANSFERS (For Manual Payout Mode)
  // ===========================================================================

  /**
   * Create a transfer to a vendor's Connect account
   * Used in manual payout mode
   */
  async createTransfer(
    amountCents: number,
    vendorAccountId: string,
    currency: string = 'usd',
    metadata: Record<string, string> = {}
  ): Promise<TransferResult> {
    const transfer = await this.getStripe().transfers.create({
      amount: amountCents,
      currency,
      destination: vendorAccountId,
      metadata: {
        ...metadata,
        platform: 'tunerswap',
      },
    });

    return {
      transferId: transfer.id,
      amount: transfer.amount,
      status: transfer.reversed ? 'reversed' : 'completed',
    };
  }

  /**
   * Create multiple transfers in a batch (for batch payouts)
   */
  async createBatchTransfers(
    transfers: Array<{
      amountCents: number;
      vendorAccountId: string;
      metadata?: Record<string, string>;
    }>,
    currency: string = 'usd'
  ): Promise<TransferResult[]> {
    const results: TransferResult[] = [];

    for (const t of transfers) {
      try {
        const result = await this.createTransfer(
          t.amountCents,
          t.vendorAccountId,
          currency,
          t.metadata || {}
        );
        results.push(result);
      } catch (error) {
        results.push({
          transferId: '',
          amount: t.amountCents,
          status: 'failed',
        });
        console.error(`[StripeConnect] Transfer failed for ${t.vendorAccountId}:`, error);
      }
    }

    return results;
  }

  /**
   * Retrieve a transfer
   */
  async getTransfer(transferId: string): Promise<Stripe.Transfer> {
    return this.getStripe().transfers.retrieve(transferId);
  }

  /**
   * Reverse a transfer (for refunds)
   */
  async reverseTransfer(transferId: string, amountCents?: number): Promise<Stripe.TransferReversal> {
    return this.getStripe().transfers.createReversal(transferId, {
      amount: amountCents,
    });
  }

  // ===========================================================================
  // REFUNDS
  // ===========================================================================

  /**
   * Create a refund for a payment
   * When using Connect, this automatically reverses the transfer
   */
  async createRefund(
    paymentIntentId: string,
    amountCents?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  ): Promise<Stripe.Refund> {
    return this.getStripe().refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents, // undefined = full refund
      reason,
      reverse_transfer: true, // Automatically reverse the transfer to vendor
      refund_application_fee: true, // Refund platform fee as well
    });
  }

  // ===========================================================================
  // BALANCE & PAYOUTS
  // ===========================================================================

  /**
   * Get the platform's Stripe balance
   */
  async getPlatformBalance(): Promise<Stripe.Balance> {
    return this.getStripe().balance.retrieve();
  }

  /**
   * Get a vendor's Connect account balance
   */
  async getVendorBalance(vendorAccountId: string): Promise<Stripe.Balance> {
    return this.getStripe().balance.retrieve({
      stripeAccount: vendorAccountId,
    });
  }

  // ===========================================================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ===========================================================================

  /**
   * Verify a webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    return this.getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Calculate Stripe's processing fee for a given amount
   * Standard fee: 2.9% + $0.30
   * This is deducted from the total, not added
   */
  calculateStripeFee(amountCents: number): number {
    const percentageFee = Math.round(amountCents * 0.029);
    const fixedFee = 30; // $0.30 in cents
    return percentageFee + fixedFee;
  }

  /**
   * Calculate net amount after Stripe fees
   */
  calculateNetAfterStripeFees(grossAmountCents: number): number {
    const stripeFee = this.calculateStripeFee(grossAmountCents);
    return grossAmountCents - stripeFee;
  }
}
