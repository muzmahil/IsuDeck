# IsuDeck 1.2.1 — Yenilikleri Test Etme Rehberi

Bu rehber, düzeltmelerin gerçekten çalıştığını adım adım doğrulamanız için hazırlandı.

## Hazırlık

```powershell
cd isu-deck-ui
npm test            # 51 testin tamamı geçmeli
npm run tauri dev   # uygulamayı gerçek Tauri ortamında açar
```

> Tarayıcıda `npm run preview` ile açarsanız tuş dinleme ve sistem metrikleri çalışmaz
> (Tauri çalışma zamanı yok). Aşağıdaki testlerin çoğu `npm run tauri dev` gerektirir.

Hızlı kontrol listesi:

- [ ] Uzun aksiyon listesi akıcı kaydırılıyor
- [ ] Tuş Atama butonları dar pencerede görünür
- [ ] Açık temada IF/LOOP kartları açık renk
- [ ] Yeni değişken otomatik oluşuyor
- [ ] Aynı butonda SET/CHANGE → IF taze değeri görüyor
- [ ] IF/LOOP içindeki hold-release aksiyonu bırakmada çalışıyor
- [ ] Aynı tuş her sayfada aynı davranıyor
- [ ] Çakışma iptali eski atamayı koruyor
- [ ] THEN → ELSE sürüklemesi öğe kaybetmiyor
- [ ] Eklenti release'i yalnızca opt-in ile alıyor
- [ ] `$sys.cpu`, `$sys.ram`, `$sys.battery` değer üretiyor
- [ ] Vurgu rengi ayarı editöre yansıyor
- [ ] Tuş Atama'da büyük tuş kapağı ve Teknik Detaylar görünüyor
- [ ] Aksiyonlar katalogdan sürükle-bırak ile ekleniyor
- [ ] IF/ELSE ve LOOP kartları `#1E1E1E` yüzeyinde
- [ ] Eklenti Configure/Install/Uninstall popup'ı anında açılıyor
- [ ] 30+ aksiyonlu listede kaydırma akıcı (donma yok)

---

## 1. Aksiyon listesinde kaydırma performansı (30+ aksiyon)

**Amaç:** Uzun listelerde donma olmadığını doğrulamak.

1. Bir butonu düzenleyin → **Aksiyonlar** sekmesi.
2. Katalogdan **30 aksiyon** ekleyin (ör. 30 adet "URL Aç").
3. Listeyi fare tekerleğiyle hızlıca yukarı/aşağı kaydırın.
4. Bir kartı genişletip daraltın, sonra tekrar kaydırın.
5. 2–3 `IF_CONDITION` bloğu ekleyip (yükseklikleri farklı) aynı testi tekrarlayın.

**Beklenen:** Kaydırma baştan sona akıcı; liste "yapışmıyor", kaydırma konumu
kendiliğinden zıplamıyor. Kart açma/kapama anında takılma yok. Editör açılırken
arka planda bulanıklık katmanı çalışmıyor (editör opak).

> Nasıl düzeltildi: kartlardaki `content-visibility`/`contain-intrinsic-size`
> kaldırıldı, yerine `contain: layout style` geldi; liste `overflow-anchor: none`
> kullanıyor; özel `::-webkit-scrollbar` stilleri (compositor kaydırmayı bozuyordu)
> kaldırıldı; aksiyon gruplaması `useMemo` ile önbelleğe alındı.
>
> Doğrulama ipucu: DevTools → Elements → bir `.action-card` seçin; Computed
> panelinde `contain: layout style` görünmeli, `content-visibility` **olmamalı**.

## 2. Tuş Atama sekmesi (yeni tuş kapağı tasarımı)

1. Bir butonu düzenleyin → **Tuş Atama**.
2. Pencereyi dikey olarak küçültün (veya mini moddan çıkıp pencereyi daraltın).
3. Sekme içeriğini kaydırın.
4. Tuş kapağına tıklayıp kaydı başlatın, bir tuşa basın.
5. **Teknik Detaylar** satırına tıklayın.

