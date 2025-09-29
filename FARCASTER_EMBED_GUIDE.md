# Farcaster Mini App Embed Template

Bu template, Farcaster Mini App'ler için gerekli embed meta taglarını içerir.

## Gerekli Dosyalar

1. **icon.png** - 32x32px favicon
2. **image.png** - 600x400px minimum, 3:2 aspect ratio embed görseli
3. **splash.png** - Uygulama başlatılırken gösterilecek splash screen

## HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover">
  <meta name="format-detection" content="telephone=no">
  <meta name="msapplication-tap-highlight" content="no">
  <meta name="theme-color" content="#3b82f6">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Your App Name">
  <title>Your App Name - Farcaster Mini App</title>
  <meta name="description" content="Your app description">
  <link rel="icon" type="image/png" href="/icon.png" />
  <link rel="apple-touch-icon" href="/icon.png" />
  
  <!-- Farcaster Mini App Embed Meta Tags -->
  <meta name="fc:miniapp" content='{"version":"1","imageUrl":"https://your-domain.com/image.png","button":{"title":"🎮 Play Your App","action":{"type":"launch_miniapp","url":"https://your-domain.com","name":"Your App Name","splashImageUrl":"https://your-domain.com/splash.png","splashBackgroundColor":"#3b82f6"}}}' />
  <!-- For backward compatibility -->
  <meta name="fc:frame" content='{"version":"1","imageUrl":"https://your-domain.com/image.png","button":{"title":"🎮 Play Your App","action":{"type":"launch_frame","url":"https://your-domain.com","name":"Your App Name","splashImageUrl":"https://your-domain.com/splash.png","splashBackgroundColor":"#3b82f6"}}}' />
  
  <!-- Open Graph Meta Tags for Social Sharing -->
  <meta property="og:title" content="Your App Name - Description" />
  <meta property="og:description" content="Your app description for social sharing" />
  <meta property="og:image" content="https://your-domain.com/image.png" />
  <meta property="og:url" content="https://your-domain.com" />
  <meta property="og:type" content="website" />
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Your App Name - Description" />
  <meta name="twitter:description" content="Your app description for social sharing" />
  <meta name="twitter:image" content="https://your-domain.com/image.png" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

## Değiştirilmesi Gerekenler

1. **Your App Name** → Uygulama adınız
2. **Your app description** → Uygulama açıklamanız
3. **https://your-domain.com** → Domain adresiniz
4. **🎮 Play Your App** → Buton metni
5. **#3b82f6** → Tema renginiz

## Embed Gereksinimleri

### Image Format
- **Desteklenen formatlar**: PNG, JPG, GIF, WebP
- **Önerilen**: PNG (en iyi uyumluluk)
- **Aspect ratio**: 3:2
- **Minimum boyut**: 600x400px
- **Maksimum boyut**: 3000x2000px
- **Dosya boyutu**: 10MB'dan küçük
- **URL uzunluğu**: 1024 karakterden kısa

### Button Title
- Net call-to-action kullanın
- Emoji kullanabilirsiniz
- Kısa ve açıklayıcı olsun

### Splash Screen
- Uygulama başlatılırken gösterilir
- PNG formatında olmalı
- Arka plan rengi belirtilebilir

## Test Etme

1. [Warpcast Embed Tool](https://warpcast.com/~/developers/embeds) kullanarak test edin
2. URL'nizi girin ve embed'in doğru göründüğünü kontrol edin
3. "Embed Valid" ✅ işareti görmelisiniz

## Sorun Giderme

- **Embed Valid ❌**: JSON formatını kontrol edin
- **Preview not available**: Image URL'lerini kontrol edin
- **Button çalışmıyor**: URL'lerin doğru olduğundan emin olun

## Örnek Kullanım

```javascript
// Dinamik embed oluşturma
const miniapp = {
  version: "1",
  imageUrl: "https://your-domain.com/dynamic-image.png",
  button: {
    title: "🚀 Start Game",
    action: {
      type: "launch_miniapp",
      url: "https://your-domain.com/game",
      name: "Your Game",
      splashImageUrl: "https://your-domain.com/splash.png",
      splashBackgroundColor: "#ff6b6b"
    }
  }
}

// Meta tag olarak ekleme
document.querySelector('meta[name="fc:miniapp"]').setAttribute('content', JSON.stringify(miniapp));
```
