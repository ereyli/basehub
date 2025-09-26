-- Supabase Database Schema for BaseHub Farcaster Mini App
-- Copy and paste these commands into your Supabase SQL Editor

-- 1. Create players table
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    total_transactions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create transactions table for history
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    game_type TEXT NOT NULL,
    xp_earned INTEGER NOT NULL,
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_wallet_address ON players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_players_total_xp ON players(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address ON transactions(wallet_address);

-- 4. Disable Row Level Security for development
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 5. Create function to automatically update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create trigger to auto-update updated_at
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Grant necessary permissions
GRANT ALL ON players TO authenticated;
GRANT ALL ON transactions TO authenticated;

-- 8. Create quest_progress table for tracking daily quests
CREATE TABLE IF NOT EXISTS quest_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    current_day INTEGER DEFAULT 1,
    weekly_bonus_earned BOOLEAN DEFAULT FALSE,
    quest_stats JSONB DEFAULT '{}',
    total_quest_xp INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- 9. Create quest_rewards table for tracking XP rewards
CREATE TABLE IF NOT EXISTS quest_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    reward_type TEXT NOT NULL, -- 'quest_completion', 'weekly_bonus', 'cast_share'
    xp_amount INTEGER NOT NULL,
    quest_day INTEGER,
    quest_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create indexes for quest tables
CREATE INDEX IF NOT EXISTS idx_quest_progress_wallet_address ON quest_progress(wallet_address);
CREATE INDEX IF NOT EXISTS idx_quest_rewards_wallet_address ON quest_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_quest_rewards_created_at ON quest_rewards(created_at DESC);

-- 11. Disable Row Level Security for quest tables
ALTER TABLE quest_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE quest_rewards DISABLE ROW LEVEL SECURITY;

-- 12. Create trigger for quest_progress updated_at
CREATE TRIGGER update_quest_progress_updated_at 
    BEFORE UPDATE ON quest_progress
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 13. Grant permissions for quest tables
GRANT ALL ON quest_progress TO authenticated;
GRANT ALL ON quest_rewards TO authenticated;

-- 14. Enable realtime (optional - for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE quest_progress;
