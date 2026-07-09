-- PumpHub multichain cache support (Base + Robinhood Chain).
-- Run once in Supabase SQL Editor before enabling Robinhood PumpHub in production.

ALTER TABLE public.pumphub_tokens
  ADD COLUMN IF NOT EXISTS chain_id BIGINT,
  ADD COLUMN IF NOT EXISTS factory_address TEXT;

UPDATE public.pumphub_tokens
SET
  chain_id = COALESCE(chain_id, 8453),
  factory_address = COALESCE(factory_address, '0xe7c2fe007c65349c91b8ccac3c5be5a7f2fdaf21')
WHERE chain_id IS NULL OR factory_address IS NULL;

ALTER TABLE public.pumphub_tokens
  ALTER COLUMN chain_id SET DEFAULT 8453,
  ALTER COLUMN chain_id SET NOT NULL;

-- Replace a legacy token_address-only unique constraint, if present. Token
-- addresses are only unique within a chain/factory combination.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'pumphub_tokens'
    AND con.contype = 'u'
    AND pg_get_constraintdef(con.oid) = 'UNIQUE (token_address)'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pumphub_tokens DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pumphub_tokens_chain_token_uidx
  ON public.pumphub_tokens(chain_id, token_address);

CREATE INDEX IF NOT EXISTS pumphub_tokens_chain_created_idx
  ON public.pumphub_tokens(chain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pumphub_tokens_factory_idx
  ON public.pumphub_tokens(factory_address);

ALTER TABLE public.token_trades
  ADD COLUMN IF NOT EXISTS chain_id BIGINT,
  ADD COLUMN IF NOT EXISTS factory_address TEXT;

UPDATE public.token_trades
SET
  chain_id = COALESCE(chain_id, 8453),
  factory_address = COALESCE(factory_address, '0xe7c2fe007c65349c91b8ccac3c5be5a7f2fdaf21')
WHERE chain_id IS NULL OR factory_address IS NULL;

ALTER TABLE public.token_trades
  ALTER COLUMN chain_id SET DEFAULT 8453,
  ALTER COLUMN chain_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS token_trades_chain_token_created_idx
  ON public.token_trades(chain_id, token_address, created_at ASC);

CREATE INDEX IF NOT EXISTS token_trades_factory_idx
  ON public.token_trades(factory_address);
