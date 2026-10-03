# IsuDeck 🎛️

<p align="center">
  <strong>Eski klavyenizi sanal bir Stream Deck'e dönüştürün.</strong><br>
  <em>Turn any spare secondary keyboard or numpad into a dedicated, driver-isolated Virtual Stream Deck.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(64--bit)-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Built%20With-Tauri%20v2%20%2B%20Rust-orange?style=flat-square" alt="Rust Tauri">
  <img src="https://img.shields.io/badge/Frontend-Next.js%2016%20(React)-black?style=flat-square" alt="Next.js">
  <img src="https://img.shields.io/badge/RAM%20Usage-%3C%2040%20MB-emerald?style=flat-square" alt="RAM Usage">
  <img src="https://img.shields.io/badge/License-GPL--3.0-purple?style=flat-square" alt="License">
</p>

---

## 💡 IsuDeck Nedir? (What is IsuDeck?)

**IsuDeck by rootcf**, masanızda veya çekmecenizde duran ikinci bir USB klavyeyi ya da harici bir numpad'i, ana klavyenizden **tamamen bağımsız çalışan** profesyonel bir kontrol konsoluna (Sanal Stream Deck) dönüştüren açık kaynaklı bir masaüstü uygulamasıdır.

Piyasadaki özel donanım konsolları binlerce liraya mal olurken, IsuDeck halihazırda sahip olduğunuz donanımları değerlendirmenizi sağlar.

### 🎯 En Önemli Farkı: Donanım Düzeyinde İzolasyon
Windows standart olarak iki klavyeyi tek bir cihaz gibi algılar. İkinci klavyenizde bir harfe bastığınızda, normalde o an açık olan oyunda karakteriniz yürür veya yazı yazdığınız sohbete harf eklenir.

**IsuDeck**, düşük seviyeli **Interception** sürücüsü sayesinde klavyeleri donanım kimlikleriyle (HID) ayırt eder:
- İkinci klavyenizdeki tuş vuruşları Windows'a gitmeden işletim sistemi seviyesinde **yutulur (swallow)**.
- Ana klavyeniz, oyunlarınız veya metin belgeleriniz asla bölünmez.
- Yalnızca sizin atadığınız makro, ses efekti veya yayın aksiyonu anında tetiklenir.

---

## ✨ Öne Çıkan Özellikler

- 🦀 **Rust & Tauri v2 ile Yüksek Performans:** 500 MB RAM tüketen hantal Electron uygulamalarının aksine, arka planda **40 MB'ın altında bellek** kullanır. Oyunlarınızda tek bir kare (FPS) kaybı yaşatmaz.
- ⚡ **Düşük Gecikmeli Yakalama Mimarisi:** `THREAD_PRIORITY_TIME_CRITICAL`, `HIGH_PRIORITY_CLASS` ve 1ms Windows multimedya zamanlayıcısı ile yüksek sistem yükü altında bile sıfır gecikmeli tuş tepkisi.
- 🧠 **Mantık & Akış Kontrolleri (Logic & Flow Engine):** Değişkenler (`vol`, `counter`), sistem metrikleri (`$sys.volume`, `$sys.cpu`), koşullu dallanma (`If/Else`), döngüler (`Loop`) ve tuş başlıklarında canlı şablonlar (`{vol}%`).
- 🔊 **Windows Ses Düzeyine Sabitleme:** Değişkenleri Windows Master Volume ile senkronize ederek tek tuşla hassas ses artırma/azaltma.
- ⌨️ **Sınırsız Tuş Sayısı:** 15 tuşlu standart konsollarla sınırlı kalmayın. Tam boy bir klavye bağlayarak 104'ten fazla bağımsız kontrol tuşuna sahip olun.
- 💡 **Canlı Durum Rozetleri (Dynamic State Badges):** Eklentiler (örn: OBS Studio) tuşların durumunu gerçek zamanlı günceller. Yayındayken `LIVE`, mikrofon susturulduğunda `MUTE`, kayıt alırken nabız gibi yanıp sönen `REC` rozeti belirir.
- 🎨 **Vektör & Eklenti Özgün İkonları:** Lucide vektör ikon kütüphanesi, eklentilerin sağladığı özel ikonlar, emojiler veya özel PNG/SVG görselleri.
- 🔌 **Açık Eklenti (Plugin) Mimarisi:** İki yönlü JSON-RPC stdio protokolü sayesinde Python, Rust, C# veya Node.js ile IsuDeck'e saniyeler içinde yeni eklentiler yazabilirsiniz.
- 📦 **%100 Taşınabilir (Portable):** Kayıt defteri (registry) kirliliği yok. Tek bir `.exe` dosyasını flash belleğe atıp dilediğiniz bilgisayarda kullanabilirsiniz.

---

## 📚 Dokümantasyon & Kullanım Kılavuzları

- 🇹🇷 **[KULLANIM_KILAVUZU.md](./KULLANIM_KILAVUZU.md)** — Türkçe detaylı kullanım, kurulum ve mantık kontrolleri kılavuzu.
- 🇬🇧 **[USER_GUIDE.md](./USER_GUIDE.md)** — English comprehensive user guide and features walkthrough.
- 🔌 **[PLUGIN_SDK.md](./PLUGIN_SDK.md)** — Eklenti geliştiricileri için SDK ve JSON-RPC protokol rehberi.

---

## 📊 Karşılaştırma

