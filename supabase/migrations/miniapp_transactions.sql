-- Miniapp (Farcaster / Base app) işlem kayıtları.
-- XP aynı yerde birikir (players.total_xp); bu tablo sadece kanıt/audit için.
-- Şimdilik on-chain doğrulama yok; ileride web gibi eklenebilir.

create table if not exists public.miniapp_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  game_type text not null,
  xp_earned int not null,
  transaction_hash text,
  platform text not null check (platform in ('farcaster', 'base_app')),
  created_at timestamptz default now()
);

create index if not exists idx_miniapp_transactions_wallet on public.miniapp_transactions(wallet_address);
create index if not exists idx_miniapp_transactions_created_at on public.miniapp_transactions(created_at desc);
create index if not exists idx_miniapp_transactions_platform on public.miniapp_transactions(platform);

alter table public.miniapp_transactions enable row level security;

create policy "Allow anon insert miniapp_transactions"
  on public.miniapp_transactions for insert to anon with check (true);
create policy "Allow anon select miniapp_transactions"
  on public.miniapp_transactions for select to anon using (true);

comment on table public.miniapp_transactions is 'Farcaster ve Base app işlem kayıtları; XP players tablosunda birikir.';
