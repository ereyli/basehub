-- Enable Row Level Security (RLS) for BaseHub tables
-- ⚠️ WARNING: This will enable RLS. Make sure policies are correct before running in production.
-- ✅ Safe: This will NOT delete or modify existing data, only adds security rules.

-- 1. Enable RLS on all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_rewards ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can read players" ON players;
DROP POLICY IF EXISTS "Authenticated users can insert" ON players;
DROP POLICY IF EXISTS "Users can update own data" ON players;
DROP POLICY IF EXISTS "Anyone can read transactions" ON transactions;
DROP POLICY IF EXISTS "Anyone can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Anyone can read quest_progress" ON quest_progress;
DROP POLICY IF EXISTS "Anyone can insert quest_progress" ON quest_progress;
DROP POLICY IF EXISTS "Anyone can update quest_progress" ON quest_progress;
DROP POLICY IF EXISTS "Anyone can read quest_rewards" ON quest_rewards;
DROP POLICY IF EXISTS "Anyone can insert quest_rewards" ON quest_rewards;

-- 3. Create policies for players table
-- Everyone can read players (for leaderboard, etc.)
CREATE POLICY "Anyone can read players" 
  ON players FOR SELECT 
  USING (true);

-- Anyone can insert new players (when they first play)
CREATE POLICY "Anyone can insert players" 
  ON players FOR INSERT 
  WITH CHECK (true);

-- Anyone can update players (for XP updates, etc.)
-- Note: In production, you might want to restrict this to specific conditions
CREATE POLICY "Anyone can update players" 
  ON players FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 4. Create policies for transactions table
-- Everyone can read transactions (for analytics, etc.)
CREATE POLICY "Anyone can read transactions" 
  ON transactions FOR SELECT 
  USING (true);

-- Anyone can insert transactions (when games are played)
CREATE POLICY "Anyone can insert transactions" 
  ON transactions FOR INSERT 
  WITH CHECK (true);

-- 5. Create policies for quest_progress table
-- Everyone can read quest progress
CREATE POLICY "Anyone can read quest_progress" 
  ON quest_progress FOR SELECT 
  USING (true);

-- Anyone can insert quest progress
CREATE POLICY "Anyone can insert quest_progress" 
  ON quest_progress FOR INSERT 
  WITH CHECK (true);

-- Anyone can update quest progress
CREATE POLICY "Anyone can update quest_progress" 
  ON quest_progress FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 6. Create policies for quest_rewards table
-- Everyone can read quest rewards
CREATE POLICY "Anyone can read quest_rewards" 
  ON quest_rewards FOR SELECT 
  USING (true);

-- Anyone can insert quest rewards
CREATE POLICY "Anyone can insert quest_rewards" 
  ON quest_rewards FOR INSERT 
  WITH CHECK (true);

-- ✅ All policies created successfully!
-- Note: These policies allow full access (similar to RLS disabled)
-- but provide a foundation for more restrictive policies in the future.

