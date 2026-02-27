# basehub.fun: Manage Tool ve Analytics Neden Eksik?

## Durum

- **basehub-alpha.vercel.app** (eski domain): "Manage Tool" görünüyor, analytics (Trending Rank, Unique Users, Total Opens, Transactions) dolu.
- **basehub.fun** (yeni domain): Sadece "Embed Tool" ve "Manifests", Manage Tool yok; analytics Unranked / boş.

## Muhtemel sebep

Farcaster’da iki tür manifest var:

1. **Self-hosted manifest**  
   Sadece `https://yourdomain.com/.well-known/farcaster.json` dosyasını kendiniz yayınlıyorsunuz.  
   basehub.fun şu an böyle.

2. **Hosted manifest**  
   `/.well-known/farcaster.json` isteği Farcaster API’ye yönlendiriliyor; manifest Farcaster tarafından sunuluyor.  
   Eski domain (basehub-alpha.vercel.app) büyük ihtimalle bu yöntemle kayıtlı; bu yüzden Manage Tool ve tam analytics açılıyor.

Yani fark, **kayıt türü** (self-hosted vs hosted); basehub.fun tarafında bir “hata” olması şart değil, sadece hosted manifest kullanılmıyor.

## Ne yapmalı? (Manage Tool + dolu analytics için)

basehub.fun’u da **Farcaster Hosted Manifest** ile kaydetmek gerekiyor.

### Adımlar

1. **Farcaster Manifest Tool’a girin**  
   https://farcaster.xyz/~/developers/mini-apps/manifest

2. **basehub.fun için “Hosted Manifest” kurun**  
   - Domain olarak `basehub.fun` girin.  
   - Araç size bir **Hosted Manifest ID** verecek (örn. `1234567890`).

3. **Vercel’de redirect ekleyin**  
   Proje kökündeki `vercel.json` içine aşağıdaki `redirects` bloğunu ekleyin (veya mevcut `redirects` dizisine bu kuralı ekleyin).  
   **`HOSTED_MANIFEST_ID`** yerine adım 2’de aldığınız gerçek ID’yi yazın:

   ```json
   "redirects": [
     {
       "source": "/.well-known/farcaster.json",
       "destination": "https://api.farcaster.xyz/miniapps/hosted-manifest/HOSTED_MANIFEST_ID",
       "permanent": false
     }
   ]
   ```

4. **Deploy edin**  
   Deploy’dan sonra `https://basehub.fun/.well-known/farcaster.json` açıldığında Farcaster API’den yanıt gelmeli.

5. **Manifest içeriğini Farcaster’da güncelleyin**  
   Artık manifest’i kodda değil, Farcaster Developer Tools üzerinden (Manage Tool vb.) güncelliyorsunuz. Mevcut `public/.well-known/farcaster.json` içeriğinizi (name, iconUrl, homeUrl, accountAssociation vb.) oraya aynen taşıyın / orada düzenleyin.

Bu adımlardan sonra basehub.fun için de Manage Tool ve analytics’in (Trending Rank, Unique Users, Total Opens, Transactions) dolması beklenir.  
Eski domain’deki veriler otomatik taşınmaz; yeni trafik basehub.fun üzerinden biriktikçe yeni grafikler dolacaktır.

## Özet

- Sorun büyük ihtimalle **hosted vs self-hosted** farkı; basehub.fun’da “bir yerde hata” olmak zorunda değil.
- **Çözüm:** basehub.fun’u Hosted Manifest ile kaydedip `/.well-known/farcaster.json` için Vercel redirect’i eklemek ve manifest içeriğini Farcaster tarafında yönetmek.
