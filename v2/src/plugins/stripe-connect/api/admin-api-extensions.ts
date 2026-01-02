// FILE: src/plugins/stripe-connect/api/admin-api-extensions.ts
// PURPOSE: GraphQL schema extensions for Stripe Connect admin API
// STATUS: Production-ready

import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  # ==========================================================================
  # TYPES
  # ==========================================================================

  """
  Commission configuration for a product type
  """
  type CommissionConfig {
    id: ID!
    productType: String!
    commissionRate: Float!
    fixedFee: Float!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  """
  Earnings preview showing platform earnings at current commission rate
  """
  type EarningsPreview {
    "Gross commission before Stripe fees (in cents)"
    grossCommission: Int!
    "Stripe processing fee (in cents)"
    stripeFee: Int!
    "Net earnings after Stripe fees (in cents)"
    netEarnings: Int!
    "Breakdown per $100 sale"
    perHundredDollars: EarningsPerHundred!
  }

  """
  Earnings breakdown per $100 sale
  """
  type EarningsPerHundred {
    "Gross commission in dollars"
    gross: Float!
    "Stripe fee portion in dollars"
    stripeFee: Float!
    "Net earnings in dollars"
    net: Float!
  }

  """
  Commission rate with earnings preview
  """
  type CommissionWithPreview {
    config: CommissionConfig!
    preview: EarningsPreview!
  }

  """
  Pending payout summary for a vendor
  """
  type PendingPayoutSummary {
    vendorId: ID!
    vendorName: String!
    pendingAmount: Float!
    orderCount: Int!
    oldestOrderDate: DateTime!
  }

  """
  Detailed payout info for a vendor
  """
  type VendorPayoutDetails {
    vendorId: ID!
    pendingAmount: Float!
    orders: [PayoutOrder!]!
  }

  """
  Order in a payout
  """
  type PayoutOrder {
    orderId: ID!
    orderNumber: String!
    amount: Float!
    placedAt: DateTime!
  }

  """
  Payout result
  """
  type PayoutResult {
    success: Boolean!
    payoutId: ID
    transferId: String
    amount: Float
    error: String
  }

  """
  Payout mode setting
  """
  enum PayoutMode {
    INSTANT
    MANUAL
  }

  """
  Stripe payout schedule interval
  """
  enum PayoutScheduleInterval {
    DAILY
    WEEKLY
    MONTHLY
    MANUAL
  }

  """
  Day of week for weekly payouts
  """
  enum PayoutDayOfWeek {
    MONDAY
    TUESDAY
    WEDNESDAY
    THURSDAY
    FRIDAY
    SATURDAY
    SUNDAY
  }

  """
  Complete payout schedule settings
  """
  type PayoutScheduleSettings {
    "Platform payout mode (instant to vendor or manual control)"
    payoutMode: PayoutMode!
    "Stripe payout schedule interval for platform account"
    scheduleInterval: PayoutScheduleInterval!
    "Days delay before payout (2-14)"
    delayDays: Int!
    "Day of week for weekly schedule"
    weeklyAnchor: PayoutDayOfWeek
    "Day of month for monthly schedule (1-31)"
    monthlyAnchor: Int
    "Minimum payout amount in cents (0 = no minimum)"
    minimumPayoutAmount: Int!
    "Whether automatic payouts are enabled"
    automaticPayoutsEnabled: Boolean!
    "Statement descriptor for payouts"
    statementDescriptor: String
  }

  """
  Platform settings result
  """
  type PlatformSettingsResult {
    payoutMode: PayoutMode!
  }

  """
  Payout schedule update result
  """
  type PayoutScheduleResult {
    success: Boolean!
    settings: PayoutScheduleSettings
    error: String
  }

  # ==========================================================================
  # QUERIES
  # ==========================================================================

  extend type Query {
    """
    Get all commission configurations with earnings previews
    """
    stripeConnectCommissions: [CommissionWithPreview!]!

    """
    Get current payout mode
    """
    stripeConnectPayoutMode: PayoutMode!

    """
    Get pending payouts summary for all vendors
    """
    stripeConnectPendingPayouts: [PendingPayoutSummary!]!

    """
    Get detailed pending payout for a specific vendor
    """
    stripeConnectVendorPayout(vendorId: ID!): VendorPayoutDetails

    """
    Get payout schedule settings
    """
    stripeConnectPayoutSchedule: PayoutScheduleSettings!
  }

  # ==========================================================================
  # MUTATIONS
  # ==========================================================================

  extend type Mutation {
    """
    Update commission rate for a product type
    """
    updateCommissionRate(
      productType: String!
      commissionRate: Float!
      fixedFee: Float
    ): CommissionWithPreview!

    """
    Set payout mode (instant or manual)
    """
    setPayoutMode(mode: PayoutMode!): PlatformSettingsResult!

    """
    Trigger manual payout for a vendor
    """
    triggerVendorPayout(vendorId: ID!): PayoutResult!

    """
    Trigger batch payout for multiple vendors
    """
    triggerBatchPayout(vendorIds: [ID!]!): [PayoutResult!]!

    """
    Update payout schedule settings
    """
    updatePayoutSchedule(
      payoutMode: PayoutMode
      scheduleInterval: PayoutScheduleInterval
      delayDays: Int
      weeklyAnchor: PayoutDayOfWeek
      monthlyAnchor: Int
      minimumPayoutAmount: Int
      automaticPayoutsEnabled: Boolean
      statementDescriptor: String
    ): PayoutScheduleResult!
  }
`;
