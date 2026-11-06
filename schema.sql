CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    postal VARCHAR(50),
    is_verified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(100),
    customer_country VARCHAR(100),
    customer_address TEXT,
    sale_type VARCHAR(50) DEFAULT 'cash',
    status VARCHAR(50) DEFAULT 'confirmed',
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'paid',
    subtotal NUMERIC(12, 2) DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    promo_code VARCHAR(50),
    tax NUMERIC(12, 2) DEFAULT 0,
    total_due_today NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL,
    balance NUMERIC(12, 2) DEFAULT 0,
    currency VARCHAR(10) NOT NULL,
    currency_symbol VARCHAR(10) NOT NULL,
    billing_cycle_months INTEGER NOT NULL,
    renews_at_total NUMERIC(12, 2) DEFAULT 0,
    renewal_date VARCHAR(100),
    served_by VARCHAR(100) DEFAULT 'Cloudoon System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL REFERENCES orders(order_number) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50),
    monthly_base NUMERIC(12, 2),
    monthly_renewal NUMERIC(12, 2),
    is_yearly INTEGER DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    item_total NUMERIC(12, 2)
);

CREATE TABLE IF NOT EXISTS domains (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    order_number VARCHAR(50),
    first_year_price NUMERIC(12, 2),
    renewal_price NUMERIC(12, 2),
    status VARCHAR(50) DEFAULT 'active',
    autorenew INTEGER DEFAULT 1,
    whois_privacy INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_number ON order_items(order_number);
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
