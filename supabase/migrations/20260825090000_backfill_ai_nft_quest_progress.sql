-- Backfill AI NFT daily quest progress for wallets that already received
-- AI NFT XP before the quest counter was reliably written.
do $$
begin
  create temp table if not exists tmp_ai_nft_quest_counts (
    wallet_address text primary key,
    count_ai_nft int not null
  ) on commit drop;

  insert into tmp_ai_nft_quest_counts (wallet_address, count_ai_nft)
  select lower(wallet_address), count(*)::int
  from public.transactions
  where wallet_address is not null
    and game_type in ('AI_NFT_MINTING', 'AI NFT Minting')
  group by lower(wallet_address)
  on conflict (wallet_address) do update
    set count_ai_nft = tmp_ai_nft_quest_counts.count_ai_nft + excluded.count_ai_nft;

  if to_regclass('public.miniapp_transactions') is not null then
    insert into tmp_ai_nft_quest_counts (wallet_address, count_ai_nft)
    select lower(wallet_address), count(*)::int
    from public.miniapp_transactions
    where wallet_address is not null
      and game_type in ('AI_NFT_MINTING', 'AI NFT Minting')
    group by lower(wallet_address)
    on conflict (wallet_address) do update
      set count_ai_nft = tmp_ai_nft_quest_counts.count_ai_nft + excluded.count_ai_nft;
  end if;

  update public.quest_progress qp
  set
    quest_stats = jsonb_set(
      coalesce(qp.quest_stats, '{}'::jsonb),
      '{nftMinted}',
      to_jsonb(greatest(
        case
          when coalesce(qp.quest_stats ->> 'nftMinted', '') ~ '^[0-9]+$'
            then (qp.quest_stats ->> 'nftMinted')::int
          else 0
        end,
        ai.count_ai_nft
      )),
      true
    ),
    updated_at = now()
  from tmp_ai_nft_quest_counts ai
  where lower(qp.wallet_address) = ai.wallet_address
    and (
      case
        when coalesce(qp.quest_stats ->> 'nftMinted', '') ~ '^[0-9]+$'
          then (qp.quest_stats ->> 'nftMinted')::int
        else 0
      end
    ) < ai.count_ai_nft;
end $$;
