-- Allow AI NFT Launchpad mints to receive BaseHub XP.
-- Existing award_xp validates every game_type through get_max_xp_for_game_type.

do $$
begin
  if to_regprocedure('public.get_max_xp_for_game_type(text)') is not null
     and to_regprocedure('public.get_max_xp_for_game_type_basehub_ai_nft_prev(text)') is null then
    alter function public.get_max_xp_for_game_type(text)
      rename to get_max_xp_for_game_type_basehub_ai_nft_prev;
  end if;
end $$;

create or replace function public.get_max_xp_for_game_type(p_game_type text)
returns integer
language plpgsql
stable
set search_path to 'public'
as $function$
begin
  if p_game_type in ('AI_NFT_MINTING', 'AI NFT Minting') then
    return 6000;
  end if;

  if to_regprocedure('public.get_max_xp_for_game_type_basehub_ai_nft_prev(text)') is not null then
    return public.get_max_xp_for_game_type_basehub_ai_nft_prev(p_game_type);
  end if;

  return 0;
end;
$function$;
