# Supabase Edge Functions

## award-xp-verified

Tx hash’i on-chain receipt ile doğrular; doğrulama başarılıysa `award_xp` RPC’yi `p_source` ile çağırır (web → transactions, farcaster/base_app → miniapp_transactions).

**Body:** `wallet_address`, `game_type`, `xp_amount`, `tx_hash`, `chain_id`, `source` (opsiyonel: `web` | `farcaster` | `base_app`).

**Deploy (Supabase CLI):**
```bash
supabase functions deploy award-xp-verified
```

**Yerel test:**
```bash
supabase functions serve award-xp-verified --env-file ../../.env
```
