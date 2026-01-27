-- NFT Wheel Spins Table
-- This table stores all wheel spins for NFT holders
-- Run this SQL in your Supabase SQL Editor

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

-- Create index on wallet_address for faster queries
CREATE INDEX IF NOT EXISTS idx_nft_wheel_spins_wallet_address ON nft_wheel_spins(wallet_address);

-- Create index on created_at for daily spin limit queries
CREATE INDEX IF NOT EXISTS idx_nft_wheel_spins_created_at ON nft_wheel_spins(created_at);

-- Create index on wallet_address and created_at for combined queries
CREATE INDEX IF NOT EXISTS idx_nft_wheel_spins_wallet_created ON nft_wheel_spins(wallet_address, created_at);

-- Add comment to table
COMMENT ON TABLE nft_wheel_spins IS 'Stores all NFT Wheel spins with XP rewards and multipliers';

-- Add comments to columns
COMMENT ON COLUMN nft_wheel_spins.wallet_address IS 'Wallet address of the spinner';
COMMENT ON COLUMN nft_wheel_spins.segment_id IS 'ID of the winning segment (0-6)';
COMMENT ON COLUMN nft_wheel_spins.base_xp IS 'Base XP reward before multiplier';
COMMENT ON COLUMN nft_wheel_spins.multiplier IS 'NFT multiplier applied (1.0 = no multiplier)';
COMMENT ON COLUMN nft_wheel_spins.final_xp IS 'Final XP awarded after multiplier';
COMMENT ON COLUMN nft_wheel_spins.nft_count IS 'Number of NFTs owned at time of spin';
COMMENT ON COLUMN nft_wheel_spins.created_at IS 'Timestamp when the spin was completed';
