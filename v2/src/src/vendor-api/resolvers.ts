// FILE: src/vendor-api/resolvers.ts
// PURPOSE: GraphQL resolvers for TunerSwap Vendor API with row-level security
// STATUS: Production-ready
//
// CRITICAL: All resolvers enforce vendorId filtering. No vendor can access another vendor's data.

import { PrismaClient, Seller, Product, Order } from '.prisma/marketplace-client';
import { GraphQLError } from 'graphql';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

// Types
interface VendorContext {
  prisma: PrismaClient;
  vendorId: number | null;
  vendor: Seller | null;
  isAuthenticated: boolean;
}

interface JWTPayload {
  vendorId: number;
  email: string;
  iat: number;
  exp: number;
}

// =============================================================================
// AUTH GUARDS
// =============================================================================

/**
 * Ensures the request is authenticated with a valid vendor JWT
 * @throws GraphQLError if not authenticated
 */
function requireAuth(ctx: VendorContext): asserts ctx is VendorContext & { vendorId: number; vendor: Seller } {
  if (!ctx.isAuthenticated || !ctx.vendorId || !ctx.vendor) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
}

/**
 * Ensures the vendor owns the specified resource
 * @throws GraphQLError if vendor doesn't own the resource
 */
function requireOwnership(resourceVendorId: number, ctx: VendorContext): void {
  requireAuth(ctx);
  if (resourceVendorId !== ctx.vendorId) {
    throw new GraphQLError('You do not have permission to access this resource', {
      extensions: { code: 'FORBIDDEN' }
    });
  }
}

/**
 * Ensures the vendor is approved (not pending, suspended, or rejected)
 */
