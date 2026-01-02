import gql from 'graphql-tag';

// Shop API extensions (for frontend/customers/sellers)
export const shopApiExtensions = gql`
    "Custom badge for seller profiles"
    type CustomBadge {
        "Icon name from preset list: star, trophy, fire, bolt, shield, heart, crown, diamond, rocket, wrench, check, zap, medal, sparkles, lightning"
        icon: String!
        "Custom text to display on the badge"
        text: String!
        "Badge color: gold, silver, bronze, red, blue, green, purple, orange, pink, cyan"
        color: String!
    }

    "Available preset badge icons"
    enum BadgeIcon {
        star
        trophy
        fire
        bolt
        shield
        heart
        crown
        diamond
        rocket
        wrench
        check
        zap
        medal
        sparkles
        lightning
    }

    "Available badge colors"
    enum BadgeColor {
        gold
        silver
        bronze
        red
        blue
        green
        purple
        orange
        pink
        cyan
    }

    type SellerProfile {
        id: ID!
        firstName: String!
        lastName: String!
        phone: String
        location: String
        address: String
        businessName: String
        website: String
        instagram: String
        facebook: String
        youtube: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        hours: String
        status: String!
        verified: Boolean!
        profileComplete: Boolean!
        profileImageUrl: String
        bannerImageUrl: String
        rating: Float!
        reviewCount: Int!
        tunesSold: Int!
        totalOrders: Int!
        slug: String
        "Custom badges assigned by admin"
        customBadges: [CustomBadge!]
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    "Result for image upload operations"
    type UploadResult {
        success: Boolean!
        url: String
        assetId: ID
        error: String
    }

    "Gallery image for seller profile"
    type SellerGalleryImage {
        id: ID!
        url: String!
        previewUrl: String
        title: String
        description: String
        category: String
        isPublic: Boolean!
        sortOrder: Int!
        originalFilename: String
        mimeType: String
        fileSize: Int
        width: Int
        height: Int
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    "Paginated list of seller gallery images"
    type SellerGalleryImageList {
        items: [SellerGalleryImage!]!
        totalItems: Int!
    }

    "Result for gallery operations"
    type GalleryResult {
        success: Boolean!
        message: String
        image: SellerGalleryImage
    }

    "Input for uploading a gallery image"
    input UploadGalleryImageInput {
        title: String
        description: String
        category: String
        isPublic: Boolean
    }

    "Input for updating a gallery image"
    input UpdateGalleryImageInput {
        title: String
        description: String
        category: String
        isPublic: Boolean
        sortOrder: Int
    }

    type SellerProfileList {
        items: [SellerProfile!]!
        totalItems: Int!
    }

    type RegisterSellerResult {
        success: Boolean!
        message: String
        sellerId: ID
        "The admin dashboard URL for the seller to log in"
        adminUrl: String
        "The email address to use for admin login (same as registration email)"
        adminEmail: String
        "The channel token assigned to this seller"
        channelToken: String
    }

    input RegisterSellerInput {
        email: String!
        password: String!
        firstName: String!
        lastName: String!
        phone: String
        location: String
        businessName: String
        website: String
        socialMedia: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        "Desired URL slug for the seller profile (will be validated and normalized)"
        desiredSlug: String
    }

    input UpdateSellerProfileInput {
        firstName: String
        lastName: String
        phone: String
        location: String
        address: String
        businessName: String
        website: String
        instagram: String
        facebook: String
        youtube: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        hours: String
        profileComplete: Boolean
    }

    "Tuner/Seller application request"
    type TunerRequest {
        id: ID!
        customerId: ID
        firstName: String!
        lastName: String!
        phone: String
        location: String
        address: String
        businessName: String
        website: String
        instagram: String
        facebook: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        hours: String
        status: String!
        adminNotes: String
        reviewedAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    "Result for tuner request submission"
    type TunerRequestResult {
        success: Boolean!
        message: String
        requestId: ID
    }

    "Input for submitting a tuner/seller request"
    input SubmitTunerRequestInput {
        firstName: String!
        lastName: String!
        phone: String
        location: String
        address: String
        businessName: String
        website: String
        instagram: String
        facebook: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        hours: String
    }

    "Seller product for dashboard"
    type SellerProduct {
        id: ID!
        name: String!
        slug: String!
        description: String
        price: Int!
        priceWithTax: Int!
        productType: String!
        status: String!
        featuredAsset: Asset
        featuredAssetUrl: String
        sales: Int!
        rating: Float
        reviewCount: Int
        stock: Int
        inStock: Boolean
        "Tune-specific fields"
        platform: String
        software: String
        hpGain: String
        torqueGain: String
        requiredMods: String
        "Part-specific fields"
        category: String
        brand: String
        condition: String
        sku: String
        weight: Float
        dimensions: String
        compatibleVehicles: String
        trackInventory: Boolean
        freeShipping: Boolean
        localPickup: Boolean
        "Service-specific fields"
        duration: String
        serviceType: String
        whatsIncluded: String
        requirements: String
        appointmentRequired: Boolean
        weekendsAvailable: Boolean
        mobileService: Boolean
        depositRequired: Boolean
        depositAmount: Int
        pricingType: String
        hourlyRate: Int
        setupFee: Int
        minimumHours: Float
        allowHourSelection: Boolean
        maxHours: Int
        contactForPricing: Boolean
        createdAt: DateTime!
    }

    "Paginated list of seller products"
    type SellerProductList {
        items: [SellerProduct!]!
        totalItems: Int!
    }

    "Product variant for productsByType query"
    type ProductVariantResult {
        id: ID!
        name: String
        sku: String
        price: Int!
        priceWithTax: Int!
        stockLevel: String
    }

    "Custom fields for productsByType query"
    type ProductCustomFieldsResult {
        productType: String
        sellerId: String
        contactForPricing: Boolean
        isDigital: Boolean
    }

    "Product result for productsByType query"
    type ProductByTypeResult {
        id: ID!
        name: String!
        slug: String!
        description: String
        featuredAsset: Asset
        variants: [ProductVariantResult!]!
        customFields: ProductCustomFieldsResult
    }

    "Result type for productsByType query"
    type ProductsByTypeResult {
        items: [ProductByTypeResult!]!
        totalItems: Int!
        error: String
    }

    "Order line item for seller"
    type SellerOrderLine {
        id: ID!
        productName: String!
        productType: String!
        quantity: Int!
        unitPrice: Int!
        lineTotal: Int!
    }

    "Order for seller dashboard"
    type SellerOrder {
        id: ID!
        code: String!
        customerName: String!
        customerEmail: String!
        total: Int!
        status: String!
        lines: [SellerOrderLine!]!
        createdAt: DateTime!
    }

    "Paginated list of seller orders"
    type SellerOrderList {
        items: [SellerOrder!]!
        totalItems: Int!
    }

    "Input for creating a tune listing"
    input CreateTuneInput {
        name: String!
        description: String!
        price: Int!
        platform: String!
        software: String
        hpGain: String
        torqueGain: String
        requiredMods: String
        featuredAssetId: ID
        "If true, hide price and display 'Contact for Pricing'"
        contactForPricing: Boolean
    }

    "Input for creating a parts listing"
    input CreatePartsInput {
        name: String!
        description: String!
        price: Int!
        sku: String
        stock: Int
        weight: Float
        dimensions: String
        featuredAssetId: ID
        "If true, hide price and display 'Contact for Pricing'"
        contactForPricing: Boolean
    }

    "Input for creating a service listing"
    input CreateServiceInput {
        name: String!
        description: String!
        price: Int!
        durationMinutes: Int
        locationRequired: Boolean
        featuredAssetId: ID
        "If true, hide price and display 'Contact for Pricing'"
        contactForPricing: Boolean
        "Pricing type: flat_rate, hourly, or hourly_with_setup"
        pricingType: String
        "Hourly rate in cents (for hourly and hourly_with_setup)"
        hourlyRate: Int
        "Setup fee in cents (for hourly_with_setup)"
        setupFee: Int
        "Minimum hours required"
        minimumHours: Float
        "Allow customers to select hours at checkout"
        allowHourSelection: Boolean
        "Maximum hours customer can book"
        maxHours: Int
    }

    "Input for creating a custom invoice (one-time payment link)"
    input CreateInvoiceInput {
        "Invoice title/subject"
        name: String!
        "Detailed description of what this invoice is for"
        description: String!
        "Total amount in cents"
        price: Int!
        "Customer ID to send the invoice to (optional if using email)"
        recipientCustomerId: ID
        "Email address to send the invoice to"
        recipientEmail: String!
        "Additional notes visible to the customer"
        notes: String
        "JSON array of line items for itemized invoices [{description, quantity, unitPrice}]"
        lineItems: String
        "Days until the invoice expires (default 30)"
        expirationDays: Int
        "Send email notification immediately"
        sendEmail: Boolean
    }

    "Invoice details returned from queries"
    type InvoiceDetails {
        id: ID!
        productId: ID!
        token: String!
        name: String!
        description: String!
        price: Int!
        recipientCustomerId: ID
        recipientEmail: String!
        notes: String
        lineItems: String
        status: String!
        createdAt: DateTime!
        expiresAt: DateTime
        paidAt: DateTime
        seller: SellerProfile
        paymentUrl: String
    }

    "Result for invoice operations"
    type InvoiceResult {
        success: Boolean!
        message: String
        invoice: InvoiceDetails
        paymentUrl: String
    }

    "Customer search result for invoice recipient selection"
    type CustomerSearchResult {
        id: ID!
        email: String!
        firstName: String
        lastName: String
        fullName: String
    }

    "Paginated list of invoices"
    type InvoiceListResult {
        items: [InvoiceDetails!]!
        totalItems: Int!
    }

    "Result for product creation"
    type CreateProductResult {
        success: Boolean!
        message: String
        productId: ID
        slug: String
    }

    extend type Query {
        "Get the current logged-in user's seller profile"
        activeSellerProfile: SellerProfile

        "Get a seller profile by slug (public)"
        sellerBySlug(slug: String!): SellerProfile

        "Get a seller profile by ID (public)"
        sellerById(id: String!): SellerProfile

        "List all approved sellers (public)"
        sellers(skip: Int, take: Int): SellerProfileList!

        "Get public products for a seller by seller ID (public)"
        sellerProducts(sellerId: String!): [SellerProduct!]!

        "Debug: Check all products in database"
        debugProducts: JSON

        "Get products by type (bypasses channel filtering) - for collections pages"
        productsByType(productType: String!, take: Int, skip: Int): ProductsByTypeResult!

        "Get current user's pending tuner request (if any)"
        myTunerRequest: TunerRequest

        "Get current seller's products"
        mySellerProducts(productType: String, skip: Int, take: Int): SellerProductList!

        "Get current seller's orders"
        mySellerOrders(status: String, productType: String, skip: Int, take: Int): SellerOrderList!

        "Check if current customer is an admin viewer"
        isAdminViewer: Boolean!

        "Get all sellers for admin viewer dropdown (admin viewers only)"
        allSellersForViewer: [SellerProfile!]!

        "Get current seller's gallery images"
        myGalleryImages(category: String, includePrivate: Boolean): SellerGalleryImageList!

        "Get public gallery images for a seller by seller profile ID (public)"
        sellerGalleryImages(sellerId: ID!): [SellerGalleryImage!]!

        "Get a seller's products by seller ID (admin viewers only)"
        sellerProductsForViewer(sellerId: ID!, productType: String): SellerProductList!

        "Get a seller's orders by seller ID (admin viewers only)"
        sellerOrdersForViewer(sellerId: ID!, status: String): SellerOrderList!

        "Check if a seller slug is available (for custom URL selection)"
        checkSlugAvailability(slug: String!): SlugAvailabilityResult!

        "Get current seller's invoices"
        mySellerInvoices(status: String, skip: Int, take: Int): InvoiceListResult!

        "Get invoice by payment token (for payment page)"
        invoiceByToken(token: String!): InvoiceDetails

        "Search customers by email/name for invoice recipient"
        searchCustomersForInvoice(query: String!, take: Int): [CustomerSearchResult!]!

        "Get invoices sent to the current customer"
        myReceivedInvoices(status: String): [InvoiceDetails!]!
    }

    "Result for slug availability check"
    type SlugAvailabilityResult {
        "Whether the slug is available"
        available: Boolean!
        "The normalized/sanitized version of the slug"
        normalizedSlug: String!
        "Message explaining why slug is unavailable (if applicable)"
        message: String
    }

    "Result for slug update operation"
    type UpdateSlugResult {
        success: Boolean!
        message: String
        "The new slug if successful"
        newSlug: String
    }

    extend type Mutation {
        "Register a new seller account"
        registerSeller(input: RegisterSellerInput!): RegisterSellerResult!

        "Update the current seller's profile"
        updateSellerProfile(input: UpdateSellerProfileInput!): SellerProfile!

        "Submit a request to become a tuner/seller"
        submitTunerRequest(input: SubmitTunerRequestInput!): TunerRequestResult!

        "Cancel a pending tuner request"
        cancelTunerRequest: TunerRequestResult!

        "Create a tune listing"
        createTuneListing(input: CreateTuneInput!): CreateProductResult!

        "Create a parts listing"
        createPartsListing(input: CreatePartsInput!): CreateProductResult!

        "Create a service listing"
        createServiceListing(input: CreateServiceInput!): CreateProductResult!

        "Create a custom invoice (one-time payment link)"
        createInvoiceListing(input: CreateInvoiceInput!): InvoiceResult!

        "Cancel an invoice (sets status to cancelled)"
        cancelInvoice(invoiceId: ID!): InvoiceResult!

        "Resend invoice email notification"
        resendInvoiceEmail(invoiceId: ID!): InvoiceResult!

        "Update a product listing"
        updateProductListing(
            productId: ID!
            name: String
            description: String
            price: Int
            contactForPricing: Boolean
            status: String
            "Tune-specific fields"
            platform: String
            software: String
            hpGain: String
            torqueGain: String
            requiredMods: String
            "Part-specific fields"
            brand: String
            category: String
            condition: String
            sku: String
            stock: Int
            weight: Float
            dimensions: String
            compatibleVehicles: String
            trackInventory: Boolean
            freeShipping: Boolean
            localPickup: Boolean
            "Service-specific fields"
            serviceType: String
            duration: String
            whatsIncluded: String
            requirements: String
            appointmentRequired: Boolean
            weekendsAvailable: Boolean
            mobileService: Boolean
            depositRequired: Boolean
            depositAmount: Int
            pricingType: String
            hourlyRate: Int
            setupFee: Int
            minimumHours: Float
            maxHours: Int
            allowHourSelection: Boolean
        ): CreateProductResult!

        "Delete a product listing"
        deleteProductListing(productId: ID!): CreateProductResult!

        "Upload a profile image for seller"
        uploadSellerProfileImage(file: Upload!): UploadResult!

        "Upload a banner image for seller"
        uploadSellerBannerImage(file: Upload!): UploadResult!

        "Upload a profile image for buyer (customer)"
        uploadBuyerProfileImage(file: Upload!): UploadResult!

        "Upload a gallery image for seller"
        uploadGalleryImage(file: Upload!, input: UploadGalleryImageInput): GalleryResult!

        "Update a gallery image"
        updateGalleryImage(id: ID!, input: UpdateGalleryImageInput!): GalleryResult!

        "Delete a gallery image"
        deleteGalleryImage(id: ID!): GalleryResult!

        "Reorder gallery images"
        reorderGalleryImages(imageIds: [ID!]!): GalleryResult!

        "Toggle gallery image visibility (public/private)"
        toggleGalleryImageVisibility(id: ID!): GalleryResult!

        "Update the current seller's custom URL slug"
        updateSellerSlug(slug: String!): UpdateSlugResult!
    }
`;

