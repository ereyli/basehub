-- Agent x402 aboneliği / erişim kayıtları (sunucu SERVICE_ROLE ile yazar)
-- Uygula: Supabase SQL Editor veya supabase db push

create table if not exists public.agent_subscriptions (
  id uuid primary key default gen_random_uuid(),
  payer_wallet_address text not null,
  agent_wallet_address text,
  price_label text not null,
  network text not null default 'base',
  entitlement text not null default 'agent_subscription',
  payment_tx_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint agent_subscriptions_payer_format
    check (payer_wallet_address ~* '^0x[a-f0-9]{40}$'),
  constraint agent_subscriptions_agent_format
    check (agent_wallet_address is null or agent_wallet_address ~* '^0x[a-f0-9]{40}$')
);

create index if not exists idx_agent_subscriptions_payer_created
  on public.agent_subscriptions (lower(payer_wallet_address), created_at desc);

create index if not exists idx_agent_subscriptions_agent
  on public.agent_subscriptions (lower(agent_wallet_address))
  where agent_wallet_address is not null;

comment on table public.agent_subscriptions is 'x402 ile ödenen BaseHub Agent erişimi; API service role ile insert.';

alter table public.agent_subscriptions enable row level security;

-- Anon/authenticated: doğrudan okuma/yazma yok; yalnızca service role (API) insert/select yapar.
-- İstemci doğrulaması: API yanıtı + isteğe bağlı ayrı okuma endpoint’i.
