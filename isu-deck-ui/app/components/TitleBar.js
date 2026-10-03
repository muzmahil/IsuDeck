'use client';

import { useEffect, useState } from 'react';
import useStore from '../store/useStore';

export default function TitleBar() {
  const { settings, isMiniMode, setIsMiniMode, isAlwaysOnTop, toggleAlwaysOnTop, language, t } = useStore();
  const [appWindow, setAppWindow] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten = null;

    // Tauri API'sini sadece istemci tarafında ve Tauri ortamındaysa yükle
    const initTauri = async () => {
      try {
        const mod = await import('@tauri-apps/api/window');
      // Tauri v1 ve v2 uyumluluğu: v2'de getCurrentWindow(), v1'de appWindow kullanılır
      const win = mod.getCurrentWindow ? mod.getCurrentWindow() : mod.appWindow;
      setAppWindow(win);

        const checkMaximized = async () => {
          const max = await win.isMaximized();
          setIsMaximized(max);
        };

        await checkMaximized();

        // Pencere boyutu değiştiğinde durumu güncelle
        if (win.onResized) {
          unlisten = await win.onResized(checkMaximized);
        }
      } catch (err) {
        console.log('Browser mode detected or Tauri API not found', err);
      }
    };

    initTauri();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const toggleMiniMode = async () => {
    if (!appWindow) return;
    
    try {
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      if (isMiniMode) {
        // Normal moda dön (varsayılan: 1200x768)
        await appWindow.setSize(new LogicalSize(1200, 768));
        setIsMiniMode(false);
      } else {
        // Mini moda geç
        await appWindow.setSize(new LogicalSize(380, 560));
        setIsMiniMode(true);
      }
    } catch (err) {
      console.error("Pencere boyutu değiştirilemedi:", err);
    }
  };

  const handleClose = () => {
    if (settings.minimizeToTray) {
      appWindow?.hide();
    } else {
      appWindow?.close();
    }
  };

  const accentColor = settings?.accentColor || '#3b82f6';

  return (
    <div className="relative h-10 bg-[#1a1a1a] flex items-center justify-end select-none border-b border-white/5 shrink-0 z-50">
      {/* Sürükleme Alanı - Butonların altında kalacak şekilde konumlandırıldı */}
      <div data-tauri-drag-region className="absolute inset-0 z-0" />

      {/* Mini modda sola yaslı, normal modda ortalı başlık (çakışmayı önler) */}
      <div className={`absolute ${isMiniMode ? 'left-3 top-1/2 -translate-y-1/2 text-xs font-bold tracking-[0.2em]' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold tracking-[0.3em]'} text-zinc-400 pointer-events-none uppercase drop-shadow-md z-10 flex items-center gap-1.5`}>
        {isMiniMode && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />}
        <span>ISU<span style={{ color: accentColor }}>DECK</span></span>
      </div>
      
      {/* Butonlar - z-index ile sürükleme alanının üzerine çıkarıldı */}
      <div className="flex h-full relative z-20">
        <button
          onClick={toggleAlwaysOnTop}
          type="button"
          tabIndex="-1"
          className={`h-full w-10 flex items-center justify-center transition-colors focus:outline-none cursor-pointer ${
            isAlwaysOnTop 
              ? 'font-bold' 
              : 'hover:bg-white/5 text-zinc-400 hover:text-white'
          }`}
          style={isAlwaysOnTop ? { color: accentColor, backgroundColor: `${accentColor}20` } : {}}
          title={isAlwaysOnTop ? (language === 'tr' ? "Sabitlemeyi Kaldır" : "Unpin Window") : (language === 'tr' ? "Her Zaman Üstte Sabitle" : "Always on Top")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isAlwaysOnTop ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" x2="12" y1="17" y2="22"/>
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
          </svg>
        </button>
        <button
          onClick={toggleMiniMode}
          type="button"
          tabIndex="-1"
          className="h-full w-12 flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
          title={isMiniMode ? (language === 'tr' ? "Genişlet" : "Expand") : (language === 'tr' ? "Mini Mod" : "Mini Mode")}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><rect x="1" y="7" width="8" height="2" rx="0.5" /><rect x="1" y="1" width="8" height="4" rx="0.5" opacity="0.5" /></svg>
        </button>
        <button
          onClick={() => appWindow?.minimize()}
          type="button"
          tabIndex="-1"
          className="h-full w-12 flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button
          onClick={() => appWindow?.toggleMaximize()}
          type="button"
          tabIndex="-1"
          className="h-full w-12 flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M3.5 3.5H8.5V8.5H3.5V3.5Z" /><path d="M1.5 1.5H6.5V6.5H1.5V1.5Z" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><rect x="1.5" y="1.5" width="7" height="7" /></svg>
          )}
        </button>
        <button
          onClick={handleClose}
          type="button"
          tabIndex="-1"
          className="h-full w-12 flex items-center justify-center hover:bg-red-500 text-zinc-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M1 1L9 9M9 1L1 9" /></svg>
        </button>
      </div>
    </div>
  );
}