**Beklenen:**
- Ortada büyük, 3D görünümlü tuş kapağı; üstünde durum rozeti (Bekleniyor / Atandı).
- Atama yokken tuş kapağında `---`, atama varken tuş adı (ör. `F13`) ve yeşil
  **ATANDI** rozeti görünür.
- **Basılı Tutma** anahtarı ve açıklaması tek kartta.
- **Teknik Detaylar** varsayılan kapalıdır; açıldığında İşleyici ID ve HID yolu görünür.
- "Kaydı Başlat" ve (atama varsa) "Atamayı Kaldır" butonları her zaman alt kenarda
  görünür kalır (`sticky bottom-0`).

## 3. Açık temada mantık kartları

1. **Ayarlar → Tema → Açık**.
2. Bir butona `IF_CONDITION` ve `LOOP_REPEAT` aksiyonu ekleyin veya mevcut olanı açın.
3. **Aksiyonlar** sekmesinde kartlara bakın.

**Beklenen:** Kart yüzeyleri açık (beyaz/açık gri), metin koyu ve okunabilir. Kart
içindeki THEN/ELSE alanları da açık renkte; hiçbir koyu `#16xxxx` yüzey kalmamalı.

## 4. Olmayan değişkenin otomatik oluşturulması

1. Bir butona **Değişken Ayarla (SET_VARIABLE)** ekleyin.
2. Değişken adına daha önce tanımlanmamış bir ad yazın (ör. `testSayac`), değer `5`.
3. Butonu kaydedip çalıştırın.
4. **Ayarlar → Değişkenler** (veya değişken listesi) ekranını açın.

**Beklenen:** `testSayac` değişkeni `5` değeriyle listede görünür ve
`variables.json` dosyasına yazılır. Önceden bu işlem sessizce hiçbir şey yapmıyordu.

## 5. Aynı butonda taze değer okuma (SET → IF)

1. Butona şu sırayı ekleyin:
   1. `SET_VARIABLE` → ad `sayac`, değer `5`
   2. `IF_CONDITION` → `sayac` `==` `5` → THEN: bir URL aç
3. Butonu çalıştırın.

**Beklenen:** THEN dalı çalışır (URL açılır). Önceden IF eski değeri gördüğü için
ELSE dalı çalışıyordu.

Aynı testi `CHANGE_VARIABLE` ile yapın: `sayac` 2 iken `+3` uygulayıp `== 5`
karşılaştırın; THEN çalışmalı.

## 6. Değişken sınırları ve ses senkronizasyonu

1. `vol` adında, min `0`, max `100`, değeri `95` olan bir değişken oluşturun.
2. `CHANGE_VARIABLE` ile `+20` ve **"Sistem sesiyle senkronize et"** seçeneğini açın.
3. Çalıştırın.

**Beklenen:** Değişken `100`'de kalır (taşmaz) ve sistem sesi `%100` olur.
Ardından `-200` deneyin; değişken `0` olur ve ses `%0` olur.

## 7. Hold-release'in iç içe bloklara ulaşması

1. Bir butonda **basılı tutma (hold)** modunu açın.
2. Aksiyonlara bir `IF_CONDITION` ekleyin; THEN dalına **Ses Kapat (MUTE)** koyun.
3. Koşulu her zaman doğru olacak şekilde ayarlayın (ör. `$sys.cpu >= 0`).
4. Tuşu basılı tutun, sonra bırakın.

**Beklenen:** Basışta susturma uygulanır, bırakmada ses geri açılır. Önceden iç içe
aksiyon bırakma olayını hiç almıyordu.

> Aynı testi `LOOP_REPEAT` içine MUTE koyarak da yapabilirsiniz.

## 8. Eklenti release davranışı (davranış değişikliği)

1. Bir eklenti aksiyonu ekleyin (ör. OBS susturma) ve hold modunda kullanın.
2. Eklenti manifestinde/aksiyon tanımında `holdRelease`, `supportsRelease` veya
   `release` alanı **yoksa**: bırakmada eklentiye olay gitmez, aksiyon ikinci kez
   çalışmaz.
