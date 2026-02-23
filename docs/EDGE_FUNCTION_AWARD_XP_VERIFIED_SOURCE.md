# award-xp-verified Edge Function: source / p_source desteği

## Neden

Miniapp (Farcaster / Base app) için de tx_hash + receipt doğrulaması kullanılıyor. Doğrulama başarılı olunca kayıt doğru tabloya gitsin diye EF, `award_xp` RPC'yi **p_source** ile çağırır.

## Frontend (yapıldı)

- **Web ve miniapp** için `tx_hash` + `chainId` varsa `award-xp-verified` Edge Function çağrılıyor.
- Body'de **source** gönderiliyor: `'web'` | `'farcaster'` | `'base_app'`.

## Edge Function kodu (repo’da)

Tam implementasyon: **supabase/functions/award-xp-verified/index.ts**

- Body: `wallet_address`, `game_type`, `xp_amount`, `tx_hash`, `chain_id`, `source` (opsiyonel).
- 3s gecikme + 8×2s retry ile `eth_getTransactionReceipt` (Base, InkChain, Soneium, Katana RPC).
- Receipt: `status` success, `from` === wallet.
- Sonrasında `award_xp` RPC: `p_source` = body.source (farcaster | base_app) veya `'web'`.
- CORS ve hata yanıtları tanımlı.

**Deploy:** `supabase functions deploy award-xp-verified`  
**Yerel:** `supabase functions serve award-xp-verified --env-file ../../.env`

## Geri alma

Miniapp’te doğrulama sürekli timeout alırsa, frontend’de useVerified koşuluna `!isMiniappDomain() && !isLikelyBaseApp() && !isLikelyFarcaster()` tekrar eklenerek miniapp doğrudan RPC path’ine alınabilir.
