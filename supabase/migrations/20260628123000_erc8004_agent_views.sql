-- ERC-8004 Agent Directory global view counters.
-- Writes are made through api/erc8004-agent-views.js with the service role key.

create table if not exists public.erc8004_agent_view_totals (
  agent_id text primary key check (agent_id ~ '^[0-9]+$'),
  owner_address text,
  metadata_uri text,
  tx_hash text,
  view_count bigint not null default 0 check (view_count >= 0),
  unique_view_count bigint not null default 0 check (unique_view_count >= 0),
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erc8004_agent_view_events (
  id bigserial primary key,
  agent_id text not null references public.erc8004_agent_view_totals(agent_id) on delete cascade,
  viewer_hash text not null,
  view_bucket timestamptz not null,
  owner_address text,
  metadata_uri text,
  tx_hash text,
  referrer text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  unique (agent_id, viewer_hash, view_bucket)
);

create index if not exists idx_erc8004_agent_view_totals_views
  on public.erc8004_agent_view_totals (view_count desc, last_viewed_at desc);

create index if not exists idx_erc8004_agent_view_events_agent_created
  on public.erc8004_agent_view_events (agent_id, created_at desc);

create index if not exists idx_erc8004_agent_view_events_created
  on public.erc8004_agent_view_events (created_at desc);

create or replace function public.record_erc8004_agent_view(
  p_agent_id text,
  p_owner_address text default null,
  p_metadata_uri text default null,
  p_tx_hash text default null,
  p_viewer_hash text default null,
  p_referrer text default null,
  p_user_agent_hash text default null
)
returns table (
  agent_id text,
  view_count bigint,
  unique_view_count bigint,
  counted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / 21600) * 21600);
  v_inserted integer := 0;
begin
  if p_agent_id is null or p_agent_id !~ '^[0-9]+$' then
    raise exception 'invalid agent_id';
  end if;

  if p_viewer_hash is null or length(p_viewer_hash) < 16 then
    raise exception 'invalid viewer_hash';
  end if;

  insert into public.erc8004_agent_view_totals (
    agent_id,
    owner_address,
    metadata_uri,
    tx_hash,
    created_at,
    updated_at
  )
  values (
    p_agent_id,
    nullif(left(coalesce(p_owner_address, ''), 80), ''),
    nullif(left(coalesce(p_metadata_uri, ''), 800), ''),
    nullif(left(coalesce(p_tx_hash, ''), 90), ''),
    now(),
    now()
  )
  on conflict (agent_id) do update set
    owner_address = coalesce(excluded.owner_address, public.erc8004_agent_view_totals.owner_address),
    metadata_uri = coalesce(excluded.metadata_uri, public.erc8004_agent_view_totals.metadata_uri),
    tx_hash = coalesce(excluded.tx_hash, public.erc8004_agent_view_totals.tx_hash),
    updated_at = now();

  insert into public.erc8004_agent_view_events (
    agent_id,
    viewer_hash,
    view_bucket,
    owner_address,
    metadata_uri,
    tx_hash,
    referrer,
    user_agent_hash
  )
  values (
    p_agent_id,
    p_viewer_hash,
    v_bucket,
    nullif(left(coalesce(p_owner_address, ''), 80), ''),
    nullif(left(coalesce(p_metadata_uri, ''), 800), ''),
    nullif(left(coalesce(p_tx_hash, ''), 90), ''),
    nullif(left(coalesce(p_referrer, ''), 500), ''),
    nullif(left(coalesce(p_user_agent_hash, ''), 128), '')
  )
  on conflict (agent_id, viewer_hash, view_bucket) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.erc8004_agent_view_totals
    set
      view_count = view_count + 1,
      unique_view_count = unique_view_count + 1,
      last_viewed_at = now(),
      updated_at = now()
    where public.erc8004_agent_view_totals.agent_id = p_agent_id;
  end if;

  return query
    select
      t.agent_id,
      t.view_count,
      t.unique_view_count,
      (v_inserted > 0) as counted
    from public.erc8004_agent_view_totals t
    where t.agent_id = p_agent_id;
end;
$$;

alter table public.erc8004_agent_view_totals enable row level security;
alter table public.erc8004_agent_view_events enable row level security;

drop policy if exists "Allow anon read ERC8004 agent view totals" on public.erc8004_agent_view_totals;
create policy "Allow anon read ERC8004 agent view totals"
  on public.erc8004_agent_view_totals for select to anon using (true);

revoke all on function public.record_erc8004_agent_view(text, text, text, text, text, text, text) from public;
revoke all on function public.record_erc8004_agent_view(text, text, text, text, text, text, text) from anon;
revoke all on function public.record_erc8004_agent_view(text, text, text, text, text, text, text) from authenticated;

comment on table public.erc8004_agent_view_totals is 'Global ERC-8004 Agent Directory view counts.';
comment on table public.erc8004_agent_view_events is 'Deduplicated ERC-8004 Agent Directory view events, keyed by hashed visitor and time bucket.';
