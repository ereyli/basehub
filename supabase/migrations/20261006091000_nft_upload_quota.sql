create table if not exists public.nft_upload_quota (
  subject text primary key,
  window_start timestamptz not null,
  requests integer not null
);
alter table public.nft_upload_quota enable row level security;
revoke all on public.nft_upload_quota from anon, authenticated;

create or replace function public.consume_nft_upload_quota(p_subject text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  minute_count integer;
  day_count integer;
  global_count integer;
  minute_start timestamptz := date_trunc('minute', now());
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_subject !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into public.nft_upload_quota as q values ('global:day', day_start, 1)
  on conflict (subject) do update set
    requests = case when q.window_start = excluded.window_start then q.requests + 1 else 1 end,
    window_start = excluded.window_start
  returning requests into global_count;

  insert into public.nft_upload_quota as q values (p_subject || ':minute', minute_start, 1)
  on conflict (subject) do update set
    requests = case when q.window_start = excluded.window_start then q.requests + 1 else 1 end,
    window_start = excluded.window_start
  returning requests into minute_count;

  insert into public.nft_upload_quota as q values (p_subject || ':day', day_start, 1)
  on conflict (subject) do update set
    requests = case when q.window_start = excluded.window_start then q.requests + 1 else 1 end,
    window_start = excluded.window_start
  returning requests into day_count;

  delete from public.nft_upload_quota where window_start < now() - interval '2 days';
  return minute_count <= 20 and day_count <= 200 and global_count <= 2000;
end;
$$;
revoke all on function public.consume_nft_upload_quota(text) from public, anon, authenticated;
grant execute on function public.consume_nft_upload_quota(text) to service_role;
