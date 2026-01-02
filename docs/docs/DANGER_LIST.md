# TunerSwap Security Danger List & Pitfalls

## Critical Security Issues to Avoid

This document lists common security pitfalls in multi-vendor marketplace systems and how to avoid them in TunerSwap.

---

## 1. Authentication & Authorization

### Danger: Token Leakage

**Problem**: JWT tokens stored insecurely or transmitted without HTTPS.

**Mitigations**:
- Always use HTTPS in production
- Store tokens in `localStorage` (not cookies for cross-origin API)
- Set reasonable token expiration (7 days max)
- Implement token refresh mechanism
- Clear tokens on logout

```typescript
// GOOD: Clear token properly
export function logout() {
  localStorage.removeItem('tunerswap_vendor_token');
  // Also clear any cached user data
}

// BAD: Token never expires or cleared
```

### Danger: Authorization Bypass (IDOR)

**Problem**: Seller A can access Seller B's data by guessing IDs.

**Mitigations**:
- **ALWAYS** filter queries by `vendorId` from the JWT token
- Never trust client-provided `vendorId`
- Use auth guards on every resolver

```typescript
// GOOD: Filter by authenticated vendor
const orders = await prisma.order.findMany({
  where: { vendorId: ctx.vendorId }, // From JWT, not request
});

// BAD: Trust client-provided vendorId
const orders = await prisma.order.findMany({
  where: { vendorId: args.vendorId }, // INSECURE!
});
```

### Danger: Seller Impersonation

**Problem**: Admin accidentally (or maliciously) acts as a seller.

**Mitigations**:
- Separate admin and vendor authentication systems
- Log all admin actions with clear audit trail
- Require re-authentication for sensitive operations

---

## 2. Data Isolation

### Danger: Cross-Vendor Data Leakage

**Problem**: GraphQL query returns data from multiple vendors.

**Mitigations**:
- Add `vendorId` filter to EVERY query that returns seller-specific data
- Use database-level row security policies (PostgreSQL RLS)
- Code review all new resolvers for proper filtering

```sql
-- PostgreSQL Row Level Security (additional protection)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_isolation ON products
  USING (vendor_id = current_setting('app.current_vendor_id')::int);
```

### Danger: Leaky Field Resolvers

**Problem**: Nested field resolvers don't check ownership.

```typescript
// BAD: Seller field resolver doesn't check ownership
Seller: {
  orders: async (parent) => {
    return prisma.order.findMany({ where: { vendorId: parent.id } });
    // What if parent.id was fetched without auth check?
  }
}

// GOOD: Re-verify ownership in field resolver
Seller: {
  orders: async (parent, args, ctx) => {
    // Only return orders if viewing own profile
    if (parent.id !== ctx.vendorId) {
      return { items: [], totalItems: 0 };
    }
    return prisma.order.findMany({ where: { vendorId: parent.id } });
  }
}
```

### Danger: Sync Worker Data Mixing

**Problem**: Sync worker accidentally associates data with wrong vendor.

**Mitigations**:
- Always include `vendorId` in sync payloads
- Validate vendor ownership before applying synced data
- Log all sync operations with vendor context
- Use transactions to ensure atomic updates

---

## 3. Database Sync Race Conditions

### Danger: Duplicate Records

**Problem**: Same entity synced twice creates duplicates.

**Mitigations**:
- Use `vendure_product_id` as unique constraint
- Use upsert operations instead of insert
- Implement idempotency keys

```typescript
// GOOD: Use upsert with unique constraint
await prisma.product.upsert({
  where: { vendureProductId: payload.id },
  update: { ...mappedData },
  create: { vendureProductId: payload.id, ...mappedData },
});

// BAD: Blind insert
await prisma.product.create({ data: mappedData }); // May duplicate!
```

### Danger: Out-of-Order Updates

**Problem**: Old update arrives after new update, reverting data.

**Mitigations**:
- Include timestamp in sync payloads
- Only apply updates if timestamp is newer
- Use optimistic locking with version numbers

```typescript
// Check timestamp before applying
if (payload.updatedAt > existingProduct.updatedAt) {
  await prisma.product.update({ where: { id: existingProduct.id }, data: mappedData });
}
```

### Danger: Orphaned Records

**Problem**: MarketplaceDB has products that no longer exist in Vendure.

**Mitigations**:
- Implement periodic reconciliation job
- Soft-delete in MarketplaceDB, hard-delete only after confirmation
- Log all delete operations

---

## 4. File Upload Security

### Danger: Malicious File Uploads

**Problem**: Seller uploads malware disguised as tune file.

**Mitigations**:
- Validate file extensions strictly
- Scan files with antivirus (ClamAV)
- Store files in isolated storage (S3 with no public access)
- Never execute uploaded files

```typescript
// GOOD: Strict file type validation
const allowedTypes = ['.hpt', '.tun', '.bin', '.cal', '.ctz', '.hpz', '.zip'];
const ext = path.extname(file.originalname).toLowerCase();
if (!allowedTypes.includes(ext)) {
  throw new Error('File type not allowed');
}
```

### Danger: Path Traversal

**Problem**: Attacker crafts filename to write outside upload directory.

**Mitigations**:
- Generate random filenames server-side
- Never use user-provided filenames in paths
- Use path sanitization

```typescript
// GOOD: Generate safe filename
const safeFilename = `tune-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

