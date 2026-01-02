# TunerSwap Multi-Vendor Architecture Migration Plan

## Executive Summary

This document outlines the migration from the current Vendure-based seller isolation (using Channels/Roles/Permissions) to a proper multi-vendor architecture with a dedicated Vendor API layer and MarketplaceDB.

---

## Current State (Problems)

The current implementation attempts to use Vendure's built-in features for multi-vendor isolation:

| Feature Used | Problem |
|--------------|---------|
| **Channels** | Designed for distribution (multi-currency, multi-region), NOT row-level vendor isolation |
| **Roles/Permissions** | Global scope - cannot filter data per vendor |
| **Admin UI** | No row-level security - sellers with admin access can see other sellers' data |
| **Product visibility** | Leaks across channels when permissions are misconfigured |

**Result**: Sellers either get too much access (admin power) or no access at all.

---

## New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
├──────────────────┬─────────────────────┬───────────────────────┤
│  Driver Web      │  SellerAdmin        │  Admin Dashboard      │
│  (Remix/React)   │  Dashboard          │  (Vendure Admin)      │
│                  │  (React)            │                       │
└────────┬─────────┴──────────┬──────────┴───────────┬───────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
├─────────────────────┬───────────────────┬──────────────────────┤
│  Vendure Shop API   │  VENDOR API       │  Vendure Admin API   │
│  (Public)           │  (NEW - Port 3001)│  (Staff Only)        │
│                     │  Row-level secure │                       │
└─────────┬───────────┴─────────┬─────────┴───────────┬──────────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
├──────────────────────┬──────────────────────────────────────────┤
│   Vendure DB         │   MarketplaceDB (NEW)                    │
│   (SQLite/Postgres)  │   (Postgres)                             │
│   - Products         │   - Sellers (with vendorId isolation)    │
│   - Orders           │   - Products (vendor-owned)              │
│   - Customers        │   - Orders (vendor-segmented)            │
│   - Payments         │   - Reviews, Messages, Calendar          │
└──────────────────────┴──────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │    SYNC WORKER      │
                    │  (Bidirectional)    │
                    └─────────────────────┘
```

---

## Migration Phases

### Phase 1: Foundation (Proof of Concept)

**Goal**: Stand up the new architecture alongside existing system.

**Duration**: Development effort, not time-boxed.

#### Tasks:

1. **Database Setup**
   - [ ] Set up PostgreSQL for MarketplaceDB
   - [ ] Run Prisma migrations (`prisma/migrations/001_create_marketplace_tables.sql`)
   - [ ] Seed initial data (`prisma/seed.ts`)

2. **Vendor API Deployment**
   - [ ] Install dependencies: `npm install @apollo/server @prisma/client bcryptjs jsonwebtoken graphql-request`
   - [ ] Configure environment variables (see `.env.example`)
   - [ ] Start Vendor API server on port 3001
   - [ ] Test authentication (register, login, refresh)

3. **Frontend Integration**
   - [ ] Add `vendor-api` provider to website (`app/providers/vendor-api/`)
   - [ ] Create seller login page (`/selleradmin/login`)
   - [ ] Test basic seller authentication flow

4. **Sync Worker Setup**
   - [ ] Configure Vendure webhooks to call `/webhooks/vendure`
   - [ ] Start sync worker process
   - [ ] Test product creation sync (MarketplaceDB → Vendure)

#### Success Criteria:
- Seller can register, login, and view their profile
- Products created in Vendor API appear in Vendure
- Orders from Vendure appear in seller's dashboard

---

### Phase 2: Pilot (10 Sellers)

**Goal**: Migrate a small group of existing sellers to validate the architecture.

#### Tasks:

1. **Seller Migration**
   - [ ] Export existing SellerProfile entities from Vendure
   - [ ] Import into MarketplaceDB with correct field mapping
   - [ ] Generate new credentials and notify sellers

2. **Product Migration**
   - [ ] Migrate existing products to MarketplaceDB
   - [ ] Maintain Vendure product IDs for order history
   - [ ] Verify product visibility in storefront

3. **Order History Migration**
   - [ ] Create marketplace orders from Vendure order history
   - [ ] Ensure sellers see their historical orders

4. **Dashboard Feature Parity**
   - [ ] Update all SellerAdmin components to use new API hooks
   - [ ] Test all dashboard features:
     - Overview stats
     - Profile editing
     - Product management (create, edit, publish, archive)
     - Order management (view, ship, fulfill)
     - Messages
     - Calendar
     - Reviews

5. **Bug Fixes & Refinement**
   - [ ] Address issues reported by pilot sellers
   - [ ] Optimize query performance
   - [ ] Add missing features

#### Success Criteria:
- 10 sellers actively using new dashboard
- No data leakage between sellers
- Order flow works end-to-end
- Seller feedback is positive

---

### Phase 3: Full Rollout

**Goal**: Migrate all sellers and deprecate old system.

#### Tasks:

1. **Mass Migration**
   - [ ] Batch migrate all remaining sellers
   - [ ] Automated credential generation and email notification
   - [ ] Downtime window for final sync

2. **Remove Old Code**
   - [ ] Disable Vendure Admin access for sellers
   - [ ] Remove old SellerProfile entities from Vendure
   - [ ] Clean up unused channels/roles

3. **Documentation**
   - [ ] Update seller onboarding documentation
   - [ ] Create API documentation for partners
   - [ ] Internal runbooks for support team

4. **Monitoring & Alerting**
   - [ ] Set up sync worker monitoring
   - [ ] Alert on sync failures
   - [ ] Dashboard health metrics

#### Success Criteria:
- All sellers on new system
- Old code removed
- Zero seller-reported data leaks
- Sync worker reliability > 99.9%

---

## Environment Variables

Create `.env` files with these variables:

### Backend (`v2/.env`)

```env
# Existing Vendure config
APP_ENV=dev
PORT=3000
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=superadmin

