# TunerSwap MarketplacePlugin

A Vendure plugin for managing a multi-vendor automotive tuning marketplace with comprehensive admin controls for user and seller account management.

## IMPORTANT: Architecture Change

**Seller authentication has been migrated from Vendure Admin to the Vendor API.**

### Old Architecture (DEPRECATED)
```
Seller Registration -> Vendure Channel + Role + Administrator -> Vendure Admin Dashboard
```
This approach had security issues - Vendure Channels don't provide true row-level isolation.

### New Architecture (CURRENT)
```
Seller Registration -> Vendor API (port 3001) -> MarketplaceDB -> Custom Seller Dashboard
```

### What This Means:
1. **Sellers do NOT get Vendure Administrator accounts**
2. **Sellers do NOT get dedicated Vendure Channels**
3. **Sellers authenticate via Vendor API** (JWT-based)
4. **Seller dashboard uses Vendor API** for all data operations
5. **Products/Orders in Vendure** are synced via Sync Worker

### Vendor API Endpoints
```
Base URL: http://localhost:3001/graphql

# Register
mutation { registerSeller(input: {...}) { token seller { id } } }

# Login
mutation { loginSeller(email: "...", password: "...") { token seller { id } } }

# Protected operations (require JWT in Authorization header)
query { me { id email businessName } }
query { myProducts { items { id name } } }
```

