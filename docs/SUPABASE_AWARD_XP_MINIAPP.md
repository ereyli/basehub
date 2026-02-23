# award_xp RPC: Miniapp (Farcaster / Base app) ayrımı

## Amaç

- **Web** işlemleri → mevcut `transactions` tablosuna yazılmaya devam eder.
- **Farcaster / Base app** işlemleri → yeni `miniapp_transactions` tablosuna yazılır.
- **XP** her iki durumda da aynı şekilde `players.total_xp` (ve level) üzerinde birikir; mevcut XP’ler bozulmaz.

## Tablo

- `miniapp_transactions`: migration `supabase/migrations/miniapp_transactions.sql` ile oluşturulur (Supabase Dashboard → SQL Editor’da çalıştırın veya `supabase db push`).

## RPC değişikliği

`award_xp` fonksiyonuna **opsiyonel** parametre ekleyin:

- **Parametre:** `p_source text default 'web'`  
  - Değerler: `'web'` | `'farcaster'` | `'base_app'`

**Mantık (özet):**

1. Oyuncuyu güncelle (upsert `players`: `total_xp`, `level`, `total_transactions`) — her zaman aynı, kaynağa göre değişmez.
2. **Eğer** `p_source` = `'farcaster'` veya `'base_app'` **ise:**
   - `miniapp_transactions` tablosuna insert: `wallet_address`, `game_type`, `xp_earned`, `transaction_hash`, `platform` (= p_source), `created_at`.
   - `transactions` tablosuna **yazma**.
3. **Değilse** (web veya null):
   - Mevcut davranış: `transactions` tablosuna insert (ve gerekirse `players.total_transactions` artırma mantığı aynen kalır).
   - `miniapp_transactions` tablosuna **yazma**.

Böylece mevcut web akışı ve XP birikimi değişmez; sadece miniapp kayıtları ayrı tabloda toplanır. Şimdilik miniapp tarafında on-chain tx doğrulaması yapılmıyor; ileride web’deki gibi doğrulama eklenebilir.

## Örnek award_xp imzası (referans)

```sql
-- Mevcut parametreler + yeni opsiyonel parametre
award_xp(
  p_wallet_address text,
  p_final_xp int,
  p_game_type text,
  p_transaction_hash text default null,
  p_source text default 'web'  -- 'web' | 'farcaster' | 'base_app'
)
```

Frontend, Farcaster/Base app’te `p_source` ile `'farcaster'` veya `'base_app'` gönderir; web’de `'web'` gönderir.

## Sıra

1. Supabase’de `miniapp_transactions` tablosunu oluşturun: `supabase/migrations/miniapp_transactions.sql` içeriğini SQL Editor’da çalıştırın.
2. `award_xp` RPC’ye `p_source` parametresini ekleyip yukarıdaki mantığa göre `miniapp_transactions` / `transactions` ayrımını yapın.
3. Frontend zaten `p_source` gönderiyor; RPC güncellenene kadar miniapp’ten gelen çağrılar “unknown parameter” hatası verebilir.