3. Aynı alanlardan birini `true` yaparsanız: bırakmada eklentiye `phase: "release"`
   ile olay gider.

**Beklenen:** Opt-in olmayan eklentilerde çift çalışma yok; opt-in olanlarda bırakma
olayı geliyor.

## 9. HID/tuş eşleştirme tutarlılığı

1. Bir butona fiziksel tuş atayın (ör. `F13`).
2. Aynı tuşu **Deck** sayfasında, **Profiller** sayfasında ve **Eklentiler**
   sayfasındayken deneyin.

**Beklenen:** Tuş her sayfada aynı butonu tetikler. `KEYBOARD_HOOK`, `*` ve `any`
joker atamaları da her yerde çalışır.

## 10. Çakışma iptali

1. Buton A'ya bir tuş atayın.
2. Buton B'yi düzenleyin → **Tuş Atama** → kaydı başlatın.
3. Buton A'nın tuşuna basın (çakışma uyarısı çıkar).
4. Uyarıdaki **İptal**'e basın.

**Beklenen:** Buton B'nin daha önceki ataması (varsa) korunur; etiket kaybolmaz.

## 11. Aynı blok içinde THEN → ELSE sürükleme

1. Bir `IF_CONDITION` bloğu ekleyin.
2. THEN dalına bir aksiyon ekleyin.
3. Bu aksiyonu sürükleyip aynı bloğun ELSE dalına bırakın.

**Beklenen:** Aksiyon THEN'den kalkar, ELSE'ye eklenir; kopya kalmaz, kaybolmaz.

## 12. Sistem metrikleri ve saat

1. Bir butona `IF_CONDITION` ekleyin.
2. Sol tarafa `$sys.cpu` yazın, operatör `>`, sağa `0`.
3. THEN dalına bir URL açma aksiyonu koyun ve çalıştırın.

**Beklenen:** URL açılır (CPU değeri okunuyor). Aynı şekilde `$sys.ram`,
`$sys.battery`, `$sys.time24`, `$sys.time12` denenebilir.

Doğrulama:
- DevTools Konsolu: `await window.__TAURI_INTERNALS__.invoke('get_system_metrics')`
  çağrısı `{ cpu, ram, battery }` benzeri bir nesne döndürmeli.
- Değerler 10 saniyede bir kendiliğinden güncellenir.
- Masaüstü pil yoksa `battery` boş/`null` olabilir (beklenen).

## 13. Vurgu rengi (accent)

1. **Ayarlar → Görünüm → Vurgu Rengi**'ni değiştirin (ör. mor `#8b5cf6`).
2. Editörü açın; kaydet butonu, seçili sekme, odak halkaları ve bağlama kartına bakın.

**Beklenen:** Tüm vurgular seçilen renge döner; sabit mavi kalmaz.

## 15. IF/ELSE ve LOOP kart rengi (koyu tema)

1. Koyu temada bir butona `IF_CONDITION` (ELSE açık) ve `LOOP_REPEAT` ekleyin.
2. **Aksiyonlar** sekmesinde kartlara ve THEN/ELSE/LOOP omuzlarına bakın.
3. DevTools → Elements → kartı seçin → Computed → `background-color`.

**Beklenen:** Gövde, omuzlar ve alt kapanışlar diğer aksiyon kartlarıyla aynı
`rgb(30, 30, 30)` (`#1E1E1E`) değerinde. `#161619` / `#1C1C20` kalmamalı.

## 16. Aksiyonları sürükle-bırak ile ekleme

1. Bir butonu düzenleyin → **Aksiyonlar** sekmesi.
2. Katalogdan bir aksiyonu (ör. **Web Sitesi**) tutup sağdaki listeye bırakın.
3. Aynı işlemi bir `IF_CONDITION` bloğunun THEN veya ELSE dalına yapın.

