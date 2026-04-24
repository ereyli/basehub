-- ============================================================
-- BaseHub Referral System v2 — Signup Reward Gated Behind First TX
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Referral Codes table (each user's unique code)
CREATE TABLE IF NOT EXISTS public.referral_codes (
    wallet_address TEXT PRIMARY KEY,
    referral_code TEXT UNIQUE NOT NULL,
    total_referrals INTEGER DEFAULT 0,
    total_referral_xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Referral relationships (who referred whom)
CREATE TABLE IF NOT EXISTS public.referrals (
    id SERIAL PRIMARY KEY,
    referrer_wallet TEXT NOT NULL,
    referred_wallet TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Milestone tracking (XP milestones for referred users)
CREATE TABLE IF NOT EXISTS public.referral_milestones (
    id SERIAL PRIMARY KEY,
    referred_wallet TEXT UNIQUE NOT NULL,
    referrer_wallet TEXT NOT NULL,
    milestone_count INTEGER DEFAULT 0,
    last_checked_total_xp INTEGER DEFAULT 0,
    total_referrer_xp_earned INTEGER DEFAULT 0,
    signup_rewarded BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure signup_rewarded column exists for existing tables (migration safety)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'referral_milestones' AND column_name = 'signup_rewarded'
    ) THEN
        ALTER TABLE public.referral_milestones ADD COLUMN signup_rewarded BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_wallet);
CREATE INDEX IF NOT EXISTS idx_referral_milestones_referred ON public.referral_milestones(referred_wallet);

-- RLS policies
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referral codes all access" ON public.referral_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Referrals all access" ON public.referrals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Referral milestones all access" ON public.referral_milestones FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Helper Functions
-- ============================================================

-- Generate random 8-char referral code
CREATE OR REPLACE FUNCTION public.generate_random_referral_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Main Functions
-- ============================================================

-- Get or create referral code for a wallet
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_wallet_address TEXT)
RETURNS TEXT AS $$
DECLARE
    v_wallet TEXT := lower(trim(p_wallet_address));
    existing_code TEXT;
    new_code TEXT;
    code_exists TEXT;
BEGIN
    IF v_wallet = '' OR length(v_wallet) != 42 OR left(v_wallet, 2) != '0x' THEN
        RAISE EXCEPTION 'Invalid wallet_address';
    END IF;

    SELECT referral_code INTO existing_code 
    FROM public.referral_codes 
    WHERE wallet_address = v_wallet;
    
    IF existing_code IS NOT NULL THEN
        RETURN existing_code;
    END IF;
    
    LOOP
        new_code := public.generate_random_referral_code();
        SELECT referral_code INTO code_exists 
        FROM public.referral_codes 
        WHERE referral_code = new_code;
        EXIT WHEN code_exists IS NULL;
    END LOOP;
    
    INSERT INTO public.referral_codes (wallet_address, referral_code)
    VALUES (v_wallet, new_code);
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply a referral code (NO XP awarded yet — only records the relationship)
-- XP is awarded only after the referred user's FIRST on-chain transaction.
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_referred_wallet TEXT, p_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_referred TEXT := lower(trim(p_referred_wallet));
    v_code TEXT := upper(trim(p_code));
    v_referrer TEXT;
    v_already_referred INTEGER;
    v_referred_current_xp INTEGER;
    v_starting_milestones INTEGER;
BEGIN
    IF v_referred = '' OR length(v_referred) != 42 OR left(v_referred, 2) != '0x' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid wallet address');
    END IF;

    SELECT wallet_address INTO v_referrer
    FROM public.referral_codes
    WHERE referral_code = v_code;
    
    IF v_referrer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
    END IF;
    
    IF v_referrer = v_referred THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own code');
    END IF;
    
    SELECT COUNT(*) INTO v_already_referred
    FROM public.referrals
    WHERE referred_wallet = v_referred;
    
    IF v_already_referred > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already used a referral code');
    END IF;
    
    -- Insert referral record
    INSERT INTO public.referrals (referrer_wallet, referred_wallet)
    VALUES (v_referrer, v_referred);
    
    -- Milestone tracking starts from the referred user's CURRENT total XP.
    -- signup_rewarded = FALSE: XP will be released after first on-chain tx.
    SELECT COALESCE(total_xp, 0) INTO v_referred_current_xp
    FROM public.players
    WHERE wallet_address = v_referred;

    v_referred_current_xp := COALESCE(v_referred_current_xp, 0);
    v_starting_milestones := floor(v_referred_current_xp / 1000);

    INSERT INTO public.referral_milestones (
        referred_wallet, referrer_wallet, milestone_count, last_checked_total_xp, signup_rewarded
    ) VALUES (
        v_referred, v_referrer, v_starting_milestones, v_referred_current_xp, FALSE
    );
    
    -- Update referrer referral count (but NO XP yet)
    UPDATE public.referral_codes
    SET total_referrals = total_referrals + 1
    WHERE wallet_address = v_referrer;
    
    RETURN jsonb_build_object(
        'success', true,
        'referrer', v_referrer,
        'note', 'Referral recorded. 500 XP will be awarded to both after the first transaction.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process referral signup reward (called when a referred user completes their FIRST transaction)
-- Awards 500 XP to BOTH referrer and referred user.
CREATE OR REPLACE FUNCTION public.process_referral_signup_reward(p_referred_wallet TEXT)
RETURNS JSONB AS $$
DECLARE
    v_referred TEXT := lower(trim(p_referred_wallet));
    v_milestone RECORD;
    v_referrer_exists RECORD;
    v_referred_exists RECORD;
BEGIN
    IF v_referred = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid wallet');
    END IF;

    SELECT * INTO v_milestone
    FROM public.referral_milestones
    WHERE referred_wallet = v_referred;
    
    -- No referral record or already rewarded
    IF v_milestone IS NULL OR v_milestone.signup_rewarded = TRUE THEN
        RETURN jsonb_build_object('success', true, 'note', 'No pending signup reward');
    END IF;
    
    -- Mark as rewarded BEFORE awarding to prevent race conditions / double-spend
    UPDATE public.referral_milestones
    SET signup_rewarded = TRUE, updated_at = NOW()
    WHERE referred_wallet = v_referred;
    
    -- Award 500 XP to referrer
    SELECT total_xp, total_transactions INTO v_referrer_exists
    FROM public.players WHERE wallet_address = v_milestone.referrer_wallet;
    
    IF v_referrer_exists IS NOT NULL THEN
        UPDATE public.players SET 
            total_xp = total_xp + 500,
            level = public.calc_level(total_xp + 500),
            total_transactions = total_transactions + 1,
            updated_at = NOW()
        WHERE wallet_address = v_milestone.referrer_wallet;
    ELSE
        INSERT INTO public.players (wallet_address, total_xp, level, total_transactions, created_at, updated_at)
        VALUES (v_milestone.referrer_wallet, 500, public.calc_level(500), 1, NOW(), NOW());
    END IF;
    
    INSERT INTO public.transactions (wallet_address, game_type, xp_earned, created_at)
    VALUES (v_milestone.referrer_wallet, 'REFERRAL_SIGNUP', 500, NOW());
    
    -- Award 500 XP to referred user
    SELECT total_xp, total_transactions INTO v_referred_exists
    FROM public.players WHERE wallet_address = v_referred;
    
    IF v_referred_exists IS NOT NULL THEN
        UPDATE public.players SET 
            total_xp = total_xp + 500,
            level = public.calc_level(total_xp + 500),
            total_transactions = total_transactions + 1,
            updated_at = NOW()
        WHERE wallet_address = v_referred;
    ELSE
        INSERT INTO public.players (wallet_address, total_xp, level, total_transactions, created_at, updated_at)
        VALUES (v_referred, 500, public.calc_level(500), 1, NOW(), NOW());
    END IF;
    
    INSERT INTO public.transactions (wallet_address, game_type, xp_earned, created_at)
    VALUES (v_referred, 'REFERRAL_SIGNUP', 500, NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'xp_awarded', 500,
        'referrer', v_milestone.referrer_wallet,
        'referred', v_referred
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process referral milestones (called when a user earns XP)
-- Every 1000 XP the referred user earns -> referrer gets 10 XP
-- ALSO triggers signup reward if not yet rewarded.
CREATE OR REPLACE FUNCTION public.process_referral_milestones(p_wallet_address TEXT, p_current_total_xp INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_wallet TEXT := lower(trim(p_wallet_address));
    v_milestone RECORD;
    v_new_milestones INTEGER;
    v_total_xp_to_give INTEGER;
    v_referrer_exists RECORD;
BEGIN
    IF v_wallet = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid wallet');
    END IF;

    SELECT * INTO v_milestone
    FROM public.referral_milestones
    WHERE referred_wallet = v_wallet;
    
    IF v_milestone IS NULL THEN
        RETURN jsonb_build_object('success', true, 'milestones', 0, 'xp_given', 0, 'note', 'No referral');
    END IF;
    
    -- FIRST: if signup reward not yet given, process it now (this is the first tx)
    IF v_milestone.signup_rewarded = FALSE THEN
        PERFORM public.process_referral_signup_reward(v_wallet);
    END IF;
    
    -- Re-fetch milestone after signup_reward may have updated it
    SELECT * INTO v_milestone
    FROM public.referral_milestones
    WHERE referred_wallet = v_wallet;
    
    -- Calculate NEW 1000-XP milestones crossed AFTER the signup reward
    v_new_milestones := GREATEST(0, floor(p_current_total_xp / 1000) - v_milestone.milestone_count);
    
    IF v_new_milestones <= 0 THEN
        RETURN jsonb_build_object('success', true, 'milestones', 0, 'xp_given', 0);
    END IF;
    
    v_total_xp_to_give := v_new_milestones * 10;
    
    SELECT total_xp, total_transactions INTO v_referrer_exists
    FROM public.players WHERE wallet_address = v_milestone.referrer_wallet;
    
    IF v_referrer_exists IS NOT NULL THEN
        UPDATE public.players SET 
            total_xp = total_xp + v_total_xp_to_give,
            level = public.calc_level(total_xp + v_total_xp_to_give),
            total_transactions = total_transactions + 1,
            updated_at = NOW()
        WHERE wallet_address = v_milestone.referrer_wallet;
    ELSE
        INSERT INTO public.players (wallet_address, total_xp, level, total_transactions, created_at, updated_at)
        VALUES (v_milestone.referrer_wallet, v_total_xp_to_give, public.calc_level(v_total_xp_to_give), 1, NOW(), NOW());
    END IF;
    
    INSERT INTO public.transactions (wallet_address, game_type, xp_earned, created_at)
    VALUES (v_milestone.referrer_wallet, 'REFERRAL_MILESTONE', v_total_xp_to_give, NOW());
    
    UPDATE public.referral_milestones
    SET 
        milestone_count = v_milestone.milestone_count + v_new_milestones,
        last_checked_total_xp = p_current_total_xp,
        total_referrer_xp_earned = v_milestone.total_referrer_xp_earned + v_total_xp_to_give,
        updated_at = NOW()
    WHERE referred_wallet = v_wallet;
    
    UPDATE public.referral_codes
    SET total_referral_xp_earned = total_referral_xp_earned + v_total_xp_to_give
    WHERE wallet_address = v_milestone.referrer_wallet;
    
    RETURN jsonb_build_object(
        'success', true,
        'milestones', v_new_milestones,
        'xp_given', v_total_xp_to_give,
        'referrer', v_milestone.referrer_wallet
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get referral stats for a wallet
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_wallet_address TEXT)
RETURNS JSONB AS $$
DECLARE
    v_wallet TEXT := lower(trim(p_wallet_address));
    v_code TEXT;
    v_total_referrals INTEGER;
    v_total_xp_earned INTEGER;
    v_referrals JSONB;
BEGIN
    IF v_wallet = '' THEN
        RETURN jsonb_build_object('error', 'Invalid wallet');
    END IF;

    SELECT referral_code, total_referrals, total_referral_xp_earned
    INTO v_code, v_total_referrals, v_total_xp_earned
    FROM public.referral_codes
    WHERE wallet_address = v_wallet;
    
    IF v_code IS NULL THEN
        v_code := public.get_or_create_referral_code(v_wallet);
        v_total_referrals := 0;
        v_total_xp_earned := 0;
    END IF;
    
    SELECT jsonb_agg(
        jsonb_build_object(
            'wallet_address', r.referred_wallet,
            'created_at', r.created_at,
            'signup_rewarded', COALESCE(m.signup_rewarded, false),
            'milestones', COALESCE(m.milestone_count, 0),
            'referrer_xp_earned', COALESCE(m.total_referrer_xp_earned, 0)
        ) ORDER BY r.created_at DESC
    ) INTO v_referrals
    FROM public.referrals r
    LEFT JOIN public.referral_milestones m ON m.referred_wallet = r.referred_wallet
    WHERE r.referrer_wallet = v_wallet;
    
    RETURN jsonb_build_object(
        'referral_code', v_code,
        'total_referrals', COALESCE(v_total_referrals, 0),
        'total_referral_xp_earned', COALESCE(v_total_xp_earned, 0),
        'referrals', COALESCE(v_referrals, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
