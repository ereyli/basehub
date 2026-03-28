-- NFT Plinko drops (Early Access NFT holders, same XP tiers as wheel)
-- Run in Supabase SQL Editor after nft_wheel table exists (same RLS pattern)

CREATE TABLE IF NOT EXISTS nft_plinko_drops (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  segment_id INTEGER NOT NULL,
  slot_index INTEGER NOT NULL,
  base_xp INTEGER NOT NULL,
  multiplier DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  final_xp INTEGER NOT NULL,
  nft_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_plinko_drops_wallet ON nft_plinko_drops(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_plinko_drops_created_at ON nft_plinko_drops(created_at);
CREATE INDEX IF NOT EXISTS idx_nft_plinko_drops_wallet_created ON nft_plinko_drops(wallet_address, created_at);

ALTER TABLE nft_plinko_drops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'nft_plinko_drops' AND policyname = 'Allow public read access plinko'
  ) THEN
    CREATE POLICY "Allow public read access plinko" ON nft_plinko_drops
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'nft_plinko_drops' AND policyname = 'Allow public insert access plinko'
  ) THEN
    CREATE POLICY "Allow public insert access plinko" ON nft_plinko_drops
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nft_plinko_drops IS 'NFT Plinko plays; daily limit 4 per wallet; server-side outcome + XP via API';
