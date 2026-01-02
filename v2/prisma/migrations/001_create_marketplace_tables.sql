-- FILE: prisma/migrations/001_create_marketplace_tables.sql
-- PURPOSE: Initial migration for TunerSwap MarketplaceDB
-- STATUS: Production-ready
-- DATABASE: PostgreSQL (adjust types for other databases)
--
-- Run with: psql -d tunerswap_marketplace -f 001_create_marketplace_tables.sql
-- Or via Prisma: npx prisma migrate deploy

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE seller_status AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');
CREATE TYPE product_type AS ENUM ('TUNE', 'PART', 'SERVICE');
CREATE TYPE product_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED');
CREATE TYPE fulfillment_status AS ENUM ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RETURNED');
CREATE TYPE review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');
CREATE TYPE message_participant_type AS ENUM ('VENDOR', 'BUYER', 'ADMIN');
CREATE TYPE message_type AS ENUM ('GENERAL', 'ORDER_INQUIRY', 'QUOTE_REQUEST', 'SUPPORT', 'SYSTEM');
CREATE TYPE calendar_event_type AS ENUM ('SERVICE_APPOINTMENT', 'TUNE_SESSION', 'CONSULTATION', 'PICKUP', 'DELIVERY', 'REMINDER', 'BLOCKED');
CREATE TYPE calendar_event_status AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE sync_action AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE sync_direction AS ENUM ('VENDURE_TO_MARKETPLACE', 'MARKETPLACE_TO_VENDURE');
CREATE TYPE sync_status AS ENUM ('PENDING', 'IN_PROGRESS', 'SYNCED', 'FAILED', 'SKIPPED');
CREATE TYPE connection_type AS ENUM ('SAVED', 'FOLLOWING', 'BLOCKED');
CREATE TYPE payout_method AS ENUM ('STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'MANUAL');
CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- =============================================================================
-- SELLERS
-- =============================================================================

CREATE TABLE sellers (
    id SERIAL PRIMARY KEY,

    -- Public identifiers
    slug VARCHAR(255) NOT NULL UNIQUE,

    -- Personal Information
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    location VARCHAR(255),
    address TEXT,

    -- Business Information
    business_name VARCHAR(255),
    website VARCHAR(1024),
    bio TEXT,
    description TEXT,

    -- Social Links
    social_links JSONB DEFAULT '[]'::jsonb,

    -- Profile Assets
    profile_image_url VARCHAR(1024),
    banner_image_url VARCHAR(1024),

    -- Tuning Expertise
    experience VARCHAR(50),
    software TEXT[] DEFAULT '{}',
    vehicle_platforms TEXT[] DEFAULT '{}',
    tune_types TEXT[] DEFAULT '{}',
    has_dyno BOOLEAN DEFAULT false,

    -- Business Hours
    business_hours JSONB DEFAULT '{}'::jsonb,

    -- Status & Verification
    status seller_status DEFAULT 'PENDING',
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    suspension_reason TEXT,

    -- Cached Statistics
    rating FLOAT DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    tunes_sold INTEGER DEFAULT 0,
    parts_sold INTEGER DEFAULT 0,
    services_done INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,

    -- Payment Integration
    stripe_connected BOOLEAN DEFAULT false,
    stripe_account_id VARCHAR(255),
    paypal_connected BOOLEAN DEFAULT false,
    paypal_email VARCHAR(255),

    -- Vendure Integration IDs
    vendure_seller_id VARCHAR(255) UNIQUE,
    vendure_channel_id VARCHAR(255),
    vendure_admin_id VARCHAR(255),
    vendure_customer_id VARCHAR(255),

    -- Auth
    password_hash VARCHAR(255) NOT NULL,
    last_login_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sellers_status ON sellers(status);
CREATE INDEX idx_sellers_vendure_seller_id ON sellers(vendure_seller_id);
CREATE INDEX idx_sellers_created_at ON sellers(created_at);
-- Partial index for vendor search
CREATE INDEX idx_sellers_approved_name ON sellers(LOWER(first_name), LOWER(last_name)) WHERE status = 'APPROVED';

-- =============================================================================
-- PRODUCTS
-- =============================================================================

CREATE TABLE products (
    id SERIAL PRIMARY KEY,

    -- Identifiers
    sku VARCHAR(64) NOT NULL,
    slug VARCHAR(255) NOT NULL,

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pricing
    price NUMERIC(10,2) NOT NULL,
    compare_at_price NUMERIC(10,2),

    -- Vendor
    vendor_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

    -- Product Type
    product_type product_type NOT NULL,
    is_digital BOOLEAN DEFAULT false,

    -- Inventory
    stock_level INTEGER DEFAULT 0,
    track_inventory BOOLEAN DEFAULT true,

    -- Status
    status product_status DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,

    -- Assets
    featured_image_url VARCHAR(1024),
    image_urls TEXT[] DEFAULT '{}',

    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,

    -- Vendure Integration
    vendure_product_id VARCHAR(255) UNIQUE,
    vendure_variant_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_vendor_sku UNIQUE (vendor_id, sku)
);

CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_products_product_type ON products(product_type);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_vendure_product_id ON products(vendure_product_id);
-- Partial index for active product search
CREATE INDEX idx_products_active_search ON products(vendor_id, LOWER(name)) WHERE status = 'ACTIVE';

-- =============================================================================
-- TUNE FILES
-- =============================================================================

CREATE TABLE tune_files (
    id SERIAL PRIMARY KEY,

    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- File Info
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,

    -- Platform Metadata
    ecu_type VARCHAR(100),
    platform VARCHAR(100),

    -- Compatibility
    compatibility JSONB DEFAULT '[]'::jsonb,

    -- Download tracking
    download_count INTEGER DEFAULT 0,

    -- Timestamps
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tune_files_product_id ON tune_files(product_id);
CREATE INDEX idx_tune_files_file_hash ON tune_files(file_hash);

-- =============================================================================
-- PRODUCT COMPATIBILITY
-- =============================================================================

CREATE TABLE product_compatibility (
    id SERIAL PRIMARY KEY,

    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year_start INTEGER,
    year_end INTEGER,
    engine VARCHAR(100),
    transmission VARCHAR(100),
    notes TEXT,

    CONSTRAINT unique_product_compatibility UNIQUE (product_id, make, model, year_start, year_end, engine)
);

CREATE INDEX idx_product_compatibility_make_model ON product_compatibility(make, model);

-- =============================================================================
-- COLLECTIONS
-- =============================================================================

CREATE TABLE collections (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,

    -- Parent collection for hierarchy
    parent_id INTEGER REFERENCES collections(id),

    -- Display
    position INTEGER DEFAULT 0,
    image_url VARCHAR(1024),

    -- Vendure sync
    vendure_collection_id VARCHAR(255) UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_collections (
    id SERIAL PRIMARY KEY,

    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,

    CONSTRAINT unique_product_collection UNIQUE (product_id, collection_id)
);

-- =============================================================================
-- FACETS
-- =============================================================================

CREATE TABLE facets (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,

    -- Vendure sync
    vendure_facet_id VARCHAR(255) UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE facet_values (
    id SERIAL PRIMARY KEY,

    facet_id INTEGER NOT NULL REFERENCES facets(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,

    -- Vendure sync
    vendure_facet_value_id VARCHAR(255) UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_facet_code UNIQUE (facet_id, code)
);

CREATE TABLE product_facet_values (
    id SERIAL PRIMARY KEY,

    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    facet_value_id INTEGER NOT NULL REFERENCES facet_values(id) ON DELETE CASCADE,

    CONSTRAINT unique_product_facet_value UNIQUE (product_id, facet_value_id)
);

-- =============================================================================
-- ORDERS
-- =============================================================================

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,

    -- Order identifiers
    order_number VARCHAR(50) NOT NULL UNIQUE,

    -- Vendure integration
    vendure_order_id VARCHAR(255),
    vendure_parent_order_id VARCHAR(255),

    -- Vendor
    vendor_id INTEGER NOT NULL REFERENCES sellers(id),

    -- Buyer info (denormalized)
    buyer_id VARCHAR(255) NOT NULL,
    buyer_email VARCHAR(255) NOT NULL,
    buyer_name VARCHAR(255) NOT NULL,

    -- Order totals
    subtotal NUMERIC(10,2) NOT NULL,
    shipping_total NUMERIC(10,2) DEFAULT 0,
    tax_total NUMERIC(10,2) DEFAULT 0,
    discount_total NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,

    -- Platform fee
    platform_fee NUMERIC(10,2) DEFAULT 0,
    vendor_payout NUMERIC(10,2) NOT NULL,

    -- Status
    status order_status DEFAULT 'PENDING',
    payment_status payment_status DEFAULT 'PENDING',
    fulfillment_status fulfillment_status DEFAULT 'UNFULFILLED',

    -- Shipping
    shipping_address JSONB,
    shipping_method VARCHAR(255),
    tracking_number VARCHAR(255),
    tracking_url VARCHAR(1024),

    -- Notes
    customer_notes TEXT,
    internal_notes TEXT,

    -- Timestamps
    placed_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_vendure_order_id ON orders(vendure_order_id);
CREATE INDEX idx_orders_placed_at ON orders(placed_at);

CREATE TABLE order_lines (
    id SERIAL PRIMARY KEY,

    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,

    -- Product snapshot
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(64) NOT NULL,
    product_type product_type NOT NULL,

    -- Pricing
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    line_total NUMERIC(10,2) NOT NULL,

    -- For digital products
    download_url VARCHAR(1024),
    download_count INTEGER DEFAULT 0,
    download_expires_at TIMESTAMPTZ,

    -- Vendure reference
    vendure_order_line_id VARCHAR(255)
);

CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);

-- =============================================================================
-- REVIEWS
-- =============================================================================

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,

    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    vendor_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

    -- Author
    author_id VARCHAR(255) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    author_email VARCHAR(255) NOT NULL,

    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    body TEXT,

    -- Moderation
    status review_status DEFAULT 'PENDING',
    verified_purchase BOOLEAN DEFAULT false,

    -- Response
    vendor_response TEXT,
    responded_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_vendor_id ON reviews(vendor_id);
CREATE INDEX idx_reviews_author_id ON reviews(author_id);
CREATE INDEX idx_reviews_status ON reviews(status);

-- =============================================================================
-- MESSAGES
-- =============================================================================

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,

    -- Participants
    sender_id VARCHAR(255) NOT NULL,
    sender_type message_participant_type NOT NULL,
    receiver_id VARCHAR(255) NOT NULL,
    receiver_type message_participant_type NOT NULL,

    -- Vendor reference
    vendor_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,

    -- Content
    subject VARCHAR(255),
    content TEXT NOT NULL,
    attachments TEXT[] DEFAULT '{}',

    -- Context
    order_id INTEGER,
    product_id INTEGER,

    -- Message type
    message_type message_type DEFAULT 'GENERAL',

    -- Status
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    -- Thread support
    parent_message_id INTEGER REFERENCES messages(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_vendor_id ON messages(vendor_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_read ON messages(read);

-- =============================================================================
-- CALENDAR EVENTS
-- =============================================================================

CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,

    vendor_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

    -- Customer
    customer_id VARCHAR(255),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),

    -- Event details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type calendar_event_type NOT NULL,

    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT false,
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Location
    location VARCHAR(255),
    is_virtual BOOLEAN DEFAULT false,
    meeting_url VARCHAR(1024),

    -- Status
    status calendar_event_status DEFAULT 'PENDING',

    -- Related entities
    order_id INTEGER,
    vehicle_info JSONB,

    -- Reminders
    reminders JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_vendor_id ON calendar_events(vendor_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);

-- =============================================================================
-- SYNC LOG
-- =============================================================================

CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,

    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,

    vendor_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,

    action sync_action NOT NULL,
    direction sync_direction NOT NULL,

    payload JSONB NOT NULL,

    status sync_status DEFAULT 'PENDING',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_logs_entity ON sync_logs(entity, entity_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_attempted_at ON sync_logs(attempted_at);

-- =============================================================================
-- BUYER CONNECTIONS
-- =============================================================================

CREATE TABLE buyer_connections (
    id SERIAL PRIMARY KEY,

    buyer_id VARCHAR(255) NOT NULL,
    seller_id INTEGER NOT NULL,

    connection_type connection_type DEFAULT 'SAVED',

    notes TEXT,

    notify_on_new_products BOOLEAN DEFAULT false,
    notify_on_sales BOOLEAN DEFAULT false,

    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_buyer_seller UNIQUE (buyer_id, seller_id)
);

CREATE INDEX idx_buyer_connections_buyer_id ON buyer_connections(buyer_id);
CREATE INDEX idx_buyer_connections_seller_id ON buyer_connections(seller_id);

-- =============================================================================
-- PAYOUTS
-- =============================================================================

CREATE TABLE payouts (
    id SERIAL PRIMARY KEY,

    vendor_id INTEGER NOT NULL,

    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    payment_method payout_method NOT NULL,
    payment_reference VARCHAR(255),

    status payout_status DEFAULT 'PENDING',

    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    order_ids INTEGER[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT
);

CREATE INDEX idx_payouts_vendor_id ON payouts(vendor_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- =============================================================================
-- TRIGGERS FOR updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON sellers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tune_files_updated_at BEFORE UPDATE ON tune_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facets_updated_at BEFORE UPDATE ON facets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facet_values_updated_at BEFORE UPDATE ON facet_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DEFAULT COLLECTIONS
-- =============================================================================

INSERT INTO collections (name, slug, description) VALUES
    ('Tunes', 'tunes', 'Digital tune files for vehicle ECU programming'),
    ('Parts', 'parts', 'Physical automotive parts and accessories'),
    ('Services', 'services', 'In-person tuning and automotive services');

-- =============================================================================
-- SEED DEFAULT FACETS
-- =============================================================================

INSERT INTO facets (name, code) VALUES
    ('Make', 'make'),
    ('Model', 'model'),
    ('Year', 'year'),
    ('Tune Type', 'tune-type'),
    ('Software Platform', 'software-platform'),
    ('ECU Type', 'ecu-type');

-- Seed facet values for Tune Type
INSERT INTO facet_values (facet_id, name, code)
SELECT f.id, v.name, v.code
FROM facets f, (VALUES
    ('Performance', 'performance'),
    ('Economy', 'economy'),
    ('Tow/Haul', 'tow-haul'),
    ('Stage 1', 'stage-1'),
    ('Stage 2', 'stage-2'),
    ('Stage 3', 'stage-3'),
    ('Custom', 'custom')
) AS v(name, code)
WHERE f.code = 'tune-type';

-- Seed facet values for Software Platform
INSERT INTO facet_values (facet_id, name, code)
SELECT f.id, v.name, v.code
FROM facets f, (VALUES
    ('HP Tuners', 'hp-tuners'),
    ('EFI Live', 'efi-live'),
    ('SCT', 'sct'),
    ('Cobb', 'cobb'),
    ('VCDS', 'vcds'),
    ('EcuTek', 'ecutek'),
    ('Other', 'other')
) AS v(name, code)
WHERE f.code = 'software-platform';

-- Seed facet values for common Makes
INSERT INTO facet_values (facet_id, name, code)
SELECT f.id, v.name, v.code
FROM facets f, (VALUES
    ('GM', 'gm'),
    ('Ford', 'ford'),
    ('Dodge/Ram', 'dodge-ram'),
    ('Toyota', 'toyota'),
    ('Honda', 'honda'),
    ('BMW', 'bmw'),
    ('Audi', 'audi'),
    ('Volkswagen', 'volkswagen'),
    ('Mercedes', 'mercedes'),
    ('Subaru', 'subaru'),
    ('Nissan', 'nissan'),
    ('Mazda', 'mazda')
) AS v(name, code)
WHERE f.code = 'make';

COMMENT ON TABLE sellers IS 'Vendor/seller profiles with true row-level isolation from MarketplaceDB';
COMMENT ON TABLE products IS 'Products with vendor ownership - source of truth for marketplace, synced to Vendure';
COMMENT ON TABLE sync_logs IS 'Audit trail for Vendure <-> MarketplaceDB synchronization';
