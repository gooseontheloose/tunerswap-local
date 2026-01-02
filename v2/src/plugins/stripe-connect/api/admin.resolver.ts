// FILE: src/plugins/stripe-connect/api/admin.resolver.ts
// PURPOSE: GraphQL resolvers for Stripe Connect admin API
// STATUS: Production-ready

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Permission, Ctx, RequestContext } from '@vendure/core';
import { CommissionService, ProductType, EarningsPreview } from '../services/commission.service';
import { StripeConnectService } from '../services/stripe-connect.service';
import { PrismaClient } from '.prisma/marketplace-client';

// =============================================================================
// TYPES
// =============================================================================

interface CommissionConfig {
  id: number;
  productType: string;
  commissionRate: number;
  fixedFee: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CommissionWithPreview {
  config: CommissionConfig;
  preview: EarningsPreview;
}

interface PendingPayoutSummary {
  vendorId: number;
  vendorName: string;
  pendingAmount: number;
  orderCount: number;
  oldestOrderDate: Date;
}

interface VendorPayoutDetails {
  vendorId: number;
  pendingAmount: number;
  orders: Array<{
    orderId: number;
    orderNumber: string;
    amount: number;
    placedAt: Date;
  }>;
}

interface PayoutResult {
  success: boolean;
  payoutId?: string;
  transferId?: string;
  amount?: number;
  error?: string;
}

interface PayoutScheduleSettings {
  payoutMode: 'INSTANT' | 'MANUAL';
  scheduleInterval: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';
  delayDays: number;
  weeklyAnchor?: string;
  monthlyAnchor?: number;
  minimumPayoutAmount: number;
  automaticPayoutsEnabled: boolean;
  statementDescriptor?: string;
}

interface PayoutScheduleResult {
  success: boolean;
  settings?: PayoutScheduleSettings;
  error?: string;
}

// =============================================================================
// RESOLVER
// =============================================================================

@Resolver()
export class StripeConnectAdminResolver {
  private prisma: PrismaClient;

