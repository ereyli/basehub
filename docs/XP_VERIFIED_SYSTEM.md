# BaseHub XP On-Chain Verification Sistemi

## Özet

Büyük XP kazandıran tüm özellikler **on-chain doğrulama** ile güvenli: tx hash RPC üzerinden `eth_getTransactionReceipt` ile doğrulanıyor, `receipt.status === 0x1` ve `receipt.from === wallet` kontrolü yapılıyor.

---

## Akış

1. Kullanıcı işlem yapar (GM, GN, Flip, Lucky Number, Dice Roll, Slot, NFT Mint, PumpHub vb.) → tx hash alınır
2. **Confirmation bekleme**: XP verilmeden önce `waitForTransactionReceipt` ile tx onayı beklenir (RPC lag önlemi)
3. Frontend `addXP(wallet, xp, gameType, chainId, skipNFTBonus, txHash)` çağırır
4. `addXP` → tx_hash + chainId varsa **web ve miniapp** için `award-xp-verified` Edge Function (body'de `source`: web | farcaster | base_app)
5. Edge Function → 3s başlangıç gecikmesi (RPC propagation) + `eth_getTransactionReceipt` ile tx doğrular
6. Doğrulama OK → `award_xp` RPC çağrılır (`p_source` ile; miniapp → miniapp_transactions, web → transactions)
7. **Client retry**: "Invalid or failed transaction on-chain" hatası alınırsa 3 deneme, 4s aralık ile yeniden denenir

---

## Edge Functions

| Fonksiyon | Amaç |
|-----------|------|
| `record-swap` | SwapHub volume + XP (swap amount doğrulaması) |
| `award-xp-verified` | GM, GN, Flip, Lucky Number, Dice Roll, Slot, NFT Launchpad Mint, PumpHub, Deploy vb. — tx doğrulama + award_xp |

---

## Game Type Mapping

`addBonusXP` → veritabanı `get_max_xp_for_game_type` uyumu:

| Client | DB game_type |
|--------|--------------|
| flip | FLIP_GAME |
| luckynumber | LUCKY_NUMBER |
| diceroll | DICE_ROLL |
| gm | GM_GAME |
| gn | GN_GAME |
| slot | SLOT_GAME |

---

## Desteklenen Ağlar

- Base (8453)
- InkChain (57073)
- Soneium (1868)
- Katana (747474)
- Arc Testnet (5042002)
- Robinhood Testnet (46630)

---

## XP Veren Verified Akışlar

| Akış | game_type | Zamanlama |
|------|-----------|-----------|
| GM / GN | GM_GAME, GN_GAME | waitForTxReceipt sonrası |
| Flip | FLIP_GAME | waitForTxReceipt sonrası |
| Lucky Number | LUCKY_NUMBER | waitForTxReceipt sonrası |
| Dice Roll | DICE_ROLL | waitForTxReceipt sonrası |
| Slot | SLOT_GAME | waitForTxReceipt sonrası |
| NFT Launchpad Mint | NFT_LAUNCHPAD_MINT | waitForTransactionReceipt sonrası |
| PumpHub | PUMPHUB_* | useWaitForTransactionReceipt / event sonrası |
| Deploy / Mint | Çeşitli | confirmation sonrası |

---

## Miniapp (Farcaster / Base app)

- Miniapp’te de tx_hash + chainId varsa **award-xp-verified** kullanılıyor (receipt doğrulaması). EF’e `source` (farcaster | base_app) gönderilir; EF `award_xp`’e `p_source` iletir. Çalışmazsa (timeout vb.) frontend’de tekrar doğrudan RPC path’ine dönülebilir; bkz. `EDGE_FUNCTION_AWARD_XP_VERIFIED_SOURCE.md`.

## Doğrulanmayan (tx_hash yok veya farklı akış)

- **NFT Wheel** — skipNFTBonus, farklı akış
- **Contract Security, Wallet Analysis, Allowance Cleaner, X402 Payment** — API/ödeme akışı, tx_hash API'den gelirse chainId ile doğrulama denenir

---

## Teknik Detaylar

- **Duplicate check**: `award-xp-verified` → wallet + game_type + tx_hash → idempotent
- **CORS**: `corsHeaders` from `jsr:@supabase/supabase-js@2/cors`
- **Edge Function RPC retry**: 3s initial delay + 8 retry × 2s (public RPC propagation)
- **Client retry**: "Invalid or failed transaction" → 3 deneme × 4s gecikme
- **Receipt status**: `0x1`, `1`, veya numeric 1 kabul edilir
