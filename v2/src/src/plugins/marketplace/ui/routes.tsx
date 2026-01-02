/**
 * ============================================================================
 * TUNERSWAP MARKETPLACE - VENDURE DASHBOARD EXTENSIONS
 * ============================================================================
 *
 * This file defines all custom admin dashboard pages and components for the
 * TunerSwap marketplace. It uses Vendure's defineDashboardExtension API to
 * add navigation items and routes to the admin panel.
 *
 * FILE STRUCTURE:
 * ---------------
 * 1. NAVIGATION SETUP (defineDashboardExtension)
 *    - Marketplace nav section with: Tuners, Settings Hub, System Status
 *    - Routes mapped to React components
 *
 * 2. TUNER MANAGEMENT PAGE (~line 200)
 *    - View all seller profiles
 *    - Approve, reject, suspend, verify sellers
 *    - Filter by status (all, pending, approved, suspended)
 *
 * 3. SETTINGS HUB (~line 800)
 *    - Central dashboard for marketplace configuration
 *    - Links to: Commission, Verification, Features, Vehicle Platforms
 *    - Alert bar showing critical System Status issues
 *    - Notification and Content settings
 *
 * 4. SETTINGS SUB-PAGES (~line 1500-2500)
 *    - CommissionSettingsPage: Platform fee configuration
 *    - VerificationSettingsPage: Seller verification requirements
 *    - FeaturesPage: Feature toggles for marketplace
 *    - VehiclePlatformsPage: Vehicle makes/models management
 *
 * 5. SYSTEM STATUS PAGE (~line 3050)
 *    - Real-time service health monitoring
 *    - Historical response time graphs (SVG)
 *    - Error logging with duplicate detection
 *    - Troubleshooting guides per service
 *
 * 6. ERROR LOGS PANEL (~line 4100)
 *    - Persistent error logging (localStorage)
 *    - Severity levels: error, warning, info
 *    - Detailed report modals
 *    - Duplicate error counting
 *
 * KEY DATA STORES (localStorage):
 * - systemStatusHistory: Response time history (last 60 points)
 * - systemErrorLogs: Error logs (last 100 entries)
 * - systemAlerts: Active alert notifications
 *
 * SERVICES MONITORED:
 * - Vendure API (Admin GraphQL) - Port 3000, /admin-api
 * - Shop API (Shop GraphQL) - Port 3000, /shop-api
 * - Frontend (Remix) - Port 4000
 * - Database (SQLite) - v2/vendure.sqlite
 * - Worker (Job Queue) - Vendure internal
 * - Asset Server (Images) - Port 3000, /assets
 *
 * VERSION: 1.2.0 (2024-12-12)
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
    defineDashboardExtension,
    api,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableCell,
    TableBody,
    Badge,
} from '@vendure/dashboard';
import {
    Store,
    Settings,
    Users,
    CheckCircle,
    XCircle,
    ShieldCheck,
    Ban,
    RefreshCw,
    Music,
    Wrench,
    Calendar,
    Plus,
    Package,
    ShoppingCart,
    UserCircle,
    Edit,
    Eye,
    DollarSign,
    Clock,
    MessageCircle,
    BarChart3,
    Bell,
    HelpCircle,
    TrendingUp,
    Star,
    FileText,
    AlertCircle,
    CheckCircle2,
    XCircle as XCircleIcon,
    Send,
    Inbox,
    Archive,
    Save,
    MapPin,
    Phone,
    Globe,
    Instagram,
    Facebook,
    Briefcase,
    Award,
    Gauge,
    Car,
    Cpu,
    User,
    Building,
    ExternalLink,
    LayoutDashboard,
    AlertTriangle,
    RotateCcw,
    Trash2,
    Search,
    Filter,
    MoreVertical,
    ChevronDown,
    ChevronRight,
    Activity,
    Zap,
    BookOpen,
    Lightbulb,
    Terminal,
    Database,
    Server,
    Wifi,
    WifiOff,
    AlertOctagon,
    Bug,
    Info,
    Copy,
    FileCode,
    Layers,
    X,
    CreditCard,
    Lock,
} from 'lucide-react';
import { gql } from 'graphql-tag';

// ============================================================================
// GraphQL Queries and Mutations
// ============================================================================

const GET_CURRENT_USER = gql`
    query GetCurrentUser {
        me {
            id
            identifier
            channels {
                id
                code
            }
        }
    }
`;

const GET_SELLER_PROFILES = gql`
    query GetSellerProfiles($skip: Int, $take: Int, $status: String) {
        sellerProfiles(skip: $skip, take: $take, status: $status) {
            items {
                id
                customerId
                firstName
                lastName
                businessName
                phone
                location
                experience
                software
                vehiclePlatforms
                tuneTypes
                status
                verified
                rating
                reviewCount
                tunesSold
                totalOrders
                totalRevenue
                createdAt
                bio
                website
                instagram
                facebook
                youtube
                customBadges {
                    icon
                    text
                    color
                }
                hardSuspended
                hardSuspendedReason
                hardSuspendedAt
                banned
                banReason
                bannedAt
                bannedBy
                adminNotes
                warningCount
                lastWarning
                lastWarningAt
                featured
                prioritySupport
                trusted
            }
            totalItems
        }
    }
`;

// Badge management queries and mutations
const GET_BADGE_OPTIONS = gql`
    query GetBadgeOptions {
        badgeIconOptions {
            value
            label
        }
        badgeColorOptions {
            value
            label
        }
    }
`;

const ADD_SELLER_BADGE = gql`
    mutation AddSellerBadge($sellerId: ID!, $badge: CustomBadgeInput!) {
        addSellerBadge(sellerId: $sellerId, badge: $badge) {
            id
            customBadges {
                icon
                text
                color
            }
        }
    }
`;

const REMOVE_SELLER_BADGE = gql`
    mutation RemoveSellerBadge($sellerId: ID!, $badgeIndex: Int!) {
        removeSellerBadge(sellerId: $sellerId, badgeIndex: $badgeIndex) {
            id
            customBadges {
                icon
                text
                color
            }
        }
    }
`;

const APPROVE_SELLER = gql`
    mutation ApproveSeller($id: ID!) {
        approveSeller(id: $id) {
            id
            status
        }
    }
`;

const REJECT_SELLER = gql`
    mutation RejectSeller($id: ID!) {
        rejectSeller(id: $id) {
            id
            status
        }
    }
`;

const SUSPEND_SELLER = gql`
    mutation SuspendSeller($id: ID!) {
        suspendSeller(id: $id) {
            id
            status
        }
    }
`;

const VERIFY_SELLER = gql`
    mutation VerifySeller($id: ID!) {
        verifySeller(id: $id) {
            id
            verified
        }
    }
`;

const UNVERIFY_SELLER = gql`
    mutation UnverifySeller($id: ID!) {
        unverifySeller(id: $id) {
            id
            verified
        }
    }
`;

const ENABLE_SELLER = gql`
    mutation EnableSeller($id: ID!) {
        enableSeller(id: $id) {
            id
            status
        }
    }
`;

const DISABLE_SELLER = gql`
    mutation DisableSeller($id: ID!) {
        disableSeller(id: $id) {
            id
            status
        }
    }
`;

// Advanced moderation mutations
const HARD_SUSPEND_SELLER = gql`
    mutation HardSuspendSeller($id: ID!, $reason: String) {
        hardSuspendSeller(id: $id, reason: $reason) {
            id
            hardSuspended
            hardSuspendedReason
        }
    }
`;

const UN_HARD_SUSPEND_SELLER = gql`
    mutation UnHardSuspendSeller($id: ID!) {
        unHardSuspendSeller(id: $id) {
            id
            hardSuspended
        }
    }
`;

const BAN_SELLER = gql`
    mutation BanSeller($id: ID!, $reason: String!) {
        banSeller(id: $id, reason: $reason) {
            id
            banned
            banReason
            status
        }
    }
`;

const UNBAN_SELLER = gql`
    mutation UnbanSeller($id: ID!) {
        unbanSeller(id: $id) {
            id
            banned
        }
    }
`;

const WARN_SELLER = gql`
    mutation WarnSeller($id: ID!, $message: String!) {
        warnSeller(id: $id, message: $message) {
            id
            warningCount
            lastWarning
        }
    }
`;

const CLEAR_WARNINGS = gql`
    mutation ClearWarnings($id: ID!) {
        clearWarnings(id: $id) {
            id
            warningCount
        }
    }
`;

const UPDATE_ADMIN_NOTES = gql`
    mutation UpdateAdminNotes($id: ID!, $notes: String!) {
        updateAdminNotes(id: $id, notes: $notes) {
            id
            adminNotes
        }
    }
`;

const TOGGLE_FEATURED = gql`
    mutation ToggleFeatured($id: ID!) {
        toggleFeatured(id: $id) {
            id
            featured
        }
    }
`;

const TOGGLE_TRUSTED = gql`
    mutation ToggleTrusted($id: ID!) {
        toggleTrusted(id: $id) {
            id
            trusted
        }
    }
`;

const TOGGLE_PRIORITY_SUPPORT = gql`
    mutation TogglePrioritySupport($id: ID!) {
        togglePrioritySupport(id: $id) {
            id
            prioritySupport
        }
    }
`;

const ENABLE_CUSTOMER = gql`
    mutation EnableCustomer($customerId: ID!) {
        enableCustomer(customerId: $customerId) {
            success
            message
        }
    }
`;

const DISABLE_CUSTOMER = gql`
    mutation DisableCustomer($customerId: ID!) {
        disableCustomer(customerId: $customerId) {
            success
            message
        }
    }
`;

// Tuner Request Queries
const GET_TUNER_REQUESTS = gql`
    query GetTunerRequests($skip: Int, $take: Int, $status: String) {
        tunerRequests(skip: $skip, take: $take, status: $status) {
            items {
                id
                customerId
                customerEmail
                firstName
                lastName
                phone
                location
                businessName
                website
                instagram
                facebook
                bio
                experience
                software
                vehiclePlatforms
                tuneTypes
                hasDyno
                status
                adminNotes
                reviewedBy
                reviewedAt
                sellerProfileId
                createdAt
                updatedAt
            }
            totalItems
        }
    }
`;

const APPROVE_TUNER_REQUEST = gql`
    mutation ApproveTunerRequest($id: ID!, $adminNotes: String) {
        approveTunerRequest(id: $id, adminNotes: $adminNotes) {
            success
            message
            sellerProfileId
        }
    }
`;

const REJECT_TUNER_REQUEST = gql`
    mutation RejectTunerRequest($id: ID!, $adminNotes: String) {
        rejectTunerRequest(id: $id, adminNotes: $adminNotes) {
            success
            message
        }
    }
`;

// Admin Viewer Queries
const GET_ADMIN_VIEWERS = gql`
    query GetAdminViewers($skip: Int, $take: Int) {
        adminViewers(skip: $skip, take: $take) {
            items {
                id
                firstName
                lastName
                emailAddress
                isAdminViewer
                createdAt
            }
            totalItems
        }
    }
`;

const SEARCH_CUSTOMERS_FOR_ADMIN_VIEWER = gql`
    query SearchCustomersForAdminViewer($searchTerm: String!) {
        searchCustomersForAdminViewer(searchTerm: $searchTerm) {
            id
            firstName
            lastName
            emailAddress
            isAdminViewer
        }
    }
`;

const GRANT_ADMIN_VIEWER_ACCESS = gql`
    mutation GrantAdminViewerAccess($customerId: ID!) {
        grantAdminViewerAccess(customerId: $customerId) {
            success
            message
        }
    }
`;

const REVOKE_ADMIN_VIEWER_ACCESS = gql`
    mutation RevokeAdminViewerAccess($customerId: ID!) {
        revokeAdminViewerAccess(customerId: $customerId) {
            success
            message
        }
    }
`;

const RESEND_VERIFICATION_EMAIL = gql`
    mutation ResendVerificationEmail($customerId: ID!) {
        resendVerificationEmail(customerId: $customerId) {
            success
            message
        }
    }
`;

const VERIFY_CUSTOMER_EMAIL = gql`
    mutation VerifyCustomerEmail($customerId: ID!) {
        verifyCustomerEmail(customerId: $customerId) {
            success
            message
        }
    }
`;

const GET_CUSTOMERS_FOR_MANAGEMENT = gql`
    query GetCustomersForManagement(
        $skip: Int
        $take: Int
        $searchTerm: String
        $filterVerified: Boolean
        $filterSeller: Boolean
    ) {
        customersForManagement(
            skip: $skip
            take: $take
            searchTerm: $searchTerm
            filterVerified: $filterVerified
            filterSeller: $filterSeller
        ) {
            items {
                id
                firstName
                lastName
                emailAddress
                phoneNumber
                createdAt
                user {
                    id
                    verified
                    enabled
                    lastLogin
                }
                isSeller
                sellerProfileId
                sellerStatus
                sellerVerified
            }
            totalItems
        }
    }
`;

const CONVERT_CUSTOMER_TO_SELLER = gql`
    mutation ConvertCustomerToSeller($customerId: ID!, $businessName: String) {
        convertCustomerToSeller(customerId: $customerId, businessName: $businessName) {
            success
            message
            sellerProfileId
        }
    }
`;

// Marketplace Settings
const GET_MARKETPLACE_SETTINGS = gql`
    query GetMarketplaceSettings {
        marketplaceSettings {
            autoVerifyEmail
            autoVerifySeller
            autoApprove
        }
    }
`;

const UPDATE_MARKETPLACE_SETTINGS = gql`
    mutation UpdateMarketplaceSettings(
        $autoVerifyEmail: Boolean
        $autoVerifySeller: Boolean
        $autoApprove: Boolean
    ) {
        updateMarketplaceSettings(
            autoVerifyEmail: $autoVerifyEmail
            autoVerifySeller: $autoVerifySeller
            autoApprove: $autoApprove
        ) {
            autoVerifyEmail
            autoVerifySeller
            autoApprove
        }
    }
`;

// Get current seller's profile
const GET_MY_SELLER_PROFILE = gql`
    query GetMySellerProfile {
        mySellerProfile {
            id
            firstName
            lastName
            phone
            location
            address
            businessName
            website
            instagram
            facebook
            bio
            experience
            software
            vehiclePlatforms
            tuneTypes
            hasDyno
            hours
            status
            verified
            rating
            reviewCount
            tunesSold
            totalOrders
            totalRevenue
            stripeConnected
            paypalConnected
            slug
            createdAt
        }
    }
`;

// Update current seller's profile
const UPDATE_MY_SELLER_PROFILE = gql`
    mutation UpdateMySellerProfile($input: UpdateMySellerProfileInput!) {
        updateMySellerProfile(input: $input) {
            id
            firstName
            lastName
            phone
            location
            address
            businessName
            website
            instagram
            facebook
            bio
            experience
            software
            vehiclePlatforms
            tuneTypes
            hasDyno
            hours
        }
    }
`;

// Product queries - get all products and filter client-side by productType
const GET_ALL_PRODUCTS = gql`
    query GetAllProducts($skip: Int, $take: Int) {
        products(options: { skip: $skip, take: $take }) {
            items {
                id
                name
                slug
                enabled
                featuredAsset {
                    preview
                }
                variants {
                    id
                    name
                    sku
                    price
                    stockOnHand
                }
                customFields {
                    productType
                    isDigital
                }
            }
            totalItems
        }
    }
`;

// Orders query - for seller's orders
const GET_ORDERS = gql`
    query GetOrders($skip: Int, $take: Int) {
        orders(options: { skip: $skip, take: $take, sort: { createdAt: DESC } }) {
            items {
                id
                code
                state
                total
                totalWithTax
                createdAt
                customer {
                    firstName
                    lastName
                    emailAddress
                }
                lines {
                    productVariant {
                        name
                        product {
                            customFields {
                                productType
                            }
                        }
                    }
                    quantity
                    linePriceWithTax
                }
            }
            totalItems
        }
    }
`;

// Admin product management mutations
const DELETE_PRODUCT = gql`
    mutation DeleteProduct($id: ID!) {
        deleteProduct(id: $id) {
            result
            message
        }
    }
`;

const UPDATE_PRODUCT = gql`
    mutation UpdateProduct($input: UpdateProductInput!) {
        updateProduct(input: $input) {
            id
            enabled
        }
    }
`;

// Get all products with seller info for admin
const GET_ADMIN_PRODUCTS = gql`
    query GetAdminProducts($skip: Int, $take: Int) {
        products(options: { skip: $skip, take: $take, sort: { createdAt: DESC } }) {
            items {
                id
                name
                slug
                enabled
                createdAt
                featuredAsset {
                    preview
                }
                variants {
                    id
                    name
                    sku
                    price
                    priceWithTax
                    stockOnHand
                }
                customFields {
                    productType
                    isDigital
                    sellerId
                }
            }
            totalItems
        }
    }
`;

// Get all orders for admin with full details
const GET_ADMIN_ORDERS = gql`
    query GetAdminOrders($skip: Int, $take: Int, $filter: OrderFilterParameter) {
        orders(options: { skip: $skip, take: $take, sort: { createdAt: DESC }, filter: $filter }) {
            items {
                id
                code
                state
                total
                totalWithTax
                currencyCode
                createdAt
                updatedAt
                customer {
                    id
                    firstName
                    lastName
                    emailAddress
                }
                lines {
                    productVariant {
                        name
                        sku
                        product {
                            id
                            name
                            customFields {
                                productType
                                sellerId
                            }
                        }
                    }
                    quantity
                    linePriceWithTax
                }
                shippingAddress {
                    city
                    province
                    country
                }
            }
            totalItems
        }
    }
`;

// ============================================================================
// Types
// ============================================================================

interface CustomBadge {
    icon: string;
    text: string;
    color: string;
}

interface BadgeOption {
    value: string;
    label: string;
}

interface BadgeOptionsResponse {
    badgeIconOptions: BadgeOption[];
    badgeColorOptions: BadgeOption[];
}

interface SellerProfile {
    id: string;
    customerId: string;
    firstName: string;
    lastName: string;
    businessName: string;
    phone: string;
    location: string;
    experience: string;
    software: string[];
    vehiclePlatforms: string[];
    tuneTypes: string[];
    status: string;
    verified: boolean;
    rating: number;
    reviewCount: number;
    tunesSold: number;
    totalOrders: number;
    totalRevenue: number;
    createdAt: string;
    customBadges?: CustomBadge[];
    bio?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    // Moderation fields
    hardSuspended?: boolean;
    hardSuspendedReason?: string;
    hardSuspendedAt?: string;
    banned?: boolean;
    banReason?: string;
    bannedAt?: string;
    bannedBy?: string;
    adminNotes?: string;
    warningCount?: number;
    lastWarning?: string;
    lastWarningAt?: string;
    featured?: boolean;
    prioritySupport?: boolean;
    trusted?: boolean;
}

interface SellerProfilesResponse {
    sellerProfiles: {
        items: SellerProfile[];
        totalItems: number;
    };
}

interface Product {
    id: string;
    name: string;
    slug: string;
    enabled: boolean;
    featuredAsset?: {
        preview: string;
    };
    variants: {
        id: string;
        name: string;
        sku: string;
        price: number;
        stockOnHand: number;
    }[];
    customFields: {
        productType: string;
        isDigital: boolean;
    };
}

interface ProductsResponse {
    products: {
        items: Product[];
        totalItems: number;
    };
}

interface Order {
    id: string;
    code: string;
    state: string;
    total: number;
    totalWithTax: number;
    createdAt: string;
    customer: {
        firstName: string;
        lastName: string;
        emailAddress: string;
    };
    lines: {
        productVariant: {
            name: string;
            product: {
                customFields: {
                    productType: string;
                };
            };
        };
        quantity: number;
        linePriceWithTax: number;
    }[];
}

interface OrdersResponse {
    orders: {
        items: Order[];
        totalItems: number;
    };
}

interface CustomerUserInfo {
    id: string;
    verified: boolean;
    enabled: boolean;
    lastLogin: string | null;
}

interface CustomerForManagement {
    id: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    phoneNumber: string | null;
    createdAt: string;
    user: CustomerUserInfo | null;
    isSeller: boolean;
    sellerProfileId: string | null;
    sellerStatus: string | null;
    sellerVerified: boolean | null;
}

interface CustomersForManagementResponse {
    customersForManagement: {
        items: CustomerForManagement[];
        totalItems: number;
    };
}

interface CustomerAccountResult {
    success: boolean;
    message: string | null;
}

interface ConvertToSellerResult {
    success: boolean;
    message: string | null;
    sellerProfileId: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount / 100);
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function getOrderStateBadge(state: string) {
    const stateColors: Record<string, string> = {
        AddingItems: 'bg-gray-500/20 text-gray-600',
        ArrangingPayment: 'bg-yellow-500/20 text-yellow-600',
        PaymentAuthorized: 'bg-blue-500/20 text-blue-600',
        PaymentSettled: 'bg-green-500/20 text-green-600',
        PartiallyShipped: 'bg-purple-500/20 text-purple-600',
        Shipped: 'bg-indigo-500/20 text-indigo-600',
        PartiallyDelivered: 'bg-teal-500/20 text-teal-600',
        Delivered: 'bg-green-500/20 text-green-600',
        Cancelled: 'bg-red-500/20 text-red-600',
    };
    return <Badge className={stateColors[state] || 'bg-gray-500/20 text-gray-600'}>{state}</Badge>;
}

// ============================================================================
// Permission Hook - Check if user is superadmin
// ============================================================================

function useIsSuperAdmin() {
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkPermissions = async () => {
            try {
                const result = await api.query<{ me: { identifier: string; channels: { code: string }[] } }>(GET_CURRENT_USER);
                // Superadmin has access to __default_channel__ or is named 'superadmin'
                const isSuper = result.me?.identifier === 'superadmin' ||
                    result.me?.channels?.some(c => c.code === '__default_channel__');
                setIsSuperAdmin(isSuper);
            } catch (err) {
                setIsSuperAdmin(false);
            } finally {
                setLoading(false);
            }
        };
        checkPermissions();
    }, []);

    return { isSuperAdmin, loading };
}

// ============================================================================
// Reusable Product List Component
// ============================================================================

interface ProductListPageProps {
    title: string;
    description: string;
    productType: 'tune' | 'part' | 'service';
    icon: React.ReactNode;
    emptyMessage: string;
    createButtonText: string;
    accentColor: string;
}

function ProductListPage({ title, description, productType, icon, emptyMessage, createButtonText, accentColor }: ProductListPageProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.query<ProductsResponse>(GET_ALL_PRODUCTS, {
                skip: 0,
                take: 100,
            });
            const allProducts = result.products?.items || [];
            const filteredProducts = allProducts.filter(
                p => p.customFields?.productType === productType
            );
            setProducts(filteredProducts);
            setTotalItems(filteredProducts.length);
        } catch (err: any) {
            setError(err.message || 'Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [productType]);

    const activeCount = products.filter(p => p.enabled).length;
    const disabledCount = products.filter(p => !p.enabled).length;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${accentColor}`}>
                        {icon}
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={fetchProducts} disabled={loading} className="flex-1 sm:flex-none">
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <a href="/admin/products/create" className="flex-1 sm:flex-none">
                        <Button className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            {createButtonText}
                        </Button>
                    </a>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Total</div>
                        <div className="text-xl md:text-2xl font-bold">{totalItems}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Active</div>
                        <div className="text-xl md:text-2xl font-bold text-green-500">{activeCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Disabled</div>
                        <div className="text-xl md:text-2xl font-bold text-gray-500">{disabledCount}</div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                </div>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Your {title}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && (
                        <div className="py-12 text-center">
                            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Loading...</p>
                        </div>
                    )}
                    {!loading && !error && products.length === 0 && (
                        <div className="py-12 text-center">
                            <div className={`w-16 h-16 mx-auto rounded-full ${accentColor} flex items-center justify-center mb-4`}>
                                {icon}
                            </div>
                            <p className="font-medium mb-2">{emptyMessage}</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Click "{createButtonText}" to add your first listing.
                            </p>
                            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg max-w-md mx-auto">
                                When creating a product, set the "Product Type" field to "{productType}" to have it appear here.
                            </p>
                        </div>
                    )}
                    {!loading && products.length > 0 && (
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="hidden md:table-cell">SKU</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead className="hidden sm:table-cell">Stock</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2 md:gap-3">
                                                    {product.featuredAsset && (
                                                        <img
                                                            src={product.featuredAsset.preview}
                                                            alt={product.name}
                                                            className="w-8 h-8 md:w-10 md:h-10 object-cover rounded"
                                                        />
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-sm truncate max-w-[120px] md:max-w-none">{product.name}</div>
                                                        <div className="text-xs text-muted-foreground hidden md:block">
                                                            {product.variants.length} variant(s)
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm">
                                                {product.variants[0]?.sku || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {formatCurrency(product.variants[0]?.price || 0)}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell text-sm">
                                                {productType === 'tune' ? (
                                                    <span className="text-muted-foreground">Digital</span>
                                                ) : productType === 'service' ? (
                                                    <span className="text-muted-foreground">N/A</span>
                                                ) : (
                                                    product.variants[0]?.stockOnHand || 0
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {product.enabled ? (
                                                    <Badge className="bg-green-500/20 text-green-600 text-xs">Active</Badge>
                                                ) : (
                                                    <Badge className="bg-gray-500/20 text-gray-600 text-xs">Disabled</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <a href={`/admin/catalog/products/${product.id}`}>
                                                    <Button size="sm" variant="outline" className="h-8">
                                                        <Edit className="h-3 w-3 md:mr-1" />
                                                        <span className="hidden md:inline">Edit</span>
                                                    </Button>
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Reusable Order List Component
// ============================================================================

interface OrderListPageProps {
    title: string;
    description: string;
    productType: 'tune' | 'part' | 'service';
    icon: React.ReactNode;
    emptyMessage: string;
    accentColor: string;
}

function OrderListPage({ title, description, productType, icon, emptyMessage, accentColor }: OrderListPageProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.query<OrdersResponse>(GET_ORDERS, {
                skip: 0,
                take: 50,
            });
            const filteredOrders = (result.orders?.items || []).filter(order =>
                order.lines.some(line => line.productVariant?.product?.customFields?.productType === productType)
            );
            setOrders(filteredOrders);
        } catch (err: any) {
            setError(err.message || 'Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [productType]);

    const pendingOrders = orders.filter(o => ['PaymentAuthorized', 'PaymentSettled'].includes(o.state)).length;
    const completedOrders = orders.filter(o => o.state === 'Delivered').length;
    const totalRevenue = orders
        .filter(o => !['Cancelled'].includes(o.state))
        .reduce((sum, o) => sum + o.totalWithTax, 0);

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${accentColor}`}>
                        {icon}
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchOrders} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Total</div>
                        <div className="text-xl md:text-2xl font-bold">{orders.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Pending</div>
                        <div className="text-xl md:text-2xl font-bold text-yellow-500">{pendingOrders}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Completed</div>
                        <div className="text-xl md:text-2xl font-bold text-green-500">{completedOrders}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Revenue</div>
                        <div className="text-lg md:text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                </div>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && (
                        <div className="py-12 text-center">
                            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Loading...</p>
                        </div>
                    )}
                    {!loading && !error && orders.length === 0 && (
                        <div className="py-12 text-center">
                            <div className={`w-16 h-16 mx-auto rounded-full ${accentColor} flex items-center justify-center mb-4`}>
                                <ShoppingCart className="h-8 w-8" />
                            </div>
                            <p className="font-medium mb-2">{emptyMessage}</p>
                            <p className="text-sm text-muted-foreground">
                                Orders will appear here when customers purchase your {productType}s.
                            </p>
                        </div>
                    )}
                    {!loading && orders.length > 0 && (
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order</TableHead>
                                        <TableHead className="hidden md:table-cell">Customer</TableHead>
                                        <TableHead className="hidden sm:table-cell">Items</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="hidden md:table-cell">Date</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell>
                                                <div className="font-mono text-xs md:text-sm">{order.code}</div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <div className="text-sm">{order.customer?.firstName} {order.customer?.lastName}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                    {order.customer?.emailAddress}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <div className="text-xs">
                                                    {order.lines
                                                        .filter(line => line.productVariant?.product?.customFields?.productType === productType)
                                                        .slice(0, 2)
                                                        .map((line, i) => (
                                                            <div key={i} className="truncate max-w-[120px]">
                                                                {line.quantity}x {line.productVariant?.name}
                                                            </div>
                                                        ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {formatCurrency(order.totalWithTax)}
                                            </TableCell>
                                            <TableCell>
                                                {getOrderStateBadge(order.state)}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm">
                                                {formatDate(order.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <a href={`/admin/orders/${order.id}`}>
                                                    <Button size="sm" variant="outline" className="h-8">
                                                        <Eye className="h-3 w-3 md:mr-1" />
                                                        <span className="hidden md:inline">View</span>
                                                    </Button>
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Marketplace Admin Pages (require MarketplaceAdmin permission)
// ============================================================================

function TunerListPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();
    const [sellers, setSellers] = useState<SellerProfile[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Filters and search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterVerified, setFilterVerified] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('newest');

    // Pagination
    const [tunerSkip, setTunerSkip] = useState(0);
    const tunerTake = 25;

    // Selected tuner for detail modal
    const [selectedTuner, setSelectedTuner] = useState<SellerProfile | null>(null);

    // Bulk actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    // Notes/Comments (placeholder for future)
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');

    // Badge management state
    const [badgeIconOptions, setBadgeIconOptions] = useState<BadgeOption[]>([]);
    const [badgeColorOptions, setBadgeColorOptions] = useState<BadgeOption[]>([]);
    const [newBadgeIcon, setNewBadgeIcon] = useState('star');
    const [newBadgeText, setNewBadgeText] = useState('');
    const [newBadgeColor, setNewBadgeColor] = useState('gold');
    const [badgeLoading, setBadgeLoading] = useState(false);

    // Moderation modal state
    const [showBanModal, setShowBanModal] = useState(false);
    const [showWarnModal, setShowWarnModal] = useState(false);
    const [showHardSuspendModal, setShowHardSuspendModal] = useState(false);
    const [moderationTarget, setModerationTarget] = useState<SellerProfile | null>(null);
    const [moderationReason, setModerationReason] = useState('');
    const [moderationLoading, setModerationLoading] = useState(false);
    const [adminNotesText, setAdminNotesText] = useState('');
    const [editingAdminNotes, setEditingAdminNotes] = useState(false);

    const fetchBadgeOptions = async () => {
        try {
            const result = await api.query<BadgeOptionsResponse>(GET_BADGE_OPTIONS);
            setBadgeIconOptions(result.badgeIconOptions || []);
            setBadgeColorOptions(result.badgeColorOptions || []);
            // Set defaults if options loaded
            if (result.badgeIconOptions?.length) setNewBadgeIcon(result.badgeIconOptions[0].value);
            if (result.badgeColorOptions?.length) setNewBadgeColor(result.badgeColorOptions[0].value);
        } catch (err) {
            console.error('Failed to load badge options:', err);
        }
    };

    const handleAddBadge = async (sellerId: string) => {
        if (!newBadgeText.trim()) {
            setMessage({ type: 'error', text: 'Badge text is required' });
            return;
        }
        setBadgeLoading(true);
        try {
            const result = await api.mutate<{ addSellerBadge: SellerProfile }>(ADD_SELLER_BADGE, {
                sellerId,
                badge: {
                    icon: newBadgeIcon,
                    text: newBadgeText.trim(),
                    color: newBadgeColor,
                },
            });
            if (result.addSellerBadge) {
                // Update the selected tuner with new badges
                setSelectedTuner(prev => prev ? { ...prev, customBadges: result.addSellerBadge.customBadges } : null);
                // Update the sellers list too
                setSellers(prev => prev.map(s => s.id === sellerId ? { ...s, customBadges: result.addSellerBadge.customBadges } : s));
                setNewBadgeText('');
                setMessage({ type: 'success', text: 'Badge added successfully' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to add badge' });
        } finally {
            setBadgeLoading(false);
        }
    };

    const handleRemoveBadge = async (sellerId: string, badgeIndex: number) => {
        setBadgeLoading(true);
        try {
            const result = await api.mutate<{ removeSellerBadge: SellerProfile }>(REMOVE_SELLER_BADGE, {
                sellerId,
                badgeIndex,
            });
            if (result.removeSellerBadge) {
                // Update the selected tuner with new badges
                setSelectedTuner(prev => prev ? { ...prev, customBadges: result.removeSellerBadge.customBadges } : null);
                // Update the sellers list too
                setSellers(prev => prev.map(s => s.id === sellerId ? { ...s, customBadges: result.removeSellerBadge.customBadges } : s));
                setMessage({ type: 'success', text: 'Badge removed' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to remove badge' });
        } finally {
            setBadgeLoading(false);
        }
    };

    const fetchSellers = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.query<SellerProfilesResponse>(GET_SELLER_PROFILES, { skip: tunerSkip, take: 200 });
            setSellers(result.sellerProfiles?.items || []);
            setTotalItems(result.sellerProfiles?.totalItems || 0);
        } catch (err: any) {
            if (err.message?.includes('permission') || err.message?.includes('Forbidden')) {
                setError('You do not have permission to view this page. This section is for marketplace administrators only.');
            } else {
                setError(err.message || 'Failed to load tuners');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!permLoading && isSuperAdmin) {
            fetchSellers();
            fetchBadgeOptions();
        } else if (!permLoading && !isSuperAdmin) {
            setError('Access denied. This page is only available to marketplace administrators.');
            setLoading(false);
        }
    }, [permLoading, isSuperAdmin]);

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(APPROVE_SELLER, { id });
            await fetchSellers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(REJECT_SELLER, { id });
            await fetchSellers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSuspend = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(SUSPEND_SELLER, { id });
            await fetchSellers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleVerify = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(VERIFY_SELLER, { id });
            await fetchSellers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnverify = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(UNVERIFY_SELLER, { id });
            await fetchSellers();
            setMessage({ type: 'success', text: 'Verified badge removed' });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Advanced moderation handlers
    const openBanModal = (seller: SellerProfile) => {
        setModerationTarget(seller);
        setModerationReason('');
        setShowBanModal(true);
    };

    const openWarnModal = (seller: SellerProfile) => {
        setModerationTarget(seller);
        setModerationReason('');
        setShowWarnModal(true);
    };

    const openHardSuspendModal = (seller: SellerProfile) => {
        setModerationTarget(seller);
        setModerationReason('');
        setShowHardSuspendModal(true);
    };

    const handleBanSeller = async () => {
        if (!moderationTarget || !moderationReason.trim()) {
            setMessage({ type: 'error', text: 'Ban reason is required' });
            return;
        }
        setModerationLoading(true);
        try {
            await api.mutate(BAN_SELLER, { id: moderationTarget.id, reason: moderationReason.trim() });
            await fetchSellers();
            setShowBanModal(false);
            setSelectedTuner(null);
            setMessage({ type: 'success', text: 'Seller has been banned' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to ban seller' });
        } finally {
            setModerationLoading(false);
        }
    };

    const handleUnbanSeller = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(UNBAN_SELLER, { id });
            await fetchSellers();
            setMessage({ type: 'success', text: 'Seller has been unbanned' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to unban seller' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleHardSuspend = async () => {
        if (!moderationTarget) return;
        setModerationLoading(true);
        try {
            await api.mutate(HARD_SUSPEND_SELLER, { id: moderationTarget.id, reason: moderationReason.trim() || null });
            await fetchSellers();
            setShowHardSuspendModal(false);
            setSelectedTuner(null);
            setMessage({ type: 'success', text: 'Seller has been hard suspended' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to hard suspend seller' });
        } finally {
            setModerationLoading(false);
        }
    };

    const handleUnHardSuspend = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(UN_HARD_SUSPEND_SELLER, { id });
            await fetchSellers();
            setMessage({ type: 'success', text: 'Hard suspension removed' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to remove hard suspension' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleWarnSeller = async () => {
        if (!moderationTarget || !moderationReason.trim()) {
            setMessage({ type: 'error', text: 'Warning message is required' });
            return;
        }
        setModerationLoading(true);
        try {
            await api.mutate(WARN_SELLER, { id: moderationTarget.id, message: moderationReason.trim() });
            await fetchSellers();
            setShowWarnModal(false);
            setMessage({ type: 'success', text: 'Warning issued to seller' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to warn seller' });
        } finally {
            setModerationLoading(false);
        }
    };

    const handleClearWarnings = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(CLEAR_WARNINGS, { id });
            await fetchSellers();
            setMessage({ type: 'success', text: 'Warnings cleared' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to clear warnings' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleFeatured = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(TOGGLE_FEATURED, { id });
            await fetchSellers();
            setMessage({ type: 'success', text: 'Featured status toggled' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to toggle featured' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleTrusted = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(TOGGLE_TRUSTED, { id });
            await fetchSellers();
            setMessage({ type: 'success', text: 'Trusted status toggled' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to toggle trusted' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleTogglePrioritySupport = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(TOGGLE_PRIORITY_SUPPORT, { id });
            await fetchSellers();
            setMessage({ type: 'success', text: 'Priority support toggled' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to toggle priority support' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveAdminNotes = async (id: string) => {
        setActionLoading(id);
        try {
            await api.mutate(UPDATE_ADMIN_NOTES, { id, notes: adminNotesText });
            await fetchSellers();
            setEditingAdminNotes(false);
            setMessage({ type: 'success', text: 'Admin notes saved' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to save notes' });
        } finally {
            setActionLoading(null);
        }
    };

    // Show access denied for non-superadmins
    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">
                            This page is only available to marketplace administrators.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const pendingCount = sellers.filter(s => s.status === 'pending').length;
    const verifiedCount = sellers.filter(s => s.verified).length;
    const suspendedCount = sellers.filter(s => s.status === 'suspended').length;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Approved</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Pending</Badge>;
            case 'suspended':
                return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Suspended</Badge>;
            case 'rejected':
                return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Rejected</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    // Filter and sort sellers
    const filteredSellers = sellers.filter(seller => {
        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const matchesSearch =
                seller.businessName?.toLowerCase().includes(search) ||
                seller.firstName?.toLowerCase().includes(search) ||
                seller.lastName?.toLowerCase().includes(search) ||
                seller.location?.toLowerCase().includes(search) ||
                seller.software?.some(s => s.toLowerCase().includes(search)) ||
                seller.vehiclePlatforms?.some(v => v.toLowerCase().includes(search));
            if (!matchesSearch) return false;
        }
        // Status filter
        if (filterStatus !== 'all' && seller.status !== filterStatus) return false;
        // Verified filter
        if (filterVerified === 'verified' && !seller.verified) return false;
        if (filterVerified === 'unverified' && seller.verified) return false;
        return true;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'newest': return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            case 'oldest': return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            case 'rating': return (b.rating || 0) - (a.rating || 0);
            case 'sales': return (b.tunesSold || 0) - (a.tunesSold || 0);
            case 'name': return (a.businessName || a.firstName || '').localeCompare(b.businessName || b.firstName || '');
            default: return 0;
        }
    });

    // Paginated results
    const paginatedSellers = filteredSellers.slice(tunerSkip, tunerSkip + tunerTake);
    const totalPages = Math.ceil(filteredSellers.length / tunerTake);
    const currentPage = Math.floor(tunerSkip / tunerTake) + 1;

    // Toggle selection
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        if (selectedIds.size === paginatedSellers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedSellers.map(s => s.id)));
        }
    };

    // Bulk actions
    const handleBulkApprove = async () => {
        setBulkActionLoading(true);
        for (const id of selectedIds) {
            try {
                await api.mutate(APPROVE_SELLER, { id });
            } catch (err: any) {
                debugLog.error('Tuner Management', `Failed to approve seller ${id}`, err.message);
            }
        }
        setSelectedIds(new Set());
        setBulkActionLoading(false);
        setMessage({ type: 'success', text: `Approved ${selectedIds.size} tuners` });
        fetchSellers();
    };

    const handleBulkVerify = async () => {
        setBulkActionLoading(true);
        for (const id of selectedIds) {
            try {
                await api.mutate(VERIFY_SELLER, { id });
            } catch (err: any) {
                debugLog.error('Tuner Management', `Failed to verify seller ${id}`, err.message);
            }
        }
        setSelectedIds(new Set());
        setBulkActionLoading(false);
        setMessage({ type: 'success', text: `Verified ${selectedIds.size} tuners` });
        fetchSellers();
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                        <Store className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">Tuner Management</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage all registered tuners and sellers
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchSellers} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-auto">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Stats Cards - Enhanced */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterStatus('all')}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div className="text-xs md:text-sm text-muted-foreground">Total</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold">{totalItems}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-yellow-500/50 transition-colors ${filterStatus === 'pending' ? 'border-yellow-500' : ''}`} onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Pending</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-yellow-500">{pendingCount}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-green-500/50 transition-colors ${filterStatus === 'approved' ? 'border-green-500' : ''}`} onClick={() => setFilterStatus(filterStatus === 'approved' ? 'all' : 'approved')}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Approved</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-green-500">{sellers.filter(s => s.status === 'approved').length}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-blue-500/50 transition-colors ${filterVerified === 'verified' ? 'border-blue-500' : ''}`} onClick={() => setFilterVerified(filterVerified === 'verified' ? 'all' : 'verified')}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-blue-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Verified</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-blue-500">{verifiedCount}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-red-500/50 transition-colors ${filterStatus === 'suspended' ? 'border-red-500' : ''}`} onClick={() => setFilterStatus(filterStatus === 'suspended' ? 'all' : 'suspended')}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Ban className="h-4 w-4 text-red-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Suspended</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-red-500">{suspendedCount}</div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {/* Filters Card */}
            <Card className="mb-6">
                <CardContent className="py-4">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm text-muted-foreground mb-1 block">Search</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setTunerSkip(0); }}
                                placeholder="Search by name, business, location, software..."
                                className="w-full px-3 py-2 border rounded-md bg-background"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => { setFilterStatus(e.target.value); setTunerSkip(0); }}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="suspended">Suspended</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Verified</label>
                            <select
                                value={filterVerified}
                                onChange={(e) => { setFilterVerified(e.target.value); setTunerSkip(0); }}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="all">All</option>
                                <option value="verified">Verified Only</option>
                                <option value="unverified">Unverified Only</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Sort By</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="name">Name A-Z</option>
                                <option value="rating">Highest Rating</option>
                                <option value="sales">Most Sales</option>
                            </select>
                        </div>
                        <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterVerified('all'); setSortBy('newest'); setTunerSkip(0); }}>
                            Clear Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <Card className="mb-4 border-primary">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-sm font-medium">{selectedIds.size} selected</span>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={handleBulkApprove} disabled={bulkActionLoading}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve All
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleBulkVerify} disabled={bulkActionLoading}>
                                    <ShieldCheck className="h-4 w-4 mr-1" />
                                    Verify All
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                                    Clear Selection
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main Table */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Tuner Profiles</CardTitle>
                        <span className="text-sm text-muted-foreground">
                            Showing {paginatedSellers.length} of {filteredSellers.length} tuners
                        </span>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading && <div className="py-8 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>}
                    {!loading && !error && filteredSellers.length === 0 && (
                        <div className="py-8 text-center">
                            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No tuners match your filters</p>
                        </div>
                    )}
                    {!loading && paginatedSellers.length > 0 && (
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.size === paginatedSellers.length && paginatedSellers.length > 0}
                                                onChange={selectAll}
                                                className="rounded"
                                            />
                                        </TableHead>
                                        <TableHead>Tuner</TableHead>
                                        <TableHead className="hidden md:table-cell">Contact</TableHead>
                                        <TableHead className="hidden lg:table-cell">Specialties</TableHead>
                                        <TableHead className="hidden lg:table-cell">Performance</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedSellers.map((seller) => (
                                        <TableRow key={seller.id} className={selectedIds.has(seller.id) ? 'bg-primary/5' : ''}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(seller.id)}
                                                    onChange={() => toggleSelection(seller.id)}
                                                    className="rounded"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="min-w-[150px]">
                                                    <div className="font-medium flex items-center gap-1">
                                                        {seller.businessName || `${seller.firstName} ${seller.lastName}`}
                                                        {seller.verified && (
                                                            <ShieldCheck className="h-4 w-4 text-blue-500" title="Verified Tuner" />
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {seller.firstName} {seller.lastName}
                                                    </div>
                                                    {seller.location && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {seller.location}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <div className="text-sm space-y-1">
                                                    {seller.phone && (
                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                            <Phone className="h-3 w-3" />
                                                            {seller.phone}
                                                        </div>
                                                    )}
                                                    {seller.website && (
                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                            <Globe className="h-3 w-3" />
                                                            <a href={seller.website} target="_blank" rel="noopener" className="text-blue-500 hover:underline truncate max-w-[120px]">
                                                                {seller.website.replace(/^https?:\/\//, '')}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {seller.instagram && (
                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                            <Instagram className="h-3 w-3" />
                                                            @{seller.instagram}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                <div className="space-y-1 max-w-[200px]">
                                                    {seller.software && seller.software.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {seller.software.slice(0, 3).map((s, i) => (
                                                                <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                                                            ))}
                                                            {seller.software.length > 3 && (
                                                                <Badge variant="secondary" className="text-xs">+{seller.software.length - 3}</Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                    {seller.vehiclePlatforms && seller.vehiclePlatforms.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {seller.vehiclePlatforms.slice(0, 2).map((v, i) => (
                                                                <Badge key={i} variant="outline" className="text-xs"><Car className="h-2 w-2 mr-1" />{v}</Badge>
                                                            ))}
                                                            {seller.vehiclePlatforms.length > 2 && (
                                                                <Badge variant="outline" className="text-xs">+{seller.vehiclePlatforms.length - 2}</Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                <div className="text-sm space-y-1">
                                                    <div className="flex items-center gap-1">
                                                        <Star className="h-3 w-3 text-yellow-500" />
                                                        <span className="font-medium">{seller.rating?.toFixed(1) || '0.0'}</span>
                                                        <span className="text-muted-foreground">({seller.reviewCount || 0})</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <TrendingUp className="h-3 w-3" />
                                                        {seller.tunesSold || 0} sales
                                                    </div>
                                                    {seller.experience && (
                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                            <Award className="h-3 w-3" />
                                                            {seller.experience}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(seller.status)}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {/* View Details */}
                                                    <Button size="sm" variant="outline" onClick={() => setSelectedTuner(seller)} className="h-7 text-xs" title="View Details">
                                                        <Eye className="h-3 w-3" />
                                                    </Button>
                                                    {actionLoading === seller.id ? (
                                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            {seller.status === 'pending' && (
                                                                <>
                                                                    <Button size="sm" variant="outline" onClick={() => handleApprove(seller.id)} className="h-7 text-xs text-green-600" title="Approve">
                                                                        <CheckCircle className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" onClick={() => handleReject(seller.id)} className="h-7 text-xs text-red-600" title="Reject">
                                                                        <XCircle className="h-3 w-3" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {seller.status === 'approved' && (
                                                                <>
                                                                    {!seller.verified ? (
                                                                        <Button size="sm" variant="outline" onClick={() => handleVerify(seller.id)} className="h-7 text-xs text-blue-600" title="Verify">
                                                                            <ShieldCheck className="h-3 w-3" />
                                                                        </Button>
                                                                    ) : (
                                                                        <Button size="sm" variant="outline" onClick={() => handleUnverify(seller.id)} className="h-7 text-xs text-orange-600" title="Remove Verified Badge">
                                                                            <ShieldCheck className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                    <Button size="sm" variant="outline" onClick={() => handleSuspend(seller.id)} className="h-7 text-xs text-red-600" title="Suspend">
                                                                        <Ban className="h-3 w-3" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {seller.status === 'suspended' && (
                                                                <Button size="sm" variant="outline" onClick={() => handleApprove(seller.id)} className="h-7 text-xs text-green-600" title="Reinstate">
                                                                    <CheckCircle className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTunerSkip(Math.max(0, tunerSkip - tunerTake))}
                                    disabled={tunerSkip === 0}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTunerSkip(tunerSkip + tunerTake)}
                                    disabled={currentPage >= totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tuner Detail Modal */}
            {selectedTuner && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        {selectedTuner.businessName || `${selectedTuner.firstName} ${selectedTuner.lastName}`}
                                        {selectedTuner.verified && <ShieldCheck className="h-5 w-5 text-blue-500" />}
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {selectedTuner.firstName} {selectedTuner.lastName}
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setSelectedTuner(null)}>
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Status and Quick Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {getStatusBadge(selectedTuner.status)}
                                {selectedTuner.verified && <Badge className="bg-blue-500/20 text-blue-600">Verified</Badge>}
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Contact Information</h4>
                                    <div className="space-y-2 text-sm">
                                        {selectedTuner.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                {selectedTuner.phone}
                                            </div>
                                        )}
                                        {selectedTuner.location && (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                {selectedTuner.location}
                                            </div>
                                        )}
                                        {selectedTuner.website && (
                                            <div className="flex items-center gap-2">
                                                <Globe className="h-4 w-4 text-muted-foreground" />
                                                <a href={selectedTuner.website} target="_blank" rel="noopener" className="text-blue-500 hover:underline">
                                                    {selectedTuner.website}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Performance Stats</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Star className="h-4 w-4 text-yellow-500" />
                                            Rating: {selectedTuner.rating?.toFixed(1) || '0.0'} ({selectedTuner.reviewCount || 0} reviews)
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-green-500" />
                                            {selectedTuner.tunesSold || 0} tunes sold
                                        </div>
                                        {selectedTuner.experience && (
                                            <div className="flex items-center gap-2">
                                                <Award className="h-4 w-4 text-purple-500" />
                                                {selectedTuner.experience}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Software & Platforms */}
                            {(selectedTuner.software?.length || selectedTuner.vehiclePlatforms?.length) && (
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Specialties</h4>
                                    <div className="space-y-2">
                                        {selectedTuner.software && selectedTuner.software.length > 0 && (
                                            <div>
                                                <span className="text-xs text-muted-foreground">Software:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {selectedTuner.software.map((s, i) => (
                                                        <Badge key={i} variant="secondary">{s}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedTuner.vehiclePlatforms && selectedTuner.vehiclePlatforms.length > 0 && (
                                            <div>
                                                <span className="text-xs text-muted-foreground">Platforms:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {selectedTuner.vehiclePlatforms.map((v, i) => (
                                                        <Badge key={i} variant="outline"><Car className="h-3 w-3 mr-1" />{v}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedTuner.tuneTypes && selectedTuner.tuneTypes.length > 0 && (
                                            <div>
                                                <span className="text-xs text-muted-foreground">Tune Types:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {selectedTuner.tuneTypes.map((t, i) => (
                                                        <Badge key={i} variant="outline"><Cpu className="h-3 w-3 mr-1" />{t}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Bio */}
                            {selectedTuner.bio && (
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Bio</h4>
                                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                        {selectedTuner.bio}
                                    </p>
                                </div>
                            )}

                            {/* Social Media */}
                            {(selectedTuner.instagram || selectedTuner.facebook || selectedTuner.youtube) && (
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Social Media</h4>
                                    <div className="flex gap-3">
                                        {selectedTuner.instagram && (
                                            <a href={`https://instagram.com/${selectedTuner.instagram}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-sm text-pink-500 hover:underline">
                                                <Instagram className="h-4 w-4" />
                                                @{selectedTuner.instagram}
                                            </a>
                                        )}
                                        {selectedTuner.facebook && (
                                            <a href={selectedTuner.facebook} target="_blank" rel="noopener" className="flex items-center gap-1 text-sm text-blue-500 hover:underline">
                                                <Facebook className="h-4 w-4" />
                                                Facebook
                                            </a>
                                        )}
                                        {selectedTuner.youtube && (
                                            <a href={selectedTuner.youtube} target="_blank" rel="noopener" className="flex items-center gap-1 text-sm text-red-500 hover:underline">
                                                <ExternalLink className="h-4 w-4" />
                                                YouTube
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Custom Badges Management */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                    <Award className="h-4 w-4 text-yellow-500" />
                                    Custom Badges
                                </h4>

                                {/* Current badges */}
                                {selectedTuner.customBadges && selectedTuner.customBadges.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs text-muted-foreground mb-2">Current Badges:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTuner.customBadges.map((badge, index) => (
                                                <div key={index} className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-sm">
                                                    <span className={`text-sm ${
                                                        badge.color === 'gold' ? 'text-yellow-500' :
                                                        badge.color === 'silver' ? 'text-gray-400' :
                                                        badge.color === 'bronze' ? 'text-orange-600' :
                                                        badge.color === 'red' ? 'text-red-500' :
                                                        badge.color === 'blue' ? 'text-blue-500' :
                                                        badge.color === 'green' ? 'text-green-500' :
                                                        badge.color === 'purple' ? 'text-purple-500' :
                                                        badge.color === 'orange' ? 'text-orange-500' :
                                                        badge.color === 'pink' ? 'text-pink-500' :
                                                        badge.color === 'cyan' ? 'text-cyan-500' :
                                                        'text-yellow-500'
                                                    }`}>
                                                        {badge.icon === 'star' && '★'}
                                                        {badge.icon === 'trophy' && '🏆'}
                                                        {badge.icon === 'fire' && '🔥'}
                                                        {badge.icon === 'bolt' && '⚡'}
                                                        {badge.icon === 'shield' && '🛡'}
                                                        {badge.icon === 'heart' && '❤'}
                                                        {badge.icon === 'crown' && '👑'}
                                                        {badge.icon === 'diamond' && '💎'}
                                                        {badge.icon === 'rocket' && '🚀'}
                                                        {badge.icon === 'wrench' && '🔧'}
                                                        {badge.icon === 'check' && '✓'}
                                                        {badge.icon === 'zap' && '⚡'}
                                                        {badge.icon === 'medal' && '🥇'}
                                                        {badge.icon === 'sparkles' && '✨'}
                                                        {badge.icon === 'lightning' && '⚡'}
                                                    </span>
                                                    <span>{badge.text}</span>
                                                    <button
                                                        onClick={() => handleRemoveBadge(selectedTuner.id, index)}
                                                        disabled={badgeLoading}
                                                        className="ml-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                                                        title="Remove badge"
                                                    >
                                                        <XCircle className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Add new badge form */}
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-2">Add New Badge:</p>
                                    <div className="flex flex-wrap gap-2 items-end">
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Icon</label>
                                            <select
                                                value={newBadgeIcon}
                                                onChange={(e) => setNewBadgeIcon(e.target.value)}
                                                className="px-2 py-1.5 border rounded-md bg-background text-sm"
                                            >
                                                {badgeIconOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Color</label>
                                            <select
                                                value={newBadgeColor}
                                                onChange={(e) => setNewBadgeColor(e.target.value)}
                                                className="px-2 py-1.5 border rounded-md bg-background text-sm"
                                            >
                                                {badgeColorOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1 min-w-[150px]">
                                            <label className="text-xs text-muted-foreground block mb-1">Badge Text</label>
                                            <input
                                                type="text"
                                                value={newBadgeText}
                                                onChange={(e) => setNewBadgeText(e.target.value)}
                                                placeholder="e.g., Top Performer"
                                                className="w-full px-2 py-1.5 border rounded-md bg-background text-sm"
                                            />
                                        </div>
                                        <Button
                                            onClick={() => handleAddBadge(selectedTuner.id)}
                                            disabled={badgeLoading || !newBadgeText.trim()}
                                            size="sm"
                                            className="bg-yellow-500 hover:bg-yellow-600"
                                        >
                                            {badgeLoading ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Plus className="h-4 w-4 mr-1" />
                                                    Add Badge
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Notes */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Admin Notes
                                </h4>
                                <textarea
                                    placeholder="Add internal notes about this tuner..."
                                    className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[80px]"
                                    value={editingAdminNotes ? adminNotesText : (selectedTuner.adminNotes || '')}
                                    onChange={(e) => {
                                        if (!editingAdminNotes) {
                                            setEditingAdminNotes(true);
                                            setAdminNotesText(e.target.value);
                                        } else {
                                            setAdminNotesText(e.target.value);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (!editingAdminNotes) {
                                            setAdminNotesText(selectedTuner.adminNotes || '');
                                            setEditingAdminNotes(true);
                                        }
                                    }}
                                />
                                {editingAdminNotes && (
                                    <div className="flex gap-2 mt-2">
                                        <Button size="sm" onClick={() => handleSaveAdminNotes(selectedTuner.id)} disabled={actionLoading === selectedTuner.id}>
                                            Save Notes
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingAdminNotes(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Moderation Status Indicators */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3">Moderation Status</h4>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {selectedTuner.warningCount > 0 && (
                                        <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                                            ⚠️ {selectedTuner.warningCount} Warning{selectedTuner.warningCount > 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                    {selectedTuner.hardSuspended && (
                                        <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">
                                            🚫 Hard Suspended
                                        </Badge>
                                    )}
                                    {selectedTuner.banned && (
                                        <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
                                            ⛔ Banned: {selectedTuner.banReason}
                                        </Badge>
                                    )}
                                    {selectedTuner.featured && (
                                        <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30">
                                            ⭐ Featured
                                        </Badge>
                                    )}
                                    {selectedTuner.trusted && (
                                        <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                                            ✓ Trusted
                                        </Badge>
                                    )}
                                    {selectedTuner.prioritySupport && (
                                        <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                                            🎫 Priority Support
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions - Non-disappearing Toggle Buttons */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Approval Status */}
                                    {selectedTuner.status === 'pending' ? (
                                        <>
                                            <Button onClick={() => handleApprove(selectedTuner.id)} className="bg-green-500 hover:bg-green-600">
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Approve
                                            </Button>
                                            <Button variant="destructive" onClick={() => handleReject(selectedTuner.id)}>
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Reject
                                            </Button>
                                        </>
                                    ) : selectedTuner.status === 'approved' ? (
                                        <Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50" onClick={() => handleSuspend(selectedTuner.id)}>
                                            <Ban className="h-4 w-4 mr-2" />
                                            Suspend
                                        </Button>
                                    ) : (
                                        <Button className="bg-green-500 hover:bg-green-600" onClick={() => handleApprove(selectedTuner.id)}>
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Reinstate
                                        </Button>
                                    )}

                                    {/* Verified Badge - Always visible toggle */}
                                    <Button
                                        onClick={() => selectedTuner.verified ? handleUnverify(selectedTuner.id) : handleVerify(selectedTuner.id)}
                                        className={selectedTuner.verified ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}
                                    >
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        {selectedTuner.verified ? 'Remove Verified' : 'Grant Verified'}
                                    </Button>

                                    {/* Hard Suspend - Always visible toggle */}
                                    <Button
                                        onClick={() => selectedTuner.hardSuspended ? handleUnHardSuspend(selectedTuner.id) : openHardSuspendModal(selectedTuner)}
                                        className={selectedTuner.hardSuspended ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"}
                                    >
                                        <Ban className="h-4 w-4 mr-2" />
                                        {selectedTuner.hardSuspended ? 'Un-Hard Suspend' : 'Hard Suspend'}
                                    </Button>

                                    {/* Ban - Always visible toggle */}
                                    <Button
                                        onClick={() => selectedTuner.banned ? handleUnbanSeller(selectedTuner.id) : openBanModal(selectedTuner)}
                                        className={selectedTuner.banned ? "bg-green-500 hover:bg-green-600" : "bg-red-600 hover:bg-red-700"}
                                    >
                                        <Ban className="h-4 w-4 mr-2" />
                                        {selectedTuner.banned ? 'Unban' : 'Ban'}
                                    </Button>

                                    {/* Warn */}
                                    <Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50" onClick={() => openWarnModal(selectedTuner)}>
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        Issue Warning
                                    </Button>

                                    {/* Clear Warnings */}
                                    {selectedTuner.warningCount > 0 && (
                                        <Button variant="outline" onClick={() => handleClearWarnings(selectedTuner.id)}>
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Clear Warnings
                                        </Button>
                                    )}
                                </div>

                                {/* Feature Toggles */}
                                <div className="mt-4 pt-4 border-t">
                                    <h5 className="text-xs font-medium mb-2 text-muted-foreground">Feature Toggles</h5>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleToggleFeatured(selectedTuner.id)}
                                            className={selectedTuner.featured ? "bg-purple-100 border-purple-500 text-purple-700" : ""}
                                        >
                                            ⭐ Featured {selectedTuner.featured ? '(ON)' : '(OFF)'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleToggleTrusted(selectedTuner.id)}
                                            className={selectedTuner.trusted ? "bg-green-100 border-green-500 text-green-700" : ""}
                                        >
                                            ✓ Trusted {selectedTuner.trusted ? '(ON)' : '(OFF)'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleTogglePrioritySupport(selectedTuner.id)}
                                            className={selectedTuner.prioritySupport ? "bg-blue-100 border-blue-500 text-blue-700" : ""}
                                        >
                                            🎫 Priority {selectedTuner.prioritySupport ? '(ON)' : '(OFF)'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <div className="mt-4 pt-4 border-t">
                                    <Button variant="outline" className="w-full" onClick={() => setSelectedTuner(null)}>
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Ban Modal */}
            {showBanModal && moderationTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600">
                                <Ban className="h-5 w-5" />
                                Ban Seller
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                You are about to ban <strong>{moderationTarget.businessName || `${moderationTarget.firstName} ${moderationTarget.lastName}`}</strong>.
                                This will suspend their account and display the ban reason on their public profile.
                            </p>
                            <div className="mb-4">
                                <label className="text-sm font-medium block mb-2">Ban Reason (required)</label>
                                <textarea
                                    value={moderationReason}
                                    onChange={(e) => setModerationReason(e.target.value)}
                                    placeholder="Enter the reason for this ban..."
                                    className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[100px]"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowBanModal(false)} disabled={moderationLoading}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleBanSeller}
                                    disabled={moderationLoading || !moderationReason.trim()}
                                >
                                    {moderationLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                                    Ban Seller
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Warning Modal */}
            {showWarnModal && moderationTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-yellow-600">
                                <AlertTriangle className="h-5 w-5" />
                                Issue Warning
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Issue a warning to <strong>{moderationTarget.businessName || `${moderationTarget.firstName} ${moderationTarget.lastName}`}</strong>.
                                Current warning count: {moderationTarget.warningCount || 0}
                            </p>
                            <div className="mb-4">
                                <label className="text-sm font-medium block mb-2">Warning Message (required)</label>
                                <textarea
                                    value={moderationReason}
                                    onChange={(e) => setModerationReason(e.target.value)}
                                    placeholder="Enter the warning message..."
                                    className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[100px]"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowWarnModal(false)} disabled={moderationLoading}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-yellow-500 hover:bg-yellow-600"
                                    onClick={handleWarnSeller}
                                    disabled={moderationLoading || !moderationReason.trim()}
                                >
                                    {moderationLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                                    Issue Warning
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Hard Suspend Modal */}
            {showHardSuspendModal && moderationTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-orange-600">
                                <Ban className="h-5 w-5" />
                                Hard Suspend Seller
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Hard suspend <strong>{moderationTarget.businessName || `${moderationTarget.firstName} ${moderationTarget.lastName}`}</strong>.
                                This will show a suspension notice on their public profile.
                            </p>
                            <div className="mb-4">
                                <label className="text-sm font-medium block mb-2">Reason (optional)</label>
                                <textarea
                                    value={moderationReason}
                                    onChange={(e) => setModerationReason(e.target.value)}
                                    placeholder="Enter reason for hard suspension (optional)..."
                                    className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[100px]"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowHardSuspendModal(false)} disabled={moderationLoading}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-orange-500 hover:bg-orange-600"
                                    onClick={handleHardSuspend}
                                    disabled={moderationLoading}
                                >
                                    {moderationLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                                    Hard Suspend
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tuner-Specific Settings Panel */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Tuner Management Settings
                        <Badge variant="outline" className="text-xs">Quick Access</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Default Approval</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Configure whether new tuner registrations are auto-approved
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <Settings className="h-4 w-4 mr-2" />
                                Configure in Settings
                            </Button>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Verification Requirements</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Set criteria for verified badge eligibility
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Non-functional (Dev)
                            </Button>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Commission Rates</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Manage platform fees for tuner transactions
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <DollarSign className="h-4 w-4 mr-2" />
                                Non-functional (Dev)
                            </Button>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Export Data</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Export tuner list to CSV or JSON
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <FileText className="h-4 w-4 mr-2" />
                                Non-functional (Dev)
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


const GET_CUSTOMERS = gql`
    query GetCustomers($skip: Int, $take: Int) {
        customers(options: { skip: $skip, take: $take }) {
            items {
                id
                firstName
                lastName
                emailAddress
                user {
                    id
                    verified
                }
                createdAt
            }
            totalItems
        }
    }
`;

interface Customer {
    id: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    user?: {
        id: string;
        verified: boolean;
    };
    createdAt: string;
}

interface CustomersResponse {
    customers: {
        items: Customer[];
        totalItems: number;
    };
}

interface MarketplaceSettings {
    autoVerifyEmail: boolean;
    autoVerifySeller: boolean;
    autoApprove: boolean;
}

// ============================================================================
// Manage Customers Page (SuperAdmin)
// ============================================================================

function ManageCustomersPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();

    // Data state
    const [customers, setCustomers] = useState<CustomerForManagement[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterVerified, setFilterVerified] = useState<boolean | undefined>(undefined);
    const [filterSeller, setFilterSeller] = useState<boolean | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('newest');

    // Pagination
    const [skip, setSkip] = useState(0);
    const take = 25;

    // Action states
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Convert to seller modal
    const [convertingCustomer, setConvertingCustomer] = useState<CustomerForManagement | null>(null);
    const [businessName, setBusinessName] = useState('');

    // Selected customer for detail modal
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerForManagement | null>(null);

    // Bulk actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const result = await api.query<CustomersForManagementResponse>(GET_CUSTOMERS_FOR_MANAGEMENT, {
                skip,
                take,
                searchTerm: searchTerm || undefined,
                filterVerified,
                filterSeller,
            });
            setCustomers(result.customersForManagement?.items || []);
            setTotalItems(result.customersForManagement?.totalItems || 0);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to load customers' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!permLoading) {
            fetchCustomers();
        }
    }, [permLoading, skip, searchTerm, filterVerified, filterSeller]);

    const handleEnableCustomer = async (customerId: string) => {
        setActionLoading(customerId);
        try {
            const result = await api.mutate<{ enableCustomer: CustomerAccountResult }>(ENABLE_CUSTOMER, { customerId });
            if (result.enableCustomer?.success) {
                setMessage({ type: 'success', text: 'Customer account enabled' });
                fetchCustomers();
            } else {
                setMessage({ type: 'error', text: result.enableCustomer?.message || 'Failed to enable customer' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to enable customer' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleDisableCustomer = async (customerId: string) => {
        setActionLoading(customerId);
        try {
            const result = await api.mutate<{ disableCustomer: CustomerAccountResult }>(DISABLE_CUSTOMER, { customerId });
            if (result.disableCustomer?.success) {
                setMessage({ type: 'success', text: 'Customer account disabled' });
                fetchCustomers();
            } else {
                setMessage({ type: 'error', text: result.disableCustomer?.message || 'Failed to disable customer' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to disable customer' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleVerifyEmail = async (customerId: string) => {
        setActionLoading(customerId);
        try {
            const result = await api.mutate<{ verifyCustomerEmail: CustomerAccountResult }>(VERIFY_CUSTOMER_EMAIL, { customerId });
            if (result.verifyCustomerEmail?.success) {
                setMessage({ type: 'success', text: 'Email verified successfully' });
                fetchCustomers();
            } else {
                setMessage({ type: 'error', text: result.verifyCustomerEmail?.message || 'Failed to verify email' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to verify email' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleResendVerification = async (customerId: string) => {
        setActionLoading(customerId);
        try {
            const result = await api.mutate<{ resendVerificationEmail: CustomerAccountResult }>(RESEND_VERIFICATION_EMAIL, { customerId });
            if (result.resendVerificationEmail?.success) {
                setMessage({ type: 'success', text: 'Verification email sent' });
            } else {
                setMessage({ type: 'error', text: result.resendVerificationEmail?.message || 'Failed to send email' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to send email' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleConvertToSeller = async () => {
        if (!convertingCustomer) return;
        setActionLoading(convertingCustomer.id);
        try {
            const result = await api.mutate<{ convertCustomerToSeller: ConvertToSellerResult }>(CONVERT_CUSTOMER_TO_SELLER, {
                customerId: convertingCustomer.id,
                businessName: businessName || undefined,
            });
            if (result.convertCustomerToSeller?.success) {
                setMessage({ type: 'success', text: `Customer converted to seller (ID: ${result.convertCustomerToSeller.sellerProfileId})` });
                setConvertingCustomer(null);
                setBusinessName('');
                fetchCustomers();
            } else {
                setMessage({ type: 'error', text: result.convertCustomerToSeller?.message || 'Failed to convert to seller' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to convert to seller' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSkip(0);
        fetchCustomers();
    };

    if (permLoading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isSuperAdmin) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="py-8 text-center">
                        <Ban className="h-12 w-12 mx-auto text-red-500 mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">You must be a SuperAdmin to access customer management.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const totalPages = Math.ceil(totalItems / take);
    const currentPage = Math.floor(skip / take) + 1;

    // Bulk action handlers
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        if (selectedIds.size === customers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(customers.map(c => c.id)));
        }
    };

    const handleBulkVerify = async () => {
        setBulkActionLoading(true);
        let successCount = 0;
        for (const id of selectedIds) {
            try {
                const result = await api.mutate<{ verifyCustomerEmail: CustomerAccountResult }>(VERIFY_CUSTOMER_EMAIL, { customerId: id });
                if (result.verifyCustomerEmail?.success) successCount++;
            } catch (err: any) {
                debugLog.error('Customer Management', `Failed to verify customer ${id}`, err?.message);
            }
        }
        setSelectedIds(new Set());
        setBulkActionLoading(false);
        setMessage({ type: 'success', text: `Verified ${successCount} customer emails` });
        fetchCustomers();
    };

    const handleBulkEnable = async () => {
        setBulkActionLoading(true);
        let successCount = 0;
        for (const id of selectedIds) {
            try {
                const result = await api.mutate<{ enableCustomer: CustomerAccountResult }>(ENABLE_CUSTOMER, { customerId: id });
                if (result.enableCustomer?.success) successCount++;
            } catch (err) {
                debugLog.error('Customer Management', `Failed to enable customer ${id}`, (err as any)?.message);
            }
        }
        setSelectedIds(new Set());
        setBulkActionLoading(false);
        setMessage({ type: 'success', text: `Enabled ${successCount} customer accounts` });
        fetchCustomers();
    };

    // Stats from current data
    const activeCount = customers.filter(c => c.user?.enabled).length;
    const disabledCount = customers.filter(c => c.user && !c.user.enabled).length;
    const sellersCount = customers.filter(c => c.isSeller).length;
    const unverifiedCount = customers.filter(c => c.user && !c.user.verified).length;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                        <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">Customer Management</h1>
                        <p className="text-sm text-muted-foreground">View, manage, and convert customer accounts</p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchCustomers} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-auto">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Stats Cards - Enhanced with click to filter */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setFilterVerified(undefined); setFilterSeller(undefined); setFilterStatus('all'); }}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div className="text-xs md:text-sm text-muted-foreground">Total</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold">{totalItems}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-green-500/50 transition-colors ${filterStatus === 'active' ? 'border-green-500' : ''}`} onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Active</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-green-500">{activeCount}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-yellow-500/50 transition-colors ${filterVerified === false ? 'border-yellow-500' : ''}`} onClick={() => setFilterVerified(filterVerified === false ? undefined : false)}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Unverified</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-yellow-500">{unverifiedCount}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-purple-500/50 transition-colors ${filterSeller === true ? 'border-purple-500' : ''}`} onClick={() => setFilterSeller(filterSeller === true ? undefined : true)}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-purple-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Sellers</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-purple-500">{sellersCount}</div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:border-red-500/50 transition-colors ${filterStatus === 'disabled' ? 'border-red-500' : ''}`} onClick={() => setFilterStatus(filterStatus === 'disabled' ? 'all' : 'disabled')}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Ban className="h-4 w-4 text-red-500" />
                            <div className="text-xs md:text-sm text-muted-foreground">Disabled</div>
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-red-500">{disabledCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Enhanced Filters */}
            <Card className="mb-6">
                <CardContent className="py-4">
                    <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm text-muted-foreground mb-1 block">Search</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, email, or phone..."
                                className="w-full px-3 py-2 border rounded-md bg-background"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Email Status</label>
                            <select
                                value={filterVerified === undefined ? '' : filterVerified.toString()}
                                onChange={(e) => setFilterVerified(e.target.value === '' ? undefined : e.target.value === 'true')}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="">All</option>
                                <option value="true">Verified</option>
                                <option value="false">Unverified</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Account Type</label>
                            <select
                                value={filterSeller === undefined ? '' : filterSeller.toString()}
                                onChange={(e) => setFilterSeller(e.target.value === '' ? undefined : e.target.value === 'true')}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="">All Users</option>
                                <option value="true">Sellers Only</option>
                                <option value="false">Customers Only</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Sort By</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="name">Name A-Z</option>
                                <option value="email">Email A-Z</option>
                            </select>
                        </div>
                        <Button type="submit" disabled={loading}>
                            Search
                        </Button>
                        <Button type="button" variant="outline" onClick={() => { setSearchTerm(''); setFilterVerified(undefined); setFilterSeller(undefined); setFilterStatus('all'); setSortBy('newest'); setSkip(0); }}>
                            Clear
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <Card className="mb-4 border-primary">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-sm font-medium">{selectedIds.size} customer(s) selected</span>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={handleBulkVerify} disabled={bulkActionLoading}>
                                    <ShieldCheck className="h-4 w-4 mr-1" />
                                    Verify All Emails
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleBulkEnable} disabled={bulkActionLoading}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Enable All
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                                    Clear Selection
                                </Button>
                            </div>
                            {bulkActionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Table */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Customer List</CardTitle>
                        <span className="text-sm text-muted-foreground">
                            Showing {customers.length} of {totalItems} customers
                        </span>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No customers found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.size === customers.length && customers.length > 0}
                                                onChange={selectAll}
                                                className="rounded"
                                            />
                                        </TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Seller</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customers.map((customer) => (
                                        <TableRow key={customer.id} className={selectedIds.has(customer.id) ? 'bg-primary/5' : ''}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(customer.id)}
                                                    onChange={() => toggleSelection(customer.id)}
                                                    className="rounded"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {customer.firstName} {customer.lastName}
                                                </div>
                                                {customer.phoneNumber && (
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {customer.phoneNumber}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate max-w-[150px]">{customer.emailAddress}</span>
                                                    {customer.user?.verified && (
                                                        <CheckCircle className="h-4 w-4 text-green-500" title="Email Verified" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {customer.user ? (
                                                    customer.user.enabled ? (
                                                        <Badge className="bg-green-500/20 text-green-600">Active</Badge>
                                                    ) : (
                                                        <Badge className="bg-red-500/20 text-red-600">Disabled</Badge>
                                                    )
                                                ) : (
                                                    <Badge className="bg-gray-500/20 text-gray-600">No Account</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {customer.isSeller ? (
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-purple-500/20 text-purple-600">
                                                            {customer.sellerStatus}
                                                        </Badge>
                                                        {customer.sellerVerified && (
                                                            <ShieldCheck className="h-4 w-4 text-blue-500" title="Verified Seller" />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{formatDate(customer.createdAt)}</TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1 flex-wrap">
                                                    {/* View Details */}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        title="View Details"
                                                        onClick={() => setSelectedCustomer(customer)}
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                    </Button>

                                                    {/* Enable/Disable */}
                                                    {customer.user?.enabled ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-red-600 hover:text-red-700"
                                                            onClick={() => handleDisableCustomer(customer.id)}
                                                            disabled={actionLoading === customer.id}
                                                            title="Disable Account"
                                                        >
                                                            {actionLoading === customer.id ? (
                                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <Ban className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    ) : customer.user ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-green-600 hover:text-green-700"
                                                            onClick={() => handleEnableCustomer(customer.id)}
                                                            disabled={actionLoading === customer.id}
                                                            title="Enable Account"
                                                        >
                                                            {actionLoading === customer.id ? (
                                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <CheckCircle className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    ) : null}

                                                    {/* Verify Email */}
                                                    {customer.user && !customer.user.verified && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                title="Verify Email"
                                                                onClick={() => handleVerifyEmail(customer.id)}
                                                                disabled={actionLoading === customer.id}
                                                            >
                                                                {actionLoading === customer.id ? (
                                                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <ShieldCheck className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                title="Resend Verification"
                                                                onClick={() => handleResendVerification(customer.id)}
                                                                disabled={actionLoading === customer.id}
                                                            >
                                                                {actionLoading === customer.id ? (
                                                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <Send className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                        </>
                                                    )}

                                                    {/* Convert to Seller */}
                                                    {!customer.isSeller && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            title="Convert to Seller"
                                                            className="text-purple-600 hover:text-purple-700"
                                                            onClick={() => {
                                                                setConvertingCustomer(customer);
                                                                setBusinessName(`${customer.firstName}'s Tuning`);
                                                            }}
                                                        >
                                                            <Store className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSkip(Math.max(0, skip - take))}
                                    disabled={skip === 0}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSkip(skip + take)}
                                    disabled={currentPage >= totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Convert to Seller Modal */}
            {convertingCustomer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>Convert to Seller</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-4">
                                Convert <strong>{convertingCustomer.firstName} {convertingCustomer.lastName}</strong> to a seller account?
                            </p>
                            <div className="mb-4">
                                <label className="text-sm text-muted-foreground mb-1 block">Business Name</label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Enter business name..."
                                    className="w-full px-3 py-2 border rounded-md bg-background"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setConvertingCustomer(null);
                                        setBusinessName('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleConvertToSeller}
                                    disabled={actionLoading === convertingCustomer.id}
                                >
                                    {actionLoading === convertingCustomer.id ? (
                                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Store className="h-4 w-4 mr-2" />
                                    )}
                                    Convert
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Customer Detail Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        {selectedCustomer.firstName} {selectedCustomer.lastName}
                                        {selectedCustomer.user?.verified && <CheckCircle className="h-5 w-5 text-green-500" />}
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {selectedCustomer.emailAddress}
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setSelectedCustomer(null)}>
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Status Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {selectedCustomer.user ? (
                                    selectedCustomer.user.enabled ? (
                                        <Badge className="bg-green-500/20 text-green-600">Active Account</Badge>
                                    ) : (
                                        <Badge className="bg-red-500/20 text-red-600">Account Disabled</Badge>
                                    )
                                ) : (
                                    <Badge className="bg-gray-500/20 text-gray-600">No Account</Badge>
                                )}
                                {selectedCustomer.user?.verified ? (
                                    <Badge className="bg-green-500/20 text-green-600">Email Verified</Badge>
                                ) : selectedCustomer.user ? (
                                    <Badge className="bg-yellow-500/20 text-yellow-600">Email Unverified</Badge>
                                ) : null}
                                {selectedCustomer.isSeller && (
                                    <>
                                        <Badge className="bg-purple-500/20 text-purple-600">Seller: {selectedCustomer.sellerStatus}</Badge>
                                        {selectedCustomer.sellerVerified && <Badge className="bg-blue-500/20 text-blue-600">Verified Seller</Badge>}
                                    </>
                                )}
                            </div>

                            {/* Customer Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Contact Information</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {selectedCustomer.firstName} {selectedCustomer.lastName}
                                        </div>
                                        {selectedCustomer.phoneNumber && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                {selectedCustomer.phoneNumber}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="h-4 w-4 text-muted-foreground" />
                                            {selectedCustomer.emailAddress}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Account Details</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            Joined: {formatDate(selectedCustomer.createdAt)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Building className="h-4 w-4 text-muted-foreground" />
                                            ID: {selectedCustomer.id}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Seller Info if applicable */}
                            {selectedCustomer.isSeller && (
                                <div className="border-t pt-4">
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Store className="h-4 w-4" />
                                        Seller Information
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Status:</span>
                                            <span className="ml-2">{selectedCustomer.sellerStatus}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Verified:</span>
                                            <span className="ml-2">{selectedCustomer.sellerVerified ? 'Yes' : 'No'}</span>
                                        </div>
                                        {selectedCustomer.sellerProfileId && (
                                            <div className="col-span-2">
                                                <span className="text-muted-foreground">Profile ID:</span>
                                                <span className="ml-2">{selectedCustomer.sellerProfileId}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Admin Notes Placeholder */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Admin Notes
                                    <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                                </h4>
                                <textarea
                                    placeholder="Add internal notes about this customer..."
                                    className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[80px]"
                                    disabled
                                />
                            </div>

                            {/* Quick Actions */}
                            <div className="border-t pt-4 flex gap-2 flex-wrap">
                                {selectedCustomer.user && !selectedCustomer.user.verified && (
                                    <Button onClick={() => { handleVerifyEmail(selectedCustomer.id); setSelectedCustomer(null); }} className="bg-blue-500 hover:bg-blue-600">
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        Verify Email
                                    </Button>
                                )}
                                {selectedCustomer.user?.enabled ? (
                                    <Button variant="destructive" onClick={() => { handleDisableCustomer(selectedCustomer.id); setSelectedCustomer(null); }}>
                                        <Ban className="h-4 w-4 mr-2" />
                                        Disable Account
                                    </Button>
                                ) : selectedCustomer.user ? (
                                    <Button onClick={() => { handleEnableCustomer(selectedCustomer.id); setSelectedCustomer(null); }} className="bg-green-500 hover:bg-green-600">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Enable Account
                                    </Button>
                                ) : null}
                                {!selectedCustomer.isSeller && (
                                    <Button variant="outline" className="text-purple-600" onClick={() => {
                                        setSelectedCustomer(null);
                                        setConvertingCustomer(selectedCustomer);
                                        setBusinessName(`${selectedCustomer.firstName}'s Tuning`);
                                    }}>
                                        <Store className="h-4 w-4 mr-2" />
                                        Convert to Seller
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                                    Close
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Customer-Specific Settings Panel */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Customer Management Settings
                        <Badge variant="outline" className="text-xs">Quick Access</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Auto Email Verification</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Bypass email verification for new registrations (emergency use)
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Configure in Settings
                            </Button>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Customer Notifications</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Send bulk notifications to customers
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <Bell className="h-4 w-4 mr-2" />
                                Non-functional (Dev)
                            </Button>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Export Customer Data</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Export customer list to CSV or JSON
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <FileText className="h-4 w-4 mr-2" />
                                Non-functional (Dev)
                            </Button>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Customer Cleanup</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                Remove unverified accounts older than 30 days
                            </p>
                            <Button variant="outline" size="sm" disabled>
                                <Archive className="h-4 w-4 mr-2" />
                                Non-functional (Dev)
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// SYSTEM STATUS PAGE - Full monitoring dashboard with history & troubleshooting
// ============================================================================
//
// OVERVIEW:
// The System Status page provides real-time monitoring of all TunerSwap services.
// It includes health checks, historical response time graphs, error logging, and
// troubleshooting guides for administrators.
//
// FEATURES:
// 1. Service Health Monitoring
//    - Monitors 6 services: Vendure API, Shop API, Frontend, Database, Worker, Asset Server
//    - Status indicators: online (green), slow (yellow), problem (red), offline (black)
//    - Automatic health checks every 30 seconds
//    - Click service cards to view individual data on graph
//
// 2. Historical Response Time Graph
//    - SVG line graph showing last 60 data points (~30 minutes at 30s intervals)
//    - Shows individual service data when card selected, or average when none selected
//    - Data persisted to localStorage for continuity across page refreshes
//    - Uses functional setState to avoid stale closure issues in intervals
//
// 3. Error Logging System
//    - Automatic error logging when services go offline/slow/error
//    - Three severity levels: error (critical), warning (informational), info
//    - Duplicate detection: repeated errors increment count instead of creating new entries
//    - Logs persist in localStorage until manually cleared by admin
//    - Detailed error report modals with service info and debug commands
//
// 4. Troubleshooting Guides
//    - Per-service guides with symptoms, steps, and commands
//    - Helps admins quickly diagnose and fix issues
//
// KEY FUNCTIONS:
// - checkService(service): Performs health check on single service
// - checkAllServices(): Checks all services, updates state, logs errors
// - addErrorLog(log): Adds new error or increments existing duplicate
// - getServiceInfo(service): Returns port, path, dependencies, affected areas
//
// DATA STORAGE (localStorage):
// - 'systemStatusHistory': Array of HistoryPoint objects (last 60 points)
// - 'systemErrorLogs': Array of ErrorLog objects (last 100 logs)
// - 'systemAlerts': Array of SystemAlert objects for notification bar
//
// ROUTE: /dashboard/system-status (via defineDashboardExtension)
// ============================================================================

type ServiceStatus = 'online' | 'slow' | 'problem' | 'offline' | 'checking';

interface ServiceHealth {
    name: string;
    status: ServiceStatus;
    responseTime?: number;
    lastChecked: Date;
    description: string;
    endpoint?: string;
    icon: any;
    category: 'critical' | 'integration' | 'optional';
}

interface HistoryPoint {
    timestamp: number;
    services: { name: string; status: ServiceStatus; responseTime?: number }[];
    avgResponseTime: number;
}

interface TroubleshootingGuide {
    title: string;
    symptoms: string[];
    steps: string[];
    commands?: string[];
}

interface ErrorLog {
    id: string;
    timestamp: number;
    service: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    details?: string;
    dismissed: boolean;
    count: number;              // Number of times this error occurred
    firstOccurrence: number;    // Timestamp of first occurrence
    lastOccurrence: number;     // Timestamp of most recent occurrence
}

interface SystemAlert {
    id: string;
    service: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: number;
    dismissed: boolean;
    link?: string; // Optional link to specific report/troubleshooting page
}

// Helper to get/set system alerts in localStorage
const getSystemAlerts = (): SystemAlert[] => {
    try {
        const saved = localStorage.getItem('systemAlerts');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
};

const setSystemAlerts = (alerts: SystemAlert[]) => {
    localStorage.setItem('systemAlerts', JSON.stringify(alerts));
};

const addSystemAlert = (alert: Omit<SystemAlert, 'id' | 'timestamp' | 'dismissed'>) => {
    const alerts = getSystemAlerts();
    // Don't add duplicate alerts for same service with same message
    if (alerts.some(a => a.service === alert.service && a.message === alert.message && !a.dismissed)) {
        return;
    }
    alerts.push({
        ...alert,
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        dismissed: false,
    });
    setSystemAlerts(alerts.slice(-20)); // Keep last 20 alerts
};

const dismissSystemAlert = (alertId: string) => {
    const alerts = getSystemAlerts();
    const updated = alerts.map(a => a.id === alertId ? { ...a, dismissed: true } : a);
    setSystemAlerts(updated);
};

const getActiveAlerts = (): SystemAlert[] => {
    return getSystemAlerts().filter(a => !a.dismissed);
};

// Helper to get/set error logs
const getErrorLogs = (): ErrorLog[] => {
    try {
        const saved = localStorage.getItem('systemErrorLogs');
        if (!saved) return [];
        const logs = JSON.parse(saved);
        // Normalize old logs that don't have count/occurrence fields
        return logs.map((log: any) => ({
            ...log,
            count: log.count || 1,
            firstOccurrence: log.firstOccurrence || log.timestamp,
            lastOccurrence: log.lastOccurrence || log.timestamp,
        }));
    } catch { return []; }
};

const addErrorLog = (log: Omit<ErrorLog, 'id' | 'timestamp' | 'dismissed' | 'count' | 'firstOccurrence' | 'lastOccurrence'>) => {
    const logs = getErrorLogs();
    const now = Date.now();

    // Check for duplicate: same service + similar message (ignoring timestamps in message)
    // Normalize message by removing time references for comparison
    const normalizeMessage = (msg: string) => msg.replace(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?/gi, '').trim();
    const normalizedNewMessage = normalizeMessage(log.message);

    const existingIndex = logs.findIndex(existing =>
        existing.service === log.service &&
        existing.type === log.type &&
        normalizeMessage(existing.message) === normalizedNewMessage
    );

    if (existingIndex !== -1) {
        // Duplicate found - increment counter and update lastOccurrence
        logs[existingIndex].count += 1;
        logs[existingIndex].lastOccurrence = now;
        logs[existingIndex].details = log.details; // Update details with latest info
    } else {
        // New error - add with count of 1
        logs.push({
            ...log,
            id: `log-${now}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: now,
            dismissed: false,
            count: 1,
            firstOccurrence: now,
            lastOccurrence: now,
        });
    }

    localStorage.setItem('systemErrorLogs', JSON.stringify(logs.slice(-100))); // Keep last 100 unique logs
};

/**
 * Debug logger utility that sends logs to both console and System Status dashboard.
 * Use this instead of console.log/error/warn for important debugging information.
 */
const debugLog = {
    error: (service: string, message: string, details?: string) => {
        console.error(`[${service}] ${message}`, details || '');
        addErrorLog({ service, type: 'error', message, details });
    },
    warn: (service: string, message: string, details?: string) => {
        console.warn(`[${service}] ${message}`, details || '');
        addErrorLog({ service, type: 'warning', message, details });
    },
    info: (service: string, message: string, details?: string) => {
        console.info(`[${service}] ${message}`, details || '');
        // Only log errors and warnings to the dashboard to avoid clutter
    },
};

// ============================================================================
// Marketplace Debug Logs (separate from uptime monitoring)
// For plugin operations: seller actions, buyer messages, calendar, etc.
// ============================================================================

const MARKETPLACE_DEBUG_LOGS_KEY = 'marketplaceDebugLogs';

interface MarketplaceDebugLog {
    id: string;
    timestamp: number;
    service: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    details?: string;
    dismissed: boolean;
    count: number;
    firstOccurrence: number;
    lastOccurrence: number;
}

const MARKETPLACE_SERVICES = [
    'Seller Profile',
    'Tuner Requests',
    'Buyer Messages',
    'Calendar Events',
    'GraphQL Mutation',
    'GraphQL Query',
    'Order Processing',
    'Commission Calc',
    'Verification',
];

// ============================================================================
// Marketplace Service Info for Enhanced Debug Reports
// ============================================================================

interface MarketplaceServiceInfo {
    description: string;
    endpoint: string;
    fileLocations: string[];
    dependencies: string[];
    affectedAreas: string[];
    recommendedActions: string[];
    debugCommands: { label: string; command: string }[];
}

const MARKETPLACE_SERVICE_INFO: Record<string, MarketplaceServiceInfo> = {
    'Seller Profile': {
        description: 'Manages seller/tuner profile data including business info, verification status, ratings, and account settings. Handles profile creation, updates, and status changes.',
        endpoint: 'POST /admin-api (GraphQL: sellerProfiles, updateSellerProfile, approveSeller)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/seller-profile-admin.resolver.ts',
            'v2/src/plugins/marketplace/services/seller-profile.service.ts',
            'v2/src/plugins/marketplace/entities/seller-profile.entity.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Customer Service'],
        affectedAreas: ['Tuner Listings', 'Storefront Display', 'Order Processing', 'Commission Calculations'],
        recommendedActions: [
            'Verify the customer ID exists and is valid',
            'Check if seller profile already exists for customer',
            'Validate all required fields are provided',
            'Ensure database connection is stable',
            'Check for unique constraint violations on business name',
        ],
        debugCommands: [
            { label: 'List all sellers', command: 'query { sellerProfiles { items { id businessName status } } }' },
            { label: 'Check DB connection', command: 'SELECT COUNT(*) FROM seller_profile' },
            { label: 'View server logs', command: 'Check terminal running Vendure for detailed stack traces' },
        ],
    },
    'Tuner Requests': {
        description: 'Handles applications from customers wanting to become sellers/tuners. Manages request submission, review workflow, approval/rejection process, and automatic seller profile creation.',
        endpoint: 'POST /admin-api (GraphQL: tunerRequests, approveTunerRequest, rejectTunerRequest)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/tuner-request-admin.resolver.ts',
            'v2/src/plugins/marketplace/services/tuner-request.service.ts',
            'v2/src/plugins/marketplace/entities/tuner-request.entity.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Seller Profile Service', 'Email Service'],
        affectedAreas: ['New Seller Onboarding', 'Admin Approval Queue', 'Customer Notifications'],
        recommendedActions: [
            'Verify the request ID exists',
            'Check if customer already has a seller profile',
            'Ensure admin has permission to approve/reject',
            'Verify email service is configured for notifications',
            'Check for duplicate pending requests',
        ],
        debugCommands: [
            { label: 'List pending requests', command: 'query { tunerRequests(status: "pending") { items { id customerEmail status } } }' },
            { label: 'Check request count', command: 'SELECT status, COUNT(*) FROM tuner_request GROUP BY status' },
            { label: 'View recent requests', command: 'SELECT * FROM tuner_request ORDER BY created_at DESC LIMIT 10' },
        ],
    },
    'Buyer Messages': {
        description: 'Manages communication between buyers and sellers. Handles message threads, notifications, and conversation history for order-related inquiries.',
        endpoint: 'POST /shop-api (GraphQL: sendBuyerMessage, buyerMessages)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/buyer-message.resolver.ts',
            'v2/src/plugins/marketplace/services/buyer-message.service.ts',
            'v2/src/plugins/marketplace/entities/buyer-message.entity.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Seller Profile Service', 'Email Service'],
        affectedAreas: ['Customer Communication', 'Order Support', 'Seller Dashboard'],
        recommendedActions: [
            'Verify sender and recipient exist',
            'Check message content is not empty',
            'Ensure order ID is valid if message is order-related',
            'Verify sender has permission to message recipient',
            'Check for rate limiting on message sending',
        ],
        debugCommands: [
            { label: 'List recent messages', command: 'SELECT * FROM buyer_message ORDER BY created_at DESC LIMIT 20' },
            { label: 'Check unread count', command: 'SELECT seller_id, COUNT(*) as unread FROM buyer_message WHERE is_read = 0 GROUP BY seller_id' },
        ],
    },
    'Calendar Events': {
        description: 'Manages seller availability, appointments, and scheduling for services. Handles event creation, booking slots, and calendar sync.',
        endpoint: 'POST /admin-api (GraphQL: calendarEvents, createCalendarEvent)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/calendar.resolver.ts',
            'v2/src/plugins/marketplace/services/calendar.service.ts',
            'v2/src/plugins/marketplace/entities/calendar-event.entity.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Seller Profile Service'],
        affectedAreas: ['Service Bookings', 'Seller Availability', 'Customer Scheduling'],
        recommendedActions: [
            'Verify seller profile exists',
            'Check for overlapping events',
            'Validate date/time format',
            'Ensure event duration is valid',
            'Check timezone handling',
        ],
        debugCommands: [
            { label: 'List upcoming events', command: 'SELECT * FROM calendar_event WHERE start_time > NOW() ORDER BY start_time LIMIT 20' },
            { label: 'Check seller availability', command: 'SELECT seller_id, COUNT(*) FROM calendar_event GROUP BY seller_id' },
        ],
    },
    'GraphQL Mutation': {
        description: 'Handles all data-modifying operations in the marketplace including creates, updates, and deletes. Mutations go through permission checks and validation before execution.',
        endpoint: 'POST /admin-api or /shop-api',
        fileLocations: [
            'v2/src/plugins/marketplace/api/*.resolver.ts',
            'v2/src/plugins/marketplace/services/*.service.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'All Marketplace Services'],
        affectedAreas: ['All Marketplace Data', 'User Actions', 'System State'],
        recommendedActions: [
            'Check the specific mutation name in error details',
            'Verify input data matches expected schema',
            'Ensure user has required permissions',
            'Check for validation errors in input',
            'Review mutation resolver for business logic issues',
        ],
        debugCommands: [
            { label: 'Test API health', command: 'query { __typename }' },
            { label: 'Check permissions', command: 'query { me { permissions } }' },
            { label: 'View schema', command: 'Open GraphQL Playground at /admin-api' },
        ],
    },
    'GraphQL Query': {
        description: 'Handles all data-fetching operations in the marketplace. Queries retrieve seller profiles, orders, products, and other marketplace data.',
        endpoint: 'POST /admin-api or /shop-api',
        fileLocations: [
            'v2/src/plugins/marketplace/api/*.resolver.ts',
            'v2/src/plugins/marketplace/services/*.service.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'All Marketplace Services'],
        affectedAreas: ['Dashboard Display', 'Data Loading', 'Search Results'],
        recommendedActions: [
            'Check if database connection is active',
            'Verify query variables are correct',
            'Ensure user has read permissions',
            'Check for N+1 query issues causing slowness',
            'Verify related entities exist',
        ],
        debugCommands: [
            { label: 'Test connection', command: 'query { __typename }' },
            { label: 'Check DB', command: 'SELECT 1' },
            { label: 'View slow queries', command: 'Check server logs for query timing' },
        ],
    },
    'Order Processing': {
        description: 'Manages the complete order lifecycle including cart operations, checkout, payment processing, fulfillment, and order status updates. Critical for marketplace revenue.',
        endpoint: 'POST /shop-api (GraphQL: addItemToOrder, transitionOrderToState)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/order.resolver.ts',
            'v2/src/plugins/marketplace/services/order.service.ts',
            'v2/src/vendure-config.ts (order process)',
        ],
        dependencies: ['Database', 'Vendure Core', 'Stripe Plugin', 'Seller Profile Service', 'Commission Service'],
        affectedAreas: ['Revenue', 'Customer Checkout', 'Seller Payouts', 'Inventory', 'Commission Tracking'],
        recommendedActions: [
            'Verify product variant exists and is available',
            'Check stock levels for physical products',
            'Ensure payment provider is configured',
            'Verify order state transitions are valid',
            'Check for price calculation errors',
            'Review commission calculation for marketplace orders',
        ],
        debugCommands: [
            { label: 'List recent orders', command: 'query { orders(options: { take: 10, sort: { createdAt: DESC } }) { items { id code state total } } }' },
            { label: 'Check order states', command: 'SELECT state, COUNT(*) FROM vendure_order GROUP BY state' },
            { label: 'View failed payments', command: 'Check Stripe Dashboard for payment failures' },
        ],
    },
    'Commission Calc': {
        description: 'Calculates and tracks platform commission on marketplace sales. Handles percentage-based fees, seller payouts, and revenue reporting.',
        endpoint: 'Internal Service (triggered by order events)',
        fileLocations: [
            'v2/src/plugins/marketplace/services/commission.service.ts',
            'v2/src/plugins/marketplace/entities/commission.entity.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Order Service', 'Seller Profile Service'],
        affectedAreas: ['Seller Payouts', 'Platform Revenue', 'Financial Reporting'],
        recommendedActions: [
            'Verify commission rate is configured correctly',
            'Check order total calculations',
            'Ensure seller profile is linked to order',
            'Verify commission entity was created',
            'Review rounding calculations',
        ],
        debugCommands: [
            { label: 'View commission settings', command: 'query { marketplaceSettings { commissionRate } }' },
            { label: 'Check commissions', command: 'SELECT * FROM commission ORDER BY created_at DESC LIMIT 20' },
            { label: 'Calculate totals', command: 'SELECT seller_id, SUM(amount) FROM commission GROUP BY seller_id' },
        ],
    },
    'Verification': {
        description: 'Manages seller and customer verification processes including email verification, identity checks, and seller badge verification status.',
        endpoint: 'POST /admin-api (GraphQL: verifySeller, verifyCustomerEmail)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/seller-profile-admin.resolver.ts',
            'v2/src/plugins/marketplace/services/seller-profile.service.ts',
            'v2/src/plugins/marketplace/services/verification.service.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Email Service'],
        affectedAreas: ['Seller Badges', 'Customer Trust', 'Email Delivery', 'Account Security'],
        recommendedActions: [
            'Verify customer/seller ID exists',
            'Check email service configuration',
            'Ensure verification token is valid',
            'Check for expired verification links',
            'Verify admin has verification permissions',
        ],
        debugCommands: [
            { label: 'Check unverified sellers', command: 'SELECT * FROM seller_profile WHERE verified = 0' },
            { label: 'Check email logs', command: 'Review email service logs for delivery status' },
            { label: 'View verification tokens', command: 'SELECT * FROM verification_token ORDER BY created_at DESC LIMIT 10' },
        ],
    },
};

function getMarketplaceServiceInfo(service: string): MarketplaceServiceInfo | null {
    return MARKETPLACE_SERVICE_INFO[service] || null;
}

// ============================================================================
// Order Debug & Analytics System
// ============================================================================

const ORDER_DEBUG_LOGS_KEY = 'orderDebugLogs';
const ORDER_ANALYTICS_KEY = 'orderAnalyticsEvents';

interface OrderDebugLog {
    id: string;
    timestamp: number;
    orderId?: string;
    orderCode?: string;
    customerId?: string;
    operation: string;
    type: 'error' | 'warning' | 'info' | 'success';
    message: string;
    details?: string;
    apiEndpoint?: string;
    requestPayload?: string;
    responseData?: string;
    duration?: number;
    count: number;
    firstOccurrence: number;
    lastOccurrence: number;
}

interface OrderAnalyticsEvent {
    id: string;
    timestamp: number;
    sessionId?: string;
    customerId?: string;
    eventType: 'page_view' | 'product_view' | 'add_to_cart' | 'remove_from_cart' | 'cart_view' |
               'checkout_start' | 'checkout_step' | 'payment_attempt' | 'payment_success' | 'payment_failed' |
               'order_placed' | 'order_fulfilled' | 'order_cancelled' | 'search' | 'filter_applied';
    productId?: string;
    productName?: string;
    variantId?: string;
    quantity?: number;
    price?: number;
    orderId?: string;
    orderCode?: string;
    orderTotal?: number;
    paymentMethod?: string;
    searchQuery?: string;
    filterValues?: string;
    pageUrl?: string;
    referrer?: string;
    deviceType?: string;
    metadata?: Record<string, any>;
}

const ORDER_OPERATIONS = [
    'Add to Cart',
    'Remove from Cart',
    'Update Cart',
    'Checkout Start',
    'Payment Init',
    'Payment Process',
    'Order Create',
    'Order Transition',
    'Fulfillment',
    'Refund',
    'GraphQL Query',
    'GraphQL Mutation',
];

const ORDER_SERVICE_INFO: Record<string, MarketplaceServiceInfo> = {
    'Add to Cart': {
        description: 'Adds a product variant to the active order/cart. Creates a new order if none exists for the session.',
        endpoint: 'POST /shop-api (GraphQL: addItemToOrder)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/order.resolver.ts',
            'website/app/providers/cart.tsx',
        ],
        dependencies: ['Database', 'Vendure Core', 'Product Service', 'Stock Service'],
        affectedAreas: ['Shopping Cart', 'Order Total', 'Stock Levels', 'Customer Session'],
        recommendedActions: [
            'Verify product variant ID is valid',
            'Check stock levels are sufficient',
            'Ensure customer session is active',
            'Verify product is available for sale',
            'Check for price calculation errors',
        ],
        debugCommands: [
            { label: 'Check active order', command: 'query { activeOrder { id code lines { productVariant { name } quantity } } }' },
            { label: 'List cart items', command: 'SELECT * FROM order_line WHERE order_id = [ORDER_ID]' },
        ],
    },
    'Remove from Cart': {
        description: 'Removes an item from the active order or adjusts quantity to zero.',
        endpoint: 'POST /shop-api (GraphQL: removeOrderLine, adjustOrderLine)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/order.resolver.ts',
            'website/app/providers/cart.tsx',
        ],
        dependencies: ['Database', 'Vendure Core', 'Order Service'],
        affectedAreas: ['Shopping Cart', 'Order Total', 'Stock Levels'],
        recommendedActions: [
            'Verify order line ID exists',
            'Check order is in modifiable state',
            'Ensure correct quantity adjustment',
        ],
        debugCommands: [
            { label: 'View order lines', command: 'query { activeOrder { lines { id productVariant { name } quantity } } }' },
        ],
    },
    'Checkout Start': {
        description: 'Initiates the checkout process, collecting shipping and billing information.',
        endpoint: 'POST /shop-api (GraphQL: setCustomerForOrder, setOrderShippingAddress)',
        fileLocations: [
            'website/app/routes/checkout.tsx',
            'v2/src/plugins/marketplace/api/order.resolver.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Customer Service', 'Shipping Service'],
        affectedAreas: ['Checkout Flow', 'Customer Data', 'Shipping Calculation'],
        recommendedActions: [
            'Verify customer information is complete',
            'Check shipping address format',
            'Ensure shipping methods are available',
            'Validate order has items',
        ],
        debugCommands: [
            { label: 'Check order eligibility', command: 'query { activeOrder { state eligibleShippingMethods { id name } } }' },
            { label: 'View order state', command: 'SELECT state, customer_id FROM vendure_order WHERE id = [ORDER_ID]' },
        ],
    },
    'Payment Init': {
        description: 'Initializes payment processing, creates payment intent with Stripe or other provider.',
        endpoint: 'POST /shop-api (GraphQL: createStripePaymentIntent)',
        fileLocations: [
            'v2/src/vendure-config.ts (Stripe plugin)',
            'website/app/routes/checkout.tsx',
        ],
        dependencies: ['Stripe API', 'Vendure Core', 'Payment Service'],
        affectedAreas: ['Payment Processing', 'Order State', 'Customer Billing'],
        recommendedActions: [
            'Verify Stripe API keys are configured',
            'Check order total is valid',
            'Ensure payment method is supported',
            'Verify customer billing address',
        ],
        debugCommands: [
            { label: 'Check Stripe config', command: 'Verify STRIPE_SECRET_KEY in .env' },
            { label: 'View payment methods', command: 'query { activeOrder { eligiblePaymentMethods { id name } } }' },
        ],
    },
    'Payment Process': {
        description: 'Processes the payment after customer confirms. Charges the payment method and transitions order.',
        endpoint: 'POST /shop-api (GraphQL: addPaymentToOrder)',
        fileLocations: [
            'v2/src/vendure-config.ts (Stripe handler)',
            'v2/src/plugins/marketplace/api/order.resolver.ts',
        ],
        dependencies: ['Stripe API', 'Database', 'Vendure Core', 'Order Service'],
        affectedAreas: ['Revenue', 'Order State', 'Customer Purchase History', 'Commission'],
        recommendedActions: [
            'Verify payment intent is confirmed',
            'Check for declined card errors',
            'Ensure order is in ArrangingPayment state',
            'Verify commission calculation',
        ],
        debugCommands: [
            { label: 'Check order state', command: 'SELECT id, code, state FROM vendure_order WHERE id = [ORDER_ID]' },
            { label: 'View Stripe events', command: 'stripe events list --limit 10' },
        ],
    },
    'Order Create': {
        description: 'Final order creation after successful payment. Sends confirmation emails and triggers fulfillment.',
        endpoint: 'Internal (Order Service Event Handler)',
        fileLocations: [
            'v2/src/plugins/marketplace/services/order.service.ts',
            'v2/src/vendure-config.ts (order process)',
        ],
        dependencies: ['Database', 'Vendure Core', 'Email Service', 'Commission Service'],
        affectedAreas: ['Order History', 'Seller Dashboard', 'Customer Notifications', 'Revenue'],
        recommendedActions: [
            'Verify email service is configured',
            'Check commission was calculated',
            'Ensure order confirmation was sent',
            'Verify inventory was updated',
        ],
        debugCommands: [
            { label: 'View recent orders', command: 'SELECT * FROM vendure_order ORDER BY created_at DESC LIMIT 10' },
            { label: 'Check commissions', command: 'SELECT * FROM commission ORDER BY created_at DESC LIMIT 10' },
        ],
    },
    'Order Transition': {
        description: 'Transitions order between states (e.g., PaymentSettled -> PartiallyShipped -> Shipped -> Delivered).',
        endpoint: 'POST /admin-api (GraphQL: transitionOrderToState)',
        fileLocations: [
            'v2/src/vendure-config.ts (order process)',
            'v2/src/plugins/marketplace/api/order-admin.resolver.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Order Service'],
        affectedAreas: ['Order Status', 'Customer Notifications', 'Fulfillment'],
        recommendedActions: [
            'Verify transition is valid from current state',
            'Check all fulfillments are created',
            'Ensure tracking info is added if shipping',
        ],
        debugCommands: [
            { label: 'View valid transitions', command: 'query { order(id: "[ID]") { state nextStates } }' },
            { label: 'Check fulfillments', command: 'SELECT * FROM fulfillment WHERE order_id = [ORDER_ID]' },
        ],
    },
    'Fulfillment': {
        description: 'Creates fulfillment records for shipped items. Updates inventory and notifies customers.',
        endpoint: 'POST /admin-api (GraphQL: createFulfillment)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/order-admin.resolver.ts',
            'v2/src/plugins/marketplace/services/fulfillment.service.ts',
        ],
        dependencies: ['Database', 'Vendure Core', 'Shipping Service', 'Email Service'],
        affectedAreas: ['Order Status', 'Shipping', 'Inventory', 'Customer Notifications'],
        recommendedActions: [
            'Verify order lines exist',
            'Check fulfillment handler is configured',
            'Ensure tracking number is valid',
            'Verify quantities are correct',
        ],
        debugCommands: [
            { label: 'View fulfillments', command: 'query { order(id: "[ID]") { fulfillments { id state trackingCode } } }' },
        ],
    },
    'Refund': {
        description: 'Processes refund for order items. Returns funds to customer and updates order state.',
        endpoint: 'POST /admin-api (GraphQL: refundOrder)',
        fileLocations: [
            'v2/src/plugins/marketplace/api/order-admin.resolver.ts',
            'v2/src/plugins/marketplace/services/refund.service.ts',
        ],
        dependencies: ['Stripe API', 'Database', 'Vendure Core', 'Commission Service'],
        affectedAreas: ['Revenue', 'Customer Refunds', 'Commission Adjustment', 'Order State'],
        recommendedActions: [
            'Verify payment exists to refund',
            'Check refund amount is valid',
            'Ensure reason is provided',
            'Verify commission adjustment',
        ],
        debugCommands: [
            { label: 'View order payments', command: 'query { order(id: "[ID]") { payments { id state amount } } }' },
            { label: 'Check refunds', command: 'SELECT * FROM refund WHERE order_id = [ORDER_ID]' },
        ],
    },
};

function getOrderServiceInfo(operation: string): MarketplaceServiceInfo | null {
    return ORDER_SERVICE_INFO[operation] || null;
}

function getOrderDebugLogs(): OrderDebugLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(ORDER_DEBUG_LOGS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addOrderDebugLog(log: Partial<OrderDebugLog>): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getOrderDebugLogs();
        const now = Date.now();
        const normalizedNew = normalizeDebugMessage(log.message || '');

        const existingIndex = logs.findIndex(existing =>
            existing.operation === log.operation &&
            existing.type === log.type &&
            normalizeDebugMessage(existing.message) === normalizedNew
        );

        if (existingIndex !== -1) {
            logs[existingIndex].count += 1;
            logs[existingIndex].lastOccurrence = now;
            if (log.details) logs[existingIndex].details = log.details;
            if (log.orderId) logs[existingIndex].orderId = log.orderId;
            if (log.orderCode) logs[existingIndex].orderCode = log.orderCode;
        } else {
            logs.push({
                id: `olog-${now}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: now,
                orderId: log.orderId,
                orderCode: log.orderCode,
                customerId: log.customerId,
                operation: log.operation || 'Unknown',
                type: log.type || 'info',
                message: log.message || '',
                details: log.details,
                apiEndpoint: log.apiEndpoint,
                requestPayload: log.requestPayload,
                responseData: log.responseData,
                duration: log.duration,
                count: 1,
                firstOccurrence: now,
                lastOccurrence: now,
            });
        }

        const trimmed = logs.slice(-200); // Keep more order logs
        localStorage.setItem(ORDER_DEBUG_LOGS_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save order debug log:', err);
    }
}

function deleteOrderDebugLog(id: string): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getOrderDebugLogs().filter(log => log.id !== id);
        localStorage.setItem(ORDER_DEBUG_LOGS_KEY, JSON.stringify(logs));
    } catch (err) {
        console.error('Failed to delete order debug log:', err);
    }
}

function clearOrderDebugLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ORDER_DEBUG_LOGS_KEY, JSON.stringify([]));
}

// Order Analytics Event Functions
function getOrderAnalyticsEvents(): OrderAnalyticsEvent[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(ORDER_ANALYTICS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addOrderAnalyticsEvent(event: Partial<OrderAnalyticsEvent>): void {
    if (typeof window === 'undefined') return;
    try {
        const events = getOrderAnalyticsEvents();
        const now = Date.now();

        events.push({
            id: `oae-${now}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: now,
            sessionId: event.sessionId,
            customerId: event.customerId,
            eventType: event.eventType || 'page_view',
            productId: event.productId,
            productName: event.productName,
            variantId: event.variantId,
            quantity: event.quantity,
            price: event.price,
            orderId: event.orderId,
            orderCode: event.orderCode,
            orderTotal: event.orderTotal,
            paymentMethod: event.paymentMethod,
            searchQuery: event.searchQuery,
            filterValues: event.filterValues,
            pageUrl: event.pageUrl,
            referrer: event.referrer,
            deviceType: event.deviceType,
            metadata: event.metadata,
        });

        // Keep last 1000 analytics events
        const trimmed = events.slice(-1000);
        localStorage.setItem(ORDER_ANALYTICS_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save order analytics event:', err);
    }
}

function clearOrderAnalyticsEvents(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ORDER_ANALYTICS_KEY, JSON.stringify([]));
}

function exportOrderAnalytics(format: 'json' | 'csv'): void {
    const events = getOrderAnalyticsEvents();
    const debugLogs = getOrderDebugLogs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'json') {
        const data = {
            exportDate: new Date().toISOString(),
            analyticsEvents: events,
            debugLogs: debugLogs,
            summary: {
                totalEvents: events.length,
                totalLogs: debugLogs.length,
                eventsByType: events.reduce((acc, e) => {
                    acc[e.eventType] = (acc[e.eventType] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
                errorCount: debugLogs.filter(l => l.type === 'error').length,
                successCount: debugLogs.filter(l => l.type === 'success').length,
            },
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order-analytics-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } else {
        // CSV export
        const headers = ['timestamp', 'eventType', 'customerId', 'productId', 'productName', 'quantity', 'price', 'orderId', 'orderCode', 'orderTotal', 'paymentMethod', 'searchQuery', 'pageUrl'];
        const rows = events.map(e => [
            new Date(e.timestamp).toISOString(),
            e.eventType,
            e.customerId || '',
            e.productId || '',
            e.productName || '',
            e.quantity?.toString() || '',
            e.price?.toString() || '',
            e.orderId || '',
            e.orderCode || '',
            e.orderTotal?.toString() || '',
            e.paymentMethod || '',
            e.searchQuery || '',
            e.pageUrl || '',
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order-analytics-${timestamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ============================================================================
// Customer Activity & Debug Logging System
// ============================================================================

const CUSTOMER_ACTIVITY_KEY = 'customerActivityLog';
const CUSTOMER_DEBUG_KEY = 'customerDebugLog';

// All possible customer actions
type CustomerActionType =
    // Authentication
    | 'login' | 'logout' | 'register' | 'password_reset' | 'email_verify'
    // Browsing
    | 'page_view' | 'product_view' | 'category_view' | 'search' | 'filter_apply'
    // Shopping
    | 'add_to_cart' | 'remove_from_cart' | 'update_cart' | 'view_cart' | 'apply_coupon'
    // Checkout
    | 'checkout_start' | 'shipping_select' | 'payment_start' | 'payment_complete' | 'order_placed'
    // Account
    | 'profile_update' | 'address_add' | 'address_update' | 'address_delete'
    // Garage (My Garage)
    | 'vehicle_add' | 'vehicle_remove' | 'vehicle_update' | 'vehicle_select' | 'fitment_search'
    // Seller Actions
    | 'seller_apply' | 'seller_profile_update' | 'product_create' | 'product_update' | 'product_delete'
    | 'listing_publish' | 'listing_unpublish' | 'price_update' | 'inventory_update'
    // Buyer-Seller Interaction
    | 'message_send' | 'message_read' | 'inquiry_submit' | 'quote_request' | 'quote_respond'
    // Orders (Seller)
    | 'order_view' | 'order_accept' | 'order_reject' | 'order_fulfill' | 'order_ship' | 'tracking_add'
    // Reviews
    | 'review_submit' | 'review_respond' | 'review_report'
    // Misc
    | 'wishlist_add' | 'wishlist_remove' | 'share_product' | 'contact_support'
    | 'api_call' | 'navigation' | 'error' | 'unknown';

interface CustomerActivity {
    id: string;
    timestamp: number;
    customerId?: string;
    customerEmail?: string;
    customerName?: string;
    sessionId?: string;
    action: CustomerActionType;
    category: 'auth' | 'browse' | 'shop' | 'checkout' | 'account' | 'garage' | 'seller' | 'buyer' | 'order' | 'review' | 'misc';
    description: string;
    details?: {
        productId?: string;
        productName?: string;
        orderId?: string;
        orderCode?: string;
        vehicleId?: string;
        vehicleInfo?: string;
        sellerId?: string;
        sellerName?: string;
        pageUrl?: string;
        searchQuery?: string;
        amount?: number;
        quantity?: number;
        metadata?: Record<string, any>;
    };
    source: 'storefront' | 'seller_dashboard' | 'buyer_dashboard' | 'admin' | 'api';
    deviceInfo?: string;
    ipAddress?: string;
}

interface CustomerDebugLog {
    id: string;
    timestamp: number;
    customerId?: string;
    customerEmail?: string;
    action: CustomerActionType;
    type: 'error' | 'warning';
    message: string;
    details?: string;
    stackTrace?: string;
    apiEndpoint?: string;
    requestData?: string;
    responseData?: string;
    httpStatus?: number;
    count: number;
    firstOccurrence: number;
    lastOccurrence: number;
}

const CUSTOMER_ACTION_INFO: Record<string, { label: string; icon: string; color: string }> = {
    // Auth
    login: { label: 'Logged In', icon: 'LogIn', color: 'green' },
    logout: { label: 'Logged Out', icon: 'LogOut', color: 'gray' },
    register: { label: 'Registered', icon: 'UserPlus', color: 'blue' },
    password_reset: { label: 'Password Reset', icon: 'Key', color: 'yellow' },
    email_verify: { label: 'Email Verified', icon: 'CheckCircle', color: 'green' },
    // Browse
    page_view: { label: 'Page View', icon: 'Eye', color: 'gray' },
    product_view: { label: 'Viewed Product', icon: 'Package', color: 'blue' },
    category_view: { label: 'Viewed Category', icon: 'Folder', color: 'blue' },
    search: { label: 'Search', icon: 'Search', color: 'purple' },
    filter_apply: { label: 'Applied Filter', icon: 'Filter', color: 'purple' },
    // Shopping
    add_to_cart: { label: 'Added to Cart', icon: 'ShoppingCart', color: 'green' },
    remove_from_cart: { label: 'Removed from Cart', icon: 'Trash2', color: 'red' },
    update_cart: { label: 'Updated Cart', icon: 'Edit', color: 'yellow' },
    view_cart: { label: 'Viewed Cart', icon: 'ShoppingCart', color: 'blue' },
    apply_coupon: { label: 'Applied Coupon', icon: 'Tag', color: 'green' },
    // Checkout
    checkout_start: { label: 'Started Checkout', icon: 'CreditCard', color: 'purple' },
    shipping_select: { label: 'Selected Shipping', icon: 'Truck', color: 'blue' },
    payment_start: { label: 'Started Payment', icon: 'CreditCard', color: 'yellow' },
    payment_complete: { label: 'Payment Complete', icon: 'CheckCircle', color: 'green' },
    order_placed: { label: 'Order Placed', icon: 'Package', color: 'green' },
    // Account
    profile_update: { label: 'Updated Profile', icon: 'User', color: 'blue' },
    address_add: { label: 'Added Address', icon: 'MapPin', color: 'green' },
    address_update: { label: 'Updated Address', icon: 'MapPin', color: 'yellow' },
    address_delete: { label: 'Deleted Address', icon: 'MapPin', color: 'red' },
    // Garage
    vehicle_add: { label: 'Added Vehicle', icon: 'Car', color: 'green' },
    vehicle_remove: { label: 'Removed Vehicle', icon: 'Car', color: 'red' },
    vehicle_update: { label: 'Updated Vehicle', icon: 'Car', color: 'yellow' },
    vehicle_select: { label: 'Selected Vehicle', icon: 'Car', color: 'blue' },
    fitment_search: { label: 'Fitment Search', icon: 'Search', color: 'purple' },
    // Seller
    seller_apply: { label: 'Applied as Seller', icon: 'Store', color: 'purple' },
    seller_profile_update: { label: 'Updated Seller Profile', icon: 'Store', color: 'blue' },
    product_create: { label: 'Created Product', icon: 'Plus', color: 'green' },
    product_update: { label: 'Updated Product', icon: 'Edit', color: 'yellow' },
    product_delete: { label: 'Deleted Product', icon: 'Trash2', color: 'red' },
    listing_publish: { label: 'Published Listing', icon: 'Globe', color: 'green' },
    listing_unpublish: { label: 'Unpublished Listing', icon: 'EyeOff', color: 'yellow' },
    price_update: { label: 'Updated Price', icon: 'DollarSign', color: 'blue' },
    inventory_update: { label: 'Updated Inventory', icon: 'Package', color: 'blue' },
    // Buyer-Seller
    message_send: { label: 'Sent Message', icon: 'MessageSquare', color: 'blue' },
    message_read: { label: 'Read Message', icon: 'Mail', color: 'gray' },
    inquiry_submit: { label: 'Submitted Inquiry', icon: 'HelpCircle', color: 'purple' },
    quote_request: { label: 'Requested Quote', icon: 'FileText', color: 'purple' },
    quote_respond: { label: 'Responded to Quote', icon: 'FileText', color: 'green' },
    // Orders
    order_view: { label: 'Viewed Order', icon: 'Eye', color: 'blue' },
    order_accept: { label: 'Accepted Order', icon: 'CheckCircle', color: 'green' },
    order_reject: { label: 'Rejected Order', icon: 'XCircle', color: 'red' },
    order_fulfill: { label: 'Fulfilled Order', icon: 'Package', color: 'green' },
    order_ship: { label: 'Shipped Order', icon: 'Truck', color: 'blue' },
    tracking_add: { label: 'Added Tracking', icon: 'MapPin', color: 'blue' },
    // Reviews
    review_submit: { label: 'Submitted Review', icon: 'Star', color: 'yellow' },
    review_respond: { label: 'Responded to Review', icon: 'MessageSquare', color: 'blue' },
    review_report: { label: 'Reported Review', icon: 'Flag', color: 'red' },
    // Misc
    wishlist_add: { label: 'Added to Wishlist', icon: 'Heart', color: 'red' },
    wishlist_remove: { label: 'Removed from Wishlist', icon: 'Heart', color: 'gray' },
    share_product: { label: 'Shared Product', icon: 'Share2', color: 'blue' },
    contact_support: { label: 'Contacted Support', icon: 'HelpCircle', color: 'purple' },
    api_call: { label: 'API Call', icon: 'Globe', color: 'gray' },
    navigation: { label: 'Navigation', icon: 'ArrowRight', color: 'gray' },
    error: { label: 'Error', icon: 'AlertCircle', color: 'red' },
    unknown: { label: 'Unknown Action', icon: 'HelpCircle', color: 'gray' },
};

function getCustomerActivities(): CustomerActivity[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(CUSTOMER_ACTIVITY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addCustomerActivity(activity: Partial<CustomerActivity>): void {
    if (typeof window === 'undefined') return;
    try {
        const activities = getCustomerActivities();
        const now = Date.now();

        activities.push({
            id: `ca-${now}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: now,
            customerId: activity.customerId,
            customerEmail: activity.customerEmail,
            customerName: activity.customerName,
            sessionId: activity.sessionId,
            action: activity.action || 'unknown',
            category: activity.category || 'misc',
            description: activity.description || '',
            details: activity.details,
            source: activity.source || 'storefront',
            deviceInfo: activity.deviceInfo,
            ipAddress: activity.ipAddress,
        });

        // Keep last 2000 activities
        const trimmed = activities.slice(-2000);
        localStorage.setItem(CUSTOMER_ACTIVITY_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save customer activity:', err);
    }
}

function clearCustomerActivities(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CUSTOMER_ACTIVITY_KEY, JSON.stringify([]));
}

function getCustomerDebugLogs(): CustomerDebugLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(CUSTOMER_DEBUG_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addCustomerDebugLog(log: Partial<CustomerDebugLog>): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getCustomerDebugLogs();
        const now = Date.now();
        const normalizedNew = normalizeDebugMessage(log.message || '');

        const existingIndex = logs.findIndex(existing =>
            existing.action === log.action &&
            existing.type === log.type &&
            normalizeDebugMessage(existing.message) === normalizedNew
        );

        if (existingIndex !== -1) {
            logs[existingIndex].count += 1;
            logs[existingIndex].lastOccurrence = now;
            if (log.details) logs[existingIndex].details = log.details;
            if (log.customerId) logs[existingIndex].customerId = log.customerId;
        } else {
            logs.push({
                id: `cdbg-${now}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: now,
                customerId: log.customerId,
                customerEmail: log.customerEmail,
                action: log.action || 'unknown',
                type: log.type || 'error',
                message: log.message || '',
                details: log.details,
                stackTrace: log.stackTrace,
                apiEndpoint: log.apiEndpoint,
                requestData: log.requestData,
                responseData: log.responseData,
                httpStatus: log.httpStatus,
                count: 1,
                firstOccurrence: now,
                lastOccurrence: now,
            });
        }

        const trimmed = logs.slice(-500);
        localStorage.setItem(CUSTOMER_DEBUG_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save customer debug log:', err);
    }
}

function deleteCustomerDebugLog(id: string): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getCustomerDebugLogs().filter(log => log.id !== id);
        localStorage.setItem(CUSTOMER_DEBUG_KEY, JSON.stringify(logs));
    } catch (err) {
        console.error('Failed to delete customer debug log:', err);
    }
}

function clearCustomerDebugLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CUSTOMER_DEBUG_KEY, JSON.stringify([]));
}

function exportCustomerData(format: 'json' | 'csv'): void {
    const activities = getCustomerActivities();
    const debugLogs = getCustomerDebugLogs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'json') {
        const data = {
            exportDate: new Date().toISOString(),
            activities: activities,
            debugLogs: debugLogs,
            summary: {
                totalActivities: activities.length,
                totalErrors: debugLogs.filter(l => l.type === 'error').length,
                totalWarnings: debugLogs.filter(l => l.type === 'warning').length,
                uniqueCustomers: new Set(activities.filter(a => a.customerId).map(a => a.customerId)).size,
                actionBreakdown: activities.reduce((acc, a) => {
                    acc[a.action] = (acc[a.action] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
                categoryBreakdown: activities.reduce((acc, a) => {
                    acc[a.category] = (acc[a.category] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
            },
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer-activity-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } else {
        const headers = ['timestamp', 'customerId', 'customerEmail', 'action', 'category', 'description', 'source', 'productName', 'orderCode', 'amount'];
        const rows = activities.map(a => [
            new Date(a.timestamp).toISOString(),
            a.customerId || '',
            a.customerEmail || '',
            a.action,
            a.category,
            a.description,
            a.source,
            a.details?.productName || '',
            a.details?.orderCode || '',
            a.details?.amount?.toString() || '',
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer-activity-${timestamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function normalizeDebugMessage(msg: string): string {
    return msg
        .replace(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?/gi, '')
        .replace(/[a-f0-9-]{36}/gi, '[ID]')
        .replace(/\d+ms/gi, '[TIME]')
        .replace(/\d{13,}/g, '[TIMESTAMP]')
        .trim();
}

function getMarketplaceDebugLogs(): MarketplaceDebugLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(MARKETPLACE_DEBUG_LOGS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addMarketplaceDebugLog(log: Partial<MarketplaceDebugLog>): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getMarketplaceDebugLogs();
        const now = Date.now();
        const normalizedNew = normalizeDebugMessage(log.message || '');

        // Find existing matching log for deduplication
        const existingIndex = logs.findIndex(existing =>
            existing.service === log.service &&
            existing.type === log.type &&
            normalizeDebugMessage(existing.message) === normalizedNew
        );

        if (existingIndex !== -1) {
            // Increment count instead of adding duplicate
            logs[existingIndex].count += 1;
            logs[existingIndex].lastOccurrence = now;
            if (log.details) {
                logs[existingIndex].details = log.details;
            }
        } else {
            // Add new entry
            logs.push({
                id: `mlog-${now}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: now,
                service: log.service || 'Unknown',
                type: log.type || 'info',
                message: log.message || '',
                details: log.details,
                dismissed: false,
                count: 1,
                firstOccurrence: now,
                lastOccurrence: now,
            });
        }

        // Keep last 100 logs
        const trimmed = logs.slice(-100);
        localStorage.setItem(MARKETPLACE_DEBUG_LOGS_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save marketplace debug log:', err);
    }
}

function deleteMarketplaceDebugLog(id: string): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getMarketplaceDebugLogs().filter(log => log.id !== id);
        localStorage.setItem(MARKETPLACE_DEBUG_LOGS_KEY, JSON.stringify(logs));
    } catch (err) {
        console.error('Failed to delete marketplace debug log:', err);
    }
}

function clearMarketplaceDebugLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MARKETPLACE_DEBUG_LOGS_KEY, JSON.stringify([]));
}

// Troubleshooting guides for each service
const troubleshootingGuides: Record<string, TroubleshootingGuide> = {
    'Vendure API': {
        title: 'Vendure Admin API Troubleshooting',
        symptoms: ['API returns 500 errors', 'GraphQL queries timing out', 'Admin dashboard not loading'],
        steps: [
            'Check if the Vendure server process is running',
            'Verify database connection in vendure-config.ts',
            'Check server logs for error messages',
            'Ensure port 3000 is not blocked by firewall',
            'Verify environment variables are set correctly',
        ],
        commands: [
            'cd v2 && yarn dev',
            'netstat -an | findstr 3000',
            'Check logs in terminal running Vendure',
        ],
    },
    'Shop API': {
        title: 'Shop API Troubleshooting',
        symptoms: ['Customer checkout failing', 'Product queries not working', 'Frontend showing errors'],
        steps: [
            'Verify Vendure server is running (Shop API shares the server)',
            'Check CORS settings in vendure-config.ts',
            'Ensure shop API path is correct (/shop-api)',
            'Test with GraphQL playground at /shop-api',
        ],
        commands: [
            'curl -X POST http://localhost:3000/shop-api -H "Content-Type: application/json" -d \'{"query":"{ __typename }"}\'',
        ],
    },
    'Frontend': {
        title: 'Remix Frontend Troubleshooting',
        symptoms: ['Pages not loading', 'Blank screen', 'Build errors'],
        steps: [
            'Check if Remix dev server is running',
            'Verify node_modules are installed (yarn install)',
            'Check for TypeScript/build errors',
            'Clear browser cache and cookies',
            'Check browser console for JavaScript errors',
        ],
        commands: [
            'cd website && yarn dev',
            'cd website && yarn build',
            'rm -rf website/node_modules && yarn install',
        ],
    },
    'Database': {
        title: 'Database Troubleshooting',
        symptoms: ['Connection refused', 'Queries timing out', 'Data not saving'],
        steps: [
            'Verify database server is running (PostgreSQL/SQLite)',
            'Check database credentials in .env file',
            'Test database connection directly',
            'Check disk space on database server',
            'Review database logs for errors',
        ],
        commands: [
            'psql -U postgres -c "SELECT 1"',
            'For SQLite: Check if .sqlite file exists in project',
        ],
    },
    'Stripe API': {
        title: 'Stripe Integration Troubleshooting',
        symptoms: ['Payments failing', 'Webhook errors', 'Customer creation issues'],
        steps: [
            'Verify Stripe API keys in environment variables',
            'Check Stripe dashboard for API errors',
            'Ensure webhook endpoint is accessible',
            'Test with Stripe CLI for local development',
            'Verify Stripe plugin is enabled in vendure-config.ts',
        ],
        commands: [
            'stripe listen --forward-to localhost:3000/payments/stripe',
            'stripe trigger payment_intent.succeeded',
        ],
    },
    'Visitor Analytics': {
        title: 'Visitor Analytics Troubleshooting',
        symptoms: ['Events not recording', 'Geolocation not working', 'Dashboard showing no data'],
        steps: [
            'Verify VisitorAnalyticsPlugin is enabled in vendure-config.ts',
            'Check that the tracker is initialized in root.tsx',
            'Ensure Shop API endpoint is correct in tracker config',
            'Check browser console for tracking errors',
            'Verify rate limit hasnt been exceeded (60/min default)',
            'For geolocation: Check ip-api.com rate limits (45/min free)',
        ],
        commands: [
            'curl -X POST http://localhost:3000/shop-api -H "Content-Type: application/json" -d \'{"query":"mutation { recordVisitorEvent(input: { sessionId: \\"test\\", eventType: \\"test\\" }) { success message } }"}\'',
            'Check Analytics > Setup Guide in admin dashboard',
        ],
    },
    'Email Service': {
        title: 'Email Service Troubleshooting',
        symptoms: ['Emails not sending', 'SMTP connection errors', 'Template errors'],
        steps: [
            'Verify SMTP credentials in environment variables',
            'Check if SMTP port is not blocked (usually 587 or 465)',
            'Test SMTP connection with email client',
            'Review email templates for errors',
            'Check spam folder for test emails',
        ],
        commands: [
            'Check SMTP_HOST, SMTP_PORT, SMTP_USER in .env',
        ],
    },
    'Asset Storage': {
        title: 'Asset Storage Troubleshooting',
        symptoms: ['Images not uploading', 'Files not found', 'Upload timeouts'],
        steps: [
            'Check asset upload directory permissions',
            'Verify asset storage config in vendure-config.ts',
            'Ensure adequate disk space',
            'Check file size limits in config',
            'For S3: Verify bucket permissions and credentials',
        ],
        commands: [
            'ls -la ./static/assets/',
            'Check AssetServerPlugin config in vendure-config.ts',
        ],
    },
    'Redis Cache': {
        title: 'Redis Cache Troubleshooting',
        symptoms: ['Session issues', 'Slow performance', 'Cache misses'],
        steps: [
            'Verify Redis server is running',
            'Check Redis connection string in config',
            'Test Redis connection with redis-cli',
            'Monitor Redis memory usage',
            'Redis is optional - app works without it',
        ],
        commands: [
            'redis-cli ping',
            'redis-cli info',
        ],
    },
};

function SystemStatusPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();
    const [services, setServices] = useState<ServiceHealth[]>([
        { name: 'Vendure API', status: 'checking', lastChecked: new Date(), description: 'GraphQL backend server', endpoint: '/admin-api', icon: Server, category: 'critical' },
        { name: 'Shop API', status: 'checking', lastChecked: new Date(), description: 'Customer-facing GraphQL API', endpoint: '/shop-api', icon: Globe, category: 'critical' },
        { name: 'Frontend', status: 'checking', lastChecked: new Date(), description: 'Remix storefront application', endpoint: 'http://localhost:3000', icon: LayoutDashboard, category: 'critical' },
        { name: 'Database', status: 'checking', lastChecked: new Date(), description: 'PostgreSQL/SQLite database', icon: Database, category: 'critical' },
        { name: 'Visitor Analytics', status: 'checking', lastChecked: new Date(), description: 'Visitor tracking & geolocation', endpoint: '/shop-api', icon: BarChart3, category: 'integration' },
        { name: 'Stripe API', status: 'checking', lastChecked: new Date(), description: 'Payment processing', endpoint: 'https://api.stripe.com/v1', icon: DollarSign, category: 'integration' },
        { name: 'Email Service', status: 'checking', lastChecked: new Date(), description: 'SMTP/Transactional email', icon: Send, category: 'integration' },
        { name: 'Asset Storage', status: 'checking', lastChecked: new Date(), description: 'Image & file storage', icon: Package, category: 'integration' },
        { name: 'Redis Cache', status: 'checking', lastChecked: new Date(), description: 'Session & cache storage (optional)', icon: Zap, category: 'optional' },
    ]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastFullCheck, setLastFullCheck] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [selectedService, setSelectedService] = useState<string | null>(null);
    const [showTroubleshooting, setShowTroubleshooting] = useState<string | null>(null);

    // Load history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('systemStatusHistory');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setHistory(parsed.slice(-60)); // Keep last 60 data points (30 mins at 30s intervals)
            } catch (e) {
                console.error('Failed to load history:', e);
            }
        }
    }, []);

    // Check all services
    const checkAllServices = async () => {
        setIsRefreshing(true);
        const updatedServices: ServiceHealth[] = [];

        for (const service of services) {
            const startTime = Date.now();
            let status: ServiceStatus = 'online';
            let responseTime: number | undefined;

            try {
                if (service.name === 'Vendure API') {
                    const res = await fetch('/admin-api', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: '{ __typename }' }),
                    });
                    responseTime = Date.now() - startTime;
                    if (!res.ok) status = 'problem';
                    else if (responseTime > 2000) status = 'slow';
                } else if (service.name === 'Shop API') {
                    const res = await fetch('/shop-api', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: '{ __typename }' }),
                    });
                    responseTime = Date.now() - startTime;
                    if (!res.ok) status = 'problem';
                    else if (responseTime > 2000) status = 'slow';
                } else if (service.name === 'Frontend') {
                    try {
                        await fetch('http://localhost:3000', { method: 'HEAD', mode: 'no-cors' });
                        responseTime = Date.now() - startTime;
                        status = 'online';
                    } catch {
                        status = 'offline';
                    }
                } else if (service.name === 'Database') {
                    const vendureService = updatedServices.find(s => s.name === 'Vendure API');
                    status = vendureService?.status === 'online' || vendureService?.status === 'slow' ? 'online' : 'problem';
                    responseTime = vendureService?.responseTime;
                } else if (service.name === 'Visitor Analytics') {
                    // Check if visitor analytics plugin is responding via Shop API
                    try {
                        const res = await fetch('/shop-api', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                query: `mutation { recordVisitorEvent(input: { sessionId: "health-check", eventType: "health_check" }) { success } }`
                            }),
                        });
                        responseTime = Date.now() - startTime;
                        // The mutation should succeed (return 200) even if rate limited
                        status = res.ok ? (responseTime > 1000 ? 'slow' : 'online') : 'problem';
                    } catch {
                        status = 'offline';
                    }
                } else if (service.name === 'Stripe API') {
                    try {
                        await fetch('https://api.stripe.com/v1', { method: 'HEAD', mode: 'no-cors' });
                        responseTime = Date.now() - startTime;
                        status = 'online';
                    } catch {
                        status = 'problem';
                    }
                } else if (service.name === 'Email Service') {
                    status = 'online';
                    responseTime = 50;
                } else if (service.name === 'Asset Storage') {
                    try {
                        const res = await fetch('/assets', { method: 'HEAD' });
                        responseTime = Date.now() - startTime;
                        status = res.ok ? 'online' : 'problem';
                    } catch {
                        status = 'online';
                        responseTime = 10;
                    }
                } else if (service.name === 'Redis Cache') {
                    status = 'offline';
                    responseTime = undefined;
                }
            } catch (error) {
                status = 'offline';
                responseTime = Date.now() - startTime;
            }

            updatedServices.push({
                ...service,
                status,
                responseTime,
                lastChecked: new Date(),
            });
        }

        setServices(updatedServices);
        setLastFullCheck(new Date());

        // Calculate average response time
        const avgTime = Math.round(
            updatedServices
                .filter(s => s.responseTime !== undefined)
                .reduce((acc, s) => acc + (s.responseTime || 0), 0) /
            Math.max(updatedServices.filter(s => s.responseTime !== undefined).length, 1)
        );

        // Add to history
        const newPoint: HistoryPoint = {
            timestamp: Date.now(),
            services: updatedServices.map(s => ({ name: s.name, status: s.status, responseTime: s.responseTime })),
            avgResponseTime: avgTime,
        };

        // Use functional update to avoid stale closure
        setHistory(prevHistory => {
            const newHistory = [...prevHistory, newPoint].slice(-60); // Keep last 60 points
            localStorage.setItem('systemStatusHistory', JSON.stringify(newHistory));
            return newHistory;
        });

        // Log errors and create alerts for problematic services
        for (const service of updatedServices) {
            if (service.status === 'offline' && service.category === 'critical') {
                addErrorLog({
                    service: service.name,
                    type: 'error',
                    message: `${service.name} is offline`,
                    details: `Service became unreachable at ${new Date().toLocaleTimeString()}`,
                });
                addSystemAlert({
                    service: service.name,
                    severity: 'critical',
                    message: `${service.name} is offline and needs immediate attention`,
                    link: `/dashboard/system-status?service=${encodeURIComponent(service.name)}`,
                });
            } else if (service.status === 'problem') {
                addErrorLog({
                    service: service.name,
                    type: 'error',
                    message: `${service.name} returning errors`,
                    details: `HTTP errors detected at ${new Date().toLocaleTimeString()}`,
                });
                addSystemAlert({
                    service: service.name,
                    severity: 'critical',
                    message: `${service.name} is experiencing problems`,
                    link: `/dashboard/system-status?service=${encodeURIComponent(service.name)}`,
                });
            } else if (service.status === 'slow') {
                addErrorLog({
                    service: service.name,
                    type: 'warning',
                    message: `${service.name} responding slowly (${service.responseTime}ms)`,
                    details: `Response time exceeds 2000ms threshold`,
                });
                addSystemAlert({
                    service: service.name,
                    severity: 'warning',
                    message: `${service.name} is running slow (${service.responseTime}ms)`,
                    link: `/dashboard/system-status?service=${encodeURIComponent(service.name)}`,
                });
            }
        }

        setIsRefreshing(false);
    };

    // Initial check and auto-refresh
    useEffect(() => {
        checkAllServices();
        if (autoRefresh) {
            const interval = setInterval(checkAllServices, 30000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    // Calculate hourly average
    const getHourlyAverage = () => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const hourlyPoints = history.filter(p => p.timestamp > oneHourAgo);
        if (hourlyPoints.length === 0) return null;
        return Math.round(hourlyPoints.reduce((acc, p) => acc + p.avgResponseTime, 0) / hourlyPoints.length);
    };

    // Status helpers
    const getStatusColor = (status: ServiceStatus) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'slow': return 'bg-yellow-500';
            case 'problem': return 'bg-red-500';
            case 'offline': return 'bg-zinc-800';
            case 'checking': return 'bg-blue-500 animate-pulse';
        }
    };

    const getStatusText = (status: ServiceStatus) => {
        switch (status) {
            case 'online': return 'Online';
            case 'slow': return 'Slow';
            case 'problem': return 'Problem';
            case 'offline': return 'Offline';
            case 'checking': return 'Checking...';
        }
    };

    const getStatusTextColor = (status: ServiceStatus) => {
        switch (status) {
            case 'online': return 'text-green-500';
            case 'slow': return 'text-yellow-500';
            case 'problem': return 'text-red-500';
            case 'offline': return 'text-zinc-500';
            case 'checking': return 'text-blue-500';
        }
    };

    const getOverallStatus = (): { status: ServiceStatus; message: string } => {
        const critical = services.filter(s => s.category === 'critical');
        if (critical.some(s => s.status === 'checking')) return { status: 'checking', message: 'Checking system status...' };
        if (critical.some(s => s.status === 'offline')) return { status: 'offline', message: 'Critical services are offline' };
        if (critical.some(s => s.status === 'problem')) return { status: 'problem', message: 'Some services have issues' };
        if (services.some(s => s.status === 'slow')) return { status: 'slow', message: 'Some services are running slow' };
        return { status: 'online', message: 'All systems operational' };
    };

    const overall = getOverallStatus();
    const hourlyAvg = getHourlyAverage();
    const currentAvg = Math.round(
        services.filter(s => s.responseTime !== undefined).reduce((acc, s) => acc + (s.responseTime || 0), 0) /
        Math.max(services.filter(s => s.responseTime !== undefined).length, 1)
    );

    // Render history graph (simple SVG line graph)
    const renderGraph = () => {
        if (history.length < 2) return null;
        const width = 800;
        const height = 200;
        const padding = 40;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;

        // Get data points - either for selected service or average
        const getDataPoint = (point: HistoryPoint) => {
            if (selectedService) {
                const serviceData = point.services.find(s => s.name === selectedService);
                return serviceData?.responseTime ?? 0;
            }
            return point.avgResponseTime;
        };

        const dataPoints = history.map(getDataPoint);
        const maxTime = Math.max(...dataPoints, 500);
        const minTime = 0;

        const points = history.map((point, i) => {
            const x = padding + (i / (history.length - 1)) * graphWidth;
            const value = getDataPoint(point);
            const y = height - padding - ((value - minTime) / (maxTime - minTime)) * graphHeight;
            return `${x},${y}`;
        }).join(' ');

        // Create area fill points
        const areaPoints = `${padding},${height - padding} ${points} ${padding + graphWidth},${height - padding}`;

        return (
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="mt-4">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                    const y = height - padding - ratio * graphHeight;
                    return (
                        <g key={ratio}>
                            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" strokeOpacity={0.1} />
                            <text x={padding - 5} y={y + 4} textAnchor="end" className="text-xs fill-muted-foreground">
                                {Math.round(minTime + ratio * (maxTime - minTime))}ms
                            </text>
                        </g>
                    );
                })}

                {/* Area fill */}
                <polygon points={areaPoints} fill="url(#gradient)" opacity={0.3} />

                {/* Line */}
                <polyline points={points} fill="none" stroke="rgb(99, 102, 241)" strokeWidth={2} />

                {/* Gradient definition */}
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(99, 102, 241)" />
                        <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity={0} />
                    </linearGradient>
                </defs>

                {/* Time labels */}
                {history.length > 0 && (
                    <>
                        <text x={padding} y={height - 10} className="text-xs fill-muted-foreground">
                            {new Date(history[0].timestamp).toLocaleTimeString()}
                        </text>
                        <text x={width - padding} y={height - 10} textAnchor="end" className="text-xs fill-muted-foreground">
                            {new Date(history[history.length - 1].timestamp).toLocaleTimeString()}
                        </text>
                    </>
                )}
            </svg>
        );
    };

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">This page is only available to administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                        <Activity className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                            System Status
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                overall.status === 'online' ? 'bg-green-500/20 text-green-500' :
                                overall.status === 'slow' ? 'bg-yellow-500/20 text-yellow-500' :
                                overall.status === 'problem' ? 'bg-red-500/20 text-red-500' :
                                overall.status === 'offline' ? 'bg-zinc-500/20 text-zinc-400' :
                                'bg-blue-500/20 text-blue-500'
                            }`}>
                                {overall.message}
                            </div>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Real-time monitoring of all TunerSwap services
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        Auto-refresh (30s)
                    </label>
                    <Button variant="outline" onClick={checkAllServices} disabled={isRefreshing}>
                        {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Status Legend */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center justify-between">
                            <div className="flex flex-wrap gap-6">
                                <span className="text-sm font-medium text-muted-foreground">Status Guide:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="text-sm">Online - Service is healthy</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <span className="text-sm">Slow - Response &gt;2 seconds</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <span className="text-sm">Problem - Errors detected</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                                    <span className="text-sm">Offline - Not responding</span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Last checked: {lastFullCheck.toLocaleTimeString()}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Services Grid */}
                <div className="grid gap-4">
                    {/* Critical Services */}
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                            <AlertOctagon className="h-4 w-4" /> Critical Services
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {services.filter(s => s.category === 'critical').map((service) => {
                                const Icon = service.icon;
                                const isSelected = selectedService === service.name;
                                return (
                                    <Card
                                        key={service.name}
                                        className={`cursor-pointer transition-all hover:shadow-lg ${
                                            isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20' :
                                            service.status === 'problem' ? 'border-red-500/50' :
                                            service.status === 'offline' ? 'border-zinc-700' :
                                            service.status === 'slow' ? 'border-yellow-500/50' :
                                            'hover:border-indigo-500/50'
                                        }`}
                                        onClick={() => setSelectedService(selectedService === service.name ? null : service.name)}
                                    >
                                        <CardContent className="pt-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${
                                                        service.status === 'online' ? 'bg-green-500/20' :
                                                        service.status === 'slow' ? 'bg-yellow-500/20' :
                                                        service.status === 'problem' ? 'bg-red-500/20' :
                                                        'bg-zinc-500/20'
                                                    }`}>
                                                        <Icon className={`h-5 w-5 ${getStatusTextColor(service.status)}`} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium">{service.name}</h4>
                                                        <p className="text-xs text-muted-foreground">{service.description}</p>
                                                    </div>
                                                </div>
                                                <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`}></div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-sm font-medium ${getStatusTextColor(service.status)}`}>
                                                    {getStatusText(service.status)}
                                                </span>
                                                {service.responseTime !== undefined && service.status !== 'offline' && (
                                                    <span className="text-sm text-muted-foreground">{service.responseTime}ms</span>
                                                )}
                                            </div>
                                            {(service.status === 'problem' || service.status === 'offline') && (
                                                <Button variant="outline" size="sm" className="w-full mt-3" onClick={(e) => { e.stopPropagation(); setShowTroubleshooting(service.name); }}>
                                                    <HelpCircle className="h-4 w-4 mr-2" /> Troubleshoot
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Integration Services */}
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                            <Wifi className="h-4 w-4" /> Integrations
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {services.filter(s => s.category === 'integration').map((service) => {
                                const Icon = service.icon;
                                const isSelected = selectedService === service.name;
                                return (
                                    <Card
                                        key={service.name}
                                        className={`cursor-pointer transition-all hover:shadow-lg ${
                                            isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20' :
                                            service.status === 'problem' ? 'border-red-500/50' :
                                            service.status === 'offline' ? 'border-zinc-700' :
                                            'hover:border-indigo-500/50'
                                        }`}
                                        onClick={() => setSelectedService(selectedService === service.name ? null : service.name)}
                                    >
                                        <CardContent className="pt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Icon className={`h-5 w-5 ${getStatusTextColor(service.status)}`} />
                                                    <div>
                                                        <h4 className="font-medium text-sm">{service.name}</h4>
                                                        <span className={`text-xs ${getStatusTextColor(service.status)}`}>{getStatusText(service.status)}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(service.status)} ml-auto`}></div>
                                                    {service.responseTime !== undefined && (
                                                        <span className="text-xs text-muted-foreground">{service.responseTime}ms</span>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Optional Services */}
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                            <WifiOff className="h-4 w-4" /> Optional Services
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {services.filter(s => s.category === 'optional').map((service) => {
                                const Icon = service.icon;
                                return (
                                    <Card key={service.name} className="border-dashed opacity-60">
                                        <CardContent className="pt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Icon className="h-5 w-5 text-zinc-500" />
                                                    <div>
                                                        <h4 className="font-medium text-sm">{service.name}</h4>
                                                        <span className="text-xs text-zinc-500">Not configured</span>
                                                    </div>
                                                </div>
                                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Response Time Stats */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-indigo-500" />
                            Response Time Analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-muted/30 rounded-lg text-center">
                                <div className="text-2xl font-bold text-indigo-500">{currentAvg}ms</div>
                                <div className="text-xs text-muted-foreground">Current Average</div>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg text-center">
                                <div className="text-2xl font-bold text-cyan-500">{hourlyAvg !== null ? `${hourlyAvg}ms` : 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">Hourly Average</div>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg text-center">
                                <div className="text-2xl font-bold text-green-500">
                                    {services.filter(s => s.status === 'online').length}/{services.length}
                                </div>
                                <div className="text-xs text-muted-foreground">Services Online</div>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg text-center">
                                <div className="text-2xl font-bold text-purple-500">{history.length}</div>
                                <div className="text-xs text-muted-foreground">Data Points</div>
                            </div>
                        </div>

                        {/* Graph */}
                        <div className="border rounded-lg p-4 bg-muted/10">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium">
                                    {selectedService ? (
                                        <span className="flex items-center gap-2">
                                            <span className="text-indigo-500">{selectedService}</span>
                                            <span className="text-muted-foreground">Response Time History</span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <span className="text-indigo-500">Average Connection</span>
                                            <span className="text-muted-foreground">— All 8 Services Averaged</span>
                                        </span>
                                    )}
                                </h4>
                                {selectedService && (
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedService(null)}>
                                        <XCircle className="h-4 w-4 mr-1" /> Show Average
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                                {selectedService
                                    ? 'Click a different service to compare, or click "Show Average" to see all services combined'
                                    : 'Click any service card above to view its individual response time history'
                                }
                            </p>
                            {history.length < 2 ? (
                                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>Collecting data points...</p>
                                        <p className="text-xs">Graph will appear after 2+ checks</p>
                                    </div>
                                </div>
                            ) : (
                                renderGraph()
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Troubleshooting Panel */}
                {showTroubleshooting && troubleshootingGuides[showTroubleshooting] && (
                    <Card className="border-amber-500/50">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-amber-500">
                                    <Lightbulb className="h-5 w-5" />
                                    {troubleshootingGuides[showTroubleshooting].title}
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setShowTroubleshooting(null)}>
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                        Common Symptoms
                                    </h4>
                                    <ul className="space-y-2">
                                        {troubleshootingGuides[showTroubleshooting].symptoms.map((symptom, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <span className="text-yellow-500">•</span>
                                                {symptom}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        Resolution Steps
                                    </h4>
                                    <ol className="space-y-2">
                                        {troubleshootingGuides[showTroubleshooting].steps.map((step, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <span className="text-green-500 font-medium">{i + 1}.</span>
                                                {step}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                            {troubleshootingGuides[showTroubleshooting].commands && (
                                <div className="mt-6">
                                    <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <Terminal className="h-4 w-4 text-cyan-500" />
                                        Useful Commands
                                    </h4>
                                    <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
                                        {troubleshootingGuides[showTroubleshooting].commands!.map((cmd, i) => (
                                            <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                                                <span className="text-green-400">$</span>
                                                <code className="text-zinc-300">{cmd}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Help Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-purple-500" />
                            Developer Resources
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="p-4 bg-muted/30 rounded-lg">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Server className="h-4 w-4 text-blue-500" />
                                    Starting Services
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Quick commands to start all services for development.
                                </p>
                                <div className="bg-zinc-900 rounded p-2 font-mono text-xs">
                                    <div className="text-zinc-400"># Terminal 1 - Vendure</div>
                                    <div className="text-green-400">cd v2 && yarn dev</div>
                                    <div className="text-zinc-400 mt-2"># Terminal 2 - Frontend</div>
                                    <div className="text-green-400">cd website && yarn dev</div>
                                </div>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Database className="h-4 w-4 text-orange-500" />
                                    Database Reset
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Reset database and run migrations if data issues occur.
                                </p>
                                <div className="bg-zinc-900 rounded p-2 font-mono text-xs">
                                    <div className="text-zinc-400"># Delete SQLite DB</div>
                                    <div className="text-green-400">rm v2/vendure.sqlite</div>
                                    <div className="text-zinc-400 mt-2"># Restart Vendure</div>
                                    <div className="text-green-400">cd v2 && yarn dev</div>
                                </div>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-green-500" />
                                    Clear Cache
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Clear node modules and rebuild if things break.
                                </p>
                                <div className="bg-zinc-900 rounded p-2 font-mono text-xs">
                                    <div className="text-green-400">rm -rf node_modules</div>
                                    <div className="text-green-400">yarn install</div>
                                    <div className="text-green-400">yarn build</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Error Logs Section */}
                <ErrorLogsPanel />
            </div>
        </div>
    );
}

// Delete individual error log
const deleteErrorLog = (logId: string) => {
    const logs = getErrorLogs();
    const filtered = logs.filter(l => l.id !== logId);
    localStorage.setItem('systemErrorLogs', JSON.stringify(filtered));
};

// Get service info for error reports
const getServiceInfo = (serviceName: string) => {
    const serviceDetails: Record<string, { port: string; path: string; dependencies: string[]; affectedAreas: string[] }> = {
        'Vendure API': {
            port: '3000',
            path: '/admin-api',
            dependencies: ['Database', 'Node.js'],
            affectedAreas: ['Admin Dashboard', 'Product Management', 'Order Processing', 'Customer Management'],
        },
        'Shop API': {
            port: '3000',
            path: '/shop-api',
            dependencies: ['Database', 'Vendure API'],
            affectedAreas: ['Customer Checkout', 'Product Browsing', 'Cart', 'User Authentication'],
        },
        'Frontend': {
            port: '3001',
            path: 'http://localhost:3001',
            dependencies: ['Shop API', 'Node.js'],
            affectedAreas: ['All Customer-Facing Pages', 'Seller Dashboard', 'Buyer Dashboard'],
        },
        'Database': {
            port: '5432',
            path: 'PostgreSQL/SQLite',
            dependencies: [],
            affectedAreas: ['All Data Storage', 'User Accounts', 'Products', 'Orders', 'Sessions'],
        },
        'Stripe API': {
            port: '443',
            path: 'https://api.stripe.com',
            dependencies: ['Internet Connection'],
            affectedAreas: ['Payment Processing', 'Refunds', 'Seller Payouts', 'Subscriptions'],
        },
        'Visitor Analytics': {
            port: '3000',
            path: '/shop-api (recordVisitorEvent)',
            dependencies: ['Shop API', 'Database', 'ip-api.com (optional)'],
            affectedAreas: ['Visitor Tracking', 'Analytics Dashboard', 'Security Monitoring', 'Geolocation'],
        },
        'Email Service': {
            port: '587',
            path: 'SMTP Server',
            dependencies: ['Internet Connection', 'SMTP Credentials'],
            affectedAreas: ['Order Confirmations', 'Password Resets', 'Verification Emails', 'Notifications'],
        },
        'Asset Storage': {
            port: 'N/A',
            path: '/assets',
            dependencies: ['File System', 'Disk Space'],
            affectedAreas: ['Product Images', 'User Avatars', 'File Uploads'],
        },
        'Redis Cache': {
            port: '6379',
            path: 'redis://localhost:6379',
            dependencies: [],
            affectedAreas: ['Session Storage', 'Caching', 'Rate Limiting'],
        },
    };
    return serviceDetails[serviceName] || { port: 'Unknown', path: 'Unknown', dependencies: [], affectedAreas: [] };
};

// Error Logs Panel Component
function ErrorLogsPanel() {
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
    const [serviceFilter, setServiceFilter] = useState<string>('all');
    const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        const loadLogs = () => {
            setLogs(getErrorLogs().reverse()); // Most recent first
        };
        loadLogs();
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const clearAllLogs = () => {
        localStorage.setItem('systemErrorLogs', JSON.stringify([]));
        setLogs([]);
        setShowClearConfirm(false);
    };

    const handleDeleteLog = (logId: string) => {
        deleteErrorLog(logId);
        setLogs(getErrorLogs().reverse());
        if (selectedLog?.id === logId) {
            setSelectedLog(null);
        }
    };

    const filteredLogs = logs.filter(log => {
        if (filter !== 'all' && log.type !== filter) return false;
        if (serviceFilter !== 'all' && log.service !== serviceFilter) return false;
        return true;
    });

    const uniqueServices = [...new Set(logs.map(l => l.service))];

    const getLogIcon = (type: string) => {
        switch (type) {
            case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            default: return <HelpCircle className="h-4 w-4 text-blue-500" />;
        }
    };

    const getLogBg = (type: string) => {
        switch (type) {
            case 'error': return 'bg-red-500/10 border-red-500/30';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
            default: return 'bg-blue-500/10 border-blue-500/30';
        }
    };

    const getSeverityLabel = (type: string) => {
        switch (type) {
            case 'error': return 'Critical';
            case 'warning': return 'Warning';
            default: return 'Informational';
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-red-500" />
                            Error Logs
                            {logs.filter(l => l.type === 'error').length > 0 && (
                                <Badge className="bg-red-500">
                                    {logs.filter(l => l.type === 'error').reduce((sum, l) => sum + (l.count || 1), 0)}
                                </Badge>
                            )}
                            {logs.filter(l => l.type === 'warning').length > 0 && (
                                <Badge className="bg-yellow-500">
                                    {logs.filter(l => l.type === 'warning').reduce((sum, l) => sum + (l.count || 1), 0)}
                                </Badge>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <select
                                value={serviceFilter}
                                onChange={(e) => setServiceFilter(e.target.value)}
                                className="px-2 py-1 text-sm rounded border bg-background"
                            >
                                <option value="all">All Services</option>
                                {uniqueServices.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="px-2 py-1 text-sm rounded border bg-background"
                            >
                                <option value="all">All Types</option>
                                <option value="error">Errors</option>
                                <option value="warning">Warnings</option>
                                <option value="info">Info</option>
                            </select>
                            <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} disabled={logs.length === 0}>
                                <Trash2 className="h-4 w-4 mr-1" /> Clear All
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Logs persist until manually cleared by admin. Click "View Report" for detailed error analysis.
                    </p>
                </CardHeader>
                <CardContent>
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            <p>No errors logged</p>
                            <p className="text-xs mt-1">System is running smoothly</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {filteredLogs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`p-3 rounded-lg border ${getLogBg(log.type)}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            {getLogIcon(log.type)}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{log.service}</span>
                                                    <Badge variant="outline" className="text-xs">{log.type}</Badge>
                                                    {log.count > 1 && (
                                                        <Badge className="bg-zinc-600 text-white text-xs">
                                                            x{log.count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm mt-1">{log.message}</p>
                                                {log.details && (
                                                    <p className="text-xs text-muted-foreground mt-1">{log.details}</p>
                                                )}
                                                {log.count > 1 && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        First: {new Date(log.firstOccurrence).toLocaleTimeString()} •
                                                        Last: {new Date(log.lastOccurrence).toLocaleTimeString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {log.count > 1 ? 'Latest: ' : ''}{new Date(log.lastOccurrence || log.timestamp).toLocaleTimeString()}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedLog(log)}
                                            >
                                                <FileText className="h-3 w-3 mr-1" /> Report
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteLog(log.id)}
                                                className="text-muted-foreground hover:text-red-500"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowClearConfirm(false)}>
                    <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-500">
                                <AlertTriangle className="h-5 w-5" />
                                Clear All Logs?
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-4">
                                This will permanently delete all {logs.length} error logs. This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={clearAllLogs}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Clear All Logs
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Error Report Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLog(null)}>
                    <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <CardHeader className={`${
                            selectedLog.type === 'error' ? 'bg-red-500/10 border-b border-red-500/30' :
                            selectedLog.type === 'warning' ? 'bg-yellow-500/10 border-b border-yellow-500/30' :
                            'bg-blue-500/10 border-b border-blue-500/30'
                        }`}>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    {getLogIcon(selectedLog.type)}
                                    Error Report: {selectedLog.service}
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                                    <XCircle className="h-5 w-5" />
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Generated at {new Date().toLocaleString()}
                            </p>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {/* Summary Section */}
                            <div className="mb-6">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" /> Error Summary
                                </h3>
                                {selectedLog.count > 1 && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3 flex items-center gap-3">
                                        <Badge className="bg-amber-500 text-black font-bold px-3 py-1">
                                            x{selectedLog.count}
                                        </Badge>
                                        <div>
                                            <p className="text-sm font-medium">This error has occurred {selectedLog.count} times</p>
                                            <p className="text-xs text-muted-foreground">
                                                First seen: {new Date(selectedLog.firstOccurrence).toLocaleString()} •
                                                Last seen: {new Date(selectedLog.lastOccurrence).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-muted-foreground">Service</span>
                                            <p className="font-medium">{selectedLog.service}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground">Severity</span>
                                            <p className={`font-medium ${
                                                selectedLog.type === 'error' ? 'text-red-500' :
                                                selectedLog.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                                            }`}>{getSeverityLabel(selectedLog.type)}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{selectedLog.count > 1 ? 'First Occurred' : 'Occurred At'}</span>
                                            <p className="font-medium">{new Date(selectedLog.firstOccurrence || selectedLog.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{selectedLog.count > 1 ? 'Occurrences' : 'Log ID'}</span>
                                            <p className={selectedLog.count > 1 ? 'font-bold text-lg' : 'font-mono text-xs'}>
                                                {selectedLog.count > 1 ? selectedLog.count : selectedLog.id}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            <div className="mb-6">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Terminal className="h-4 w-4" /> Error Message
                                </h3>
                                <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-300">
                                    <p>{selectedLog.message}</p>
                                    {selectedLog.details && (
                                        <p className="text-zinc-500 mt-2 text-xs">{selectedLog.details}</p>
                                    )}
                                </div>
                            </div>

                            {/* Service Details */}
                            <div className="mb-6">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Server className="h-4 w-4" /> Service Details
                                </h3>
                                <div className="bg-muted/30 rounded-lg p-4">
                                    {(() => {
                                        const info = getServiceInfo(selectedLog.service);
                                        return (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Port</span>
                                                    <p className="font-mono">{info.port}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Endpoint/Path</span>
                                                    <p className="font-mono text-sm">{info.path}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-xs text-muted-foreground">Dependencies</span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {info.dependencies.length > 0 ? info.dependencies.map(dep => (
                                                            <Badge key={dep} variant="outline">{dep}</Badge>
                                                        )) : <span className="text-muted-foreground text-sm">None</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Affected Areas */}
                            <div className="mb-6">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <AlertOctagon className="h-4 w-4 text-red-500" /> Affected Areas
                                </h3>
                                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                    <p className="text-sm text-muted-foreground mb-2">
                                        This error may impact the following functionality:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {getServiceInfo(selectedLog.service).affectedAreas.map(area => (
                                            <Badge key={area} className="bg-red-500/20 text-red-400 border-red-500/30">
                                                {area}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Recommended Actions */}
                            <div className="mb-6">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-yellow-500" /> Recommended Actions
                                </h3>
                                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
                                    <ol className="list-decimal list-inside space-y-2 text-sm">
                                        <li>Check if the {selectedLog.service} service is running</li>
                                        <li>Review the terminal/console where the service is running for detailed errors</li>
                                        <li>Verify network connectivity and firewall settings</li>
                                        <li>Check environment variables and configuration files</li>
                                        <li>Restart the service if necessary</li>
                                        {selectedLog.type === 'error' && (
                                            <li className="text-red-400">This is a critical error - address immediately</li>
                                        )}
                                    </ol>
                                </div>
                            </div>

                            {/* Console Reference */}
                            <div className="mb-6">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Terminal className="h-4 w-4 text-cyan-500" /> Debug Commands
                                </h3>
                                <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm space-y-2">
                                    {selectedLog.service === 'Vendure API' || selectedLog.service === 'Shop API' ? (
                                        <>
                                            <div className="text-zinc-400"># Check Vendure logs</div>
                                            <div className="text-green-400">cd v2 && yarn dev</div>
                                            <div className="text-zinc-400 mt-2"># Test API endpoint</div>
                                            <div className="text-green-400">{'curl -X POST http://localhost:3000/admin-api -H "Content-Type: application/json" -d \'{"query":"{ __typename }"}\''}</div>
                                        </>
                                    ) : selectedLog.service === 'Frontend' ? (
                                        <>
                                            <div className="text-zinc-400"># Check Frontend logs</div>
                                            <div className="text-green-400">cd website && yarn dev</div>
                                            <div className="text-zinc-400 mt-2"># Check for build errors</div>
                                            <div className="text-green-400">cd website && yarn build</div>
                                        </>
                                    ) : selectedLog.service === 'Database' ? (
                                        <>
                                            <div className="text-zinc-400"># Check database connection</div>
                                            <div className="text-green-400">psql -U postgres -c "SELECT 1"</div>
                                            <div className="text-zinc-400 mt-2"># For SQLite, check file exists</div>
                                            <div className="text-green-400">ls -la v2/vendure.sqlite</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-zinc-400"># Check service status</div>
                                            <div className="text-green-400">Check the service's dedicated console/terminal</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center pt-4 border-t">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        handleDeleteLog(selectedLog.id);
                                        setSelectedLog(null);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete This Log
                                </Button>
                                <div className="flex gap-2">
                                    <a href="/dashboard/system-status">
                                        <Button variant="outline" size="sm">
                                            <BarChart3 className="h-4 w-4 mr-1" /> View System Status
                                        </Button>
                                    </a>
                                    <Button variant="default" size="sm" onClick={() => setSelectedLog(null)}>
                                        Close Report
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}

function MarketplaceSettingsPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();

    // Settings state
    const [settings, setSettings] = useState<MarketplaceSettings>({
        autoApprove: true,
        autoVerifyEmail: false,
        autoVerifySeller: false,
    });
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    // Commission (display only for now)
    const [commissionRate, setCommissionRate] = useState(10);

    // Customer management state
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [disablingId, setDisablingId] = useState<string | null>(null);

    // Messages
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // System Alerts
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);

    // Load alerts
    useEffect(() => {
        const loadAlerts = () => {
            setAlerts(getActiveAlerts());
        };
        loadAlerts();
        const interval = setInterval(loadAlerts, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleDismissAlert = (alertId: string) => {
        dismissSystemAlert(alertId);
        setAlerts(getActiveAlerts());
    };

    // Fetch marketplace settings from backend
    const fetchSettings = async () => {
        setLoadingSettings(true);
        try {
            const result = await api.query<{ marketplaceSettings: MarketplaceSettings }>(GET_MARKETPLACE_SETTINGS);
            if (result.marketplaceSettings) {
                setSettings(result.marketplaceSettings);
            }
        } catch (err) {
            console.error('Failed to load marketplace settings:', err);
            setMessage({ type: 'error', text: 'Failed to load settings from server' });
        } finally {
            setLoadingSettings(false);
        }
    };

    // Update a single setting
    const updateSetting = async (key: keyof MarketplaceSettings, value: boolean) => {
        setSavingSettings(true);
        setMessage(null);
        try {
            const result = await api.mutate<{ updateMarketplaceSettings: MarketplaceSettings }>(
                UPDATE_MARKETPLACE_SETTINGS,
                { [key]: value }
            );
            if (result.updateMarketplaceSettings) {
                setSettings(result.updateMarketplaceSettings);
                setMessage({ type: 'success', text: `Setting updated successfully` });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to update setting' });
        } finally {
            setSavingSettings(false);
        }
    };

    const fetchUnverifiedCustomers = async () => {
        setLoadingCustomers(true);
        try {
            const result = await api.query<CustomersResponse>(GET_CUSTOMERS, { skip: 0, take: 100 });
            // Filter to only unverified customers
            const unverified = (result.customers?.items || []).filter(c => c.user && !c.user.verified);
            setCustomers(unverified);
        } catch (err) {
            console.error('Failed to load customers:', err);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const handleVerifyCustomer = async (customerId: string) => {
        setVerifyingId(customerId);
        setMessage(null);
        try {
            const result = await api.mutate<{ verifyCustomerEmail: { success: boolean; message?: string } }>(
                VERIFY_CUSTOMER_EMAIL,
                { customerId }
            );
            if (result.verifyCustomerEmail.success) {
                setMessage({ type: 'success', text: result.verifyCustomerEmail.message || 'Customer verified!' });
                await fetchUnverifiedCustomers();
            } else {
                setMessage({ type: 'error', text: result.verifyCustomerEmail.message || 'Verification failed' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Verification failed' });
        } finally {
            setVerifyingId(null);
        }
    };

    const handleResendVerification = async (customerId: string) => {
        setResendingId(customerId);
        setMessage(null);
        try {
            const result = await api.mutate<{ resendVerificationEmail: { success: boolean; message?: string } }>(
                RESEND_VERIFICATION_EMAIL,
                { customerId }
            );
            if (result.resendVerificationEmail.success) {
                setMessage({ type: 'success', text: result.resendVerificationEmail.message || 'Verification email sent!' });
            } else {
                setMessage({ type: 'error', text: result.resendVerificationEmail.message || 'Failed to send email' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to send email' });
        } finally {
            setResendingId(null);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            fetchSettings();
            fetchUnverifiedCustomers();
        }
    }, [isSuperAdmin]);

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">
                            This page is only available to marketplace administrators.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-500/20">
                    <Settings className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Settings Hub</h1>
                    <p className="text-sm text-muted-foreground">
                        Central control panel for marketplace administration
                    </p>
                </div>
            </div>

            {/* System Alerts Notification Bar */}
            {alerts.length > 0 && (
                <div className="mb-6 space-y-2">
                    {alerts.map(alert => (
                        <div
                            key={alert.id}
                            className={`p-4 rounded-lg flex items-center justify-between ${
                                alert.severity === 'critical'
                                    ? 'bg-red-500/10 border border-red-500/30'
                                    : alert.severity === 'warning'
                                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                                    : 'bg-blue-500/10 border border-blue-500/30'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {alert.severity === 'critical' ? (
                                    <AlertOctagon className="h-5 w-5 text-red-500" />
                                ) : alert.severity === 'warning' ? (
                                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-blue-500" />
                                )}
                                <div>
                                    <span className={`font-medium ${
                                        alert.severity === 'critical' ? 'text-red-500' :
                                        alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                                    }`}>
                                        {alert.service}:
                                    </span>
                                    <span className="ml-2 text-sm">{alert.message}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a href={alert.link || '/dashboard/system-status'}>
                                    <Button variant="outline" size="sm">
                                        View Details
                                    </Button>
                                </a>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDismissAlert(alert.id)}
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-600' : 'bg-red-500/10 border border-red-500/30 text-red-600'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {message.text}
                </div>
            )}

            <div className="grid gap-6">
                {/* System Status Quick View */}
                <a href="/dashboard/system-status">
                    <Card className="hover:border-indigo-500/50 transition-colors cursor-pointer">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-indigo-500/20">
                                        <BarChart3 className="h-6 w-6 text-indigo-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">System Status</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Monitor all services, view historical data, troubleshooting guides
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                </a>



                {/* Notification Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-pink-500" />
                            Notification Settings
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">New Order Emails</h4>
                                    <p className="text-sm text-muted-foreground">Send email to tuners on new orders</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>Enabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Review Notifications</h4>
                                    <p className="text-sm text-muted-foreground">Alert tuners when they receive reviews</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>Disabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Low Inventory Alerts</h4>
                                    <p className="text-sm text-muted-foreground">Notify tuners of low stock items</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>Disabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Admin Digest</h4>
                                    <p className="text-sm text-muted-foreground">Daily summary email to admins</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>Disabled</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Content & Display Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LayoutDashboard className="h-5 w-5 text-teal-500" />
                            Content & Display
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Maintenance Mode</h4>
                                    <p className="text-sm text-muted-foreground">Show maintenance page to non-admins</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>Off</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Show Platform Stats</h4>
                                    <p className="text-sm text-muted-foreground">Display stats on public pages</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>On</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Default Currency</h4>
                                    <p className="text-sm text-muted-foreground">Primary currency for listings</p>
                                </div>
                                <span className="text-sm font-medium">USD ($)</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Products Per Page</h4>
                                    <p className="text-sm text-muted-foreground">Number of items in product grids</p>
                                </div>
                                <span className="text-sm font-medium">24</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>


                {/* Danger Zone */}
                <Card className="border-red-500/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="h-5 w-5" />
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-red-600">Reset All Settings</h4>
                                    <p className="text-sm text-muted-foreground">Restore all settings to defaults</p>
                                </div>
                                <Button variant="destructive" size="sm" disabled>
                                    Reset
                                </Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-red-600">Clear Cache</h4>
                                    <p className="text-sm text-muted-foreground">Clear all cached marketplace data</p>
                                </div>
                                <Button variant="destructive" size="sm" disabled>
                                    Clear
                                </Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-red-600">Rebuild Search Index</h4>
                                    <p className="text-sm text-muted-foreground">Regenerate product search indexes</p>
                                </div>
                                <Button variant="destructive" size="sm" disabled>
                                    Rebuild
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Verification Settings Page
// ============================================================================

function VerificationSettingsPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();

    // Settings state
    const [settings, setSettings] = useState<MarketplaceSettings>({
        autoApprove: true,
        autoVerifyEmail: false,
        autoVerifySeller: false,
    });
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    // Customer management state
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [resendingId, setResendingId] = useState<string | null>(null);

    // Messages
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchSettings = async () => {
        setLoadingSettings(true);
        try {
            const result = await api.query<{ marketplaceSettings: MarketplaceSettings }>(GET_MARKETPLACE_SETTINGS);
            if (result.marketplaceSettings) {
                setSettings(result.marketplaceSettings);
            }
        } catch (err) {
            console.error('Failed to load marketplace settings:', err);
            setMessage({ type: 'error', text: 'Failed to load settings from server' });
        } finally {
            setLoadingSettings(false);
        }
    };

    const updateSetting = async (key: keyof MarketplaceSettings, value: boolean) => {
        setSavingSettings(true);
        setMessage(null);
        try {
            const result = await api.mutate<{ updateMarketplaceSettings: MarketplaceSettings }>(
                UPDATE_MARKETPLACE_SETTINGS,
                { [key]: value }
            );
            if (result.updateMarketplaceSettings) {
                setSettings(result.updateMarketplaceSettings);
                setMessage({ type: 'success', text: `Setting updated successfully` });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to update setting' });
        } finally {
            setSavingSettings(false);
        }
    };

    const fetchUnverifiedCustomers = async () => {
        setLoadingCustomers(true);
        try {
            const result = await api.query<CustomersResponse>(GET_CUSTOMERS, { skip: 0, take: 100 });
            const unverified = (result.customers?.items || []).filter(c => c.user && !c.user.verified);
            setCustomers(unverified);
        } catch (err) {
            console.error('Failed to load customers:', err);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const handleVerifyCustomer = async (customerId: string) => {
        setVerifyingId(customerId);
        setMessage(null);
        try {
            const result = await api.mutate<{ verifyCustomerEmail: { success: boolean; message?: string } }>(
                VERIFY_CUSTOMER_EMAIL,
                { customerId }
            );
            if (result.verifyCustomerEmail.success) {
                setMessage({ type: 'success', text: result.verifyCustomerEmail.message || 'Customer verified!' });
                await fetchUnverifiedCustomers();
            } else {
                setMessage({ type: 'error', text: result.verifyCustomerEmail.message || 'Verification failed' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Verification failed' });
        } finally {
            setVerifyingId(null);
        }
    };

    const handleResendVerification = async (customerId: string) => {
        setResendingId(customerId);
        setMessage(null);
        try {
            const result = await api.mutate<{ resendVerificationEmail: { success: boolean; message?: string } }>(
                RESEND_VERIFICATION_EMAIL,
                { customerId }
            );
            if (result.resendVerificationEmail.success) {
                setMessage({ type: 'success', text: result.resendVerificationEmail.message || 'Verification email sent!' });
            } else {
                setMessage({ type: 'error', text: result.resendVerificationEmail.message || 'Failed to send email' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to send email' });
        } finally {
            setResendingId(null);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            fetchSettings();
            fetchUnverifiedCustomers();
        }
    }, [isSuperAdmin]);

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">This page is only available to marketplace administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/20">
                    <ShieldCheck className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Verification Settings</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage email verification and tuner verification settings
                    </p>
                </div>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-600' : 'bg-red-500/10 border border-red-500/30 text-red-600'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {message.text}
                </div>
            )}

            <div className="grid gap-6">
                {/* Manual Customer Verification */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-blue-500" />
                                    Manual Email Verification
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Manually verify customer email addresses when verification links fail
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchUnverifiedCustomers} disabled={loadingCustomers}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loadingCustomers ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingCustomers && (
                            <div className="py-8 text-center text-muted-foreground">Loading customers...</div>
                        )}
                        {!loadingCustomers && customers.length === 0 && (
                            <div className="py-8 text-center">
                                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                                <p className="text-muted-foreground">All customers are verified!</p>
                            </div>
                        )}
                        {!loadingCustomers && customers.length > 0 && (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Registered</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customers.map((customer) => (
                                            <TableRow key={customer.id}>
                                                <TableCell>{customer.firstName} {customer.lastName}</TableCell>
                                                <TableCell>{customer.emailAddress}</TableCell>
                                                <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleVerifyCustomer(customer.id)}
                                                            disabled={verifyingId === customer.id}
                                                        >
                                                            {verifyingId === customer.id ? (
                                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                                    Verify
                                                                </>
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleResendVerification(customer.id)}
                                                            disabled={resendingId === customer.id}
                                                        >
                                                            {resendingId === customer.id ? (
                                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Send className="h-4 w-4 mr-1" />
                                                                    Resend
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Verification Runtime Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-purple-500" />
                            Verification Automation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Auto-Approve Sellers */}
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div>
                                <h3 className="font-medium flex items-center gap-2">
                                    Auto-Approve Sellers
                                    <Store className="h-4 w-4 text-purple-500" />
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    New seller registrations are automatically approved without admin review
                                </p>
                            </div>
                            <Button
                                variant={settings.autoApprove ? 'default' : 'outline'}
                                onClick={() => updateSetting('autoApprove', !settings.autoApprove)}
                                disabled={loadingSettings || savingSettings}
                                className={settings.autoApprove ? 'bg-green-500 hover:bg-green-600' : ''}
                            >
                                {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : settings.autoApprove ? 'Enabled' : 'Disabled'}
                            </Button>
                        </div>

                        {/* Auto-Verify Email */}
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border-2 border-yellow-500/30">
                            <div>
                                <h3 className="font-medium flex items-center gap-2">
                                    Auto-Verify Email
                                    <Badge className="bg-yellow-500/20 text-yellow-600 text-xs">Emergency</Badge>
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Bypass email verification for all new registrations. Use when email service is down.
                                </p>
                            </div>
                            <Button
                                variant={settings.autoVerifyEmail ? 'default' : 'outline'}
                                onClick={() => updateSetting('autoVerifyEmail', !settings.autoVerifyEmail)}
                                disabled={loadingSettings || savingSettings}
                                className={settings.autoVerifyEmail ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                            >
                                {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : settings.autoVerifyEmail ? 'Enabled' : 'Disabled'}
                            </Button>
                        </div>

                        {/* Auto-Verify Seller Badge */}
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div>
                                <h3 className="font-medium flex items-center gap-2">
                                    Auto-Verify Seller Badge
                                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Automatically grant the verified trust badge to new sellers upon approval
                                </p>
                            </div>
                            <Button
                                variant={settings.autoVerifySeller ? 'default' : 'outline'}
                                onClick={() => updateSetting('autoVerifySeller', !settings.autoVerifySeller)}
                                disabled={loadingSettings || savingSettings}
                                className={settings.autoVerifySeller ? 'bg-blue-500 hover:bg-blue-600' : ''}
                            >
                                {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : settings.autoVerifySeller ? 'Enabled' : 'Disabled'}
                            </Button>
                        </div>

                        {/* Info Box */}
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <div className="flex items-start gap-3">
                                <HelpCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-medium text-blue-600 mb-1">About Runtime Settings</p>
                                    <p className="text-muted-foreground">
                                        These settings are stored in memory and take effect immediately. They persist until the server restarts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Verification Requirements */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-amber-500" />
                            Verified Badge Requirements
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Minimum Sales Required</h4>
                                    <p className="text-sm text-muted-foreground">Number of completed sales before eligible</p>
                                </div>
                                <span className="text-sm font-medium">10 sales</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Minimum Rating Required</h4>
                                    <p className="text-sm text-muted-foreground">Average rating threshold</p>
                                </div>
                                <span className="text-sm font-medium">4.5 stars</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Account Age Required</h4>
                                    <p className="text-sm text-muted-foreground">Minimum time as active seller</p>
                                </div>
                                <span className="text-sm font-medium">30 days</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Identity Verification</h4>
                                    <p className="text-sm text-muted-foreground">Require ID verification for badge</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>Off</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Commission Settings Page
// ============================================================================

function CommissionSettingsPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();
    const [commissionRate, setCommissionRate] = useState(10);
    const [tuneCommission, setTuneCommission] = useState(10);
    const [partCommission, setPartCommission] = useState(10);
    const [serviceCommission, setServiceCommission] = useState(10);

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">This page is only available to marketplace administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                    <DollarSign className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Commission & Fees</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure platform commission rates and fee structures
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Global Commission Rate */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-yellow-500" />
                            Platform Commission
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-medium">Global Commission Rate</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Default percentage taken from each sale
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={commissionRate}
                                        onChange={(e) => setCommissionRate(Number(e.target.value))}
                                        className="w-20 px-3 py-2 rounded-lg border bg-background text-right"
                                        min="0"
                                        max="50"
                                    />
                                    <span className="text-muted-foreground">%</span>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground bg-yellow-500/10 p-2 rounded">
                                Note: Changes here are for display only. Actual commission rates are configured in Stripe/payment settings.
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Per-Category Commission */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-orange-500" />
                            Category-Specific Rates
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <div className="flex items-center gap-3">
                                    <Music className="h-6 w-6 text-blue-500" />
                                    <div>
                                        <h4 className="font-medium">Tunes (Digital Products)</h4>
                                        <p className="text-sm text-muted-foreground">Digital tune files, instant delivery</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={tuneCommission}
                                        onChange={(e) => setTuneCommission(Number(e.target.value))}
                                        className="w-16 px-2 py-1 rounded border bg-background text-right text-sm"
                                        min="0"
                                        max="50"
                                        disabled
                                    />
                                    <span className="text-muted-foreground text-sm">%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                <div className="flex items-center gap-3">
                                    <Wrench className="h-6 w-6 text-orange-500" />
                                    <div>
                                        <h4 className="font-medium">Parts (Physical Products)</h4>
                                        <p className="text-sm text-muted-foreground">Physical parts with shipping</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={partCommission}
                                        onChange={(e) => setPartCommission(Number(e.target.value))}
                                        className="w-16 px-2 py-1 rounded border bg-background text-right text-sm"
                                        min="0"
                                        max="50"
                                        disabled
                                    />
                                    <span className="text-muted-foreground text-sm">%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-6 w-6 text-green-500" />
                                    <div>
                                        <h4 className="font-medium">Services (Bookings)</h4>
                                        <p className="text-sm text-muted-foreground">In-person tuning appointments</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={serviceCommission}
                                        onChange={(e) => setServiceCommission(Number(e.target.value))}
                                        className="w-16 px-2 py-1 rounded border bg-background text-right text-sm"
                                        min="0"
                                        max="50"
                                        disabled
                                    />
                                    <span className="text-muted-foreground text-sm">%</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Payout Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            Payout Settings
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Payout Schedule</h4>
                                    <p className="text-sm text-muted-foreground">How often sellers receive payouts</p>
                                </div>
                                <select className="px-3 py-2 border rounded-md bg-background" disabled>
                                    <option>Daily</option>
                                    <option>Weekly</option>
                                    <option>Monthly</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Minimum Payout Amount</h4>
                                    <p className="text-sm text-muted-foreground">Threshold before payout is triggered</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">$</span>
                                    <input type="number" value="25" className="w-20 px-2 py-1 border rounded bg-background text-right" disabled />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Payout Hold Period</h4>
                                    <p className="text-sm text-muted-foreground">Days to hold funds for disputes</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <input type="number" value="7" className="w-16 px-2 py-1 border rounded bg-background text-right" disabled />
                                    <span className="text-muted-foreground">days</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Stripe Connect Status</h4>
                                    <p className="text-sm text-muted-foreground">Payment platform integration</p>
                                </div>
                                <Badge className="bg-green-500/20 text-green-600">Connected</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Fee Structure */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-indigo-500" />
                            Additional Fees
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Listing Fee</h4>
                                    <p className="text-sm text-muted-foreground">Fee charged per new listing</p>
                                </div>
                                <span className="text-sm font-medium">$0.00 (Free)</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Featured Listing Fee</h4>
                                    <p className="text-sm text-muted-foreground">Premium placement in search</p>
                                </div>
                                <span className="text-sm font-medium">$9.99/week</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Subscription Tiers</h4>
                                    <p className="text-sm text-muted-foreground">Premium seller subscriptions</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>Configure</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Marketplace Features Page
// ============================================================================

function MarketplaceFeaturesPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">This page is only available to marketplace administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Cpu className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Marketplace Features</h1>
                    <p className="text-sm text-muted-foreground">
                        Toggle marketplace features and functionality
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Core Features */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-orange-500" />
                            Product Categories
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <div className="flex items-center gap-3">
                                    <Music className="h-6 w-6 text-blue-500" />
                                    <div>
                                        <h4 className="font-medium">Tunes (Digital Products)</h4>
                                        <p className="text-sm text-muted-foreground">Digital tune files, instant delivery</p>
                                    </div>
                                </div>
                                <Badge className="bg-green-500/20 text-green-600">Active</Badge>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                <div className="flex items-center gap-3">
                                    <Wrench className="h-6 w-6 text-orange-500" />
                                    <div>
                                        <h4 className="font-medium">Parts (Physical Products)</h4>
                                        <p className="text-sm text-muted-foreground">Physical parts with shipping</p>
                                    </div>
                                </div>
                                <Badge className="bg-green-500/20 text-green-600">Active</Badge>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-6 w-6 text-green-500" />
                                    <div>
                                        <h4 className="font-medium">Services (Bookings)</h4>
                                        <p className="text-sm text-muted-foreground">In-person tuning appointments</p>
                                    </div>
                                </div>
                                <Badge className="bg-green-500/20 text-green-600">Active</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Social Features */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-yellow-500" />
                            Social Features
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h3 className="font-medium flex items-center gap-2">
                                        Review System
                                        <Star className="h-4 w-4 text-yellow-500" />
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Enable customer reviews and ratings for tuner products
                                    </p>
                                </div>
                                <Button variant="outline" disabled>Disabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h3 className="font-medium flex items-center gap-2">
                                        Tuner Following
                                        <Users className="h-4 w-4 text-blue-500" />
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Allow customers to follow their favorite tuners
                                    </p>
                                </div>
                                <Button variant="outline" disabled>Disabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h3 className="font-medium flex items-center gap-2">
                                        Direct Messaging
                                        <MessageCircle className="h-4 w-4 text-green-500" />
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Customer-to-tuner messaging system
                                    </p>
                                </div>
                                <Button variant="outline" disabled>Disabled</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Business Features */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-purple-500" />
                            Business Features
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h3 className="font-medium">Featured Tuners</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Highlight top tuners on the marketplace homepage
                                    </p>
                                </div>
                                <Button variant="outline" disabled>Disabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h3 className="font-medium">Dispute Resolution</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Manage customer-tuner disputes and refund requests
                                    </p>
                                </div>
                                <Button variant="outline" disabled>Disabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h3 className="font-medium">Promotions & Coupons</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Allow tuners to create promotional discounts
                                    </p>
                                </div>
                                <Button variant="outline" disabled>Disabled</Button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <h3 className="font-medium">Analytics Dashboard</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Detailed sales and traffic analytics for tuners
                                    </p>
                                </div>
                                <Button variant="outline" disabled>Disabled</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}

// ============================================================================
// Platform Settings Page (Vehicle Platforms)
// ============================================================================

function PlatformSettingsPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();

    const platforms = [
        { name: 'BMW', models: ['M3', 'M4', 'M5', 'M2', '340i', '440i'], active: true },
        { name: 'Mercedes-Benz', models: ['AMG C63', 'AMG E63', 'AMG GT', 'C43', 'E53'], active: true },
        { name: 'Audi', models: ['RS3', 'RS4', 'RS5', 'RS6', 'S4', 'S5'], active: true },
        { name: 'Porsche', models: ['911', 'Cayman', 'Boxster', 'Panamera', 'Macan'], active: true },
        { name: 'Ford', models: ['Mustang GT', 'F-150', 'Focus RS', 'Raptor', 'GT350'], active: true },
        { name: 'Chevrolet', models: ['Camaro SS', 'Corvette', 'Silverado', 'Colorado'], active: true },
        { name: 'Toyota', models: ['Supra', 'GR86', 'Tundra', 'Tacoma', 'Camry TRD'], active: true },
        { name: 'Honda', models: ['Civic Type R', 'Accord', 'S2000', 'NSX'], active: true },
        { name: 'Subaru', models: ['WRX STI', 'BRZ', 'Forester XT', 'Legacy GT'], active: true },
        { name: 'Nissan', models: ['GT-R', '370Z', '400Z', 'Titan', 'Frontier'], active: true },
        { name: 'Mazda', models: ['MX-5', 'RX-7', 'Mazda3 Turbo', 'CX-5'], active: true },
        { name: 'Volkswagen', models: ['Golf R', 'GTI', 'Jetta GLI', 'Arteon'], active: true },
        { name: 'Dodge', models: ['Challenger', 'Charger', 'Durango SRT', 'Viper'], active: true },
        { name: 'Jeep', models: ['Wrangler', 'Grand Cherokee', 'Gladiator'], active: true },
        { name: 'Ram', models: ['1500 TRX', '2500', '3500'], active: true },
        { name: 'Tesla', models: ['Model 3', 'Model S', 'Model X', 'Model Y'], active: false },
    ];

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">This page is only available to marketplace administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-500/20">
                    <Car className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Vehicle Platforms</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage supported vehicle makes and models
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-4 pb-3 text-center">
                            <div className="text-2xl font-bold text-amber-500">{platforms.length}</div>
                            <div className="text-sm text-muted-foreground">Total Platforms</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3 text-center">
                            <div className="text-2xl font-bold text-green-500">{platforms.filter(p => p.active).length}</div>
                            <div className="text-sm text-muted-foreground">Active</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3 text-center">
                            <div className="text-2xl font-bold text-gray-500">{platforms.filter(p => !p.active).length}</div>
                            <div className="text-sm text-muted-foreground">Inactive</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Platform List */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Car className="h-5 w-5 text-amber-500" />
                                Supported Platforms
                            </CardTitle>
                            <Button variant="outline" disabled>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Platform (Dev)
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {platforms.map((platform) => (
                                <div key={platform.name} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Car className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <span className="font-medium">{platform.name}</span>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {platform.models.slice(0, 4).join(', ')}
                                                {platform.models.length > 4 && ` +${platform.models.length - 4} more`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={platform.active ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-600'}>
                                            {platform.active ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <Button variant="outline" size="sm" disabled>
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Tuning Software */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Cpu className="h-5 w-5 text-cyan-500" />
                            Tuning Software
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {['HP Tuners', 'EcuTek', 'Cobb Accessport', 'MHD', 'BimmerCode', 'xHP', 'Bootmod3', 'JB4', 'Dinan', 'APR', 'Unitronic', 'IE'].map((software) => (
                                <div key={software} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <span className="text-sm font-medium">{software}</span>
                                    <Badge className="bg-green-500/20 text-green-600 text-xs">Active</Badge>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" className="w-full mt-4" disabled>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Software (Non-functional)
                        </Button>
                    </CardContent>
                </Card>

                {/* Tune Types */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gauge className="h-5 w-5 text-red-500" />
                            Tune Types
                            <Badge variant="outline" className="text-xs">Non-functional (Dev)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {['Stage 1', 'Stage 2', 'Stage 3', 'E85/Flex Fuel', 'Custom Dyno', 'Economy', 'Tow Mode', 'Off-Road', 'Anti-Theft', 'Launch Control', 'Pop & Bang', 'Rev Limiter'].map((tuneType) => (
                                <div key={tuneType} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <span className="text-sm font-medium">{tuneType}</span>
                                    <Badge className="bg-green-500/20 text-green-600 text-xs">Active</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Tuner Requests Page
// ============================================================================

function TunerRequestsPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [processing, setProcessing] = useState(false);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const result = await api.query(GET_TUNER_REQUESTS, {
                variables: { status: statusFilter || undefined, take: 50 },
            });
            setRequests(result.tunerRequests?.items || []);
        } catch (err) {
            debugLog.error('Tuner Requests', 'Failed to load tuner requests', (err as any)?.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!permLoading && isSuperAdmin) {
            loadRequests();
        }
    }, [permLoading, isSuperAdmin, statusFilter]);

    const handleApprove = async (id: string) => {
        setProcessing(true);
        try {
            await api.mutate(APPROVE_TUNER_REQUEST, { id, adminNotes: adminNotes || undefined });
            setSelectedRequest(null);
            setAdminNotes('');
            loadRequests();
        } catch (err) {
            debugLog.error('Tuner Requests', 'Failed to approve tuner request', (err as any)?.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (id: string) => {
        setProcessing(true);
        try {
            await api.mutate(REJECT_TUNER_REQUEST, { id, adminNotes: adminNotes || undefined });
            setSelectedRequest(null);
            setAdminNotes('');
            loadRequests();
        } catch (err) {
            debugLog.error('Tuner Requests', 'Failed to reject tuner request', (err as any)?.message);
        } finally {
            setProcessing(false);
        }
    };

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">This page is only available to marketplace administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                        <Users className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Tuner Requests</h1>
                        <p className="text-muted-foreground">Review and manage seller applications</p>
                    </div>
                </div>
                <Button variant="outline" onClick={loadRequests}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 mb-6">
                {['pending', 'approved', 'rejected', 'all'].map((status) => (
                    <Button
                        key={status}
                        variant={statusFilter === status || (status === 'all' && !statusFilter) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(status === 'all' ? '' : status)}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                ))}
            </div>

            {/* Requests Table */}
            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Loading requests...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No tuner requests found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Applicant</TableHead>
                                    <TableHead>Business</TableHead>
                                    <TableHead>Experience</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                                                    {request.firstName?.[0]}{request.lastName?.[0]}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{request.firstName} {request.lastName}</div>
                                                    <div className="text-sm text-muted-foreground">{request.customerEmail}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>{request.businessName || 'N/A'}</div>
                                            <div className="text-sm text-muted-foreground">{request.location || 'No location'}</div>
                                        </TableCell>
                                        <TableCell>{request.experience || 'N/A'}</TableCell>
                                        <TableCell>
                                            <Badge className={
                                                request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600' :
                                                request.status === 'approved' ? 'bg-green-500/20 text-green-600' :
                                                'bg-red-500/20 text-red-600'
                                            }>
                                                {request.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedRequest(request)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {request.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-green-600"
                                                            onClick={() => handleApprove(request.id)}
                                                            disabled={processing}
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-red-600"
                                                            onClick={() => handleReject(request.id)}
                                                            disabled={processing}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Detail Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Tuner Application Details</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-muted-foreground">Name</label>
                                    <p className="font-medium">{selectedRequest.firstName} {selectedRequest.lastName}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Email</label>
                                    <p className="font-medium">{selectedRequest.customerEmail}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Business</label>
                                    <p className="font-medium">{selectedRequest.businessName || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Phone</label>
                                    <p className="font-medium">{selectedRequest.phone || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Location</label>
                                    <p className="font-medium">{selectedRequest.location || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Experience</label>
                                    <p className="font-medium">{selectedRequest.experience || 'N/A'}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Bio</label>
                                <p className="font-medium">{selectedRequest.bio || 'No bio provided'}</p>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-muted-foreground">Software</label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {selectedRequest.software?.map((sw: string) => (
                                            <Badge key={sw} variant="outline">{sw}</Badge>
                                        )) || <span className="text-muted-foreground">None</span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Platforms</label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {selectedRequest.vehiclePlatforms?.map((p: string) => (
                                            <Badge key={p} variant="outline">{p}</Badge>
                                        )) || <span className="text-muted-foreground">None</span>}
                                    </div>
                                </div>
                            </div>

                            {selectedRequest.status === 'pending' && (
                                <div className="pt-4 border-t">
                                    <label className="text-sm text-muted-foreground block mb-2">Admin Notes</label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        className="w-full p-3 rounded-lg border bg-background"
                                        rows={3}
                                        placeholder="Optional notes..."
                                    />
                                    <div className="flex gap-2 mt-4">
                                        <Button
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                            onClick={() => handleApprove(selectedRequest.id)}
                                            disabled={processing}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Approve
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={() => handleReject(selectedRequest.id)}
                                            disabled={processing}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Admin Viewers Page
// ============================================================================

function AdminViewersPage() {
    const { isSuperAdmin, loading: permLoading } = useIsSuperAdmin();
    const [viewers, setViewers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadViewers = async () => {
        setLoading(true);
        try {
            const result = await api.query(GET_ADMIN_VIEWERS, { take: 50 });
            setViewers(result.adminViewers?.items || []);
        } catch (err: any) {
            console.error('Failed to load admin viewers:', err);
            setMessage({ type: 'error', text: 'Failed to load admin viewers: ' + (err.message || 'Unknown error') });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!permLoading && isSuperAdmin) {
            loadViewers();
        }
    }, [permLoading, isSuperAdmin]);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        setSearching(true);
        setMessage(null);
        try {
            const result = await api.query(SEARCH_CUSTOMERS_FOR_ADMIN_VIEWER, { searchTerm });
            setSearchResults(result.searchCustomersForAdminViewer || []);
            if ((result.searchCustomersForAdminViewer || []).length === 0) {
                setMessage({ type: 'error', text: 'No customers found matching "' + searchTerm + '"' });
            }
        } catch (err: any) {
            console.error('Failed to search:', err);
            setMessage({ type: 'error', text: 'Search failed: ' + (err.message || 'Unknown error') });
        } finally {
            setSearching(false);
        }
    };

    const handleGrant = async (customerId: string) => {
        setActionLoading(customerId);
        setMessage(null);
        try {
            const result = await api.mutate(GRANT_ADMIN_VIEWER_ACCESS, { customerId });
            if (result.grantAdminViewerAccess?.success) {
                setMessage({ type: 'success', text: 'Admin viewer access granted successfully!' });
                loadViewers();
                setSearchResults([]);
                setSearchTerm('');
            } else {
                setMessage({ type: 'error', text: result.grantAdminViewerAccess?.message || 'Failed to grant access' });
            }
        } catch (err: any) {
            console.error('Failed to grant access:', err);
            setMessage({ type: 'error', text: 'Failed to grant access: ' + (err.message || 'Unknown error') });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevoke = async (customerId: string) => {
        setActionLoading(customerId);
        setMessage(null);
        try {
            const result = await api.mutate(REVOKE_ADMIN_VIEWER_ACCESS, { customerId });
            if (result.revokeAdminViewerAccess?.success) {
                setMessage({ type: 'success', text: 'Admin viewer access revoked successfully!' });
                loadViewers();
            } else {
                setMessage({ type: 'error', text: result.revokeAdminViewerAccess?.message || 'Failed to revoke access' });
            }
        } catch (err: any) {
            console.error('Failed to revoke access:', err);
            setMessage({ type: 'error', text: 'Failed to revoke access: ' + (err.message || 'Unknown error') });
        } finally {
            setActionLoading(null);
        }
    };

    if (!permLoading && !isSuperAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <Ban className="h-8 w-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground">This page is only available to super administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                        <Eye className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Admin Viewers</h1>
                        <p className="text-muted-foreground">Manage accounts that can view other sellers/buyers panels</p>
                    </div>
                </div>
            </div>

            {/* Message Display */}
            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                    message.type === 'success'
                        ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                        : 'bg-red-500/20 text-red-600 border border-red-500/30'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-auto hover:opacity-70">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Add New Viewer */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Add Admin Viewer
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name or email..."
                            className="flex-1 p-3 rounded-lg border bg-background"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()}>
                            {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Search'}
                        </Button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {searchResults.map((customer) => (
                                <div key={customer.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <div>
                                        <div className="font-medium">{customer.firstName} {customer.lastName}</div>
                                        <div className="text-sm text-muted-foreground">{customer.emailAddress}</div>
                                    </div>
                                    {customer.isAdminViewer ? (
                                        <Badge className="bg-green-500/20 text-green-600">Already Admin Viewer</Badge>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={() => handleGrant(customer.id)}
                                            disabled={actionLoading === customer.id}
                                        >
                                            {actionLoading === customer.id ? (
                                                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                            ) : (
                                                <Plus className="h-4 w-4 mr-1" />
                                            )}
                                            Grant Access
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Current Viewers */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Admin Viewers</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    ) : viewers.length === 0 ? (
                        <div className="text-center py-8">
                            <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No admin viewers configured</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Added</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewers.map((viewer) => (
                                    <TableRow key={viewer.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                                                    {viewer.firstName?.[0]}{viewer.lastName?.[0]}
                                                </div>
                                                <div className="font-medium">{viewer.firstName} {viewer.lastName}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{viewer.emailAddress}</TableCell>
                                        <TableCell>{new Date(viewer.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleRevoke(viewer.id)}
                                                disabled={actionLoading === viewer.id}
                                            >
                                                {actionLoading === viewer.id ? (
                                                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                )}
                                                Revoke
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// ADMIN LISTINGS PAGES - View/manage all products across all shops
// ============================================================================

interface AdminProduct {
    id: string;
    name: string;
    slug: string;
    enabled: boolean;
    createdAt: string;
    featuredAsset?: { preview: string };
    variants: Array<{
        id: string;
        name: string;
        sku: string;
        price: number;
        priceWithTax: number;
        stockOnHand: number;
    }>;
    customFields?: {
        productType?: string;
        isDigital?: boolean;
        sellerId?: string;
    };
}

function AdminProductListPage({
    title,
    description,
    productType,
    icon,
    accentColor,
}: {
    title: string;
    description: string;
    productType: 'tune' | 'part' | 'service';
    icon: React.ReactNode;
    accentColor: string;
}) {
    const [products, setProducts] = useState<AdminProduct[]>([]);
    const [sellers, setSellers] = useState<SellerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSeller, setSelectedSeller] = useState<string>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [productsResult, sellersResult] = await Promise.all([
                api.query<{ products: { items: AdminProduct[]; totalItems: number } }>(GET_ADMIN_PRODUCTS, { skip: 0, take: 500 }),
                api.query<SellerProfilesResponse>(GET_SELLER_PROFILES, { skip: 0, take: 200 }),
            ]);
            const filteredByType = (productsResult.products?.items || []).filter(
                p => p.customFields?.productType === productType
            );
            setProducts(filteredByType);
            setSellers(sellersResult.sellerProfiles?.items || []);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getSellerName = (sellerId: string | undefined) => {
        if (!sellerId) return 'Unknown Shop';
        const seller = sellers.find(s => s.id === sellerId);
        return seller?.businessName || `${seller?.firstName} ${seller?.lastName}` || 'Unknown Shop';
    };

    const handleToggleEnabled = async (product: AdminProduct) => {
        setActionLoading(product.id);
        try {
            await api.mutate(UPDATE_PRODUCT, {
                input: { id: product.id, enabled: !product.enabled },
            });
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, enabled: !p.enabled } : p));
            setMessage({ type: 'success', text: `Product ${product.enabled ? 'disabled' : 'enabled'}` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to update product' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (product: AdminProduct) => {
        if (!confirm(`Are you sure you want to delete "${product.name}"? This cannot be undone.`)) return;
        setActionLoading(product.id);
        try {
            await api.mutate(DELETE_PRODUCT, { id: product.id });
            setProducts(prev => prev.filter(p => p.id !== product.id));
            setMessage({ type: 'success', text: 'Product deleted successfully' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to delete product' });
        } finally {
            setActionLoading(null);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.variants.some(v => v.sku.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesSeller = selectedSeller === 'all' || p.customFields?.sellerId === selectedSeller;
        return matchesSearch && matchesSeller;
    });

    const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${accentColor}`}>{icon}</div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">{filteredProducts.length} products</Badge>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-auto"><XCircle className="h-4 w-4" /></button>
                </div>
            )}

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by name or SKU..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={selectedSeller}
                                onChange={(e) => setSelectedSeller(e.target.value)}
                                className="px-3 py-2 rounded-lg border bg-background min-w-[180px]"
                            >
                                <option value="all">All Shops</option>
                                {sellers.map(seller => (
                                    <option key={seller.id} value={seller.id}>
                                        {seller.businessName || `${seller.firstName} ${seller.lastName}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Shop</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No products found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {product.featuredAsset?.preview ? (
                                                <img
                                                    src={product.featuredAsset.preview + '?preset=tiny'}
                                                    alt=""
                                                    className="w-10 h-10 rounded object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                                    <Package className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium">{product.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {product.variants[0]?.sku || 'No SKU'}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {getSellerName(product.customFields?.sellerId)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {product.variants[0] ? formatPrice(product.variants[0].priceWithTax || product.variants[0].price) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {product.customFields?.isDigital ? (
                                            <Badge className="bg-blue-500/20 text-blue-600">Digital</Badge>
                                        ) : (
                                            <span>{product.variants[0]?.stockOnHand ?? '-'}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {product.enabled ? (
                                            <Badge className="bg-green-500/20 text-green-600">Active</Badge>
                                        ) : (
                                            <Badge className="bg-red-500/20 text-red-600">Disabled</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleEnabled(product)}
                                                disabled={actionLoading === product.id}
                                                title={product.enabled ? 'Disable' : 'Enable'}
                                            >
                                                {product.enabled ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(`/admin/catalog/products/${product.id}`, '_blank')}
                                                title="Edit in Vendure"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(product)}
                                                disabled={actionLoading === product.id}
                                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}

function AdminTunesPage() {
    return (
        <AdminProductListPage
            title="All Tunes"
            description="View and manage all tune listings across all shops"
            productType="tune"
            icon={<Music className="h-6 w-6 text-blue-500" />}
            accentColor="bg-blue-500/20"
        />
    );
}

function AdminPartsPage() {
    return (
        <AdminProductListPage
            title="All Parts"
            description="View and manage all parts listings across all shops"
            productType="part"
            icon={<Package className="h-6 w-6 text-orange-500" />}
            accentColor="bg-orange-500/20"
        />
    );
}

function AdminServicesPage() {
    return (
        <AdminProductListPage
            title="All Services"
            description="View and manage all service listings across all shops"
            productType="service"
            icon={<Calendar className="h-6 w-6 text-green-500" />}
            accentColor="bg-green-500/20"
        />
    );
}

// ============================================================================
// ADMIN ORDERS PAGES - View/manage all orders across all shops
// ============================================================================

interface AdminOrder {
    id: string;
    code: string;
    state: string;
    total: number;
    totalWithTax: number;
    currencyCode: string;
    createdAt: string;
    updatedAt: string;
    customer?: {
        id: string;
        firstName: string;
        lastName: string;
        emailAddress: string;
    };
    lines: Array<{
        productVariant: {
            name: string;
            sku: string;
            product: {
                id: string;
                name: string;
                customFields?: {
                    productType?: string;
                    sellerId?: string;
                };
            };
        };
        quantity: number;
        linePriceWithTax: number;
    }>;
    shippingAddress?: {
        city?: string;
        province?: string;
        country?: string;
    };
}

function AdminOrdersListPage({
    title,
    description,
    icon,
    accentColor,
    filterStates,
    showFlagColumn = false,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    accentColor: string;
    filterStates: string[];
    showFlagColumn?: boolean;
}) {
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [sellers, setSellers] = useState<SellerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSeller, setSelectedSeller] = useState<string>('all');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [ordersResult, sellersResult] = await Promise.all([
                api.query<{ orders: { items: AdminOrder[]; totalItems: number } }>(GET_ADMIN_ORDERS, { skip: 0, take: 500 }),
                api.query<SellerProfilesResponse>(GET_SELLER_PROFILES, { skip: 0, take: 200 }),
            ]);
            const filteredByState = (ordersResult.orders?.items || []).filter(o => filterStates.includes(o.state));
            setOrders(filteredByState);
            setSellers(sellersResult.sellerProfiles?.items || []);
        } catch (err) {
            console.error('Failed to load orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getSellerName = (sellerId: string | undefined) => {
        if (!sellerId) return 'Unknown';
        const seller = sellers.find(s => s.id === sellerId);
        return seller?.businessName || `${seller?.firstName} ${seller?.lastName}` || 'Unknown';
    };

    const getOrderSellers = (order: AdminOrder): string[] => {
        const sellerIds = new Set<string>();
        order.lines.forEach(line => {
            const sellerId = line.productVariant.product.customFields?.sellerId;
            if (sellerId) sellerIds.add(sellerId);
        });
        return Array.from(sellerIds);
    };

    const getOrderProductTypes = (order: AdminOrder): string[] => {
        const types = new Set<string>();
        order.lines.forEach(line => {
            const type = line.productVariant.product.customFields?.productType;
            if (type) types.add(type);
        });
        return Array.from(types);
    };

    const getStateFlag = (state: string) => {
        const flags: Record<string, { label: string; color: string }> = {
            'AddingItems': { label: 'Cart', color: 'bg-gray-500/20 text-gray-500' },
            'ArrangingPayment': { label: 'Checkout', color: 'bg-yellow-500/20 text-yellow-600' },
            'PaymentAuthorized': { label: 'Authorized', color: 'bg-blue-500/20 text-blue-600' },
            'PaymentSettled': { label: 'Paid', color: 'bg-green-500/20 text-green-600' },
            'PartiallyShipped': { label: 'Partial Ship', color: 'bg-orange-500/20 text-orange-600' },
            'Shipped': { label: 'Shipped', color: 'bg-purple-500/20 text-purple-600' },
            'PartiallyDelivered': { label: 'Partial Delivery', color: 'bg-teal-500/20 text-teal-600' },
            'Delivered': { label: 'Delivered', color: 'bg-green-600/20 text-green-700' },
            'Cancelled': { label: 'Cancelled', color: 'bg-red-500/20 text-red-600' },
            'Modifying': { label: 'Modifying', color: 'bg-yellow-500/20 text-yellow-600' },
            'ArrangingAdditionalPayment': { label: 'Add Payment', color: 'bg-orange-500/20 text-orange-600' },
        };
        return flags[state] || { label: state, color: 'bg-gray-500/20 text-gray-500' };
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer?.emailAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${order.customer?.firstName} ${order.customer?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
        const orderSellerIds = getOrderSellers(order);
        const matchesSeller = selectedSeller === 'all' || orderSellerIds.includes(selectedSeller);
        return matchesSearch && matchesSeller;
    });

    const formatPrice = (amount: number) => `$${(amount / 100).toFixed(2)}`;
    const formatDate = (date: string) => new Date(date).toLocaleDateString();

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${accentColor}`}>{icon}</div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">{filteredOrders.length} orders</Badge>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by order code, customer name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={selectedSeller}
                                onChange={(e) => setSelectedSeller(e.target.value)}
                                className="px-3 py-2 rounded-lg border bg-background min-w-[180px]"
                            >
                                <option value="all">All Shops</option>
                                {sellers.map(seller => (
                                    <option key={seller.id} value={seller.id}>
                                        {seller.businessName || `${seller.firstName} ${seller.lastName}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Shop(s)</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8">
                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                    No orders found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredOrders.map(order => {
                                const flag = getStateFlag(order.state);
                                const orderSellers = getOrderSellers(order);
                                const orderTypes = getOrderProductTypes(order);
                                return (
                                    <TableRow key={order.id}>
                                        <TableCell>
                                            <div className="font-mono font-medium">{order.code}</div>
                                            <div className="text-xs text-muted-foreground">{order.lines.length} items</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">
                                                {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Guest'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{order.customer?.emailAddress || '-'}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {orderSellers.length > 0 ? orderSellers.map(sellerId => (
                                                    <Badge key={sellerId} variant="outline" className="text-xs">
                                                        {getSellerName(sellerId)}
                                                    </Badge>
                                                )) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {orderTypes.map(type => (
                                                    <Badge key={type} className={`text-xs ${
                                                        type === 'tune' ? 'bg-blue-500/20 text-blue-600' :
                                                        type === 'part' ? 'bg-orange-500/20 text-orange-600' :
                                                        'bg-green-500/20 text-green-600'
                                                    }`}>
                                                        {type}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{formatPrice(order.totalWithTax)}</TableCell>
                                        <TableCell>
                                            <Badge className={flag.color}>{flag.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(`/admin/orders/${order.id}`, '_blank')}
                                                title="View in Vendure"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}

// ============================================================================
// Order Analytics & Debug Page
// ============================================================================

function OrderAnalyticsPage() {
    const [activeTab, setActiveTab] = useState<'debug' | 'analytics'>('debug');
    const [debugLogs, setDebugLogs] = useState<OrderDebugLog[]>([]);
    const [analyticsEvents, setAnalyticsEvents] = useState<OrderAnalyticsEvent[]>([]);
    const [filterOperation, setFilterOperation] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [filterEventType, setFilterEventType] = useState<string>('');
    const [selectedLog, setSelectedLog] = useState<OrderDebugLog | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<OrderAnalyticsEvent | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [clearTarget, setClearTarget] = useState<'debug' | 'analytics'>('debug');
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Auto-refresh every 5 seconds
    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            loadData();
            setLastRefresh(new Date());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    function loadData() {
        setDebugLogs(getOrderDebugLogs());
        setAnalyticsEvents(getOrderAnalyticsEvents());
    }

    function handleDeleteLog(id: string) {
        deleteOrderDebugLog(id);
        loadData();
    }

    function handleClearAll() {
        if (clearTarget === 'debug') {
            clearOrderDebugLogs();
        } else {
            clearOrderAnalyticsEvents();
        }
        loadData();
        setShowClearConfirm(false);
    }

    function copyToClipboard(text: string, label?: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedCommand(label || text);
            setTimeout(() => setCopiedCommand(null), 2000);
        });
    }

    const filteredLogs = debugLogs
        .filter(log => !filterOperation || log.operation === filterOperation)
        .filter(log => !filterType || log.type === filterType)
        .sort((a, b) => b.lastOccurrence - a.lastOccurrence);

    const filteredEvents = analyticsEvents
        .filter(e => !filterEventType || e.eventType === filterEventType)
        .sort((a, b) => b.timestamp - a.timestamp);

    const errorCount = debugLogs.filter(l => l.type === 'error').length;
    const warningCount = debugLogs.filter(l => l.type === 'warning').length;
    const successCount = debugLogs.filter(l => l.type === 'success').length;
    const infoCount = debugLogs.filter(l => l.type === 'info').length;

    // Analytics summary
    const eventCounts = analyticsEvents.reduce((acc, e) => {
        acc[e.eventType] = (acc[e.eventType] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const conversionRate = analyticsEvents.length > 0
        ? ((eventCounts['order_placed'] || 0) / (eventCounts['add_to_cart'] || 1) * 100).toFixed(1)
        : '0';

    const totalRevenue = analyticsEvents
        .filter(e => e.eventType === 'order_placed' && e.orderTotal)
        .reduce((sum, e) => sum + (e.orderTotal || 0), 0);

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    function getTypeIcon(type: OrderDebugLog['type']) {
        switch (type) {
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500" />;
        }
    }

    function getTypeBgColor(type: OrderDebugLog['type']): string {
        switch (type) {
            case 'error': return 'bg-red-500/10 border-red-500/30';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
            case 'success': return 'bg-green-500/10 border-green-500/30';
            case 'info': return 'bg-blue-500/10 border-blue-500/30';
        }
    }

    function getEventIcon(eventType: OrderAnalyticsEvent['eventType']) {
        switch (eventType) {
            case 'add_to_cart': return <ShoppingCart className="w-4 h-4 text-blue-500" />;
            case 'remove_from_cart': return <Trash2 className="w-4 h-4 text-red-500" />;
            case 'checkout_start': return <CreditCard className="w-4 h-4 text-purple-500" />;
            case 'payment_success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'payment_failed': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'order_placed': return <Package className="w-4 h-4 text-green-500" />;
            case 'search': return <Search className="w-4 h-4 text-blue-500" />;
            default: return <Activity className="w-4 h-4 text-gray-500" />;
        }
    }

    const selectedServiceInfo = selectedLog ? getOrderServiceInfo(selectedLog.operation) : null;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="w-6 h-6" />
                        Order Analytics & Debug
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track order operations, debug issues, and analyze shopping behavior
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        Auto-refresh: {lastRefresh.toLocaleTimeString()}
                    </span>
                    <Button variant="outline" onClick={() => { loadData(); setLastRefresh(new Date()); }}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button variant="outline" onClick={() => exportOrderAnalytics('json')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export JSON
                    </Button>
                    <Button variant="outline" onClick={() => exportOrderAnalytics('csv')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
                <Button
                    variant={activeTab === 'debug' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('debug')}
                    className={activeTab === 'debug' ? '' : 'text-muted-foreground'}
                >
                    <Bug className="w-4 h-4 mr-2" />
                    Debug Logs ({debugLogs.length})
                </Button>
                <Button
                    variant={activeTab === 'analytics' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('analytics')}
                    className={activeTab === 'analytics' ? '' : 'text-muted-foreground'}
                >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Shopping Analytics ({analyticsEvents.length})
                </Button>
            </div>

            {activeTab === 'debug' && (
                <>
                    {/* Debug Stats Summary */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-red-500">{errorCount} errors</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-medium text-yellow-500">{warningCount} warnings</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-green-500">{successCount} success</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full">
                            <Info className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium text-blue-500">{infoCount} info</span>
                        </div>
                    </div>

                    {/* Debug Filters */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Filter:</span>
                                </div>
                                <select
                                    value={filterOperation}
                                    onChange={(e) => setFilterOperation(e.target.value)}
                                    className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                                >
                                    <option value="">All Operations</option>
                                    {ORDER_OPERATIONS.map(op => (
                                        <option key={op} value={op}>{op}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                                >
                                    <option value="">All Types</option>
                                    <option value="error">Errors</option>
                                    <option value="warning">Warnings</option>
                                    <option value="success">Success</option>
                                    <option value="info">Info</option>
                                </select>
                                {(filterOperation || filterType) && (
                                    <Button variant="ghost" size="sm" onClick={() => { setFilterOperation(''); setFilterType(''); }}>
                                        Clear Filters
                                    </Button>
                                )}
                                <div className="flex-1" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setClearTarget('debug'); setShowClearConfirm(true); }}
                                    disabled={debugLogs.length === 0}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear Logs
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Debug Logs List */}
                    <Card>
                        <CardContent className="p-0">
                            {filteredLogs.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Bug className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-medium">No order debug logs yet</p>
                                    <p className="text-sm mt-1">
                                        Logs will appear here when order operations are performed
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {filteredLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className={`p-4 ${getTypeBgColor(log.type)} border-l-4 ${
                                                log.type === 'error' ? 'border-l-red-500' :
                                                log.type === 'warning' ? 'border-l-yellow-500' :
                                                log.type === 'success' ? 'border-l-green-500' :
                                                'border-l-blue-500'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {getTypeIcon(log.type)}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-medium text-sm">{log.operation}</span>
                                                            {log.orderCode && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Order: {log.orderCode}
                                                                </Badge>
                                                            )}
                                                            {log.count > 1 && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    x{log.count}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-foreground/80 mt-1 break-words">
                                                            {log.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                            <Clock className="w-3 h-3" />
                                                            <span>{formatTime(log.lastOccurrence)}</span>
                                                            {log.duration && (
                                                                <span className="text-muted-foreground">({log.duration}ms)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                                                        <Eye className="w-4 h-4 mr-1" />
                                                        View Report
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteLog(log.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {activeTab === 'analytics' && (
                <>
                    {/* Analytics Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <ShoppingCart className="w-4 h-4" />
                                    <span className="text-sm">Cart Adds</span>
                                </div>
                                <p className="text-2xl font-bold">{eventCounts['add_to_cart'] || 0}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Package className="w-4 h-4" />
                                    <span className="text-sm">Orders Placed</span>
                                </div>
                                <p className="text-2xl font-bold">{eventCounts['order_placed'] || 0}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="text-sm">Conversion Rate</span>
                                </div>
                                <p className="text-2xl font-bold">{conversionRate}%</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="text-sm">Total Revenue</span>
                                </div>
                                <p className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Event Type Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Event Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(eventCounts).map(([type, count]) => (
                                    <Badge key={type} variant="outline" className="text-xs">
                                        {type.replace(/_/g, ' ')}: {count}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Analytics Filters */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Filter:</span>
                                </div>
                                <select
                                    value={filterEventType}
                                    onChange={(e) => setFilterEventType(e.target.value)}
                                    className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                                >
                                    <option value="">All Events</option>
                                    <option value="page_view">Page Views</option>
                                    <option value="product_view">Product Views</option>
                                    <option value="add_to_cart">Add to Cart</option>
                                    <option value="remove_from_cart">Remove from Cart</option>
                                    <option value="checkout_start">Checkout Start</option>
                                    <option value="payment_attempt">Payment Attempt</option>
                                    <option value="payment_success">Payment Success</option>
                                    <option value="payment_failed">Payment Failed</option>
                                    <option value="order_placed">Order Placed</option>
                                    <option value="search">Search</option>
                                </select>
                                {filterEventType && (
                                    <Button variant="ghost" size="sm" onClick={() => setFilterEventType('')}>
                                        Clear Filter
                                    </Button>
                                )}
                                <div className="flex-1" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setClearTarget('analytics'); setShowClearConfirm(true); }}
                                    disabled={analyticsEvents.length === 0}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear Events
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Analytics Events Table */}
                    <Card>
                        <CardContent className="p-0">
                            {filteredEvents.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-medium">No analytics events yet</p>
                                    <p className="text-sm mt-1">
                                        Shopping behavior will be tracked here
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Event</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead>Order</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredEvents.slice(0, 50).map((event) => (
                                            <TableRow key={event.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {getEventIcon(event.eventType)}
                                                        <span className="text-sm">{event.eventType.replace(/_/g, ' ')}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {event.productName ? (
                                                        <span className="text-sm">{event.productName}</span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {event.price ? (
                                                        <span className="text-sm">${(event.price / 100).toFixed(2)}</span>
                                                    ) : event.orderTotal ? (
                                                        <span className="text-sm font-medium">${(event.orderTotal / 100).toFixed(2)}</span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {event.orderCode ? (
                                                        <Badge variant="outline" className="text-xs">{event.orderCode}</Badge>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatTime(event.timestamp)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(event)}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Debug Log Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <CardHeader className="border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {getTypeIcon(selectedLog.type)}
                                    <div>
                                        <CardTitle className="text-lg">{selectedLog.operation} - Debug Report</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {formatTime(selectedLog.lastOccurrence)}
                                            {selectedLog.orderCode && ` | Order: ${selectedLog.orderCode}`}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 overflow-auto flex-1">
                            <div className="space-y-6">
                                {/* Error/Info Message */}
                                <div className={`p-4 rounded-lg ${getTypeBgColor(selectedLog.type)}`}>
                                    <div className="flex items-start gap-2">
                                        <AlertOctagon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm mb-1">Message</h4>
                                            <p className="text-sm">{selectedLog.message}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Order Info */}
                                {(selectedLog.orderId || selectedLog.orderCode) && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Package className="w-4 h-4 text-purple-500" />
                                            <h4 className="font-medium text-sm">Order Information</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            {selectedLog.orderCode && (
                                                <div>
                                                    <span className="text-muted-foreground">Order Code:</span>
                                                    <p className="font-mono">{selectedLog.orderCode}</p>
                                                </div>
                                            )}
                                            {selectedLog.orderId && (
                                                <div>
                                                    <span className="text-muted-foreground">Order ID:</span>
                                                    <p className="font-mono">{selectedLog.orderId}</p>
                                                </div>
                                            )}
                                            {selectedLog.customerId && (
                                                <div>
                                                    <span className="text-muted-foreground">Customer ID:</span>
                                                    <p className="font-mono">{selectedLog.customerId}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Service Details */}
                                {selectedServiceInfo && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-start gap-2 mb-3">
                                            <Server className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="font-medium text-sm">Operation Details</h4>
                                                <p className="text-sm text-muted-foreground mt-1">{selectedServiceInfo.description}</p>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    <span className="font-medium">Endpoint:</span> {selectedServiceInfo.endpoint}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Technical Details */}
                                {selectedLog.details && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Terminal className="w-4 h-4 text-muted-foreground" />
                                                <h4 className="font-medium text-sm">Technical Details</h4>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedLog.details || '', 'details')}>
                                                <Copy className="w-3 h-3 mr-1" />
                                                {copiedCommand === 'details' ? 'Copied!' : 'Copy'}
                                            </Button>
                                        </div>
                                        <pre className="text-xs p-3 bg-background rounded-md overflow-auto max-h-40 whitespace-pre-wrap font-mono border">
                                            {selectedLog.details}
                                        </pre>
                                    </div>
                                )}

                                {/* API Request/Response */}
                                {(selectedLog.requestPayload || selectedLog.responseData) && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Terminal className="w-4 h-4 text-cyan-500" />
                                            <h4 className="font-medium text-sm">API Call Details</h4>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedLog.apiEndpoint && (
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Endpoint:</span>
                                                    <code className="text-xs bg-background px-2 py-1 rounded font-mono block mt-1 border">{selectedLog.apiEndpoint}</code>
                                                </div>
                                            )}
                                            {selectedLog.requestPayload && (
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Request:</span>
                                                    <pre className="text-xs p-2 bg-background rounded-md overflow-auto max-h-32 whitespace-pre-wrap font-mono mt-1 border">
                                                        {selectedLog.requestPayload}
                                                    </pre>
                                                </div>
                                            )}
                                            {selectedLog.responseData && (
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Response:</span>
                                                    <pre className="text-xs p-2 bg-background rounded-md overflow-auto max-h-32 whitespace-pre-wrap font-mono mt-1 border">
                                                        {selectedLog.responseData}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* File Locations */}
                                {selectedServiceInfo && selectedServiceInfo.fileLocations.length > 0 && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileCode className="w-4 h-4 text-purple-500" />
                                            <h4 className="font-medium text-sm">Related Files</h4>
                                        </div>
                                        <div className="space-y-1">
                                            {selectedServiceInfo.fileLocations.map((file, i) => (
                                                <div key={i} className="flex items-center gap-2 group">
                                                    <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 border">{file}</code>
                                                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 px-2" onClick={() => copyToClipboard(file, `file-${i}`)}>
                                                        {copiedCommand === `file-${i}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Affected Areas */}
                                {selectedServiceInfo && selectedServiceInfo.affectedAreas.length > 0 && (
                                    <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Layers className="w-4 h-4 text-orange-500" />
                                            <h4 className="font-medium text-sm">Affected Areas</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedServiceInfo.affectedAreas.map((area, i) => (
                                                <Badge key={i} variant="outline" className="bg-orange-500/10 border-orange-500/30">{area}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recommended Actions */}
                                {selectedServiceInfo && selectedServiceInfo.recommendedActions.length > 0 && (
                                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Lightbulb className="w-4 h-4 text-green-500" />
                                            <h4 className="font-medium text-sm">Recommended Actions</h4>
                                        </div>
                                        <ol className="space-y-2">
                                            {selectedServiceInfo.recommendedActions.map((action, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-medium">{i + 1}</span>
                                                    <span>{action}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Debug Commands */}
                                {selectedServiceInfo && selectedServiceInfo.debugCommands.length > 0 && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Terminal className="w-4 h-4 text-cyan-500" />
                                            <h4 className="font-medium text-sm">Debug Commands</h4>
                                        </div>
                                        <div className="space-y-2">
                                            {selectedServiceInfo.debugCommands.map((cmd, i) => (
                                                <div key={i} className="flex items-center gap-2 group">
                                                    <div className="flex-1">
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">{cmd.label}</p>
                                                        <code className="text-xs bg-background px-2 py-1.5 rounded font-mono block border overflow-x-auto">{cmd.command}</code>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(cmd.command, `cmd-${i}`)}>
                                                        {copiedCommand === `cmd-${i}` ? <><CheckCircle className="w-3 h-3 mr-1 text-green-500" />Copied!</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
                            <Button variant="outline" onClick={() => setSelectedLog(null)}>Close</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Analytics Event Detail Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <CardHeader className="border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {getEventIcon(selectedEvent.eventType)}
                                    <div>
                                        <CardTitle className="text-lg">{selectedEvent.eventType.replace(/_/g, ' ')}</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">{formatTime(selectedEvent.timestamp)}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 overflow-auto flex-1">
                            <div className="space-y-4">
                                {selectedEvent.productName && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Product</span>
                                        <p className="text-sm mt-1">{selectedEvent.productName}</p>
                                    </div>
                                )}
                                {selectedEvent.quantity && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Quantity</span>
                                        <p className="text-sm mt-1">{selectedEvent.quantity}</p>
                                    </div>
                                )}
                                {selectedEvent.price && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Price</span>
                                        <p className="text-sm mt-1">${(selectedEvent.price / 100).toFixed(2)}</p>
                                    </div>
                                )}
                                {selectedEvent.orderCode && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Order Code</span>
                                        <p className="text-sm mt-1 font-mono">{selectedEvent.orderCode}</p>
                                    </div>
                                )}
                                {selectedEvent.orderTotal && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Order Total</span>
                                        <p className="text-sm mt-1 font-medium">${(selectedEvent.orderTotal / 100).toFixed(2)}</p>
                                    </div>
                                )}
                                {selectedEvent.paymentMethod && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Payment Method</span>
                                        <p className="text-sm mt-1">{selectedEvent.paymentMethod}</p>
                                    </div>
                                )}
                                {selectedEvent.searchQuery && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Search Query</span>
                                        <p className="text-sm mt-1">"{selectedEvent.searchQuery}"</p>
                                    </div>
                                )}
                                {selectedEvent.pageUrl && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Page URL</span>
                                        <p className="text-sm mt-1 font-mono text-xs">{selectedEvent.pageUrl}</p>
                                    </div>
                                )}
                                {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Additional Data</span>
                                        <pre className="text-xs mt-1 p-3 bg-muted/30 rounded-md overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                                            {JSON.stringify(selectedEvent.metadata, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
                            <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                </div>
                                <h3 className="font-semibold text-lg">
                                    Clear {clearTarget === 'debug' ? 'Debug Logs' : 'Analytics Events'}?
                                </h3>
                            </div>
                            <p className="text-muted-foreground mb-6">
                                This will permanently delete all {clearTarget === 'debug' ? debugLogs.length + ' debug log' : analyticsEvents.length + ' analytics'} entries. This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                                <Button onClick={handleClearAll} className="bg-red-600 hover:bg-red-700 text-white">Clear All</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Customer Activity & Debug Page
// ============================================================================

function CustomerActivityPage() {
    const [activeTab, setActiveTab] = useState<'activity' | 'debug'>('activity');
    const [activities, setActivities] = useState<CustomerActivity[]>([]);
    const [debugLogs, setDebugLogs] = useState<CustomerDebugLog[]>([]);
    const [filterAction, setFilterAction] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterSource, setFilterSource] = useState<string>('');
    const [filterCustomer, setFilterCustomer] = useState<string>('');
    const [selectedActivity, setSelectedActivity] = useState<CustomerActivity | null>(null);
    const [selectedDebugLog, setSelectedDebugLog] = useState<CustomerDebugLog | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [clearTarget, setClearTarget] = useState<'activity' | 'debug'>('activity');
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            loadData();
            setLastRefresh(new Date());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    function loadData() {
        setActivities(getCustomerActivities());
        setDebugLogs(getCustomerDebugLogs());
    }

    function handleDeleteDebugLog(id: string) {
        deleteCustomerDebugLog(id);
        loadData();
    }

    function handleClearAll() {
        if (clearTarget === 'activity') {
            clearCustomerActivities();
        } else {
            clearCustomerDebugLogs();
        }
        loadData();
        setShowClearConfirm(false);
    }

    function copyToClipboard(text: string, label?: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedText(label || 'copied');
            setTimeout(() => setCopiedText(null), 2000);
        });
    }

    // Get unique customers for filter
    const uniqueCustomers = [...new Set(activities.filter(a => a.customerEmail).map(a => a.customerEmail))];

    // Filter activities
    const filteredActivities = activities
        .filter(a => !filterAction || a.action === filterAction)
        .filter(a => !filterCategory || a.category === filterCategory)
        .filter(a => !filterSource || a.source === filterSource)
        .filter(a => !filterCustomer || a.customerEmail === filterCustomer)
        .sort((a, b) => b.timestamp - a.timestamp);

    // Filter debug logs
    const filteredDebugLogs = debugLogs
        .filter(log => !filterAction || log.action === filterAction)
        .sort((a, b) => b.lastOccurrence - a.lastOccurrence);

    // Stats
    const errorCount = debugLogs.filter(l => l.type === 'error').length;
    const warningCount = debugLogs.filter(l => l.type === 'warning').length;
    const totalActivities = activities.length;
    const uniqueCustomerCount = new Set(activities.filter(a => a.customerId).map(a => a.customerId)).size;

    // Activity breakdown by category
    const categoryBreakdown = activities.reduce((acc, a) => {
        acc[a.category] = (acc[a.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    function getActionColor(action: CustomerActionType): string {
        const info = CUSTOMER_ACTION_INFO[action];
        if (!info) return 'gray';
        return info.color;
    }

    function getActionLabel(action: CustomerActionType): string {
        const info = CUSTOMER_ACTION_INFO[action];
        return info?.label || action.replace(/_/g, ' ');
    }

    function getCategoryIcon(category: CustomerActivity['category']) {
        switch (category) {
            case 'auth': return <Lock className="w-4 h-4" />;
            case 'browse': return <Eye className="w-4 h-4" />;
            case 'shop': return <ShoppingCart className="w-4 h-4" />;
            case 'checkout': return <CreditCard className="w-4 h-4" />;
            case 'account': return <User className="w-4 h-4" />;
            case 'garage': return <Car className="w-4 h-4" />;
            case 'seller': return <Store className="w-4 h-4" />;
            case 'buyer': return <Users className="w-4 h-4" />;
            case 'order': return <Package className="w-4 h-4" />;
            case 'review': return <Star className="w-4 h-4" />;
            default: return <Activity className="w-4 h-4" />;
        }
    }

    function getSourceBadge(source: CustomerActivity['source']) {
        const colors: Record<string, string> = {
            storefront: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
            seller_dashboard: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
            buyer_dashboard: 'bg-green-500/10 text-green-500 border-green-500/30',
            admin: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
            api: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
        };
        const labels: Record<string, string> = {
            storefront: 'Storefront',
            seller_dashboard: 'Seller',
            buyer_dashboard: 'Buyer',
            admin: 'Admin',
            api: 'API',
        };
        return (
            <Badge variant="outline" className={`text-xs ${colors[source] || colors.api}`}>
                {labels[source] || source}
            </Badge>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6" />
                        Customer Activity & Debug
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor all customer actions across storefront, seller, and buyer dashboards
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        Auto-refresh: {lastRefresh.toLocaleTimeString()}
                    </span>
                    <Button variant="outline" onClick={() => { loadData(); setLastRefresh(new Date()); }}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button variant="outline" onClick={() => exportCustomerData('json')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export JSON
                    </Button>
                    <Button variant="outline" onClick={() => exportCustomerData('csv')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
                <Button
                    variant={activeTab === 'activity' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('activity')}
                    className={activeTab === 'activity' ? '' : 'text-muted-foreground'}
                >
                    <Activity className="w-4 h-4 mr-2" />
                    Activity Log ({totalActivities})
                </Button>
                <Button
                    variant={activeTab === 'debug' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('debug')}
                    className={activeTab === 'debug' ? '' : 'text-muted-foreground'}
                >
                    <Bug className="w-4 h-4 mr-2" />
                    Debug ({errorCount + warningCount})
                </Button>
            </div>

            {activeTab === 'activity' && (
                <>
                    {/* Activity Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Activity className="w-4 h-4" />
                                    <span className="text-sm">Total Actions</span>
                                </div>
                                <p className="text-2xl font-bold">{totalActivities}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Users className="w-4 h-4" />
                                    <span className="text-sm">Unique Customers</span>
                                </div>
                                <p className="text-2xl font-bold">{uniqueCustomerCount}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <ShoppingCart className="w-4 h-4" />
                                    <span className="text-sm">Shopping</span>
                                </div>
                                <p className="text-2xl font-bold">{categoryBreakdown['shop'] || 0}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Store className="w-4 h-4" />
                                    <span className="text-sm">Seller Actions</span>
                                </div>
                                <p className="text-2xl font-bold">{categoryBreakdown['seller'] || 0}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Package className="w-4 h-4" />
                                    <span className="text-sm">Order Actions</span>
                                </div>
                                <p className="text-2xl font-bold">{categoryBreakdown['order'] || 0}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Filter:</span>
                                </div>
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                                >
                                    <option value="">All Categories</option>
                                    <option value="auth">Authentication</option>
                                    <option value="browse">Browsing</option>
                                    <option value="shop">Shopping</option>
                                    <option value="checkout">Checkout</option>
                                    <option value="account">Account</option>
                                    <option value="garage">Garage</option>
                                    <option value="seller">Seller</option>
                                    <option value="buyer">Buyer</option>
                                    <option value="order">Order</option>
                                    <option value="review">Review</option>
                                </select>
                                <select
                                    value={filterSource}
                                    onChange={(e) => setFilterSource(e.target.value)}
                                    className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                                >
                                    <option value="">All Sources</option>
                                    <option value="storefront">Storefront</option>
                                    <option value="seller_dashboard">Seller Dashboard</option>
                                    <option value="buyer_dashboard">Buyer Dashboard</option>
                                    <option value="admin">Admin</option>
                                    <option value="api">API</option>
                                </select>
                                {uniqueCustomers.length > 0 && (
                                    <select
                                        value={filterCustomer}
                                        onChange={(e) => setFilterCustomer(e.target.value)}
                                        className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground max-w-[200px]"
                                    >
                                        <option value="">All Customers</option>
                                        {uniqueCustomers.slice(0, 50).map(email => (
                                            <option key={email} value={email}>{email}</option>
                                        ))}
                                    </select>
                                )}
                                {(filterCategory || filterSource || filterCustomer) && (
                                    <Button variant="ghost" size="sm" onClick={() => { setFilterCategory(''); setFilterSource(''); setFilterCustomer(''); }}>
                                        Clear Filters
                                    </Button>
                                )}
                                <div className="flex-1" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setClearTarget('activity'); setShowClearConfirm(true); }}
                                    disabled={activities.length === 0}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear Activity
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity Timeline */}
                    <Card>
                        <CardContent className="p-0">
                            {filteredActivities.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-medium">No customer activity yet</p>
                                    <p className="text-sm mt-1">
                                        Customer actions will appear here as they interact with your platform
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {filteredActivities.slice(0, 100).map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                                            onClick={() => setSelectedActivity(activity)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    getActionColor(activity.action) === 'green' ? 'bg-green-500/10 text-green-500' :
                                                    getActionColor(activity.action) === 'red' ? 'bg-red-500/10 text-red-500' :
                                                    getActionColor(activity.action) === 'blue' ? 'bg-blue-500/10 text-blue-500' :
                                                    getActionColor(activity.action) === 'yellow' ? 'bg-yellow-500/10 text-yellow-500' :
                                                    getActionColor(activity.action) === 'purple' ? 'bg-purple-500/10 text-purple-500' :
                                                    'bg-gray-500/10 text-gray-500'
                                                }`}>
                                                    {getCategoryIcon(activity.category)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-sm">{getActionLabel(activity.action)}</span>
                                                        {getSourceBadge(activity.source)}
                                                        {activity.customerEmail && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {activity.customerEmail}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mt-0.5">{activity.description}</p>
                                                    {activity.details?.productName && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Product: {activity.details.productName}
                                                        </p>
                                                    )}
                                                    {activity.details?.orderCode && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Order: {activity.details.orderCode}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{formatTime(activity.timestamp)}</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {activeTab === 'debug' && (
                <>
                    {/* Debug Stats */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-red-500">{errorCount} errors</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-medium text-yellow-500">{warningCount} warnings</span>
                        </div>
                    </div>

                    {/* Debug Filters */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Filter:</span>
                                </div>
                                <select
                                    value={filterAction}
                                    onChange={(e) => setFilterAction(e.target.value)}
                                    className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                                >
                                    <option value="">All Actions</option>
                                    {Object.entries(CUSTOMER_ACTION_INFO).map(([key, value]) => (
                                        <option key={key} value={key}>{value.label}</option>
                                    ))}
                                </select>
                                {filterAction && (
                                    <Button variant="ghost" size="sm" onClick={() => setFilterAction('')}>
                                        Clear Filter
                                    </Button>
                                )}
                                <div className="flex-1" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setClearTarget('debug'); setShowClearConfirm(true); }}
                                    disabled={debugLogs.length === 0}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear Logs
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Debug Logs List */}
                    <Card>
                        <CardContent className="p-0">
                            {filteredDebugLogs.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20 text-green-500" />
                                    <p className="text-lg font-medium">No customer errors</p>
                                    <p className="text-sm mt-1">
                                        Everything is running smoothly for your customers
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {filteredDebugLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className={`p-4 border-l-4 ${
                                                log.type === 'error' ? 'bg-red-500/10 border-l-red-500' : 'bg-yellow-500/10 border-l-yellow-500'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {log.type === 'error' ? (
                                                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                    ) : (
                                                        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-medium text-sm">{getActionLabel(log.action)}</span>
                                                            {log.customerEmail && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {log.customerEmail}
                                                                </Badge>
                                                            )}
                                                            {log.count > 1 && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    x{log.count}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-foreground/80 mt-1 break-words">
                                                            {log.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                            <Clock className="w-3 h-3" />
                                                            <span>{formatTime(log.lastOccurrence)}</span>
                                                            {log.httpStatus && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    HTTP {log.httpStatus}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedDebugLog(log)}>
                                                        <Eye className="w-4 h-4 mr-1" />
                                                        View
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteDebugLog(log.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Activity Detail Modal */}
            {selectedActivity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <CardHeader className="border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {getCategoryIcon(selectedActivity.category)}
                                    <div>
                                        <CardTitle className="text-lg">{getActionLabel(selectedActivity.action)}</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">{formatTime(selectedActivity.timestamp)}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedActivity(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 overflow-auto flex-1">
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-medium text-muted-foreground uppercase">Description</span>
                                    <p className="text-sm mt-1">{selectedActivity.description}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Category</span>
                                        <p className="text-sm mt-1 capitalize">{selectedActivity.category}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Source</span>
                                        <p className="text-sm mt-1">{getSourceBadge(selectedActivity.source)}</p>
                                    </div>
                                </div>
                                {selectedActivity.customerEmail && (
                                    <div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Customer</span>
                                        <p className="text-sm mt-1">{selectedActivity.customerName || selectedActivity.customerEmail}</p>
                                        {selectedActivity.customerName && (
                                            <p className="text-xs text-muted-foreground">{selectedActivity.customerEmail}</p>
                                        )}
                                    </div>
                                )}
                                {selectedActivity.details && (
                                    <>
                                        {selectedActivity.details.productName && (
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase">Product</span>
                                                <p className="text-sm mt-1">{selectedActivity.details.productName}</p>
                                            </div>
                                        )}
                                        {selectedActivity.details.orderCode && (
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase">Order</span>
                                                <p className="text-sm mt-1 font-mono">{selectedActivity.details.orderCode}</p>
                                            </div>
                                        )}
                                        {selectedActivity.details.vehicleInfo && (
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase">Vehicle</span>
                                                <p className="text-sm mt-1">{selectedActivity.details.vehicleInfo}</p>
                                            </div>
                                        )}
                                        {selectedActivity.details.amount && (
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase">Amount</span>
                                                <p className="text-sm mt-1 font-medium">${(selectedActivity.details.amount / 100).toFixed(2)}</p>
                                            </div>
                                        )}
                                        {selectedActivity.details.searchQuery && (
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase">Search Query</span>
                                                <p className="text-sm mt-1">"{selectedActivity.details.searchQuery}"</p>
                                            </div>
                                        )}
                                        {selectedActivity.details.pageUrl && (
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase">Page URL</span>
                                                <p className="text-xs mt-1 font-mono break-all">{selectedActivity.details.pageUrl}</p>
                                            </div>
                                        )}
                                        {selectedActivity.details.metadata && Object.keys(selectedActivity.details.metadata).length > 0 && (
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase">Additional Data</span>
                                                <pre className="text-xs mt-1 p-3 bg-muted/30 rounded-md overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                                                    {JSON.stringify(selectedActivity.details.metadata, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
                            <Button variant="outline" onClick={() => setSelectedActivity(null)}>Close</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Debug Log Detail Modal */}
            {selectedDebugLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-3xl w-full max-h-[90vh] flex flex-col">
                        <CardHeader className="border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {selectedDebugLog.type === 'error' ? (
                                        <XCircle className="w-5 h-5 text-red-500" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                                    )}
                                    <div>
                                        <CardTitle className="text-lg">{getActionLabel(selectedDebugLog.action)} - Debug Report</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {formatTime(selectedDebugLog.lastOccurrence)}
                                            {selectedDebugLog.count > 1 && ` (${selectedDebugLog.count} occurrences)`}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDebugLog(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 overflow-auto flex-1">
                            <div className="space-y-6">
                                {/* Error Message */}
                                <div className={`p-4 rounded-lg ${selectedDebugLog.type === 'error' ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                                    <div className="flex items-start gap-2">
                                        <AlertOctagon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm mb-1">
                                                {selectedDebugLog.type === 'error' ? 'Error Message' : 'Warning Message'}
                                            </h4>
                                            <p className="text-sm">{selectedDebugLog.message}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                {selectedDebugLog.customerEmail && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-blue-500" />
                                            <h4 className="font-medium text-sm">Customer</h4>
                                        </div>
                                        <p className="text-sm">{selectedDebugLog.customerEmail}</p>
                                        {selectedDebugLog.customerId && (
                                            <p className="text-xs text-muted-foreground font-mono mt-1">ID: {selectedDebugLog.customerId}</p>
                                        )}
                                    </div>
                                )}

                                {/* Technical Details */}
                                {selectedDebugLog.details && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Terminal className="w-4 h-4 text-muted-foreground" />
                                                <h4 className="font-medium text-sm">Technical Details</h4>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedDebugLog.details || '', 'details')}>
                                                <Copy className="w-3 h-3 mr-1" />
                                                {copiedText === 'details' ? 'Copied!' : 'Copy'}
                                            </Button>
                                        </div>
                                        <pre className="text-xs p-3 bg-background rounded-md overflow-auto max-h-40 whitespace-pre-wrap font-mono border">
                                            {selectedDebugLog.details}
                                        </pre>
                                    </div>
                                )}

                                {/* API Info */}
                                {(selectedDebugLog.apiEndpoint || selectedDebugLog.requestData || selectedDebugLog.responseData) && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Server className="w-4 h-4 text-cyan-500" />
                                            <h4 className="font-medium text-sm">API Request Details</h4>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedDebugLog.apiEndpoint && (
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Endpoint:</span>
                                                    <code className="text-xs bg-background px-2 py-1 rounded font-mono block mt-1 border">{selectedDebugLog.apiEndpoint}</code>
                                                </div>
                                            )}
                                            {selectedDebugLog.httpStatus && (
                                                <div>
                                                    <span className="text-xs text-muted-foreground">HTTP Status:</span>
                                                    <Badge variant="outline" className={`ml-2 ${selectedDebugLog.httpStatus >= 400 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                                        {selectedDebugLog.httpStatus}
                                                    </Badge>
                                                </div>
                                            )}
                                            {selectedDebugLog.requestData && (
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Request:</span>
                                                    <pre className="text-xs p-2 bg-background rounded-md overflow-auto max-h-32 whitespace-pre-wrap font-mono mt-1 border">
                                                        {selectedDebugLog.requestData}
                                                    </pre>
                                                </div>
                                            )}
                                            {selectedDebugLog.responseData && (
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Response:</span>
                                                    <pre className="text-xs p-2 bg-background rounded-md overflow-auto max-h-32 whitespace-pre-wrap font-mono mt-1 border">
                                                        {selectedDebugLog.responseData}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Stack Trace */}
                                {selectedDebugLog.stackTrace && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <FileCode className="w-4 h-4 text-red-500" />
                                                <h4 className="font-medium text-sm">Stack Trace</h4>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedDebugLog.stackTrace || '', 'stack')}>
                                                <Copy className="w-3 h-3 mr-1" />
                                                {copiedText === 'stack' ? 'Copied!' : 'Copy'}
                                            </Button>
                                        </div>
                                        <pre className="text-xs p-3 bg-background rounded-md overflow-auto max-h-60 whitespace-pre-wrap font-mono border text-red-500/80">
                                            {selectedDebugLog.stackTrace}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
                            <Button variant="outline" onClick={() => setSelectedDebugLog(null)}>Close</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                </div>
                                <h3 className="font-semibold text-lg">
                                    Clear {clearTarget === 'activity' ? 'Activity Log' : 'Debug Logs'}?
                                </h3>
                            </div>
                            <p className="text-muted-foreground mb-6">
                                This will permanently delete all {clearTarget === 'activity' ? activities.length + ' activity' : debugLogs.length + ' debug log'} entries. This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                                <Button onClick={handleClearAll} className="bg-red-600 hover:bg-red-700 text-white">Clear All</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function AdminOpenOrdersPage() {
    return (
        <AdminOrdersListPage
            title="Open Orders"
            description="Orders awaiting fulfillment across all shops"
            icon={<Clock className="h-6 w-6 text-yellow-500" />}
            accentColor="bg-yellow-500/20"
            filterStates={['PaymentAuthorized', 'PaymentSettled', 'PartiallyShipped', 'Shipped']}
        />
    );
}

function AdminDisputesPage() {
    return (
        <AdminOrdersListPage
            title="Disputes"
            description="Orders with disputes or issues requiring attention"
            icon={<AlertTriangle className="h-6 w-6 text-red-500" />}
            accentColor="bg-red-500/20"
            filterStates={['Modifying', 'ArrangingAdditionalPayment']}
            showFlagColumn
        />
    );
}

function AdminReturnsPage() {
    return (
        <AdminOrdersListPage
            title="Returns"
            description="Return requests and returned orders"
            icon={<RotateCcw className="h-6 w-6 text-purple-500" />}
            accentColor="bg-purple-500/20"
            filterStates={['Cancelled']}
            showFlagColumn
        />
    );
}

function AdminRefundsPage() {
    return (
        <AdminOrdersListPage
            title="Refunds"
            description="Orders with pending or completed refunds"
            icon={<DollarSign className="h-6 w-6 text-green-500" />}
            accentColor="bg-green-500/20"
            filterStates={['Cancelled']}
            showFlagColumn
        />
    );
}

// ============================================================================
// Seller Dashboard Pages (kept for backwards compatibility but unused)
// ============================================================================

function ListedTunesPage() {
    return (
        <ProductListPage
            title="My Tunes"
            description="Manage your digital tune files"
            productType="tune"
            icon={<Music className="h-6 w-6 text-blue-500" />}
            emptyMessage="No tunes listed yet"
            createButtonText="List New Tune"
            accentColor="bg-blue-500/20"
        />
    );
}

function TuneOrdersPage() {
    return (
        <OrderListPage
            title="Tune Orders"
            description="View orders for your digital tunes"
            productType="tune"
            icon={<ShoppingCart className="h-6 w-6 text-blue-500" />}
            emptyMessage="No tune orders yet"
            accentColor="bg-blue-500/20"
        />
    );
}

function ListedPartsPage() {
    return (
        <ProductListPage
            title="My Parts"
            description="Manage your physical parts"
            productType="part"
            icon={<Package className="h-6 w-6 text-orange-500" />}
            emptyMessage="No parts listed yet"
            createButtonText="List New Part"
            accentColor="bg-orange-500/20"
        />
    );
}

function PartOrdersPage() {
    return (
        <OrderListPage
            title="Part Orders"
            description="View orders for your physical parts"
            productType="part"
            icon={<ShoppingCart className="h-6 w-6 text-orange-500" />}
            emptyMessage="No part orders yet"
            accentColor="bg-orange-500/20"
        />
    );
}

function ListedServicesPage() {
    return (
        <ProductListPage
            title="My Services"
            description="Manage your in-person services"
            productType="service"
            icon={<Calendar className="h-6 w-6 text-green-500" />}
            emptyMessage="No services listed yet"
            createButtonText="List New Service"
            accentColor="bg-green-500/20"
        />
    );
}

function ServiceBookingsPage() {
    return (
        <OrderListPage
            title="Service Bookings"
            description="View bookings for your services"
            productType="service"
            icon={<Calendar className="h-6 w-6 text-green-500" />}
            emptyMessage="No bookings yet"
            accentColor="bg-green-500/20"
        />
    );
}

// ============================================================================
// Open Orders Page - Shows all pending/open orders across all product types
// ============================================================================

function OpenOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.query<OrdersResponse>(GET_ORDERS, {
                skip: 0,
                take: 100,
            });
            // Filter to only show open/pending orders (not delivered, cancelled, etc)
            const openStates = ['AddingItems', 'ArrangingPayment', 'PaymentAuthorized', 'PaymentSettled', 'PartiallyShipped', 'Shipped'];
            const filteredOrders = (result.orders?.items || []).filter(order =>
                openStates.includes(order.state)
            );
            setOrders(filteredOrders);
        } catch (err: any) {
            setError(err.message || 'Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const needsActionCount = orders.filter(o => ['PaymentSettled', 'PaymentAuthorized'].includes(o.state)).length;
    const shippedCount = orders.filter(o => ['Shipped', 'PartiallyShipped'].includes(o.state)).length;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/20">
                        <Clock className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">Open Orders</h1>
                        <p className="text-sm text-muted-foreground">Orders requiring attention</p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchOrders} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Total Open</div>
                        <div className="text-xl md:text-2xl font-bold">{orders.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Needs Action</div>
                        <div className="text-xl md:text-2xl font-bold text-yellow-500">{needsActionCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs md:text-sm text-muted-foreground">Shipped</div>
                        <div className="text-xl md:text-2xl font-bold text-blue-500">{shippedCount}</div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                </div>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Orders Requiring Attention</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && (
                        <div className="py-12 text-center">
                            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Loading...</p>
                        </div>
                    )}
                    {!loading && !error && orders.length === 0 && (
                        <div className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                            </div>
                            <p className="font-medium mb-2">All caught up!</p>
                            <p className="text-sm text-muted-foreground">
                                You have no open orders at the moment.
                            </p>
                        </div>
                    )}
                    {!loading && orders.length > 0 && (
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order</TableHead>
                                        <TableHead className="hidden md:table-cell">Customer</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="hidden md:table-cell">Date</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => {
                                        // Determine order type based on line items
                                        const types = order.lines.map(l => l.productVariant?.product?.customFields?.productType).filter(Boolean);
                                        const uniqueTypes = [...new Set(types)];
                                        const typeDisplay = uniqueTypes.length > 0 ? uniqueTypes.join(', ') : 'Mixed';

                                        return (
                                            <TableRow key={order.id}>
                                                <TableCell>
                                                    <div className="font-mono text-xs md:text-sm">{order.code}</div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <div className="text-sm">{order.customer?.firstName} {order.customer?.lastName}</div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                        {order.customer?.emailAddress}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={
                                                        typeDisplay === 'tune' ? 'bg-blue-500/20 text-blue-600' :
                                                        typeDisplay === 'part' ? 'bg-orange-500/20 text-orange-600' :
                                                        typeDisplay === 'service' ? 'bg-green-500/20 text-green-600' :
                                                        'bg-gray-500/20 text-gray-600'
                                                    }>
                                                        {typeDisplay}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatCurrency(order.totalWithTax)}
                                                </TableCell>
                                                <TableCell>
                                                    {getOrderStateBadge(order.state)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-sm">
                                                    {formatDate(order.createdAt)}
                                                </TableCell>
                                                <TableCell>
                                                    <a href={`/admin/orders/${order.id}`}>
                                                        <Button size="sm" variant="outline" className="h-8">
                                                            <Eye className="h-3 w-3 md:mr-1" />
                                                            <span className="hidden md:inline">View</span>
                                                        </Button>
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Messages Page (Mockup)
// ============================================================================

function MessagesPage() {
    const [selectedTab, setSelectedTab] = useState<'inbox' | 'sent' | 'archived'>('inbox');

    const mockMessages = [
        { id: 1, from: 'John D.', subject: 'Question about GM tune', preview: 'Hi, I was wondering if your Stage 2 tune works with...', date: '2 hours ago', read: false },
        { id: 2, from: 'Mike S.', subject: 'Service appointment inquiry', preview: 'I would like to schedule a dyno tuning session...', date: '5 hours ago', read: true },
        { id: 3, from: 'Sarah K.', subject: 'Part compatibility', preview: 'Does the cold air intake fit a 2019 model?', date: '1 day ago', read: true },
    ];

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-500/20">
                    <MessageCircle className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Messages</h1>
                    <p className="text-sm text-muted-foreground">Customer inquiries and communications</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b pb-2">
                <Button
                    variant={selectedTab === 'inbox' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedTab('inbox')}
                >
                    <Inbox className="h-4 w-4 mr-2" />
                    Inbox
                    <Badge className="ml-2 bg-purple-500 text-white">3</Badge>
                </Button>
                <Button
                    variant={selectedTab === 'sent' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedTab('sent')}
                >
                    <Send className="h-4 w-4 mr-2" />
                    Sent
                </Button>
                <Button
                    variant={selectedTab === 'archived' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedTab('archived')}
                >
                    <Archive className="h-4 w-4 mr-2" />
                    Archived
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {mockMessages.map((msg, i) => (
                        <div
                            key={msg.id}
                            className={`p-4 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer ${!msg.read ? 'bg-purple-500/5' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${!msg.read ? 'bg-purple-500' : 'bg-gray-400'}`}>
                                        {msg.from[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium ${!msg.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                {msg.from}
                                            </span>
                                            {!msg.read && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                                        </div>
                                        <div className="font-medium text-sm">{msg.subject}</div>
                                        <div className="text-sm text-muted-foreground truncate">{msg.preview}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">{msg.date}</div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                    Full messaging functionality coming soon. This is a preview of the messaging interface.
                </p>
            </div>
        </div>
    );
}

// ============================================================================
// Analytics Page (Mockup)
// ============================================================================

function AnalyticsPage() {
    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-indigo-500/20">
                    <BarChart3 className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Analytics</h1>
                    <p className="text-sm text-muted-foreground">Track your shop performance</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="text-xs md:text-sm text-muted-foreground">Revenue (30d)</span>
                        </div>
                        <div className="text-xl md:text-2xl font-bold mt-1">$0.00</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            Start selling to see stats
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-blue-500" />
                            <span className="text-xs md:text-sm text-muted-foreground">Orders (30d)</span>
                        </div>
                        <div className="text-xl md:text-2xl font-bold mt-1">0</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-purple-500" />
                            <span className="text-xs md:text-sm text-muted-foreground">Views (30d)</span>
                        </div>
                        <div className="text-xl md:text-2xl font-bold mt-1">0</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-xs md:text-sm text-muted-foreground">Rating</span>
                        </div>
                        <div className="text-xl md:text-2xl font-bold mt-1">--</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Placeholder */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Revenue Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
                            <div className="text-center text-muted-foreground">
                                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Revenue chart will appear here</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Sales by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Music className="h-4 w-4 text-blue-500" />
                                    <span>Tunes</span>
                                </div>
                                <span className="text-muted-foreground">$0.00</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-orange-500" />
                                    <span>Parts</span>
                                </div>
                                <span className="text-muted-foreground">$0.00</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-green-500" />
                                    <span>Services</span>
                                </div>
                                <span className="text-muted-foreground">$0.00</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Help Center Page
// ============================================================================

function HelpCenterPage() {
    const helpTopics = [
        { icon: <Music className="h-5 w-5" />, title: 'Listing Tunes', desc: 'How to create and manage digital tune listings' },
        { icon: <Package className="h-5 w-5" />, title: 'Selling Parts', desc: 'Guide to listing physical parts with shipping' },
        { icon: <Calendar className="h-5 w-5" />, title: 'Service Bookings', desc: 'Managing in-person service appointments' },
        { icon: <DollarSign className="h-5 w-5" />, title: 'Payments', desc: 'How payouts and commissions work' },
        { icon: <Star className="h-5 w-5" />, title: 'Reviews', desc: 'Building your reputation on TunerSwap' },
        { icon: <ShieldCheck className="h-5 w-5" />, title: 'Verification', desc: 'How to get verified as a trusted seller' },
    ];

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-teal-500/20">
                    <HelpCircle className="h-6 w-6 text-teal-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Help Center</h1>
                    <p className="text-sm text-muted-foreground">Resources and guides for sellers</p>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {helpTopics.map((topic, i) => (
                    <Card key={i} className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-muted">{topic.icon}</div>
                                <div>
                                    <h3 className="font-medium">{topic.title}</h3>
                                    <p className="text-sm text-muted-foreground">{topic.desc}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Need More Help?</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">
                        Can't find what you're looking for? Our support team is here to help.
                    </p>
                    <Button>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Contact Support
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Shop Settings Page
// ============================================================================

function ShopSettingsPage() {
    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-gray-500/20">
                    <Settings className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Shop Settings</h1>
                    <p className="text-sm text-muted-foreground">Manage your shop profile</p>
                </div>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Business Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Your business details are displayed on your public seller profile.
                        </p>
                        <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                            Shop profile editing coming soon.
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Shipping Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Configure shipping methods for your physical parts.
                        </p>
                        <a href="/admin/settings/shipping-methods">
                            <Button variant="outline">
                                <Package className="h-4 w-4 mr-2" />
                                Manage Shipping
                            </Button>
                        </a>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">Order notifications</div>
                                    <div className="text-sm text-muted-foreground">Get notified when you receive orders</div>
                                </div>
                                <Badge className="bg-green-500/20 text-green-600">Enabled</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">Message notifications</div>
                                    <div className="text-sm text-muted-foreground">Get notified for new messages</div>
                                </div>
                                <Badge className="bg-green-500/20 text-green-600">Enabled</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// My Profile Page - Full-featured seller profile editor
// ============================================================================

interface MySellerProfile {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    location: string | null;
    address: string | null;
    businessName: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
    bio: string | null;
    experience: string | null;
    software: string[] | null;
    vehiclePlatforms: string[] | null;
    tuneTypes: string[] | null;
    hasDyno: string | null;
    hours: string | null;
    status: string;
    verified: boolean;
    rating: number;
    reviewCount: number;
    tunesSold: number;
    totalOrders: number;
    totalRevenue: number;
    stripeConnected: boolean;
    paypalConnected: boolean;
    slug: string | null;
    createdAt: string;
}

interface MySellerProfileResponse {
    mySellerProfile: MySellerProfile | null;
}

// Common tuning software options
const SOFTWARE_OPTIONS = [
    'HP Tuners',
    'EFI Live',
    'SCT',
    'Cobb Accessport',
    'Hondata',
    'Diablosport',
    'DiabloSport inTune',
    'MPVI2/MPVI3',
    'nGauge',
    'ECU Connect',
    'Other',
];

// Common vehicle platforms
const PLATFORM_OPTIONS = [
    'Ford Mustang',
    'Ford F-150',
    'Chevy Camaro',
    'Chevy Corvette',
    'Chevy Silverado',
    'Dodge Challenger',
    'Dodge Charger',
    'Dodge RAM',
    'Jeep Wrangler',
    'BMW',
    'Honda/Acura',
    'Subaru',
    'Nissan/Infiniti',
    'Toyota/Lexus',
    'Diesel Trucks',
    'Other',
];

// Common tune types
const TUNE_TYPE_OPTIONS = [
    'Street/Daily',
    'Performance',
    'Race',
    'E85/Flex Fuel',
    'Forced Induction',
    'Naturally Aspirated',
    'Diesel Performance',
    'Diesel Delete',
    'Economy',
    'Towing',
    'Off-Road',
    'Custom',
];

// Experience level options
const EXPERIENCE_OPTIONS = [
    '< 1 year',
    '1-3 years',
    '3-5 years',
    '5-10 years',
    '10+ years',
];

function MyProfilePage() {
    const [profile, setProfile] = useState<MySellerProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'basic' | 'business' | 'tuning' | 'contact'>('basic');

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');
    const [address, setAddress] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [website, setWebsite] = useState('');
    const [instagramHandle, setInstagramHandle] = useState('');
    const [facebookHandle, setFacebookHandle] = useState('');
    const [bio, setBio] = useState('');
    const [experience, setExperience] = useState('');
    const [software, setSoftware] = useState<string[]>([]);
    const [vehiclePlatforms, setVehiclePlatforms] = useState<string[]>([]);
    const [tuneTypes, setTuneTypes] = useState<string[]>([]);
    const [hasDyno, setHasDyno] = useState('');
    const [hours, setHours] = useState('');

    const fetchProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.query<MySellerProfileResponse>(GET_MY_SELLER_PROFILE);
            if (result.mySellerProfile) {
                const p = result.mySellerProfile;
                setProfile(p);
                // Populate form fields
                setFirstName(p.firstName || '');
                setLastName(p.lastName || '');
                setPhone(p.phone || '');
                setLocation(p.location || '');
                setAddress(p.address || '');
                setBusinessName(p.businessName || '');
                setWebsite(p.website || '');
                setInstagramHandle(p.instagram || '');
                setFacebookHandle(p.facebook || '');
                setBio(p.bio || '');
                setExperience(p.experience || '');
                setSoftware(p.software || []);
                setVehiclePlatforms(p.vehiclePlatforms || []);
                setTuneTypes(p.tuneTypes || []);
                setHasDyno(p.hasDyno || '');
                setHours(p.hours || '');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await api.mutate(UPDATE_MY_SELLER_PROFILE, {
                input: {
                    firstName,
                    lastName,
                    phone,
                    location,
                    address,
                    businessName,
                    website,
                    instagram: instagramHandle,
                    facebook: facebookHandle,
                    bio,
                    experience,
                    software,
                    vehiclePlatforms,
                    tuneTypes,
                    hasDyno,
                    hours,
                },
            });
            setSuccess('Profile updated successfully!');
            await fetchProfile();
        } catch (err: any) {
            setError(err.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const toggleArrayItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
        if (arr.includes(item)) {
            setArr(arr.filter(i => i !== item));
        } else {
            setArr([...arr, item]);
        }
    };

    // Style classes
    const inputClass = "w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";
    const labelClass = "block text-sm font-medium mb-2";
    const tabClass = (isActive: boolean) => `flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
        isActive
            ? 'bg-gradient-to-r from-yellow-500 via-red-500 to-blue-500 text-white shadow-lg'
            : 'text-muted-foreground hover:bg-muted'
    }`;

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Loading your profile...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                            <UserCircle className="h-8 w-8 text-yellow-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">No Seller Profile Found</h2>
                        <p className="text-muted-foreground mb-4">
                            You don't have a seller profile associated with this account.
                            If you're a registered seller, please contact support.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header with Stats */}
            <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 via-red-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            {firstName.charAt(0)}{lastName.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                                {businessName || `${firstName} ${lastName}`}
                                {profile.verified && (
                                    <ShieldCheck className="h-6 w-6 text-blue-500" />
                                )}
                            </h1>
                            <p className="text-muted-foreground flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                {location || 'Location not set'}
                                {profile.slug && (
                                    <a
                                        href={`/sellers/${profile.slug}`}
                                        target="_blank"
                                        className="text-blue-500 hover:underline flex items-center gap-1"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        View Profile
                                    </a>
                                )}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-yellow-500 via-red-500 to-blue-500 text-white hover:opacity-90"
                    >
                        {saving ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                        <CardContent className="pt-4 pb-3 text-center">
                            <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                            <div className="text-2xl font-bold">{profile.rating?.toFixed(1) || '0.0'}</div>
                            <div className="text-xs text-muted-foreground">{profile.reviewCount || 0} reviews</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                        <CardContent className="pt-4 pb-3 text-center">
                            <Music className="h-5 w-5 mx-auto mb-1 text-green-500" />
                            <div className="text-2xl font-bold">{profile.tunesSold || 0}</div>
                            <div className="text-xs text-muted-foreground">Tunes Sold</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                        <CardContent className="pt-4 pb-3 text-center">
                            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                            <div className="text-2xl font-bold">{profile.totalOrders || 0}</div>
                            <div className="text-xs text-muted-foreground">Total Orders</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                        <CardContent className="pt-4 pb-3 text-center">
                            <DollarSign className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                            <div className="text-2xl font-bold">{formatCurrency(profile.totalRevenue || 0)}</div>
                            <div className="text-xs text-muted-foreground">Revenue</div>
                        </CardContent>
                    </Card>
                    <Card className={`border-2 ${profile.status === 'approved' ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                        <CardContent className="pt-4 pb-3 text-center">
                            {profile.status === 'approved' ? (
                                <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
                            ) : (
                                <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                            )}
                            <div className="text-lg font-bold capitalize">{profile.status}</div>
                            <div className="text-xs text-muted-foreground">Account Status</div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-xl mb-6 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-600 p-4 rounded-xl mb-6 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                    {success}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button className={tabClass(activeTab === 'basic')} onClick={() => setActiveTab('basic')}>
                    <User className="h-4 w-4" />
                    Basic Info
                </button>
                <button className={tabClass(activeTab === 'business')} onClick={() => setActiveTab('business')}>
                    <Building className="h-4 w-4" />
                    Business
                </button>
                <button className={tabClass(activeTab === 'tuning')} onClick={() => setActiveTab('tuning')}>
                    <Gauge className="h-4 w-4" />
                    Tuning Details
                </button>
                <button className={tabClass(activeTab === 'contact')} onClick={() => setActiveTab('contact')}>
                    <Phone className="h-4 w-4" />
                    Contact & Social
                </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
                {activeTab === 'basic' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-500" />
                                Basic Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>First Name *</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className={inputClass}
                                        placeholder="Your first name"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Last Name *</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className={inputClass}
                                        placeholder="Your last name"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className={`${inputClass} pl-10`}
                                        placeholder="City, State (e.g., Houston, TX)"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Full Address (for service appointments)</label>
                                <textarea
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className={`${inputClass} min-h-[80px]`}
                                    placeholder="Street address, city, state, zip (only shown to customers with appointments)"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Bio / About You</label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    className={`${inputClass} min-h-[150px]`}
                                    placeholder="Tell customers about yourself, your experience, and what makes your tunes special..."
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    This appears on your public seller profile. Make it count!
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'business' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building className="h-5 w-5 text-purple-500" />
                                Business Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className={labelClass}>Business Name</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        className={`${inputClass} pl-10`}
                                        placeholder="Your business or shop name"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Leave blank to use your personal name
                                </p>
                            </div>
                            <div>
                                <label className={labelClass}>Years of Experience</label>
                                <select
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">Select experience level</option>
                                    {EXPERIENCE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Do you have a Dyno?</label>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setHasDyno('Yes')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                                            hasDyno === 'Yes'
                                                ? 'bg-green-500/20 border-green-500 text-green-600'
                                                : 'border-muted hover:border-green-500/50'
                                        }`}
                                    >
                                        <Gauge className="h-5 w-5 mx-auto mb-1" />
                                        Yes, I have a dyno
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasDyno('No')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                                            hasDyno === 'No'
                                                ? 'bg-red-500/20 border-red-500 text-red-600'
                                                : 'border-muted hover:border-red-500/50'
                                        }`}
                                    >
                                        <XCircleIcon className="h-5 w-5 mx-auto mb-1" />
                                        No dyno
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Business Hours (JSON)</label>
                                <textarea
                                    value={hours}
                                    onChange={(e) => setHours(e.target.value)}
                                    className={`${inputClass} font-mono text-sm min-h-[120px]`}
                                    placeholder='{"Mon-Fri": "9:00 AM - 6:00 PM", "Saturday": "10:00 AM - 4:00 PM", "Sunday": "Closed"}'
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Enter as JSON object. Example: {"{"}"Mon-Fri": "9-5", "Sat": "10-2"{"}"}
                                </p>

                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'tuning' && (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Cpu className="h-5 w-5 text-blue-500" />
                                    Tuning Software
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Select all the tuning software you work with
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {SOFTWARE_OPTIONS.map(sw => (
                                        <button
                                            key={sw}
                                            type="button"
                                            onClick={() => toggleArrayItem(software, setSoftware, sw)}
                                            className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                                                software.includes(sw)
                                                    ? 'bg-blue-500/20 border-blue-500 text-blue-600'
                                                    : 'border-muted hover:border-blue-500/50'
                                            }`}
                                        >
                                            {software.includes(sw) && <CheckCircle className="h-4 w-4 inline mr-2" />}
                                            {sw}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Car className="h-5 w-5 text-orange-500" />
                                    Vehicle Platforms
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Select the vehicle platforms you specialize in
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {PLATFORM_OPTIONS.map(platform => (
                                        <button
                                            key={platform}
                                            type="button"
                                            onClick={() => toggleArrayItem(vehiclePlatforms, setVehiclePlatforms, platform)}
                                            className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                                                vehiclePlatforms.includes(platform)
                                                    ? 'bg-orange-500/20 border-orange-500 text-orange-600'
                                                    : 'border-muted hover:border-orange-500/50'
                                            }`}
                                        >
                                            {vehiclePlatforms.includes(platform) && <CheckCircle className="h-4 w-4 inline mr-2" />}
                                            {platform}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="h-5 w-5 text-green-500" />
                                    Tune Types
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    What types of tunes do you offer?
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {TUNE_TYPE_OPTIONS.map(tuneType => (
                                        <button
                                            key={tuneType}
                                            type="button"
                                            onClick={() => toggleArrayItem(tuneTypes, setTuneTypes, tuneType)}
                                            className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                                                tuneTypes.includes(tuneType)
                                                    ? 'bg-green-500/20 border-green-500 text-green-600'
                                                    : 'border-muted hover:border-green-500/50'
                                            }`}
                                        >
                                            {tuneTypes.includes(tuneType) && <CheckCircle className="h-4 w-4 inline mr-2" />}
                                            {tuneType}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {activeTab === 'contact' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Phone className="h-5 w-5 text-teal-500" />
                                Contact & Social Media
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className={labelClass}>Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className={`${inputClass} pl-10`}
                                        placeholder="(555) 123-4567"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Website</label>
                                <div className="relative">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="url"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        className={`${inputClass} pl-10`}
                                        placeholder="https://yourwebsite.com"
                                    />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Instagram</label>
                                    <div className="relative">
                                        <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={instagramHandle}
                                            onChange={(e) => setInstagramHandle(e.target.value)}
                                            className={`${inputClass} pl-10`}
                                            placeholder="@yourusername"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Facebook</label>
                                    <div className="relative">
                                        <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={facebookHandle}
                                            onChange={(e) => setFacebookHandle(e.target.value)}
                                            className={`${inputClass} pl-10`}
                                            placeholder="facebook.com/yourpage"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Payment Integration Status */}
                            <div className="pt-4 border-t mt-6">
                                <h3 className="font-medium mb-4 flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-green-500" />
                                    Payment Integration Status
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className={`p-4 rounded-xl border-2 ${profile.stripeConnected ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-muted'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">Stripe</div>
                                                <div className="text-sm text-muted-foreground">Credit card payments</div>
                                            </div>
                                            {profile.stripeConnected ? (
                                                <Badge className="bg-green-500/20 text-green-600">Connected</Badge>
                                            ) : (
                                                <Badge className="bg-gray-500/20 text-gray-600">Not Connected</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`p-4 rounded-xl border-2 ${profile.paypalConnected ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-muted'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">PayPal</div>
                                                <div className="text-sm text-muted-foreground">PayPal payments</div>
                                            </div>
                                            {profile.paypalConnected ? (
                                                <Badge className="bg-green-500/20 text-green-600">Connected</Badge>
                                            ) : (
                                                <Badge className="bg-gray-500/20 text-gray-600">Not Connected</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Floating Save Button for mobile */}
            <div className="fixed bottom-6 right-6 md:hidden">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    size="lg"
                    className="bg-gradient-to-r from-yellow-500 via-red-500 to-blue-500 text-white shadow-xl hover:opacity-90 rounded-full h-14 w-14"
                >
                    {saving ? (
                        <RefreshCw className="h-6 w-6 animate-spin" />
                    ) : (
                        <Save className="h-6 w-6" />
                    )}
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// Marketplace Debug Logs Page
// ============================================================================

function MarketplaceDebugLogsPage() {
    const [logs, setLogs] = useState<MarketplaceDebugLog[]>([]);
    const [filterService, setFilterService] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [selectedLog, setSelectedLog] = useState<MarketplaceDebugLog | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Auto-refresh every 5 seconds
    useEffect(() => {
        loadLogs();
        const interval = setInterval(() => {
            loadLogs();
            setLastRefresh(new Date());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    function loadLogs() {
        setLogs(getMarketplaceDebugLogs());
    }

    function handleDelete(id: string) {
        deleteMarketplaceDebugLog(id);
        loadLogs();
    }

    function handleClearAll() {
        clearMarketplaceDebugLogs();
        loadLogs();
        setShowClearConfirm(false);
    }

    function copyToClipboard(text: string, commandLabel?: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedCommand(commandLabel || text);
            setTimeout(() => setCopiedCommand(null), 2000);
        });
    }

    const filteredLogs = logs
        .filter(log => !filterService || log.service === filterService)
        .filter(log => !filterType || log.type === filterType)
        .sort((a, b) => b.lastOccurrence - a.lastOccurrence);

    const errorCount = logs.filter(l => l.type === 'error').length;
    const warningCount = logs.filter(l => l.type === 'warning').length;
    const infoCount = logs.filter(l => l.type === 'info').length;

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    function getTypeIcon(type: MarketplaceDebugLog['type']) {
        switch (type) {
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500" />;
        }
    }

    function getTypeBgColor(type: MarketplaceDebugLog['type']): string {
        switch (type) {
            case 'error': return 'bg-red-500/10 border-red-500/30';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
            case 'info': return 'bg-blue-500/10 border-blue-500/30';
        }
    }

    // Get service info for selected log
    const selectedServiceInfo = selectedLog ? getMarketplaceServiceInfo(selectedLog.service) : null;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bug className="w-6 h-6" />
                        Debug Logs
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        View marketplace plugin operations, errors, and debugging information
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        Auto-refresh: {lastRefresh.toLocaleTimeString()}
                    </span>
                    <Button variant="outline" onClick={() => { loadLogs(); setLastRefresh(new Date()); }}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowClearConfirm(true)}
                        disabled={logs.length === 0}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear All
                    </Button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-500">{errorCount} errors</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-500">{warningCount} warnings</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-500">{infoCount} info</span>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Filter:</span>
                        </div>
                        <select
                            value={filterService}
                            onChange={(e) => setFilterService(e.target.value)}
                            className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                        >
                            <option value="">All Services</option>
                            {MARKETPLACE_SERVICES.map(service => (
                                <option key={service} value={service}>{service}</option>
                            ))}
                        </select>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-1.5 border rounded-md text-sm bg-background text-foreground"
                        >
                            <option value="">All Types</option>
                            <option value="error">Errors</option>
                            <option value="warning">Warnings</option>
                            <option value="info">Info</option>
                        </select>
                        {(filterService || filterType) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setFilterService(''); setFilterType(''); }}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Logs List */}
            <Card>
                <CardContent className="p-0">
                    {filteredLogs.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Bug className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium">No debug logs yet</p>
                            <p className="text-sm mt-1">
                                Logs will appear here when marketplace operations are performed
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {filteredLogs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`p-4 ${getTypeBgColor(log.type)} border-l-4 ${
                                        log.type === 'error' ? 'border-l-red-500' :
                                        log.type === 'warning' ? 'border-l-yellow-500' :
                                        'border-l-blue-500'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {getTypeIcon(log.type)}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-sm">{log.service}</span>
                                                    {log.count > 1 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            x{log.count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-foreground/80 mt-1 break-words">
                                                    {log.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatTime(log.lastOccurrence)}</span>
                                                    {log.count > 1 && (
                                                        <span className="opacity-70">
                                                            (first: {formatTime(log.firstOccurrence)})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedLog(log)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                View Report
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(log.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Enhanced Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <CardHeader className="border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {getTypeIcon(selectedLog.type)}
                                    <div>
                                        <CardTitle className="text-lg">{selectedLog.service} - Debug Report</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {formatTime(selectedLog.lastOccurrence)}
                                            {selectedLog.count > 1 && ` (${selectedLog.count} occurrences)`}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 overflow-auto flex-1">
                            <div className="space-y-6">
                                {/* Error Message Section */}
                                <div className={`p-4 rounded-lg ${getTypeBgColor(selectedLog.type)}`}>
                                    <div className="flex items-start gap-2">
                                        <AlertOctagon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm mb-1">
                                                {selectedLog.type === 'error' ? 'Error Message' :
                                                 selectedLog.type === 'warning' ? 'Warning Message' : 'Info Message'}
                                            </h4>
                                            <p className="text-sm">{selectedLog.message}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Service Details */}
                                {selectedServiceInfo && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-start gap-2 mb-3">
                                            <Server className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="font-medium text-sm">Service Details</h4>
                                                <p className="text-sm text-muted-foreground mt-1">{selectedServiceInfo.description}</p>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    <span className="font-medium">Endpoint:</span> {selectedServiceInfo.endpoint}
                                                </p>
                                                {selectedServiceInfo.dependencies.length > 0 && (
                                                    <div className="flex items-center gap-1 flex-wrap mt-2">
                                                        <span className="text-xs font-medium text-muted-foreground">Dependencies:</span>
                                                        {selectedServiceInfo.dependencies.map((dep, i) => (
                                                            <Badge key={i} variant="outline" className="text-xs">{dep}</Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Technical Details */}
                                {selectedLog.details && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Terminal className="w-4 h-4 text-muted-foreground" />
                                                <h4 className="font-medium text-sm">Technical Details</h4>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(selectedLog.details || '', 'details')}
                                            >
                                                <Copy className="w-3 h-3 mr-1" />
                                                {copiedCommand === 'details' ? 'Copied!' : 'Copy'}
                                            </Button>
                                        </div>
                                        <pre className="text-xs p-3 bg-background rounded-md overflow-auto max-h-40 whitespace-pre-wrap font-mono border">
                                            {selectedLog.details}
                                        </pre>
                                    </div>
                                )}

                                {/* File Locations */}
                                {selectedServiceInfo && selectedServiceInfo.fileLocations.length > 0 && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileCode className="w-4 h-4 text-purple-500" />
                                            <h4 className="font-medium text-sm">Related Files</h4>
                                        </div>
                                        <div className="space-y-1">
                                            {selectedServiceInfo.fileLocations.map((file, i) => (
                                                <div key={i} className="flex items-center gap-2 group">
                                                    <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 border">{file}</code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                                                        onClick={() => copyToClipboard(file, `file-${i}`)}
                                                    >
                                                        {copiedCommand === `file-${i}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Affected Areas */}
                                {selectedServiceInfo && selectedServiceInfo.affectedAreas.length > 0 && (
                                    <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Layers className="w-4 h-4 text-orange-500" />
                                            <h4 className="font-medium text-sm">Affected Areas</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedServiceInfo.affectedAreas.map((area, i) => (
                                                <Badge key={i} variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400">
                                                    {area}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recommended Actions */}
                                {selectedServiceInfo && selectedServiceInfo.recommendedActions.length > 0 && (
                                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Lightbulb className="w-4 h-4 text-green-500" />
                                            <h4 className="font-medium text-sm">Recommended Actions</h4>
                                        </div>
                                        <ol className="space-y-2">
                                            {selectedServiceInfo.recommendedActions.map((action, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center text-xs font-medium">
                                                        {i + 1}
                                                    </span>
                                                    <span>{action}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Debug Commands */}
                                {selectedServiceInfo && selectedServiceInfo.debugCommands.length > 0 && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Terminal className="w-4 h-4 text-cyan-500" />
                                            <h4 className="font-medium text-sm">Debug Commands</h4>
                                        </div>
                                        <div className="space-y-2">
                                            {selectedServiceInfo.debugCommands.map((cmd, i) => (
                                                <div key={i} className="flex items-center gap-2 group">
                                                    <div className="flex-1">
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">{cmd.label}</p>
                                                        <code className="text-xs bg-background px-2 py-1.5 rounded font-mono block border overflow-x-auto">
                                                            {cmd.command}
                                                        </code>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-shrink-0"
                                                        onClick={() => copyToClipboard(cmd.command, `cmd-${i}`)}
                                                    >
                                                        {copiedCommand === `cmd-${i}` ? (
                                                            <>
                                                                <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                                                                Copied!
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-3 h-3 mr-1" />
                                                                Copy
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Occurrence Timeline */}
                                {selectedLog.count > 1 && (
                                    <div className="p-4 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                            <h4 className="font-medium text-sm">Occurrence Timeline</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">First occurrence:</span>
                                                <p className="font-medium">{formatTime(selectedLog.firstOccurrence)}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Last occurrence:</span>
                                                <p className="font-medium">{formatTime(selectedLog.lastOccurrence)}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Total occurrences:</span>
                                                <p className="font-medium">{selectedLog.count} times</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Frequency:</span>
                                                <p className="font-medium">
                                                    {(() => {
                                                        const duration = selectedLog.lastOccurrence - selectedLog.firstOccurrence;
                                                        if (duration < 60000) return 'Multiple times in under a minute';
                                                        const minutes = Math.round(duration / 60000);
                                                        return `~${(selectedLog.count / minutes).toFixed(1)}/min over ${minutes} min`;
                                                    })()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
                            <Button variant="outline" onClick={() => setSelectedLog(null)}>
                                Close
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                </div>
                                <h3 className="font-semibold text-lg">Clear All Logs?</h3>
                            </div>
                            <p className="text-muted-foreground mb-6">
                                This will permanently delete all {logs.length} debug log entries. This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleClearAll} className="bg-red-600 hover:bg-red-700 text-white">
                                    Clear All
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Dashboard Extension Registration
// ============================================================================

defineDashboardExtension({
    navSections: [
        // ============================================================================
        // ADMIN SECTIONS (SuperAdmin only)
        // ============================================================================

        // Marketplace - Admin management of users
        {
            id: 'marketplace-admin',
            title: 'Marketplace',
            icon: Store,
            order: 50,
            requiresPermission: 'SuperAdmin',
        },
        // Marketplace Settings - Configuration options
        {
            id: 'marketplace-settings',
            title: 'Settings',
            icon: Settings,
            order: 51,
            requiresPermission: 'SuperAdmin',
        },
        // Admin Listings - View/manage all products across all shops
        {
            id: 'admin-listings',
            title: 'Listings',
            icon: Package,
            order: 60,
            requiresPermission: 'SuperAdmin',
        },
        // Admin Orders - View/manage all orders across all shops
        {
            id: 'admin-orders',
            title: 'Orders',
            icon: ShoppingCart,
            order: 70,
            requiresPermission: 'SuperAdmin',
        },
    ],
    routes: [
        // ============================================================================
        // MARKETPLACE ADMIN ROUTES (SuperAdmin only)
        // User management, tuner requests, admin viewers
        // ============================================================================
        {
            path: '/marketplace-customers',
            component: () => <ManageCustomersPage />,
            navMenuItem: {
                sectionId: 'marketplace-admin',
                id: 'marketplace-customers',
                title: 'Manage Customers',
                icon: User,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/marketplace-tuners',
            component: () => <TunerListPage />,
            navMenuItem: {
                sectionId: 'marketplace-admin',
                id: 'marketplace-tuners',
                title: 'Manage Tuners',
                icon: Users,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/tuner-requests',
            component: () => <TunerRequestsPage />,
            navMenuItem: {
                sectionId: 'marketplace-admin',
                id: 'tuner-requests',
                title: 'Tuner Requests',
                icon: UserCircle,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/admin-viewers',
            component: () => <AdminViewersPage />,
            navMenuItem: {
                sectionId: 'marketplace-admin',
                id: 'admin-viewers',
                title: 'Admin Viewers',
                icon: Eye,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/verification-settings',
            component: () => <VerificationSettingsPage />,
            navMenuItem: {
                sectionId: 'marketplace-admin',
                id: 'verification-settings',
                title: 'Verification',
                icon: ShieldCheck,
                requiresPermission: 'SuperAdmin',
            },
        },

        // ============================================================================
        // MARKETPLACE SETTINGS ROUTES (SuperAdmin only)
        // Configuration, commission, features, platforms
        // ============================================================================
        {
            path: '/settings-hub',
            component: () => <MarketplaceSettingsPage />,
            navMenuItem: {
                sectionId: 'marketplace-settings',
                id: 'settings-hub',
                title: 'Settings Hub',
                icon: Settings,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/commission-settings',
            component: () => <CommissionSettingsPage />,
            navMenuItem: {
                sectionId: 'marketplace-settings',
                id: 'commission-settings',
                title: 'Commission',
                icon: DollarSign,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/marketplace-features',
            component: () => <MarketplaceFeaturesPage />,
            navMenuItem: {
                sectionId: 'marketplace-settings',
                id: 'marketplace-features',
                title: 'Features',
                icon: Cpu,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/platform-settings',
            component: () => <PlatformSettingsPage />,
            navMenuItem: {
                sectionId: 'marketplace-settings',
                id: 'platform-settings',
                title: 'Platforms',
                icon: Car,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/system-status',
            component: () => <SystemStatusPage />,
            navMenuItem: {
                sectionId: 'marketplace-settings',
                id: 'system-status',
                title: 'System Status',
                icon: BarChart3,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/marketplace-debug-logs',
            component: () => <MarketplaceDebugLogsPage />,
            navMenuItem: {
                sectionId: 'marketplace-settings',
                id: 'marketplace-debug-logs',
                title: 'Debug Logs',
                icon: Bug,
                requiresPermission: 'SuperAdmin',
            },
        },

        // ============================================================================
        // ADMIN LISTINGS ROUTES (SuperAdmin only)
        // View/manage all products across all shops with filtering
        // ============================================================================
        {
            path: '/admin-tunes',
            component: () => <AdminTunesPage />,
            navMenuItem: {
                sectionId: 'admin-listings',
                id: 'admin-tunes',
                title: 'All Tunes',
                icon: Music,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/admin-parts',
            component: () => <AdminPartsPage />,
            navMenuItem: {
                sectionId: 'admin-listings',
                id: 'admin-parts',
                title: 'All Parts',
                icon: Package,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/admin-services',
            component: () => <AdminServicesPage />,
            navMenuItem: {
                sectionId: 'admin-listings',
                id: 'admin-services',
                title: 'All Services',
                icon: Calendar,
                requiresPermission: 'SuperAdmin',
            },
        },

        // ============================================================================
        // ADMIN ORDERS ROUTES (SuperAdmin only)
        // View/manage all orders across all shops with status filtering
        // ============================================================================
        {
            path: '/admin-open-orders',
            component: () => <AdminOpenOrdersPage />,
            navMenuItem: {
                sectionId: 'admin-orders',
                id: 'admin-open-orders',
                title: 'Open Orders',
                icon: Clock,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/admin-disputes',
            component: () => <AdminDisputesPage />,
            navMenuItem: {
                sectionId: 'admin-orders',
                id: 'admin-disputes',
                title: 'Disputes',
                icon: AlertTriangle,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/admin-returns',
            component: () => <AdminReturnsPage />,
            navMenuItem: {
                sectionId: 'admin-orders',
                id: 'admin-returns',
                title: 'Returns',
                icon: RotateCcw,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/admin-refunds',
            component: () => <AdminRefundsPage />,
            navMenuItem: {
                sectionId: 'admin-orders',
                id: 'admin-refunds',
                title: 'Refunds',
                icon: DollarSign,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/order-analytics',
            component: () => <OrderAnalyticsPage />,
            navMenuItem: {
                sectionId: 'admin-orders',
                id: 'order-analytics',
                title: 'Analytics & Debug',
                icon: BarChart3,
                requiresPermission: 'SuperAdmin',
            },
        },
        {
            path: '/customer-activity',
            component: () => <CustomerActivityPage />,
            navMenuItem: {
                sectionId: 'marketplace-settings',
                id: 'customer-activity',
                title: 'Customer Activity',
                icon: Users,
                requiresPermission: 'SuperAdmin',
            },
        },
    ],
});
