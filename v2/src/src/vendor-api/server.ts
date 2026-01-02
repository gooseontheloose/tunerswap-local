// FILE: src/vendor-api/server.ts
// PURPOSE: Express server for TunerSwap Vendor API with auth middleware
// STATUS: Production-ready
//
// This is a standalone API server for vendors, separate from Vendure.
// Run alongside Vendure on a different port (e.g., 3001)

import express, { Request, Response, NextFunction } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PrismaClient, Seller } from '.prisma/marketplace-client';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import cors from 'cors';
import http from 'http';
import { resolvers } from './resolvers';
import { handleVendureWebhook } from './sync-worker';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = process.env.VENDOR_API_PORT || 3001;
const JWT_SECRET = process.env.VENDOR_JWT_SECRET || 'change-this-in-production';

// =============================================================================
// TYPES
// =============================================================================

interface VendorContext {
  prisma: PrismaClient;
  vendorId: number | null;
  vendor: Seller | null;
  isAuthenticated: boolean;
}

interface AuthenticatedRequest extends Request {
  vendorId?: number;
  vendor?: Seller;
}

// =============================================================================
// PRISMA CLIENT
// =============================================================================

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// =============================================================================
// AUTH MIDDLEWARE
// =============================================================================

/**
 * Extract and verify JWT token from Authorization header
 */
async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { vendorId: number; email: string };

    // Fetch the vendor from database
    const vendor = await prisma.seller.findUnique({
      where: { id: payload.vendorId },
    });

    if (vendor) {
      req.vendorId = vendor.id;
      req.vendor = vendor;
    }
  } catch (error) {
    // Token invalid or expired - continue as unauthenticated
    console.log('[Auth] Invalid token:', (error as Error).message);
  }

  next();
}

// =============================================================================
// APOLLO SERVER SETUP
// =============================================================================

async function createApolloServer(): Promise<{ server: ApolloServer<VendorContext>; httpServer: http.Server }> {
  const app = express();
  const httpServer = http.createServer(app);

  // Load GraphQL schema
  const typeDefs = fs.readFileSync(
    path.join(__dirname, 'schema.graphql'),
    'utf-8'
  );

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Create Apollo Server
  const server = new ApolloServer<VendorContext>({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: process.env.NODE_ENV !== 'production',
    formatError: (error) => {
      // Log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[GraphQL Error]', error);
      }

      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production' && !error.extensions?.code) {
        return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
      }

      return error;
    },
  });

  await server.start();

  // CORS configuration
  const corsOptions: cors.CorsOptions = {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://tuner-swap.com', 'https://www.tuner-swap.com']
      : (origin, callback) => {
          // In dev, allow any localhost origin (handles dynamic ports)
          if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  // Middleware
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(authMiddleware);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vendure webhook endpoint
  app.post('/webhooks/vendure', async (req: Request, res: Response) => {
    try {
      const { eventType, payload } = req.body;

      if (!eventType) {
        res.status(400).json({ error: 'Missing eventType' });
        return;
      }

      await handleVendureWebhook(prisma, eventType, payload);
      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook] Error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // GraphQL endpoint
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }): Promise<VendorContext> => {
        const authReq = req as unknown as AuthenticatedRequest;
        return {
          prisma,
          vendorId: authReq.vendorId || null,
          vendor: authReq.vendor || null,
          isAuthenticated: !!authReq.vendorId,
        };
      },
    }) as unknown as express.RequestHandler
  );

  // GraphQL Playground redirect (for convenience)
  app.get('/', (_req, res) => {
    res.redirect('/graphql');
  });

  return { server, httpServer };
}

// =============================================================================
// FILE UPLOAD HANDLER
// =============================================================================

/**
 * Handle tune file uploads
 * In production, integrate with S3 or similar
 */
async function setupFileUploadEndpoint(app: express.Application): Promise<void> {
  const multer = await import('multer');

  // Configure storage
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = path.join(__dirname, '../../uploads/tunes');
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `tune-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer.default({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max
    },
    fileFilter: (_req, file, cb) => {
      // Allow common tune file types
      const allowedTypes = [
        '.hpt', '.tun', '.bin', '.cal', '.ctz', '.hpz', // Tune files
        '.zip', '.rar', '.7z', // Archives
      ];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${ext} not allowed`));
      }
    },
  });

  app.post('/upload/tune', authMiddleware, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.vendorId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Calculate file hash
      const crypto = await import('crypto');
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      res.json({
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        fileHash,
        mimeType: req.file.mimetype || 'application/octet-stream',
      });
    } catch (error) {
      console.error('[Upload] Error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });
}

// =============================================================================
// DOWNLOAD HANDLER
// =============================================================================

async function setupDownloadEndpoint(app: express.Application): Promise<void> {
  app.get('/downloads/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      // Verify download token
      const payload = jwt.verify(token, JWT_SECRET) as {
        orderLineId: number;
        fileId: number;
      };

      // Get the tune file
      const tuneFile = await prisma.tuneFile.findUnique({
        where: { id: payload.fileId },
        include: { product: true },
      });

      if (!tuneFile) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Increment download count
      await prisma.tuneFile.update({
        where: { id: tuneFile.id },
        data: { downloadCount: { increment: 1 } },
      });

      await prisma.orderLine.update({
        where: { id: payload.orderLineId },
        data: { downloadCount: { increment: 1 } },
      });

      // Send file
      res.download(tuneFile.filePath, tuneFile.fileName);
    } catch (error) {
      if ((error as Error).name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Download link has expired' });
        return;
      }
      console.error('[Download] Error:', error);
      res.status(500).json({ error: 'Download failed' });
    }
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const { server, httpServer } = await createApolloServer();

  // Setup additional endpoints
  const app = httpServer.listeners('request')[0] as express.Application;
  if (app) {
    await setupFileUploadEndpoint(app);
    await setupDownloadEndpoint(app);
  }

  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 TunerSwap Vendor API Server                             ║
║                                                               ║
║   GraphQL:  http://localhost:${PORT}/graphql                     ║
║   Health:   http://localhost:${PORT}/health                      ║
║   Webhook:  http://localhost:${PORT}/webhooks/vendure            ║
║                                                               ║
║   Environment: ${process.env.NODE_ENV || 'development'}                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Server] Shutting down...');
    await server.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
