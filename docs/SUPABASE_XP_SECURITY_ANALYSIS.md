# Web vs Miniapp – Supabase XP Güvenlik Analizi

## Özet

| Taraf   | XP yolu                    | On-chain doğrulama | XP manipüle edilebilir mi? |
|--------|----------------------------|--------------------|----------------------------|
| **Web** (basehub.fun) | award-xp-verified EF → award_xp RPC | Evet (receipt) | Zor (gerçek tx gerekir) |
| **Miniapp** (basehub.fun) | Doğrudan award_xp RPC | Hayır | Evet (RPC doğrudan çağrılabilir) |

**Web daha güvenli;** miniapp tarafında XP, doğrulama olmadan RPC ile verildiği için manipüle edilebilir.

---

## 1. Web tarafı (basehub.fun)

### Akış

1. Kullanıcı tx yapar → hash alınır → (opsiyonel) receipt beklenir.
2. Frontend `addXP(..., txHash)` çağırır.
3. `useVerified === true` → **award-xp-verified** Edge Function çağrılır (tx_hash + chain_id gönderilir).
4. Edge Function: RPC ile `eth_getTransactionReceipt` ile tx’i doğrular (receipt.status success, receipt.from === wallet).
5. Doğrulama OK ise Edge Function **award_xp** RPC’yi çağırır (sunucu tarafı).
6. Duplicate: EF tarafında wallet + game_type + tx_hash ile idempotent davranış (aynı tx tekrar ödül vermez).

### Güvenlik

- **XP manipülasyonu:** Pratikte zor. XP almak için gerçek, başarılı bir on-chain tx gerekir; hash client’tan gelse bile EF receipt’i doğrular. Aynı tx_hash tekrar kullanılamaz (duplicate check).
- **Zayıf nokta:** Anon key ile biri doğrudan **award_xp** RPC’yi çağırırsa (EF’i atlayarak) yine de XP yazılabilir. Yani güvenlik “web frontend’in her zaman EF kullanması”na dayanıyor; RPC’nin kendisi web/miniapp ayırmıyor.

---

## 2. Miniapp tarafı (basehub.fun)

### Akış

1. Kullanıcı tx yapar → hash alınır (receipt beklenmez).
2. Frontend `addXP(..., txHash)` çağırır.
3. `useVerified === false` (miniapp domain / Base app / Farcaster) → doğrudan **award_xp** RPC çağrılır (`p_source`: `farcaster` | `base_app`).
4. RPC: tx_hash’i **doğrulamaz**; sadece `players` günceller ve `miniapp_transactions`’a insert eder.

### Güvenlik

- **XP manipülasyonu: Evet.**  
  - Anon key herkeste (frontend’de).  
  - `award_xp` RPC **anon** rolüne EXECUTE verilmiş; isteyen biri (tarayıcı, script, Postman) doğrudan `supabase.rpc('award_xp', { p_wallet_address, p_final_xp, p_game_type, p_transaction_hash, p_source: 'farcaster' })` çağırabilir.  
  - RPC sadece `get_max_xp_for_game_type` ile miktarı sınırlar; **tx’in gerçekten olup olmadığını kontrol etmez**.  
  - **Duplicate kontrolü yok:** Aynı cüzdan + game_type için tekrar tekrar çağrı yapılırsa her seferinde XP eklenir.  
- Sonuç: Miniapp path’inde, gerçek tx olmadan da XP yazılabilir ve aynı “işlem” defalarca ödüllendirilebilir.

---

## 3. Supabase tarafında öne çıkan riskler

1. **award_xp anon çağrılabilir**  
   - `anon` ve `authenticated` RPC’yi çağırabiliyor.  
   - Doğrulama sadece Edge Function (web) tarafında; RPC’de yok.

2. **Miniapp path’inde doğrulama yok**  
   - `p_source IN ('farcaster','base_app')` iken receipt/tx kontrolü yapılmıyor.  
   - Sahte veya başka zincirden kopyalanmış tx_hash ile de çağrı yapılabilir; RPC hash’e bakmıyor (sadece loglama için kullanılıyor).

