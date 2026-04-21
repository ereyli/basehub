# BaseHub Agent Worker - Coolify Kurulum

Bu worker, Agent Mode planlarini VPS/Coolify uzerinde calistirir. Kullanici tarayiciyi kapatsa bile Supabase kuyruğunu okuyup siradaki BaseHub islemini gonderir.

## 1. Supabase SQL

Supabase SQL Editor'de once bu dosyayi calistir:

```sql
-- supabase/agent_worker_schema.sql
```

Zaten mevcut olan su dosyalar da production Supabase'de uygulanmis olmali:

```sql
-- supabase/agent_cloud_schema.sql
-- supabase/agent_v2_schema.sql
-- supabase/migrations/agent_subscriptions.sql
```

## 2. Coolify Application

Coolify'da yeni Application olustur:

- Source: GitHub repo
- Build command:

```bash
npm install
```

- Start command:

```bash
npm run worker
```

## 3. Environment Variables

Coolify application Environment Variables bolumune bunlari gir:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
CLOUD_AGENT_WORKER_PRIVATE_KEY=0x...
VITE_CLOUD_AGENT_SPENDER_ADDRESS=0x...
AGENT_SIGNER_ENCRYPTION_KEY=...
VITE_AGENT_MODE_RPC_URL=https://...
```

Opsiyonel:

```bash
AGENT_SIGNER_MIN_GAS_ETH=0.00003
AGENT_SIGNER_GAS_TOPUP_ETH=0.00006
AGENT_WORKER_POLL_MS=15000
AGENT_WORKER_LOCK_MS=180000
AGENT_WORKER_BATCH_SIZE=3
```

Notlar:

- `VITE_CLOUD_AGENT_SPENDER_ADDRESS`, `CLOUD_AGENT_WORKER_PRIVATE_KEY` icindeki cüzdan adresiyle ayni olmali.
- Yeni Cloud Agent modelinde BaseHub action transaction signer'i ortak worker degil, kullaniciya ozel uretilen agent signer olur.
- `AGENT_SIGNER_ENCRYPTION_KEY` Vercel/API ve Coolify worker tarafinda birebir ayni olmali. Aksi halde API'nin kaydettigi user-specific signer worker tarafinda cozulmez.
- Worker cüzdani artik asil BaseHub action sender'i degil; sadece yeni user-specific signer'in gasi cok dusukse ufak top-up yapmak icin kullanilir.

## 4. Deploy

Coolify'da Deploy'a bas. Loglarda sunu gormelisin:

```bash
[agent-worker] started. poll=15000ms batch=3
```

## 5. Kullanim

Kullanici BaseHub'da:

1. Agent Mode unlock yapar.
2. Cloud permission verir.
3. Plan olusturur.
4. Approve eder.
5. Start der.

Start dedikten sonra plan Supabase `agent_cloud_runs` tablosuna yazilir. Worker o tabloyu okuyup islemleri otomatik calistirir.

## 6. Sorun Giderme

- `Cloud Agent worker private key is not configured`: Coolify env eksik.
- `Cloud worker has no ETH for gas`: worker cüzdanina az miktar ETH ekle.
- `Cloud worker is not an owner`: kullanici Cloud setup'i yeniden yapmali; spender address worker adresiyle ayni olmali.
- `Supabase service storage is not configured`: `SUPABASE_URL` veya `SUPABASE_SERVICE_KEY` eksik.
