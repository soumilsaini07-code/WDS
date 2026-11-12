-- ==============================================================================
-- WOLF OF DALAL STREET – ECON EDITION (Thapar Institute of Engineering & Tech)
-- Supabase / PostgreSQL Schema Definition & Seed Script
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'participant')),
    balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00,
    ecoin_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. STOCKS TABLE
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    current_price NUMERIC(15, 2) NOT NULL,
    previous_close NUMERIC(15, 2) NOT NULL,
    day_high NUMERIC(15, 2) NOT NULL,
    day_low NUMERIC(15, 2) NOT NULL,
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. PORTFOLIOS TABLE
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    shares_count INTEGER NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
    avg_buy_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, stock_id)
);

-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_trade NUMERIC(15, 2) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MARKET EVENTS TABLE
CREATE TABLE IF NOT EXISTS market_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline TEXT NOT NULL,
    description TEXT NOT NULL,
    impact_map JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. NEWS ARTICLES TABLE
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    sentiment TEXT NOT NULL CHECK (sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. QUIZZES TABLE
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    reward_cash NUMERIC(15, 2) NOT NULL DEFAULT 25000.00,
    reward_ecoin NUMERIC(15, 2) NOT NULL DEFAULT 50.00
);

-- Realtime Configuration for Supabase
-- Add tables to the supabase_realtime publication to enable WebSocket streaming
ALTER PUBLICATION supabase_realtime ADD TABLE stocks;
ALTER PUBLICATION supabase_realtime ADD TABLE market_events;
ALTER PUBLICATION supabase_realtime ADD TABLE news_articles;

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Seed Admin User (Password: econadmin123 -> bcrypt hash)
INSERT INTO users (id, email, password_hash, role, balance, ecoin_balance)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin.econ@thapar.edu',
    '$2a$10$7Z8VfIvxjVl79E8wU4mUjeG46Jt0Rz1U4X8h4J0n7eN69g2P48WvW',
    'admin',
    10000000.00,
    1000.00
) ON CONFLICT (email) DO NOTHING;

