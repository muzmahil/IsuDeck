'use client';

import { useEffect, useState } from 'react';
// import { motion } from 'framer-motion'; 
import { fileSystem } from '../utils/fileSystem';
import useStore from '../store/useStore';
// Tauri v2 Window API (Kapatma butonu için static import daha temizdir)
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function SplashScreen({ onReady }) {
  const { language, settings } = useStore();
  const isTr = language === 'tr';
  const accentColor = settings?.accentColor || '#3b82f6';
  const theme = settings?.theme || 'dark';
  const [status, setStatus] = useState(isTr ? 'Sistem başlatılıyor...' : 'Starting system...');
  const [progress, setProgress] = useState(0);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const runSystemChecks = async () => {
      // 1. Sistem Bütünlüğü
      setStatus(isTr ? 'Sistem dosyaları kontrol ediliyor...' : 'Checking system files...');
      setProgress(10);
      await new Promise((r) => setTimeout(r, 600));

      // 2. Dosya Sistemi (Tauri FS)
      setStatus(isTr ? 'Dosya sistemi ve profiller kontrol ediliyor...' : 'Verifying file system and profiles...');
      setProgress(30);

      try {
        // 1. Ana Klasörü Başlat
        await fileSystem.init();

        // 2. Ayarlar Dosyası
        const defaultSettings = { theme: 'dark', port: 12345 };
        await fileSystem.ensureFile('settings.json', defaultSettings);

        // 3. Profil Dosyası
        const defaultProfiles = [{ id: 'default', name: 'Main Profile', buttons: Array(15).fill(null) }];
        await fileSystem.ensureFile('profiles.json', defaultProfiles);
        
      } catch (e) {
        console.warn('Dosya sistemi başlatılamadı:', e);
      }
      
      await new Promise((r) => setTimeout(r, 600));

      // 5. Pluginler
      setStatus(isTr ? 'Eklentiler taranıyor...' : 'Scanning plugins...');
      setProgress(90);
      try {
        const loadedPlugins = await fileSystem.scanPlugins();
        useStore.getState().setPlugins(loadedPlugins);
        useStore.getState().sendToEngine({ type: 'LOAD_PLUGINS' });
      } catch (e) {
        console.error('Plugin yükleme hatası:', e);
      }
      await new Promise((r) => setTimeout(r, 300));

      // Bitti
      setStatus(isTr ? 'Hazır!' : 'Ready!');
      setProgress(100);
      await new Promise((r) => setTimeout(r, 300));
      
      onReady();
    };

    runSystemChecks();
  }, [onReady, isTr]);

  // --- DÜZELTME 2: Kapatma Fonksiyonu ---
  const handleCloseApp = async () => {
    try {
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Kapatma hatası:", err);
    }
  };

  const bgStyle = theme === 'light' 
    ? 'bg-[#f8fafc] text-zinc-900' 
    : theme === 'midnight' 
      ? 'bg-[#0b0f17] text-white' 
      : 'bg-[#121212] text-white';

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${bgStyle} select-none transition-colors duration-300`}>
      {!isError ? (
        <>
          {/* Logo Alanı */}
          <div className="mb-8 relative">
            <div className="w-25 h-25 rounded-2xl flex items-center justify-center animate-pulse" style={{ boxShadow: `0 0 35px ${accentColor}40` }}>
               <img src="/isudeck_logo.png" alt="IsuDeck Logo" className="w-25 h-25 rounded-lg logo-img" />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-1">
            Isu<span style={{ color: accentColor }}>Deck</span>
          </h1>
          <p className="text-zinc-400 text-xs font-medium">v1.0.0</p>
          <p className="text-zinc-500 text-[11px] font-medium mb-8">IsuDeck by rootcf • GNU GPL v3</p>

          {/* Progress Bar */}
          <div className="w-64 h-1.5 bg-zinc-800/40 rounded-full overflow-hidden mb-4 border border-white/5">
            <div 
              className="h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%`, backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
            />
          </div>

          <p className="text-xs text-zinc-400 font-medium h-4">{status}</p>
        </>
      ) : (
        <>
          <div className="mb-6 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{isTr ? 'Başlatma Hatası' : 'Startup Error'}</h2>
          <p className="text-red-400 font-medium text-center max-w-md mb-8 px-4 text-sm">{status.replace('HATA: ', '').replace('ERROR: ', '')}</p>
          
          <button 
            onClick={handleCloseApp}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-red-900/20 flex items-center gap-2 cursor-pointer"
          >
            {isTr ? 'Uygulamayı Kapat' : 'Close Application'}
          </button>
        </>
      )}
    </div>
  );
}