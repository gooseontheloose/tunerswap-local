/**
 * My Garage - Admin Dashboard UI
 * Vehicle taxonomy management and fitment rules
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
    Car,
    Database,
    List,
    Upload,
    BarChart3,
    RefreshCw,
    Plus,
    CheckCircle,
    XCircle,
    AlertCircle,
    Search,
    Trash2,
    Edit,
    ChevronRight,
    Download,
    FileJson,
    FileText,
    Bug,
    Filter,
    FileWarning,
    Info,
    Clock,
    Eye,
    X,
    Terminal,
    Lightbulb,
    Server,
    AlertOctagon,
    FileCode,
    Copy,
    Layers,
    Zap,
} from 'lucide-react';
import { gql } from 'graphql-tag';

// ============================================================================
// GraphQL Queries & Mutations
// ============================================================================

const GET_TAXONOMY_STATS = gql`
    query GetTaxonomyStats {
        garageTaxonomyStats {
            totalMakes
            totalModels
            totalTrims
            totalEngines
            totalCustomerVehicles
            totalFitmentRules
        }
    }
`;

const GET_ALL_MAKES = gql`
    query GetAllMakes($includeInactive: Boolean) {
        garageAllMakes(includeInactive: $includeInactive) {
            id
            name
            slug
            country
            isActive
            sortOrder
        }
    }
`;

const GET_ALL_MODELS = gql`
    query GetAllModels($makeId: ID!, $includeInactive: Boolean) {
        garageAllModels(makeId: $makeId, includeInactive: $includeInactive) {
            id
            makeId
            name
            slug
            bodyStyle
            isActive
        }
    }
`;

const SEED_TAXONOMY = gql`
    mutation SeedVehicleTaxonomy {
        seedVehicleTaxonomyFromFiles {
            success
            imported
            skipped
            errors
            duration
        }
    }
`;

const CREATE_MAKE = gql`
    mutation CreateVehicleMake($input: CreateVehicleMakeInput!) {
        createVehicleMake(input: $input) {
            id
            name
            slug
        }
    }
`;

const DELETE_MAKE = gql`
    mutation DeleteVehicleMake($id: ID!) {
        deleteVehicleMake(id: $id)
    }
`;

// ============================================================================
// Utility Functions
// ============================================================================

function formatNumber(num: number): string {
    return num.toLocaleString();
}

// ============================================================================
// Debug Log System
// ============================================================================

const GARAGE_DEBUG_LOGS_KEY = 'garageDebugLogs';

interface DebugLog {
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

const GARAGE_SERVICES = [
    'Seed Taxonomy',
    'GraphQL Mutation',
    'GraphQL Query',
    'Taxonomy Service',
    'Fitment Service',
    'File Import',
    'Data Export',
];

function normalizeMessage(msg: string): string {
    return msg
        .replace(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?/gi, '')
        .replace(/[a-f0-9-]{36}/gi, '[ID]')
        .replace(/\d+ms/gi, '[TIME]')
        .replace(/\d{13,}/g, '[TIMESTAMP]')
        .trim();
}

function getGarageDebugLogs(): DebugLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(GARAGE_DEBUG_LOGS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addGarageDebugLog(log: Partial<DebugLog>): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getGarageDebugLogs();
        const now = Date.now();
        const normalizedNew = normalizeMessage(log.message || '');

        // Find existing matching log for deduplication
        const existingIndex = logs.findIndex(existing =>
            existing.service === log.service &&
            existing.type === log.type &&
            normalizeMessage(existing.message) === normalizedNew
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
                id: `log-${now}-${Math.random().toString(36).substr(2, 9)}`,
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
        localStorage.setItem(GARAGE_DEBUG_LOGS_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('Failed to save debug log:', err);
    }
}

function deleteGarageDebugLog(id: string): void {
    if (typeof window === 'undefined') return;
    try {
        const logs = getGarageDebugLogs().filter(log => log.id !== id);
        localStorage.setItem(GARAGE_DEBUG_LOGS_KEY, JSON.stringify(logs));
    } catch (err) {
        console.error('Failed to delete debug log:', err);
    }
}

function clearGarageDebugLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GARAGE_DEBUG_LOGS_KEY, JSON.stringify([]));
}

// Service Info for enhanced debug reports
interface ServiceInfo {
    description: string;
    endpoint: string;
    fileLocations: string[];
    dependencies: string[];
    affectedAreas: string[];
    recommendedActions: string[];
    debugCommands: { label: string; command: string }[];
}

const GARAGE_SERVICE_INFO: Record<string, ServiceInfo> = {
    'Seed Taxonomy': {
        description: 'Imports vehicle makes, models, trims, and engines from JSON seed files into the database',
        endpoint: 'GraphQL Mutation: seedVehicleTaxonomyFromFiles',
        fileLocations: [
            'v2/src/plugins/my-garage/seed-data/vehicle-makes.json',
            'v2/src/plugins/my-garage/seed-data/vehicle-models.json',
            'v2/src/plugins/my-garage/seed-data/vehicle-trims.json',
            'v2/src/plugins/my-garage/seed-data/vehicle-engines.json',
            'v2/src/plugins/my-garage/seed-data/seed-taxonomy.service.ts',
        ],
        dependencies: ['Database', 'File System', 'Vendure Core'],
        affectedAreas: ['Vehicle Search', 'Fitment Rules', 'Customer Garages', 'Product Compatibility'],
        recommendedActions: [
            'Verify seed JSON files exist in the seed-data directory',
            'Check file permissions on seed-data folder',
            'Ensure database connection is active',
            'Review server terminal for detailed error messages',
            'Check that vehicle-makes.json has valid JSON format',
        ],
        debugCommands: [
            { label: 'Check seed files exist', command: 'ls -la v2/src/plugins/my-garage/seed-data/' },
            { label: 'Validate JSON format', command: 'cat v2/src/plugins/my-garage/seed-data/vehicle-makes.json | jq .' },
            { label: 'Check Vendure logs', command: 'cd v2 && yarn dev' },
            { label: 'Database status', command: 'ls -la v2/vendure.sqlite' },
        ],
    },
    'GraphQL Mutation': {
        description: 'Server-side data modification operation (create, update, delete)',
        endpoint: 'POST /admin-api (GraphQL)',
        fileLocations: [
            'v2/src/plugins/my-garage/api/garage-admin.resolver.ts',
            'v2/src/plugins/my-garage/services/taxonomy.service.ts',
            'v2/src/plugins/my-garage/services/fitment.service.ts',
        ],
        dependencies: ['Vendure API', 'Database', 'Authentication'],
        affectedAreas: ['Vehicle Data', 'Fitment Rules', 'Admin Dashboard'],
        recommendedActions: [
            'Check user permissions for the operation',
            'Verify input data format matches schema',
            'Check database constraints and unique keys',
            'Review network tab for full error response',
        ],
        debugCommands: [
            { label: 'Test API connection', command: 'curl -X POST http://localhost:3000/admin-api -H "Content-Type: application/json" -d \'{"query":"{ __typename }"}\'' },
            { label: 'Check resolver file', command: 'cat v2/src/plugins/my-garage/api/garage-admin.resolver.ts' },
        ],
    },
    'GraphQL Query': {
        description: 'Server-side data retrieval operation',
        endpoint: 'POST /admin-api (GraphQL)',
        fileLocations: [
            'v2/src/plugins/my-garage/api/garage-admin.resolver.ts',
            'v2/src/plugins/my-garage/services/taxonomy.service.ts',
        ],
        dependencies: ['Vendure API', 'Database'],
        affectedAreas: ['Admin Dashboard', 'Data Display', 'Vehicle Listings'],
        recommendedActions: [
            'Check if Vendure server is running',
            'Verify database has data to return',
            'Check query parameters and filters',
            'Review browser console for network errors',
        ],
        debugCommands: [
            { label: 'Check Vendure is running', command: 'curl http://localhost:3000/admin-api' },
            { label: 'Count makes in database', command: 'sqlite3 v2/vendure.sqlite "SELECT COUNT(*) FROM vehicle_make"' },
        ],
    },
    'Taxonomy Service': {
        description: 'Manages vehicle make/model/trim/engine data operations',
        endpoint: 'Internal Service',
        fileLocations: [
            'v2/src/plugins/my-garage/services/taxonomy.service.ts',
            'v2/src/plugins/my-garage/entities/vehicle-make.entity.ts',
            'v2/src/plugins/my-garage/entities/vehicle-model.entity.ts',
        ],
        dependencies: ['Database', 'TypeORM', 'Vendure Core'],
        affectedAreas: ['Vehicle Hierarchy', 'Search', 'Admin Management'],
        recommendedActions: [
            'Check entity definitions match database schema',
            'Verify TypeORM migrations have run',
            'Check for database constraint violations',
        ],
        debugCommands: [
            { label: 'Check entity files', command: 'ls v2/src/plugins/my-garage/entities/' },
            { label: 'View service', command: 'cat v2/src/plugins/my-garage/services/taxonomy.service.ts' },
        ],
    },
    'Fitment Service': {
        description: 'Manages product-to-vehicle fitment rule associations',
        endpoint: 'Internal Service',
        fileLocations: [
            'v2/src/plugins/my-garage/services/fitment.service.ts',
            'v2/src/plugins/my-garage/entities/product-fitment.entity.ts',
        ],
        dependencies: ['Database', 'Taxonomy Service', 'Product Catalog'],
        affectedAreas: ['Product Compatibility', 'Vehicle Search', 'Customer Garage Matching'],
        recommendedActions: [
            'Verify product variant exists',
            'Check vehicle trim/engine IDs are valid',
            'Review fitment rule constraints',
        ],
        debugCommands: [
            { label: 'Check fitment table', command: 'sqlite3 v2/vendure.sqlite "SELECT COUNT(*) FROM product_fitment"' },
            { label: 'View service', command: 'cat v2/src/plugins/my-garage/services/fitment.service.ts' },
        ],
    },
    'File Import': {
        description: 'Imports vehicle data from external files (CSV, JSON, ACES)',
        endpoint: 'GraphQL Mutation',
        fileLocations: [
            'v2/src/plugins/my-garage/api/garage-admin.resolver.ts',
        ],
        dependencies: ['File System', 'Parser Libraries', 'Database'],
        affectedAreas: ['Vehicle Taxonomy', 'Fitment Rules'],
        recommendedActions: [
            'Verify file format matches expected schema',
            'Check file encoding (UTF-8)',
            'Review file size limits',
            'Check for duplicate entries',
        ],
        debugCommands: [
            { label: 'Check file encoding', command: 'file -bi your-import-file.csv' },
        ],
    },
    'Data Export': {
        description: 'Exports vehicle taxonomy or fitment data to files',
        endpoint: 'GraphQL Query / Download',
        fileLocations: [
            'v2/src/plugins/my-garage/api/garage-admin.resolver.ts',
        ],
        dependencies: ['Database', 'File System'],
        affectedAreas: ['Data Backup', 'Reporting'],
        recommendedActions: [
            'Verify write permissions on export directory',
            'Check available disk space',
        ],
        debugCommands: [
            { label: 'Check disk space', command: 'df -h' },
        ],
    },
};

function getGarageServiceInfo(serviceName: string): ServiceInfo {
    return GARAGE_SERVICE_INFO[serviceName] || {
        description: 'Unknown service',
        endpoint: 'Unknown',
        fileLocations: [],
        dependencies: [],
        affectedAreas: [],
        recommendedActions: ['Contact developer for assistance'],
        debugCommands: [],
    };
}

// ============================================================================
// Toast Notification Component
// ============================================================================

interface ToastState {
    show: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(onClose, 5000);
            return () => clearTimeout(timer);
        }
    }, [toast.show, onClose]);

    if (!toast.show) return null;

    const bgColor = toast.type === 'success' ? 'bg-green-50 border-green-200' :
                    toast.type === 'error' ? 'bg-red-50 border-red-200' :
                    'bg-blue-50 border-blue-200';
    const textColor = toast.type === 'success' ? 'text-green-800' :
                      toast.type === 'error' ? 'text-red-800' :
                      'text-blue-800';
    const Icon = toast.type === 'success' ? CheckCircle :
                 toast.type === 'error' ? XCircle :
                 AlertCircle;

    return (
        <div className={`fixed top-4 right-4 z-50 max-w-md ${bgColor} border rounded-lg shadow-lg p-4`}>
            <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${textColor} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                    <h4 className={`font-semibold ${textColor}`}>{toast.title}</h4>
                    <p className={`text-sm ${textColor} opacity-80 mt-1`}>{toast.message}</p>
                </div>
                <button onClick={onClose} className={`${textColor} opacity-60 hover:opacity-100`}>
                    <XCircle className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ============================================================================
// Overview Page
// ============================================================================

function GarageOverviewPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        setLoading(true);
        try {
            const result = await api.query(GET_TAXONOMY_STATS);
            setStats(result.garageTaxonomyStats);

            if (!result.garageTaxonomyStats) {
                addGarageDebugLog({
                    service: 'GraphQL Query',
                    type: 'warning',
                    message: 'garageTaxonomyStats returned null or undefined',
                    details: JSON.stringify(result, null, 2),
                });
            }
        } catch (error: any) {
            console.error('Failed to load stats:', error);
            addGarageDebugLog({
                service: 'GraphQL Query',
                type: 'error',
                message: `Failed to load taxonomy stats: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Car className="w-6 h-6" />
                        My Garage - Overview
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Vehicle taxonomy and fitment management
                    </p>
                </div>
                <Button onClick={loadStats} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <Car className="w-4 h-4" />
                            Vehicle Makes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.totalMakes || 0)}
                        </div>
                        <p className="text-xs text-gray-500">brands in database</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            Vehicle Models
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.totalModels || 0)}
                        </div>
                        <p className="text-xs text-gray-500">models available</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <List className="w-4 h-4" />
                            Fitment Rules
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.totalFitmentRules || 0)}
                        </div>
                        <p className="text-xs text-gray-500">product-vehicle mappings</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Trims</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.totalTrims || 0)}
                        </div>
                        <p className="text-xs text-gray-500">trim levels</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Engines</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.totalEngines || 0)}
                        </div>
                        <p className="text-xs text-gray-500">engine configurations</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Customer Vehicles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatNumber(stats?.totalCustomerVehicles || 0)}
                        </div>
                        <p className="text-xs text-gray-500">saved in garages</p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <a
                            href="/admin/extensions/garage-taxonomy"
                            className="block p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Database className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h3 className="font-semibold">Manage Taxonomy</h3>
                                    <p className="text-sm text-gray-500">Add, edit, or remove vehicles</p>
                                </div>
                                <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                            </div>
                        </a>

                        <a
                            href="/admin/extensions/garage-fitment"
                            className="block p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <List className="w-5 h-5 text-purple-600" />
                                <div>
                                    <h3 className="font-semibold">Fitment Rules</h3>
                                    <p className="text-sm text-gray-500">Configure product compatibility</p>
                                </div>
                                <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                            </div>
                        </a>

                        <a
                            href="/admin/extensions/garage-import"
                            className="block p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Upload className="w-5 h-5 text-green-600" />
                                <div>
                                    <h3 className="font-semibold">Import Data</h3>
                                    <p className="text-sm text-gray-500">Seed or import vehicle data</p>
                                </div>
                                <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                            </div>
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Taxonomy Page
// ============================================================================

function GarageTaxonomyPage() {
    const [makes, setMakes] = useState<any[]>([]);
    const [selectedMake, setSelectedMake] = useState<string | null>(null);
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingModels, setLoadingModels] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<ToastState>({ show: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        loadMakes();
    }, []);

    useEffect(() => {
        if (selectedMake) {
            loadModels(selectedMake);
        }
    }, [selectedMake]);

    async function loadMakes() {
        setLoading(true);
        try {
            const result = await api.query(GET_ALL_MAKES, { includeInactive: true });
            setMakes(result.garageAllMakes || []);

            if (!result.garageAllMakes || result.garageAllMakes.length === 0) {
                addGarageDebugLog({
                    service: 'GraphQL Query',
                    type: 'warning',
                    message: 'garageAllMakes returned empty array - taxonomy may need seeding',
                    details: JSON.stringify(result, null, 2),
                });
            }
        } catch (error: any) {
            console.error('Failed to load makes:', error);
            addGarageDebugLog({
                service: 'GraphQL Query',
                type: 'error',
                message: `Failed to load vehicle makes: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
            setToast({
                show: true,
                type: 'error',
                title: 'Failed to Load',
                message: 'Could not load vehicle makes. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    }

    async function loadModels(makeId: string) {
        setLoadingModels(true);
        try {
            const result = await api.query(GET_ALL_MODELS, { makeId, includeInactive: true });
            setModels(result.garageAllModels || []);

            if (!result.garageAllModels || result.garageAllModels.length === 0) {
                addGarageDebugLog({
                    service: 'GraphQL Query',
                    type: 'warning',
                    message: `No models found for make ID ${makeId}`,
                });
            }
        } catch (error: any) {
            console.error('Failed to load models:', error);
            addGarageDebugLog({
                service: 'GraphQL Query',
                type: 'error',
                message: `Failed to load models for make ${makeId}: ${error?.message || String(error)}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });
        } finally {
            setLoadingModels(false);
        }
    }

    const filteredMakes = makes.filter(make =>
        make.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        make.country?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <Toast toast={toast} onClose={() => setToast(prev => ({ ...prev, show: false }))} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Database className="w-6 h-6" />
                        Vehicle Taxonomy
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Manage makes, models, trims, and engines
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={loadMakes} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Make
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Makes List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Vehicle Makes ({makes.length})</span>
                        </CardTitle>
                        <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search makes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-md"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                Loading makes...
                            </div>
                        ) : filteredMakes.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                {searchTerm ? 'No makes match your search' : 'No vehicle makes found. Use Import Data to seed the taxonomy.'}
                            </div>
                        ) : (
                            <Table>
                                <TableBody>
                                    {filteredMakes.map((make) => (
                                        <TableRow
                                            key={make.id}
                                            className={`cursor-pointer ${selectedMake === make.id ? 'bg-blue-50' : ''}`}
                                            onClick={() => setSelectedMake(make.id)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium">{make.name}</div>
                                                        <div className="text-xs text-gray-500">{make.country || 'Unknown'}</div>
                                                    </div>
                                                    {!make.isActive && (
                                                        <Badge variant="secondary">Inactive</Badge>
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

                {/* Models List */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {selectedMake
                                ? `Models (${models.length})`
                                : 'Select a Make'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                        {!selectedMake ? (
                            <div className="p-8 text-center text-gray-500">
                                Select a make to view its models
                            </div>
                        ) : loadingModels ? (
                            <div className="p-8 text-center text-gray-500">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                Loading models...
                            </div>
                        ) : models.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No models found for this make
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Model</TableHead>
                                        <TableHead>Body Style</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {models.map((model) => (
                                        <TableRow key={model.id}>
                                            <TableCell className="font-medium">{model.name}</TableCell>
                                            <TableCell className="text-gray-500">{model.bodyStyle || '-'}</TableCell>
                                            <TableCell>
                                                {model.isActive ? (
                                                    <Badge>Active</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Inactive</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Fitment Page
// ============================================================================

function GarageFitmentPage() {
    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <List className="w-6 h-6" />
                        Product Fitment Rules
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Configure which products are compatible with which vehicles
                    </p>
                </div>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Fitment Rule
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm text-gray-500">Search</label>
                            <input
                                type="text"
                                placeholder="Product or vehicle..."
                                className="w-full px-3 py-2 border rounded-md mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">Make</label>
                            <select className="w-full px-3 py-2 border rounded-md mt-1">
                                <option value="">All Makes</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">Model</label>
                            <select className="w-full px-3 py-2 border rounded-md mt-1">
                                <option value="">All Models</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">Source</label>
                            <select className="w-full px-3 py-2 border rounded-md mt-1">
                                <option value="">All Sources</option>
                                <option value="manual">Manual</option>
                                <option value="aces">ACES Import</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Fitment Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Years</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Confidence</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                    No fitment rules configured yet. Import vehicle data first, then add fitment rules.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Import Page
// ============================================================================

function GarageImportPage() {
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<any>(null);
    const [toast, setToast] = useState<ToastState>({ show: false, type: 'info', title: '', message: '' });

    async function handleSeedTaxonomy() {
        setSeeding(true);
        setSeedResult(null);

        // Log the start of the operation
        addGarageDebugLog({
            service: 'Seed Taxonomy',
            type: 'info',
            message: 'Starting seed taxonomy operation',
            details: `Initiated at ${new Date().toLocaleTimeString()}`,
        });

        try {
            console.log('Calling SEED_TAXONOMY mutation...');
            let result;
            try {
                result = await api.mutate(SEED_TAXONOMY);
            } catch (mutateError: any) {
                // Capture actual GraphQL/network errors
                console.error('api.mutate threw an error:', mutateError);
                addGarageDebugLog({
                    service: 'Seed Taxonomy',
                    type: 'error',
                    message: 'GraphQL mutation error',
                    details: `Error: ${mutateError?.message || mutateError}\n\nFull error: ${JSON.stringify(mutateError, Object.getOwnPropertyNames(mutateError), 2)}`,
                });
                throw mutateError;
            }
            console.log('Seed mutation result:', result);

            // Log the raw result for debugging
            addGarageDebugLog({
                service: 'Seed Taxonomy',
                type: 'info',
                message: 'Received response from seed mutation',
                details: JSON.stringify(result, null, 2),
            });

            // Handle different possible result structures
            const data = result?.seedVehicleTaxonomyFromFiles || result?.data?.seedVehicleTaxonomyFromFiles;

            if (!data) {
                // Check if there's an error in the response
                const errorMessage = result?.errors?.[0]?.message ||
                                    result?.error?.message ||
                                    'No data returned from seed operation. Check server terminal for errors.';

                addGarageDebugLog({
                    service: 'Seed Taxonomy',
                    type: 'error',
                    message: 'No data returned from seed mutation',
                    details: `Full response: ${JSON.stringify(result, null, 2)}\n\nCheck your server terminal (where 'yarn dev' runs) for error messages.`,
                });

                throw new Error(errorMessage);
            }

            setSeedResult(data);

            if (data.success) {
                addGarageDebugLog({
                    service: 'Seed Taxonomy',
                    type: 'info',
                    message: `Seed completed successfully: ${data.imported} imported, ${data.skipped} skipped`,
                    details: `Duration: ${data.duration}ms`,
                });

                setToast({
                    show: true,
                    type: 'success',
                    title: 'Seed Complete',
                    message: `Successfully imported ${data.imported} records in ${data.duration}ms`,
                });
            } else {
                addGarageDebugLog({
                    service: 'Seed Taxonomy',
                    type: 'error',
                    message: `Seed operation failed: ${data.errors?.[0] || 'Unknown error'}`,
                    details: data.errors?.length > 1 ? `All errors:\n${data.errors.join('\n')}` : undefined,
                });

                setToast({
                    show: true,
                    type: 'error',
                    title: 'Seed Failed',
                    message: data.errors?.[0] || 'Unknown error occurred',
                });
            }
        } catch (error: any) {
            console.error('Seed error:', error);

            // Try to extract a meaningful error message
            let errorMessage = 'Failed to seed vehicle taxonomy';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error?.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            addGarageDebugLog({
                service: 'Seed Taxonomy',
                type: 'error',
                message: `Seed operation threw exception: ${errorMessage}`,
                details: error?.stack || JSON.stringify(error, null, 2),
            });

            setSeedResult({
                success: false,
                imported: 0,
                skipped: 0,
                errors: [errorMessage],
                duration: 0,
            });

            setToast({
                show: true,
                type: 'error',
                title: 'Seed Failed',
                message: errorMessage,
            });
        } finally {
            setSeeding(false);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <Toast toast={toast} onClose={() => setToast(prev => ({ ...prev, show: false }))} />

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Upload className="w-6 h-6" />
                    Import Vehicle Data
                </h1>
                <p className="text-gray-500 mt-1">
                    Populate the vehicle taxonomy from seed files or external sources
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Seed from Files */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-blue-600" />
                            Seed from Files
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-500">
                            Populate the vehicle taxonomy from the built-in JSON seed files. This includes common US, European, and Japanese makes and models.
                        </p>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <div className="font-medium text-blue-900">Pre-configured Data</div>
                                    <div className="text-sm text-blue-700">
                                        Includes 30+ makes, 200+ models, popular trims, and engine configurations.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Seed Result Display */}
                        {seedResult && (
                            <div className={`rounded-lg p-4 ${seedResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {seedResult.success ? (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                    <span className={`font-medium ${seedResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                        {seedResult.success ? 'Seed Successful' : 'Seed Failed'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                                    <div>
                                        <div className="text-gray-500">Imported</div>
                                        <div className="font-semibold text-green-600">{seedResult.imported}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500">Skipped</div>
                                        <div className="font-semibold text-gray-600">{seedResult.skipped}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500">Duration</div>
                                        <div className="font-semibold">{seedResult.duration}ms</div>
                                    </div>
                                </div>
                                {seedResult.errors?.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-red-200">
                                        <div className="text-sm text-red-700 font-medium mb-1">Errors:</div>
                                        <ul className="text-sm text-red-600 list-disc list-inside">
                                            {seedResult.errors.slice(0, 5).map((err: string, i: number) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                            {seedResult.errors.length > 5 && (
                                                <li>...and {seedResult.errors.length - 5} more</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button
                            onClick={handleSeedTaxonomy}
                            disabled={seeding}
                            className="w-full"
                        >
                            {seeding ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Seeding...
                                </>
                            ) : (
                                <>
                                    <Database className="w-4 h-4 mr-2" />
                                    Seed Vehicle Taxonomy
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* ACES Import */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" />
                            Import ACES File
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-500">
                            Import product fitment data from an ACES (Aftermarket Catalog Exchange Standard) XML file.
                        </p>

                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">
                                Drag and drop an ACES XML file here, or click to browse
                            </p>
                            <input type="file" className="hidden" accept=".xml" />
                        </div>

                        <Button variant="outline" className="w-full" disabled>
                            <Upload className="w-4 h-4 mr-2" />
                            Import ACES File
                        </Button>
                        <p className="text-xs text-gray-400 text-center">Coming soon</p>
                    </CardContent>
                </Card>

                {/* JSON Import */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-green-600" />
                            Import from JSON
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-500">
                            Import vehicle taxonomy from a custom JSON file. Useful for restoring backups or migrating data.
                        </p>

                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">
                                Drag and drop a JSON file here, or click to browse
                            </p>
                            <input type="file" className="hidden" accept=".json" />
                        </div>

                        <Button variant="outline" className="w-full" disabled>
                            <Upload className="w-4 h-4 mr-2" />
                            Import JSON
                        </Button>
                        <p className="text-xs text-gray-400 text-center">Coming soon</p>
                    </CardContent>
                </Card>

                {/* Export */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="w-5 h-5 text-orange-600" />
                            Export Data
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-500">
                            Export the current vehicle taxonomy and fitment rules for backup or migration.
                        </p>

                        <div className="space-y-3">
                            <Button variant="outline" className="w-full">
                                <Download className="w-4 h-4 mr-2" />
                                Export Taxonomy (JSON)
                            </Button>
                            <Button variant="outline" className="w-full">
                                <Download className="w-4 h-4 mr-2" />
                                Export Fitment Rules (JSON)
                            </Button>
                            <Button variant="outline" className="w-full">
                                <Download className="w-4 h-4 mr-2" />
                                Export All (ZIP)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Debug Logs Page - Enhanced with Service Info, Affected Areas, Debug Commands
// ============================================================================

function GarageDebugLogsPage() {
    const [logs, setLogs] = useState<DebugLog[]>([]);
    const [filterService, setFilterService] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [selectedLog, setSelectedLog] = useState<DebugLog | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 5000); // Auto-refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    function loadLogs() {
        setLogs(getGarageDebugLogs());
    }

    function handleDelete(id: string) {
        deleteGarageDebugLog(id);
        loadLogs();
        if (selectedLog?.id === id) setSelectedLog(null);
    }

    function handleClearAll() {
        clearGarageDebugLogs();
        loadLogs();
        setShowClearConfirm(false);
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        setCopiedCommand(text);
        setTimeout(() => setCopiedCommand(null), 2000);
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

    function getTypeIcon(type: DebugLog['type']) {
        switch (type) {
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500" />;
        }
    }

    function getTypeBgColor(type: DebugLog['type']): string {
        switch (type) {
            case 'error': return 'bg-red-500/10 border-red-500/30';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
            case 'info': return 'bg-blue-500/10 border-blue-500/30';
        }
    }

    function getSeverityLabel(type: DebugLog['type']): string {
        switch (type) {
            case 'error': return 'Critical';
            case 'warning': return 'Warning';
            case 'info': return 'Informational';
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bug className="w-6 h-6" />
                        Debug Logs - My Garage
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Plugin operations, errors, and debugging information with contextual help
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={loadLogs}>
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
                            {GARAGE_SERVICES.map(service => (
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
                                Logs will appear here when plugin operations are performed
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
                                                        <span className="text-muted-foreground/60">
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <CardHeader className="border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {getTypeIcon(selectedLog.type)}
                                    <div>
                                        <CardTitle className="text-lg">{selectedLog.service} - Debug Report</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            {getSeverityLabel(selectedLog.type)} • {formatTime(selectedLog.lastOccurrence)}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Incident Overview */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">Severity</div>
                                    <div className={`font-semibold mt-1 ${
                                        selectedLog.type === 'error' ? 'text-red-500' :
                                        selectedLog.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                                    }`}>
                                        {getSeverityLabel(selectedLog.type)}
                                    </div>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">Occurrences</div>
                                    <div className="font-semibold mt-1">{selectedLog.count}x</div>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">First Seen</div>
                                    <div className="font-mono text-sm mt-1">{new Date(selectedLog.firstOccurrence).toLocaleTimeString()}</div>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground uppercase font-medium">Last Seen</div>
                                    <div className="font-mono text-sm mt-1">{new Date(selectedLog.lastOccurrence).toLocaleTimeString()}</div>
                                </div>
                            </div>

                            {/* Error Message */}
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Terminal className="h-4 w-4" /> Error Message
                                </h3>
                                <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-300">
                                    <p>{selectedLog.message}</p>
                                </div>
                            </div>

                            {/* Technical Details */}
                            {selectedLog.details && (
                                <div>
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <FileCode className="h-4 w-4" /> Technical Details
                                    </h3>
                                    <pre className="bg-zinc-900 rounded-lg p-4 font-mono text-xs text-zinc-300 overflow-auto max-h-48 whitespace-pre-wrap">
                                        {selectedLog.details}
                                    </pre>
                                </div>
                            )}

                            {/* Service Information */}
                            {(() => {
                                const info = getGarageServiceInfo(selectedLog.service);
                                return (
                                    <>
                                        {/* Service Details */}
                                        <div>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <Server className="h-4 w-4" /> Service Details
                                            </h3>
                                            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                                <div>
                                                    <span className="text-xs text-muted-foreground uppercase">Description</span>
                                                    <p className="text-sm mt-1">{info.description}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-xs text-muted-foreground uppercase">Endpoint</span>
                                                        <p className="font-mono text-sm mt-1">{info.endpoint}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-muted-foreground uppercase">Dependencies</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {info.dependencies.map(dep => (
                                                                <Badge key={dep} variant="outline" className="text-xs">{dep}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* File Locations */}
                                        {info.fileLocations.length > 0 && (
                                            <div>
                                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                    <FileCode className="h-4 w-4 text-cyan-500" /> Related Files
                                                </h3>
                                                <div className="bg-zinc-900 rounded-lg p-4 space-y-1">
                                                    {info.fileLocations.map((file, i) => (
                                                        <div key={i} className="font-mono text-sm text-cyan-400 flex items-center gap-2">
                                                            <span className="text-zinc-500">→</span> {file}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Affected Areas */}
                                        <div>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <AlertOctagon className="h-4 w-4 text-red-500" /> Affected Areas
                                            </h3>
                                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    This error may impact the following functionality:
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {info.affectedAreas.map(area => (
                                                        <Badge key={area} className="bg-red-500/20 text-red-400 border-red-500/30">
                                                            {area}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recommended Actions */}
                                        <div>
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <Lightbulb className="h-4 w-4 text-yellow-500" /> Recommended Actions
                                            </h3>
                                            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
                                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                                    {info.recommendedActions.map((action, i) => (
                                                        <li key={i}>{action}</li>
                                                    ))}
                                                    {selectedLog.type === 'error' && (
                                                        <li className="text-red-400 font-medium">This is a critical error - address immediately</li>
                                                    )}
                                                </ol>
                                            </div>
                                        </div>

                                        {/* Debug Commands */}
                                        {info.debugCommands.length > 0 && (
                                            <div>
                                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                    <Terminal className="h-4 w-4 text-cyan-500" /> Debug Commands
                                                </h3>
                                                <div className="bg-zinc-900 rounded-lg p-4 space-y-3">
                                                    {info.debugCommands.map((cmd, i) => (
                                                        <div key={i}>
                                                            <div className="text-zinc-400 text-xs mb-1"># {cmd.label}</div>
                                                            <div className="flex items-center gap-2">
                                                                <code className="text-green-400 flex-1 font-mono text-sm">{cmd.command}</code>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-2"
                                                                    onClick={() => copyToClipboard(cmd.command)}
                                                                >
                                                                    {copiedCommand === cmd.command ? (
                                                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                                                    ) : (
                                                                        <Copy className="h-3 w-3" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Actions Footer */}
                            <div className="flex justify-between items-center pt-4 border-t">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        handleDelete(selectedLog.id);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete This Log
                                </Button>
                                <Button variant="default" size="sm" onClick={() => setSelectedLog(null)}>
                                    Close Report
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
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
                            <Button variant="destructive" onClick={handleClearAll}>
                                Clear All
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Dashboard Extension Definition
// ============================================================================

defineDashboardExtension({
    navSections: [
        {
            id: 'my-garage',
            title: 'My Garage',
            icon: Car,
            order: 70,
        },
    ],
    routes: [
        {
            path: '/garage-overview',
            component: () => <GarageOverviewPage />,
            navMenuItem: {
                sectionId: 'my-garage',
                id: 'garage-overview',
                title: 'Overview',
                icon: BarChart3,
            },
        },
        {
            path: '/garage-taxonomy',
            component: () => <GarageTaxonomyPage />,
            navMenuItem: {
                sectionId: 'my-garage',
                id: 'garage-taxonomy',
                title: 'Taxonomy',
                icon: Database,
            },
        },
        {
            path: '/garage-fitment',
            component: () => <GarageFitmentPage />,
            navMenuItem: {
                sectionId: 'my-garage',
                id: 'garage-fitment',
                title: 'Fitment Rules',
                icon: List,
            },
        },
        {
            path: '/garage-import',
            component: () => <GarageImportPage />,
            navMenuItem: {
                sectionId: 'my-garage',
                id: 'garage-import',
                title: 'Import Data',
                icon: Upload,
            },
        },
        {
            path: '/garage-debug-logs',
            component: () => <GarageDebugLogsPage />,
            navMenuItem: {
                sectionId: 'my-garage',
                id: 'garage-debug-logs',
                title: 'Debug Logs',
                icon: Bug,
            },
        },
    ],
});