-- Seed Indian Blue-Chip Stocks (NSE/BSE style)
INSERT INTO stocks (ticker, name, sector, current_price, previous_close, day_high, day_low, is_frozen)
VALUES 
    ('RELIANCE', 'Reliance Industries Ltd.', 'Energy & Petrochem', 2940.50, 2915.00, 2965.00, 2905.00, FALSE),
    ('TCS', 'Tata Consultancy Services', 'Information Technology', 4180.00, 4210.00, 4235.00, 4160.00, FALSE),
    ('HDFCBANK', 'HDFC Bank Ltd.', 'Banking & Financials', 1650.75, 1635.00, 1665.00, 1628.00, FALSE),
    ('TATAMOTORS', 'Tata Motors Passenger Vehicles', 'Automobile', 985.20, 960.00, 1005.00, 955.00, FALSE),
    ('INFY', 'Infosys Ltd.', 'Information Technology', 1845.00, 1860.00, 1872.00, 1835.00, FALSE),
    ('ITC', 'ITC Limited', 'FMCG & Conglomerate', 485.40, 482.00, 492.00, 480.00, FALSE),
    ('ONGC', 'Oil and Natural Gas Corp.', 'Energy & Oil', 288.60, 292.00, 295.00, 284.00, FALSE),
    ('ICICIBANK', 'ICICI Bank Ltd.', 'Banking & Financials', 1240.30, 1225.00, 1252.00, 1220.00, FALSE),
    ('SUNPHARMA', 'Sun Pharmaceutical Ind.', 'Pharmaceuticals', 1780.00, 1755.00, 1795.00, 1748.00, FALSE),
    ('BHARTIARTL', 'Bharti Airtel Ltd.', 'Telecommunications', 1520.00, 1505.00, 1538.00, 1498.00, FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- Seed Initial News
INSERT INTO news_articles (headline, body, sentiment, published_at)
VALUES
    ('RBI Keeps Repo Rate Unchanged at 6.50%', 'The Reserve Bank of India Monetary Policy Committee has decided to maintain the policy repo rate with an emphasis on withdrawal of accommodation to anchor retail inflation.', 'NEUTRAL', NOW() - INTERVAL '3 hours'),
    ('Global Crude Oil Steadies Near $78/bbl Amid Supply Easing', 'Brent crude traded steady as supply chain disruptions softened, bringing relief to domestic energy and refining stocks on Dalal Street.', 'BULLISH', NOW() - INTERVAL '1 hour'),
    ('IT Export Demand Projects 8% Upside for H2 FY26', 'Major Indian IT service exporters forecast resilient deal pipelines in North American banking and cloud transformations.', 'BULLISH', NOW() - INTERVAL '20 minutes');

-- Seed Educational Quizzes
INSERT INTO quizzes (title, questions_json, reward_cash, reward_ecoin)
VALUES 
(
    'Macroeconomics 101: Monetary Policy & Inflation',
    '[
        {
            "id": 1,
            "question": "What usually happens to equity valuations when a central bank aggressively hikes repo rates?",
            "options": ["Equities generally experience valuation compression due to higher discounting rates", "Stock prices universally soar due to higher bank profit margins", "There is zero correlation between interest rates and equity multiples", "Commodities immediately drop to zero"],
            "answer": 0,
            "explanation": "Higher interest rates increase the discount rate applied to future cash flows, compressing equity valuation multiples, especially for high-growth firms."
        },
        {
            "id": 2,
            "question": "What is the primary indicator used by the Reserve Bank of India (RBI) to measure headline retail inflation?",
            "options": ["Wholesale Price Index (WPI)", "Consumer Price Index (CPI Combined)", "Producer Price Index (PPI)", "Gross Domestic Product Deflator"],
            "answer": 1,
            "explanation": "The RBI officially targets headline retail inflation based on the Consumer Price Index (CPI - Combined) with a target of 4% (+/- 2%)."
        },
        {
            "id": 3,
            "question": "If the Indian Rupee depreciates significantly against the US Dollar, which sector benefits the most?",
            "options": ["Domestic Aviation and Fuel importers", "IT Services and Pharmaceutical Exporters", "Public Sector Oil Marketing Companies", "Real Estate Developers"],
            "answer": 1,
            "explanation": "Export-oriented sectors like Information Technology and Pharma earn revenue in USD while incurring expenses in INR, leading to margin expansion when the Rupee depreciates."
        }
    ]'::jsonb,
    30000.00,
    50.00
),
(
    'Dalal Street Mechanics: Risk, Leverage & Valuations',
    '[
        {
            "id": 1,
            "question": "What does a high Price-to-Earnings (P/E) ratio relative to historical averages generally suggest?",
            "options": ["The stock is guaranteed to go bankrupt", "The market is factoring in high future earnings growth or the asset is richly valued", "The company pays the highest dividend yield in its sector", "The company has zero outstanding shares"],
            "answer": 1,
            "explanation": "A elevated P/E ratio indicates investors are willing to pay a premium today in anticipation of accelerating future earnings growth."
        },
        {
            "id": 2,
            "question": "What is the purpose of a circuit breaker on Indian stock exchanges (NSE/BSE)?",
            "options": ["To permanently delete troubled companies", "To halt panicky trading and allow market participants to absorb information during extreme volatility", "To grant unlimited margin loans to institutional desks", "To artificially set closing prices at day highs"],
            "answer": 1,
            "explanation": "Circuit breakers temporarily halt trading when an index or stock breaches defined percentage thresholds (e.g. 10%, 15%, 20%) to curb speculative contagion and panic selling."
        },
        {
            "id": 3,
            "question": "What metric measures a stock volatility relative to the broader market index (such as Nifty 50)?",
            "options": ["Alpha", "Beta", "Sharpe Ratio", "Treynor Ratio"],
            "answer": 1,
            "explanation": "Beta measures systematic risk; a Beta > 1.0 indicates higher volatility than the benchmark index, while Beta < 1.0 denotes lower volatility."
        }
    ]'::jsonb,
    45000.00,
    75.00
);
