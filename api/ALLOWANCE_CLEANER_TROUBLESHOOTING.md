# Allowance Cleaner API - Troubleshooting Guide (Etherscan V2)

> **Important**: As of August 2025, Etherscan API V2 uses a **single API key** for all chains!
> One key works for Ethereum, Base, Polygon, Arbitrum, Optimism, BSC, Avalanche, and 50+ more chains.

## ❌ Problem: "NOTOK" API Hatası

### Belirti
Logda şu mesajları görüyorsunuz:
```
📊 API Response: { status: '0', message: 'NOTOK', resultLength: 0 }
⚠️ API returned NOTOK or no events
```

### Olası Nedenler ve Çözümler

#### 1. API Key Eksik veya Geçersiz

**Kontrol Et:**
```bash
# Environment variables'ları kontrol et
echo $ETHERSCAN_API_KEY  # Tek key yeterli!
echo $ALCHEMY_API_KEY
```

**Çözüm:**
1. **Etherscan V2** API key'inizi alın (tek key tüm chainler için):
   - https://etherscan.io/myapikey

2. Environment variables'a ekleyin:
```bash
# .env dosyasına ekleyin
ETHERSCAN_API_KEY=your_v2_key_here  # Tek key yeterli!
ALCHEMY_API_KEY=your_alchemy_key_here
```

3. Sunucuyu yeniden başlatın

**Test Et (V2 Format):**
```bash
# API key'i test et - V2 format (chainid parametresi ile)
curl "https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae&tag=latest&apikey=YOUR_API_KEY"

# Başarılı yanıt:
# {"status":"1","message":"OK","result":"..."}

# Başarısız yanıt:
# {"status":"0","message":"NOTOK","result":"Invalid API Key"}

# Base için test:
curl "https://api.etherscan.io/v2/api?chainid=8453&module=account&action=balance&address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1&tag=latest&apikey=YOUR_API_KEY"
```

#### 2. Eski V1 API Key Kullanıyorsunuz

**Belirti:**
```
{"status":"0","message":"NOTOK","result":"You are using a deprecated V1 endpoint, switch to Etherscan API V2."}
```

