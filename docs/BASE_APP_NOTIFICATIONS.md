# Base App bildirimleri (Base Notifications API) — BaseHub entegrasyon rehberi

**Resmi kaynak:** [Base — Notifications (technical guide)](https://docs.base.org/apps/technical-guides/base-notifications)

**Dokümantasyon indeksi:** Tüm Base doküman ağacı için: [https://docs.base.org/llms.txt](https://docs.base.org/llms.txt)

**Geri bildirim (dokümantasyon hatası):** Yanlış veya eksik gördüğünüz bir şey varsa, yalnızca somut ve eyleme dönük durumlarda şu adrese POST atın:  
`https://docs.base.org/_mintlify/feedback/base-a060aa97/agent-feedback`  
Gövde (JSON): `{ "path": "/apps/technical-guides/base-notifications", "feedback": "Açıklama" }`

---

## Özet

Base, [Base Dashboard](https://dashboard.base.org) üzerinden **REST API** ile uygulamanızı **Base App** içinde sabitlemiş ve bildirimlere izin vermiş kullanıcılara **uygulama içi bildirim** göndermenizi sağlar.

**Kritik kısıt:** Bildirimler **yalnızca Base App** üzerinden iletilir. Uygulamanızı tarayıcıda veya başka platformlarda kullananlar bu API ile **bildirim almaz**. Web tabanlı BaseHub kullanıcıları bu kanaldan otomatik olarak kapsanmaz; hedef kitle Base App içindeki mini app deneyimidir.

---

## Adım adım: Nerede ne yapacaksın?

### 1) Kullanıcı tarafı (bildirimi görecek kişi)

Bunu **sen de test için** yapmalısın:

1. Telefonda **Base App**’i aç.
2. BaseHub’u, Dashboard’a **aynı URL** ile kayıtlı olan adresten aç (ör. `https://www.basehub.fun`).
3. Uygulamayı **sabitle (pin / kaydet)** — Base dokümantasyonundaki “pinned” şartı bu.
4. Bu uygulama için Base App içinde **bildirimleri aç**.

Bunlar yoksa API bazen başarı döner ama kullanıcı hiçbir şey görmez; `send` yanıtında `sent: false` ve `failureReason` görebilirsin.

---

### 2) Senin tarafın — Base Dashboard (bir kez)

| Adım | Nerede | Ne yap |
|------|--------|--------|
| A | [dashboard.base.org](https://dashboard.base.org) | Giriş yap, proje oluştur veya seç. |
| B | Proje / uygulama ayarları | **BaseHub’un tam URL’sini** kaydet (`https://www.basehub.fun` gibi). Sonradan API’de kullanacağın `app_url` ile **harfi harfine aynı** olsun (`www`, `http`/`https` tutarlılığı). |
| C | **Settings → API Key** | Yeni anahtar üret, **kopyala**. Bu anahtarı sadece güvenli yerde sakla. |

**Asla yapma:** API anahtarını GitHub’a commit’leme, `VITE_` ile ön yüze koyma, Discord’a yapıştırma.

---

### 3) İlk test — kod yok, sadece Terminal (Mac)

1. **Terminal** uygulamasını aç (`Uygulamalar → Yardımcı Programlar → Terminal`).
2. Aşağıdaki komutta üç yeri kendine göre değiştir:
   - `BURAYA_API_KEY` → Dashboard’dan kopyaladığın key
   - `https%3A%2F%2Fwww.basehub.fun` → kendi `app_url`’ünün **URL-encode** hali (aynı host Dashboard’dakiyle aynı olmalı). İpucu: tarayıcıda “url encode” aratıp `https://www.basehub.fun` yaz, çıkan string’i kullan.
   - İsteğe bağlı: önce kimlere gidebileceğini görmek için:

```bash
curl -s "https://dashboard.base.org/api/v1/notifications/app/users?app_url=https%3A%2F%2Fwww.basehub.fun&notification_enabled=true" \
  -H "x-api-key: BURAYA_API_KEY"
```

`success: true` ve `users` listesi geliyorsa Dashboard eşleşmesi doğrudur.

3. **Tek bildirim gönder** (test cüzdanın Base App’te pin + bildirim açık olsun):

```bash
curl -X POST "https://dashboard.base.org/api/v1/notifications/send" \
  -H "x-api-key: BURAYA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"app_url":"https://www.basehub.fun","wallet_addresses":["0xSENIN_CÜZDAN_ADRESIN"],"title":"BaseHub test","message":"Bu bir test bildirimidir.","target_path":"/"}'
```

- `title` **en fazla 30** karakter, `message` **en fazla 200** karakter.
- `app_url` tırnak içindeki adres, Dashboard’daki ile **aynı** olmalı.

Yanıtta ilgili adres için `"sent": true` görürsen ve kullanıcı şartları sağlıyorsa bildirim Base App’e düşer.

**Sık hatalar:** `401` → key yanlış veya `x-api-key` eksik. `403` → `app_url` projene ait değil veya bildirim izni yok. `429` → dakikada 10 istek sınırı.

---

### 4) Sonra — otomasyonu nereye koyacaksın?

- **Şimdilik:** Sadece 3. adım yeterli; “çalışıyor mu?”yu böyle doğrularsın.
- **Üretim:** API çağrısını **sunucuda** yap (ör. Vercel **Environment Variables** içinde `BASE_DASHBOARD_API_KEY`, bir `api/*.js` serverless veya zamanlanmış görev). Böylece anahtar tarayıcıya sızmaz.

`env.example` içinde önerilen değişken isimleri için aşağıdaki bölüme bak.

---

## Ön koşullar

1. [Base Dashboard](https://dashboard.base.org) üzerinde bir **proje** oluşturulmuş olmalı.
2. BaseHub’un **kayıtlı uygulama URL’si** (`app_url`) bu projede tanımlı olmalı (Dashboard’da uygulama adresiniz ile birebir uyumlu).
3. Dashboard → **Settings → API Key** bölümünden bir **API anahtarı** üretilmiş olmalı.

İsteklerde API anahtarı **`x-api-key`** HTTP başlığı ile gönderilir.

---

## BaseHub tarafında nasıl kullanılır?

### 1. API anahtarını asla istemciye koymayın

`x-api-key` **sunucu tarafında** kalmalı (ör. Vercel ortam değişkeni, Supabase Edge Function sırrı, güvenli backend). Tarayıcıdaki `VITE_*` ile bu anahtarı **expose etmeyin**; aksi halde anahtar çalınır ve başkası adınıza bildirim gönderebilir.

### 2. Tipik akış

1. **Kitleyi öğren:** Bildirim açık kullanıcıların cüzdan adreslerini çekmek için `GET` endpoint’i (sayfalama ile).
2. **Gönder:** Bir veya daha fazla adrese `POST` ile başlık + mesaj + isteğe bağlı `target_path` gönderin.

Olay tetikleyicileri örnekleri:

- Sunucu cron / zamanlanmış görev (ör. günlük özet).
- Zincir üstü veya veritabanı olayı sonrası backend webhook’u.
- Yönetici panelinden manuel tetik (yine sunucu üzerinden).

### 3. `app_url` değeri

İstek gövdesinde ve sorguda kullanılan `app_url`, Dashboard’da kayıtlı URL ile **aynı** olmalıdır (ör. `https://www.basehub.fun` — sondaki slash ve `www` tutarlılığına dikkat).

### 4. `target_path`

Kullanıcı bildirime dokunduğunda açılacak **uygulama içi yol**. Verilirse `/` ile başlamalı; en fazla **500** karakter. Örnekler:

| Amaç        | Örnek `target_path` |
|------------|----------------------|
| Ana sayfa  | `/` veya boş bırakıp kök |
| Profil     | `/profile`           |
| Agent      | `/agent`             |

BaseHub rotalarınızla uyumlu path seçin (`App.jsx` / router tanımlarına bakın).

---

## API uç noktaları

**Taban:** `https://dashboard.base.org/api`

Tüm isteklerde başlık: `x-api-key: <your-api-key>`

### GET `/v1/notifications/app/users`

Uygulamanızı **sabitlemiş** kullanıcıları döner; isteğe bağlı olarak yalnızca bildirimleri açık olanları süzebilirsiniz. Sonuçlar **sayfalanır**.

**Sorgu parametreleri:**

| Parametre | Zorunlu | Açıklama |
|-----------|---------|----------|
| `app_url` | Evet | Dashboard’daki uygulama URL’si |
| `notification_enabled` | Hayır | `true` ise yalnızca bildirim izni verenler |
| `cursor` | Hayır | Önceki yanıttan `nextCursor` |
| `limit` | Hayır | Sayfa başına kullanıcı; en fazla **100** |

**Örnek:**

```bash
curl "https://dashboard.base.org/api/v1/notifications/app/users?app_url=https%3A%2F%2Fwww.basehub.fun&notification_enabled=true" \
  -H "x-api-key: YOUR_SECRET_KEY"
```

Yanıtta `users[].address` ve `users[].notificationsEnabled` alanları bulunur; devam sayfası için `nextCursor` kullanılır.

### POST `/v1/notifications/send`

Bir veya daha fazla cüzdan adresine bildirim gönderir.

**Gövde (JSON):**

| Alan | Zorunlu | Kısıt |
|------|---------|--------|
| `app_url` | Evet | Kayıtlı uygulama URL’si |
| `wallet_addresses` | Evet | En az 1, en fazla **1000** adres |
| `title` | Evet | En fazla **30** karakter |
| `message` | Evet | En fazla **200** karakter |
| `target_path` | Hayır | `/` ile başlamalı; max **500** karakter |

**Örnek:**

```bash
curl -X POST "https://dashboard.base.org/api/v1/notifications/send" \
  -H "x-api-key: YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "app_url": "https://www.basehub.fun",
    "wallet_addresses": ["0x..."],
    "title": "BaseHub",
    "message": "Yeni bir ödülün var — dokun ve gör.",
    "target_path": "/"
  }'
```

**Yanıt:** `success` yalnızca **tüm** adresler başarılıysa `true` olabilir. `results[]` içinde adres bazında `sent` ve başarısızlıkta `failureReason` (ör. `user has not saved this app`, `user has notifications disabled`) döner.

---

## Hız limiti ve toplu gönderim

- **Hız limiti:** İki endpoint birlikte **dakikada 10 istek / IP** (aşılırsa **429 Too Many Requests**).
- **Toplu adres:** İstek başına en fazla **1000** adres; daha fazlası için istekleri bölün.
- **Tekilleştirme:** Aynı istek içinde yinelenen adresler bir kez sayılır.
- **24 saat kuralı:** Aynı uygulama, adres, başlık, mesaj ve `target_path` ile gönderilen özdeş bildirimler 24 saat içinde tekrar gönderilmez; API başarı dönebilir ancak ikinci push gitmeyebilir — spam önleme için tasarım böyle.

---

## Hata kodları (özet)

| HTTP | Anlamı |
|------|--------|
| 400 | Eksik/uzun alan, `target_path` formatı, adres sayısı vb. |
| 401 | API anahtarı yok veya geçersiz |
| 403 | `app_url` bu projeye ait değil veya bildirimler için whitelist yok |
| 404 | API anahtarına bağlı proje yok |
| 429 | Hız limiti |
| 503 | Gönderim servisi geçici kullanılamıyor (yeniden deneyin) — genelde **send** için |

---

## BaseHub için önerilen ortam değişkenleri (sunucu)

Örnek isimler — projede tek bir yerde tanımlayın:

| Değişken | Açıklama |
|----------|----------|
| `BASE_DASHBOARD_API_KEY` | `x-api-key` (sadece server) |
| `BASEHUB_APP_URL` veya `BASE_APP_NOTIFICATIONS_APP_URL` | Dashboard’daki tam uygulama URL’si |

İstemci bundle’ına **eklemeyin**.

---

## Mini kontrol listesi

- [ ] Dashboard’da BaseHub URL’si doğru kayıtlı
- [ ] API anahtarı sadece backend / gizli ortamda
- [ ] Başlık ≤ 30, mesaj ≤ 200 karakter
- [ ] Büyük kitlede sayfalama + istek bölme + dakikada ≤ 10 istek
- [ ] Web kullanıcılarına bu kanaldan bildirim **beklenmediğini** ürün metninde netleştirin

---

## İlgili bağlantılar

- [Base — Notifications](https://docs.base.org/apps/technical-guides/base-notifications)
- [Base Dashboard](https://dashboard.base.org)
