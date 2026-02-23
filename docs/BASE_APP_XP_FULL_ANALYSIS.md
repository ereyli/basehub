# Base App: Tx Görünmeme ve XP Verilmeme – Kapsamlı Analiz

## 1. fcbe2b0 ve Öncesi Nasıldı?

**fcbe2b0** commit’i (`fix: TX counter inflation + GM/GN XP badge`) sadece şunları değiştirdi:
- `src/hooks/useTotalTxCount.js` – Realtime yerine 30s polling
- `src/pages/Home.jsx` – GM/GN kartındaki XP badge (50 → 150)

**useTransactions.js ve xpUtils.js’e hiç dokunmadı.** Yani “fcbe2b0’dan önce” oyun akışı zaten daha önceki commit’lerde (b4c63e5, e75eb94, 570ee2d) şekillenmişti.

### 1.1 570ee2d (award_xp RPC) – Eski Basit Akış

```text
1. const txHash = await writeContractAsync({ ... })
2. Hemen: await addXP(address, 150, 'GM_GAME', chainId, false, txHash)
3. updateQuestProgress('gmUsed', 1); updateQuestProgress('transactions', 1)
4. Arka planda: waitForTxReceipt (timeout ile)
5. return { txHash, xpEarned: 30 }
```

- Receipt beklenmeden XP veriliyordu (hash yeterli).
- Base app’te çalışması için **writeContractAsync**’in mutlaka **resolve edip hash döndürmesi** gerekirdi.
- O zamanlar Base app / Coinbase WebView’da bu promise’ın resolve ettiği varsayılıyordu.

### 1.2 b4c63e5 (Farcaster/Base app: hash yeterli)

- `shouldAwardXPOnHashOnly()` eklendi: Farcaster/Base app’te receipt beklemeden, hash gelir gelmez XP.
- Akış yine: `const txHash = await writeContractAsync(...)` → hash alınır → addXP + quest.
- **Hâlâ hash’in promise’tan gelmesi** gerekiyordu. Base app’te promise resolve etmezse bu path’e hiç girilmiyordu.

### 1.3 Sonuç (fcbe2b0 öncesi davranış)

- **Farcaster (Warpcast vb.):** `writeContractAsync` resolve ediyor → hash geliyor → XP + tx sayacı artıyor.
- **Base app:** Eğer eskiden çalışıyorsa, o dönemde Base app / cüzdan **aynı wagmi çağrısında hash döndürüyordu**. Güncel Base app / EIP-5792 / batch (wallet_sendCalls) davranışında promise bazen hiç resolve olmuyor; bu yüzden “eskiden çalışıyordu” farkı, ortam/cüzdan güncellemesinden kaynaklanıyor olabilir.

---

## 2. Tx “Görünmüyor” ve XP “Verilmiyor” Ne Demek?

### 2.1 Tx sayacı (header’daki toplam işlem)

- **Kaynak:** `useTotalTxCount` → `supabase.from(TABLES.TRANSACTIONS).select('*', { count: 'exact', head: true })`.
- **transactions** tablosuna satır **Supabase backend’deki `award_xp` RPC** ile ekleniyor (frontend’de `recordTransaction` oyun akışında çağrılmıyor).
- Zincir: **hash alındı → addXP çağrıldı → award_xp RPC çalıştı → RPC hem players.total_xp hem transactions’a yazıyor** (backend tasarımı).
- Yani **addXP hiç çağrılmazsa** (hash yok) → award_xp çağrılmaz → transactions’a satır eklenmez → **tx sayacı artmaz**.

### 2.2 XP verilmiyor

- addXP yalnızca **txHash** (ve adres, chainId vb.) ile çağrılıyor.
- Hash’i **useTransactions** içinde `writeContractAsync` (veya Base app için getTxHashBaseApp) ile alıyoruz. Hash gelmezse addXP’e hiç girilmiyor → XP de verilmiyor.

Özet: Hem “tx görünmüyor” hem “XP verilmiyor” aynı köke bağlı: **Base app’te hash’in bir şekilde alınamaması**.

---

## 3. Neden Base App’te Hash Gelmiyor?

### 3.1 writeContractAsync resolve etmiyor

- WebView / in-app browser’da (wagmi, Coinbase Base app) **writeContractAsync** bazen hiç resolve olmuyor veya çok gecikiyor.
- Base Account (EIP-5792) bazen **wallet_sendCalls** ile batch gönderiyor; yanıt olarak önce **calls ID** dönebiliyor, **tx hash** ise **wallet_getCallsStatus** ile sonradan alınabiliyor. Bu durumda standart “tx hash dönen” promise davranışı değişebilir.

### 3.2 SwapHub neden Base app’te çalışıyor?

SwapHub **hash’i promise’tan beklemiyor**:

- `const { writeContractAsync, data: hash, ... } = useWriteContract()`
- `const { isSuccess } = useWaitForTransactionReceipt({ hash })`
- Swap gönderilirken: `await writeContractAsync({...})` çağrılıyor ama **kullanılan hash, hook’un reactive `data`’sı**. Yani promise resolve olmasa bile, wagmi **data**’yı (hash) güncelleyebiliyor.
- useEffect: `isSuccess && hash` olunca 2 sn gecikmeyle `recordSwapTransaction(address, amount, hash)` çağrılıyor.