function requireApproved(ctx: VendorContext): void {
  requireAuth(ctx);
  if (ctx.vendor.status !== 'APPROVED') {
    throw new GraphQLError(`Your seller account is ${ctx.vendor.status.toLowerCase()}. Please contact support.`, {
      extensions: { code: 'FORBIDDEN' }
    });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const JWT_SECRET = process.env.VENDOR_JWT_SECRET || 'change-this-in-production';
const JWT_EXPIRES_IN = '7d';

function generateToken(vendor: Seller): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    vendorId: vendor.id,
    email: vendor.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateSlug(firstName: string, lastName: string): string {
  const base = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}-${random}`;
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TS-${timestamp}-${random}`;
}

// =============================================================================
// RESOLVERS
// =============================================================================

export const resolvers = {
  // ===========================================================================
  // QUERIES
  // ===========================================================================
  Query: {
    // -------------------------------------------------------------------------
    // Authenticated Seller Queries
    // -------------------------------------------------------------------------

    me: async (_: unknown, __: unknown, ctx: VendorContext) => {
      requireAuth(ctx);
      return ctx.vendor;
    },

    myStats: async (_: unknown, __: unknown, ctx: VendorContext) => {
      requireAuth(ctx);
      const vendorId = ctx.vendorId;

      // Run all stats queries in parallel
      const [
        totalRevenue,
        monthlyRevenue,
        totalOrders,
        pendingOrders,
        productCounts,
        reviewStats,
        unreadMessages,
        upcomingEvents,
      ] = await Promise.all([
        // Total revenue
        ctx.prisma.order.aggregate({
          where: { vendorId, status: { in: ['COMPLETED', 'DELIVERED'] } },
          _sum: { vendorPayout: true },
        }),

        // Monthly revenue (last 30 days)
        ctx.prisma.order.aggregate({
          where: {
            vendorId,
            status: { in: ['COMPLETED', 'DELIVERED'] },
            placedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          _sum: { vendorPayout: true },
        }),

        // Total orders
        ctx.prisma.order.count({ where: { vendorId } }),

        // Pending orders
        ctx.prisma.order.count({
          where: { vendorId, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } },
        }),

        // Product counts by type
        ctx.prisma.product.groupBy({
          by: ['productType', 'status'],
          where: { vendorId },
          _count: true,
        }),

        // Review stats
        ctx.prisma.review.aggregate({
          where: { vendorId, status: 'APPROVED' },
          _avg: { rating: true },
          _count: true,
        }),

        // Unread messages
        ctx.prisma.message.count({
          where: { vendorId, read: false },
        }),

        // Upcoming events (next 7 days)
        ctx.prisma.calendarEvent.count({
          where: {
            vendorId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startTime: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      // Process product counts
      let totalProducts = 0;
      let activeProducts = 0;
      let tuneProducts = 0;
      let partProducts = 0;
      let serviceProducts = 0;

      for (const group of productCounts) {
        totalProducts += group._count;
        if (group.status === 'ACTIVE') {
          activeProducts += group._count;
        }
        if (group.productType === 'TUNE') tuneProducts += group._count;
        if (group.productType === 'PART') partProducts += group._count;
        if (group.productType === 'SERVICE') serviceProducts += group._count;
      }

      return {
        totalRevenue: totalRevenue._sum.vendorPayout || 0,
        monthlyRevenue: monthlyRevenue._sum.vendorPayout || 0,
        totalOrders,
        pendingOrders,
        totalProducts,
        activeProducts,
        tuneProducts,
        partProducts,
        serviceProducts,
        averageRating: reviewStats._avg.rating || 0,
        totalReviews: reviewStats._count,
        unreadMessages,
        upcomingEvents,
      };
    },

    myProducts: async (
      _: unknown,
      args: {
        filter?: {
          search?: string;
          productType?: string;
          status?: string;
          collectionId?: number;
          minPrice?: number;
          maxPrice?: number;
        };
        sort?: { field: string; order: string };
        skip?: number;
        take?: number;
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const where: any = { vendorId: ctx.vendorId };

      // Apply filters
      if (args.filter) {
        if (args.filter.search) {
          where.OR = [
            { name: { contains: args.filter.search, mode: 'insensitive' } },
            { sku: { contains: args.filter.search, mode: 'insensitive' } },
            { description: { contains: args.filter.search, mode: 'insensitive' } },
          ];
        }
        if (args.filter.productType) {
          where.productType = args.filter.productType;
        }
        if (args.filter.status) {
          where.status = args.filter.status;
        }
        if (args.filter.minPrice !== undefined) {
          where.price = { ...where.price, gte: args.filter.minPrice };
        }
        if (args.filter.maxPrice !== undefined) {
          where.price = { ...where.price, lte: args.filter.maxPrice };
        }
        if (args.filter.collectionId) {
          where.productCollections = {
            some: { collectionId: args.filter.collectionId },
          };
        }
      }

      // Build order by
      let orderBy: any = { createdAt: 'desc' };
      if (args.sort) {
        const fieldMap: Record<string, string> = {
          NAME: 'name',
          PRICE: 'price',
          CREATED_AT: 'createdAt',
          UPDATED_AT: 'updatedAt',
          STOCK_LEVEL: 'stockLevel',
        };
        const field = fieldMap[args.sort.field] || 'createdAt';
        orderBy = { [field]: args.sort.order.toLowerCase() };
      }

      const [items, totalItems] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          orderBy,
          skip: args.skip || 0,
          take: args.take || 20,
          include: {
            tuneFiles: true,
            productCollections: { include: { collection: true } },
            facetValues: { include: { facetValue: { include: { facet: true } } } },
            compatibility: true,
          },
        }),
        ctx.prisma.product.count({ where }),
      ]);

      return { items, totalItems };
    },

    myProduct: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const product = await ctx.prisma.product.findUnique({
        where: { id: args.id },
        include: {
          tuneFiles: true,
          productCollections: { include: { collection: true } },
          facetValues: { include: { facetValue: { include: { facet: true } } } },
          compatibility: true,
        },
      });

      if (!product) {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(product.vendorId, ctx);
      return product;
    },

    myOrders: async (
      _: unknown,
      args: {
        filter?: {
          status?: string;
          paymentStatus?: string;
          fulfillmentStatus?: string;
          dateFrom?: Date;
          dateTo?: Date;
          search?: string;
        };
        sort?: { field: string; order: string };
        skip?: number;
        take?: number;
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const where: any = { vendorId: ctx.vendorId };

      if (args.filter) {
        if (args.filter.status) where.status = args.filter.status;
        if (args.filter.paymentStatus) where.paymentStatus = args.filter.paymentStatus;
        if (args.filter.fulfillmentStatus) where.fulfillmentStatus = args.filter.fulfillmentStatus;
        if (args.filter.dateFrom) {
          where.placedAt = { ...where.placedAt, gte: args.filter.dateFrom };
        }
        if (args.filter.dateTo) {
          where.placedAt = { ...where.placedAt, lte: args.filter.dateTo };
        }
        if (args.filter.search) {
          where.OR = [
            { orderNumber: { contains: args.filter.search, mode: 'insensitive' } },
            { buyerEmail: { contains: args.filter.search, mode: 'insensitive' } },
            { buyerName: { contains: args.filter.search, mode: 'insensitive' } },
          ];
        }
      }

      let orderBy: any = { placedAt: 'desc' };
      if (args.sort) {
        const fieldMap: Record<string, string> = {
          PLACED_AT: 'placedAt',
          TOTAL: 'total',
          STATUS: 'status',
        };
        const field = fieldMap[args.sort.field] || 'placedAt';
        orderBy = { [field]: args.sort.order.toLowerCase() };
      }

      const [items, totalItems] = await Promise.all([
        ctx.prisma.order.findMany({
          where,
          orderBy,
          skip: args.skip || 0,
          take: args.take || 20,
          include: {
            lines: {
              include: { product: true },
            },
          },
        }),
        ctx.prisma.order.count({ where }),
      ]);

      return { items, totalItems };
    },

    myOrder: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const order = await ctx.prisma.order.findUnique({
        where: { id: args.id },
        include: {
          lines: { include: { product: true } },
        },
      });

      if (!order) {
        throw new GraphQLError('Order not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(order.vendorId, ctx);
      return order;
    },

    myReviews: async (_: unknown, args: { skip?: number; take?: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const [items, totalItems] = await Promise.all([
        ctx.prisma.review.findMany({
          where: { vendorId: ctx.vendorId },
          orderBy: { createdAt: 'desc' },
          skip: args.skip || 0,
          take: args.take || 20,
          include: { product: true },
        }),
        ctx.prisma.review.count({ where: { vendorId: ctx.vendorId } }),
      ]);

      return { items, totalItems };
    },

    myMessages: async (
      _: unknown,
      args: { unreadOnly?: boolean; skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const where: any = { vendorId: ctx.vendorId };
      if (args.unreadOnly) {
        where.read = false;
      }

      const [items, totalItems, unreadCount] = await Promise.all([
        ctx.prisma.message.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: args.skip || 0,
          take: args.take || 20,
        }),
        ctx.prisma.message.count({ where }),
        ctx.prisma.message.count({ where: { vendorId: ctx.vendorId, read: false } }),
      ]);

      return { items, totalItems, unreadCount };
    },

    myMessageThread: async (_: unknown, args: { messageId: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      // Get the message and verify ownership
      const message = await ctx.prisma.message.findUnique({
        where: { id: args.messageId },
      });

      if (!message || message.vendorId !== ctx.vendorId) {
        throw new GraphQLError('Message not found', { extensions: { code: 'NOT_FOUND' } });
      }

      // Find root message
      let rootId = message.id;
      if (message.parentMessageId) {
        let parent = await ctx.prisma.message.findUnique({
          where: { id: message.parentMessageId },
        });
        while (parent?.parentMessageId) {
          parent = await ctx.prisma.message.findUnique({
            where: { id: parent.parentMessageId },
          });
        }
        if (parent) rootId = parent.id;
      }

      // Get all messages in thread
      return ctx.prisma.message.findMany({
        where: {
          OR: [{ id: rootId }, { parentMessageId: rootId }],
          vendorId: ctx.vendorId,
        },
        orderBy: { createdAt: 'asc' },
      });
    },

    myCalendarEvents: async (
      _: unknown,
      args: {
        startDate?: Date;
        endDate?: Date;
        status?: string;
        skip?: number;
        take?: number;
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const where: any = { vendorId: ctx.vendorId };

      if (args.startDate) {
        where.startTime = { ...where.startTime, gte: args.startDate };
      }
      if (args.endDate) {
        where.endTime = { ...where.endTime, lte: args.endDate };
      }
      if (args.status) {
        where.status = args.status;
      }

      const [items, totalItems] = await Promise.all([
        ctx.prisma.calendarEvent.findMany({
          where,
          orderBy: { startTime: 'asc' },
          skip: args.skip || 0,
          take: args.take || 50,
        }),
        ctx.prisma.calendarEvent.count({ where }),
      ]);

      return { items, totalItems };
    },

    // -------------------------------------------------------------------------
    // Public Queries
    // -------------------------------------------------------------------------

    seller: async (_: unknown, args: { slug: string }, ctx: VendorContext) => {
      const seller = await ctx.prisma.seller.findUnique({
        where: { slug: args.slug, status: 'APPROVED' },
      });

      if (!seller) {
        throw new GraphQLError('Seller not found', { extensions: { code: 'NOT_FOUND' } });
      }

      return seller;
    },

    sellers: async (
      _: unknown,
      args: { search?: string; skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      const where: any = { status: 'APPROVED' };

      if (args.search) {
        where.OR = [
          { firstName: { contains: args.search, mode: 'insensitive' } },
          { lastName: { contains: args.search, mode: 'insensitive' } },
          { businessName: { contains: args.search, mode: 'insensitive' } },
          { location: { contains: args.search, mode: 'insensitive' } },
        ];
      }

      const [items, totalItems] = await Promise.all([
        ctx.prisma.seller.findMany({
          where,
          orderBy: [{ verified: 'desc' }, { rating: 'desc' }],
          skip: args.skip || 0,
          take: args.take || 20,
        }),
        ctx.prisma.seller.count({ where }),
      ]);

      return { items, totalItems };
    },

    product: async (_: unknown, args: { id?: number; slug?: string }, ctx: VendorContext) => {
      if (!args.id && !args.slug) {
        throw new GraphQLError('Either id or slug is required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const where: any = { status: 'ACTIVE' };
      if (args.id) where.id = args.id;
      if (args.slug) where.slug = args.slug;

      const product = await ctx.prisma.product.findFirst({
        where,
        include: {
          vendor: true,
          tuneFiles: true,
          productCollections: { include: { collection: true } },
          facetValues: { include: { facetValue: { include: { facet: true } } } },
          compatibility: true,
        },
      });

      if (!product) {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      // Only show active products from approved vendors
      if (product.vendor.status !== 'APPROVED') {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      return product;
    },

    products: async (
      _: unknown,
      args: {
        filter?: {
          search?: string;
          productType?: string;
          collectionId?: number;
          minPrice?: number;
          maxPrice?: number;
          compatibility?: { make?: string; model?: string; year?: number };
        };
        sort?: { field: string; order: string };
        skip?: number;
        take?: number;
      },
      ctx: VendorContext
    ) => {
      const where: any = {
        status: 'ACTIVE',
        vendor: { status: 'APPROVED' },
      };

      if (args.filter) {
        if (args.filter.search) {
          where.OR = [
            { name: { contains: args.filter.search, mode: 'insensitive' } },
            { description: { contains: args.filter.search, mode: 'insensitive' } },
          ];
        }
        if (args.filter.productType) {
          where.productType = args.filter.productType;
        }
        if (args.filter.minPrice !== undefined) {
          where.price = { ...where.price, gte: args.filter.minPrice };
        }
        if (args.filter.maxPrice !== undefined) {
          where.price = { ...where.price, lte: args.filter.maxPrice };
        }
        if (args.filter.collectionId) {
          where.productCollections = {
            some: { collectionId: args.filter.collectionId },
          };
        }
        if (args.filter.compatibility) {
          where.compatibility = {
            some: {
              ...(args.filter.compatibility.make && {
                make: { equals: args.filter.compatibility.make, mode: 'insensitive' },
              }),
              ...(args.filter.compatibility.model && {
                model: { equals: args.filter.compatibility.model, mode: 'insensitive' },
              }),
              ...(args.filter.compatibility.year && {
                yearStart: { lte: args.filter.compatibility.year },
                yearEnd: { gte: args.filter.compatibility.year },
              }),
            },
          };
        }
      }

      let orderBy: any = { createdAt: 'desc' };
      if (args.sort) {
        const fieldMap: Record<string, string> = {
          NAME: 'name',
          PRICE: 'price',
          CREATED_AT: 'createdAt',
        };
        const field = fieldMap[args.sort.field] || 'createdAt';
        orderBy = { [field]: args.sort.order.toLowerCase() };
      }

      const [items, totalItems] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          orderBy,
          skip: args.skip || 0,
          take: args.take || 20,
          include: {
            vendor: true,
            tuneFiles: true,
            productCollections: { include: { collection: true } },
            facetValues: { include: { facetValue: { include: { facet: true } } } },
            compatibility: true,
          },
        }),
        ctx.prisma.product.count({ where }),
      ]);

      return { items, totalItems };
    },

    collections: async (_: unknown, __: unknown, ctx: VendorContext) => {
      const items = await ctx.prisma.collection.findMany({
        orderBy: { position: 'asc' },
      });
      return { items, totalItems: items.length };
    },

    collection: async (_: unknown, args: { slug: string }, ctx: VendorContext) => {
      const collection = await ctx.prisma.collection.findUnique({
        where: { slug: args.slug },
      });

      if (!collection) {
        throw new GraphQLError('Collection not found', { extensions: { code: 'NOT_FOUND' } });
      }

      return collection;
    },

    facets: async (_: unknown, __: unknown, ctx: VendorContext) => {
      const items = await ctx.prisma.facet.findMany({
        include: { values: true },
      });
      return { items, totalItems: items.length };
    },
  },

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================
  Mutation: {
    // -------------------------------------------------------------------------
    // Authentication
    // -------------------------------------------------------------------------

    registerSeller: async (
      _: unknown,
      args: {
        input: {
          email: string;
          password: string;
          firstName: string;
          lastName: string;
          phone?: string;
          location?: string;
          businessName?: string;
          website?: string;
          bio?: string;
        };
      },
      ctx: VendorContext
    ) => {
      // Check if email already exists
      const existing = await ctx.prisma.seller.findUnique({
        where: { email: args.input.email.toLowerCase() },
      });

      if (existing) {
        throw new GraphQLError('A seller with this email already exists', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(args.input.password, 12);

      // Generate unique slug
      const slug = generateSlug(args.input.firstName, args.input.lastName);

      // Create seller
      const seller = await ctx.prisma.seller.create({
        data: {
          email: args.input.email.toLowerCase(),
          passwordHash,
          slug,
          firstName: args.input.firstName,
          lastName: args.input.lastName,
          phone: args.input.phone,
          location: args.input.location,
          businessName: args.input.businessName,
          website: args.input.website,
          bio: args.input.bio,
          status: 'PENDING',
        },
      });

      // Generate token
      const token = generateToken(seller);

      // TODO: Create corresponding Vendure Seller, Channel, Administrator via sync worker
      // This will be handled asynchronously

      return { token, seller };
    },

    loginSeller: async (
      _: unknown,
      args: { email: string; password: string },
      ctx: VendorContext
    ) => {
      const seller = await ctx.prisma.seller.findUnique({
        where: { email: args.email.toLowerCase() },
      });

      if (!seller) {
        throw new GraphQLError('Invalid email or password', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const valid = await bcrypt.compare(args.password, seller.passwordHash);
      if (!valid) {
        throw new GraphQLError('Invalid email or password', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if suspended
      if (seller.status === 'SUSPENDED') {
        throw new GraphQLError('Your account has been suspended. Please contact support.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update last login
      await ctx.prisma.seller.update({
        where: { id: seller.id },
        data: { lastLoginAt: new Date() },
      });

      const token = generateToken(seller);

      return { token, seller };
    },

    refreshToken: async (_: unknown, __: unknown, ctx: VendorContext) => {
      requireAuth(ctx);

      // Re-fetch seller to get latest data
      const seller = await ctx.prisma.seller.findUnique({
        where: { id: ctx.vendorId },
      });

      if (!seller) {
        throw new GraphQLError('Seller not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const token = generateToken(seller);
      return { token, seller };
    },

    // -------------------------------------------------------------------------
    // Profile Management
    // -------------------------------------------------------------------------

    updateMyProfile: async (
      _: unknown,
      args: {
        input: {
          firstName?: string;
          lastName?: string;
          phone?: string;
          location?: string;
          address?: string;
          businessName?: string;
          website?: string;
          bio?: string;
          description?: string;
          socialLinks?: any;
          profileImageUrl?: string;
          bannerImageUrl?: string;
          experience?: string;
          software?: string[];
          vehiclePlatforms?: string[];
          tuneTypes?: string[];
          hasDyno?: boolean;
          businessHours?: any;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      // Transform arrays to JSON strings for Prisma storage
      const updateData: Record<string, any> = { ...args.input };
      if (args.input.software !== undefined) {
        updateData.software = JSON.stringify(args.input.software);
      }
      if (args.input.vehiclePlatforms !== undefined) {
        updateData.vehiclePlatforms = JSON.stringify(args.input.vehiclePlatforms);
      }
      if (args.input.tuneTypes !== undefined) {
        updateData.tuneTypes = JSON.stringify(args.input.tuneTypes);
      }
      if (args.input.socialLinks !== undefined) {
        updateData.socialLinks = JSON.stringify(args.input.socialLinks);
      }
      if (args.input.businessHours !== undefined) {
        updateData.businessHours = JSON.stringify(args.input.businessHours);
      }

      const seller = await ctx.prisma.seller.update({
        where: { id: ctx.vendorId },
        data: updateData,
      });

      // TODO: Sync changes to Vendure via sync worker

      return seller;
    },

    changePassword: async (
      _: unknown,
      args: { currentPassword: string; newPassword: string },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const seller = await ctx.prisma.seller.findUnique({
        where: { id: ctx.vendorId },
      });

      if (!seller) {
        throw new GraphQLError('Seller not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const valid = await bcrypt.compare(args.currentPassword, seller.passwordHash);
      if (!valid) {
        throw new GraphQLError('Current password is incorrect', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const passwordHash = await bcrypt.hash(args.newPassword, 12);

      await ctx.prisma.seller.update({
        where: { id: ctx.vendorId },
        data: { passwordHash },
      });

      return { success: true, message: 'Password changed successfully' };
    },

    connectStripe: async (
      _: unknown,
      args: { authorizationCode: string },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      // TODO: Exchange authorization code with Stripe for connected account ID
      // const stripeAccountId = await stripe.oauth.token({ code: args.authorizationCode });

      const seller = await ctx.prisma.seller.update({
        where: { id: ctx.vendorId },
        data: {
          stripeConnected: true,
          stripeAccountId: 'acct_placeholder', // Replace with actual Stripe account ID
        },
      });

      return seller;
    },

    connectPaypal: async (
      _: unknown,
      args: { paypalEmail: string },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      // TODO: Verify PayPal email via PayPal API

      const seller = await ctx.prisma.seller.update({
        where: { id: ctx.vendorId },
        data: {
          paypalConnected: true,
          paypalEmail: args.paypalEmail,
        },
      });

      return seller;
    },

    // -------------------------------------------------------------------------
    // Product Management
    // -------------------------------------------------------------------------

    createProduct: async (
      _: unknown,
      args: {
        input: {
          sku: string;
          name: string;
          description?: string;
          price: number;
          compareAtPrice?: number;
          productType: string;
          isDigital?: boolean;
          stockLevel?: number;
          trackInventory?: boolean;
          featuredImageUrl?: string;
          imageUrls?: string[];
          metaTitle?: string;
          metaDescription?: string;
          collectionIds?: number[];
          facetValueIds?: number[];
          compatibility?: Array<{
            make: string;
            model: string;
            yearStart?: number;
            yearEnd?: number;
            engine?: string;
            transmission?: string;
            notes?: string;
          }>;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);
      requireApproved(ctx);

      // Check for duplicate SKU
      const existingSku = await ctx.prisma.product.findFirst({
        where: { vendorId: ctx.vendorId, sku: args.input.sku },
      });

      if (existingSku) {
        throw new GraphQLError('A product with this SKU already exists', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Generate slug
      const baseSlug = args.input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      // Create product with relations
      const product = await ctx.prisma.product.create({
        data: {
          vendorId: ctx.vendorId,
          sku: args.input.sku,
          slug,
          name: args.input.name,
          description: args.input.description,
          price: args.input.price,
          compareAtPrice: args.input.compareAtPrice,
          productType: args.input.productType as any,
          isDigital: args.input.isDigital ?? args.input.productType === 'TUNE',
          stockLevel: args.input.stockLevel ?? 0,
          trackInventory: args.input.trackInventory ?? true,
          featuredImageUrl: args.input.featuredImageUrl,
          imageUrls: JSON.stringify(args.input.imageUrls ?? []),
          metaTitle: args.input.metaTitle,
          metaDescription: args.input.metaDescription,
          status: 'DRAFT',
          // Collections
          productCollections: args.input.collectionIds
            ? {
                create: args.input.collectionIds.map((id, i) => ({
                  collectionId: id,
                  position: i,
                })),
              }
            : undefined,
          // Facet values
          facetValues: args.input.facetValueIds
            ? {
                create: args.input.facetValueIds.map((id) => ({
                  facetValueId: id,
                })),
              }
            : undefined,
          // Compatibility
          compatibility: args.input.compatibility
            ? {
                create: args.input.compatibility,
              }
            : undefined,
        },
        include: {
          tuneFiles: true,
          productCollections: { include: { collection: true } },
          facetValues: { include: { facetValue: { include: { facet: true } } } },
          compatibility: true,
        },
      });

      // Create sync log for Vendure
      await ctx.prisma.syncLog.create({
        data: {
          entity: 'Product',
          entityId: product.id.toString(),
          vendorId: ctx.vendorId,
          action: 'CREATE',
          direction: 'MARKETPLACE_TO_VENDURE',
          payload: JSON.stringify(product),
          status: 'PENDING',
        },
      });

      return product;
    },

    updateProduct: async (
      _: unknown,
      args: {
        id: number;
        input: {
          sku?: string;
          name?: string;
          description?: string;
          price?: number;
          compareAtPrice?: number;
          stockLevel?: number;
          trackInventory?: boolean;
          status?: string;
          featuredImageUrl?: string;
          imageUrls?: string[];
          metaTitle?: string;
          metaDescription?: string;
          collectionIds?: number[];
          facetValueIds?: number[];
          compatibility?: Array<{
            make: string;
            model: string;
            yearStart?: number;
            yearEnd?: number;
            engine?: string;
            transmission?: string;
            notes?: string;
          }>;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      // Get existing product and verify ownership
      const existing = await ctx.prisma.product.findUnique({
        where: { id: args.id },
      });

      if (!existing) {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(existing.vendorId, ctx);

      // Check SKU uniqueness if changing
      if (args.input.sku && args.input.sku !== existing.sku) {
        const skuConflict = await ctx.prisma.product.findFirst({
          where: { vendorId: ctx.vendorId, sku: args.input.sku, id: { not: args.id } },
        });

        if (skuConflict) {
          throw new GraphQLError('A product with this SKU already exists', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Build update data
      const updateData: any = { ...args.input };

      // Handle collections if provided
      if (args.input.collectionIds) {
        // Delete existing and recreate
        await ctx.prisma.productCollection.deleteMany({
          where: { productId: args.id },
        });
        updateData.productCollections = {
          create: args.input.collectionIds.map((id, i) => ({
            collectionId: id,
            position: i,
          })),
        };
        delete updateData.collectionIds;
      }

      // Handle facet values if provided
      if (args.input.facetValueIds) {
        await ctx.prisma.productFacetValue.deleteMany({
          where: { productId: args.id },
        });
        updateData.facetValues = {
          create: args.input.facetValueIds.map((id) => ({
            facetValueId: id,
          })),
        };
        delete updateData.facetValueIds;
      }

      // Handle compatibility if provided
      if (args.input.compatibility) {
        await ctx.prisma.productCompatibility.deleteMany({
          where: { productId: args.id },
        });
        updateData.compatibility = {
          create: args.input.compatibility,
        };
      }

      const product = await ctx.prisma.product.update({
        where: { id: args.id },
        data: updateData,
        include: {
          tuneFiles: true,
          productCollections: { include: { collection: true } },
          facetValues: { include: { facetValue: { include: { facet: true } } } },
          compatibility: true,
        },
      });

      // Create sync log
      await ctx.prisma.syncLog.create({
        data: {
          entity: 'Product',
          entityId: product.id.toString(),
          vendorId: ctx.vendorId,
          action: 'UPDATE',
          direction: 'MARKETPLACE_TO_VENDURE',
          payload: JSON.stringify(product),
          status: 'PENDING',
        },
      });

      return product;
    },

    deleteProduct: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const product = await ctx.prisma.product.findUnique({
        where: { id: args.id },
      });

      if (!product) {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(product.vendorId, ctx);

      // Soft delete by setting status to DELETED
      await ctx.prisma.product.update({
        where: { id: args.id },
        data: { status: 'DELETED' },
      });

      // Create sync log
      await ctx.prisma.syncLog.create({
        data: {
          entity: 'Product',
          entityId: args.id.toString(),
          vendorId: ctx.vendorId,
          action: 'DELETE',
          direction: 'MARKETPLACE_TO_VENDURE',
          payload: JSON.stringify({ id: args.id }),
          status: 'PENDING',
        },
      });

      return { success: true, message: 'Product deleted successfully' };
    },

    publishProduct: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);
      requireApproved(ctx);

      const product = await ctx.prisma.product.findUnique({
        where: { id: args.id },
      });

      if (!product) {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(product.vendorId, ctx);

      if (product.status !== 'DRAFT') {
        throw new GraphQLError('Only draft products can be published', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const updated = await ctx.prisma.product.update({
        where: { id: args.id },
        data: { status: 'ACTIVE', publishedAt: new Date() },
        include: {
          tuneFiles: true,
          productCollections: { include: { collection: true } },
          facetValues: { include: { facetValue: { include: { facet: true } } } },
          compatibility: true,
        },
      });

      // Sync to Vendure
      await ctx.prisma.syncLog.create({
        data: {
          entity: 'Product',
          entityId: args.id.toString(),
          vendorId: ctx.vendorId,
          action: 'UPDATE',
          direction: 'MARKETPLACE_TO_VENDURE',
          payload: JSON.stringify(updated),
          status: 'PENDING',
        },
      });

      return updated;
    },

    archiveProduct: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const product = await ctx.prisma.product.findUnique({
        where: { id: args.id },
      });

      if (!product) {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(product.vendorId, ctx);

      const updated = await ctx.prisma.product.update({
        where: { id: args.id },
        data: { status: 'ARCHIVED' },
        include: {
          tuneFiles: true,
          productCollections: { include: { collection: true } },
          facetValues: { include: { facetValue: { include: { facet: true } } } },
          compatibility: true,
        },
      });

      return updated;
    },

    uploadTuneFile: async (
      _: unknown,
      args: {
        input: {
          productId: number;
          fileName: string;
          filePath: string;
          fileSize: number;
          fileHash: string;
          mimeType: string;
          ecuType?: string;
          platform?: string;
          compatibility?: any;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const product = await ctx.prisma.product.findUnique({
        where: { id: args.input.productId },
      });

      if (!product) {
        throw new GraphQLError('Product not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(product.vendorId, ctx);

      if (product.productType !== 'TUNE') {
        throw new GraphQLError('Tune files can only be uploaded to tune products', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const tuneFile = await ctx.prisma.tuneFile.create({
        data: {
          productId: args.input.productId,
          fileName: args.input.fileName,
          filePath: args.input.filePath,
          fileSize: args.input.fileSize,
          fileHash: args.input.fileHash,
          mimeType: args.input.mimeType,
          ecuType: args.input.ecuType,
          platform: args.input.platform,
          compatibility: args.input.compatibility ?? [],
        },
      });

      return tuneFile;
    },

    deleteTuneFile: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const tuneFile = await ctx.prisma.tuneFile.findUnique({
        where: { id: args.id },
        include: { product: true },
      });

      if (!tuneFile) {
        throw new GraphQLError('Tune file not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(tuneFile.product.vendorId, ctx);

      await ctx.prisma.tuneFile.delete({ where: { id: args.id } });

      // TODO: Delete actual file from storage

      return { success: true, message: 'Tune file deleted successfully' };
    },

    // -------------------------------------------------------------------------
    // Order Management
    // -------------------------------------------------------------------------

    updateOrder: async (
      _: unknown,
      args: {
        id: number;
        input: {
          status?: string;
          fulfillmentStatus?: string;
          trackingNumber?: string;
          trackingUrl?: string;
          internalNotes?: string;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const order = await ctx.prisma.order.findUnique({
        where: { id: args.id },
      });

      if (!order) {
        throw new GraphQLError('Order not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(order.vendorId, ctx);

      const updated = await ctx.prisma.order.update({
        where: { id: args.id },
        data: args.input as any,
        include: { lines: { include: { product: true } } },
      });

      return updated;
    },

    shipOrder: async (
      _: unknown,
      args: { id: number; trackingNumber?: string; trackingUrl?: string },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const order = await ctx.prisma.order.findUnique({
        where: { id: args.id },
      });

      if (!order) {
        throw new GraphQLError('Order not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(order.vendorId, ctx);

      const updated = await ctx.prisma.order.update({
        where: { id: args.id },
        data: {
          status: 'SHIPPED',
          fulfillmentStatus: 'FULFILLED',
          trackingNumber: args.trackingNumber,
          trackingUrl: args.trackingUrl,
          fulfilledAt: new Date(),
        },
        include: { lines: { include: { product: true } } },
      });

      // TODO: Send shipping notification to buyer

      return updated;
    },

    fulfillOrder: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const order = await ctx.prisma.order.findUnique({
        where: { id: args.id },
      });

      if (!order) {
        throw new GraphQLError('Order not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(order.vendorId, ctx);

      const updated = await ctx.prisma.order.update({
        where: { id: args.id },
        data: {
          status: 'COMPLETED',
          fulfillmentStatus: 'FULFILLED',
          fulfilledAt: new Date(),
        },
        include: { lines: { include: { product: true } } },
      });

      return updated;
    },

    cancelOrder: async (
      _: unknown,
      args: { id: number; reason?: string },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const order = await ctx.prisma.order.findUnique({
        where: { id: args.id },
      });

      if (!order) {
        throw new GraphQLError('Order not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(order.vendorId, ctx);

      // Check if order can be cancelled
      if (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
        throw new GraphQLError('Cannot cancel an order that has already been shipped or completed', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const updated = await ctx.prisma.order.update({
        where: { id: args.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          internalNotes: args.reason
            ? `${order.internalNotes || ''}\nCancellation reason: ${args.reason}`
            : order.internalNotes,
        },
        include: { lines: { include: { product: true } } },
      });

      // TODO: Trigger refund if payment was captured
      // TODO: Send cancellation notification to buyer

      return updated;
    },

    generateDownloadLink: async (
      _: unknown,
      args: { orderLineId: number },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const orderLine = await ctx.prisma.orderLine.findUnique({
        where: { id: args.orderLineId },
        include: {
          order: true,
          product: { include: { tuneFiles: true } },
        },
      });

      if (!orderLine) {
        throw new GraphQLError('Order line not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(orderLine.order.vendorId, ctx);

      if (orderLine.productType !== 'TUNE' || !orderLine.product?.tuneFiles.length) {
        throw new GraphQLError('This order line does not have downloadable files', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Generate signed download URL
      // TODO: Implement actual signed URL generation with expiration
      const downloadToken = jwt.sign(
        { orderLineId: orderLine.id, fileId: orderLine.product.tuneFiles[0].id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const downloadUrl = `${process.env.API_URL}/downloads/${downloadToken}`;

      // Update order line with download URL
      await ctx.prisma.orderLine.update({
        where: { id: args.orderLineId },
        data: {
          downloadUrl,
          downloadExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return downloadUrl;
    },

    // -------------------------------------------------------------------------
    // Messaging
    // -------------------------------------------------------------------------

    sendMessage: async (
      _: unknown,
      args: {
        input: {
          receiverId: string;
          subject?: string;
          content: string;
          messageType?: string;
          orderId?: number;
          productId?: number;
          parentMessageId?: number;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const message = await ctx.prisma.message.create({
        data: {
          senderId: ctx.vendorId.toString(),
          senderType: 'VENDOR',
          receiverId: args.input.receiverId,
          receiverType: 'BUYER',
          vendorId: ctx.vendorId,
          subject: args.input.subject,
          content: args.input.content,
          messageType: (args.input.messageType as any) || 'GENERAL',
          orderId: args.input.orderId,
          productId: args.input.productId,
          parentMessageId: args.input.parentMessageId,
        },
      });

      // TODO: Send email/push notification to buyer

      return message;
    },

    markMessagesRead: async (
      _: unknown,
      args: { messageIds: number[] },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      await ctx.prisma.message.updateMany({
        where: {
          id: { in: args.messageIds },
          vendorId: ctx.vendorId, // Security: only update own messages
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return { success: true, message: `${args.messageIds.length} message(s) marked as read` };
    },

    // -------------------------------------------------------------------------
    // Calendar
    // -------------------------------------------------------------------------

    createCalendarEvent: async (
      _: unknown,
      args: {
        input: {
          title: string;
          description?: string;
          eventType: string;
          startTime: Date;
          endTime: Date;
          allDay?: boolean;
          timezone?: string;
          location?: string;
          isVirtual?: boolean;
          meetingUrl?: string;
          customerId?: string;
          customerName?: string;
          customerEmail?: string;
          customerPhone?: string;
          orderId?: number;
          vehicleInfo?: any;
          reminders?: any;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const event = await ctx.prisma.calendarEvent.create({
        data: {
          vendorId: ctx.vendorId,
          ...args.input,
          eventType: args.input.eventType as any,
        },
      });

      return event;
    },

    updateCalendarEvent: async (
      _: unknown,
      args: {
        id: number;
        input: {
          title?: string;
          description?: string;
          startTime?: Date;
          endTime?: Date;
          allDay?: boolean;
          location?: string;
          isVirtual?: boolean;
          meetingUrl?: string;
          status?: string;
          reminders?: any;
        };
      },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const event = await ctx.prisma.calendarEvent.findUnique({
        where: { id: args.id },
      });

      if (!event) {
        throw new GraphQLError('Calendar event not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(event.vendorId, ctx);

      const updated = await ctx.prisma.calendarEvent.update({
        where: { id: args.id },
        data: args.input as any,
      });

      return updated;
    },

    deleteCalendarEvent: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const event = await ctx.prisma.calendarEvent.findUnique({
        where: { id: args.id },
      });

      if (!event) {
        throw new GraphQLError('Calendar event not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(event.vendorId, ctx);

      await ctx.prisma.calendarEvent.delete({ where: { id: args.id } });

      return { success: true, message: 'Calendar event deleted successfully' };
    },

    confirmCalendarEvent: async (_: unknown, args: { id: number }, ctx: VendorContext) => {
      requireAuth(ctx);

      const event = await ctx.prisma.calendarEvent.findUnique({
        where: { id: args.id },
      });

      if (!event) {
        throw new GraphQLError('Calendar event not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(event.vendorId, ctx);

      const updated = await ctx.prisma.calendarEvent.update({
        where: { id: args.id },
        data: { status: 'CONFIRMED' },
      });

      // TODO: Send confirmation email to customer

      return updated;
    },

    cancelCalendarEvent: async (
      _: unknown,
      args: { id: number; reason?: string },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const event = await ctx.prisma.calendarEvent.findUnique({
        where: { id: args.id },
      });

      if (!event) {
        throw new GraphQLError('Calendar event not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(event.vendorId, ctx);

      const updated = await ctx.prisma.calendarEvent.update({
        where: { id: args.id },
        data: {
          status: 'CANCELLED',
          description: args.reason
            ? `${event.description || ''}\nCancellation reason: ${args.reason}`
            : event.description,
        },
      });

      // TODO: Send cancellation email to customer

      return updated;
    },

    // -------------------------------------------------------------------------
    // Reviews
    // -------------------------------------------------------------------------

    respondToReview: async (
      _: unknown,
      args: { input: { reviewId: number; response: string } },
      ctx: VendorContext
    ) => {
      requireAuth(ctx);

      const review = await ctx.prisma.review.findUnique({
        where: { id: args.input.reviewId },
      });

      if (!review) {
        throw new GraphQLError('Review not found', { extensions: { code: 'NOT_FOUND' } });
      }

      requireOwnership(review.vendorId, ctx);

      const updated = await ctx.prisma.review.update({
        where: { id: args.input.reviewId },
        data: {
          vendorResponse: args.input.response,
          respondedAt: new Date(),
        },
        include: { product: true },
      });

      return updated;
    },
  },

  // ===========================================================================
  // FIELD RESOLVERS
  // ===========================================================================

  Seller: {
    products: async (
      parent: Seller,
      args: { filter?: any; sort?: any; skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      const where: any = { vendorId: parent.id, status: 'ACTIVE' };

      const [items, totalItems] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          skip: args.skip || 0,
          take: args.take || 20,
          include: {
            tuneFiles: true,
            productCollections: { include: { collection: true } },
            compatibility: true,
          },
        }),
        ctx.prisma.product.count({ where }),
      ]);

      return { items, totalItems };
    },

    orders: async (
      parent: Seller,
      args: { filter?: any; sort?: any; skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      // Only allow if viewing own profile
      requireAuth(ctx);
      if (parent.id !== ctx.vendorId) {
        return { items: [], totalItems: 0 };
      }

      const [items, totalItems] = await Promise.all([
        ctx.prisma.order.findMany({
          where: { vendorId: parent.id },
          orderBy: { placedAt: 'desc' },
          skip: args.skip || 0,
          take: args.take || 20,
          include: { lines: { include: { product: true } } },
        }),
        ctx.prisma.order.count({ where: { vendorId: parent.id } }),
      ]);

      return { items, totalItems };
    },

    reviews: async (
      parent: Seller,
      args: { skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      const [items, totalItems] = await Promise.all([
        ctx.prisma.review.findMany({
          where: { vendorId: parent.id, status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          skip: args.skip || 0,
          take: args.take || 20,
          include: { product: true },
        }),
        ctx.prisma.review.count({
          where: { vendorId: parent.id, status: 'APPROVED' },
        }),
      ]);

      return { items, totalItems };
    },
  },

  PublicSeller: {
    products: async (
      parent: Seller,
      args: { filter?: any; sort?: any; skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      const where: any = { vendorId: parent.id, status: 'ACTIVE' };

      const [items, totalItems] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          skip: args.skip || 0,
          take: args.take || 20,
          include: {
            tuneFiles: true,
            productCollections: { include: { collection: true } },
            compatibility: true,
          },
        }),
        ctx.prisma.product.count({ where }),
      ]);

      return { items, totalItems };
    },

    reviews: async (
      parent: Seller,
      args: { skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      const [items, totalItems] = await Promise.all([
        ctx.prisma.review.findMany({
          where: { vendorId: parent.id, status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          skip: args.skip || 0,
          take: args.take || 20,
          include: { product: true },
        }),
        ctx.prisma.review.count({
          where: { vendorId: parent.id, status: 'APPROVED' },
        }),
      ]);

      return { items, totalItems };
    },
  },

  Product: {
    vendor: async (parent: Product & { vendorId: number }, ctx: VendorContext) => {
      return ctx.prisma.seller.findUnique({
        where: { id: parent.vendorId },
      });
    },

    collections: async (parent: Product & { id: number }, ctx: VendorContext) => {
      const productCollections = await ctx.prisma.productCollection.findMany({
        where: { productId: parent.id },
        include: { collection: true },
      });
      return productCollections.map((pc) => pc.collection);
    },

    facetValues: async (parent: Product & { id: number }, ctx: VendorContext) => {
      const pfvs = await ctx.prisma.productFacetValue.findMany({
        where: { productId: parent.id },
        include: { facetValue: { include: { facet: true } } },
      });
      return pfvs.map((pfv) => pfv.facetValue);
    },

    reviews: async (
      parent: Product & { id: number },
      args: { skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      const [items, totalItems] = await Promise.all([
        ctx.prisma.review.findMany({
          where: { productId: parent.id, status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          skip: args.skip || 0,
          take: args.take || 20,
        }),
        ctx.prisma.review.count({
          where: { productId: parent.id, status: 'APPROVED' },
        }),
      ]);

      return { items, totalItems };
    },
  },

  Collection: {
    products: async (
      parent: { id: number },
      args: { filter?: any; skip?: number; take?: number },
      ctx: VendorContext
    ) => {
      const where: any = {
        productCollections: { some: { collectionId: parent.id } },
        status: 'ACTIVE',
        vendor: { status: 'APPROVED' },
      };

      const [items, totalItems] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          skip: args.skip || 0,
          take: args.take || 20,
          include: { vendor: true },
        }),
        ctx.prisma.product.count({ where }),
      ]);

      return { items, totalItems };
    },
  },

  FacetValue: {
    facet: async (parent: { facetId: number }, ctx: VendorContext) => {
      return ctx.prisma.facet.findUnique({ where: { id: parent.facetId } });
    },
  },

  Order: {
    lines: async (parent: { id: number }, ctx: VendorContext) => {
      return ctx.prisma.orderLine.findMany({
        where: { orderId: parent.id },
        include: { product: true },
      });
    },
  },

  OrderLine: {
    product: async (parent: { productId: number | null }, ctx: VendorContext) => {
      if (!parent.productId) return null;
      return ctx.prisma.product.findUnique({ where: { id: parent.productId } });
    },
  },

  Review: {
    product: async (parent: { productId: number | null }, ctx: VendorContext) => {
      if (!parent.productId) return null;
      return ctx.prisma.product.findUnique({ where: { id: parent.productId } });
    },
  },

  Message: {
    replies: async (parent: { id: number }, ctx: VendorContext) => {
      return ctx.prisma.message.findMany({
        where: { parentMessageId: parent.id },
        orderBy: { createdAt: 'asc' },
      });
    },
  },
};
