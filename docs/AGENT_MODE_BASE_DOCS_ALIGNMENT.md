# BaseHub Agent Mode — Base Dokümantasyonu ile Hizalama

Bu belge, BaseHub’ta planlanan **Agent Mode** (kullanıcı kontrollü, sınırlı onchain otomasyon) özelliğinin [Base dokümantasyonu](https://docs.base.org/llms.txt) ile nasıl uyumlu kurulacağını özetler. Ürün ve mühendislik kararları için tek referans noktası olarak kullanılmalıdır.

**Dokümantasyon indeksi (LLM giriş noktası):** [https://docs.base.org/llms.txt](https://docs.base.org/llms.txt)

---

## 1. Base’in agent modeli (özet)

Base, yapay zekâ ajanını **bağımsız bir ekonomik aktör** olarak konumlandırır:

- **Cüzdan**: Fon tutma, ödeme yapma, işlem yetkilendirme  
- **Kimlik**: Diğer servislerin ve ajanların güvenmesi için kayıt / standartlar  
- **Ödeme protokolleri**: Özellikle [x402](https://www.x402.org) ile API erişimi, ücretlendirme, “öde ve tekrar dene” akışları  

Kaynak: [AI Agents on Base](https://docs.base.org/ai-agents)

**Uçtan uca akış (Base dokümanlarındaki mantık):**

1. Ajan cüzdanını kur (Bankr / CDP / Sponge vb.)  
2. Kimliği kaydet (ör. agent registration, ERC-8004 + Basename — ilgili [setup](https://docs.base.org/ai-agents/setup) sayfaları)  
3. Ücretli API’ye istek → 402 → cüzdanla ödeme imzası → tekrar istek → veri  

Bu model **prompt içinde private key üretmeyi** önermez; aksine **ayrı güvenli cüzdan altyapısı** kullanılmasını vurgular.

---

## 2. Neden “prompt ile random private key” yok?

[Wallet Setup for Agents](https://docs.base.org/ai-agents/setup/wallet-setup) açıkça şunu söyler:

- Ajan sohbet bağlamında üretilen private key **loglanabilir, önbelleğe alınabilir, sızdırılabilir**  
- Prompt geçmişine erişen sistemler anahtarı çıkarabilir  
- Anahtar ele geçerse **fonlar kalıcı olarak kaybolur**  

**Sonuç (BaseHub için):** Agent Mode’un “doğru” yolu, kullanıcıya **tarayıcıda rastgele key üretip saklatmak** değil; **hazır ajan cüzdan sağlayıcıları** veya **Base Account + Spend Permissions** gibi **anahtarın güvenli ayrıldığı** modellerdir.

---

## 3. Önerilen ajan cüzdan seçenekleri (Base dokümanları)

Aşağıdakiler Base’in [Wallet Setup](https://docs.base.org/ai-agents/setup/wallet-setup) sayfasında özetlenen seçeneklerdir. BaseHub Agent Mode entegrasyonu için **ürün tarafında “hangi sağlayıcı”** sorusu buradan seçilir.

### 3.1 CDP Agentic Wallet (Coinbase)

- **Kimlik doğrulama**: E-posta OTP — ajan kodunda API key zorunlu değil (dokümana göre)  
- **Private key**: Coinbase güvenli altyapısında kalır  
- **Kurulum örneği**: `npx skills add coinbase/agentic-wallet-skills`  
- **Beceriler**: `authenticate-wallet`, `fund`, `send-usdc`, `trade`, `pay-for-service`, vb.  
- **Ağ**: Base üzerinde çalışır  
- **Detay**: [CDP Agentic Wallet docs](https://docs.cdp.coinbase.com/agentic-wallet/welcome)

### 3.2 Sponge Wallet

- Çok zincir (Base, Ethereum, Solana), x402 proxy, swap / köprü  
- Ajan kaydı: `POST https://api.wallet.paysponge.com/api/agents/register` — dönen `apiKey` saklanır  
- **Detay**: [Sponge skill / docs](https://wallet.paysponge.com/skill.md)

### 3.3 Bankr

- Base, Ethereum, Solana, Polygon, Unichain; bazı zincirlerde gas sponsorluğu; built-in swap  
- Skill: GitHub `BankrBot/skills`  
- Ayrı **bankr.bot** hesabı ve API key; kişisel Bankr hesabı ile ajan cüzdanı karıştırılmamalı  
- **Detay**: [bankr.bot docs](https://docs.bankr.bot)

### 3.4 Base skills (genel)

Base, AI asistanların Base API’lerini doğrudan kullanması için skill paketleri önerir:

- Repo: [https://github.com/base/skills](https://github.com/base/skills)  
- Kurulum örneği: `npx skills add base/base-skills`  

Bu, BaseHub’un “agent backend” veya geliştirici araçları için referans olabilir; son kullanıcı web uygulaması farklı bir yüzey sunabilir (izinler + limitler aynı prensipte kalır).

---

## 4. Spend Permissions (Base Account)

**Amaç:** Kullanıcı, güvenilir bir **`spender`** adresinin kendi Base Account’undan **tanımlı limitler içinde** varlık hareket ettirmesine izin verir. İzin imalandıktan sonra **ek kullanıcı imzası olmadan** (dokümana göre) bu limitler dahilinde harcama yapılabilir.

Kaynak: [Use Spend Permissions](https://docs.base.org/base-account/improve-ux/spend-permissions)

**Önemli alanlar (özet):**

| Alan        | Açıklama |
|------------|----------|
| `account`  | İzin veren smart account adresi |
| `spender`  | Harcama yapabilecek varlık (uygulama/ajan sunucusu cüzdanı) |
| `token`    | ERC-20 veya native token |
| `allowance`| Her `period` içinde maksimum harcama |
| `period`   | Süre (saniye); periyodik sıfırlama |
| `start` / `end` | Geçerlilik aralığı |
| `salt`     | Benzersiz izinler için |
| `extraData`| Ek veri |

**SDK (örnek):** `@base-org/account` — `requestSpendPermission`, `prepareSpendCallData`, `requestRevoke`, `prepareRevokeCallData` vb.

**BaseHub için anlam:** “Günlük harcama limiti + güvenilir spender + whitelist işlemler” ürün dilini teknik olarak **Spend Permission** ile eşleştirmek mümkündür.

### 4.1 Kritik kısıt (Base dokümanı)

> **Spend Permissions for Base App Apps are coming soon** and will be supported in a future update.

Yani Base App içindeki mini app akışlarında bu özellik **hemen** tam olmayabilir. BaseHub mimarisi:

- **Tam yol:** Web + Base Account SDK + Spend Permission (mümkün olduğunda)  
- **Fallback:** Kullanıcı cüzdanı ile sınırlı, onaylı veya manuel adımlar; veya sadece **okuma + plan** modu  

Sub Accounts ile **Auto Spend Permissions** ilişkisi: [Sub Accounts](https://docs.base.org/base-account/improve-ux/sub-accounts#auto-spend-permissions)

---

## 5. x402 ve ödeme akışı

Base agent dokümanları, ücretli API’lerde **402 Payment Required** → cüzdanla ödeme imzası → yeniden deneme akışını anlatır. BaseHub Agent Mode’da “mini uygulama ödemeleri” veya harici API kullanımı planlanıyorsa bu model referans alınır.

Giriş: [Pay for services with x402](https://docs.base.org/ai-agents/payments/pay-for-services-with-x402) (ai-agents bölümünden)

---

## 6. BaseHub Agent Mode — mimari ilkeler (bu belgeye göre)

Aşağıdaki maddeler **Base dokümanlarıyla çelişmemek** için zorunlu kabul edilir:

1. **Private key’i prompt veya sohbet bağlamında üretme / saklama yok** — Base Wallet Setup uyarısı.  
2. **Ayrı ajan kimliği**: Mümkünse CDP / Sponge / Bankr veya kullanıcı tarafından oluşturulan **düşük bakiyeli** ayrı adres; ana cüzdan ayrı.  
3. **Harcama sınırı**: Ürün dilinde “günlük limit”; teknikte Spend Permission `allowance` + `period` veya eşdeğeri.  
4. **Whitelist**: Sadece önceden onaylı kontratlar / BaseHub’un tanıdığı işlemler; keyfi `call` yok.  
5. **Durdurma / geri alma**: Kullanıcı her zaman duraklatabilir; Spend Permission için `requestRevoke` veya spender’dan `prepareRevokeCallData`.  
6. **Şeffaflık**: Yapılan işlemler, maliyet ve günlük toplamlar kullanıcıya açık (rapor / log).  
7. **Base App Apps**: Spend Permission “coming soon” olduğu için **feature flag** ve fallback zorunlu.

### 6.1 Örnek: Base dokümanındaki birleşik senaryo

Base, Spend Permissions’ı **Zora Creator Coins** satın alan bir AI ajanı örneğinde anlatır; harici olarak **CDP Server Wallets** ve **Trade API** ile birleştirilebileceğini belirtir (Spend Permissions sayfasındaki “Example Use Case” bölümü). BaseHub için doğrudan kopyalamak şart değil; **“sınırlı harcama + güvenilir spender + belirli protokoller”** fikri aynıdır.

---

## 7. İlgili Base doküman linkleri (öncelik sırası)

| Konu | URL |
|------|-----|
| LLM / indeks | [docs.base.org/llms.txt](https://docs.base.org/llms.txt) |
| AI Agents genel | [AI Agents](https://docs.base.org/ai-agents) |
| Cüzdan kurulumu | [Wallet Setup](https://docs.base.org/ai-agents/setup/wallet-setup) |
| Agent kayıt | [Agent registration](https://docs.base.org/ai-agents/setup/agent-registration) |
| x402 ödemeler | [Pay for services with x402](https://docs.base.org/ai-agents/payments/pay-for-services-with-x402) |
| Spend Permissions | [Spend Permissions](https://docs.base.org/base-account/improve-ux/spend-permissions) |
| Spend Permission Manager (GitHub) | [coinbase/spend-permissions](https://github.com/coinbase/spend-permissions) |
| Base MCP (asistanlar için) | [docs.base.org/mcp](https://docs.base.org/mcp) |
| Base Account — AI araçları | [AI tools available for devs](https://docs.base.org/base-account/quickstart/ai-tools-available-for-devs) |

---

## 8. Dokümantasyon geri bildirimi (Base)

Base, belirli sayfalar için geri bildirim uç noktası tanımlar. **Yalnızca somut ve düzeltilebilir** bir sorun varsa kullanılmalıdır:

- **POST** `https://docs.base.org/_mintlify/feedback/base-a060aa97/agent-feedback`  
- **Body (JSON):** `{ "path": "/current-page-path", "feedback": "Description of the issue" }`  

---

## 9. Bu belgenin kod içinde kullanımı

BaseHub repo’sunda Agent Mode ile ilgili modül, servis veya hook dosyalarının başına kısa bir yorum eklenebilir:

```text
// Agent Mode architecture aligns with Base docs: dedicated agent wallet (not prompt-generated keys),
// optional Spend Permissions for capped spending, whitelist-only actions.
// See: docs/AGENT_MODE_BASE_DOCS_ALIGNMENT.md
// Index: https://docs.base.org/llms.txt
```

---

## 10. BaseHub’da uygulama (kod)

- **Route:** `/agent` — `AgentMode` sayfası (`src/pages/AgentMode.jsx`).
- **Ayrı Base Account:** `AgentBaseAccountProvider` + `getAgentBaseAccountSDK()` (`src/features/agent-mode/agentBaseAccountSdk.js`, `src/contexts/AgentBaseAccountContext.jsx`). Ana RainbowKit cüzdanından bağımsız; agent işlemleri `getAgentProvider()` → `eth_sendTransaction` (ve isteğe bağlı Spend Permission RPC) ile yapılır.
- **Bakiye (ETH + USDC):** `useAgentBalances` — Base public RPC + `viem` (`src/hooks/useAgentBalances.js`). USDC adresi `src/config/tokens.ts` (Base USDC).
- **Policy / limit katmanı (istemci):** `agentPolicyStorage.js` — günlük işlem sayısı, günlük ETH ve USDC harcama tavanı, duraklatma, aksiyon beyaz listesi (`allowGm`, ileride `allowSwaps` / `allowMints` / `allowMiniApps`). `localStorage` ile kalıcı; on-chain Spend Permission’dan ayrı, tamamlayıcı bir katman.
- **Örnek gerçek işlem:** `sendGmWithAgentProvider` — Base’deki `GM_GAME` sözleşmesine `sendGM` (ücret `GM_GAME_FEE_WEI`), imza yalnızca agent provider üzerinden.
- **Otomasyon (UI):** `agentAutomationStorage.js` + `useAgentScheduler.js` — kullanıcı **Başlat** ile günlük tek GM’yi yerel saat eşiğinden sonra tetikler; sekme açıkken çalışır. Sayfa kapatılınca tarayıcı imzası mümkün olmadığından görev durur; tam arka plan için sunucu + Spend Permission + `spender` gerekir. (İsteğe bağlı eski LLM plan endpoint’i: `api/agent-mode-plan.js` — şu an ana akışta kullanılmıyor.)
- **x402 ajan erişimi:** `api/x402-agent-subscription.js` + `useX402AgentSubscription.js` + `agentX402Entitlement.js` — abonelik/erişim ücreti USDC x402 ile; doğrulama kolay, kullanıcı ana cüzdanından öder. Ödeme sonrası **Supabase** `agent_subscriptions` tablosuna satır (migration: `supabase/migrations/agent_subscriptions.sql`). Vercel’de `SUPABASE_URL` + **`SUPABASE_SERVICE_KEY`** (RLS bypass) gerekir; isteğe bağlı `X402_AGENT_SUBSCRIPTION_DAYS` (varsayılan 30).
- **Spend Permission (isteğe bağlı):** `@base-org/account/spend-permission` — USDC için `requestSpendPermission`; **spender** adresi `VITE_AGENT_SPENDER_ADDRESS` ile yapılandırılır (otomasyon sözleşmesi).
- **Aktivite günlüğü:** `localStorage` (son N kayıt); Basescan tx linki.
- **Nav:** `products.js` içinde `agent-mode`; Home’da **AGENT** bölümü (Base ağında); mobil menüde kısayol.
- **Kapatma:** `VITE_AGENT_MODE_ENABLED=false` ile route’u koşullu gizlemek istersen `App.jsx` içinde sarılabilir (şu an varsayılan: açık).

## 11. Satın alınan ajan + sayfa kapalıyken çalışma (sunucu mimarisi)

**Amaç:** Kullanıcı bir “ajan paketi” satın alır; sistem bu kullanıcı adına **belirli sınırlar içinde** zincir işlemlerini **sunucu tetiklemesiyle** yürütür. Tarayıcı kapalı olsa da cron/worker devam eder.

Bu, tarayıcıdaki Agent Mode ekranından **farklı bir katman**: istemci = bağlantı + izin + fonlama; **asıl otomasyon = güvenilir backend + sözleşme sınırları**.

### 11.1 Güven modeli (kısa)

| Bileşen | Rol |
|--------|-----|
| **Kullanıcı (Base Account)** | Bir kerelik **Spend Permission** (veya eşdeğer izin) verir: belirli `spender` adresi, belirli token, tavan, süre. |
| **`spender` (sizin deploy ettiğiniz akıllı sözleşme)** | İzin verildiği sürece, **sadece sizin kodunuzun yazdığı** fonksiyonları çağırır (beyaz liste: hedef kontrat, `calldata` şablonu, max gas). |
| **Backend (API + cron)** | Ödeme/abonelik doğrular, kuyruktan iş alır, `spender`’ı tetikler veya CDP Server Wallet vb. ile imzalar. Anahtarlar **sunucuda** kalır, kullanıcı sohbette anahtar üretmez. |
| **Ödeme / abonelik** | Stripe, kripto, x402 veya iç “kredi” — ödeme onayı → `subscriptions` tablosunda **ajan aktif** bayrağı. |

Spend Permissions özeti: [Spend Permissions](https://docs.base.org/base-account/improve-ux/spend-permissions).

### 11.2 USDC (ve ERC-20) için arka plan — doğrudan uyumlu

- Kullanıcı, Base Account’tan **USDC Spend Permission** ile `spender` adresinize izin verir.
- **Cron** (ör. Vercel Cron → `GET /api/internal/agent-tick` + `CRON_SECRET`) veya Supabase Edge Schedule, periyodik olarak:
  1. Aktif abonelikleri DB’den okur,
  2. Policy (günlük limit, duraklatma) sunucuda uygulanır,
  3. `spender` üzerinden izinli çağrı yapılır (ör. swap, ödeme, belirli kontrata `transfer`).

Bu akışta **tarayıcı açık olması gerekmez**; imza tarafı kullanıcıdan zaten alınmış izin + sunucunun `spender`’ı tetiklemesidir (kontrat tasarımına göre).

### 11.3 ETH ile `sendGM` gibi işlemler — ek tasarım gerekir

`GMGame.sendGM` **payable**; ücret kullanıcının **ETH bakiyesinden** veya önceden ayrılmış bir kasadan gelmelidir. Spend Permission **USDC odaklıdır**; ETH’yi doğrudan “kullanıcı adına arka planda” çekmek için tipik seçenekler:

1. **Kasa / ön ödeme modeli:** Kullanıcı ETH’yi (veya USDC’yi) sizin kontrol ettiğiniz bir **ajan kasası** kontratına yatırır; cron, kasadan `GM_GAME`’e `sendGM` ödeyecek şekilde `spender` veya kasa mantığını çağırır.  
2. **4337 / akıllı cüzdan oturum anahtarı:** Kullanıcı cüzdanı, belirli süre ve limitle bir **session key** veya batch imza verir; relayer UserOperation gönderir (altyapı ağır, ürün tasarımına göre).  
3. **Sadece USDC harcayan ürün:** Arka planı önce USDC + Spend Permission ile kilitlemek; GM’yi ikinci aşamaya bırakmak.

Üretimde hangi yolun seçileceği **risk, denetim ve kullanıcı deneyimi** ile belirlenir; dokümanda “tek doğru yol” yoktur.

### 11.4 Önerilen uygulama sırası (MVP → tam ürün)

1. **Veri modeli:** `agent_products` (fiyat, süre), `agent_subscriptions` (kullanıcı kimliği, cüzdan, durum, bitiş tarihi), `agent_jobs` (ne zaman ne çalışacak), `agent_execution_logs` (tx hash, hata).  
2. **Ödeme — x402 + Supabase:** `api/x402-agent-subscription.js` ödeme sonrası `agent_subscriptions` tablosuna insert eder (`payer_wallet_address`, isteğe bağlı `agent_wallet_address`, `price_label`, `expires_at`, `payment_tx_hash`). İstemci POST gövdesinde `payer_wallet_address` gönderir (hook otomatik doldurur). Tablo: `supabase/migrations/agent_subscriptions.sql` — Supabase SQL Editor veya CLI ile uygula. Ortam: `X402_AGENT_SUBSCRIPTION_PRICE`, isteğe bağlı `X402_AGENT_SUBSCRIPTION_DAYS` (varsayılan 30 gün).  
3. **İzin toplama:** Agent sayfasında veya ödeme sonrası akışta **Spend Permission** isteği (`spender` = deploy edeceğiniz kontrat).  
4. **`spender` kontratı:** Yalnızca izin verilen işlemleri yapan, audit edilebilir, durdurulabilir (pause) sözleşme.  
5. **Cron:** Vercel `vercel.json` `crons` veya harici scheduler; endpoint sadece `Authorization: Bearer CRON_SECRET` ile çağrılabilir olsun.  
6. **Gözlemleme:** Her yürütme loglansın; kullanıcıya “ajan aktivitesi” ekranı.

### 11.5 “Ajanı satın alma” ile bağlantı

- **Satın alma**, ürün tarafında bir **SKU** (ör. “Günlük otomasyon — 30 gün”) ve ödeme onayıdır.  
- **Çalıştırma**, teknik olarak **abonelik + Spend Permission + spender + cron** birleşimidir.  
- İstemci Agent Mode sayfası, hâlâ **funding + izin + durum** için kullanılabilir; asıl yürütme **sunucuda** olur.

### 11.6 Bu repoda henüz ne yok?

- Deploy edilmiş `spender` kontratı ve backend cron’un **gerçek** tetiklemesi (şu an yalnızca istemci zamanlayıcı ve dokümantasyon vardır).  
- Sonraki mühendislik adımı: yukarıdaki sıraya göre **DB + güvenli cron endpoint + kontrat** eklenmesi.

### 11.7 Yerelde API’yi denemek (Vite + `api/`)

`npm run dev` sadece **Vite** çalıştırır; `api/*.js` dosyalarını Node içinde **otomatik çalıştırmaz**. Varsayılan olarak Vite, `/api` isteklerini `vite.config.js` ile **production** host’a proxy’ler — bu yüzden `.env`’deki `X402_AGENT_SUBSCRIPTION_PRICE` yerel handler’da görünmez.

**Yerelde tam denemek için (deploy şart değil):**

1. [Vercel CLI](https://vercel.com/docs/cli) kurulu olsun (`npm i -g vercel` veya `npx vercel dev`).
2. Proje kökünde **ayrı bir terminal**: `npm run dev:api` → bu, projedeki `api/` rotalarını bilgisayarında sunar ve kök `.env` değişkenlerini kullanır (x402 + Supabase insert dahil).
3. **İkinci terminal**: Vite varsayılanı **5173**; proxy’yi `vercel dev` adresine ver:
   - `DEV_API_PROXY=http://127.0.0.1:3000 npm run dev`  
   (`VITE_PORT=5173` artık zorunlu değil; proje varsayılanı 5173.)
4. Tarayıcı: **`http://localhost:5173`** — `/api/...` istekleri **local** `vercel dev`’e gider.  
   **Not:** Sadece `npm run dev` kullanıyorsan da adres **5173** (3000 değil). Eski bookmark’ı güncelle.

Özet: **“Vercel” burada sadece yerel sunucu emülatörü + aynı serverless dosya yapısı**; production’a göndermeden test edebilirsin.

---

## 12. Sürüm notu

- Bu dosya, kullanıcı tarafından paylaşılan **Wallet Setup** ve **AI Agents on Base** sayfa içerikleri ile [Spend Permissions](https://docs.base.org/base-account/improve-ux/spend-permissions) sayfasından özetlenmiştir.  
- Base dokümanları güncellenebilir; üretim kararlarından önce ilgili resmi sayfalar doğrulanmalıdır.
