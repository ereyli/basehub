-- Security hardening for BaseHub Assistant
-- 1) Server-side user<->wallet mapping
-- 2) Request log table for IP+wallet rate limiting

create table if not exists public.assistant_user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_user_wallets_wallet_format
    check (wallet_address ~* '^0x[a-f0-9]{40}$')
);

create index if not exists idx_assistant_user_wallets_wallet
  on public.assistant_user_wallets (wallet_address);

create table if not exists public.assistant_request_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_request_logs_created
  on public.assistant_request_logs (created_at desc);

create index if not exists idx_assistant_request_logs_wallet_ip_created
  on public.assistant_request_logs (wallet_address, ip_hash, created_at desc);

create index if not exists idx_assistant_request_logs_user_created
  on public.assistant_request_logs (user_id, created_at desc);

alter table public.assistant_user_wallets enable row level security;
alter table public.assistant_request_logs enable row level security;

alter table if exists public.assistant_messages
  add column if not exists user_id uuid;

create index if not exists idx_assistant_messages_user_created
  on public.assistant_messages (user_id, created_at desc);

comment on table public.assistant_user_wallets is 'Server-side mapping between authenticated Supabase user and wallet address for assistant binding.';
comment on table public.assistant_request_logs is 'Assistant request logs used for IP+wallet rate limiting.';
