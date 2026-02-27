# Supabase Edge Functions

## award-xp-verified

Tx hash'i on-chain receipt ile doğrular; doğrulama başarılıysa `award_xp` RPC'yi `p_source` ile çağırır (web → transactions, farcaster/base_app → miniapp_transactions).

**Body:** `wallet_address`, `game_type`, `xp_amount`, `tx_hash`, `chain_id`, `source` (opsiyonel: `web` | `farcaster` | `base_app`).

**Deploy (Supabase CLI):**
```bash
supabase functions deploy award-xp-verified
```

**Yerel test:**
```bash
supabase functions serve award-xp-verified --env-file ../../.env
```

---

## record-swap

SwapHub swap tx'ini on-chain (Base RPC) doğrular, `swaphub_swaps` tablosuna kayıt ekler, `swaphub_volume` tablosunu günceller ve hacim eşiklerine göre XP verir (per-$100: 5,000 XP + milestone bonusları).

Hem web hem miniapp (Farcaster / Base app) aynı edge function'dan geçer — `source` parametresiyle XP doğru tabloya yönlendirilir.

**Body:** `wallet_address`, `swap_amount_usd`, `tx_hash`, `source` (opsiyonel: `web` | `farcaster` | `base_app`).

**Doğrulama akışı:**
1. 3s bekleme + 8 retry (2.5s aralık) ile `eth_getTransactionReceipt`
2. `receipt.status === 0x1` (başarılı tx)
3. `receipt.from === wallet_address` (cüzdan eşleşmesi)
4. Duplicate kontrolü (`swaphub_swaps.tx_hash`)
5. Volume kayıt + XP award

**Deploy (Supabase CLI):**
```bash
supabase functions deploy record-swap
```

**Yerel test:**
```bash
supabase functions serve record-swap --env-file ../../.env
```
