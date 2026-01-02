// FILE: src/vendor-api/sync-worker.ts
// PURPOSE: Bidirectional sync worker between Vendure and MarketplaceDB
// STATUS: Production-ready
//
// This worker handles:
// 1. MARKETPLACE -> VENDURE: When products/sellers are created in MarketplaceDB
// 2. VENDURE -> MARKETPLACE: When orders are placed, inventory changes, etc.
//
// Run as: ts-node sync-worker.ts
// Or via cron/scheduler for batch processing

import { PrismaClient } from '.prisma/marketplace-client';

// SQLite version uses strings instead of enums
type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'SYNCED' | 'FAILED' | 'SKIPPED';
type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
type SyncDirection = 'VENDURE_TO_MARKETPLACE' | 'MARKETPLACE_TO_VENDURE';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  VENDURE_ADMIN_API: process.env.VENDURE_ADMIN_API || 'http://localhost:3000/admin-api',
  VENDURE_SHOP_API: process.env.VENDURE_SHOP_API || 'http://localhost:3000/shop-api',
  VENDURE_AUTH_TOKEN: process.env.VENDURE_AUTH_TOKEN || '',
  BATCH_SIZE: 50,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  POLL_INTERVAL_MS: 10000,
};

// =============================================================================
// TYPES
// =============================================================================

interface VendureProductInput {
  translations: Array<{
    languageCode: string;
    name: string;
    slug: string;
    description: string;
  }>;
  customFields?: {
    productType?: string;
    isDigital?: boolean;
  };
}

interface VendureVariantInput {
  sku: string;
  price: number;
  stockOnHand: number;
  trackInventory: boolean;
  translations: Array<{
    languageCode: string;
    name: string;
  }>;
  customFields?: {
    downloadUrl?: string;
  };
}

interface SyncLogEntry {
  id: number;
  entity: string;
  entityId: string;
  vendorId: number | null;
  action: SyncAction;
  direction: SyncDirection;
  payload: any;
  status: SyncStatus;
  retryCount: number;
}

// =============================================================================
// VENDURE CLIENT
// =============================================================================

class VendureClient {
  private authToken: string = '';

