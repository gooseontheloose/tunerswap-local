# TunerSwap Development Startup Guide

This guide explains how to start all the services required for TunerSwap development.

## Architecture Overview

TunerSwap runs **two separate servers**:

1. **Vendure Server** (Port 3000) - Main commerce engine
   - Admin Dashboard: `http://localhost:3000/admin`
   - Shop API: `http://localhost:3000/shop-api`
   - Admin API: `http://localhost:3000/admin-api`

2. **Vendor API Server** (Port 3001) - Custom seller API with MarketplaceDB
   - GraphQL Endpoint: `http://localhost:3001/graphql`
   - Health Check: `http://localhost:3001/health`
   - Webhooks: `http://localhost:3001/webhooks/vendure`

## Quick Start

### Option 1: Start Both Servers (Recommended)

Open **two terminal windows**:

**Terminal 1 - Vendure Server:**
```bash
cd C:\Users\oliver\tunerswap\v2
yarn dev
```

**Terminal 2 - Vendor API Server:**
```bash
cd C:\Users\oliver\tunerswap\v2
npx ts-node --transpile-only src/vendor-api/server.ts
```

### Option 2: Start Only Vendure (if not using Vendor API features)

```bash
cd C:\Users\oliver\tunerswap\v2
yarn dev
```

## Database Setup

### Vendure Database (SQLite)
- Location: `v2/vendure.sqlite`
- Auto-created on first `yarn dev`
- Migrations run automatically

### MarketplaceDB (SQLite for dev)
- Location: `v2/prisma/marketplace.db`
- Connection: `MARKETPLACE_DATABASE_URL` in `.env`

**To set up MarketplaceDB:**

```bash
cd C:\Users\oliver\tunerswap\v2

# Generate Prisma client
npx prisma generate --schema=prisma/schema.prisma

# Push schema to database (creates tables)
npx prisma db push --schema=prisma/schema.prisma

# Seed test data (optional)
npx ts-node --transpile-only prisma/seed.ts
```

## Environment Variables

Make sure your `v2/.env` file has these settings:

```env
# Vendure
APP_ENV=dev
PORT=3000
COOKIE_SECRET=your-secret-here
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=superadmin

# MarketplaceDB
MARKETPLACE_DATABASE_URL="file:./prisma/marketplace.db"

# Vendor API
VENDOR_API_PORT=3001
VENDOR_JWT_SECRET=your-jwt-secret-here

# Email (optional for dev)
SMTP_HOST=smtp.dreamhost.com
SMTP_PORT=465
SMTP_USER=noreply@tuner-swap.com
SMTP_PASSWORD=your-password
```

## Common Commands

### Vendure

```bash
# Start dev server
yarn dev

# Build for production
yarn build

# Run production server
yarn start
```

### Vendor API / MarketplaceDB

```bash
# Start Vendor API server
npx ts-node --transpile-only src/vendor-api/server.ts

# Regenerate Prisma client after schema changes
npx prisma generate --schema=prisma/schema.prisma

# Push schema changes to database
npx prisma db push --schema=prisma/schema.prisma

# Open Prisma Studio (database GUI)
npx prisma studio --schema=prisma/schema.prisma

# Seed the database
npx ts-node --transpile-only prisma/seed.ts
```

### Frontend (Website)

```bash
cd C:\Users\oliver\tunerswap\website
npm run dev
```

## Testing the Vendor API

Once the Vendor API server is running on port 3001:

### 1. Test Health Check
```bash
curl http://localhost:3001/health
```

### 2. Test Login (using test seller from seed)
```bash
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { loginSeller(email: \"mike@tunerswap.test\", password: \"test123\") { token seller { id firstName } } }"}'
```

### 3. Test Authenticated Query
```bash
# Replace YOUR_TOKEN with the token from login
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "query { me { id email businessName } }"}'
```

## Database Migrations

### When to Run Migrations

1. **After pulling new code** - Check if schema changed
2. **After modifying Prisma schema** - Push changes to DB
3. **After fresh clone** - Initialize database

### Vendure Migrations

Vendure uses TypeORM with automatic migrations in dev mode:
- Schema syncs automatically with `yarn dev`
- For production, use `yarn migration:generate` and `yarn migration:run`

### MarketplaceDB Migrations

Prisma handles migrations:

```bash
# Development - push schema directly (destructive!)
npx prisma db push --schema=prisma/schema.prisma

# Production - create migration file
npx prisma migrate dev --name description_of_change --schema=prisma/schema.prisma

# Apply migrations in production
npx prisma migrate deploy --schema=prisma/schema.prisma
```

## Troubleshooting

### "Port 3000 already in use"
```bash
# Find and kill the process
netstat -ano | findstr :3000
taskkill /F /PID <PID>
```

### "Port 3001 already in use"
```bash
netstat -ano | findstr :3001
taskkill /F /PID <PID>
```

### "Cannot find module '.prisma/marketplace-client'"
```bash
npx prisma generate --schema=prisma/schema.prisma
```

### "Table does not exist"
```bash
npx prisma db push --schema=prisma/schema.prisma
```

### TypeScript errors when starting Vendor API
Use `--transpile-only` to skip type checking:
```bash
npx ts-node --transpile-only src/vendor-api/server.ts
```

## Admin Access

### Vendure Admin Dashboard
- URL: `http://localhost:3000/admin`
- Username: `superadmin`
- Password: `superadmin`

### Marketplace Settings in Admin
Navigate to: **Marketplace** > **Settings**

Available controls:
- Auto-Approve New Sellers
- Auto-Verify Email (emergency mode)
- Auto-Verify Seller Badge
- Manual Customer Email Verification

### Vendor API (Seller Dashboard Backend)
- URL: `http://localhost:3001/graphql`
- Auth: JWT Bearer token
- Test accounts: See `prisma/seed.ts`

## Test Seller Accounts

After running `npx ts-node prisma/seed.ts`:

| Email | Password | Business Name |
|-------|----------|---------------|
| mike@tunerswap.test | test123 | MJ Performance Tunes |
| sarah@tunerswap.test | test123 | SC Motorsports |
| carlos@tunerswap.test | test123 | CR Diesel Performance |
| james@tunerswap.test | test123 | JDM Tuning Co |
| marcus@tunerswap.test | test123 | MW Ford Performance |

## Production Checklist

Before deploying to production:

1. [ ] Change `VENDOR_JWT_SECRET` to a strong random string
2. [ ] Change `COOKIE_SECRET` to a strong random string
3. [ ] Change superadmin password
4. [ ] Switch MarketplaceDB from SQLite to PostgreSQL
5. [ ] Configure proper SMTP settings
6. [ ] Set up proper CORS origins in `server.ts`
7. [ ] Enable HTTPS
8. [ ] Set `APP_ENV=production`
