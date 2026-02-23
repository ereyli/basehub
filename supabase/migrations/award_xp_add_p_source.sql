-- award_xp: p_source ekle; farcaster/base_app -> miniapp_transactions, web -> transactions
-- Eski 4-param sürümü kaldır (4-param çağrılar yeni 5-param default ile çalışır)
DROP FUNCTION IF EXISTS public.award_xp(text, integer, text, text);

CREATE OR REPLACE FUNCTION public.award_xp(
  p_wallet_address text,
  p_final_xp integer,
  p_game_type text,
  p_transaction_hash text DEFAULT NULL,
  p_source text DEFAULT 'web'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_xp int;
  v_normalized text;
  v_existing record;
  v_new_total_xp int;
  v_new_level int;
  v_new_total_tx int;
  v_src text;
BEGIN
  v_normalized := lower(trim(p_wallet_address));
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'Invalid wallet_address';
  END IF;

  v_max_xp := public.get_max_xp_for_game_type(p_game_type);
  IF v_max_xp = 0 THEN
    RAISE EXCEPTION 'Invalid game_type: %', p_game_type;
  END IF;
  IF p_final_xp <= 0 OR p_final_xp > v_max_xp THEN
    RAISE EXCEPTION 'XP amount % out of range for % (max: %)', p_final_xp, p_game_type, v_max_xp;
  END IF;

  v_src := lower(coalesce(nullif(trim(p_source), ''), 'web'));

  SELECT total_xp, total_transactions INTO v_existing
  FROM public.players
  WHERE wallet_address = v_normalized
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    v_new_total_xp := coalesce(v_existing.total_xp, 0)::int + p_final_xp;
    v_new_total_tx := coalesce(v_existing.total_transactions, 0)::int + 1;
  ELSE
    v_new_total_xp := p_final_xp;
    v_new_total_tx := 1;
  END IF;

  v_new_level := public.calc_level(v_new_total_xp);

  INSERT INTO public.players (wallet_address, total_xp, level, total_transactions, created_at, updated_at)
  VALUES (v_normalized, v_new_total_xp, v_new_level, v_new_total_tx, now(), now())
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_xp = v_new_total_xp,
    level = v_new_level,
    total_transactions = v_new_total_tx,
    updated_at = now();

  IF v_src IN ('farcaster', 'base_app') THEN
    INSERT INTO public.miniapp_transactions (wallet_address, game_type, xp_earned, transaction_hash, platform, created_at)
    VALUES (v_normalized, p_game_type, p_final_xp, p_transaction_hash, v_src, now());
  ELSE
    INSERT INTO public.transactions (wallet_address, game_type, xp_earned, transaction_hash, created_at)
    VALUES (v_normalized, p_game_type, p_final_xp, p_transaction_hash, now());
  END IF;

  RETURN jsonb_build_object('success', true, 'new_total_xp', v_new_total_xp);
END;
$function$;
