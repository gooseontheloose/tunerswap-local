# TunerSwap Changelog

All notable changes to this project will be documented in this file.

---

## [1.5.0] - 2024-12-16

### Product Listing System Overhaul
- **ListingCreationModal Component** (`website/app/components/seller-admin/ListingCreationModal.tsx`)
  - Shows loading state with progress steps during product creation
  - Displays success with product URL and "View Listing" button
  - Shows error with debug info and retry option
  - Animated status icons and gradient styling per product type
  - All errors logged to admin panel for debugging

- **Product Page Redesign** (`website/app/routes/products.$slug.tsx`)
  - Dark theme matching site design
  - Product type badges (Digital Tune, Physical Part, Service)
  - Tune specifications panel showing platform, software, HP/torque gains
  - Seller card with link to profile
  - Trust badges (Secure Payment, Instant/Fast Delivery, Quality Guaranteed)
  - Variant selector dropdown for multi-variant products
  - Responsive image gallery with thumbnails

- **ListTuneTab Improvements** (`website/app/components/seller-admin/ListTuneTab.tsx`)
  - Predefined dropdown options for vehicle platforms (GM, Ford, Dodge, etc.)
  - Predefined tuning software options (HP Tuners, EFI Live, SCT, etc.)
  - Tune type selector (Performance, Economy, E85, Delete, etc.)
  - Info banner explaining digital delivery
  - Better form organization with section headers
  - Real-time modal feedback during submission

- **ListPartsTab Improvements** (`website/app/components/seller-admin/ListPartsTab.tsx`)
  - Part categories dropdown (Air Intake, Exhaust, Forced Induction, etc.)
  - Condition selector (New, Used-Excellent, Used-Good, Refurbished)
  - SKU/Part number field
  - Weight and dimensions fields for shipping
  - Shipping options (Free Shipping, Track Inventory, Local Pickup)
  - Stock quantity with validation

- **ListServiceTab Improvements** (`website/app/components/seller-admin/ListServiceTab.tsx`)
  - Service categories dropdown (Dyno Tuning, Remote Tuning, Install, etc.)
  - Duration selector with preset options (30min to Full Day)
  - What's Included textarea for listing benefits
  - Booking options (Requires Appointment, Available Weekends, Mobile Service, Deposit Required)
  - Additional notes/policies field

### Route Action Improvements
- All listing routes return success data for modal display (productId, slug)
- Comprehensive validation with user-friendly error messages
- Activity logging on successful creation
- Error logging with debug details sent to admin panel
- Better description formatting with markdown support

### GraphQL Product Query Updates
- Product query now includes customFields (productType, sellerId, platform, software, hpGain, torqueGain, requiredMods)

---

## [1.4.0] - 2024-12-16

### Business Hours System
- **New BusinessHoursEditor Component** (`website/app/components/seller-admin/BusinessHoursEditor.tsx`)
  - Day-by-day open/closed toggles for Monday-Sunday
  - Time selection in 30-minute increments (12:00 AM - 11:30 PM)
  - "Copy Monday to weekdays" quick action button
  - 12-hour display format (e.g., "9:00 AM - 5:00 PM")
  - Backwards-compatible with legacy string format hours via `parseLegacyHours()`
  - `formatHoursForDisplay()` utility for public profile display

- **Public Profile Integration**
  - Shop hours properly display on seller profile pages (`/sellers/:slug`)
  - Dynamic formatting based on open/closed status
  - Closed days shown in muted gray text

### Seller Profile Enhancements
- **All Profile Fields Now Save Properly**
  - Tune types, experience, hasDyno, business hours, all social links
  - YouTube social link field added throughout stack

- **New Profile Fields**
  - Experience dropdown: 1-3 years, 3-5 years, 5-10 years, 10+ years
  - Dyno availability dropdown: In-house, Mobile, No
  - YouTube field in social links section