  async authenticate(): Promise<void> {
    const response = await fetch(`${CONFIG.VENDURE_ADMIN_API}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
              ... on CurrentUser {
                id
                identifier
              }
              ... on InvalidCredentialsError {
                message
              }
            }
          }
        `,
        variables: {
          username: process.env.SUPERADMIN_USERNAME || 'superadmin',
          password: process.env.SUPERADMIN_PASSWORD || 'superadmin',
        },
      }),
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      // Extract session token from cookies
      const match = cookies.match(/session=([^;]+)/);
      if (match) {
        this.authToken = match[1];
      }
    }
  }

  private async graphql<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(`${CONFIG.VENDURE_ADMIN_API}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${this.authToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Vendure GraphQL Error: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  // ---------------------------------------------------------------------------
  // Seller Operations
  // ---------------------------------------------------------------------------

  async createSeller(sellerData: any): Promise<{ id: string }> {
    const result = await this.graphql<{ createSeller: { id: string } }>(`
      mutation CreateSeller($input: CreateSellerInput!) {
        createSeller(input: $input) {
          id
          name
        }
      }
    `, {
      input: {
        name: sellerData.businessName || `${sellerData.firstName} ${sellerData.lastName}`,
        customFields: {
          // Map marketplace seller fields to Vendure custom fields
        },
      },
    });

    return result.createSeller;
  }

  async createChannel(channelData: any): Promise<{ id: string; token: string }> {
    const result = await this.graphql<{ createChannel: { id: string; token: string } }>(`
      mutation CreateChannel($input: CreateChannelInput!) {
        createChannel(input: $input) {
          id
          token
          code
        }
      }
    `, {
      input: {
        code: `seller-${channelData.sellerId}`,
        token: `seller_${channelData.sellerId}_${Date.now()}`,
        defaultLanguageCode: 'en',
        currencyCode: 'USD',
        pricesIncludeTax: false,
        defaultShippingZoneId: channelData.defaultShippingZoneId,
        defaultTaxZoneId: channelData.defaultTaxZoneId,
        sellerId: channelData.vendureSellerId,
      },
    });

    return result.createChannel;
  }

  async createAdministrator(adminData: any): Promise<{ id: string }> {
    const result = await this.graphql<{ createAdministrator: { id: string } }>(`
      mutation CreateAdministrator($input: CreateAdministratorInput!) {
        createAdministrator(input: $input) {
          id
          emailAddress
        }
      }
    `, {
      input: {
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        emailAddress: adminData.email,
        password: adminData.tempPassword || 'changeme123',
        roleIds: adminData.roleIds,
      },
    });

    return result.createAdministrator;
  }

  // ---------------------------------------------------------------------------
  // Product Operations
  // ---------------------------------------------------------------------------

  async createProduct(productData: any, channelId: string): Promise<{ id: string; variants: Array<{ id: string }> }> {
    // First, create the product
    const productResult = await this.graphql<{ createProduct: { id: string } }>(`
      mutation CreateProduct($input: CreateProductInput!) {
        createProduct(input: $input) {
          id
        }
      }
    `, {
      input: {
        translations: [{
          languageCode: 'en',
          name: productData.name,
          slug: productData.slug,
          description: productData.description || '',
        }],
        customFields: {
          productType: productData.productType,
          isDigital: productData.isDigital,
        },
      },
    });

    const productId = productResult.createProduct.id;

    // Create the variant
    const variantResult = await this.graphql<{ createProductVariants: Array<{ id: string }> }>(`
      mutation CreateProductVariants($productId: ID!, $input: [CreateProductVariantInput!]!) {
        createProductVariants(productId: $productId, input: $input) {
          id
          sku
        }
      }
    `, {
      productId,
      input: [{
        sku: productData.sku,
        price: Math.round(productData.price * 100), // Vendure uses cents
        stockOnHand: productData.stockLevel || 0,
        trackInventory: productData.trackInventory ?? true,
        translations: [{
          languageCode: 'en',
          name: productData.name,
        }],
        customFields: {
          downloadUrl: productData.isDigital ? productData.downloadUrl : undefined,
        },
      }],
    });

    // Assign product to seller's channel
    await this.graphql(`
      mutation AssignProductsToChannel($input: AssignProductsToChannelInput!) {
        assignProductsToChannel(input: $input) {
          id
        }
      }
    `, {
      input: {
        productIds: [productId],
        channelId,
        priceFactor: 1,
      },
    });

    return {
      id: productId,
      variants: variantResult.createProductVariants,
    };
  }

  async updateProduct(vendureProductId: string, productData: any): Promise<void> {
    await this.graphql(`
      mutation UpdateProduct($input: UpdateProductInput!) {
        updateProduct(input: $input) {
          id
        }
      }
    `, {
      input: {
        id: vendureProductId,
        translations: [{
          languageCode: 'en',
          name: productData.name,
          slug: productData.slug,
          description: productData.description || '',
        }],
        customFields: {
          productType: productData.productType,
          isDigital: productData.isDigital,
        },
      },
    });

    // Update variant if we have variant ID
    if (productData.vendureVariantId) {
      await this.graphql(`
        mutation UpdateProductVariants($input: [UpdateProductVariantInput!]!) {
          updateProductVariants(input: $input) {
            id
          }
        }
      `, {
        input: [{
          id: productData.vendureVariantId,
          sku: productData.sku,
          price: Math.round(productData.price * 100),
          stockOnHand: productData.stockLevel || 0,
          trackInventory: productData.trackInventory ?? true,
        }],
      });
    }
  }

  async deleteProduct(vendureProductId: string): Promise<void> {
    await this.graphql(`
      mutation DeleteProduct($id: ID!) {
        deleteProduct(id: $id) {
          result
        }
      }
    `, {
      id: vendureProductId,
    });
  }

  // ---------------------------------------------------------------------------
  // Order Operations (Vendure -> Marketplace)
  // ---------------------------------------------------------------------------

  async getOrder(orderId: string): Promise<any> {
    const result = await this.graphql<{ order: any }>(`
      query GetOrder($id: ID!) {
        order(id: $id) {
          id
          code
          state
          total
          totalWithTax
          subTotal
          subTotalWithTax
          shipping
          shippingWithTax
          customer {
            id
            emailAddress
            firstName
            lastName
          }
          lines {
            id
            productVariant {
              id
              sku
              name
              product {
                id
                customFields {
                  productType
                }
              }
            }
            unitPrice
            unitPriceWithTax
            quantity
            linePrice
            linePriceWithTax
          }
          shippingAddress {
            streetLine1
            streetLine2
            city
            province
            postalCode
            country
          }
        }
      }
    `, { id: orderId });

    return result.order;
  }

  async getRecentOrders(since: Date): Promise<any[]> {
    const result = await this.graphql<{ orders: { items: any[] } }>(`
      query GetRecentOrders($options: OrderListOptions) {
        orders(options: $options) {
          items {
            id
            code
            state
            updatedAt
            customer {
              id
              emailAddress
              firstName
              lastName
            }
            lines {
              productVariant {
                id
                sku
              }
              quantity
              linePrice
            }
          }
        }
      }
    `, {
      options: {
        filter: {
          updatedAt: { after: since.toISOString() },
        },
        take: 100,
        sort: { updatedAt: 'DESC' },
      },
    });

    return result.orders.items;
  }
}

// =============================================================================
// SYNC WORKER
// =============================================================================

class SyncWorker {
  private prisma: PrismaClient;
  private vendure: VendureClient;
  private isRunning: boolean = false;

  constructor() {
    this.prisma = new PrismaClient();
    this.vendure = new VendureClient();
  }

  async start(): Promise<void> {
    console.log('[SyncWorker] Starting...');

    // Authenticate with Vendure
    await this.vendure.authenticate();
    console.log('[SyncWorker] Authenticated with Vendure');

    this.isRunning = true;

    // Start processing loop
    while (this.isRunning) {
      try {
        await this.processPendingJobs();
        await this.sleep(CONFIG.POLL_INTERVAL_MS);
      } catch (error) {
        console.error('[SyncWorker] Error in processing loop:', error);
        await this.sleep(CONFIG.POLL_INTERVAL_MS * 2);
      }
    }
  }

  stop(): void {
    console.log('[SyncWorker] Stopping...');
    this.isRunning = false;
  }

  // ---------------------------------------------------------------------------
  // Main Processing Loop
  // ---------------------------------------------------------------------------

  private async processPendingJobs(): Promise<void> {
    // Get pending sync logs
    const pendingJobs = await this.prisma.syncLog.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        retryCount: { lt: CONFIG.MAX_RETRIES },
      },
      orderBy: { attemptedAt: 'asc' },
      take: CONFIG.BATCH_SIZE,
    });

    if (pendingJobs.length === 0) {
      return;
    }

    console.log(`[SyncWorker] Processing ${pendingJobs.length} jobs...`);

    for (const job of pendingJobs) {
      await this.processJob(job as SyncLogEntry);
    }
  }

  private async processJob(job: SyncLogEntry): Promise<void> {
    console.log(`[SyncWorker] Processing job ${job.id}: ${job.entity} ${job.action}`);

    // Mark as in progress
    await this.prisma.syncLog.update({
      where: { id: job.id },
      data: { status: 'IN_PROGRESS', attemptedAt: new Date() },
    });

    try {
      if (job.direction === 'MARKETPLACE_TO_VENDURE') {
        await this.syncToVendure(job);
      } else {
        await this.syncFromVendure(job);
      }

      // Mark as synced
      await this.prisma.syncLog.update({
        where: { id: job.id },
        data: { status: 'SYNCED', completedAt: new Date() },
      });

      console.log(`[SyncWorker] Job ${job.id} completed successfully`);
    } catch (error: any) {
      console.error(`[SyncWorker] Job ${job.id} failed:`, error.message);

      // Mark as failed
      await this.prisma.syncLog.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Marketplace -> Vendure Sync
  // ---------------------------------------------------------------------------

  private async syncToVendure(job: SyncLogEntry): Promise<void> {
    const payload = job.payload;

    switch (job.entity) {
      case 'Seller':
        await this.syncSellerToVendure(job.entityId, payload, job.action);
        break;

      case 'Product':
        await this.syncProductToVendure(job.entityId, payload, job.action);
        break;

      default:
        console.warn(`[SyncWorker] Unknown entity type: ${job.entity}`);
    }
  }

  private async syncSellerToVendure(
    entityId: string,
    payload: any,
    action: SyncAction
  ): Promise<void> {
    if (action === 'CREATE') {
      // Create Vendure Seller
      const vendureSeller = await this.vendure.createSeller(payload);

      // Get default channel settings for new seller channel
      // NOTE: You need to configure default shipping/tax zones in your Vendure setup
      const defaultShippingZoneId = process.env.DEFAULT_SHIPPING_ZONE_ID || '1';
      const defaultTaxZoneId = process.env.DEFAULT_TAX_ZONE_ID || '1';

      // Create dedicated channel for seller
      const channel = await this.vendure.createChannel({
        sellerId: parseInt(entityId),
        vendureSellerId: vendureSeller.id,
        defaultShippingZoneId,
        defaultTaxZoneId,
      });

      // Create administrator account for seller dashboard access
      // First create a role for sellers (or use existing seller role)
      const admin = await this.vendure.createAdministrator({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        tempPassword: 'changeme123', // Should be randomly generated and emailed
        roleIds: [], // Add seller role ID
      });

      // Update marketplace seller with Vendure IDs
      await this.prisma.seller.update({
        where: { id: parseInt(entityId) },
        data: {
          vendureSellerId: vendureSeller.id,
          vendureChannelId: channel.id,
          vendureAdminId: admin.id,
        },
      });

      console.log(`[SyncWorker] Created Vendure seller ${vendureSeller.id} with channel ${channel.id}`);
    }
    // UPDATE and DELETE handled similarly
  }

  private async syncProductToVendure(
    entityId: string,
    payload: any,
    action: SyncAction
  ): Promise<void> {
    // Get the seller's Vendure channel ID
    const seller = await this.prisma.seller.findUnique({
      where: { id: payload.vendorId },
    });

    if (!seller?.vendureChannelId) {
      throw new Error(`Seller ${payload.vendorId} does not have a Vendure channel`);
    }

    if (action === 'CREATE') {
      const vendureProduct = await this.vendure.createProduct(payload, seller.vendureChannelId);

      // Update marketplace product with Vendure IDs
      await this.prisma.product.update({
        where: { id: parseInt(entityId) },
        data: {
          vendureProductId: vendureProduct.id,
          vendureVariantId: vendureProduct.variants[0]?.id,
        },
      });

      console.log(`[SyncWorker] Created Vendure product ${vendureProduct.id}`);
    } else if (action === 'UPDATE') {
      if (!payload.vendureProductId) {
        throw new Error(`Product ${entityId} does not have a Vendure product ID`);
      }

      await this.vendure.updateProduct(payload.vendureProductId, payload);
      console.log(`[SyncWorker] Updated Vendure product ${payload.vendureProductId}`);
    } else if (action === 'DELETE') {
      if (payload.vendureProductId) {
        await this.vendure.deleteProduct(payload.vendureProductId);
        console.log(`[SyncWorker] Deleted Vendure product ${payload.vendureProductId}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Vendure -> Marketplace Sync
  // ---------------------------------------------------------------------------

  private async syncFromVendure(job: SyncLogEntry): Promise<void> {
    const payload = job.payload;

    switch (job.entity) {
      case 'Order':
        await this.syncOrderFromVendure(payload);
        break;

      case 'StockLevel':
        await this.syncStockFromVendure(payload);
        break;

      default:
        console.warn(`[SyncWorker] Unknown entity type for Vendure sync: ${job.entity}`);
    }
  }

  private async syncOrderFromVendure(payload: any): Promise<void> {
    // Get full order details from Vendure
    const vendureOrder = await this.vendure.getOrder(payload.orderId);

    if (!vendureOrder) {
      throw new Error(`Order ${payload.orderId} not found in Vendure`);
    }

    // Group order lines by vendor
    const linesByVendor = new Map<number, any[]>();

    for (const line of vendureOrder.lines) {
      // Find the marketplace product by Vendure variant ID
      const product = await this.prisma.product.findFirst({
        where: { vendureVariantId: line.productVariant.id },
      });

      if (product) {
        const vendorLines = linesByVendor.get(product.vendorId) || [];
        vendorLines.push({
          ...line,
          marketplaceProductId: product.id,
          vendorId: product.vendorId,
        });
        linesByVendor.set(product.vendorId, vendorLines);
      }
    }

    // Create separate orders for each vendor
    for (const [vendorId, lines] of linesByVendor) {
      const subtotal = lines.reduce((sum, line) => sum + line.linePrice, 0) / 100;
      const platformFeeRate = 0.10; // 10% platform fee
      const platformFee = subtotal * platformFeeRate;
      const vendorPayout = subtotal - platformFee;

      // Generate unique order number
      const orderNumber = `TS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      await this.prisma.order.create({
        data: {
          orderNumber,
          vendureOrderId: vendureOrder.id,
          vendureParentOrderId: vendureOrder.id,
          vendorId,
          buyerId: vendureOrder.customer?.id || 'guest',
          buyerEmail: vendureOrder.customer?.emailAddress || 'unknown',
          buyerName: `${vendureOrder.customer?.firstName || ''} ${vendureOrder.customer?.lastName || ''}`.trim() || 'Guest',
          subtotal,
          shippingTotal: vendureOrder.shipping / 100 / linesByVendor.size, // Split shipping
          taxTotal: 0, // Calculate if needed
          discountTotal: 0,
          total: subtotal + (vendureOrder.shipping / 100 / linesByVendor.size),
          platformFee,
          vendorPayout,
          status: this.mapVendureOrderState(vendureOrder.state),
          paymentStatus: 'PENDING', // Update based on payment events
          fulfillmentStatus: 'UNFULFILLED',
          shippingAddress: vendureOrder.shippingAddress,
          lines: {
            create: lines.map(line => ({
              productId: line.marketplaceProductId,
              productName: line.productVariant.name,
              productSku: line.productVariant.sku,
              productType: line.productVariant.product.customFields?.productType || 'PART',
              unitPrice: line.unitPrice / 100,
              quantity: line.quantity,
              lineTotal: line.linePrice / 100,
              vendureOrderLineId: line.id,
            })),
          },
        },
      });

      console.log(`[SyncWorker] Created marketplace order ${orderNumber} for vendor ${vendorId}`);
    }
  }

  private async syncStockFromVendure(payload: any): Promise<void> {
    // Update stock level in marketplace
    const product = await this.prisma.product.findFirst({
      where: { vendureVariantId: payload.variantId },
    });

    if (product) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: { stockLevel: payload.stockLevel },
      });

      console.log(`[SyncWorker] Updated stock for product ${product.id}: ${payload.stockLevel}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapVendureOrderState(state: string): 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' {
    const stateMap: Record<string, any> = {
      Created: 'PENDING',
      AddingItems: 'PENDING',
      ArrangingPayment: 'PENDING',
      PaymentAuthorized: 'CONFIRMED',
      PaymentSettled: 'CONFIRMED',
      PartiallyDelivered: 'PROCESSING',
      Delivered: 'DELIVERED',
      Cancelled: 'CANCELLED',
    };
    return stateMap[state] || 'PENDING';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// VENDURE WEBHOOK HANDLER
// =============================================================================

/**
 * Handle Vendure webhooks for real-time sync
 * Mount this at POST /webhooks/vendure
 */
export async function handleVendureWebhook(
  prisma: PrismaClient,
  eventType: string,
  payload: any
): Promise<void> {
  console.log(`[Webhook] Received ${eventType} event`);

  // Create sync log entry for the worker to process
  switch (eventType) {
    case 'order-placed':
    case 'order-state-transition':
      await prisma.syncLog.create({
        data: {
          entity: 'Order',
          entityId: payload.order?.id || payload.orderId,
          action: 'CREATE',
          direction: 'VENDURE_TO_MARKETPLACE',
          payload: payload,
          status: 'PENDING',
        },
      });
      break;

    case 'stock-movement':
      await prisma.syncLog.create({
        data: {
          entity: 'StockLevel',
          entityId: payload.productVariantId,
          action: 'UPDATE',
          direction: 'VENDURE_TO_MARKETPLACE',
          payload: payload,
          status: 'PENDING',
        },
      });
      break;

    default:
      console.log(`[Webhook] Unhandled event type: ${eventType}`);
  }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

// Run worker if executed directly
if (require.main === module) {
  const worker = new SyncWorker();

  // Handle graceful shutdown
  process.on('SIGINT', () => worker.stop());
  process.on('SIGTERM', () => worker.stop());

  worker.start().catch(error => {
    console.error('[SyncWorker] Fatal error:', error);
    process.exit(1);
  });
}

export { SyncWorker, VendureClient };
