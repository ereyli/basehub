# 🚀 AI Art Collection V2 - Yeni Fiyatlandırma Modeli

## 📋 **Fiyatlandırma Tablosu**

| Adet Aralığı | Tek Seferlik Ücret | Açıklama |
|--------------|-------------------|----------|
| 0-1000 | 0.001 ETH | İlk tier |
| 1001-2000 | 0.002 ETH | 2. tier |
| 2001-4000 | 0.004 ETH | 3. tier |
| 4001-8000 | 0.008 ETH | 4. tier |
| 8001-10000 | 0.01 ETH | Maksimum (cap) |

### **✨ ÖNEMLİ ÖZELLİKLER:**

✅ **Quantity önemli değil:** 20 NFT de mint etseniz, 100 NFT de, **aynı tier fiyatını** ödersiniz!
✅ **Tek işlemde max 10,000 NFT** mint edilebilir
✅ **Ücret anında owner'a aktarılır** (her mint'te otomatik)
✅ **`previewFee(qty)`** ile UI fiyatı önceden hesaplayabilir
✅ **Eski mintPrice kaldırıldı** (artık formül bazlı)

---

## 🎯 **Örnekler:**

### **Senaryo 1: 20 NFT Mint**
```
Quantity: 20 (0-1000 tier)
Fee: 0.001 ETH (sabit)
✅ 20 NFT = 0.001 ETH
```

### **Senaryo 2: 1500 NFT Mint**
```
Quantity: 1500 (1001-2000 tier)
Fee: 0.002 ETH (sabit)
✅ 1500 NFT = 0.002 ETH
```

### **Senaryo 3: 5000 NFT Mint**
```
Quantity: 5000 (4001-8000 tier)
Fee: 0.008 ETH (sabit)
✅ 5000 NFT = 0.008 ETH
```

### **Senaryo 4: 10000 NFT Mint (Max)**
```
Quantity: 10000 (8001-10000 tier - cap)
Fee: 0.01 ETH (sabit)
✅ 10000 NFT = 0.01 ETH
```

---

## 🔧 **Remix'te Deploy**

### **1. Contract Dosyası:**
`contracts/AIArtCollectionV2.sol`

### **2. Constructor Parametreleri:**

```solidity
name_: "AI Art Collection"
symbol_: "AINFT"
```

**Kopyala-Yapıştır İçin:**
```
"AI Art Collection","AINFT"
```

### **3. Compiler Ayarları:**
- Solidity Version: **0.8.19** veya üstü
- Optimization: Enabled (200 runs)

### **4. Deploy Network:**
- Network: **Base Mainnet**
- Chain ID: **8453**
- Environment: **Injected Provider - MetaMask**

---

## 📊 **Smart Contract Fonksiyonları**

### **Public Functions:**

#### ✅ `previewFee(uint256 quantity) → uint256`
Belirli bir quantity için mint ücretini hesaplar (wei cinsinden)

**Örnek:**
```solidity
previewFee(20) → 1000000000000000 (0.001 ETH)
previewFee(1500) → 2000000000000000 (0.002 ETH)
previewFee(5000) → 8000000000000000 (0.008 ETH)
previewFee(10000) → 10000000000000000 (0.01 ETH)
```

#### ✅ `mintWithTokenURI(address to, string tokenURI) payable → uint256`
Tek NFT mint eder (0.001 ETH)

#### ✅ `mintBatch(address to, string tokenURI, uint256 quantity) payable → uint256[]`
Toplu NFT mint eder (max 10,000)
- Ücret quantity'ye göre tier bazlı hesaplanır
- Ücret anında owner'a aktarılır

#### ✅ `totalSupply() → uint256`
Toplam mint edilen NFT sayısını döndürür

#### ✅ `contractURI() → string`
OpenSea collection metadata URI'sini döndürür

---

### **Owner-Only Functions:**

