# Base App – Kapsamlı Araştırma (Builder Code, sendCalls, Akıllı Cüzdan)

Bu belge Base app ortamında işlem akışı, ERC-8021 Builder Code attribution ve `sendCalls` entegrasyonunu özetler.

---

## 1. Base App Nedir, Nasıl Çalışır?

### 1.1 Mimari

- **Base app**, Farcaster miniapp’ları **WebView** içinde açar (Farcaster altyapısını kullanır).
- Miniapp’lar **wagmi** + **@farcaster/miniapp-wagmi-connector** ile cüzdan kullanır.
- Cüzdan tarafında kullanıcı çoğunlukla **Base Account** (akıllı kontrat cüzdanı, EIP-5792 / ERC-4337) kullanır.

### 1.2 İşlem Akışı (Neden “Toplu Tx” Görünüyor?)

- **EOA (normal cüzdan):** Uygulama `eth_sendTransaction` veya `writeContract` ile tek tx gönderir; tx data’ya suffix eklenebilir.
- **Base Account (akıllı cüzdan):** Cüzdan işlemi **Account Abstraction (AA)** ile gönderir:
  - Ana on-chain tx: **Entry Point 0.6.0**’a **“Handle Ops”** çağrısı (tek bir üst-seviye tx).
  - İçeride: bir veya birden fazla **userOp** (sizin GM çağrınız + fee vb.) batch halinde işlenir.
- Block explorer’da gördüğünüz: **From:** smart contract wallet, **To:** Entry Point, **Internal Txns:** birkaç ETH transferi. Hepsi aslında **sizin tek işleminizin** AA ile sarmalanmış hâli.