- **Backend Updates**
  - Added `youtube` column to SellerProfile entity
  - Updated GraphQL schema with `youtube` field in all relevant types
  - Updated `seller-profile.service.ts` to persist YouTube field

### Visitor Analytics Fixes
- **Fixed GraphQL Schema Mismatches**
  - `DashboardStats`: Now returns `totalEvents`, `todayEvents`, `pageViews`, `uniqueSessions`, `uniqueIPs`, `uniqueCustomers`, `authenticatedEvents`, `anonymousEvents`, `percentChange`
  - `DeviceBreakdown`: Returns proper `devices` array with `deviceType`, `count`, `percentage`
  - `CountryVisitorData`: Added `uniqueSessions` field
  - `TimeSeriesPoint`: Added `label`, `pageViews`, `uniqueSessions` fields

- **Service Method Updates** (`visitor-analytics.service.ts`)
  - `getDashboardStats()` - Returns complete dashboard statistics
  - `getDeviceBreakdown()` - Returns structured device/browser/OS data
  - `getVisitorsByCountry()` - Returns country data with session counts
  - `getTrafficOverTime()` - Returns time series with all required fields

---

## [1.3.0] - 2024-12-15

### Admin Viewer System Enhancements
- **Dev Mode Panel Visibility** - Only visible to admin viewers, not regular users
- **Panel Switching** - Admin viewers can freely switch between buyer and seller panels
- **Buyer Dashboard** - "View Seller Panel" button for admin viewers (amber-colored)
- **Seller Dashboard** - "View Buyer Panel" button for admin viewers
- **Amber UI Indicators** - Clear visual distinction for admin viewer mode

### Seller Profile Revamp
- **Clickable Toggle Buttons** - Replaced text inputs with visual toggles
- **Tuning Software** - Purple buttons (HP Tuners, EFI Live, SCT, MPVI2, Diablo, Cobb, Other)
- **Vehicle Platforms** - Orange buttons (GM, Ford, Dodge/Ram, Toyota, Honda, Nissan, BMW, Mercedes, Other)
- **Tune Types** - Green buttons (Performance, Economy, Tow/Haul, E85/Flex Fuel, Delete/DPF, Custom Dyno)
- **Updated SellerData Type** - Added `tuneTypes`, `experience`, `hasDyno` fields

### Order Management
- **Real API Data** - All 5 order tabs now use real data from API
  - Open Orders, Past Orders, Tune Orders, Parts Orders, Service Orders
- **Empty States** - Helpful empty states with links to list products

### Admin Features
- **De-verify Button** - Remove verified badge from sellers in Tuner Management
- **Debug Logging** - `debugLog` utility sends errors to System Status dashboard
- **System Alerts** - "View Details" links now go to service-specific reports

### Email Verification
- **SMTP Working** - Email verification via DreamHost confirmed functional
- **Test Email Sent** - Verified delivery to configured email addresses

---

## [1.2.0] - 2024-12-12

### System Status & Monitoring (Admin Dashboard)
- **Dedicated System Status Page** (`/admin/system-status`)
  - Real-time health checks for: Vendure API, Shop API, Frontend, Database, Worker, Asset Server
  - Color-coded status indicators: green (online), yellow (slow >2000ms), red (problem), black (offline)
  - Response time tracking per service
  - Category labels (critical, core, support) for prioritization

- **Historical Response Time Graph**
  - SVG line graph displaying response times over the last hour
  - Click any service card to view that service's individual graph data
  - Default "Average Connection" view shows all services averaged
  - Continuous data logging in background (not just when viewing page)
  - Data persisted to localStorage, survives page refresh

- **Troubleshooting Guides**
  - Each service has expandable troubleshooting section
  - Lists common symptoms and step-by-step solutions
  - Includes debug commands (curl tests, log viewing, etc.)

### Error Logging System
- **Persistent Error Logs Panel**
  - Automatic logging when services go offline, slow, or return errors
  - Three severity levels: error (critical), warning, info
  - Logs persist in localStorage until manually cleared by admin
  - Filter by service or severity type

