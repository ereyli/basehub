-- B20 Launchpad Tokens Cache
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS b20_tokens (
    id BIGSERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL UNIQUE,
    chain_id BIGINT NOT NULL DEFAULT 8453,
    launchpad_address VARCHAR(42) NOT NULL,
    creator VARCHAR(42),
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_uri TEXT DEFAULT '',
    creator_allocation BIGINT DEFAULT 0,
    virtual_eth NUMERIC(36, 18) DEFAULT 0,
    virtual_tokens NUMERIC(48, 18) DEFAULT 0,
    real_eth NUMERIC(36, 18) DEFAULT 0,
    graduated BOOLEAN DEFAULT false,
    uniswap_pair VARCHAR(42),
    progress NUMERIC(10, 4) DEFAULT 0,
    total_buys BIGINT DEFAULT 0,
    total_sells BIGINT DEFAULT 0,
    total_volume NUMERIC(36, 18) DEFAULT 0,
    holder_count BIGINT DEFAULT 0,
    graduated_at BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b20_tokens_chain_launchpad ON b20_tokens(chain_id, launchpad_address);
CREATE INDEX IF NOT EXISTS idx_b20_tokens_created ON b20_tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b20_tokens_volume ON b20_tokens(total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_b20_tokens_progress ON b20_tokens(progress DESC);
CREATE INDEX IF NOT EXISTS idx_b20_tokens_graduated ON b20_tokens(graduated);

ALTER TABLE b20_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read B20 tokens" ON b20_tokens;
CREATE POLICY "Anyone can read B20 tokens" ON b20_tokens
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can cache B20 tokens" ON b20_tokens;
CREATE POLICY "Anyone can cache B20 tokens" ON b20_tokens
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can refresh B20 tokens" ON b20_tokens;
CREATE POLICY "Anyone can refresh B20 tokens" ON b20_tokens
    FOR UPDATE USING (true) WITH CHECK (true);