**Çözüm:**
- Etherscan hesabınıza gidin: https://etherscan.io/myapikey
- **Yeni bir V2 API key** oluşturun (eski V1 key'ler çalışmaz)
- V2 key'ler Ağustos 2025'ten sonra oluşturulan key'lerdir

**V1 vs V2 Farkı:**
```bash
# ❌ Eski V1 format (artık çalışmaz):
https://api.basescan.org/api?module=account&action=balance&...

# ✅ Yeni V2 format (tek endpoint, chainid parametresi):
https://api.etherscan.io/v2/api?chainid=8453&module=account&action=balance&...
```

#### 3. Yanlış Chain-Specific Key Kullanıyorsunuz

**Belirti:**
```
"Invalid API Key" - keys from other chains like Polygonscan/Arbiscan are not valid for V2
```

**Çözüm:**
- ❌ **Basescan, Polygonscan, Arbiscan key'leri artık gerekmiyor**
- ✅ Sadece **Etherscan V2 key** kullanın (tüm chainler için)

```bash
# Eski yaklaşım (artık gerekmiyor):
BASESCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
ARBISCAN_API_KEY=...

# Yeni yaklaşım (tek key yeterli):
ETHERSCAN_API_KEY=...  # Tüm chainler için!
```

---

## ❌ Problem: Hiç Approval Bulunamıyor

### Belirti
```
✅ Scan completed: Found 0 active allowances
```

### Olası Nedenler ve Çözümler

#### 1. Cüzdanda Gerçekten Approval Yok

**Kontrol Et:**
- Revoke.cash'te kontrol edin: https://revoke.cash
- Farklı bir cüzdan deneyin (DeFi kullanıcısı)

**Test Cüzdanlar:**
```javascript
// Bilinen aktif approval'lı cüzdanlar:
const TEST_WALLETS = {
  // Vitalik (Ethereum)
  ethereum: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  
  // Bilinen DeFi kullanıcısı (Base)
  base: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
}
```

#### 2. Yanlış Network Seçildi

**Belirti:**
- Ethereum'da approval var ama Base'de tarıyorsunuz

**Çözüm:**
```javascript
// Doğru network'ü seçin
const result = await scanAllowances('ethereum') // veya 'base', 'polygon', etc.
```

#### 3. API Veri Çekemiyor (NOTOK hatası)

**Kontrol Et:**
- API key'ler doğru mu?
- Rate limit aşıldı mı?

**Çözüm:**
- Yukarıdaki "NOTOK API Hatası" bölümüne bakın

#### 4. Sadece Common Spenders Kontrol Ediliyor

**Belirti:**
```
⚠️ Etherscan API didn't provide approval events
ℹ️ Will check common spenders only (limited but functional scan)
```

**Anlam:**
- API'den approval event'leri çekilemedi
- Sadece bilinen spender'lar (Uniswap, 1inch, etc.) kontrol ediliyor
- Bazı approval'ları kaçırabilir

**Çözüm:**
1. API key'leri düzeltin
2. Veya manuel olarak approval'ları kontrol edin (on-chain)

---

## ❌ Problem: RPC 400 Hataları

### Belirti
```
⚠️ RPC chunk 1 failed: 400
⚠️ RPC chunk 2 failed: 400
```

### Neden
- Alchemy/RPC provider query limitine takıldı
- eth_getLogs çağrısı çok büyük

### Çözüm
✅ **Artık RPC fallback kullanılmıyor!**
- API'den veri çekilemezse, common spenders kullanılıyor
- Bu daha hızlı ve güvenilir

**Eğer eski kod kullanıyorsanız:**
```javascript
// RPC fallback'i kaldırın veya devre dışı bırakın
if (!apiWorked) {
  console.log('Will use common spenders only')
  // await fetchApprovalEventsViaRPC(...) // ❌ Kaldırın
}
```

---

## ❌ Problem: Çok Yavaş Tarama

### Belirti
- Scan 30+ saniye sürüyor
- Timeout oluyor

### Olası Nedenler

#### 1. Çok Fazla Token

**Normal:**
- 50+ token varsa 20-30 saniye sürebilir
- Her token için allowance kontrol edilmeli

**Çözüm:**
- Beklenen davranış, optimize edilmesi gerekmiyor
- Veya pagination ekleyin (ilk 10 token gibi)

#### 2. Rate Limiting

**Belirti:**
- Her API call arası 200ms+ bekliyor

**Çözüm:**
```javascript
// Rate limit'i düşürün (PRO plan için)
const RATE_LIMITS = {
  etherscan: 10,    // Free: 5, PRO: 10-15
}
```

#### 3. Çok Fazla Sayfa

**Çözüm:**
```javascript
// Sayfa limitini düşürün
for (let page = 1; page <= 3; page++) {  // 10'dan 3'e düşür
  // ...
}
```

---

## 🔍 Debug Komutları

### 1. API Key Test

```bash
# Etherscan API key test
curl "https://api.etherscan.io/api?module=account&action=balance&address=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae&tag=latest&apikey=YOUR_KEY"

# Basescan API key test
curl "https://api.basescan.org/api?module=account&action=balance&address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1&tag=latest&apikey=YOUR_KEY"
```

### 2. Token Transfer Test

```bash
# Test: Bir cüzdanın token transferlerini çek
curl "https://api.etherscan.io/api?module=account&action=tokentx&address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=YOUR_KEY"
```

### 3. Approval Event Test

```bash
# Test: Bir cüzdanın approval event'lerini çek
WALLET="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
OWNER_TOPIC="0x000000000000000000000000${WALLET:2}"  # Remove 0x and pad
APPROVAL_TOPIC="0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"

curl "https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${APPROVAL_TOPIC}&topic1=${OWNER_TOPIC}&apikey=YOUR_KEY"
```

### 4. Log Analizi

```javascript
// API'den gelen yanıtı konsola yazdır
console.log('📊 Full API Response:', JSON.stringify(logsData, null, 2))

// API key'i kontrol et
console.log('🔑 Using API key:', network.apiKey.substring(0, 10) + '...')

// Network bilgilerini kontrol et
console.log('🌐 Network config:', {
  name: network.name,
  apiUrl: network.apiUrl,
  hasApiKey: !!network.apiKey
})
```

---

## ✅ Başarılı Yanıt Örnekleri

### Token Transfer (tokentx)
```json
{
  "status": "1",
  "message": "OK",
  "result": [
    {
      "blockNumber": "12345678",
      "timeStamp": "1234567890",
      "hash": "0x...",
      "from": "0x...",
      "contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "to": "0x...",
      "value": "1000000",
      "tokenName": "USD Coin",
      "tokenSymbol": "USDC",
      "tokenDecimal": "6"
    }
  ]
}
```

### Approval Events (getLogs)
```json
{
  "status": "1",
  "message": "OK",
  "result": [
    {
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "topics": [
        "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
        "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045",
        "0x0000000000000000000000001111111254eeb25477b68fb85ed929f73a960582"
      ],
      "data": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "blockNumber": "0xabc123",
      "transactionHash": "0x..."
    }
  ]
}
```

---

## 📋 Checklist: API Çalışmıyor

- [ ] API key'ler environment variables'a eklendi mi?
- [ ] API key'ler doğru chain için mi? (Etherscan ≠ Basescan)
- [ ] API key aktif mi? (5-10 dakika beklediniz mi?)
- [ ] Rate limit aşıldı mı? (Birkaç dakika bekleyin)
- [ ] İnternet bağlantısı var mı?
- [ ] Sunucu yeniden başlatıldı mı? (env değişikliği sonrası)
- [ ] Test wallet'ı denendi mi? (approval'ı olduğu bilinen)
- [ ] Log'lar okundu mu? (Detaylı hata mesajları)
- [ ] curl ile API test edildi mi?
- [ ] Doğru network seçildi mi?