Sonuç: Base app’te **useWriteContract’ın `data`’sı** bazen güncelleniyor (SwapHub çalışıyor), ama **promise** bazen hiç resolve olmuyor (oyunlarda takılma). Bu yüzden oyunlarda “promise + txData ref polling” (getTxHashBaseApp) eklendi: hash ya promise’tan ya da ref’teki `data`’dan gelsin.

### 3.3 Hâlâ çalışmıyorsa olası nedenler

1. **Base app’te `useWriteContract` `data` da güncellenmiyor**  
   Bazı Base Account / batch senaryolarında wagmi hiç hash alamıyor olabilir; o zaman ref’e de bir şey yazılmaz.

2. **isLikelyBaseApp() yanlış**  
   Base app’in user agent’ı farklıysa (örn. “Coinbase” yok), Base app path’i hiç kullanılmıyor; normal `await writeContractAsync`’e düşülür ve orada takılır.

3. **addXP / award_xp RPC hatası**  
   Hash gelse bile Supabase (CORS, anon key, RLS, ağ) Base app’ten farklı davranıyorsa addXP başarısız olabilir; kullanıcı yine “XP verilmedi” görür.

4. **Timeout (45 sn)**  
   Hash 45 sn’den sonra geliyorsa getTxHashBaseApp null döner, addXP çağrılmaz.

---

## 4. Yapılan Düzeltmeler (Özet)

| Commit / adım | Ne yapıldı |
|---------------|------------|
| award_xp RPC, receipt beklemeden XP | Hash alınır alınmaz addXP (570ee2d benzeri). |
| Base app + Farcaster: award_xp RPC | award-xp-verified atlanıyor, doğrudan award_xp RPC (useVerified = false). |
| shouldAwardXPOnHashOnly | Farcaster/Base app’te hash yeterli; web’de receipt sonrası XP. |
| isLikelyBaseApp + getTxHashBaseApp | Sadece Base app’te: promise + txData ref’i 45 sn polling (Promise.race). Hash ref’te görünürse onu kullan, yoksa timeout’ta null. |
| GM, GN, Flip, Lucky Number, Dice, Slot | Hepsi için Base app path: writePromise + getTxHashBaseApp; hash yoksa anlamlı obje dön, loading kapat. |

---

## 5. Önerilen Kontroller ve İyileştirmeler

### 5.1 Debug log’ları (Base app’te gerçek davranışı görmek için)

- **isLikelyBaseApp()** ve **shouldAwardXPOnHashOnly()** değerlerini (GM/GN gönderilirken) bir kere logla.
- Hash’in **nereden** geldiğini: promise mı, ref (txData) mı? Örn. `getTxHashBaseApp` içinde resolve edildiğinde `fromRef: true/false` logla.
- **txData** değişimini: `useEffect(() => { if (txData) { console.log('txData updated', txData); latestTxHashRef.current = txData } }, [txData])` – Base app’te bu log hiç düşüyorsa wagmi `data`’yı güncellemiyor demektir.

### 5.2 Base app user agent

- Base app’in gerçek user agent’ını (navigator.userAgent) bir yerde loglayıp `isLikelyBaseApp` ile eşleştiğinden emin ol. Gerekirse “base” veya başka bir pattern eklenebilir.

### 5.3 addXP hata yakalama

- addXP çağrısında catch’te net log: “Base app addXP failed”, err.message. Böylece hash gelip RPC’nin mi yoksa ağ/CORS’un mu kırıldığı anlaşılır.

### 5.4 İleriye dönük: wallet_getCallsStatus (EIP-5792)

- Base Account batch kullanıyorsa hash’i **wallet_getCallsStatus** ile almak gerekebilir. Bu, wagmi’nin üzerinde veya connector’a özel ek bir katman gerektirir; ileride Base/wagmi dokümantasyonu ile entegre edilebilir.

---

## 6. Kısa Özet

- **fcbe2b0** sadece TX sayacı ve GM/GN badge’ini değiştirdi; oyun tx/XP akışı önceden de “hash alınca XP” mantığındaydı.
- Base app’te sorun: **hash’in hiç gelmemesi** (writeContractAsync resolve etmiyor; bazen useWriteContract `data`’sı da güncellenmeyebiliyor).
- Tx sayacı ve XP ikisi de **addXP → award_xp RPC** zincirine bağlı; hash gelmezse ikisi de tetiklenmiyor.
- SwapHub Base app’te çalışıyor çünkü hash’i **hook’un `data`’sından** alıyor; oyunlarda da aynı `data`’yı ref ile okuyup 45 sn bekliyoruz. Hâlâ çalışmıyorsa: Base app’te `data`’nın güncellenip güncellenmediği, isLikelyBaseApp ve addXP hatalarının log’larla doğrulanması gerekir.
