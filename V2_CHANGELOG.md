# 🔄 AI Art Collection V2 - Changelog

## 📅 **Versiyon 2.0 - Quantity-Based Tiered Pricing**

---

## ✨ **YENİ ÖZELLİKLER**

### **1. Quantity-Based Pricing (Miktar Bazlı Fiyatlandırma)**

#### **Eski Model (V1):**
```
20 NFT × 0.001 ETH = 0.020 ETH ❌
```

#### **Yeni Model (V2):**
```
20 NFT = 0.001 ETH (tek seferlik) ✅
```

**Fiyat Tablosu:**
| Miktar | Ücret | Değişim |
|--------|-------|---------|
| 0-1000 | 0.001 ETH | Base tier |
| 1001-2000 | 0.002 ETH | 2x |
| 2001-4000 | 0.004 ETH | 4x |
| 4001-8000 | 0.008 ETH | 8x |
| 8001-10000 | 0.01 ETH | 10x (cap) |

---

### **2. previewFee() Fonksiyonu**

Frontend'in kullanıcıya ücret gösterebilmesi için yeni fonksiyon:

```solidity
function previewFee(uint256 quantity) public pure returns (uint256 fee)
```

**Örnek Kullanım:**
```javascript
const fee = await contract.previewFee(20);
// Returns: 1000000000000000 (0.001 ETH)

const fee2 = await contract.previewFee(5000);
// Returns: 8000000000000000 (0.008 ETH)
```

---

### **3. Otomatik Fee Transfer**

Artık her mint işleminde ücret **anında owner'a** aktarılır:

```solidity
function _transferFeeToOwner(uint256 amount) internal {
    if (amount > 0) {
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Fee transfer failed");
    }
}
```

**Avantajlar:**
- ✅ Manuel withdraw gerekmiyor
- ✅ Gas tasarrufu
- ✅ Anında likidite

---

### **4. Max Batch Limit Artırıldı**

#### **Eski:**
```solidity
require(quantity <= 20, "Cannot mint more than 20 at once");
```

#### **Yeni:**
```solidity
require(quantity <= 10000, "Cannot mint more than 10000 at once");
```

**Neden?**
- Büyük koleksiyonlar için daha esnek
- Quantity bazlı fiyatlandırma ile uyumlu
- Gas efficient

---

## 🗑️ **KALDIRILAN ÖZELLİKLER**

### **1. mintPrice State Variable**
```solidity
// ❌ KALDIRILDI
uint256 public mintPrice;
```
**Neden?** Artık formül bazlı hesaplama var (`previewFee`)

### **2. setMintPrice() Fonksiyonu**
```solidity
// ❌ KALDIRILDI
function setMintPrice(uint256 newPrice) external onlyOwner
```
**Neden?** Fiyat tier sistemi sabit (0.001, 0.002, 0.004, 0.008, 0.01)

### **3. Constructor'daki _mintPrice Parametresi**
```solidity
// ❌ ESKI
constructor(string memory name_, string memory symbol_, uint256 _mintPrice)

// ✅ YENİ
constructor(string memory name_, string memory symbol_)
```

---

## 🔧 **DEĞİŞEN FONKSIYONLAR**

### **mintWithTokenURI()**

#### **Eski:**
```solidity
require(msg.value >= mintPrice, "Insufficient payment");
```

#### **Yeni:**
```solidity
uint256 fee = previewFee(1);
require(msg.value >= fee, "Insufficient payment");
_transferFeeToOwner(msg.value); // Otomatik transfer
```

---

### **mintBatch()**

#### **Eski:**
```solidity
require(quantity <= 20, "Cannot mint more than 20 at once");
require(msg.value >= mintPrice * quantity, "Insufficient payment");
```

#### **Yeni:**
```solidity
require(quantity <= 10000, "Cannot mint more than 10000 at once");
uint256 fee = previewFee(quantity);
require(msg.value >= fee, "Insufficient payment");
_transferFeeToOwner(msg.value); // Otomatik transfer
```

---

## 📊 **MALİYET KARŞILAŞTIRMASI**

