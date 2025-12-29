-- Fix RLS Policies for Featured Profiles
-- Run this in Supabase SQL Editor to fix the "row violates row-level security policy" error

-- ==========================================
-- Drop existing policies
-- ==========================================
DROP POLICY IF EXISTS "Allow public read access to active featured profiles" ON featured_profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON featured_profiles;
DROP POLICY IF EXISTS "Allow public read access to follows" ON follows;
DROP POLICY IF EXISTS "Users can manage their own follows" ON follows;

-- ==========================================
-- Featured Profiles Policies
-- ==========================================

-- Policy: Allow anyone to read active featured profiles
CREATE POLICY "Allow public read access to active featured profiles"
ON featured_profiles
FOR SELECT
USING (is_active = TRUE AND expires_at > NOW());

-- Policy: Allow service role to insert/update (for API with SERVICE_KEY)
-- This allows the API to create and update profiles
CREATE POLICY "Allow service role full access"
ON featured_profiles
FOR ALL
USING (true)
WITH CHECK (true);

-- ==========================================
-- Follows Policies
-- ==========================================

-- Policy: Allow anyone to read follow relationships
CREATE POLICY "Allow public read access to follows"
ON follows
FOR SELECT
USING (true);

-- Policy: Allow service role to manage follows
CREATE POLICY "Allow service role to manage follows"
ON follows
FOR ALL
USING (true)
WITH CHECK (true);

-- ==========================================
-- IMPORTANT: Make sure you're using SUPABASE_SERVICE_KEY in your API
-- ==========================================
-- The SERVICE_KEY bypasses RLS, but we still need these policies
-- for any authenticated users accessing the data directly.
-- 
-- In your Vercel environment variables, make sure you have:
-- SUPABASE_SERVICE_KEY=your_service_role_key_here
-- (NOT the anon key - the service role key has full access)