**Beklenen:** Aksiyon bırakıldığı anda listeye/dala eklenir; sayfa yenilenmez.
Gerçek uygulamada (`npm run tauri dev`) de aynı davranış görülür. Tarayıcı
önizlemesinde sentetik HTML5 sürükleme olaylarıyla doğrulanabilir.

> Not: Bu düzeltme `tauri.conf.json` içindeki `"dragDropEnabled": false` ayarına
> dayanır. Bu ayar olmadan WebView2 sürükleme verisini yutuyordu.

## 17. Eklenti popup'ları (Configure / Install / Uninstall)

1. **Eklentiler** sayfasını açın.
2. Kurulu bir eklentinin **Yapılandır** butonuna basın.
3. Detay sayfasına girip oradaki **Kur** / **Kaldır** / **Yapılandır** butonlarını deneyin.

**Beklenen:** Popup, butona basıldığı **anda** sayfanın üstünde açılır. Detay
sayfasından geri dönmeyi beklemek gerekmez. Liste görünümünde de popup çalışır.
Onay ve iptal butonları popup içinde görünür.

## 18. Güncelleme bildiriminde Markdown sürüm notları

1. `updateInfo.releaseNotes` alanına Markdown içeren bir metin gelsin
   (GitHub release açıklaması Markdown'dır; `RELEASE_NOTES_1.2.1.md` dosyasının
   içeriğini doğrudan GitHub release açıklamasına yapıştırabilirsiniz).
2. Ayarlar → **Güncellemeler** → **Şimdi kontrol et** ile bildirimi açın
   (veya güncelleme bildirimini tetikleyin).

**Beklenen:**
- Başlıklar büyük/kalın görünür, `##` veya `**` işaretleri görünmez.
- Listeler madde işaretli; satır içi `kod` ve kod blokları biçimli.
- Uzun notlar bildirim içinde kaydırılabilir (yaklaşık 16 rem yükseklik).
- Notlardaki bir bağlantıya tıklanınca uygulama içinde gezinmek yerine
  **varsayılan tarayıcı** açılır.
- Açık ve koyu temada metin okunabilir.

> Teknik not: render `src/utils/markdown.js` içindeki `renderMarkdown()` ile
> yapılır. `marked` HTML'e çevirir, ardından izinli-etiket temizleyici
> (`sanitizeHtml`) çalışır; `script`, `iframe`, `style` ve `javascript:` bağlantıları
> ayıklanır. Aynı fonksiyon eklenti README'lerinde de kullanılır.

## 19. Release notları ve sürüm numarası

```powershell
cd isu-deck-ui
Select-String -Path package.json,src-tauri\tauri.conf.json,src-tauri\Cargo.toml -Pattern '1\.2\.1'
```

**Beklenen:** Üç dosyada da `1.2.1` görünür.

## 20. Otomatik testler ve derleme

```powershell
cd isu-deck-ui
npm test            # 51 test, 0 hata beklenir
npm run build       # "✓ built" beklenir
cd src-tauri
cargo check --lib   # "Finished dev profile" beklenir
```

Test kapsamı:

| Dosya | Kapsam |
| --- | --- |
| `bindingMatch.test.js` | HID eşleştirme, jokerler, buton bulma |
| `logicEngine.test.js` | Değişken çözümleme, SET/CHANGE, IF/LOOP, ses/mute, faz |
| `holdRelease.test.js` | Release kuralları, eklenti opt-in, iç içe toplama, döngü |
| `uiRegression.test.js` | Scroll/CTA/tema/accent/log, keycap, sürükle-bırak, modal, markdown, sürüm regresyonları |

## Sorun giderme

- **Tuşlar hiç çalışmıyor:** Sürücü/giriş servisi durumunu kontrol edin;
  uygulamada "Giriş Beklemede" uyarısı varsa arka plan servisi kapalıdır.
- **Metrikler boş:** Tarayıcı önizlemesinde normaldir; `npm run tauri dev` kullanın.
- **Eski davranış görünüyor:** `dist/` eski olabilir; `npm run build` sonrası
  uygulamayı yeniden başlatın.