---

## 🆘 Hala Çalışmıyor?

### Minimal Test

```javascript
// Basit bir test yap
async function testAPI() {
  const API_KEY = 'YOUR_ETHERSCAN_API_KEY'
  const WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' // Vitalik
  
  // Test 1: Balance check (basit)
  const balanceUrl = `https://api.etherscan.io/api?module=account&action=balance&address=${WALLET}&tag=latest&apikey=${API_KEY}`
  const balance = await fetch(balanceUrl).then(r => r.json())
  console.log('Balance test:', balance)
  
  // Test 2: Token transfers (orta)
  const tokentxUrl = `https://api.etherscan.io/api?module=account&action=tokentx&address=${WALLET}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${API_KEY}`
  const tokentx = await fetch(tokentxUrl).then(r => r.json())
  console.log('Tokentx test:', tokentx)
  
  // Test 3: Logs (zor)
  const ownerTopic = '0x000000000000000000000000' + WALLET.slice(2).toLowerCase()
  const approvalTopic = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
  const logsUrl = `https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${approvalTopic}&topic1=${ownerTopic}&apikey=${API_KEY}`
  const logs = await fetch(logsUrl).then(r => r.json())
  console.log('Logs test:', logs)
}
```

### Common Spenders Modu

**Eğer hiçbir şey çalışmıyorsa:**
```javascript
// API olmadan çalışır (sınırlı fonksiyon)
// Sadece bilinen spender'ları (Uniswap, 1inch, etc.) kontrol eder

const result = await scanAllowances(walletAddress, 'ethereum')
// Bazı approval'ları bulacak ama hepsini değil
```

Bu mod:
- ✅ API key gerektirmez
- ✅ Hızlıdır
- ✅ Bilinen protokoller için çalışır
- ❌ Bilinmeyen/yeni spender'ları kaçırır

---

## 📞 Destek

Hala çalışmıyorsa:

1. **Log'ları toplayın:**
   - Tüm console output
   - API response'ları
   - Error messages

2. **Sistemi test edin:**
   - curl komutları ile API'yi test edin
   - Revoke.cash'te aynı cüzdanı kontrol edin

3. **İletişim:**
   - GitHub issue açın
   - Log'ları ve test sonuçlarını ekleyin
   - Kullandığınız chain ve cüzdan adresini belirtin

---

## 🎯 Özet: En Yaygın Sorunlar

| Sorun | Çözüm |
|-------|-------|
| "NOTOK" hatası | API key ekle/düzelt |
| 0 approval bulundu | Doğru network/cüzdan seç |
| Rate limit | Bekle veya PRO plan al |
| Çok yavaş | Normal (50+ token için) |
| RPC 400 | Güncellenmiş kodu kullan |
| API key çalışmıyor | Aktifleşmesini bekle (5-10 dk) |

