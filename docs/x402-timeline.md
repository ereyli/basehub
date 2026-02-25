# x402 Değişiklik Zaman Çizelgesi

## Commit a88c6c4 (3 Şubat 2026) – "x402 her iki tarafta çalışıyordu"

### Frontend
- **`src/config/x402.js` yoktu.** Tüm x402 hook'ları **relative URL** kullanıyordu:
  - `useX402Payment`: `fetchWithPayment('/api/x402-payment', ...)`
  - `useAllowanceCleaner`: `fetchWithPayment('/api/x402-allowance-cleaner', ...)`
- Sonuç: İstek her zaman **mevcut origin**e gidiyordu (örn. www.basehub.fun → www.basehub.fun/api/...). **Same-origin, CORS yok.**

### Backend (api/x402-*.js)
- Vercel handler: `fullUrl = \`${protocol}://${host}/\`` → **her zaman root** (örn. `https://www.basehub.fun/`).
- paymentMiddleware sadece `'POST /'` ile tanımlıydı.
- İstemci ödeme yaparken URL: `https://www.basehub.fun/api/x402-allowance-cleaner`.
- Sunucu verify ederken Request URL: `https://www.basehub.fun/` (root).
- Bu iki URL farklı; teoride verify "Bad Request" verebilir. O dönem çalışıyorsa: Farcaster’da path farklı olabilir veya sadece Farcaster test edilmiş olabilir.

---

## Commit 38c4918 (12 Şubat 2026) – "x402 API base for web"

### Ne değişti?
- **`src/config/x402.js` eklendi:** `getX402ApiBase()` = `VITE_API_URL || 'https://www.basehub.fun'`.
- Tüm x402 hook'ları **absolute URL** kullanmaya başladı:  
  `fetchWithPayment(\`${getX402ApiBase()}/api/x402-allowance-cleaner\`, ...)`.

### Etkisi
1. **Vercel’de `VITE_API_URL=https://basehub.fun`** ise:
   - Kullanıcı **www.basehub.fun**’da → istek **basehub.fun**’a gidiyor → **cross-origin**.
   - basehub.fun → www yönlendirmesi yapıyorsa → **"Redirect is not allowed for a preflight request"** (CORS).
2. Backend hâlâ Request URL’yi **root** ile oluşturuyordu; verify URL uyuşmazlığı devam etti.

**Sonuç:** Bu commit, web’de x402’nin bozulmasına yol açan değişiklik. Amaç web’de de çalışsın diye absolute URL kullanmaktı; pratikte cross-origin + verify path uyumsuzluğunu tetikledi.

---

## Sonraki düzeltmeler (66e13e6, 380d4f3, df4f652)

- **x402.js:** basehub.fun / www.basehub.fun’dayken **yine same-origin** (window.location.origin) kullan; VITE_API_URL’i sadece diğer host’lar için kullan.
- **api/x402-*.js:** Request URL’yi **tam path** ile oluştur (`/api/x402-...`), middleware’e `POST /api/x402-...` ekle, route’ları bu path’e bağla.
- **allowance-cleaner:** networkConfig→network, X-Body ile body tekrar okuma.

Bu düzeltmelerle hem CORS hem verify tekrar çalışır hale getirildi.
