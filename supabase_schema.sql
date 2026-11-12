-- ==============================================================================
-- WOLF OF DALAL STREET – INSTITUTIONAL TRADING COMPETITION
-- Complete Production Database Schema for Supabase (PostgreSQL 15+)
-- Optimized with B-Tree Indexing, Foreign Key Constraints, and Audit Triggers
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE USERS & DESK AFFILIATION
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'participant')) DEFAULT 'participant',
    balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00 CHECK (balance >= 0),
    ecoin_balance INT NOT NULL DEFAULT 1000 CHECK (ecoin_balance >= 0),
    assigned_admin_id TEXT,
    assigned_admin_name TEXT,
    group_name TEXT,
    team_id TEXT,
    team_name TEXT,
    is_team_leader BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Participants, Desk Admins, and Superadmins';
COMMENT ON COLUMN public.users.balance IS 'Cash available for market allocation (in INR)';

-- ==============================================================================
-- 3. TEAMS & TRADING SYNDICATES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    leader_id TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_email TEXT NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00 CHECK (balance >= 0),
    assigned_admin_id TEXT,
    assigned_admin_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.teams IS '6-member student trading teams operating on the Dalal Street floor';

CREATE TABLE IF NOT EXISTS public.team_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    roll TEXT,
    is_leader BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. STOCKS, SECTORS & CIRCUIT BOUNDS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stocks (
    id TEXT PRIMARY KEY,
    ticker TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    current_price NUMERIC(12, 2) NOT NULL CHECK (current_price > 0),
    previous_close NUMERIC(12, 2) NOT NULL CHECK (previous_close > 0),
    day_high NUMERIC(12, 2) NOT NULL CHECK (day_high > 0),
    day_low NUMERIC(12, 2) NOT NULL CHECK (day_low > 0),
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    lower_circuit NUMERIC(12, 2) CHECK (lower_circuit > 0),
    upper_circuit NUMERIC(12, 2) CHECK (upper_circuit > 0),
    beta NUMERIC(5, 2) DEFAULT 1.00,
    pe_ratio NUMERIC(7, 2),
    market_cap TEXT,
    historical_prices JSONB DEFAULT '[]'::JSONB,
    drifts JSONB DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT circuit_bounds_check CHECK (lower_circuit <= upper_circuit)
);

COMMENT ON TABLE public.stocks IS 'Master equities universe (78 active stocks with circuits & inter-round drifts)';

-- ==============================================================================
-- 5. PORTFOLIOS & HOLDINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portfolios (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    team_id TEXT REFERENCES public.teams(id) ON DELETE CASCADE,
    stock_id TEXT NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
    shares_count INT NOT NULL CHECK (shares_count >= 0),
    avg_buy_price NUMERIC(12, 2) NOT NULL CHECK (avg_buy_price >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_team_stock UNIQUE (team_id, stock_id)
);

COMMENT ON TABLE public.portfolios IS 'Live stock holdings per team';

-- ==============================================================================
-- 6. TRANSACTIONS & LIVE TRADE LEDGER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    counterparty_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    stock_id TEXT NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'P2P_BUY', 'P2P_SELL', 'IPO_ALLOTMENT')),
    quantity INT NOT NULL CHECK (quantity > 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    brokerage NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0),
    round_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.transactions IS 'Immutable historical trade ledger for Dalal Street transactions';

-- ==============================================================================
-- 7. PHYSICAL ORDER SLIPS & JOBBER AUDIT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.order_slips (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    slip_id TEXT UNIQUE NOT NULL, -- e.g. SLIP-8491
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    stock_id TEXT NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
    ticker TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
    quantity INT NOT NULL CHECK (quantity > 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    brokerage NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'EXECUTED', 'REJECTED')) DEFAULT 'PENDING',
    executed_by_admin TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- ==============================================================================
