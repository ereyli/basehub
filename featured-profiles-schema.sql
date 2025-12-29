-- Featured Profiles & Follow System Schema for BaseHub Farcaster Mini App
-- Copy and paste these commands into your Supabase SQL Editor

-- 1. Create featured_profiles table (ücret ödeyen profiller)
CREATE TABLE IF NOT EXISTS featured_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farcaster_fid INTEGER UNIQUE NOT NULL, -- Farcaster FID
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    description TEXT, -- Kullanıcının yazdığı açıklama (karşılıklı takip için)
    wallet_address TEXT,
    payment_tx_hash TEXT, -- x402 ödeme transaction hash
    payment_amount TEXT NOT NULL, -- USDC cinsinden (0.2, 1.0, 6.0)
    subscription_type TEXT NOT NULL CHECK (subscription_type IN ('daily', 'weekly', 'monthly')),
    subscription_days INTEGER NOT NULL, -- 1, 7, 30
    position INTEGER, -- Liste sırası (düşük = üstte, yeni kayıtlar üste)
    is_active BOOLEAN DEFAULT TRUE,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    mutual_follows_count INTEGER DEFAULT 0, -- Karşılıklı takip sayısı
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL -- Premium süresi
);

-- 2. Create follows table (takip ilişkileri)
CREATE TABLE IF NOT EXISTS follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_fid INTEGER NOT NULL, -- Takip eden
    following_fid INTEGER NOT NULL, -- Takip edilen
    is_mutual BOOLEAN DEFAULT FALSE, -- Karşılıklı takip mi?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_fid, following_fid),
    CHECK (follower_fid != following_fid) -- Kendini takip edemez
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_featured_profiles_fid ON featured_profiles(farcaster_fid);
CREATE INDEX IF NOT EXISTS idx_featured_profiles_position ON featured_profiles(position ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_featured_profiles_active ON featured_profiles(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_featured_profiles_expires ON featured_profiles(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_fid);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_fid);
CREATE INDEX IF NOT EXISTS idx_follows_mutual ON follows(is_mutual) WHERE is_mutual = TRUE;

-- 4. Disable Row Level Security for development
ALTER TABLE featured_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE follows DISABLE ROW LEVEL SECURITY;

-- 5. Create function to automatically update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create trigger to auto-update updated_at
CREATE TRIGGER update_featured_profiles_updated_at 
    BEFORE UPDATE ON featured_profiles
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Create function to increment followers count
CREATE OR REPLACE FUNCTION increment_followers(profile_fid INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE featured_profiles
  SET followers_count = followers_count + 1
  WHERE farcaster_fid = profile_fid;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to decrement followers count
CREATE OR REPLACE FUNCTION decrement_followers(profile_fid INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE featured_profiles
  SET followers_count = GREATEST(followers_count - 1, 0)
  WHERE farcaster_fid = profile_fid;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to increment mutual follows count
CREATE OR REPLACE FUNCTION increment_mutual_follows(profile_fid INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE featured_profiles
  SET mutual_follows_count = mutual_follows_count + 1
  WHERE farcaster_fid = profile_fid;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to decrement mutual follows count
CREATE OR REPLACE FUNCTION decrement_mutual_follows(profile_fid INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE featured_profiles
  SET mutual_follows_count = GREATEST(mutual_follows_count - 1, 0)
  WHERE farcaster_fid = profile_fid;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to increment following count
CREATE OR REPLACE FUNCTION increment_following(profile_fid INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE featured_profiles
  SET following_count = following_count + 1
  WHERE farcaster_fid = profile_fid;
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to decrement following count
CREATE OR REPLACE FUNCTION decrement_following(profile_fid INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE featured_profiles
  SET following_count = GREATEST(following_count - 1, 0)
  WHERE farcaster_fid = profile_fid;
END;
$$ LANGUAGE plpgsql;

-- 13. Create function to get next position (yeni kayıtlar için)
CREATE OR REPLACE FUNCTION get_next_position()
RETURNS INTEGER AS $$
DECLARE
  max_pos INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0) INTO max_pos FROM featured_profiles;
  RETURN max_pos + 1;
END;
$$ LANGUAGE plpgsql;

-- 14. Create function to deactivate expired profiles
CREATE OR REPLACE FUNCTION deactivate_expired_profiles()
RETURNS void AS $$
BEGIN
  UPDATE featured_profiles
  SET is_active = FALSE
  WHERE expires_at < NOW() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 15. Grant necessary permissions
GRANT ALL ON featured_profiles TO authenticated;
GRANT ALL ON follows TO authenticated;

-- 16. Enable realtime (optional - for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE featured_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- 17. Create a scheduled job to deactivate expired profiles (optional)
-- Bu Supabase cron job olarak ayarlanabilir: SELECT cron.schedule('deactivate-expired', '0 * * * *', 'SELECT deactivate_expired_profiles()');

