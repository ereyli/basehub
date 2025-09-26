-- Quest System Tables for BaseHub
-- Run this separately from main schema to add quest functionality
-- Existing data will NOT be affected

-- 1. Create quest_progress table for tracking daily quests
CREATE TABLE IF NOT EXISTS quest_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    current_day INTEGER DEFAULT 1,
    weekly_bonus_earned BOOLEAN DEFAULT FALSE,
    quest_stats JSONB DEFAULT '{}',
    total_quest_xp INTEGER DEFAULT 0,
    next_day_unlock_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- 2. Create quest_rewards table for tracking XP rewards
CREATE TABLE IF NOT EXISTS quest_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    reward_type TEXT NOT NULL, -- 'quest_completion', 'weekly_bonus', 'cast_share'
    xp_amount INTEGER NOT NULL,
    quest_day INTEGER,
    quest_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for quest tables
CREATE INDEX IF NOT EXISTS idx_quest_progress_wallet_address ON quest_progress(wallet_address);
CREATE INDEX IF NOT EXISTS idx_quest_rewards_wallet_address ON quest_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_quest_rewards_created_at ON quest_rewards(created_at DESC);

-- 4. Disable Row Level Security for quest tables
ALTER TABLE quest_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE quest_rewards DISABLE ROW LEVEL SECURITY;

-- 5. Create trigger for quest_progress updated_at
CREATE TRIGGER update_quest_progress_updated_at 
    BEFORE UPDATE ON quest_progress
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Grant permissions for quest tables
GRANT ALL ON quest_progress TO authenticated;
GRANT ALL ON quest_rewards TO authenticated;

-- 7. Enable realtime for quest_progress (optional - for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE quest_progress;

    -- 8. Add next_day_unlock_time column to existing quest_progress table (if not exists)
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'quest_progress'
            AND column_name = 'next_day_unlock_time'
        ) THEN
            ALTER TABLE quest_progress ADD COLUMN next_day_unlock_time TIMESTAMP WITH TIME ZONE;
        END IF;
    END $$;

    -- 9. Add completed_quests column to existing quest_progress table (if not exists)
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'quest_progress'
            AND column_name = 'completed_quests'
        ) THEN
            ALTER TABLE quest_progress ADD COLUMN completed_quests TEXT[] DEFAULT '{}';
        END IF;
    END $$;

-- Note: This script is safe to run multiple times
-- It will not affect existing players or transactions tables
-- Quest XP is tracked separately from main XP system
-- 24-hour timer system for daily quest progression