#### 🔐 `setContractURI(string contractURI)`
OpenSea collection metadata'sını ayarlar

#### 🔐 `setDefaultRoyalty(address receiver, uint96 feeNumerator)`
Royalty ayarlarını değiştirir (basis points: 500 = 5%)

#### 🔐 `withdraw()`
Acil durum fonksiyonu (normal mint'lerde otomatik transfer olduğu için nadiren gerekir)

---

## 💡 **Yeni Özellikler:**

### **1. Otomatik Fee Transfer:**
```solidity
// Her mint'te ücret anında owner'a aktarılır
_transferFeeToOwner(msg.value);
```

### **2. Quantity-Based Pricing:**
```solidity
// Quantity'ye göre fee hesaplama
function previewFee(uint256 quantity) public pure returns (uint256) {
    if (quantity <= 1000) return 0.001 ether;
    if (quantity <= 2000) return 0.002 ether;
    if (quantity <= 4000) return 0.004 ether;
    if (quantity <= 8000) return 0.008 ether;
    return 0.01 ether; // cap
}
```

### **3. Max Batch Limit:**
```solidity
require(quantity <= 10000, "Cannot mint more than 10000 at once");
```

---

## 📝 **Deploy Sonrası Checklist:**

- [ ] Contract address'i kopyala
- [ ] `src/config/aiNFT.js` dosyasını güncelle
- [ ] BaseScan'de contract'ı verify et
- [ ] `previewFee()` fonksiyonunu test et
- [ ] İlk mint'i yap (0.001 ETH ile 20 NFT)
- [ ] Owner balance'ının arttığını kontrol et

---

## 🎨 **Frontend Entegrasyonu:**

```javascript
import { readContract, writeContract } from '@wagmi/core';

// Fee önizlemesi
const fee = await readContract({
  address: CONTRACT_ADDRESS,
  abi: ABI,
  functionName: 'previewFee',
  args: [quantity]
});

console.log(`${quantity} NFT için fee: ${formatEther(fee)} ETH`);

// Mint işlemi
await writeContract({
  address: CONTRACT_ADDRESS,
  abi: ABI,
  functionName: 'mintBatch',
  args: [userAddress, tokenURI, quantity],
  value: fee
});
```

---

## 🔥 **Avantajları:**

| Özellik | Açıklama |
|---------|----------|
| 💰 **Maliyet Verimliliği** | Toplu mint çok daha ucuz (20 NFT = 0.001 ETH) |
| ⚡ **Hızlı Transfer** | Ücretler anında owner'a |
| 📊 **Şeffaf Fiyatlandırma** | `previewFee()` ile önceden hesaplama |
| 🚀 **Skalabilite** | Tek işlemde 10,000 NFT |
| 🎯 **Basitlik** | Karmaşık hesaplama yok |

---

## 🆚 **Eski vs Yeni Karşılaştırma:**

| Özellik | Eski (V1) | Yeni (V2) |
|---------|-----------|-----------|
| **20 NFT Mint** | 0.001 × 20 = 0.02 ETH | 0.001 ETH ✅ |
| **1500 NFT Mint** | 0.001 × 1500 = 1.5 ETH | 0.002 ETH ✅ |
| **Max Batch** | 20 NFT | 10,000 NFT ✅ |
| **Fee Transfer** | Manuel (withdraw) | Otomatik ✅ |
| **Fiyat Hesaplama** | Quantity × Price | Tier bazlı ✅ |
| **mintPrice** | Var (değiştirilebilir) | Yok (formül) ✅ |

---

## 🚀 **Hemen Deploy Et!**

1. **Remix'i aç:** https://remix.ethereum.org
2. **Contract'ı kopyala:** `AIArtCollectionV2.sol`
3. **Deploy et:** `"AI Art Collection","AINFT"`
4. **Contract address'i paylaş!** 

**Deploy ettikten sonra contract address'i buraya yapıştır! 👇**
