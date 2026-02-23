# Base App: Tx Onayı ve XP Sorunu – Araştırma Özeti

## Bağlam
- **Farcaster:** Sorun yok; XP ve tx akışı düzgün.
- **Base app:** BaseHub, Farcaster miniapp yapısıyla açılıyor (Base app Farcaster’ı gömülü kullanıyor). Buna rağmen Base app’te:
  - Tx’ler “onaylanmıyor” veya çok geç görünüyor.
  - XP hiç kazanılmıyor veya çok gecikmeli.

## Base App Yapısı (Özet)
- Base app, Farcaster miniapp’ları **WebView** içinde açar (Farcaster client gibi).
- Miniapp’lar **OnchainKitProvider** + **Farcaster connector** (wagmi) ile cüzdan kullanır.
- Base tarafında cüzdan/hesap **Base Account** (EIP-5792) olabiliyor; işlemler bazen **wallet_sendCalls** ile batch gönderilir.

## Tespit Edilen Nedenler

### 1. Hash’in geç veya hiç dönmemesi
- **wagmi `writeContract` / `writeContractAsync`:** Normalde tx gönderilince **tx hash** döner.
- **WebView / in-app browser:** Bilinen bir durumda (wagmi #4187 vb.) bazı ortamlarda `writeContract` **resolve etmiyor** veya hash çok geç geliyor; `isPending` uzun süre true kalıyor.
- **Base Account / batch:** Dokümantasyona göre Base Account bazen **wallet_sendCalls** kullanıyor; bu durumda yanıt olarak önce **calls ID** dönüyor, **tx hash** ise **wallet_getCallsStatus** ile polling ile alınıyor. Yani hash hemen dönmeyebilir.

Sonuç: Base app’te `await writeContractAsync(...)` bazen **hiç resolve olmuyor** veya çok gecikiyor. Kod hash’i alamadığı için:
- “Tx onaylanıyor mu?” adımına hiç geçilmiyor (veya çok geç).
- `shouldAwardXPOnHashOnly()` ile “hash yeterli” XP path’i de **hash olmadığı için** tetiklenemiyor; XP kazanılmıyor.

### 2. Receipt / RPC farkı (zaten biliniyordu)
- Base app WebView’da RPC / `waitForTransactionReceipt` yanıtı gecikebiliyor veya hiç gelmiyor.
- Bu yüzden Farcaster/Base app için “hash yeterli” path’i (receipt beklemeden, sadece hash ile XP) eklendi; fakat **hash gelmediği sürece** bu path de çalışmıyor.

### 3. Farcaster vs Base app ayrımı
- Base app, Farcaster altyapısını kullandığı için **iframe / Farcaster URL** kontrolüyle “Farcaster’dayız” diyoruz; yani Base app’te de `shouldAwardXPOnHashOnly()` true oluyor.
- Asıl fark: **Farcaster (sadece Warpcast vb.)** ortamında `writeContractAsync` genelde hash döndürüyor; **Base app (Coinbase WebView)** ortamında aynı çağrı bazen hiç dönmüyor veya gecikiyor. Bu yüzden Base app’e özel ek bir “hash alma” stratejisi gerekli.

## Yapılan Uygulama (Özet)

1. **Base app tespiti:** `isLikelyBaseApp()` (userAgent: coinbase / base wallet / cbwallet) – `xpUtils.js` içinde export edildi.
2. **Hash fallback (sadece Base app):**  
   - `writeContractAsync` tek başına beklenmiyor.  
   - **Promise.race:**  
     - Ya `writeContractAsync` resolve eder (hash gelir),  
     - Ya da **en fazla 15 saniye** boyunca **hook’tan gelen `txData` (hash)** izlenir; `useWriteContract` bazen hash’i state’e yazar (provider sonradan push ederse).  
   - Ref ile son bilinen hash saklanıyor; “yeni gönderilen tx’e ait hash” (önceki hash’ten farklı olan) kabul ediliyor.
3. **Hash gelmezse:** 15 saniye sonra timeout; loading kapatılıyor, hata fırlatılmıyor; kullanıcı takılmıyor. XP o tur için verilemeyebilir ama UI donmaz.
4. **Web / normal Farcaster:** Davranış değişmedi; `writeContractAsync` doğrudan await ediliyor, hash gelince mevcut “hash yeterli” veya “receipt bekle” akışı aynen işliyor.

## Referanslar
- Base Account: `wallet_sendCalls`, `wallet_getCallsStatus` (EIP-5792) – [docs.base.org](https://docs.base.org/base-account/reference/core/provider-rpc-methods/wallet_getCallsStatus)
- Base miniapp provider: [Provider & Initialization](https://docs.base.org/mini-apps/technical-reference/minikit/provider-and-initialization)
- wagmi WebView/in-app: useWriteContract hash’in gecikmesi / resolve olmaması (ör. eski issue #4187)