3. **Duplicate / rate limit yok**  
   - Miniapp_transactions ve players güncellemesi için “bu tx_hash daha önce kullanıldı mı?” veya “bu wallet için son N dakikada kaç award_xp çağrısı yapıldı?” kontrolü yok.  
   - Çağrı başına max XP sınırı var, çağrı sayısı sınırlı değil.

4. **p_source client’tan geliyor**  
   - `p_source` tamamen frontend’den geliyor.  
   - İsteyen biri web’den de `p_source: 'farcaster'` gönderip doğrulamasız path’i tetikleyebilir (EF’i atlayıp doğrudan RPC çağırarak).

5. **RLS**  
   - `miniapp_transactions` ve `transactions` için anon insert/select açık; asıl XP mantığı RPC içinde.  
   - RPC SECURITY DEFINER ile `players`’a yazıyor; RLS’i bypass ediyor. Asıl risk, RPC’nin kimler tarafından çağrılabileceği ve neye güvendiği.

6. **CORS / origin**  
   - Supabase’de origin kısıtlaması yoksa, herhangi bir siteden anon key ile RPC çağrılabilir (key client’ta zaten var).

---

## 4. Karşılaştırma: Hangisi daha güvenli ve neden?

**Web daha güvenli:**

- Web’de XP, **award-xp-verified** Edge Function üzerinden veriliyor.  
- EF, **on-chain receipt** ile tx’in gerçek ve başarılı olduğunu doğruluyor; sadece ondan sonra award_xp çağrılıyor.  
- Duplicate koruması (tx_hash) EF tarafında var.  
- Sonuç: XP almak için gerçek bir on-chain işlem gerekir; aynı tx tekrar kullanılamaz.

**Miniapp daha riskli:**

- Miniapp’te XP, **doğrudan award_xp RPC** ile veriliyor; receipt/tx doğrulaması yok.  
- RPC anon çağrılabiliyor, duplicate/rate limit yok.  
- Bu yüzden hem “sahte tx” hem “aynı işlemi tekrar tekrar ödüllendirme” ile XP manipüle edilebilir.

---

## 5. XP manipülasyonu özeti

| Taraf   | Manipüle edilebilir mi? | Nasıl? |
|--------|--------------------------|--------|
| **Web** | Normal kullanımda hayır (EF doğruluyor). Ancak biri EF’i atlayıp doğrudan RPC çağırırsa evet. | Doğrudan `award_xp` RPC (örn. `p_source: 'farcaster'`) çağrısı; gerçek tx gerekmez. |
| **Miniapp** | Evet. | Aynı RPC’yi anon key ile çağırmak; tx_hash opsiyonel/rastgele bile olabilir. Aynı wallet + game_type ile tekrarlanabilir. |

Her iki tarafta da **tek güvenilir sınır**, web’deki **award-xp-verified** Edge Function. Miniapp tarafında bu katman olmadığı için XP orada manipüle edilebilir.

---

## 6. Önerilen iyileştirmeler (kısa)

1. **Miniapp’te de doğrulama (uzun vadede)**  
   - Mümkünse miniapp’ten gelen isteklerde de tx_hash + chain_id ile receipt doğrulaması (EF veya backend’de); başarılı ve daha önce kullanılmamış tx_hash ise award_xp çağrısı.

2. **RPC’de duplicate / rate limit**  
   - `award_xp` içinde: aynı `(wallet, game_type, transaction_hash)` daha önce kullanıldıysa XP verme (miniapp ve web path’i için).  
   - Ek: wallet + game_type bazlı rate limit (örn. dakika başına max N çağrı).

3. **p_source’u sadece sunucuda belirleme**  
   - Mümkünse p_source’u client göndermesin; istek origin’ine / header’a göre backend (EF veya başka bir servis) belirlesin ve sadece o servis award_xp’i çağırsın.

4. **Anon yerine sadece service_role ile award_xp**  
   - award_xp’i anon’a kapatıp sadece Edge Function (service_role veya backend key) ile çağırmak. Böylece client’tan doğrudan award_xp çağrısı imkansızlaşır; tüm XP akışı doğrulama katmanından geçer.

Bu doküman, mevcut mimariye göre web vs miniapp güvenliğini ve XP manipülasyon riskini özetler; iyileştirmeler uygulandıkça güncellenebilir.
