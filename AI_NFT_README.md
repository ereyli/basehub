# AI NFT Launchpad

Bu proje, kullanıcıların AI destekli görsel üretimi yapıp bunları NFT olarak mint edebileceği bir launchpad uygulamasıdır.

## 🚀 Özellikler

- **AI Görsel Üretimi**: Google Studio API kullanarak prompt tabanlı görsel üretimi
- **IPFS Depolama**: Pinata üzerinden merkezi olmayan depolama
- **NFT Minting**: Base network üzerinde NFT mint etme
- **Modern UI**: React ve Tailwind CSS ile responsive tasarım
- **Wallet Entegrasyonu**: Wagmi ile MetaMask ve diğer wallet'lar

## 🛠️ Teknolojiler

- **Frontend**: React, Vite, Tailwind CSS
- **Blockchain**: Base Network, Wagmi, Viem
- **AI**: Google Studio API
- **Storage**: Pinata IPFS
- **Smart Contracts**: Solidity, OpenZeppelin

## 📁 Proje Yapısı

```
src/
├── components/AINFT/
│   ├── PromptInput.jsx      # Prompt giriş bileşeni
│   ├── ImagePreview.jsx     # Görsel önizleme bileşeni
│   └── MintButton.jsx       # NFT mint butonu
├── hooks/
│   └── useAINFTMinting.js   # NFT minting hook'u
├── pages/
│   └── AINFTLaunchpad.jsx   # Ana sayfa
├── utils/
│   ├── aiImageGenerator.js  # AI görsel üretimi
│   └── pinataIPFS.js        # IPFS yükleme
└── config/
    └── aiNFT.js             # Konfigürasyon
```

## ⚙️ Kurulum

1. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

2. **Gerekli paketleri yükleyin:**
   ```bash
   npm install @google/generative-ai @pinata/sdk
   ```

3. **Konfigürasyonu ayarlayın:**
   `src/config/aiNFT.js` dosyasında API anahtarlarını güncelleyin:
   ```javascript
   export const AI_NFT_CONFIG = {
     GOOGLE_STUDIO_API_KEY: 'your-api-key',
     PINATA_API_KEY: 'your-pinata-key',
     PINATA_SECRET_KEY: 'your-pinata-secret',
     // ... diğer ayarlar
   };
   ```

4. **Geliştirme sunucusunu başlatın:**
   ```bash
   npm run dev
   ```

## 🔧 Konfigürasyon

### API Anahtarları

- **Google Studio API**: AI görsel üretimi için
- **Pinata API**: IPFS depolama için

### Smart Contract

AI NFT Collection contract'ı deploy edildikten sonra `src/config/aiNFT.js` dosyasında `AI_NFT_CONTRACT_ADDRESS` değerini güncelleyin.

## 🎯 Kullanım

1. **Wallet Bağlayın**: MetaMask veya diğer uyumlu wallet'ı bağlayın
2. **Prompt Girin**: İstediğiniz görseli detaylı bir şekilde açıklayın
3. **Görsel Üretin**: AI görsel üretimini başlatın
4. **NFT Mint Edin**: Görseli IPFS'e yükleyip NFT olarak mint edin

## 📝 API Referansı

### AI Image Generator

```javascript
import { generateAIImage } from './utils/aiImageGenerator';

const imageData = await generateAIImage('A futuristic cityscape');
```

### Pinata IPFS

```javascript
import { uploadImageToIPFS, createAndUploadNFTMetadata } from './utils/pinataIPFS';

const imageUrl = await uploadImageToIPFS(imageBlob, 'my-image.png');
const metadataUrl = await createAndUploadNFTMetadata(imageUrl, prompt, address);
```

### NFT Minting Hook

```javascript
import { useAINFTMinting } from './hooks/useAINFTMinting';

const {
  generateImage,
  uploadToIPFS,
  mintNFT,
  isGenerating,
  isMinting,
  error,
  success
} = useAINFTMinting();
```

## 🔒 Güvenlik

- API anahtarları client-side'da saklanmaktadır (production'da environment variables kullanın)
- Tüm işlemler kullanıcının wallet'ı üzerinden yapılır
- IPFS'te depolanan veriler merkezi olmayan yapıdadır

## 🚀 Deployment

1. **Smart Contract Deploy**: UserNFTCollection contract'ını Base network'e deploy edin
2. **Contract Address**: Deploy edilen contract adresini config dosyasına ekleyin
3. **Frontend Deploy**: Vercel, Netlify veya diğer platformlara deploy edin

## 📄 Lisans

MIT License

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📞 İletişim

Proje hakkında sorularınız için issue açabilir veya iletişime geçebilirsiniz.