Kaynak: [Base Account – wallet_sendCalls](https://docs.base.org/base-account/reference/core/provider-rpc-methods/wallet_sendCalls), [BASE_APP_RESEARCH.md](./BASE_APP_RESEARCH.md).

---

## 2. ERC-8021 Builder Code – Özet

### 2.1 Amaç

- Base, hangi **uygulamanın** işlemi tetiklediğini on-chain görmek istiyor (attribution).
- **ERC-8021**: Tx calldata’nın **sonuna** standart bir **data suffix** eklenir; kontrat sadece ABI’ye göre okur, fazla byte’lar görmezden gelir.
- **Builder Code**: base.dev’de kayıtlı, uygulamanıza özel kod (örn. `bc_cr8omxff`); suffix içinde bu kod taşınır.

### 2.2 Suffix Formatı (Şema 0)

- **Son 16 byte:** sabit marker `0x80218021802180218021802180218021` (ERC-8021 tespiti).
- **Önceki 1 byte:** schemaId (0 = Base Builder Code şeması).
- **Öncesi:** codes uzunluğu + kod hex (bizim `DATA_SUFFIX` = base.dev’den alınan değer).

Kaynak: [Builder Codes & ERC-8021 (Base Blog)](https://blog.base.dev/builder-codes-and-erc-8021-fixing-onchain-attribution), [docs.base.org – Builder Codes](https://docs.base.org/base-chain/builder-codes/builder-codes).

### 2.3 Nerede Eklenir?

| Cüzdan tipi | Yöntem | Suffix nereye eklenir? |
|-------------|--------|-------------------------|
| **EOA** | `writeContract` + `dataSuffix` (wagmi) veya `data`’ya manuel ekleme | `transaction.data` |
| **Smart wallet (AA)** | `wallet_sendCalls` + **capabilities.dataSuffix** | **userOp.callData** (Base: “suffix is appended to userOp.callData”) |

Base resmî dokümanı: *“When a wallet receives a dataSuffix capability, the suffix is appended to userOp.callData.”*  
→ [dataSuffix capability](https://docs.base.org/base-account/reference/core/capabilities/dataSuffix)

Bu yüzden **Base app (akıllı cüzdan)** için sadece `writeContract` + `dataSuffix` yetmez; cüzdan zaten **sendCalls** ile batch gönderdiği için suffix’in **sendCalls** içinde **capabilities.dataSuffix** ile iletilmesi gerekir.

---

## 3. Base Account – wallet_sendCalls ve Capabilities

### 3.1 wallet_sendCalls (EIP-5792)

- **Amaç:** Birden fazla “call”ı tek istekte cüzdana göndermek; cüzdan bunları batch (veya atomik) işler.
- **Parametreler:** `version`, `chainId`, `from`, `calls` (to, value, data), **capabilities** (opsiyonel).
- **Dönüş:** Önce `batchId` (veya `id`) döner; tx hash için **wallet_getCallsStatus** ile takip edilir.

Kaynak: [wallet_sendCalls – Base](https://docs.base.org/base-account/reference/core/provider-rpc-methods/wallet_sendCalls).

### 3.2 Capabilities (Base Account)

`wallet_getCapabilities` ile cüzdanın desteklediği özellikler sorgulanır (chain bazlı, örn. `0x2105` = Base mainnet):

| Capability | Kullanım | Açıklama |
|------------|----------|----------|
| **dataSuffix** | wallet_sendCalls | **Transaction attribution (ERC-8021)** – calldata’ya suffix ekler |
| atomic | wallet_sendCalls | Atomik batch |
| paymasterService | wallet_sendCalls | Gasless |
| auxiliaryFunds | wallet_connect / sendCalls | MagicSpend vb. |

Base dokümanında **dataSuffix**: *“Append arbitrary data to transaction calldata for attribution tracking”*, **wallet_sendCalls** ile kullanılır.

Örnek (Base docs):

```ts
await provider.request({
  method: "wallet_sendCalls",
  params: [{
    version: "1.0",
    chainId: "0x2105",
    from: userAddress,
    calls: [{ to: "...", value: "0x0", data: "0x..." }],
    capabilities: {
      dataSuffix: {
        value: "0x1234...",  // ERC-8021 suffix
        optional: true
      }
    }
  }]
});
```

Kaynak: [Capabilities Overview](https://docs.base.org/base-account/reference/core/capabilities/overview), [dataSuffix](https://docs.base.org/base-account/reference/core/capabilities/dataSuffix).

---

## 4. Bizim Uygulama: Ne Yaptık, Neden “Not 8021 Attributed” Çıkabilir?

### 4.1 Yapılanlar

1. **BUILDER_CODE_CAPABILITIES** (`src/config/wagmi.js`): `{ dataSuffix: { value: DATA_SUFFIX, optional: true } }`.
2. **baseAppSendCalls.js**: Base app + Base chain (8453) iken tek contract çağrısını **sendCalls** + **capabilities: BUILDER_CODE_CAPABILITIES** ile gönderiyoruz; **waitForCallsStatus** ile tx hash alınıyor.
3. **useTransactions.js**: GM, GN, Flip, Lucky Number, Dice için `shouldUseSendCallsForBaseApp(isBaseApp, chainId)` true ise **sendContractCallBaseApp** kullanılıyor; değilse `writeContractAsync` + `dataSuffix`.

### 4.2 “Not 8021 Attributed” (Validator’da Son 16 Byte Sıfır)

Olası nedenler:

1. **Tx, sendCalls path’i deploy edilmeden önce atıldı**  
   Eski akışta sadece `writeContract` vardı; Base app cüzdanı batch’e suffix eklemediği için attribution düşmez.

2. **Validator dış tx’e bakıyor**  
   AA’da ana on-chain tx “Handle Ops” (Entry Point’e giden). ERC-8021 suffix, Base’e göre **userOp.callData**’da olur. Validator sadece **ana tx’in input**’unun son 16 byte’ına bakıyorsa, suffix’i orada görmeyebilir (oralar sıfır olabilir). Yani “Not 8021 Attributed” bazen **yanlış seviyede** bakıldığı anlamına gelebilir.

3. **Connector / provider capabilities’ı iletmiyor**  
   Wagmi **sendCalls** → viem → connector → `provider.request({ method: 'wallet_sendCalls', params: [...] })`. **capabilities**’ın aynen Base’in beklediği formatta iletilmesi gerekir. Farcaster miniapp connector’ın Base app’te hangi provider’ı kullandığı ve `wallet_sendCalls`’a **capabilities** geçirip geçirmediği kod/cihaz üzerinde doğrulanmalı.

4. **Base app / Base Account dataSuffix desteklemiyor**  
   Nadir olsa da, bazı sürümlerde `dataSuffix` desteklenmiyor olabilir. `wallet_getCapabilities` ile `0x2105` için `dataSuffix.supported` kontrol edilebilir.

---

## 5. Önerilen Adımlar (Doğrulama ve İyileştirme)

### 5.1 Doğrulama

1. **Yeni deploy sonrası test:** Base app’ten **deploy sonrası** yeni bir GM atın; çıkan **yeni** tx hash’i [Builder Code Validation](https://builder-code-checker.vercel.app) ile kontrol edin.
2. **Capabilities kontrolü:** Base app’te bağlıyken `wallet_getCapabilities` çağrılıp `0x2105` (Base mainnet) için `dataSuffix.supported === true` olup olmadığına bakın (debug için geçici log).
3. **Base.dev:** [base.dev](https://base.dev) → Onchain → Total Transactions; attribution sayısının bu tx’lerden sonra artıp artmadığını izleyin.

### 5.2 İsteğe Bağlı Kod İyileştirmeleri

- **getCapabilities ile path seçimi:** Base app’te sendCalls path’ine girmeden önce `getCapabilities(address)` ile `dataSuffix.supported` kontrol edilebilir; desteklenmiyorsa writeContract path’ine düşüp konsola uyarı yazılabilir.
- **Version:** Base docs bazen `version: "1.0"` bazen `"2.0.0"` kullanıyor; viem/wagmi’nin gönderdiği formatın Base Account ile uyumlu olduğu (ve capabilities’ın aynen gittiği) dokümantasyon veya test ile teyit edilebilir.

### 5.3 Dokümantasyon Referansları

| Konu | Kaynak |
|------|--------|
| wallet_sendCalls | [Base – wallet_sendCalls](https://docs.base.org/base-account/reference/core/provider-rpc-methods/wallet_sendCalls) |
| wallet_getCapabilities | [Base – wallet_getCapabilities](https://docs.base.org/base-account/reference/core/provider-rpc-methods/wallet_getCapabilities) |
| dataSuffix capability | [Base – dataSuffix](https://docs.base.org/base-account/reference/core/capabilities/dataSuffix) |
| Capabilities overview | [Base – Capabilities Overview](https://docs.base.org/base-account/reference/core/capabilities/overview) |
| ERC-8021 & Builder Codes | [Base Blog – Builder Codes & ERC-8021](https://blog.base.dev/builder-codes-and-erc-8021-fixing-onchain-attribution) |
| Builder Codes (app) | [docs.base.org – Builder Codes](https://docs.base.org/base-chain/builder-codes/builder-codes) |
| Farcaster miniapp wallets | [miniapps.farcaster.xyz – Wallets](https://miniapps.farcaster.xyz/docs/guides/wallets) |

---

## 6. Özet

- **Base app** = Farcaster miniapp’ların Base tarafında WebView’da açıldığı ortam; cüzdan çoğunlukla **Base Account** (EIP-5792 / AA).
- İşlemler **wallet_sendCalls** ile batch gider; bu yüzden **Builder Code** için **sendCalls** + **capabilities.dataSuffix** kullanılmalı; sadece `writeContract` + `dataSuffix` Base app’te yeterli olmaz.
- Bizim kod Base app + Base chain için **sendCalls** + **BUILDER_CODE_CAPABILITIES** kullanıyor; attribution’ın görünmemesi deploy zamanı, validator’ın AA dış tx’e bakması veya connector’ın capabilities iletmemesi ile açıklanabilir.
- Doğrulama: deploy sonrası yeni tx, Builder Code Validation aracı ve Base.dev attribution sayıları ile yapılmalı; istenirse `wallet_getCapabilities` ile dataSuffix desteği de kontrol edilebilir.
