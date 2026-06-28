-- ERC-8004 Agent Directory cache.
-- Keeps BaseHub-discovered ERC-8004 registrations in Supabase so the frontend
-- does not scan Base RPC logs directly on every page load.

create table if not exists public.erc8004_agents (
  agent_id text primary key check (agent_id ~ '^[0-9]+$'),
  owner_address text not null check (owner_address ~* '^0x[a-f0-9]{40}$'),
  agent_uri text not null,
  registrar_address text not null check (registrar_address ~* '^0x[a-f0-9]{40}$'),
  tx_hash text not null check (tx_hash ~* '^0x[a-f0-9]{64}$'),
  block_number bigint not null,
  log_index integer not null default 0,
  fee_paid_wei text,
  name text,
  description text,
  image_url text,
  image_candidates jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  x402_enabled boolean not null default false,
  category text not null default 'General',
  metadata_ok boolean not null default false,
  metadata_error text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists erc8004_agents_block_idx
  on public.erc8004_agents (block_number desc, log_index desc);

create index if not exists erc8004_agents_owner_idx
  on public.erc8004_agents (owner_address);

create index if not exists erc8004_agents_category_idx
  on public.erc8004_agents (category);

create index if not exists erc8004_agents_x402_idx
  on public.erc8004_agents (x402_enabled)
  where x402_enabled = true;

create index if not exists erc8004_agents_metadata_ok_idx
  on public.erc8004_agents (metadata_ok)
  where metadata_ok = true;

alter table public.erc8004_agents enable row level security;

drop policy if exists "Anyone can read ERC-8004 agents" on public.erc8004_agents;
create policy "Anyone can read ERC-8004 agents"
  on public.erc8004_agents
  for select
  using (true);

comment on table public.erc8004_agents is 'Cached ERC-8004 agent registrations discovered from the BaseHub registrar on Base.';

notify pgrst, 'reload schema';
