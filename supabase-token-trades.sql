-- Token Trades Table for Price History
-- Run this in your Supabase SQL Editor

-- Create token_trades table to store all buy/sell transactions
CREATE TABLE IF NOT EXISTS token_trades (
    id BIGSERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    trader_address VARCHAR(42) NOT NULL,
    trade_type VARCHAR(4) NOT NULL CHECK (trade_type IN ('buy', 'sell')),
    eth_amount DECIMAL(36, 18) NOT NULL,
    token_amount DECIMAL(36, 18) NOT NULL,
    price DECIMAL(36, 18) NOT NULL, -- ETH per token at time of trade
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_token_trades_token ON token_trades(token_address);
CREATE INDEX IF NOT EXISTS idx_token_trades_created ON token_trades(created_at);
CREATE INDEX IF NOT EXISTS idx_token_trades_token_time ON token_trades(token_address, created_at);

-- Create OHLC view for candlestick data (1 minute intervals)
CREATE OR REPLACE VIEW token_ohlc_1m AS
SELECT 
    token_address,
    date_trunc('minute', created_at) as time_bucket,
    (array_agg(price ORDER BY created_at ASC))[1] as open,
    MAX(price) as high,
    MIN(price) as low,
    (array_agg(price ORDER BY created_at DESC))[1] as close,
    SUM(eth_amount) as volume,
    COUNT(*) as trade_count
FROM token_trades
GROUP BY token_address, date_trunc('minute', created_at)
ORDER BY time_bucket DESC;

-- Create OHLC view for 5 minute intervals
CREATE OR REPLACE VIEW token_ohlc_5m AS
SELECT 
    token_address,
    date_trunc('hour', created_at) + 
        INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM created_at) / 5) as time_bucket,
    (array_agg(price ORDER BY created_at ASC))[1] as open,
    MAX(price) as high,
    MIN(price) as low,
    (array_agg(price ORDER BY created_at DESC))[1] as close,
    SUM(eth_amount) as volume,
    COUNT(*) as trade_count
FROM token_trades
GROUP BY token_address, 
    date_trunc('hour', created_at) + INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM created_at) / 5)
ORDER BY time_bucket DESC;

-- Create OHLC view for 1 hour intervals
CREATE OR REPLACE VIEW token_ohlc_1h AS
SELECT 
    token_address,
    date_trunc('hour', created_at) as time_bucket,
    (array_agg(price ORDER BY created_at ASC))[1] as open,
    MAX(price) as high,
    MIN(price) as low,
    (array_agg(price ORDER BY created_at DESC))[1] as close,
    SUM(eth_amount) as volume,
    COUNT(*) as trade_count
FROM token_trades
GROUP BY token_address, date_trunc('hour', created_at)
ORDER BY time_bucket DESC;

-- Enable Row Level Security
ALTER TABLE token_trades ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read trades
CREATE POLICY "Anyone can read trades" ON token_trades
    FOR SELECT USING (true);

-- Allow authenticated users to insert trades (or use service role for backend)
CREATE POLICY "Service can insert trades" ON token_trades
    FOR INSERT WITH CHECK (true);

-- Function to get OHLC data for a token
CREATE OR REPLACE FUNCTION get_token_ohlc(
    p_token_address VARCHAR(42),
    p_interval VARCHAR(10) DEFAULT '5m',
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    time_bucket TIMESTAMPTZ,
    open DECIMAL,
    high DECIMAL,
    low DECIMAL,
    close DECIMAL,
    volume DECIMAL,
    trade_count BIGINT
) AS $$
BEGIN
    IF p_interval = '1m' THEN
        RETURN QUERY
        SELECT t.time_bucket, t.open, t.high, t.low, t.close, t.volume, t.trade_count
        FROM token_ohlc_1m t
        WHERE t.token_address = p_token_address
        ORDER BY t.time_bucket DESC
        LIMIT p_limit;
    ELSIF p_interval = '1h' THEN
        RETURN QUERY
        SELECT t.time_bucket, t.open, t.high, t.low, t.close, t.volume, t.trade_count
        FROM token_ohlc_1h t
        WHERE t.token_address = p_token_address
        ORDER BY t.time_bucket DESC
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT t.time_bucket, t.open, t.high, t.low, t.close, t.volume, t.trade_count
        FROM token_ohlc_5m t
        WHERE t.token_address = p_token_address
        ORDER BY t.time_bucket DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;