| Ölçüt | Özel Donanım Konsolları | IsuDeck |
|---|:---:|:---:|
| **Donanım Maliyeti** | 4.500 TL – 8.000 TL | **0 TL** (Eski klavyeniz) |
| **Kullanılabilir Tuş Sayısı** | 6 / 15 / 32 tuş (Sabit) | **104+ tuş** (Tam boy klavye) |
| **Sistem Bellek Kullanımı** | 200 – 600 MB RAM | **< 40 MB RAM** (Rust) |
| **Klavyeyi İzole Etme** | Yok (Özel donanım şart) | **Var** (Kernel Sürücüsü ile) |
| **Yazılım Lisansı** | Kapalı / Tescilli | **Özgür ve Açık Kaynak (GNU GPL v3)** |

---

## 🚀 Hızlı Başlangıç (Quick Start)

### 1. İndirin ve Çalıştırın
[Releases](../../releases) sayfasından `IsuDeck.exe` dosyasını indirin. Kurulum gerekmez, çift tıklayıp açın.

### 2. Sürücüyü Yükleyin (Tek Seferlik)
IsuDeck ilk açıldığında klavyeleri ayırabilmek için sürücü kontrolü yapar:
- **Ayarlar** menüsünden **"Sürücüyü Yükle"** butonuna basın.
- İşlem tamamlandığında bilgisayarınızı **bir defaya mahsus yeniden başlatın**.

### 3. İkinci Klavyenizi Bağlayın ve Tuş Atayın
- Eski USB klavyenizi veya numpad'inizi bilgisayara takın.
- IsuDeck arayüzünde dilediğiniz bir tuşa tıklayın.
- **Tuş Ata (Key Binding)** sekmesinden *"Tuş Kaydet"*e basıp ikinci klavyenizdeki tuşa basın.
- Aksiyonunuzu (Medya kontrolü, Uygulama Başlatma, Metin Yazma veya OBS sahne değişimi) seçin ve kaydedin!

---

## 🔌 Eklenti (Plugin) Ekosistemi

IsuDeck, temel ihtiyaçları hafif bir çekirdekte sunar. OBS Studio, Spotify, Discord gibi gelişmiş entegrasyonlar ise eklentilerle sağlanır.

Eklentiler bağımsız çalıştırılabilir ikililerdir (`.exe`, Python vb.) ve IsuDeck ile standart `stdin`/`stdout` üzerinden JSON-RPC ile haberleşir.

Kendi eklentinizi nasıl yazacağınızı öğrenmek için **[PLUGIN_SDK.md](./PLUGIN_SDK.md)** kılavuzunu inceleyin.

---

## 🛠️ Kaynak Koddan Derleme (Build from Source)

IsuDeck'i yerel ortamınızda derlemek için aşağıdaki gereksinimlerin yüklü olması gerekir:
- [Node.js](https://nodejs.org/) (v18+)
- [Rust & Cargo](https://rustup.rs/) (v1.75+)
- Visual Studio C++ Build Tools

### Adımlar:

```bash
# 1. Repoyu klonlayın
git clone https://github.com/your-username/IsuDeck.git
cd IsuDeck

# 2. Arayüz bağımlılıklarını yükleyin
cd isu-deck-ui
npm install

# 3. Geliştirme modunda çalıştırın
npm run tauri dev

# 4. Dağıtım için release ikilisini derleyin
npm run build
npm run tauri build
```

Derlenen tek parça `.exe` dosyası `isu-deck-ui/src-tauri/target/release/app.exe` konumunda oluşur.

---

## 📂 Proje Dizin Yapısı

```text
IsuDeck/
├── IsuDeck.exe            # Ana taşınabilir uygulama
├── interception.dll       # Düşük seviyeli klavye filtre kütüphanesi
├── drivers/               # Interception kernel filtre sürücüsü yükleyicisi
├── plugins/               # Kullanıma hazır eklentiler (IsuDeck.OBSPlugin vb.)
├── plugins-source/        # Dahili eklentilerin kaynak kodları (Rust/C#)
├── sounds/                # Dahili mekanik ve klik ses efektleri
├── website/               # Tanıtım ve dokümantasyon web sitesi (HTML/CSS/JS)
├── isu-deck-ui/           # Ana uygulama kaynak kodları
│   ├── app/               # Next.js 16 kullanıcı arayüzü & bileşenler
│   └── src-tauri/         # Rust backend, donanım yöneticisi & eklenti motoru
├── PLUGIN_SDK.md          # Eklenti geliştiricileri için detaylı SDK rehberi
└── README.md              # Bu belge
```

---

## 🛡️ Güvenlik & Şeffaflık (Security & Trust)

IsuDeck, klavyeleri donanım kimlikleriyle ayırabilmek için açık kaynaklı [Interception](https://github.com/oblitum/Interception) sürücüsünü kullanır.
- IsuDeck bir keylogger **değildir**.
- Yalnızca sizin IsuDeck üzerinde **özellikle atadığınız** ikincil klavye tuşlarını dinler.
- İnternete hiçbir kullanıcı verisi, tuş kaydı veya telemetri göndermez.
- Tüm kaynak kodlar herkese açık, denetlenebilir ve şeffaftır.

---

## 🤝 Katkıda Bulunma (Contributing)

Katkılarınızı memnuniyetle kabul ediyoruz!
1. Bu depoyu çatallayın (Fork).
2. Yeni bir özellik dalı oluşturun (`git checkout -b feature/harika-ozellik`).
3. Değişikliklerinizi kaydedin (`git commit -m 'feat: Harika özellik eklendi'`).
4. Dalınızı gönderin (`git push origin feature/harika-ozellik`).
5. Bir Çekme İsteği (Pull Request) açın.

---

## 📄 Lisans (License)

**IsuDeck by rootcf**

Bu proje **GNU Genel Kamu Lisansı v3 (GNU GPL v3)** kapsamında lisanslanmıştır. Telif Hakkı (C) 2026 rootcf.

Tüm lisans şartları ve yasal haklarınız için [LICENSE.md](./LICENSE.md) dosyasını inceleyebilirsiniz.
