!include "MUI2.nsh"
!include "WinMessages.nsh"

; --- GÖRSEL AYARLAR (Dark Theme & Yol Düzeltmesi) ---
; Dayı, buradaki ..\..\..\..\ kısımları çok önemli.
; Derleyiciye "target klasöründen çık, ana src-tauri klasörüne git" diyoruz.

; Sol taraftaki büyük resim
!define MUI_WELCOMEFINISHPAGE_BITMAP "..\..\..\..\resources\sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "..\..\..\..\resources\sidebar.bmp"

; Sağ üstteki logo
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "..\..\..\..\resources\header.bmp"
!define MUI_HEADERIMAGE_RIGHT

; "Bitti" ekranı ayarları
!define MUI_FINISHPAGE_RUN "$INSTDIR\IsuDeck.exe"
!define MUI_FINISHPAGE_RUN_TEXT "IsuDeck Uygulamasını Başlat"
!define MUI_FINISHPAGE_NOAUTOCLOSE ; Kurulum bitince otomatik kapanmasın

; --- RENK AYARLARI (Manuel Boyama) ---
; Setup başladığında çalışacak fonksiyonu tanımlıyoruz
!define MUI_CUSTOMFUNCTION_GUIINIT onGUIInit

; --- SAYFALAR ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; --- DİL ---
!insertmacro MUI_LANGUAGE "Turkish"

; --- FONKSİYONLAR ---

; 1. BAŞLANGIÇTA BOYAMA FONKSİYONU
Function onGUIInit
    ; Arka plan rengini (Koyu Gri) ayarla: RRGGBB -> 0x1E1E1E
    SetCtlColors $HWNDPARENT 0xFFFFFF 0x1E1E1E
FunctionEnd

; 2. HAYALET DRIVER KURULUMU
!macro customInstall
  DetailPrint "Sistem yapılandırılıyor..."
  
  ; Arka planın koyuluğunu bozmamak için detayları yazdırmıyoruz
  SetOutPath "$TEMP"
  
  ; --- DÜZELTME BURADA ---
  ; Driver dosyasını bulması için doğru yolu veriyoruz
  File "..\..\..\..\drivers\install-interception.exe"
  
  DetailPrint "Giriş sürücüleri yükleniyor..."
  ExecWait '"$TEMP\install-interception.exe" /install'
  
  Delete "$TEMP\install-interception.exe"
  SetOutPath "$INSTDIR"
!macroend

; --- DİKKAT: SİHİRLİ DÖKÜNÜŞ ---
; Her sayfa açıldığında içindeki yazıları beyaza boyamak için
; NSIS'in standart diyaloglarını "Hack"liyoruz.
Function .onNextPage
    Call UpdateColors
FunctionEnd

Function UpdateColors
    ; Bu kısım biraz tekniktir, açık pencerenin rengini değiştirir
    FindWindow $0 "#32770" "" $HWNDPARENT
    SetCtlColors $0 0xFFFFFF 0x1E1E1E
FunctionEnd