  constructor(
    private commissionService: CommissionService,
    private stripeConnectService: StripeConnectService
  ) {
    this.prisma = new PrismaClient();
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  @Query()
  @Allow(Permission.SuperAdmin)
  async stripeConnectCommissions(
    @Ctx() _ctx: RequestContext
  ): Promise<CommissionWithPreview[]> {
    const rates = await this.commissionService.getAllCommissionRates();
    const previews = await this.commissionService.getAllEarningsPreviews();

    // Get full config from database
    const configs = await this.prisma.commissionConfig.findMany({
      where: { isActive: true },
    });

    const configMap = new Map(configs.map(c => [c.productType, c]));

    return rates.map(rate => {
      const dbConfig = configMap.get(rate.productType);
      return {
        config: {
          id: dbConfig?.id || 0,
          productType: rate.productType,
          commissionRate: rate.commissionRate,
          fixedFee: rate.fixedFee,
          isActive: rate.isActive,
          createdAt: dbConfig?.createdAt || new Date(),
          updatedAt: dbConfig?.updatedAt || new Date(),
        },
        preview: previews[rate.productType],
      };
    });
  }

  @Query()
  @Allow(Permission.SuperAdmin)
  async stripeConnectPayoutMode(
    @Ctx() _ctx: RequestContext
  ): Promise<'INSTANT' | 'MANUAL'> {
    const mode = this.commissionService.getPayoutMode();
    return mode.toUpperCase() as 'INSTANT' | 'MANUAL';
  }

  @Query()
  @Allow(Permission.SuperAdmin)
  async stripeConnectPendingPayouts(
    @Ctx() _ctx: RequestContext
  ): Promise<PendingPayoutSummary[]> {
    return this.commissionService.getPendingPayoutsSummary();
  }

  @Query()
  @Allow(Permission.SuperAdmin)
  async stripeConnectVendorPayout(
    @Ctx() _ctx: RequestContext,
    @Args() args: { vendorId: string }
  ): Promise<VendorPayoutDetails | null> {
    const vendorId = parseInt(args.vendorId, 10);
    if (isNaN(vendorId)) return null;

    return this.commissionService.getVendorPendingPayout(vendorId);
  }

  @Query()
  @Allow(Permission.SuperAdmin)
  async stripeConnectPayoutSchedule(
    @Ctx() _ctx: RequestContext
  ): Promise<PayoutScheduleSettings> {
    // Get platform payout mode
    const payoutMode = this.commissionService.getPayoutMode().toUpperCase() as 'INSTANT' | 'MANUAL';

    // Get all payout schedule settings from database
    const settings = await this.prisma.platformSettings.findMany({
      where: {
        key: {
          in: [
            'payout_schedule_interval',
            'payout_delay_days',
            'payout_weekly_anchor',
            'payout_monthly_anchor',
            'payout_minimum_amount',
            'payout_automatic_enabled',
            'payout_statement_descriptor',
          ],
        },
      },
    });

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    return {
      payoutMode,
      scheduleInterval: (settingsMap.get('payout_schedule_interval') || 'DAILY').toUpperCase() as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL',
      delayDays: parseInt(settingsMap.get('payout_delay_days') || '2', 10),
      weeklyAnchor: settingsMap.get('payout_weekly_anchor')?.toUpperCase() || undefined,
      monthlyAnchor: settingsMap.get('payout_monthly_anchor') ? parseInt(settingsMap.get('payout_monthly_anchor')!, 10) : undefined,
      minimumPayoutAmount: parseInt(settingsMap.get('payout_minimum_amount') || '0', 10),
      automaticPayoutsEnabled: settingsMap.get('payout_automatic_enabled') !== 'false',
      statementDescriptor: settingsMap.get('payout_statement_descriptor') || undefined,
    };
  }

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async updateCommissionRate(
    @Ctx() _ctx: RequestContext,
    @Args() args: { productType: string; commissionRate: number; fixedFee?: number }
  ): Promise<CommissionWithPreview> {
    const rate = await this.commissionService.updateCommissionRate(
      args.productType.toUpperCase() as ProductType,
      args.commissionRate,
      args.fixedFee || 0
    );

    const preview = this.commissionService.calculateEarningsPreview(rate.commissionRate);

    const dbConfig = await this.prisma.commissionConfig.findUnique({
      where: { productType: args.productType.toUpperCase() },
    });

    return {
      config: {
        id: dbConfig?.id || 0,
        productType: rate.productType,
        commissionRate: rate.commissionRate,
        fixedFee: rate.fixedFee,
        isActive: rate.isActive,
        createdAt: dbConfig?.createdAt || new Date(),
        updatedAt: dbConfig?.updatedAt || new Date(),
      },
      preview,
    };
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async setPayoutMode(
    @Ctx() _ctx: RequestContext,
    @Args() args: { mode: 'INSTANT' | 'MANUAL' }
  ): Promise<{ payoutMode: 'INSTANT' | 'MANUAL' }> {
    await this.commissionService.setPayoutMode(args.mode.toLowerCase() as 'instant' | 'manual');
    return { payoutMode: args.mode };
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async triggerVendorPayout(
    @Ctx() _ctx: RequestContext,
    @Args() args: { vendorId: string }
  ): Promise<PayoutResult> {
    const vendorId = parseInt(args.vendorId, 10);
    if (isNaN(vendorId)) {
      return { success: false, error: 'Invalid vendor ID' };
    }

    try {
      // Get vendor info
      const vendor = await this.prisma.seller.findUnique({
        where: { id: vendorId },
        select: { stripeAccountId: true, stripeConnected: true },
      });

      if (!vendor?.stripeConnected || !vendor.stripeAccountId) {
        return { success: false, error: 'Vendor does not have Stripe connected' };
      }

      // Get pending payout details
      const payoutDetails = await this.commissionService.getVendorPendingPayout(vendorId);

      if (payoutDetails.pendingAmount <= 0) {
        return { success: false, error: 'No pending payout for this vendor' };
      }

      // Convert to cents
      const amountCents = Math.round(payoutDetails.pendingAmount * 100);

      // Create transfer
      const transfer = await this.stripeConnectService.createTransfer(
        amountCents,
        vendor.stripeAccountId,
        'usd',
        {
          vendor_id: vendorId.toString(),
          order_count: payoutDetails.orders.length.toString(),
          order_ids: JSON.stringify(payoutDetails.orders.map(o => o.orderId)),
        }
      );

      // Update order payout status
      const orderIds = payoutDetails.orders.map(o => o.orderId);
      await this.prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          payoutStatus: 'paid_out',
          stripeTransferId: transfer.transferId,
          payoutCompletedAt: new Date(),
        },
      });

      // Create payout record
      const payout = await this.prisma.payout.create({
        data: {
          vendorId,
          amount: payoutDetails.pendingAmount,
          currency: 'USD',
          paymentMethod: 'STRIPE',
          stripeTransferId: transfer.transferId,
          status: 'COMPLETED',
          periodStart: payoutDetails.orders[0]?.placedAt || new Date(),
          periodEnd: new Date(),
          orderIds: JSON.stringify(orderIds),
          orderCount: orderIds.length,
          processedAt: new Date(),
        },
      });

      return {
        success: true,
        payoutId: payout.id.toString(),
        transferId: transfer.transferId,
        amount: payoutDetails.pendingAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StripeConnect] triggerVendorPayout error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async triggerBatchPayout(
    @Ctx() _ctx: RequestContext,
    @Args() args: { vendorIds: string[] }
  ): Promise<PayoutResult[]> {
    const results: PayoutResult[] = [];

    for (const vendorIdStr of args.vendorIds) {
      const result = await this.triggerVendorPayout(_ctx, { vendorId: vendorIdStr });
      results.push(result);
    }

    return results;
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async updatePayoutSchedule(
    @Ctx() _ctx: RequestContext,
    @Args() args: {
      payoutMode?: 'INSTANT' | 'MANUAL';
      scheduleInterval?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';
      delayDays?: number;
      weeklyAnchor?: string;
      monthlyAnchor?: number;
      minimumPayoutAmount?: number;
      automaticPayoutsEnabled?: boolean;
      statementDescriptor?: string;
    }
  ): Promise<PayoutScheduleResult> {
    try {
      // Update payout mode if provided
      if (args.payoutMode) {
        await this.commissionService.setPayoutMode(args.payoutMode.toLowerCase() as 'instant' | 'manual');
      }

      // Update other settings in database
      const settingsToUpdate: Array<{ key: string; value: string; description: string }> = [];

      if (args.scheduleInterval !== undefined) {
        settingsToUpdate.push({
          key: 'payout_schedule_interval',
          value: args.scheduleInterval.toLowerCase(),
          description: 'Payout schedule interval (daily, weekly, monthly, manual)',
        });
      }

      if (args.delayDays !== undefined) {
        settingsToUpdate.push({
          key: 'payout_delay_days',
          value: args.delayDays.toString(),
          description: 'Days to delay payout after payment (2-14)',
        });
      }

      if (args.weeklyAnchor !== undefined) {
        settingsToUpdate.push({
          key: 'payout_weekly_anchor',
          value: args.weeklyAnchor.toLowerCase(),
          description: 'Day of week for weekly payouts',
        });
      }

      if (args.monthlyAnchor !== undefined) {
        settingsToUpdate.push({
          key: 'payout_monthly_anchor',
          value: args.monthlyAnchor.toString(),
          description: 'Day of month for monthly payouts (1-31)',
        });
      }

      if (args.minimumPayoutAmount !== undefined) {
        settingsToUpdate.push({
          key: 'payout_minimum_amount',
          value: args.minimumPayoutAmount.toString(),
          description: 'Minimum payout amount in cents',
        });
      }

      if (args.automaticPayoutsEnabled !== undefined) {
        settingsToUpdate.push({
          key: 'payout_automatic_enabled',
          value: args.automaticPayoutsEnabled.toString(),
          description: 'Whether automatic payouts are enabled',
        });
      }

      if (args.statementDescriptor !== undefined) {
        settingsToUpdate.push({
          key: 'payout_statement_descriptor',
          value: args.statementDescriptor,
          description: 'Statement descriptor for payouts',
        });
      }

      // Upsert all settings
      for (const setting of settingsToUpdate) {
        await this.prisma.platformSettings.upsert({
          where: { key: setting.key },
          create: setting,
          update: { value: setting.value },
        });
      }

      // Return updated settings
      const updatedSettings = await this.stripeConnectPayoutSchedule(_ctx);
      return { success: true, settings: updatedSettings };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StripeConnect] updatePayoutSchedule error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}