-- 8. COMPETITION ROUNDS & CLOCK
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.competition_rounds (
    id TEXT PRIMARY KEY,
    index INT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PRIMARY_DESK', 'P2P_TRADING', 'IPO')),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'UPCOMING', 'COMPLETED')),
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    description TEXT,
    rules_note TEXT
);

CREATE TABLE IF NOT EXISTS public.round_clock (
    id INT PRIMARY KEY DEFAULT 1,
    remaining_seconds INT NOT NULL DEFAULT 1800,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    is_orders_locked BOOLEAN NOT NULL DEFAULT FALSE,
    last_tick TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row_clock CHECK (id = 1)
);

-- ==============================================================================
-- 9. IPO LISTINGS & LOT DEMAND
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ipo_listings (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES public.competition_rounds(id),
    company_name TEXT NOT NULL,
    ticker TEXT UNIQUE NOT NULL,
    sector TEXT NOT NULL,
    reference_price NUMERIC(12, 2) NOT NULL CHECK (reference_price > 0),
    issue_price NUMERIC(12, 2) NOT NULL CHECK (issue_price > 0),
    lot_size INT NOT NULL CHECK (lot_size > 0),
    min_lots INT NOT NULL DEFAULT 1,
    max_lots INT NOT NULL DEFAULT 30,
    total_issue_lots INT NOT NULL CHECK (total_issue_lots > 0),
    total_demanded_lots INT NOT NULL DEFAULT 0,
    subscription_ratio NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
    allotted_lots INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('UPCOMING', 'OPEN', 'ALLOTTED', 'LISTED')) DEFAULT 'UPCOMING',
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.ipo_subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    ipo_id TEXT NOT NULL REFERENCES public.ipo_listings(id) ON DELETE CASCADE,
    round_id TEXT NOT NULL,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    requested_lots INT NOT NULL CHECK (requested_lots > 0),
    allotted_lots INT NOT NULL DEFAULT 0,
    shares_count INT NOT NULL DEFAULT 0,
    lot_size INT NOT NULL,
    price_per_share NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ALLOTTED', 'REJECTED')) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_team_ipo UNIQUE (ipo_id, team_id)
);

-- ==============================================================================
-- 10. NEWS, MACRO SHOCKS & AUDIT LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.news_articles (
    id TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    sentiment TEXT NOT NULL CHECK (sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level TEXT NOT NULL,
    tag TEXT NOT NULL,
    message TEXT NOT NULL,
    actor TEXT,
    meta JSONB
);

-- ==============================================================================
-- 11. HIGH-PERFORMANCE B-TREE INDEXES (Prevents N+1 Sequential Scans)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_team_id ON public.users (team_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

CREATE INDEX IF NOT EXISTS idx_teams_code ON public.teams (code);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members (user_id);

CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON public.stocks (ticker);
CREATE INDEX IF NOT EXISTS idx_stocks_sector ON public.stocks (sector);

CREATE INDEX IF NOT EXISTS idx_portfolios_team_id ON public.portfolios (team_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_stock_id ON public.portfolios (stock_id);

CREATE INDEX IF NOT EXISTS idx_transactions_team_id ON public.transactions (team_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stock_id ON public.transactions (stock_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_order_slips_team_id ON public.order_slips (team_id);
CREATE INDEX IF NOT EXISTS idx_order_slips_status ON public.order_slips (status);
CREATE INDEX IF NOT EXISTS idx_order_slips_created_at ON public.order_slips (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ipo_subscriptions_ipo ON public.ipo_subscriptions (ipo_id);
CREATE INDEX IF NOT EXISTS idx_ipo_subscriptions_team ON public.ipo_subscriptions (team_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tag ON public.audit_logs (tag);

-- ==============================================================================
-- 12. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teams_updated_at') THEN
        CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stocks_updated_at') THEN
        CREATE TRIGGER trg_stocks_updated_at BEFORE UPDATE ON public.stocks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_portfolios_updated_at') THEN
        CREATE TRIGGER trg_portfolios_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
END $$;