- **Detailed Error Report Modals**
  - Click "Report" to see full error analysis
  - Service info: port number, endpoint path, dependencies
  - Affected areas: what breaks when this service fails
  - Debug commands tailored to specific service

- **Duplicate Error Detection**
  - Repeated errors increment a counter instead of creating new entries
  - Shows "x4", "x10", etc. badge for occurrence count
  - Tracks first and last occurrence timestamps
  - Prevents log flooding from recurring issues (e.g., API down = 1 entry with count, not 100 entries)

### Settings Hub Improvements
- **Alert Notification Bar** - Critical issues from System Status shown at top
- **Removed Redundant Cards** - Navigation cards removed since sidebar provides same links
- **Cleaner Layout** - More focused, less repetitive UI

### Admin Viewer System
- **New `isAdminViewer` Custom Field** - Added to Customer entity in MarketplacePlugin
- **Admin Viewer Dashboard Access** - Users with isAdminViewer=true can view any seller's dashboard
- **Seller Selector Dropdown** - Dropdown to switch between sellers when in admin viewer mode
- **Access Control** - Non-sellers without admin viewer status redirected to become-a-seller

### Seller Dashboard Access Control
- Requires authentication (redirects to /tuner-sign-in if not logged in)
- Requires seller profile OR admin viewer status
- Non-sellers redirected to /become-a-seller page

---

## [1.1.0] - 2024-12-11

### Vehicle Platforms Management
- **Dedicated Management Page** (`/admin/vehicle-platforms`)
- Add, edit, delete vehicle makes and models
- Featured platforms toggle for homepage display
- Search and filter platforms

### Marketplace Configuration
- **Features Page** - Toggle buyer/seller/platform features on/off
- **Commission Settings** - Configurable platform fee percentages by category
- **Verification Settings** - Document requirements for seller verification

---

## [1.0.0] - 2024-12-11

### Major Release - Vendure 2 Integration
- Full Vendure 2 backend integration with MarketplacePlugin
- Vendor isolation: each seller gets dedicated channel for product/order separation
- Seller registration returns admin credentials (URL, email, channel token)
- New onboarding flow with credentials display and "Next Steps" guide
- Copy credentials button for easy saving

---

## [0.9.0] - 2024-12-11

### Vendor Segmentation & Seller Onboarding
- **Fixed vendor isolation** - Sellers now receive their admin credentials (dashboard URL, login email, channel token) upon registration
- **Updated seller registration flow** - Registration confirmation page now prominently displays admin login credentials with copy functionality
- **Added "Next Steps" guide** - New sellers see clear instructions for accessing their seller dashboard
- **GraphQL API updates** - `RegisterSellerResult` now returns `adminUrl`, `adminEmail`, and `channelToken` fields

### Admin Dashboard Enhancements
- **New "Orders" section** - Added prominent Orders nav section with Open Orders page
- **Open Orders page** - Shows all pending/in-progress orders across all product types (tunes, parts, services)
- **Order type badges** - Visual indicators showing whether orders contain tunes, parts, or services

---

## [0.8.0] - 2024-12-11

### Shopping Cart & Checkout Redesign
- **Cart tray restyled** - Dark theme with gradient accents, improved item display
- **Cart contents component** - Updated with dark zinc styling, quantity controls, remove buttons
- **Cart totals** - Gradient text for total price, dark theme throughout
- **Checkout flow redesign** - Complete overhaul of checkout pages:
  - Progress steps with gradient indicators
  - Shipping form with dark inputs and icon headers
  - Payment page with card-based payment method display
  - Confirmation page with success animation and next steps

---

## [0.7.0] - 2024-12-11

### Header UI Improvements
- **Search bar restyled** - Dark theme with search icon, rounded styling
- **Header buttons updated** - Sign in button with gradient, dark mode toggle, cart icon with dark theme
- **Maintained nav hover effects** - Preserved existing navigation dropdown functionality

