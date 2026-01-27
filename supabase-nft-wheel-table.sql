-- NFT Wheel Spins Table
-- This table stores all wheel spins for NFT holders
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- STEP 1: Create the nft_wheel_spins table
-- ============================================
CREATE TABLE IF NOT EXISTS nft_wheel_spins (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  segment_id INTEGER NOT NULL,
  base_xp INTEGER NOT NULL,
  multiplier DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  final_xp INTEGER NOT NULL,
  nft_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 2: Create indexes for faster queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_nft_wheel_spins_wallet_address ON nft_wheel_spins(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_wheel_spins_created_at ON nft_wheel_spins(created_at);
CREATE INDEX IF NOT EXISTS idx_nft_wheel_spins_wallet_created ON nft_wheel_spins(wallet_address, created_at);

-- ============================================
-- STEP 3: Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE nft_wheel_spins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create RLS Policies (if not exists)
-- ============================================
DO $$ 
BEGIN
  -- Create read policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'nft_wheel_spins' 
    AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON nft_wheel_spins
      FOR SELECT USING (true);
  END IF;

  -- Create insert policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'nft_wheel_spins' 
    AND policyname = 'Allow public insert access'
  ) THEN
    CREATE POLICY "Allow public insert access" ON nft_wheel_spins
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- STEP 5: Add table and column comments
-- ============================================
COMMENT ON TABLE nft_wheel_spins IS 'Stores all NFT Wheel spins with XP rewards. Daily limit: 3 spins per wallet.';
COMMENT ON COLUMN nft_wheel_spins.wallet_address IS 'Wallet address of the spinner (lowercase)';
COMMENT ON COLUMN nft_wheel_spins.segment_id IS 'ID of the winning segment (0-6)';
COMMENT ON COLUMN nft_wheel_spins.base_xp IS 'Base XP reward before multiplier';
COMMENT ON COLUMN nft_wheel_spins.multiplier IS 'NFT multiplier applied (1.0 = no multiplier)';
COMMENT ON COLUMN nft_wheel_spins.final_xp IS 'Final XP awarded after multiplier';
COMMENT ON COLUMN nft_wheel_spins.nft_count IS 'Number of NFTs owned at time of spin';
COMMENT ON COLUMN nft_wheel_spins.created_at IS 'Timestamp when the spin was completed';