---

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Plugin Options](#plugin-options)
- [Runtime Settings](#runtime-settings)
- [Admin API Reference](#admin-api-reference)
  - [Queries](#queries)
  - [Seller Management Mutations](#seller-management-mutations)
  - [Customer Management Mutations](#customer-management-mutations)
  - [System Settings Mutations](#system-settings-mutations)
- [Shop API Reference](#shop-api-reference)
- [Permissions](#permissions)
- [Use Cases](#use-cases)
- [Troubleshooting](#troubleshooting)

---

## Installation

The MarketplacePlugin is included in the Vendure config:

```typescript
// vendure-config.ts
import { MarketplacePlugin } from './plugins/marketplace';

export const config: VendureConfig = {
    plugins: [
        MarketplacePlugin.init({
            autoApprove: true,
            autoVerifyEmail: false,
            autoVerifySeller: false,
        }),
        // ... other plugins
    ],
};
```

---

## Configuration

### Plugin Options

Configure the plugin at startup via `MarketplacePlugin.init()`:

```typescript
interface MarketplacePluginOptions {
    /**
     * If true, sellers are automatically approved upon registration.
     * If false, an admin must manually approve them.
     * Default: true
     */
    autoApprove: boolean;

    /**
     * If true, all new users (customers/sellers) bypass email verification.
     * Useful for development or when email system is down.
     * Default: false
     */
    autoVerifyEmail: boolean;

    /**
     * If true, new sellers automatically receive the "verified" trust badge.
     * This is different from email verification - this is the seller trust badge
     * that appears on their profile.
     * Default: false
     */
    autoVerifySeller: boolean;
}
```

### Example Configurations

**Development Mode** (no email verification, auto-approve everything):
```typescript
MarketplacePlugin.init({
    autoApprove: true,
    autoVerifyEmail: true,
    autoVerifySeller: false,
})
```

**Production Mode** (manual approval, email verification required):
```typescript
MarketplacePlugin.init({
    autoApprove: false,
    autoVerifyEmail: false,
    autoVerifySeller: false,
})
```

**Soft Launch Mode** (auto-approve but require email verification):
```typescript
MarketplacePlugin.init({
    autoApprove: true,
    autoVerifyEmail: false,
    autoVerifySeller: false,
})
```

---

## Runtime Settings

Settings can be changed at runtime via GraphQL mutations **without requiring a server restart**. Runtime settings override plugin options.

### How It Works

```
Plugin Options (startup) --> Runtime Settings (mutations) --> Effective Settings
```

The plugin maintains:
- `MarketplacePlugin.options` - Initial configuration from `init()`
- `MarketplacePlugin.runtimeSettings` - Overrides set via mutations
- `MarketplacePlugin.getEffectiveSettings()` - Returns merged settings

### Persistence

Runtime settings are stored **in memory only**. They reset when the server restarts. For persistent settings, modify the plugin options in `vendure-config.ts`.

---

## Admin API Reference

All admin mutations require authentication. Permission levels:
- `MarketplaceAdmin` - Staff with marketplace management permission
- `SuperAdmin` - Full system access

### Queries

#### `marketplaceSettings`

Get current effective marketplace settings.

**Permission:** `SuperAdmin`

```graphql
query {
    marketplaceSettings {
        autoVerifyEmail
        autoVerifySeller
        autoApprove
    }
}
```

**Response:**
```json
{
    "data": {
        "marketplaceSettings": {
            "autoVerifyEmail": false,
            "autoVerifySeller": false,
            "autoApprove": true
        }
    }
}
```

#### `sellerProfiles`

List all seller profiles with optional filtering.

**Permission:** `MarketplaceAdmin`

```graphql
query {
    sellerProfiles(skip: 0, take: 20, status: "pending") {
        items {
            id
            firstName
            lastName
            businessName
            email
            status
            verified
            createdAt
        }
        totalItems
    }
}
```

#### `sellerProfile`

Get a single seller profile by ID.

**Permission:** `MarketplaceAdmin`

```graphql
query {
    sellerProfile(id: "1") {
        id
        firstName
        lastName
        businessName
        status
        verified
        rating
        reviewCount
        tunesSold
    }
}
```

---

### Seller Management Mutations

#### `approveSeller`

Approve a pending seller registration.

**Permission:** `MarketplaceAdmin`

```graphql
mutation {
    approveSeller(id: "1") {
        id
        status
    }
}
```

#### `rejectSeller`

Reject a seller registration.

**Permission:** `MarketplaceAdmin`

```graphql
mutation {
    rejectSeller(id: "1") {
        id
        status
    }
}
```

#### `suspendSeller`

Suspend an active seller account.

**Permission:** `MarketplaceAdmin`

```graphql
mutation {
    suspendSeller(id: "1") {
        id
        status
    }
}
```

#### `enableSeller`

Reactivate a suspended or rejected seller.

**Permission:** `MarketplaceAdmin`

```graphql
mutation {
    enableSeller(id: "1") {
        id
        status  # Returns "approved"
    }
}
```

#### `disableSeller`

Disable/suspend a seller account (alias for suspendSeller with clearer naming).

**Permission:** `MarketplaceAdmin`

```graphql
mutation {
    disableSeller(id: "1") {
        id
        status  # Returns "suspended"
    }
}
```

#### `verifySeller`

Grant the verified trust badge to a seller.

**Permission:** `MarketplaceAdmin`

```graphql
mutation {
    verifySeller(id: "1") {
        id
        verified  # Returns true
    }
}
```

#### `unverifySeller`

Remove the verified trust badge from a seller.

**Permission:** `MarketplaceAdmin`

```graphql
mutation {
    unverifySeller(id: "1") {
        id
        verified  # Returns false
    }
}
```

---

### Customer Management Mutations

#### `enableCustomer`

Reactivate a disabled customer account.

**Permission:** `SuperAdmin`

```graphql
mutation {
    enableCustomer(customerId: "1") {
        success
        message
    }
}
```

**Response:**
```json
{
    "data": {
        "enableCustomer": {
            "success": true,
            "message": "Customer account enabled successfully"
        }
    }
}
```

#### `disableCustomer`

Disable a customer account (prevents login).

**Permission:** `SuperAdmin`

```graphql
mutation {
    disableCustomer(customerId: "1") {
        success
        message
    }
}
```

#### `verifyCustomerEmail`

Manually verify a customer's email address (bypasses email verification).

**Permission:** `SuperAdmin`

```graphql
mutation {
    verifyCustomerEmail(customerId: "1") {
        success
        message
    }
}
```

**Use Cases:**
- Customer claims they never received verification email
- Testing in development
- Email system is down and you need to verify a specific user

#### `resendVerificationEmail`

Resend the verification email to a customer.

**Permission:** `SuperAdmin`

```graphql
mutation {
    resendVerificationEmail(customerId: "1") {
        success
        message
    }
}
```

**Note:** Requires email handler to be configured in Vendure.

---

### System Settings Mutations

#### `updateMarketplaceSettings`

Update marketplace settings at runtime. All parameters are optional - only provided values will be updated.

**Permission:** `SuperAdmin`

```graphql
mutation {
    updateMarketplaceSettings(
        autoVerifyEmail: true
        autoVerifySeller: false
        autoApprove: true
    ) {
        autoVerifyEmail
        autoVerifySeller
        autoApprove
    }
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `autoVerifyEmail` | Boolean | Bypass email verification for new registrations |
| `autoVerifySeller` | Boolean | Auto-grant verified badge to new sellers |
| `autoApprove` | Boolean | Auto-approve new seller registrations |

---

## Shop API Reference

### Queries

#### `activeSellerProfile`

Get the current logged-in user's seller profile.

```graphql
query {
    activeSellerProfile {
        id
        firstName
        lastName
        businessName
        status
        verified
    }
}
```

#### `sellerBySlug`

Get a public seller profile by slug.

```graphql
query {
    sellerBySlug(slug: "mike-johnson-abc123") {
        id
        businessName
        bio
        rating
        reviewCount
        verified
    }
}
```

#### `sellers`

List all approved sellers (public listing).

```graphql
query {
    sellers(skip: 0, take: 20) {
        items {
            id
            businessName
            rating
            verified
        }
        totalItems
    }
}
```

### Mutations

#### `registerSeller`

Register a new seller account.

```graphql
mutation {
    registerSeller(input: {
        email: "seller@example.com"
        password: "securepassword"
        firstName: "John"
        lastName: "Doe"
        businessName: "John's Tuning"
        location: "Austin, TX"
        bio: "Professional tuner with 10+ years experience"
        experience: "10+"
        software: ["HP Tuners", "EFI Live"]
        vehiclePlatforms: ["GM", "Ford"]
        tuneTypes: ["Performance", "Tow/Haul"]
        hasDyno: "yes"
    }) {
        success
        message
        sellerId
        adminUrl
        channelToken
    }
}
```

---

## Permissions

### MarketplaceAdmin Permission

Custom permission for marketplace management. Grant this to staff who need to manage sellers but shouldn't have full admin access.

```typescript
// permissions.ts
export const MarketplaceAdminPermission = new PermissionDefinition({
    name: 'MarketplaceAdmin',
    description: 'Allows management of marketplace sellers and settings',
});
```

### Permission Matrix

| Action | MarketplaceAdmin | SuperAdmin |
|--------|------------------|------------|
| View seller profiles | ✅ | ✅ |
| Approve/reject sellers | ✅ | ✅ |
| Suspend/enable sellers | ✅ | ✅ |
| Verify/unverify sellers | ✅ | ✅ |
| Enable/disable customers | ❌ | ✅ |
| Verify customer email | ❌ | ✅ |
| Resend verification email | ❌ | ✅ |
| Update marketplace settings | ❌ | ✅ |

---

## Use Cases

### 1. Email System Down - Emergency Auto-Verify

When your email system goes down and users can't receive verification emails:

```graphql
# Enable auto-verify mode for everyone
mutation {
    updateMarketplaceSettings(autoVerifyEmail: true) {
        autoVerifyEmail
    }
}

# When email is fixed, disable auto-verify
mutation {
    updateMarketplaceSettings(autoVerifyEmail: false) {
        autoVerifyEmail
    }
}
```

### 2. Manual Verification for Specific User

When a specific user reports they can't verify their email:

```graphql
# Option 1: Resend the email
mutation {
    resendVerificationEmail(customerId: "123") {
        success
        message
    }
}

# Option 2: Manually verify if email still doesn't work
mutation {
    verifyCustomerEmail(customerId: "123") {
        success
        message
    }
}
```

### 3. Seller Review Process

```graphql
# 1. View pending sellers
query {
    sellerProfiles(status: "pending") {
        items {
            id
            firstName
            lastName
            businessName
            bio
            experience
        }
        totalItems
    }
}

# 2. Approve a seller
mutation {
    approveSeller(id: "5") {
        id
        status
    }
}

# 3. Grant verified badge after reviewing their work
mutation {
    verifySeller(id: "5") {
        id
        verified
    }
}
```

### 4. Handling Fraudulent Seller

```graphql
# 1. Suspend the seller immediately
mutation {
    disableSeller(id: "10") {
        id
        status
    }
}

# 2. Also disable their customer account
mutation {
    disableCustomer(customerId: "456") {
        success
        message
    }
}

# 3. Remove their verified badge if they had one
mutation {
    unverifySeller(id: "10") {
        id
        verified
    }
}
```

### 5. Development/Testing Setup

```graphql
# Enable all auto-features for faster testing
mutation {
    updateMarketplaceSettings(
        autoVerifyEmail: true
        autoVerifySeller: true
        autoApprove: true
    ) {
        autoVerifyEmail
        autoVerifySeller
        autoApprove
    }
}
```

---

## Troubleshooting

### "Email is already verified"

When calling `verifyCustomerEmail` or `resendVerificationEmail`:

```json
{
    "success": false,
    "message": "Email is already verified"
}
```

**Solution:** The customer's email is already verified. No action needed.

### "Customer has no associated user account"

The customer exists but doesn't have a User entity (can't log in).

**Solution:** This happens when a customer was created via admin without a password. They need to go through the registration flow.

### "No native authentication method found"

The customer uses OAuth (Google, Facebook) instead of email/password.

**Solution:** OAuth users are automatically verified. No action needed.

### Runtime settings not persisting after restart

Runtime settings are intentionally stored in memory only.

**Solution:** For persistent settings, update `vendure-config.ts`:

```typescript
MarketplacePlugin.init({
    autoApprove: true,
    autoVerifyEmail: true,  // Make this permanent
    autoVerifySeller: false,
})
```

---

## File Structure

```
src/plugins/marketplace/
├── README.md                           # This documentation
├── marketplace.plugin.ts               # Main plugin definition
├── types.ts                            # TypeScript interfaces
├── permissions.ts                      # Custom permissions
├── index.ts                            # Exports
├── entities/
│   ├── seller-profile.entity.ts        # SellerProfile entity
│   ├── buyer-message.entity.ts         # Messaging entity
│   ├── buyer-connection.entity.ts      # Buyer-seller connections
│   └── calendar-event.entity.ts        # Booking/appointments
├── services/
│   └── seller-profile.service.ts       # Business logic
├── api/
│   ├── api-extensions.ts               # GraphQL schema extensions
│   ├── seller-profile-shop.resolver.ts # Shop API resolvers
│   └── seller-profile-admin.resolver.ts# Admin API resolvers
├── strategies/
│   ├── order-seller.strategy.ts        # Multi-vendor order splitting
│   ├── shipping-eligibility.checker.ts # Shipping rules
│   └── shipping-line-assignment.strategy.ts
└── ui/
    └── routes.tsx                      # Admin UI dashboard extension
```

---

## Seller/Buyer Dashboard Toggle

Sellers are also customers - they can purchase tunes from other sellers. The dashboard toggle framework allows sellers to switch between:

1. **Seller Dashboard** (primary) - Manage their listings, orders, messages
2. **Buyer Dashboard** - Browse and purchase tunes from others

### Architecture Note

Since sellers no longer access Vendure Admin directly, this toggle is implemented in the **frontend website** (`/website` directory), not in the Vendure plugin. The plugin provides:

- Customer management mutations (`customersForManagement`, `convertCustomerToSeller`)
- Seller profile queries for both the seller's own view and admin management

The frontend website should:

1. Check if the logged-in user is a seller (via `activeSellerProfile` query or custom field check)
2. If seller, show toggle button in header/nav
3. Toggle switches context between seller dashboard routes and buyer dashboard routes
4. Seller dashboard routes: `/dashboard/seller/*`
5. Buyer dashboard routes: `/dashboard/buyer/*` (or simply `/account/*`)

### Implementation Guide

In the website frontend:

```tsx
// Example toggle component
function DashboardToggle() {
    const [mode, setMode] = useState<'seller' | 'buyer'>('seller');
    const { isSeller } = useAuth(); // Check from customer customFields

    if (!isSeller) return null; // Only show for sellers

    return (
        <div className="flex gap-2">
            <button
                className={mode === 'seller' ? 'active' : ''}
                onClick={() => setMode('seller')}
            >
                Seller Dashboard
            </button>
            <button
                className={mode === 'buyer' ? 'active' : ''}
                onClick={() => setMode('buyer')}
            >
                Browse Tunes
            </button>
        </div>
    );
}
```

---

## Version History

### v1.2.0 (Current)
- Added customer management page in Vendure Admin (`/customers`)
- Added `customersForManagement` query with search/filter
- Added `convertCustomerToSeller` mutation
- Added Manage Customers route above Manage Tuners
- Documented seller/buyer dashboard toggle framework

### v1.1.0
- Added runtime settings via `updateMarketplaceSettings`
- Added `enableSeller` / `disableSeller` mutations
- Added `enableCustomer` / `disableCustomer` mutations
- Added `unverifySeller` mutation
- Added `resendVerificationEmail` mutation
- Added `marketplaceSettings` query
- Auto-verify email on seller registration when `autoVerifyEmail` is enabled
- Auto-verify seller badge when `autoVerifySeller` is enabled

### v1.0.0
- Initial release
- Seller registration with Vendure Channel/Role setup
- Basic approve/reject/suspend/verify mutations
- Manual email verification (`verifyCustomerEmail`)
