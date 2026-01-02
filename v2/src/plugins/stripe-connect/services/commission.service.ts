// FILE: src/plugins/stripe-connect/services/commission.service.ts
// PURPOSE: Commission calculation and configuration service
// STATUS: Production-ready

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '.prisma/marketplace-client';

// =============================================================================
// TYPES
// =============================================================================

export type ProductType = 'TUNE' | 'PART' | 'SERVICE' | 'CUSTOM_INVOICE';

export interface CommissionRate {
  productType: ProductType;
  commissionRate: number; // Decimal (e.g., 0.10 for 10%)
  fixedFee: number; // In cents
  isActive: boolean;
}

export interface CommissionBreakdown {
  subtotal: number; // Order subtotal in cents
  commissionRate: number; // Rate applied
  commissionAmount: number; // Platform commission in cents
  vendorPayout: number; // Amount vendor receives in cents
  stripeFee: number; // Estimated Stripe fee in cents
  netPlatformEarnings: number; // Commission minus Stripe fees in cents
}

export interface EarningsPreview {
  grossCommission: number; // What platform earns before Stripe fees
  stripeFee: number; // Stripe processing fee
  netEarnings: number; // What platform actually keeps
  perHundredDollars: { // Breakdown per $100 sale
    gross: number;
    stripeFee: number;
    net: number;
  };
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class CommissionService implements OnModuleInit {
  private prisma: PrismaClient;
  private commissionCache: Map<ProductType, CommissionRate> = new Map();
  private payoutMode: 'instant' | 'manual' = 'instant';

  constructor() {
    this.prisma = new PrismaClient();
  }

  async onModuleInit() {
    await this.loadCommissionRates();
    await this.loadPayoutMode();
  }

  // ===========================================================================
  // INITIALIZATION & CACHING
  // ===========================================================================

  /**
   * Load commission rates from database into cache
   */
  async loadCommissionRates(): Promise<void> {
    const configs = await this.prisma.commissionConfig.findMany({
      where: { isActive: true },
    });

    this.commissionCache.clear();

    for (const config of configs) {
      this.commissionCache.set(config.productType as ProductType, {
        productType: config.productType as ProductType,
        commissionRate: config.commissionRate,
        fixedFee: config.fixedFee,
        isActive: config.isActive,
      });
    }

    // Set defaults if not configured
    const defaultRate = 0.10; // 10%
    const productTypes: ProductType[] = ['TUNE', 'PART', 'SERVICE', 'CUSTOM_INVOICE'];

    for (const type of productTypes) {
      if (!this.commissionCache.has(type)) {
        this.commissionCache.set(type, {
          productType: type,
          commissionRate: defaultRate,
          fixedFee: 0,
          isActive: true,
        });
      }
    }
  }

  /**
   * Load payout mode from database
   */
  async loadPayoutMode(): Promise<void> {
    const setting = await this.prisma.platformSettings.findUnique({
      where: { key: 'payout_mode' },
    });

    this.payoutMode = (setting?.value as 'instant' | 'manual') || 'instant';
  }

  // ===========================================================================
  // COMMISSION CONFIGURATION
  // ===========================================================================

  /**
   * Get all commission rates
   */
  async getAllCommissionRates(): Promise<CommissionRate[]> {
    await this.loadCommissionRates();
    return Array.from(this.commissionCache.values());
  }

  /**
   * Get commission rate for a specific product type
   */
  getCommissionRate(productType: ProductType): CommissionRate {
    return this.commissionCache.get(productType) || {
      productType,
      commissionRate: 0.10, // Default 10%
      fixedFee: 0,
      isActive: true,
    };
  }

  /**
   * Update commission rate for a product type
   */
  async updateCommissionRate(
    productType: ProductType,
    commissionRate: number,
    fixedFee: number = 0
  ): Promise<CommissionRate> {
    const result = await this.prisma.commissionConfig.upsert({
      where: { productType },
      create: {
        productType,
        commissionRate,
        fixedFee,
        isActive: true,
      },
      update: {
        commissionRate,
        fixedFee,
      },
    });

    // Update cache
    const rate: CommissionRate = {
      productType: result.productType as ProductType,
      commissionRate: result.commissionRate,
      fixedFee: result.fixedFee,
      isActive: result.isActive,
    };
    this.commissionCache.set(productType, rate);

    return rate;
  }

  // ===========================================================================
  // PAYOUT MODE
  // ===========================================================================

  /**
   * Get current payout mode
   */
  getPayoutMode(): 'instant' | 'manual' {
    return this.payoutMode;
  }

  /**
   * Set payout mode
   */
  async setPayoutMode(mode: 'instant' | 'manual'): Promise<void> {
    await this.prisma.platformSettings.upsert({
      where: { key: 'payout_mode' },
      create: {
        key: 'payout_mode',
        value: mode,
        description: 'Payout mode: instant (auto-transfer on payment) or manual (admin triggers)',
      },
      update: {
        value: mode,
      },
    });

    this.payoutMode = mode;
  }

  // ===========================================================================
  // COMMISSION CALCULATIONS
  // ===========================================================================

  /**
   * Calculate commission breakdown for an order
   */
  calculateCommission(
    subtotalCents: number,
    productType: ProductType
  ): CommissionBreakdown {
    const rate = this.getCommissionRate(productType);

    // Calculate commission
    const percentageCommission = Math.round(subtotalCents * rate.commissionRate);
    const commissionAmount = percentageCommission + rate.fixedFee;

    // Vendor gets the rest
    const vendorPayout = subtotalCents - commissionAmount;

    // Calculate Stripe fee (2.9% + $0.30)
    // This is taken from the total transaction, proportionally affects both parties
    const stripeFee = Math.round(subtotalCents * 0.029) + 30;

    // Platform's net earnings after Stripe takes their cut
    // Platform's share of Stripe fees = proportional to commission / total
    const platformStripeFeeShare = Math.round(stripeFee * (commissionAmount / subtotalCents));
    const netPlatformEarnings = commissionAmount - platformStripeFeeShare;

    return {
      subtotal: subtotalCents,
      commissionRate: rate.commissionRate,
      commissionAmount,
      vendorPayout,
      stripeFee,
      netPlatformEarnings,
    };
  }

  /**
   * Calculate commission for a multi-item order with mixed product types
   */
  calculateMixedOrderCommission(
    items: Array<{ amountCents: number; productType: ProductType }>
  ): CommissionBreakdown {
    let totalSubtotal = 0;
    let totalCommission = 0;

    for (const item of items) {
      const breakdown = this.calculateCommission(item.amountCents, item.productType);
      totalSubtotal += item.amountCents;
      totalCommission += breakdown.commissionAmount;
    }

    const vendorPayout = totalSubtotal - totalCommission;
    const stripeFee = Math.round(totalSubtotal * 0.029) + 30;
    const platformStripeFeeShare = Math.round(stripeFee * (totalCommission / totalSubtotal));
    const netPlatformEarnings = totalCommission - platformStripeFeeShare;

    // Calculate effective rate
    const effectiveRate = totalSubtotal > 0 ? totalCommission / totalSubtotal : 0;

    return {
      subtotal: totalSubtotal,
      commissionRate: effectiveRate,
      commissionAmount: totalCommission,
      vendorPayout,
      stripeFee,
      netPlatformEarnings,
    };
  }

  // ===========================================================================
  // EARNINGS PREVIEW (For Admin UI)
  // ===========================================================================

  /**
   * Calculate earnings preview for admin UI
   * Shows what platform earns at current rate per $100 sale
   */
  calculateEarningsPreview(commissionRate: number): EarningsPreview {
    // Calculate for a $100 sale (10000 cents)
    const saleAmountCents = 10000;

    // Gross commission
    const grossCommission = Math.round(saleAmountCents * commissionRate);

    // Stripe fee on the total transaction (2.9% + $0.30)
    const totalStripeFee = Math.round(saleAmountCents * 0.029) + 30;

    // Platform's proportional share of Stripe fee
    const platformStripeFeeShare = Math.round(totalStripeFee * commissionRate);

    // Net earnings
    const netEarnings = grossCommission - platformStripeFeeShare;

    return {
      grossCommission,
      stripeFee: platformStripeFeeShare,
      netEarnings,
      perHundredDollars: {
        gross: grossCommission / 100, // Convert cents to dollars
        stripeFee: platformStripeFeeShare / 100,
        net: netEarnings / 100,
      },
    };
  }

  /**
   * Get earnings preview for all product types
   */
  async getAllEarningsPreviews(): Promise<Record<ProductType, EarningsPreview>> {
    const rates = await this.getAllCommissionRates();
    const previews: Record<string, EarningsPreview> = {};

    for (const rate of rates) {
      previews[rate.productType] = this.calculateEarningsPreview(rate.commissionRate);
    }

    return previews as Record<ProductType, EarningsPreview>;
  }

  // ===========================================================================
  // PAYOUT CALCULATIONS
  // ===========================================================================

  /**
   * Get pending payouts summary for all vendors
   */
  async getPendingPayoutsSummary(): Promise<Array<{
    vendorId: number;
    vendorName: string;
    pendingAmount: number;
    orderCount: number;
    oldestOrderDate: Date;
  }>> {
    const pendingOrders = await this.prisma.order.groupBy({
      by: ['vendorId'],
      where: {
        payoutStatus: 'pending',
        paymentStatus: 'PAID',
      },
      _sum: {
        vendorPayout: true,
      },
      _count: {
        id: true,
      },
      _min: {
        placedAt: true,
      },
    });

    const vendorIds = pendingOrders.map(o => o.vendorId);
    const vendors = await this.prisma.seller.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, firstName: true, lastName: true, businessName: true },
    });

    const vendorMap = new Map(vendors.map(v => [v.id, v]));

    return pendingOrders.map(order => {
      const vendor = vendorMap.get(order.vendorId);
      const vendorName = vendor?.businessName ||
        `${vendor?.firstName || ''} ${vendor?.lastName || ''}`.trim() ||
        `Vendor #${order.vendorId}`;

      return {
        vendorId: order.vendorId,
        vendorName,
        pendingAmount: order._sum.vendorPayout || 0,
        orderCount: order._count.id,
        oldestOrderDate: order._min.placedAt || new Date(),
      };
    });
  }

  /**
   * Get detailed pending payout for a specific vendor
   */
  async getVendorPendingPayout(vendorId: number): Promise<{
    vendorId: number;
    pendingAmount: number;
    orders: Array<{
      orderId: number;
      orderNumber: string;
      amount: number;
      placedAt: Date;
    }>;
  }> {
    const orders = await this.prisma.order.findMany({
      where: {
        vendorId,
        payoutStatus: 'pending',
        paymentStatus: 'PAID',
      },
      select: {
        id: true,
        orderNumber: true,
        vendorPayout: true,
        placedAt: true,
      },
      orderBy: { placedAt: 'asc' },
    });

    const totalPending = orders.reduce((sum, o) => sum + o.vendorPayout, 0);

    return {
      vendorId,
      pendingAmount: totalPending,
      orders: orders.map(o => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        amount: o.vendorPayout,
        placedAt: o.placedAt,
      })),
    };
  }

  // ===========================================================================
  // SEED DEFAULT RATES
  // ===========================================================================

  /**
   * Seed default commission rates if not already configured
   */
  async seedDefaultRates(): Promise<void> {
    const defaultRates: Array<{ productType: ProductType; rate: number }> = [
      { productType: 'TUNE', rate: 0.10 },
      { productType: 'PART', rate: 0.10 },
      { productType: 'SERVICE', rate: 0.10 },
      { productType: 'CUSTOM_INVOICE', rate: 0.10 },
    ];

    for (const { productType, rate } of defaultRates) {
      await this.prisma.commissionConfig.upsert({
        where: { productType },
        create: {
          productType,
          commissionRate: rate,
          fixedFee: 0,
          isActive: true,
        },
        update: {}, // Don't update if exists
      });
    }

    // Seed default payout mode
    await this.prisma.platformSettings.upsert({
      where: { key: 'payout_mode' },
      create: {
        key: 'payout_mode',
        value: 'instant',
        description: 'Payout mode: instant (auto-transfer on payment) or manual (admin triggers)',
      },
      update: {}, // Don't update if exists
    });

    await this.loadCommissionRates();
    await this.loadPayoutMode();
  }

  /**
   * Disconnect Prisma client (for graceful shutdown)
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