| Senaryo | V1 (Eski) | V2 (Yeni) | Tasarruf |
|---------|-----------|-----------|----------|
| 20 NFT | 0.020 ETH | 0.001 ETH | **95% ⬇️** |
| 100 NFT | 0.100 ETH | 0.001 ETH | **99% ⬇️** |
| 1000 NFT | 1.000 ETH | 0.001 ETH | **99.9% ⬇️** |
| 1500 NFT | 1.500 ETH | 0.002 ETH | **99.8% ⬇️** |
| 5000 NFT | 5.000 ETH | 0.008 ETH | **99.8% ⬇️** |
| 10000 NFT | 10.000 ETH | 0.01 ETH | **99.9% ⬇️** |

---

## 🎯 **FRONTEND DEĞİŞİKLİKLERİ**

### **src/config/aiNFT.js**

#### **Eklenen:**
```javascript
// Tier pricing configuration
TIER_PRICING: {
  '0-1000': '0.001',
  '1001-2000': '0.002',
  '2001-4000': '0.004',
  '4001-8000': '0.008',
  '8001-10000': '0.01'
},

MAX_BATCH_MINT: 10000,

// Helper functions
calculateMintFee(quantity)
calculateMintFeeWei(quantity)
getTierInfo(quantity)
```

#### **Kaldırılan:**
```javascript
MINT_FEE: '0.001',
MINT_FEE_WEI: '1000000000000000',
getMintFee()
getMintFeeWei()
```

---

## 🚀 **DEPLOY TALİMATLARI**

### **Constructor Parametreleri:**

#### **Eski (V1):**
```
"AI Art Collection", "AINFT", 1000000000000000
```

#### **Yeni (V2):**
```
"AI Art Collection", "AINFT"
```

**Daha basit!** Artık mintPrice parametresi yok.

---

## 📝 **MİGRASYON ADIMLARI**

### **1. Smart Contract:**
- [ ] `AIArtCollectionV2.sol` dosyasını Remix'e kopyala
- [ ] Base Mainnet'te deploy et
- [ ] Contract address'i kaydet

### **2. Frontend Config:**
- [x] `src/config/aiNFT.js` güncellenmiş
- [ ] Yeni contract address'i `AI_NFT_CONTRACT_ADDRESS`'e ekle
- [x] Helper fonksiyonlar hazır

### **3. Hook Güncellemesi:**
- [ ] `useAINFTMinting.js` hook'unu güncelle
- [ ] `previewFee()` fonksiyonunu entegre et
- [ ] Quantity validation'ı 10000'e çıkar

### **4. UI Güncellemesi:**
- [ ] `AINFTLaunchpad.jsx` quantity input max'i 10000 yap
- [ ] Fee display'i dinamik yap (tier gösterimi)
- [ ] "Total cost = X ETH" yazısını kaldır (artık quantity ile çarpmıyor)

---

## ⚠️ **DİKKAT EDİLMESİ GEREKENLER**

### **1. ABI Güncellemesi:**
Yeni contract deploy ettikten sonra ABI'ı güncellemeyi unutmayın:
- `previewFee()` fonksiyonu eklenmiş
- `mintPrice` state variable kaldırılmış
- `setMintPrice()` fonksiyonu kaldırılmış

### **2. Backward Compatibility:**
V1 contract ile çalışan dApp'ler V2'ye geçemez (farklı ABI). Yeni contract address gerekli.

### **3. Test Senaryoları:**
- [ ] 1 NFT mint (0.001 ETH)
- [ ] 20 NFT mint (0.001 ETH)
- [ ] 1500 NFT mint (0.002 ETH)
- [ ] 5000 NFT mint (0.008 ETH)
- [ ] 10000 NFT mint (0.01 ETH)
- [ ] Owner balance'ının otomatik arttığını kontrol et

---

## 🎉 **AVANTAJLAR**

| Özellik | Açıklama | Impact |
|---------|----------|--------|
| 💰 **Maliyet** | Toplu mint çok daha ucuz | 95-99% tasarruf |
| ⚡ **Hız** | Otomatik fee transfer | Daha hızlı settlement |
| 📊 **Şeffaflık** | previewFee() ile ön hesaplama | Daha iyi UX |
| 🚀 **Skalabilite** | 10000 NFT tek işlemde | Büyük koleksiyonlar |
| 🎯 **Basitlik** | Karmaşık hesaplama yok | Daha az hata |

---

## 📚 **KAYNAKLAR**

- **Smart Contract:** `contracts/AIArtCollectionV2.sol`
- **Deploy Guide:** `DEPLOY_V2_INSTRUCTIONS.md`
- **Config:** `src/config/aiNFT.js`

---

**Deploy sonrası contract address'i paylaşın!** 🚀

