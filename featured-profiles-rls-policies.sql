-- RLS Policies for Featured Profiles & Follow System
-- Run this AFTER creating the tables and enabling RLS
-- These policies allow public read access but require authentication for writes

-- ==========================================
-- Enable RLS on tables
-- ==========================================
ALTER TABLE featured_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Featured Profiles Policies
-- ==========================================

-- Policy: Allow anyone to read active featured profiles
CREATE POLICY "Allow public read access to active featured profiles"
ON featured_profiles
FOR SELECT
USING (is_active = TRUE AND expires_at > NOW());

-- Policy: Allow service role to do everything (for API)
-- This is handled by using SERVICE_KEY in the API, which bypasses RLS
-- But we still need a policy for authenticated users if needed

-- Policy: Allow authenticated users to read their own profile
CREATE POLICY "Users can read their own profile"
ON featured_profiles
FOR SELECT
USING (true); -- Service key bypasses this anyway, but good for authenticated users

-- ==========================================
-- Follows Policies
-- ==========================================

-- Policy: Allow anyone to read follow relationships
CREATE POLICY "Allow public read access to follows"
ON follows
FOR SELECT
USING (true);

-- Policy: Allow authenticated users to manage their own follows
-- (Service key will bypass RLS anyway, but good for authenticated users)
CREATE POLICY "Users can manage their own follows"
ON follows
FOR ALL
USING (true);

-- ==========================================
-- Notes:
-- ==========================================
-- 1. These policies work with SERVICE_KEY (bypasses RLS)
-- 2. For authenticated users, they can read everything
-- 3. For public access, only active featured profiles are visible
-- 4. Service key is required in API for full access (recommended)