// BAD: Use user filename
const filename = req.file.originalname; // Could be "../../../etc/passwd"
```

### Danger: Download Link Exposure

**Problem**: Download links are guessable or never expire.

**Mitigations**:
- Use signed URLs with expiration
- Include order verification in download token
- Rate limit downloads

---

## 5. API Security

### Danger: GraphQL Denial of Service

**Problem**: Deeply nested queries consume excessive resources.

**Mitigations**:
- Implement query depth limiting
- Implement query complexity analysis
- Rate limit by IP and user

```typescript
// Apollo Server config
const server = new ApolloServer({
  validationRules: [depthLimit(10), createComplexityLimitRule(1000)],
});
```

### Danger: Information Disclosure

**Problem**: Error messages expose internal details.

**Mitigations**:
- Use generic error messages in production
- Log detailed errors server-side only
- Never expose stack traces

```typescript
// GOOD: Generic error in production
formatError: (error) => {
  if (process.env.NODE_ENV === 'production') {
    return { message: 'An error occurred', code: error.extensions?.code };
  }
  return error;
}
```

### Danger: Missing Rate Limiting

**Problem**: Attackers brute-force login or spam endpoints.

**Mitigations**:
- Rate limit login attempts (5/minute)
- Rate limit API requests (100/minute per user)
- Implement CAPTCHA for registration

---

## 6. Payment & Financial

### Danger: Fee Manipulation

**Problem**: Seller manipulates order to reduce platform fees.

**Mitigations**:
- Calculate fees server-side only
- Store fee rate in order record at time of purchase
- Audit fee calculations regularly

```typescript
// GOOD: Calculate fee server-side
const platformFeeRate = 0.10; // 10% - from config, not request
const platformFee = subtotal * platformFeeRate;
const vendorPayout = subtotal - platformFee;
```

### Danger: Payout Before Delivery

**Problem**: Seller receives payout, never delivers product.

**Mitigations**:
- Hold payouts for configurable period (7-14 days)
- Release funds only after delivery confirmation
- Implement dispute resolution process

### Danger: Fake Orders

**Problem**: Seller creates fake orders to inflate stats.

**Mitigations**:
- Verify payment through Stripe/PayPal
- Flag suspicious patterns (same buyer/seller, same IP)
- Manual review for high-value orders

---

## 7. Session & State Management

### Danger: Session Fixation

**Problem**: Attacker tricks user into using attacker's session.

**Mitigations**:
- Regenerate session/token after login
- Use secure, httpOnly cookies for web sessions
- Validate session origin

### Danger: Stale Data Display

**Problem**: Dashboard shows outdated data after changes.

**Mitigations**:
- Implement proper cache invalidation
- Use optimistic UI updates with rollback
- Show "last updated" timestamps

---

## 8. Third-Party Integrations

### Danger: Webhook Spoofing

**Problem**: Attacker sends fake Vendure webhooks.

**Mitigations**:
- Verify webhook signatures
- Whitelist webhook source IPs if possible
- Validate payload structure

```typescript
// Verify webhook signature
const signature = req.headers['x-vendure-signature'];
const expectedSignature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

### Danger: Stripe Connect Misconfiguration

**Problem**: Platform receives seller funds, seller can't withdraw.

**Mitigations**:
- Test payout flow thoroughly
- Monitor Stripe Connect dashboard for issues
- Implement payout failure alerts

---

## 9. Database Security

### Danger: SQL Injection

**Problem**: User input used directly in queries.

**Mitigations**:
- Use Prisma (parameterized queries by default)
- Never concatenate user input into SQL
- Validate and sanitize all inputs

```typescript
// GOOD: Prisma handles parameterization
const products = await prisma.product.findMany({
  where: { name: { contains: userInput } },
});

// BAD: Raw SQL with concatenation
const products = await prisma.$queryRaw`
  SELECT * FROM products WHERE name LIKE '%${userInput}%'
`; // SQL INJECTION VULNERABLE!
```

### Danger: Unencrypted Sensitive Data

**Problem**: Passwords or tokens stored in plaintext.

**Mitigations**:
- Hash passwords with bcrypt (cost factor 12+)
- Encrypt sensitive fields at rest
- Never log sensitive data

---

## 10. Deployment & Operations

### Danger: Exposed Environment Variables

**Problem**: `.env` file committed to git or exposed in logs.

**Mitigations**:
- Add `.env` to `.gitignore`
- Use secret management (Vault, AWS Secrets Manager)
- Audit logs for sensitive data

### Danger: Missing Monitoring

**Problem**: Security incidents go unnoticed.

**Mitigations**:
- Monitor failed login attempts
- Alert on unusual API patterns
- Log all admin/sensitive operations
- Regular security audits

### Danger: Outdated Dependencies

**Problem**: Known vulnerabilities in packages.

**Mitigations**:
- Run `npm audit` regularly
- Use Dependabot or similar
- Keep critical packages updated

---

## Security Checklist for Code Review

Before merging any PR that touches seller data:

- [ ] All queries filter by `ctx.vendorId` (not client-provided ID)
- [ ] Ownership is verified before mutations
- [ ] Errors don't expose sensitive information
- [ ] File uploads are validated and sanitized
- [ ] No raw SQL with user input
- [ ] Sensitive data is not logged
- [ ] Rate limiting is applied to new endpoints
- [ ] Tests include negative cases (unauthorized access)

---

## Incident Response

If a security incident is discovered:

1. **Contain**: Disable affected functionality immediately
2. **Assess**: Determine scope (how many sellers affected?)
3. **Notify**: Inform affected users within 24 hours
4. **Fix**: Deploy patch and verify
5. **Review**: Post-incident analysis and documentation
6. **Improve**: Add tests/monitoring to prevent recurrence

---

## Contact

Report security vulnerabilities to: security@tuner-swap.com
