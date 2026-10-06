insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nft-assets', 'nft-assets', true, 3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/json']
)
on conflict (id) do nothing;

-- Public reads are served by Storage. Writes require the server service role;
-- intentionally do not grant anonymous insert, update, or delete policies.