---

## [0.6.0] - 2024-12-11

### Collection Pages Overhaul
- **Tunes collection** (`/collections/tunes`) - New card-based grid layout with seller info, pricing, ratings
- **Parts collection** (`/collections/parts`) - Physical product cards with stock indicators
- **Services collection** (`/collections/services`) - Service listings with location and booking info
- **Removed duplicate routes** - Deleted old `/tunes`, `/parts`, `/services` pages
- **Updated navigation** - All nav links now point to `/collections/*` routes

---

## [0.5.0] - 2024-12-11

### Error Handling & Stability
- **Product page error handling** - Added try-catch in loader with proper error responses
- **ErrorBoundary components** - Added to product pages for graceful error display
- **404 handling** - Improved "product not found" experience with navigation options

---

## [0.4.0] - 2024-12-11

### MarketplacePlugin Admin UI
- **Complete seller dashboard** - Custom admin UI extension with:
  - Tunes section (Listed Tunes, Tune Orders)
  - Parts section (Listed Parts, Part Orders)
  - Services section (Listed Services, Bookings)
  - Communication section (Messages mockup)
  - My Shop section (Analytics, Settings, Help Center)
- **Marketplace admin section** - Tuner management and marketplace settings for superadmins
- **Product filtering** - Products filtered by `productType` custom field
- **Order filtering** - Orders filtered and displayed by product type

---

## [0.3.0] - 2024-12-10

### MarketplacePlugin Backend Architecture
- **Channel-based vendor isolation** - Each seller gets dedicated Vendure Channel
- **Seller registration system** - Creates:
  - Vendure Seller entity
  - Dedicated Channel with unique token
  - Role with seller-specific permissions
  - Administrator account for dashboard access
  - StockLocation for inventory
  - SellerProfile with tuning-specific fields
- **Seller permissions** - Defined `SELLER_PERMISSIONS` array for product, order, asset management
- **Custom fields** - Added to Customer (isSeller, sellerProfileId, vehicles, etc.) and Product (productType, isDigital)
- **Global collections** - Auto-creates Tunes, Parts, Services collections on bootstrap

---

## [0.2.0] - 2024-12-10

### SellerProfile Entity & API
- **SellerProfile entity** - Complete seller profile with:
  - Business info (name, website, social media)
  - Tuning expertise (experience, software, vehicle platforms, tune types)
  - Stats (rating, reviewCount, tunesSold, totalOrders, totalRevenue)
  - Status workflow (pending, approved, suspended, rejected)
  - Verification flag
- **Shop API** - `registerSeller`, `activeSellerProfile`, `sellerBySlug`, `sellers` queries/mutations
- **Admin API** - `sellerProfiles`, `approveSeller`, `rejectSeller`, `suspendSeller`, `verifySeller`

---

## [0.1.0] - 2024-12-10

### Initial Vendure 2 Setup
- **Vendure 2 backend** - Fresh installation with SQLite database
- **Basic configuration** - Admin UI, Shop API, Asset handling
- **Stripe integration** - Payment processing setup
- **Braintree integration** - Alternative payment method
- **Project structure** - Monorepo with `v2/` (backend) and `website/` (Remix frontend)

---

## Technical Notes

### Database
- SQLite with better-sqlite3 driver
- Located at `v2/vendure.sqlite`
- Note: Kill Node processes before restarting if "database locked" error occurs

### Architecture
- **Backend**: Vendure 2 with custom MarketplacePlugin
- **Frontend**: Remix with React, Tailwind CSS
- **Admin UI**: Vendure Dashboard with custom extensions

### Key Files
- `v2/src/plugins/marketplace/` - MarketplacePlugin source
- `v2/src/plugins/marketplace/ui/routes.tsx` - Admin dashboard extensions
- `website/app/routes/` - Remix page routes
- `website/app/providers/` - GraphQL API providers
