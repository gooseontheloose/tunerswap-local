// FILE: src/plugins/stripe-connect/stripe-connect.plugin.ts
// PURPOSE: Vendure plugin for Stripe Connect integration
// STATUS: Production-ready

import {
  PluginCommonModule,
  VendurePlugin,
  Type,
} from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { StripeConnectService } from './services/stripe-connect.service';
import { CommissionService } from './services/commission.service';
import { adminApiExtensions } from './api/admin-api-extensions';
import { StripeConnectAdminResolver } from './api/admin.resolver';

// =============================================================================
// PLUGIN OPTIONS
// =============================================================================

export interface StripeConnectPluginOptions {
  /**
   * Stripe Secret Key (starts with sk_)
   * Can also be set via STRIPE_SECRET_KEY environment variable
   */
  apiKey?: string;

  /**
   * Stripe Webhook Secret (starts with whsec_)
   * Can also be set via STRIPE_WEBHOOK_SECRET environment variable
   */
  webhookSecret?: string;

  /**
   * Base URL for OAuth redirect URLs
   * Defaults to WEBSITE_URL environment variable
   */
  websiteUrl?: string;

  /**
   * Default commission rate for new product types
   * Defaults to 0.10 (10%)
   */
  defaultCommissionRate?: number;

  /**
   * Default payout mode
   * Defaults to 'instant'
   */
  defaultPayoutMode?: 'instant' | 'manual';
}

export const STRIPE_CONNECT_PLUGIN_OPTIONS = 'STRIPE_CONNECT_PLUGIN_OPTIONS';

// =============================================================================
// PLUGIN
// =============================================================================

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    StripeConnectService,
    CommissionService,
    {
      provide: STRIPE_CONNECT_PLUGIN_OPTIONS,
      useFactory: () => StripeConnectPlugin.options,
    },
  ],
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [StripeConnectAdminResolver],
  },
  // Dashboard extension for commission settings UI
  dashboard: './ui/routes.tsx',
  compatibility: '^3.0.0',
})
export class StripeConnectPlugin implements OnApplicationBootstrap {
  /**
   * Plugin options set at startup
   */
  static options: StripeConnectPluginOptions = {
    defaultCommissionRate: 0.10,
    defaultPayoutMode: 'instant',
  };

  constructor(
    private moduleRef: ModuleRef,
    private commissionService: CommissionService
  ) {}

  /**
   * Initialize the plugin with custom options
   */
  static init(options?: Partial<StripeConnectPluginOptions>): Type<StripeConnectPlugin> {
    StripeConnectPlugin.options = {
      ...StripeConnectPlugin.options,
      ...options,
    };
    return StripeConnectPlugin;
  }

  /**
   * On application bootstrap, seed default commission rates
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.commissionService.seedDefaultRates();
      console.log('[StripeConnect] Default commission rates seeded');
    } catch (error) {
      console.error('[StripeConnect] Failed to seed default rates:', error);
    }
  }
}

// Re-export services and types
export { StripeConnectService } from './services/stripe-connect.service';
export { CommissionService } from './services/commission.service';
export { stripeConnectPaymentHandler } from './handlers/stripe-connect.handler';
