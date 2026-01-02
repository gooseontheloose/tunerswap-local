/**
 * STRIPE CONNECT - COMMISSION SETTINGS UI
 * Simple UI to configure platform commission rates per product type
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from '@vendure/dashboard';
import {
  DollarSign,
  CreditCard,
  Percent,
  RefreshCw,
  Wallet,
  Zap,
  Clock,
  Users,
  Save,
  FileText,
  CheckCircle,
  AlertCircle,
  Calendar,
  Settings,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// GraphQL queries
const GET_COMMISSIONS = `
  query GetCommissions {
    stripeConnectCommissions {
      config {
        id
        productType
        commissionRate
        fixedFee
        isActive
      }
      preview {
        grossCommission
        stripeFee
        netEarnings
        perHundredDollars {
          gross
          stripeFee
          net
        }
      }
    }
    stripeConnectPayoutMode
  }
`;

const UPDATE_COMMISSION = `
  mutation UpdateCommission($productType: String!, $commissionRate: Float!, $fixedFee: Float) {
    updateCommissionRate(productType: $productType, commissionRate: $commissionRate, fixedFee: $fixedFee) {
      config {
        id
        productType
        commissionRate
        fixedFee
      }
      preview {
        grossCommission
        stripeFee
        netEarnings
        perHundredDollars {
          gross
          stripeFee
          net
        }
      }
    }
  }
`;

const SET_PAYOUT_MODE = `
  mutation SetPayoutMode($mode: PayoutMode!) {
    setPayoutMode(mode: $mode) {
      payoutMode
    }
  }
`;

const GET_PENDING_PAYOUTS = `
  query GetPendingPayouts {
    stripeConnectPendingPayouts {
      vendorId
      vendorName
      pendingAmount
      orderCount
      oldestOrderDate
    }
  }
`;

const TRIGGER_PAYOUT = `
  mutation TriggerPayout($vendorId: ID!) {
    triggerVendorPayout(vendorId: $vendorId) {
      success
      payoutId
      transferId
      amount
      error
    }
  }
`;

const GET_PAYOUT_SCHEDULE = `
  query GetPayoutSchedule {
    stripeConnectPayoutSchedule {
      payoutMode
      scheduleInterval
      delayDays
      weeklyAnchor
      monthlyAnchor
      minimumPayoutAmount
      automaticPayoutsEnabled
      statementDescriptor
    }
  }
`;

const UPDATE_PAYOUT_SCHEDULE = `
  mutation UpdatePayoutSchedule(
    $payoutMode: PayoutMode
    $scheduleInterval: PayoutScheduleInterval
    $delayDays: Int
    $weeklyAnchor: PayoutDayOfWeek
    $monthlyAnchor: Int
    $minimumPayoutAmount: Int
    $automaticPayoutsEnabled: Boolean
    $statementDescriptor: String
  ) {
    updatePayoutSchedule(
      payoutMode: $payoutMode
      scheduleInterval: $scheduleInterval
      delayDays: $delayDays
      weeklyAnchor: $weeklyAnchor
      monthlyAnchor: $monthlyAnchor
      minimumPayoutAmount: $minimumPayoutAmount
      automaticPayoutsEnabled: $automaticPayoutsEnabled
      statementDescriptor: $statementDescriptor
    ) {
      success
      error
      settings {
        payoutMode
        scheduleInterval
        delayDays
        weeklyAnchor
        monthlyAnchor
        minimumPayoutAmount
        automaticPayoutsEnabled
        statementDescriptor
      }
    }
  }
`;

// Types
interface CommissionConfig {
  id: string;
  productType: string;
  commissionRate: number;
  fixedFee: number;
  isActive: boolean;
}

interface EarningsPreview {
  grossCommission: number;
  stripeFee: number;
  netEarnings: number;
  perHundredDollars: {
    gross: number;
    stripeFee: number;
    net: number;
  };
}

interface CommissionWithPreview {
  config: CommissionConfig;
  preview: EarningsPreview;
}

interface PendingPayout {
  vendorId: string;
  vendorName: string;
  pendingAmount: number;
  orderCount: number;
  oldestOrderDate: string;
}

interface PayoutScheduleSettings {
  payoutMode: 'INSTANT' | 'MANUAL';
  scheduleInterval: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';
  delayDays: number;
  weeklyAnchor?: string;
  monthlyAnchor?: number;
  minimumPayoutAmount: number;
  automaticPayoutsEnabled: boolean;
  statementDescriptor?: string;
}

// Product type display config - use full Tailwind classes to avoid purge issues
const productTypes = {
  TUNE: { label: 'Tunes', desc: 'Digital tune files', icon: Zap, bgClass: 'bg-purple-100', textClass: 'text-purple-600' },
  PART: { label: 'Parts', desc: 'Physical parts', icon: CreditCard, bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  SERVICE: { label: 'Services', desc: 'In-person services', icon: Users, bgClass: 'bg-green-100', textClass: 'text-green-600' },
  CUSTOM_INVOICE: { label: 'Invoices', desc: 'Custom invoices', icon: FileText, bgClass: 'bg-orange-100', textClass: 'text-orange-600' },
};

// Calculate earnings for preview
function calculateEarnings(rate: number) {
  const sale = 10000; // $100 in cents
  const gross = Math.round(sale * (rate / 100));
  const stripeFee = Math.round((sale * 0.029) + 30);
  const platformStripeShare = Math.round(stripeFee * (rate / 100));
  const net = gross - platformStripeShare;
  return {
    gross: gross / 100,
    stripeFee: platformStripeShare / 100,
    net: net / 100,
    vendorGets: (sale - gross) / 100,
  };
}

// Commission Settings Page
function CommissionSettingsPage() {
  const [commissions, setCommissions] = useState<CommissionWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editRates, setEditRates] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.query(GET_COMMISSIONS);
      setCommissions(result.stripeConnectCommissions || []);

      const rates: Record<string, number> = {};
      for (const c of result.stripeConnectCommissions || []) {
        rates[c.config.productType] = c.config.commissionRate * 100;
      }
      setEditRates(rates);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveRate = async (productType: string) => {
    setSaving(productType);
    setMessage(null);
    try {
      const rate = (editRates[productType] || 0) / 100;
      const result = await api.mutate(UPDATE_COMMISSION, {
        productType,
        commissionRate: rate,
        fixedFee: 0,
      });
      setCommissions(prev =>
        prev.map(c =>
          c.config.productType === productType
            ? { ...c, ...result.updateCommissionRate }
            : c
        )
      );
      setMessage({ type: 'success', text: `${productTypes[productType as keyof typeof productTypes]?.label || productType} rate saved!` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commission Settings</h1>
          <p className="text-gray-500">Set your platform fee per product type</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Commission Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commissions.map((commission) => {
          const { config } = commission;
          const typeConfig = productTypes[config.productType as keyof typeof productTypes];
          const Icon = typeConfig?.icon || DollarSign;
          const rate = editRates[config.productType] ?? config.commissionRate * 100;
          const earnings = calculateEarnings(rate);
          const hasChanges = Math.abs(rate - config.commissionRate * 100) > 0.01;

          return (
            <Card key={config.productType} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${typeConfig?.bgClass || 'bg-gray-100'}`}>
                    <Icon className={`w-5 h-5 ${typeConfig?.textClass || 'text-gray-600'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{typeConfig?.label || config.productType}</CardTitle>
                    <p className="text-sm text-gray-500">{typeConfig?.desc}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rate Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={rate}
                    onChange={(e) => setEditRates(prev => ({
                      ...prev,
                      [config.productType]: parseFloat(e.target.value) || 0,
                    }))}
                    className="w-24 px-3 py-2 border rounded-lg text-lg font-bold text-center"
                  />
                  <span className="text-xl font-bold text-gray-400">%</span>
                  <Button
                    onClick={() => saveRate(config.productType)}
                    disabled={!hasChanges || saving === config.productType}
                    size="sm"
                    className="ml-auto"
                  >
                    {saving === config.productType ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Save className="w-4 h-4 mr-1" /> Save</>
                    )}
                  </Button>
                </div>

                {/* Earnings Preview Box */}
                <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-200">
                  <div className="text-sm text-gray-500 mb-2">Per $100 sale:</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-2xl font-bold text-green-600">${earnings.net.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">You Keep</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-2xl font-bold text-blue-600">${earnings.vendorGets.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">Seller Gets</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400 text-center">
                    (Stripe fees: ${earnings.stripeFee.toFixed(2)} from your portion)
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Payout Scheduling Page
function PayoutSchedulingPage() {
  const [settings, setSettings] = useState<PayoutScheduleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.query(GET_PAYOUT_SCHEDULE);
      setSettings(result.stripeConnectPayoutSchedule);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (updates: Partial<PayoutScheduleSettings>) => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.mutate(UPDATE_PAYOUT_SCHEDULE, updates);
      if (result.updatePayoutSchedule.success) {
        setSettings(result.updatePayoutSchedule.settings);
        setMessage({ type: 'success', text: 'Settings saved!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result.updatePayoutSchedule.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payout Scheduling</h1>
          <p className="text-gray-500">Configure how and when sellers get paid</p>
        </div>
        <Button onClick={fetchSettings} variant="outline" size="sm" disabled={saving}>
          <RefreshCw className={`w-4 h-4 mr-1 ${saving ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Payout Mode Toggle - Main Feature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" /> Payout Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => updateSetting({ payoutMode: 'INSTANT' })}
              disabled={saving}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.payoutMode === 'INSTANT'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className={`w-5 h-5 ${settings.payoutMode === 'INSTANT' ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="font-semibold text-gray-900">Instant</span>
                {settings.payoutMode === 'INSTANT' && <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Active</span>}
              </div>
              <p className="text-sm text-gray-600">Sellers paid automatically on each sale</p>
            </button>
            <button
              onClick={() => updateSetting({ payoutMode: 'MANUAL' })}
              disabled={saving}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.payoutMode === 'MANUAL'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className={`w-5 h-5 ${settings.payoutMode === 'MANUAL' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="font-semibold text-gray-900">Manual</span>
                {settings.payoutMode === 'MANUAL' && <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Active</span>}
              </div>
              <p className="text-sm text-gray-600">You control when sellers get paid</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Interval */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Payout Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Interval</label>
            <div className="grid grid-cols-4 gap-2">
              {(['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'] as const).map((interval) => (
                <button
                  key={interval}
                  onClick={() => updateSetting({ scheduleInterval: interval })}
                  disabled={saving}
                  className={`p-3 rounded-lg border-2 text-center transition-all font-medium ${
                    settings.scheduleInterval === interval
                      ? 'border-blue-500 bg-blue-100 text-blue-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {interval.charAt(0) + interval.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly Anchor */}
          {settings.scheduleInterval === 'WEEKLY' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Day of Week</label>
              <select
                value={settings.weeklyAnchor || 'FRIDAY'}
                onChange={(e) => updateSetting({ weeklyAnchor: e.target.value as any })}
                disabled={saving}
                className="w-full p-2 border rounded-lg"
              >
                {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => (
                  <option key={day} value={day}>{day.charAt(0) + day.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          )}

          {/* Monthly Anchor */}
          {settings.scheduleInterval === 'MONTHLY' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Day of Month</label>
              <select
                value={settings.monthlyAnchor || 1}
                onChange={(e) => updateSetting({ monthlyAnchor: parseInt(e.target.value) })}
                disabled={saving}
                className="w-full p-2 border rounded-lg"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delay Days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" /> Payout Delay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days before payout (2-14 days)
              </label>
              <input
                type="range"
                min="2"
                max="14"
                value={settings.delayDays}
                onChange={(e) => updateSetting({ delayDays: parseInt(e.target.value) })}
                disabled={saving}
                className="w-full"
              />
            </div>
            <div className="text-center p-3 bg-gray-100 rounded-lg min-w-16">
              <div className="text-2xl font-bold text-gray-900">{settings.delayDays}</div>
              <div className="text-xs text-gray-600">days</div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Funds are held for this many days before being paid out. Helps with dispute resolution.
          </p>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> Advanced Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Automatic Payouts Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Automatic Payouts</div>
              <div className="text-sm text-gray-600">Enable automatic payouts on schedule</div>
            </div>
            <button
              onClick={() => updateSetting({ automaticPayoutsEnabled: !settings.automaticPayoutsEnabled })}
              disabled={saving}
              className="p-1"
            >
              {settings.automaticPayoutsEnabled ? (
                <ToggleRight className="w-10 h-10 text-green-500" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-gray-400" />
              )}
            </button>
          </div>

          {/* Minimum Payout Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Payout Amount (cents)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={settings.minimumPayoutAmount / 100}
                onChange={(e) => updateSetting({ minimumPayoutAmount: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                disabled={saving}
                className="w-32 p-2 border rounded-lg"
              />
              <span className="text-sm text-gray-500">
                ({settings.minimumPayoutAmount} cents)
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Payouts below this amount will be held until threshold is met. Set to 0 for no minimum.
            </p>
          </div>

          {/* Statement Descriptor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statement Descriptor
            </label>
            <input
              type="text"
              maxLength={22}
              value={settings.statementDescriptor || ''}
              onChange={(e) => updateSetting({ statementDescriptor: e.target.value })}
              placeholder="TUNERSWAP PAYOUT"
              disabled={saving}
              className="w-full p-2 border rounded-lg"
            />
            <p className="text-sm text-gray-500 mt-1">
              Appears on vendor bank statements (max 22 characters)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Pending Payouts Page
function PendingPayoutsPage() {
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.query(GET_PENDING_PAYOUTS);
      setPayouts(result.stripeConnectPendingPayouts || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load payouts' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  const handlePayout = async (vendorId: string) => {
    setProcessing(vendorId);
    try {
      const result = await api.mutate(TRIGGER_PAYOUT, { vendorId });
      if (result.triggerVendorPayout.success) {
        setMessage({ type: 'success', text: `Paid $${result.triggerVendorPayout.amount?.toFixed(2)}` });
        fetchPayouts();
      } else {
        setMessage({ type: 'error', text: result.triggerVendorPayout.error || 'Failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Payout failed' });
    } finally {
      setProcessing(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const total = payouts.reduce((sum, p) => sum + p.pendingAmount, 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pending Payouts</h1>
          <p className="text-gray-500">Manual payouts to sellers</p>
        </div>
        <Button onClick={fetchPayouts} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">${total.toFixed(2)}</div>
            <div className="text-sm text-gray-500">Total Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{payouts.length}</div>
            <div className="text-sm text-gray-500">Sellers Waiting</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{payouts.reduce((s, p) => s + p.orderCount, 0)}</div>
            <div className="text-sm text-gray-500">Orders</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {payouts.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-2" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm text-gray-500">No pending payouts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.vendorId}>
                    <TableCell className="font-medium">{p.vendorName}</TableCell>
                    <TableCell>{p.orderCount}</TableCell>
                    <TableCell>{new Date(p.oldestOrderDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      ${p.pendingAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handlePayout(p.vendorId)}
                        disabled={processing === p.vendorId}
                      >
                        {processing === p.vendorId ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          'Pay'
                        )}
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

// Dashboard Extension Definition
defineDashboardExtension({
  navSections: [
    {
      id: 'stripe-connect',
      title: 'Stripe Connect',
      icon: CreditCard,
      order: 85,
    },
  ],
  routes: [
    {
      path: '/stripe-commissions',
      component: () => <CommissionSettingsPage />,
      navMenuItem: {
        sectionId: 'stripe-connect',
        id: 'stripe-commissions',
        title: 'Commissions',
        icon: Percent,
      },
    },
    {
      path: '/stripe-scheduling',
      component: () => <PayoutSchedulingPage />,
      navMenuItem: {
        sectionId: 'stripe-connect',
        id: 'stripe-scheduling',
        title: 'Scheduling',
        icon: Calendar,
      },
    },
    {
      path: '/stripe-payouts',
      component: () => <PendingPayoutsPage />,
      navMenuItem: {
        sectionId: 'stripe-connect',
        id: 'stripe-payouts',
        title: 'Payouts',
        icon: Wallet,
      },
    },
  ],
});
