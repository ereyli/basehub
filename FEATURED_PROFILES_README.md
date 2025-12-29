# Featured Profiles & Follow System

Farcaster kullanıcılarının profil kaydedip birbirlerini takip edebileceği sistem.

## 🎯 Özellikler

### 1. Profil Kaydı (Ücretli)
- **Günlük**: 0.2 USDC - 1 gün featured
- **Haftalık**: 1.0 USDC - 7 gün featured  
- **Aylık**: 6.0 USDC - 30 gün featured
- x402 ödeme sistemi ile Base network'te ödeme
- Yeni kayıtlar listenin en üstüne gelir
- Kullanıcı açıklama yazabilir (karşılıklı takip için)

### 2. Takip Sistemi
- Kullanıcılar birbirlerini takip edebilir
- **Karşılıklı takip** otomatik tespit edilir
- Mutual follow sayısı gösterilir
- Takipçi sayısı güncellenir

### 3. Liste Sıralaması
- Yeni kayıtlar en üstte (position: highest)
- Aktif profiller gösterilir
- Süresi dolan profiller otomatik deaktif olur

## 📋 Kurulum

### 1. Supabase Database Setup

```sql
-- Supabase SQL Editor'da çalıştır:
-- featured-profiles-schema.sql dosyasının içeriğini kopyala-yapıştır
```

### 2. Environment Variables

```bash
# .env dosyasına ekle:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
CDP_API_KEY_ID=your-cdp-key-id (opsiyonel)
CDP_API_KEY_SECRET=your-cdp-key-secret (opsiyonel)
```

### 3. API Endpoints

#### Profil Kaydı (x402 Ödeme)
- `POST /api/x402-featured-profile/daily` - 0.2 USDC
- `POST /api/x402-featured-profile/weekly` - 1.0 USDC
- `POST /api/x402-featured-profile/monthly` - 6.0 USDC

#### Profil Listesi
- `GET /api/featured-profiles` - Tüm aktif profiller
- `GET /api/featured-profiles/:fid` - Tek profil

#### Takip Sistemi
- `POST /api/follow` - Takip et
- `DELETE /api/follow` - Takibi bırak
- `GET /api/follow/followers/:fid` - Takipçiler
- `GET /api/follow/following/:fid` - Takip edilenler
- `GET /api/follow/check/:followerFid/:followingFid` - Takip durumu

## 🎮 Kullanım

### Frontend

```jsx
import { useFeaturedProfiles } from '../hooks/useFeaturedProfiles'

const { 
  registerProfile,      // Profil kaydet
  getFeaturedProfiles, // Profilleri listele
  followUser,          // Takip et
  unfollowUser,        // Takibi bırak
  checkFollowStatus    // Takip durumu kontrol et
} = useFeaturedProfiles()

// Profil kaydet
await registerProfile(
  { description: 'Let\'s do mutual follows!' },
  'monthly' // 'daily' | 'weekly' | 'monthly'
)

// Profilleri listele
const profiles = await getFeaturedProfiles()

// Takip et
await followUser(profileFid)
```

### Sayfa Erişimi

```
/featured-profiles
```

## 💰 Fiyatlandırma

| Süre | Fiyat | Günlük Maliyet |
|------|-------|----------------|
| Daily | 0.2 USDC | 0.2 USDC/gün |
| Weekly | 1.0 USDC | ~0.14 USDC/gün |
| Monthly | 6.0 USDC | 0.2 USDC/gün |

**Not**: Aylık abonelik günlük ile aynı günlük maliyete sahip, ama daha uzun süre featured kalırsınız!

## 🔄 Karşılıklı Takip Mantığı

1. Kullanıcı A, Kullanıcı B'yi takip eder
2. Sistem kontrol eder: B, A'yı zaten takip ediyor mu?
3. **Evet** → `is_mutual: true` (Karşılıklı takip!)
4. **Hayır** → `is_mutual: false` (Tek yönlü takip)
5. Her iki kullanıcının da `mutual_follows_count` güncellenir

## 📊 Veritabanı Tabloları

### `featured_profiles`
- Profil bilgileri
- Subscription detayları
- Takip istatistikleri
- Expiration date

### `follows`
- Takip ilişkileri
- Mutual follow flag
- Timestamp

## 🚀 Özellikler

✅ x402 ödeme entegrasyonu  
✅ Günlük/Haftalık/Aylık seçenekleri  
✅ Otomatik expiration  
✅ Karşılıklı takip tespiti  
✅ Real-time takipçi sayıları  
✅ Açıklama alanı (mutual follow için)  
✅ Liste sıralaması (yeni kayıtlar üstte)  

## 📝 Notlar

- Profil kaydı için Farcaster bağlantısı gerekli
- Ödeme Base network'te yapılır
- Süresi dolan profiller otomatik deaktif olur
- Karşılıklı takip otomatik tespit edilir ve bildirim gönderilir

