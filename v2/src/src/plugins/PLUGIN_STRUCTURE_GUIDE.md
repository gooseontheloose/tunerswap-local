# TunerSwap Plugin Structure Guide

## CRITICAL: READ BEFORE CREATING OR MODIFYING PLUGINS

This document exists because a simple JSDoc comment at the top of a plugin file
caused the Vite static analyzer to fail silently, breaking the entire dashboard
for hours. Learn from this mistake.

---

## The Problem That Caused This Document

On 2024-12-12, the MarketplacePlugin stopped being detected by the Vendure 3
dashboard build. The ONLY issue was a large JSDoc comment block (49 lines) at
the very top of the plugin file. The Vite config-loader's static analyzer
could not parse the file correctly.

**Cost of this mistake:** Hours of debugging, multiple failed attempts, and
significant token usage trying to fix something that should have taken 2 minutes.

---

## MANDATORY Plugin File Structure

Every plugin with a dashboard extension MUST follow this exact structure:

```typescript
// Single line comment only at the top (or no comment at all)
import { PluginCommonModule, VendurePlugin, Type } from '@vendure/core';

// Other imports here...

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [...],
    providers: [...],
    shopApiExtensions: { ... },
    adminApiExtensions: { ... },
    dashboard: './ui/routes.tsx',        // REQUIRED for dashboard extensions
    configuration: config => { ... },     // MUST be inline arrow function
    compatibility: '^3.0.0',
})
export class YourPlugin {
    // Class implementation
}

// Re-exports go AFTER the class, not before
export { SomePermission } from './permissions';
```

---

## RULES - DO NOT VIOLATE THESE

### 1. NO Large Comments Before Imports

BAD - Will break static analysis:
```typescript
/**
 * ============================================
 * MY AWESOME PLUGIN
 * ============================================
 *
 * This is a 50 line description...
 * ... more lines ...
 */
import { ... } from '@vendure/core';
```

GOOD - Works correctly:
```typescript
// My Awesome Plugin
import { ... } from '@vendure/core';
```

### 2. Configuration MUST Be Inline

BAD - Will not be detected:
```typescript
import { configureMyPlugin } from './config';

@VendurePlugin({
    configuration: configureMyPlugin,  // BROKEN - imported reference
})
```

GOOD - Works correctly:
```typescript
@VendurePlugin({
    configuration: config => {
        // All configuration logic inline here
        return config;
    },
})
```

### 3. Re-exports Go AFTER The Class

BAD - May confuse static analyzer:
```typescript
export { MyPermission } from './permissions';

@VendurePlugin({ ... })
export class MyPlugin { }
```

GOOD - Works correctly:
```typescript
@VendurePlugin({ ... })
export class MyPlugin { }

export { MyPermission } from './permissions';
```

### 4. Dashboard Routes File Structure

The `ui/routes.tsx` file must:
- Import `defineDashboardExtension` from `@vendure/dashboard`
- Call `defineDashboardExtension({ ... })` with navSections and routes
- Each navSection needs a unique `id`

```typescript
import { defineDashboardExtension } from '@vendure/dashboard';
import { SomeIcon } from 'lucide-react';

defineDashboardExtension({
    navSections: [
        {
            id: 'unique-section-id',  // MUST be unique across all plugins
            title: 'Section Title',
            icon: SomeIcon,
            order: 50,
        },
    ],
    routes: [
        {
            path: '/your-route',
            component: () => <YourComponent />,
            navMenuItem: {
                sectionId: 'unique-section-id',  // Must match navSection id
                id: 'unique-route-id',
                title: 'Route Title',
                icon: SomeIcon,
            },
        },
    ],
});
```

---

## Testing Plugin Detection

After creating or modifying a plugin, ALWAYS run:

```bash
npm run build:dashboard
```

Check the output for:
```
[plugin vendure:config-loader] Found X plugins: PluginA (local), PluginB (local)
```

If your plugin is NOT listed, the static analyzer failed to detect it.
Check the rules above - the issue is almost certainly in your plugin file structure.

---

## Current TunerSwap Plugins

1. **MarketplacePlugin** (`src/plugins/marketplace/`)
   - Multi-vendor marketplace functionality
   - Dashboard sections: Marketplace, Settings, Admin Listings, Admin Orders

2. **VisitorAnalyticsPlugin** (`src/plugins/visitor-analytics/`)
   - Visitor tracking and analytics
   - Dashboard sections: Analytics (Dashboard, Events, Security, Setup Guide)

---

## Adding A New Plugin Checklist

- [ ] Single line comment (or none) at top of plugin file
- [ ] All imports after the comment
- [ ] `@VendurePlugin` decorator with `dashboard: './ui/routes.tsx'`
- [ ] Configuration as inline arrow function (NOT imported)
- [ ] Class export immediately after decorator
- [ ] Re-exports at the END of the file
- [ ] Unique navSection IDs in routes.tsx
- [ ] Run `npm run build:dashboard` and verify plugin is detected
- [ ] Test the dashboard in browser to confirm routes work

---

## Why This Matters

The Vendure 3 dashboard build uses Vite with a static analyzer to find plugins.
This analyzer is NOT a full TypeScript compiler - it uses regex and AST parsing
that can be confused by certain code patterns.

When it fails, it fails SILENTLY. Your plugin simply won't appear in the
dashboard with no error message. This is why following the exact structure
above is critical.

---

Last updated: 2024-12-12
Reason for creation: MarketplacePlugin detection failure due to JSDoc comment
