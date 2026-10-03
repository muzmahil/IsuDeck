'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import SplashScreen from './SplashScreen';
import DisclaimerModal from './DisclaimerModal';
import useStore from '../store/useStore';
import { fileSystem } from '../utils/fileSystem';

export default function ClientLayout({ children }) {
  const [isReady, setIsReady] = useState(false);
  // Store'dan gerekli her şeyi alıyoruz
  const { 
    connectionStatus,
    setConnectionStatus, 
    setLatency, 
    lastMessage, 
    toast,
    setToast,
    isInputRecording, 
    triggerProfileUpdate, 
    language,
    setLanguage, 
    sendToEngine,
    startListener, // <--- Store'dan çekiyoruz
    loadSettings,  // <--- Ayarları yüklemek için
    loadProfiles,  // <--- RAM cache profilleri yüklemek için
    profiles,
    isMiniMode,
    checkDriver,
    settings,
    updateSetting,
    plugins,
    lastHandledMsgId,
    markMessageHandled
  } = useStore();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [lastInputDisplay, setLastInputDisplay] = useState(null);
  const [executionFeedback, setExecutionFeedback] = useState(null);
  const inputTimeoutRef = useRef(null);
  const lastProcessedMsgIdRef = useRef(null);
  const pingStartRef = useRef(null);
  const pingTimeoutRef = useRef(null);
  const hasStartedRef = useRef(false); // İlk başlatma kontrolü için ref
  const [listenerReady, setListenerReady] = useState(false);

  // --- 1. BAŞLATMA (INIT) ---
  useEffect(() => {
    if (!isReady) return;

    // Dil ayarı (Sistem dili kontrolü)
    let storedLang = localStorage.getItem('isu_language');
    if (!storedLang && settings?.language) {
      storedLang = settings.language;
    }
    if (storedLang) {
      setLanguage(storedLang);
    } else {
      const sysLang = navigator.language || navigator.userLanguage || '';
      const chosen = sysLang.toLowerCase().startsWith('tr') ? 'tr' : 'en';
      setLanguage(chosen);
      localStorage.setItem('isu_language', chosen);
      updateSetting('language', chosen);
    }

    // Ayarları ve Profilleri Yükle (RAM Cache)
    loadSettings();
    loadProfiles();

    // 1️⃣ LISTENER BAŞLAT
    let unlisten;
    (async () => {
      unlisten = await startListener();
      setListenerReady(true);
      // Pluginleri yükle
      sendToEngine({ type: 'LOAD_PLUGINS' });
    })();

    return () => {
        if (unlisten) unlisten();
    };
  }, [isReady, setLanguage, sendToEngine, startListener, loadSettings, loadProfiles]);

  // Tema & Vurgu Rengi Senkronizasyonu
  useEffect(() => {
    const currentTheme = settings?.theme || 'midnight';
    const accent = settings?.accentColor || '#3b82f6';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', currentTheme);
      document.documentElement.style.setProperty('--primary-accent', accent);
      document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim() + ` theme-${currentTheme}`;
    }
  }, [settings?.theme, settings?.accentColor]);

  // 2️⃣ PING LOOP (SADECE CONNECTED / SLOW)
  useEffect(() => {
    if (!listenerReady) return;
    if (connectionStatus !== 'connected' && connectionStatus !== 'slow') return;

    const interval = setInterval(() => {
      if (pingStartRef.current !== null) return;

      pingStartRef.current = performance.now();
      // console.log('➡️ ping');

      sendToEngine({ type: 'ping' });

      pingTimeoutRef.current = setTimeout(() => {
        console.log('❌ ping timeout');
        pingStartRef.current = null;
        setConnectionStatus('disconnected');
      }, 3000);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(pingTimeoutRef.current);
      pingStartRef.current = null;
    };
  }, [listenerReady, connectionStatus, sendToEngine, setConnectionStatus]);

  // 3️⃣ PONG YAKALA
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'pong') {
      // console.log('⬅️ pong');
      clearTimeout(pingTimeoutRef.current);

      const latency = pingStartRef.current
        ? Math.round(performance.now() - pingStartRef.current)
        : 0;

      pingStartRef.current = null;

      setLatency(latency);
      setConnectionStatus(latency > 150 ? 'slow' : 'connected');
    }
  }, [lastMessage, setLatency, setConnectionStatus]);

  // 4️⃣ İLK BAĞLANTIYI TETİKLE & SÜRÜCÜ KONTROLÜ
  useEffect(() => {
    if (!listenerReady) return;
    
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      (async () => {
        const hasDriver = await checkDriver();
        if (!hasDriver) {
          setConnectionStatus('driver_missing');
          setToast({
            title: language === 'tr' ? 'Interception Sürücüsü Gerekli' : 'Interception Driver Required',
            message: language === 'tr' 
              ? 'Donanım tuşlarının yakalanabilmesi için sürücü gerekiyor. Sol alttaki göstergeye veya Ayarlar sekmesine tıklayarak tek tıkla kurabilirsiniz.' 
              : 'Hardware keystroke capture requires the Interception driver. Click the bottom-left status or Settings to install it.',
            variant: 'warning'
          });
        } else {
          setConnectionStatus('connected');
        }
      })();
    }
  }, [listenerReady, checkDriver, setConnectionStatus, setToast, language]);

  // --- 2. INIT BAĞLANTISI (Durum Connected olunca çalışır) ---
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    
    // Bağlantı kuruldu, backend'e gerekli bilgileri yolla
    const initConnection = async () => {
        
        // Socket'in tam oturması ve backend'in hazır olması için kısa bir bekleme
        await new Promise(r => setTimeout(r, 500));

        // Masaüstü için blok listesini yolla
        try {
          const content = await fileSystem.readFile('profiles.json');
          if (content) {
            const profiles = JSON.parse(content);
            const activeProfile = profiles.find(p => p.isActive) || profiles[0];
            const buttons = activeProfile?.buttons || [];
            
            const blocks = buttons
              .filter(btn => btn?.binding?.hid && btn?.binding?.key)
              .map(btn => ({ hid: btn.binding.hid, key: btn.binding.key }));

            if (blocks.length > 0) {
              const initPayload = { type: "init_block_list", blocks: blocks };
              sendToEngine(initPayload);
              console.log('📤 Blok listesi gönderildi.');

              // Garanti olsun diye 1 saniye sonra tekrar gönder (Cold start fix)
              setTimeout(() => {
                sendToEngine(initPayload);
                console.log('📤 Blok listesi tekrar gönderildi (Retry).');
              }, 1000);
            }
          }
        } catch (e) { 
          console.error("Init connection error:", e); 
        }
    };
    
    // Fonksiyonu çağır (Eksik olan parça buydu)
    initConnection();
  }, [connectionStatus, sendToEngine]);

  // --- 3. GLOBAL INPUT DİNLEYİCİSİ (Background Listener) ---
  useEffect(() => {
    if (!lastMessage) return;
    const processMessage = async () => {
      switch (lastMessage.type) {
        case 'inputPressed': {
          if (isInputRecording) return; // Kayıt modundaysa işlem yapma

          // Kompakt Input Göstergesi
          setLastInputDisplay(lastMessage.key);
          if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
          inputTimeoutRef.current = setTimeout(() => setLastInputDisplay(null), 1500);

          // Mükerrer / Eski Mesaj Kontrolü (Sayfa geçişlerinde tetiklenmeyi engeller)
          const msgId = lastMessage._msgId;
          if (msgId && (msgId === lastHandledMsgId || msgId === lastProcessedMsgIdRef.current)) {
            return;
          }

          // Eğer Ana Sayfadaysak (/) bu bloğu atla, çünkü page.js zaten işliyor.
          // Ama başka sayfadaysak (örn: Ayarlar, Profiller, Eklentiler), tuşların çalışması için burası lazım.
          if (pathnameRef.current === '/') return;

          // Mesajı işlendi olarak işaretle
          if (msgId) {
            lastProcessedMsgIdRef.current = msgId;
            markMessageHandled(msgId);
          }

          // Profil ve Buton bulma işlemi (RAM Cache - 0ms gecikme)
          try {
            const currentProfiles = profiles.length > 0 ? profiles : await loadProfiles();
            if (currentProfiles && currentProfiles.length > 0) {
              const activeProfile = currentProfiles.find(p => p.isActive) || currentProfiles[0];
              const buttons = activeProfile?.buttons || [];

              const matchIndex = buttons.findIndex(btn => {
                if (!btn?.binding) return false;

                const btnKey = String(btn.binding.key);
                const msgKey = String(lastMessage.key);

                if (btnKey !== msgKey) return false;

                let isHidMatch = true;
                if (btn.binding.hid && lastMessage.hid) {
                  const bHid = String(btn.binding.hid);
                  const mHid = String(lastMessage.hid);
                  if (bHid !== 'KEYBOARD_HOOK' && mHid !== 'KEYBOARD_HOOK' && bHid !== '*' && mHid !== '*') {
                    isHidMatch = (bHid === mHid);
                  }
                }

                return isHidMatch;
              });

              if (matchIndex !== -1) {
                const button = buttons[matchIndex];

                const payload = {
                  type: 'EXECUTE_ACTION',
                  buttonIndex: matchIndex,
                  actionData: {
                    label: button.label,
                    actions: button.actions || [],
                    binding: button.binding
                  },
                  timestamp: Date.now()
                };
                sendToEngine(payload);

                setExecutionFeedback(`Action: ${button.label}`);
                setTimeout(() => setExecutionFeedback(null), 1500);
              }
            }
          } catch (e) { console.error('Global aksiyon hatası:', e); }
          break;
        }
      }
    };
    processMessage();
  }, [lastMessage, isInputRecording, sendToEngine, lastHandledMsgId, markMessageHandled]);

  // Toast Bildirimlerini Otomatik Kapat
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, setToast]);


  return (
    <>
      {!isReady && <SplashScreen onReady={() => setIsReady(true)} />}
      
      <div className={`flex-1 flex overflow-hidden relative transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
        {isReady && !isMiniMode && <Sidebar />}
        {children}

        {/* Kompakt & Zarif Input Göstergesi */}
        {lastInputDisplay !== null && (
          <div className="fixed bottom-4 right-4 z-[80] bg-[#161616]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-lg shadow-black/50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            <span className="text-[11px] font-mono text-zinc-400 font-medium">INPUT: <span className="text-white font-bold text-xs">{lastInputDisplay}</span></span>
          </div>
        )}
        {executionFeedback && (
          <div className="fixed top-14 right-4 z-50 bg-blue-600/90 text-white px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-xs text-xs font-bold animate-in fade-in">
            <span>{executionFeedback}</span>
          </div>
        )}
      </div>

      {/* GLOBAL TOAST NOTIFICATION (v3.0) */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl border border-white/10 animate-in slide-in-from-top-4 fade-in duration-300 backdrop-blur-md ${
            toast.variant === 'error' ? 'bg-red-500/90 text-white shadow-red-900/20' :
            toast.variant === 'success' ? 'bg-green-500/90 text-white shadow-green-900/20' :
            toast.variant === 'warning' ? 'bg-yellow-500/90 text-white shadow-yellow-900/20' :
            'bg-blue-500/90 text-white shadow-blue-900/20'
        }`}>
            <div className="flex flex-col">
                <span className="font-bold text-sm tracking-wide">{toast.title}</span>
                {toast.message && <span className="text-xs opacity-90 font-medium mt-0.5">{toast.message}</span>}
            </div>
            <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-lg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg>
            </button>
        </div>
      )}

      {/* GÜVENLİK & SORUMLULUK REDDİ BİLGİLENDİRME MODALI */}
      <DisclaimerModal 
        isOpen={settings && settings.disclaimerAccepted === false}
        onAccept={() => updateSetting('disclaimerAccepted', true)}
        language={language}
      />
    </>
  );
}