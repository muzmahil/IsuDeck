# IsuDeck Kullanım Kılavuzu 🎛️

Bu kılavuz, **IsuDeck** uygulamasının tüm özelliklerini, kurulum adımlarını, gelişmiş mantık ve akış kontrollerini, değişken sistemini ve eklenti entegrasyonlarını detaylı şekilde açıklamaktadır.

---

## 📑 İçindekiler
1. [IsuDeck Nedir ve Nasıl Çalışır?](#1-isudeck-nedir-ve-nasıl-çalışır)
2. [İlk Kurulum ve Sürücü Yapılandırması](#2-ilk-kurulum-ve-sürücü-yapılandırması)
3. [Profil ve Tuş Düzeni Yönetimi](#3-profil-ve-tuş-düzeni-yönetimi)
4. [Tuş Özelleştirme & Görünüm](#4-tuş-özelleştirme--görünüm)
   - [Vektör İkonlar (Lucide)](#vektör-ikonlar-lucide)
   - [Eklenti Özgün İkonları (Plugin Icons)](#eklenti-özgün-ikonları-plugin-icons)
   - [Emoji ve Özel Görseller](#emoji-ve-özel-görseller)
5. [Mantık ve Akış Kontrolleri (Logic & Flow Controls)](#5-mantık-ve-akış-kontrolleri-logic--flow-controls)
   - [Değişkenler Sistemi (Variables Engine)](#değişkenler-sistemi-variables-engine)
   - [Sistem Değişkenleri ($sys)](#sistem-değişkenleri-sys)
   - [Dinamik Şablon Değişimi ({vol}% & {$sys.volume}%)](#dinamik-şablon-değişimi-vol--sysvolume)
   - [Windows Ses Düzeyine Sabitleme (Volume Sync)](#windows-ses-düzeyine-sabitleme-volume-sync)
   - [Koşullu Dallanma (If / Else Branching)](#koşullu-dallanma-if--else-branching)
   - [Döngüler ve Tekrarlar (Loop & Repeat)](#döngüler-ve-tekrarlar-loop--repeat)
6. [Eklenti (Plugin) Ekosistemi & OBS Entegrasyonu](#6-eklenti-plugin-ekosistemi--obs-entegrasyonu)
7. [Düşük Gecikmeli Yakalama Mimarisi (Low Latency Engine)](#7-düşük-gecikmeli-yakalama-mimarisi-low-latency-engine)
8. [Sorun Giderme ve Sıkça Sorulan Sorular](#8-sorun-giderme-ve-sıkça-sorulan-sorular)

---

## 1. IsuDeck Nedir ve Nasıl Çalışır?

**IsuDeck**, ikinci bir USB klavyeyi veya numpad'i, ana klavyenizden tamamen izole ederek profesyonel bir makro ve kontrol konsoluna dönüştüren Rust & Tauri tabanlı modern bir masaüstü yazılımıdır.

- **Donanım Düzeyinde İzolasyon:** Windows normal şartlarda tüm klavyeleri tek bir giriş olarak algılar. IsuDeck, düşük seviyeli filtre sürücüsüyle ikincil klavyenizi donanım kimliği (HID) bazında yakalar ve tuşları Windows'a yansıtmadan doğrudan hedeflenen aksiyona yönlendirir.
- **Düşük Kaynak Kullanımı:** Rust arka ucu sayesinde arka planda 40 MB'ın altında RAM tüketir.

---

## 2. İlk Kurulum ve Sürücü Yapılandırması

1. `IsuDeck.exe` dosyasını çalıştırın.
2. Sol menüden **Ayarlar (Settings)** sayfasına gidin.
3. **Donanım Giriş Sürücüsü** bölümünde *"Sürücüyü Yükle"* butonuna tıklayın ve yönetici iznini onaylayın.
4. Kurulum tamamlandıktan sonra bilgisayarınızı **bir defaya mahsus yeniden başlatın**.
5. Bilgisayar açıldığında ikincil klavyeniz IsuDeck tarafından tam izole modda algılanmaya hazır olacaktır.

---

## 3. Profil ve Tuş Düzeni Yönetimi

- **Izgara Boyutları:** 8 Tuş (2x4), 15 Tuş (3x5) ve 32 Tuş (4x8) olmak üzere 3 farklı ızgara düzeni seçebilirsiniz.
- **Çoklu Profil Desteği:** Farklı oyunlar, yayın senaryoları veya çalışma ortamları için sınırsız profil oluşturabilir; profiller arasında tek bir tuşla geçiş yapabilirsiniz (`CHANGE_PROFILE` aksiyonu).
- **Mini Mod & Sabitleme:** Arayüzün üst barındaki pin butonu ile pencereyi daima en üstte tutabilir veya kompakt mini moda geçirebilirsiniz.

---

## 4. Tuş Özelleştirme & Görünüm

Herhangi bir tuşa sağ tıklayarak (veya sol tıklayıp düzenleme moduna girerek) Tuş Editörü'nü açabilirsiniz.

### Vektör İkonlar (Lucide)
IsuDeck, kategorilere ayrılmış (Medya, Sistem, Yayın, Araçlar, Cihazlar vb.) yüzlerce modern vektör ikon içerir. İkonların rengini dilediğiniz renk paletinden seçebilirsiniz.

### Eklenti Özgün İkonları (Plugin Icons)
Kurulu eklentilerin sağladığı özel ikonlar (OBS Studio, Canlı Yayın, Kayıt, Kaynak İkonları vb.) **Eklenti İkonları** sekmesinde listelenir ve filtrelenebilir.

### Emoji ve Özel Görseller
Dahili emoji tablosundan emoji seçebilir veya bilgisayarınızdaki herhangi bir `.png`, `.jpg`, `.svg` görselini tuş ikonu ya da tuş arka planı olarak belirleyebilirsiniz.

---

## 5. Mantık ve Akış Kontrolleri (Logic & Flow Controls)

IsuDeck, gelişmiş bir makro ve akış motoruna sahiptir. Tuşlarınıza sadece statik komutlar değil; akıllı koşullar, değişkenler ve döngüler tanımlayabilirsiniz.

### Değişkenler Sistemi (Variables Engine)
Kullanıcı tanımlı değişkenler değer saklamanızı ve tuş basışlarıyla bu değerleri artırıp azaltmanızı sağlar.
- `SET_VARIABLE`: Belirtilen değişkene sabit bir değer, metin veya başka bir değişkenin değerini atar.
- `CHANGE_VARIABLE`: Değişkeni belirli bir adım miktarınca (`+` veya `-`) artırır ya da azaltır. Minimum ve maksimum sınır koyulabilir (örneğin 0 ile 100 arası).

### Sistem Değişkenleri ($sys)
IsuDeck, işletim sisteminden canlı verileri okur ve şablonlarda kullanmanıza imkan tanır:
- `$sys.volume`: Windows ana ses seviyesi (0-100)
- `$sys.cpu`: Canlı CPU kullanım yüzdesi
- `$sys.ram`: Canlı RAM kullanım yüzdesi
- `$sys.time24` / `$sys.time12`: Güncel saat bilgisi

### Dinamik Şablon Değişimi ({vol}% & {$sys.volume}%)
Tuş başlıklarında ve rozetlerinde `{değişken_adı}` sözdizimini kullanarak canlı değerleri anlık olarak görüntüleyebilirsiniz:
- Buton Başlığı: `Ses: {vol}%`
- Rozet Metni: `{$sys.volume}%`

### Windows Ses Düzeyine Sabitleme (Volume Sync)
`CHANGE_VARIABLE` aksiyonunda **"Windows Ana Ses Düzeyine Sabitle"** seçeneği işaretlendiğinde, tuşa her basıldığında hem `vol` değişkeni güncellenir hem de Windows master ses düzeyi anında belirlenen adım kadar (örneğin `-10` veya `+5`) senkronize edilir.

### Koşullu Dallanma (If / Else Branching)
`IF_CONDITION` aksiyonu ile belirli bir değişkenin veya sistem metriğinin durumuna göre farklı aksiyonları tetikleyebilirsiniz:
- **Operatörler:** `==` (Eşit), `!=` (Eşit Değil), `>` (Büyük), `<` (Küçük), `>=` (Büyük Eşit), `<=` (Küçük Eşit), `contains` (İçerir)
- **Örnek:** Eğer `vol == 0` ise `MUTE` aksiyonunu çalıştır, değilse ses seviyesini göster.

### Döngüler ve Tekrarlar (Loop & Repeat)
`LOOP_REPEAT` aksiyonu bir komut dizisini belirli aralıklarla (ms) istenen tekrar sayısınca ardışık olarak yürütür.

---

## 6. Eklenti (Plugin) Ekosistemi & OBS Entegrasyonu

IsuDeck, bağımsız eklenti mimarisini destekler:
- **OBS Studio Eklentisi:** Sahne değiştirme, stüdyo modu geçişi, ses kaynaklarını susturma/açma, yayın/kayıt başlatma ve sanal kamera kontrolü sunar.
- **Dinamik Rozetler (Live Badges):** Eklentiler butonlara canlı yayın durumu (`LIVE`), kayıt durumu (`REC`), mikrofon durumu (`MUTE`) ve özel kenarlık parlamaları gönderebilir.
- **Eklenti Geliştirme:** Detaylı geliştirici kılavuzu için **[PLUGIN_SDK.md](./PLUGIN_SDK.md)** dosyasına göz atabilirsiniz.

---

## 7. Düşük Gecikmeli Yakalama Mimarisi (Low Latency Engine)

Bilgisayar yüksek CPU yükü altındayken veya ağır oyunlar oynanırken tuş gecikmelerini önlemek için IsuDeck çekirdeği özel olarak optimize edilmiştir:
- **Time-Critical Thread:** Giriş yakalama iş parçacığı Windows `THREAD_PRIORITY_TIME_CRITICAL` seviyesinde çalışır.
- **High Process Priority:** IsuDeck çekirdek süreci `HIGH_PRIORITY_CLASS` ile önceliklendirilir.
- **1ms Precision Timer:** Windows multimedya zamanlayıcısı `timeBeginPeriod(1)` ile 1 milisaniye hassasiyetine çekilerek gecikmeler sıfıra indirilir.

---

## 8. Sorun Giderme ve Sıkça Sorulan Sorular

### İkincil klavyem hala Windows'a harf yazıyor, ne yapmalıyım?
1. **Ayarlar** sayfasından sürücünün kurulu ve aktif olduğunu doğrulayın.
2. Sürücüyü kurduktan sonra bilgisayarı yeniden başlattığınızdan emin olun.
3. Tuş atama sekmesinde tuş kaydederken doğru donanım kimliğinin (HID) yakalandığını kontrol edin.

### OBS Eklentisi bağlanmıyor?
1. OBS Studio içerisinde **Araçlar -> WebSocket Sunucu Ayarları** bölümünden sunucunun etkin ve portun `4455` olduğunu kontrol edin.
2. Şifre belirlediyseniz IsuDeck Eklentiler sayfasında OBS Studio ayarlarından şifreyi girip kaydedin.

---
*IsuDeck — Özgür, Açık Kaynaklı ve Güçlü Sanal Stream Deck Çözümü.*
