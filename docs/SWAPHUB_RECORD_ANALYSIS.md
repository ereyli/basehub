# SwapHub → Supabase Kayıt Akışı: Kapsamlı Analiz

## Özet

TX doğrulama (record-swap Edge Function) eklendikten sonra swap verileri bazı kullanıcılarda Supabase'e yansımıyor. `swaphub_swaps` tablosunda veri var (son kayıt 22:03) — yani Edge Function **çalışıyor**, ancak sizin ortamınızda farklı bir sorun olabilir.

---

## Tam Veri Akışı

```
1. Kullanıcı swap yapar (aggregator V2/V3)
   └─ handleSwap() → pendingSwapVolumeRef = { swapAmountUSD }
   └─ writeContractAsync() → tx gönderilir

2. TX onaylanır
   └─ useWaitForTransactionReceipt: isSuccess=true, hash mevcut

3. Record effect (SwapInterface.tsx ~777)
   ├─ Koşullar: isSuccess && address && hash
   ├─ transactionStep === 'swapping' || 'success'
   ├─ pendingSwapVolumeRef.current?.swapAmountUSD > 0
   └─ scheduleRecord() → 1s sonra handleRecord()

4. recordSwapTransaction() (xpUtils.js)
   └─ supabase.functions.invoke('record-swap', { body: { wallet_address, swap_amount_usd, tx_hash } })
   └─ POST → ${VITE_SUPABASE_URL}/functions/v1/record-swap

5. record-swap Edge Function (v8: Supabase corsHeaders — x-client-info, apikey eklendi)
   ├─ verifyTxOnChain(txHash) — Base RPC ile eth_getTransactionReceipt
   ├─ swaphub_swaps.insert()
   ├─ swaphub_volume.upsert()
   └─ award_xp() — per-$100 + milestone
```

---

## Olası Başarısızlık Noktaları

### 1. Frontend: recordSwapTransaction hiç çağrılmıyor

| Neden | Koşul |
|-------|--------|
| **transactionStep** | `!== 'swapping'` ve `!== 'success'` — approval tx veya hızlı state değişimi |
| **swapAmountUSD <= 0** | pendingSwapVolumeRef null veya amount 0 (ethPriceUsd=0, custom token) |
| **Strict Mode** | Effect iki kez çalışır, ilk timeout iptal edilir; reschedule mantığı ikinci çalışmada tetiklenmeli |
| **Kullanıcı 1s içinde sayfa değiştirir** | Component unmount → timeout iptal → handleRecord hiç çalışmaz |
| **hash/address/isSuccess** | wagmi state reset veya farklı mutation |

### 2. recordSwapTransaction çağrılıyor ama fetch başarısız

| Neden | Kontrol |
|-------|---------|
| **CORS Allow-Headers eksik** | `Access-Control-Allow-Headers` içinde **authorization, x-client-info, apikey, content-type** hepsi olmalı. Supabase client bu header'ları gönderir; eksik olanı izin vermezse POST bloklanır. ✅ v8: `corsHeaders` from `jsr:@supabase/supabase-js@2/cors` kullanıldı |
| **VITE_SUPABASE_URL** | Production build'de env eksik/yanlış |
| **index.html fetch override** | Sadece warpcast, cca-lite vb. bloklanıyor — Supabase hariç |
| **Farcaster miniapp** | Gömülü tarayıcı fetch kısıtlamaları |

### 3. Edge Function: verifyTxOnChain başarısız

| Neden | Açıklama |
|-------|----------|
| **RPC 429** | mainnet.base.org, base.llamarpc.com rate limit |
| **Receipt henüz indekslenmedi** | 1s çok kısa — Edge Function 8 retry (2.5s aralık) ile ~20s deniyor |
| **TX başarısız (status=0x0)** | On-chain revert |
| **Hash format** | 0x prefix eksik/yanlış |

### 4. Edge Function: Insert/upsert hataları

| Neden | Kontrol |
|-------|---------|
| **RLS** | Service role ile yazılıyor — RLS bypass edilmeli |
| **Duplicate tx_hash** | 409 döner, client tarafında "already recorded" sayılmalı |

---

## Önerilen Düzeltmeler

### A. Gecikmeyi kaldır — hemen kaydet

`setTimeout(handleRecord, 1000)` kaldır, effect içinde doğrudan `handleRecord()` çağır. Böylece:
- Strict Mode timeout iptali riski kalkar
- Kullanıcı 1s içinde sayfadan ayrılsa bile kayıt çalışmış olur
- Edge Function zaten 8 retry ile RPC bekliyor; receipt geç gelse bile işlem tamamlanır

### B. Edge Function: daha fazla RPC + retry

`verifyTxOnChain` için ek RPC URL'leri ekle (örn. base-rpc.publicnode.com, base-mainnet.public.blastapi.io) ve retry sayısını/güvenilirliğini artır.

### C. Client: retry on failure ✅ Uygulandı

`addXP` (xpUtils.js) artık "Invalid or failed transaction on-chain" hatası alındığında **3 deneme × 4 saniye gecikme** ile otomatik retry yapıyor. Bu, hem SwapHub XP hem de tüm `award-xp-verified` kullanan akışlar için geçerli.

### D. Diagnostik log

Kayıt atlanıyorsa nedenini net gösterecek log ekle (transactionStep, swapAmountUSD, hash vb.).

---

## Edge Function CORS — Kök Neden ve Çözüm

### Sorun

Loglarda sadece OPTIONS görünüyordu, POST hiç gelmiyordu. Tarayıcı POST'u CORS nedeniyle engelliyordu.

### Kök Neden

Supabase client `functions.invoke()` çağrısında şu header'ları gönderir:
- `Authorization: Bearer <anon_key>`
- `Content-Type: application/json`
- **`apikey`** — Supabase API key
- **`x-client-info`** — Client bilgisi (basehub-farcaster@1.0.0)

Tarayıcı preflight (OPTIONS) sırasında bu header'ların izinli olup olmadığını sorar. `Access-Control-Allow-Headers` yanıtında **hepsinin** listelenmesi gerekir. Sadece `authorization, content-type` yetmez — `x-client-info` ve `apikey` eksikse POST bloklanır.

### Çözüm (v8)

Supabase resmi önerisi: `corsHeaders`'ı SDK'dan import et:
```ts
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors"
```
Bu header seti SDK ile senkron kalır; yeni header eklendiğinde otomatik dahil olur.

Manuel kullanım (eski SDK):
```ts
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

### Referanslar

- [Supabase CORS Docs](https://supabase.com/docs/guides/functions/cors)
- [browser-with-cors örnek](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/browser-with-cors/index.ts)