// Admin API extensions
export const adminApiExtensions = gql`
    "Custom badge for seller profiles"
    type CustomBadge {
        "Icon name from preset list"
        icon: String!
        "Custom text to display on the badge"
        text: String!
        "Badge color"
        color: String!
    }

    "Input for creating/updating a custom badge"
    input CustomBadgeInput {
        "Icon name: star, trophy, fire, bolt, shield, heart, crown, diamond, rocket, wrench, check, zap, medal, sparkles, lightning"
        icon: String!
        "Custom text to display on the badge"
        text: String!
        "Badge color: gold, silver, bronze, red, blue, green, purple, orange, pink, cyan"
        color: String!
    }

    "Available preset badge icons for admin UI"
    type BadgeIconOption {
        value: String!
        label: String!
    }

    "Available badge colors for admin UI"
    type BadgeColorOption {
        value: String!
        label: String!
        hex: String!
    }

    type SellerProfile {
        id: ID!
        customerId: ID
        firstName: String!
        lastName: String!
        phone: String
        location: String
        address: String
        businessName: String
        website: String
        instagram: String
        facebook: String
        youtube: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        hours: String
        status: String!
        verified: Boolean!
        profileComplete: Boolean!
        profileImageUrl: String
        bannerImageUrl: String
        rating: Float!
        reviewCount: Int!
        tunesSold: Int!
        totalOrders: Int!
        totalRevenue: Float!
        stripeConnected: Boolean!
        stripeAccountId: String
        paypalConnected: Boolean!
        paypalEmail: String
        slug: String
        "Custom badges assigned by admin"
        customBadges: [CustomBadge!]
        "Moderation fields"
        hardSuspended: Boolean!
        hardSuspendedReason: String
        hardSuspendedAt: DateTime
        banned: Boolean!
        banReason: String
        bannedAt: DateTime
        bannedBy: String
        adminNotes: String
        warningCount: Int!
        lastWarning: String
        lastWarningAt: DateTime
        moderationHistory: String
        featured: Boolean!
        prioritySupport: Boolean!
        trusted: Boolean!
        lastReviewedAt: DateTime
        lastReviewedBy: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type SellerProfileList {
        items: [SellerProfile!]!
        totalItems: Int!
    }

    input UpdateMySellerProfileInput {
        firstName: String
        lastName: String
        phone: String
        location: String
        address: String
        businessName: String
        website: String
        instagram: String
        facebook: String
        youtube: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        hours: String
        profileComplete: Boolean
    }

    "Marketplace runtime settings"
    type MarketplaceSettings {
        "If true, all new users bypass email verification"
        autoVerifyEmail: Boolean!
        "If true, new sellers automatically get the verified badge"
        autoVerifySeller: Boolean!
        "If true, new seller registrations are automatically approved"
        autoApprove: Boolean!
        "If true, tuner requests are auto-approved"
        autoApproveTunerRequests: Boolean!
    }

    "Tuner/Seller application request for admin"
    type TunerRequest {
        id: ID!
        customerId: ID
        customerEmail: String
        firstName: String!
        lastName: String!
        phone: String
        location: String
        address: String
        businessName: String
        website: String
        instagram: String
        facebook: String
        bio: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        hours: String
        status: String!
        adminNotes: String
        reviewedBy: String
        reviewedAt: DateTime
        sellerProfileId: ID
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    "Paginated list of tuner requests"
    type TunerRequestList {
        items: [TunerRequest!]!
        totalItems: Int!
    }

    "Result for tuner request operations"
    type TunerRequestOperationResult {
        success: Boolean!
        message: String
        request: TunerRequest
        sellerProfileId: ID
    }

    "Admin viewer customer info"
    type AdminViewerInfo {
        id: ID!
        firstName: String!
        lastName: String!
        emailAddress: String!
        isAdminViewer: Boolean!
        createdAt: DateTime!
    }

    "Paginated list of admin viewers"
    type AdminViewerList {
        items: [AdminViewerInfo!]!
        totalItems: Int!
    }

    "Result for customer account operations"
    type CustomerAccountResult {
        success: Boolean!
        message: String
    }

    "Result for email verification operations"
    type VerifyCustomerEmailResult {
        success: Boolean!
        message: String
    }

    "Result for converting customer to seller"
    type ConvertToSellerResult {
        success: Boolean!
        message: String
        sellerProfileId: ID
    }

    "User account info for customer management"
    type CustomerUserInfo {
        id: ID!
        verified: Boolean!
        enabled: Boolean!
        lastLogin: DateTime
    }

    "Customer with management info"
    type CustomerForManagement {
        id: ID!
        firstName: String!
        lastName: String!
        emailAddress: String!
        phoneNumber: String
        createdAt: DateTime!
        user: CustomerUserInfo
        isSeller: Boolean!
        sellerProfileId: ID
        sellerStatus: String
        sellerVerified: Boolean
    }

    "Paginated list of customers for management"
    type CustomerManagementList {
        items: [CustomerForManagement!]!
        totalItems: Int!
    }

    extend type Query {
        "Get all seller profiles (admin)"
        sellerProfiles(skip: Int, take: Int, status: String): SellerProfileList!

        "Get customers for management page (superadmin)"
        customersForManagement(
            skip: Int
            take: Int
            searchTerm: String
            filterVerified: Boolean
            filterSeller: Boolean
        ): CustomerManagementList!

        "Get a single seller profile by ID (admin)"
        sellerProfile(id: ID!): SellerProfile

        "Get the current seller's own profile (for seller dashboard)"
        mySellerProfile: SellerProfile

        "Get current marketplace settings (superadmin only)"
        marketplaceSettings: MarketplaceSettings!

        "Get all tuner requests (admin)"
        tunerRequests(skip: Int, take: Int, status: String): TunerRequestList!

        "Get a single tuner request by ID (admin)"
        tunerRequest(id: ID!): TunerRequest

        "Get all admin viewers (superadmin)"
        adminViewers(skip: Int, take: Int): AdminViewerList!

        "Search customers to grant admin viewer access (superadmin)"
        searchCustomersForAdminViewer(searchTerm: String!): [AdminViewerInfo!]!

        "Get available badge icons for admin UI"
        badgeIconOptions: [BadgeIconOption!]!

        "Get available badge colors for admin UI"
        badgeColorOptions: [BadgeColorOption!]!
    }

    extend type Mutation {
        "Approve a seller (admin)"
        approveSeller(id: ID!): SellerProfile!

        "Reject a seller (admin)"
        rejectSeller(id: ID!): SellerProfile!

        "Suspend a seller (admin)"
        suspendSeller(id: ID!): SellerProfile!

        "Verify a seller - grants the verified badge (admin)"
        verifySeller(id: ID!): SellerProfile!

        "Remove verified badge from a seller (admin)"
        unverifySeller(id: ID!): SellerProfile!

        "Update custom badges for a seller (admin)"
        updateSellerBadges(sellerId: ID!, badges: [CustomBadgeInput!]!): SellerProfile!

        "Add a single badge to a seller (admin)"
        addSellerBadge(sellerId: ID!, badge: CustomBadgeInput!): SellerProfile!

        "Remove a badge from a seller by index (admin)"
        removeSellerBadge(sellerId: ID!, badgeIndex: Int!): SellerProfile!

        "Hard suspend a seller - shows suspension on public profile (admin)"
        hardSuspendSeller(id: ID!, reason: String): SellerProfile!

        "Remove hard suspension from a seller (admin)"
        unHardSuspendSeller(id: ID!): SellerProfile!

        "Ban a seller - permanent with reason shown on public profile (admin)"
        banSeller(id: ID!, reason: String!): SellerProfile!

        "Unban a seller (admin)"
        unbanSeller(id: ID!): SellerProfile!

        "Issue a warning to a seller (admin)"
        warnSeller(id: ID!, message: String!): SellerProfile!

        "Clear warning count for a seller (admin)"
        clearWarnings(id: ID!): SellerProfile!

        "Update admin notes for a seller (admin)"
        updateAdminNotes(id: ID!, notes: String!): SellerProfile!

        "Toggle featured status for a seller (admin)"
        toggleFeatured(id: ID!): SellerProfile!

        "Toggle trusted status for a seller (admin)"
        toggleTrusted(id: ID!): SellerProfile!

        "Toggle priority support for a seller (admin)"
        togglePrioritySupport(id: ID!): SellerProfile!

        "Enable a seller account - reactivates suspended sellers (admin)"
        enableSeller(id: ID!): SellerProfile!

        "Disable a seller account - suspends the seller (admin)"
        disableSeller(id: ID!): SellerProfile!

        "Enable a customer account - reactivates disabled accounts (superadmin)"
        enableCustomer(customerId: ID!): CustomerAccountResult!

        "Disable a customer account - prevents login (superadmin)"
        disableCustomer(customerId: ID!): CustomerAccountResult!

        "Manually verify a customer's email address (superadmin only)"
        verifyCustomerEmail(customerId: ID!): VerifyCustomerEmailResult!

        "Resend verification email to a customer (superadmin only)"
        resendVerificationEmail(customerId: ID!): VerifyCustomerEmailResult!

        "Convert a regular customer to a seller (superadmin only)"
        convertCustomerToSeller(customerId: ID!, businessName: String): ConvertToSellerResult!

        """
        Update marketplace settings at runtime.
        All parameters are optional - only provided values will be updated.
        Settings persist until server restart.
        (superadmin only)
        """
        updateMarketplaceSettings(
            autoVerifyEmail: Boolean
            autoVerifySeller: Boolean
            autoApprove: Boolean
            autoApproveTunerRequests: Boolean
        ): MarketplaceSettings!

        "Update the current seller's own profile (for seller dashboard)"
        updateMySellerProfile(input: UpdateMySellerProfileInput!): SellerProfile!

        "Approve a tuner request and create seller profile (admin)"
        approveTunerRequest(id: ID!, adminNotes: String): TunerRequestOperationResult!

        "Reject a tuner request (admin)"
        rejectTunerRequest(id: ID!, adminNotes: String): TunerRequestOperationResult!

        "Grant admin viewer access to a customer (superadmin)"
        grantAdminViewerAccess(customerId: ID!): CustomerAccountResult!

        "Revoke admin viewer access from a customer (superadmin)"
        revokeAdminViewerAccess(customerId: ID!): CustomerAccountResult!

        "Fix products that are missing variants (superadmin) - creates default variant for products without any"
        fixProductsWithoutVariants: FixProductsResult!

        "Create a seller profile directly (for seeding/testing)"
        createSellerProfile(input: CreateSellerProfileInput!): SellerProfile!
    }

    input CreateSellerProfileInput {
        firstName: String!
        lastName: String!
        businessName: String
        bio: String
        location: String
        phone: String
        website: String
        instagram: String
        facebook: String
        youtube: String
        experience: String
        software: [String!]
        vehiclePlatforms: [String!]
        tuneTypes: [String!]
        hasDyno: String
        status: String
        verified: Boolean
        slug: String
    }

    type FixProductsResult {
        success: Boolean!
        message: String
        fixedCount: Int!
        products: [String!]!
    }
`;