# NEW: MarketplaceDB
MARKETPLACE_DATABASE_URL="postgresql://user:password@localhost:5432/tunerswap_marketplace"

# NEW: Vendor API
VENDOR_API_PORT=3001
VENDOR_JWT_SECRET=your-very-secure-jwt-secret-change-in-production

# NEW: Sync Worker
VENDURE_ADMIN_API=http://localhost:3000/admin-api
VENDURE_SHOP_API=http://localhost:3000/shop-api
DEFAULT_SHIPPING_ZONE_ID=1
DEFAULT_TAX_ZONE_ID=1
```

### Frontend (`website/.env`)

```env
# Existing
VENDURE_SHOP_API=http://localhost:3000/shop-api

# NEW: Vendor API
VENDOR_API_URL=http://localhost:3001/graphql
```

---

## Running the New System

### 1. Start PostgreSQL

```bash
# Using Docker
docker run -d \
  --name tunerswap-postgres \
  -e POSTGRES_USER=tunerswap \
  -e POSTGRES_PASSWORD=tunerswap \
  -e POSTGRES_DB=tunerswap_marketplace \
  -p 5432:5432 \
  postgres:15
```

### 2. Run Migrations

```bash
cd v2
npx prisma migrate deploy
npx ts-node prisma/seed.ts
```

### 3. Start Vendure (existing)

```bash
cd v2
npm run dev
# Runs on port 3000
```

### 4. Start Vendor API (new)

```bash
cd v2
npx ts-node src/vendor-api/server.ts
# Runs on port 3001
```

### 5. Start Sync Worker (new)

```bash
cd v2
npx ts-node src/vendor-api/sync-worker.ts
```

### 6. Start Frontend

```bash
cd website
npm run dev
# Runs on port 5173
```

---

## Rollback Plan

If issues arise during migration:

1. **Phase 1**: Simply stop new services; no data has been migrated
2. **Phase 2**:
   - Revert pilot sellers to old system
   - Re-enable Vendure Admin access
   - Delete MarketplaceDB seller records
3. **Phase 3**:
   - Requires data restore from backup
   - Schedule extended downtime
   - Communicate with all sellers

**Always maintain database backups before each phase.**

---

## Questions to Address Before Starting

1. **Database choice**: Stick with PostgreSQL or use managed service (e.g., Supabase, PlanetScale)?
2. **Hosting**: Where will Vendor API and Sync Worker run? (Same server as Vendure? Separate?)
3. **Authentication**: Use existing Vendure customer auth or separate vendor auth system?
4. **Stripe Connect**: How are seller payouts currently handled? Does this change?
5. **Email**: What emails need to be sent from Vendor API? (Use existing Vendure email or separate?)

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1 | 1-2 weeks development |
| Phase 2 | 2-4 weeks (including pilot feedback) |
| Phase 3 | 1-2 weeks |

**Total**: 4-8 weeks depending on complexity and feedback cycles.

---

## Contact

For questions about this migration plan, contact the development team.
