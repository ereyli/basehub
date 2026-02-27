# Yeni On-Chain Oyun Önerileri (BaseHub)

Mevcut oyunlar: **Coin Flip** (50/50), **Dice Roll** (1/36), **Lucky Number** (1/10), **Slot** (reel combo). Aynı mimariyle iki yeni oyun eklemek için öneriler ve uygulama adımları.

---

## Önerilen iki oyun

### 1. **Taş Kağıt Makas (Rock Paper Scissors)**

**Neden uygun**
- Herkes bilir; kuralları anlatmaya gerek yok.
- Tek seçim + tek rastgele sonuç → kontrat basit.
- Kazanma ihtimali 1/3, berabere 1/3, kaybetme 1/3 → net XP dağılımı.

**On-chain mantık**
- Kullanıcı seçim yapar: Rock (0), Paper (1), Scissors (2).
- Kontrat `blockhash` / VRF ile 0–2 arası rastgele seçim üretir.
- Sonuç: win / draw / lose; event veya return ile döner.
- Örnek fonksiyon: `playRPS(uint8 choice) payable` → `(bool isWin, bool isDraw, uint8 houseChoice)`.

**XP**
- Base: 150 XP (örnek).
- Kazanınca bonus: +600 XP (veya mevcut flip/dice oranına göre).
- Berabere: sadece base XP.

**Frontend**
- 3 büyük buton: 🪨 Taş, 📄 Kağıt, ✂️ Makas.
- Animasyon: 3–2–1 sayıp sonucu gösterme (win/draw/lose + house choice).
- Ses: mevcut `soundEffects.js` yapısına win/lose/click eklenebilir.

---

### 2. **Şans Çarkı (Spin the Wheel)**

**Neden uygun**
- Görsel ve paylaşılabilir; “çarkı çevirdim” hissi güçlü.
- Her oyunda mutlaka bir segment gelir → herkes XP alır, sadece miktar değişir.
- Kontrat tek rastgele sayı (segment index) döndürmek yeterli.

**On-chain mantık**
- Çark 6–8 segment: her segment farklı XP çarpanı veya sabit değer.
- Örnek segmentler: 50, 150, 200, 300, 500, 1000 XP.
- Fonksiyon: `spinWheel() payable` → `uint8 segmentIndex`.
- Frontend segment index’e göre XP’yi gösterir; asıl XP yine backend’de tx hash + segment bilgisiyle verilebilir.

**XP**
- Base + segment bonusu (segment index’e göre tablo).
- Jackpot segment (örn. 1000 XP) nadir olsun (ör. 1/8).

**Frontend**
- Dönen çark animasyonu; durunca kazandığı segment vurgulanır.
- “+XXX XP” popup’ı (mevcut flip/dice gibi).

---

## Mevcut mimariye uyum

| Adım | Flip/Dice/Lucky örneği | RPS | Wheel |
|------|------------------------|-----|--------|
| Kontrat | `playFlip(choice)`, `guessLuckyNumber(guess)` | `playRPS(choice)` | `spinWheel()` |
| ABI (frontend) | Tek `payable` fonksiyon | Tek `payable` fonksiyon | Tek `payable` fonksiyon |
| useTransactions | `sendFlipTransaction(side)` | `sendRPSTransaction(choice)` | `sendWheelTransaction()` |
| XP | addBonusXP(…, 'flip', isWin, …) | addBonusXP(…, 'rps', isWin, …) | addBonusXP veya segment’e göre miktar |
| Route | `/flip` | `/rps` | `/wheel` |
| products.js | `id: 'flip', path: '/flip', …` | `id: 'rps', path: '/rps', …` | `id: 'wheel', path: '/wheel', …` |
| Home.jsx gaming list | `games.filter(['flip','dice',…])` | listeye `'rps'` ekle | listeye `'wheel'` ekle |

---

## Eklenmesi gereken dosyalar / yerler

1. **Smart contract (Solidity)**  
   - Base (ve varsa diğer ağlar) için RPS ve Wheel kontratları.  
   - Deploy sonrası adresler `config/base.js` (veya `getContractAddressByNetwork`) içine yazılır.

2. **Config**
   - `config/base.js`: `CONTRACT_ADDRESSES.RPS_GAME`, `CONTRACT_ADDRESSES.WHEEL_GAME`.
   - `config/networks.js` (veya adresin ağa göre döndüğü yer): yeni kontratlar için adres eşlemesi.
   - `config/products.js`: iki yeni ürün (id, path, label, title, xpReward, bonusXP, category: GAMING, networks).
   - `config/supabase.js` (veya XP config): RPS ve Wheel için base/bonus XP değerleri.

3. **Hook**
   - `src/hooks/useTransactions.js`:  
     - `sendRPSTransaction(choice)`  
     - `sendWheelTransaction()`  
     - Aynı pattern: `validateAndSwitchNetwork` → `writeContractAsync` (veya Base app `sendCalls`) → receipt bekle → `addBonusXP` / `updateQuestProgress`.

4. **Sayfalar**
   - `src/pages/RPSGame.jsx` (veya RockPaperScissorsGame.jsx):  
     - 3 seçim butonu, loading, sonuç (win/draw/lose + house choice), XP popup, ShareButton, BackButton, GamingShortcuts.
   - `src/pages/WheelGame.jsx`:  
     - Çark UI, spin butonu, segment sonucu, XP popup, ShareButton, BackButton, GamingShortcuts.

5. **Routing ve menü**
   - `App.jsx`: `<Route path="/rps" element={<RPSGame />} />`, `<Route path="/wheel" element={<WheelGame />} />`.
   - `Home.jsx`: Gaming bölümünde kartların listelendiği yerde `'rps'` ve `'wheel'` id’lerini kullan (mevcut `renderCompactCard` / `games.filter` yapısına ekle).

6. **Ses (isteğe bağlı)**
   - `src/utils/soundEffects.js`: RPS ve Wheel için kısa efektler (click, win, lose, draw / spin stop).

7. **Quest (isteğe bağlı)**
   - Quest sisteminde “RPS oyna”, “Çark çevir” gibi görevler varsa `updateQuestProgress` ile ilgili key’leri güncelle.

---

## Kontrat taslağı (pseudocode)

**RPS**
```text
// choice: 0=Rock, 1=Paper, 2=Scissors
// house = random 0..2 (blockhash veya VRF)
// win: (player=Rock && house=Scissors) || (Paper && Rock) || (Scissors && Paper)
// draw: player == house
function playRPS(uint8 choice) external payable returns (bool isWin, bool isDraw, uint8 houseChoice)
```

**Wheel**
```text
// SEGMENTS = 8
// segmentIndex = random % 8 (blockhash veya VRF)
// Frontend’de segmentIndex → XP tablosu
function spinWheel() external payable returns (uint8 segmentIndex)
```

---

## Özet

- **Taş Kağıt Makas**: Basit, tanıdık, 1/3 kazanç; kontrat ve frontend tek seçim + tek sonuç.
- **Şans Çarkı**: Görsel, her oyunda XP; kontrat sadece segment index döndürür, XP miktarı frontend/backend tablosundan.

İki oyun da mevcut Flip/Dice/Lucky akışıyla aynı kalıba oturur: tek `payable` çağrı → receipt → XP. Önce kontratları deploy edip adresleri config’e yazın; ardından `useTransactions` + yeni sayfa + route + products + Home listesi ekleyerek tamamlarsınız.
