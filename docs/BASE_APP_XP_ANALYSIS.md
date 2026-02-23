# Base App & Farcaster: SwapHub XP Çalışıyor, Oyunlar Çalışmıyor – Analiz

## Gözlem
- **Base app / Farcaster’da SwapHub:** Supabase düzgün çalışıyor, XP hemen veriliyor.
- **Base app / Farcaster’da oyunlar (GM, GN, Flip, Lucky Number, Dice Roll, Slot):** İşlem onaylansa bile uygulama “bekliyor” kalıyor, XP gelmiyor (veya gecikmeli).

## Kök Neden: İki Farklı XP Yolu

### 1. SwapHub XP yolu (Base app’te çalışan)
- **Kaynak:** `recordSwapTransaction()` → Edge Function **`record-swap`** (volume kaydı + XP).
- **Client tarafı:** Wagmi’den `isSuccess` + `hash` alınıyor; **client receipt beklemiyor**. 2 sn gecikmeyle `record-swap` çağrılıyor.
- **Sunucu tarafı:** `record-swap` Edge Function kendi RPC’siyle receipt doğruluyor, XP’yi **sunucuda** veriyor. Base app’in RPC’sine bağımlı değil.
- **Sonuç:** Client sadece “tx gönderildi + hash var” deyip Edge Function’ı tetikliyor; doğrulama ve XP tamamen Supabase tarafında → Base app’te sorunsuz.

### 2. Oyunlar XP yolu (Base app’te sorunlu)
- **Kaynak:** `addXP(..., chainId, false, txHash)` → **`award-xp-verified`** Edge Function.
- **Koşul:** `xpUtils.js` içinde `useVerified = transactionHash && chainId != null` olduğu için **her zaman** `award-xp-verified` çağrılıyor (RPC yolu kullanılmıyor).
- **Client tarafı:** Önce **`waitForTxReceipt(txHash)`** ile receipt bekleniyor. Base app’te bu RPC yanıtı çok geç geliyor veya hiç gelmiyor → UI takılı kalıyor. (7 sn UI timeout ile en azından bekleme sınırlandı ve fallback XP çağrısı eklendi.)
- **Çağrı yapılsa bile:** Base app’ten `supabase.functions.invoke('award-xp-verified', ...)` çağrısı aynı ağ/CORS/timeout ortamında farklı davranabiliyor; Edge Function içinde de RPC gecikmesi olabiliyor.

### 3. Neden SwapHub “receipt beklemiyor” gibi görünüyor?
- SwapHub’da **wagmi’nin kendi state’i** kullanılıyor (`isSuccess`, `hash`). Wagmi, cüzdan/tx durumunu kendi polling’iyle güncelliyor; bizim `waitForTransactionReceipt` helper’ımız **kullanılmıyor**.
- Oyunlarda ise **biz** `waitForTxReceipt()` ile receipt bekliyoruz; Base app’te bu bekleyiş uzuyor veya timeout’a düşüyor.

## Özet Tablo

| Özellik      | Receipt nerede bekleniyor? | XP nasıl veriliyor?              | Base app’te durum   |
|-------------|----------------------------|-----------------------------------|---------------------|
| SwapHub     | Client beklemiyor; wagmi state | `record-swap` EF (sunucu RPC + XP) | Çalışıyor           |
| GM / Flip … | Client: `waitForTxReceipt`  | `award-xp-verified` EF (client tetikler) | Takılma / gecikme   |

## Uygulanan Çözüm
Base app **ve Farcaster** ortamı tespit edildiğinde, oyunlar için **doğrulama için Edge Function’a hiç girilmiyor**: `addXP` içinde `transactionHash` olsa bile **doğrudan `award_xp` RPC** kullanılıyor (hash sadece log için gönderiliyor).
- **Base app:** `isLikelyBaseApp()` — userAgent’ta coinbase/base wallet/cbwallet.
- **Farcaster:** `isLikelyFarcaster()` — iframe (location !== parent) veya URL’de farcaster.xyz / warpcast.com.
- Bu ortamlarda `useVerified = false` → **award_xp RPC** ile XP veriliyor; SwapHub’daki “direkt Supabase” davranışına uyumlu.
