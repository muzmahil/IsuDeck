'use client';

import { useState, useEffect, useRef } from 'react';
import useStore from '../../store/useStore';

export default function SettingsPage() {
  const { 
    language, 
    setLanguage, 
    settings, 
    updateSetting, 
    latency, 
    customSounds, 
    setCustomSounds,
    setToast 
  } = useStore();

  const [driverLoading, setDriverLoading] = useState(false);
  const [driverStatus, setDriverStatus] = useState('uninstalled'); // 'active' | 'reboot_required_uninstall' | 'reboot_required_install' | 'uninstalled'
  const [driverModal, setDriverModal] = useState({
    open: false,
    stage: 'idle', // 'processing' | 'success' | 'error'
    action: 'install',
    errorMessage: ''
  });
  const [soundList, setSoundList] = useState(customSounds || ['click.wav', 'mech.wav', 'beep.wav']);
  const bgFileInputRef = useRef(null);
  const accentColor = settings?.accentColor || '#3b82f6';

  const checkDriver = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let status = 'uninstalled';
      try {
        status = await invoke('check_driver_status');
      } catch (_) {
        const inst = await invoke('check_driver_installed');
        status = inst ? 'active' : 'uninstalled';
      }
      setDriverStatus(status);
    } catch (err) {
      console.log('Driver kontrol hatası:', err);
    }
  };

  useEffect(() => {
    checkDriver();

    const fetchSounds = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const list = await invoke('list_custom_sounds');
        if (list && list.length > 0) {
          setSoundList(list);
          setCustomSounds(list);
        }
      } catch (err) {
        console.log('Ses listesi alma hatası:', err);
      }
    };
    fetchSounds();
  }, [setCustomSounds]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    updateSetting('language', newLang);
    localStorage.setItem('isu_language', newLang);
  };

  const handleToggle = (key) => {
    const current = settings[key] !== undefined ? settings[key] : false;
    updateSetting(key, !current);
  };

  const handleDriverAction = async (action) => {
    setDriverLoading(true);
    setDriverModal({
      open: true,
      stage: 'processing',
      action,
      errorMessage: ''
    });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('manage_driver', { action });
      await checkDriver();

      setDriverModal({
        open: true,
        stage: 'success',
        action,
        errorMessage: ''
      });
    } catch (err) {
      setDriverModal({
        open: true,
        stage: 'error',
        action,
        errorMessage: String(err)
      });
    } finally {
      setDriverLoading(false);
    }
  };

  const handleRestartSystem = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('restart_system');
    } catch (err) {
      console.error('Restart hatası:', err);
    }
  };

  const handleOpenSoundsDir = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_sounds_dir');
    } catch (err) {
      console.log('Ses klasörü açılamadı:', err);
    }
  };

  const handleTestSound = async (soundName) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('play_sound_file', { sound: soundName });
    } catch {
      const audio = new Audio(`/sounds/${soundName}`);
      audio.play().catch(() => {});
    }
  };

  const selectedSound = settings.selectedSound || 'click.wav';

  return (
    <main className="flex-1 bg-[#121212] p-4 sm:p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        {/* Başlık */}
        <div className="border-b border-white/5 pb-4">
          <h1 className="text-xl font-bold text-white tracking-tight">
            {language === 'tr' ? 'Ayarlar' : 'Settings'}
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            {language === 'tr' ? 'Giriş mekanizması, sesler ve sistem tercihleri' : 'Input engine, audio and system preferences'}
          </p>
        </div>

        {/* 1. DONANIM GİRİŞ MOTORU (INTERCEPTION KERNEL DRIVER) */}
        <div className="bg-[#181818] border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {language === 'tr' ? 'Donanım Giriş Motoru (Interception)' : 'Hardware Input Engine (Interception)'}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {language === 'tr' ? 'Dinleyici ve donanım izolasyonu' : 'Listener and hardware isolation'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 text-[11px] text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${
                driverStatus === 'active' ? 'bg-green-500' :
                driverStatus.startsWith('reboot_required') ? 'bg-amber-500 animate-pulse' : 'bg-zinc-500'
              }`} />
              <span>
                {driverStatus === 'active' 
                  ? (language === 'tr' ? 'Aktif' : 'Active')
                  : driverStatus === 'reboot_required_uninstall'
                  ? (language === 'tr' ? 'Yeniden Başlatma Bekleniyor' : 'Reboot Required')
                  : driverStatus === 'reboot_required_install'
                  ? (language === 'tr' ? 'Yeniden Başlatma Bekleniyor' : 'Reboot Required')
                  : (language === 'tr' ? 'Sürücü Yok' : 'Missing')}
              </span>
            </div>
          </div>

          <div className="bg-[#141414] border border-white/10 rounded-xl p-4 space-y-4">
            {driverStatus === 'active' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                    <span className="text-xs font-bold text-white">
                      {language === 'tr' ? 'Kernel Sürücüsü Aktif & Çalışıyor' : 'Kernel Driver Active & Running'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {language === 'tr' 
                      ? 'Tuşlar doğrudan donanım portu seviyesinde filtreleniyor ve diğer pencerelere sızması engelleniyor.' 
                      : 'Keys are filtered at hardware port level, preventing key leakage into other windows.'}
                  </p>
                  <p className="text-[11px] text-zinc-500 pt-1">
                    {language === 'tr' 
                      ? 'İpucu: Bir rekabetçi oyun (Vanguard, FACEIT vb.) uyarı verirse sürücüyü buradan tek tıkla sessizce kaldırabilirsiniz.' 
                      : 'Tip: If a competitive game (Vanguard, FACEIT, etc.) shows a notice, you can uninstall the driver with one click.'}
                  </p>
                </div>
                <button
                  disabled={driverLoading}
                  onClick={() => handleDriverAction('uninstall')}
                  className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  <span>{driverLoading ? '...' : (language === 'tr' ? 'Sürücüyü Kaldır' : 'Uninstall Driver')}</span>
                </button>
              </div>
            )}

            {driverStatus === 'reboot_required_uninstall' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-bold text-amber-300">
                      {language === 'tr' ? 'Sürücü Kaldırıldı (Yeniden Başlatma Bekleniyor)' : 'Driver Uninstalled (Reboot Required)'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {language === 'tr'
                      ? 'Sürücü kaydı silindi. Fikrinizi değiştirdiyseniz bilgisayarı yeniden başlatmadan doğrudan "Sürücüyü Tekrar Kur" diyerek anında tekrar aktif edebilirsiniz.'
                      : 'Driver registry entry removed. If you changed your mind, click "Re-install Driver" to activate it immediately without rebooting.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={driverLoading}
                    onClick={() => handleDriverAction('install')}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>{language === 'tr' ? 'Sürücüyü Tekrar Kur' : 'Re-install Driver'}</span>
                  </button>
                  <button
                    onClick={handleRestartSystem}
                    className="px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>{language === 'tr' ? 'Şimdi Yeniden Başlat' : 'Restart PC Now'}</span>
                  </button>
                </div>
              </div>
            )}

            {driverStatus === 'reboot_required_install' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                    <span className="text-xs font-bold text-blue-300">
                      {language === 'tr' ? 'Sürücü Kuruldu (Yeniden Başlatma Bekleniyor)' : 'Driver Installed (Reboot Required)'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {language === 'tr'
                      ? 'Interception sürücüsü kaydedildi. Tuşların yakalanabilmesi için bilgisayarınızı yeniden başlatın veya fikrinizi değiştirdiyseniz kurulumu iptal edin.'
                      : 'Interception driver registered. Restart your computer to activate keystroke interception, or cancel if you changed your mind.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleRestartSystem}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>{language === 'tr' ? 'Şimdi Yeniden Başlat' : 'Restart PC Now'}</span>
                  </button>
                  <button
                    disabled={driverLoading}
                    onClick={() => handleDriverAction('uninstall')}
                    className="px-3.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>{language === 'tr' ? 'Kurulumu İptal Et' : 'Cancel Install'}</span>
                  </button>
                </div>
              </div>
            )}

            {driverStatus === 'uninstalled' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/40 shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white">
                      {language === 'tr' ? 'Donanım İzolasyon Sürücüsü Yüklü Değil (İsteğe Bağlı)' : 'Hardware Isolation Driver Not Installed (Optional)'}
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {language === 'tr'
                        ? 'IsuDeck sürücü olmadan da ekrandan tıklama, mobil arayüz ve tüm eklentilerle kusursuz çalışır.'
                        : 'IsuDeck works completely fine without a driver for on-screen touch/mouse clicking and all plugins.'}
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed pt-0.5">
                      {language === 'tr'
                        ? 'Ancak harici bir fiziksel klavyeyi (numpad/ikincil klavye) tuşlarının diğer programlara sızmasını engelleyerek deck olarak kullanmak istiyorsanız bu sürücüyü kurmanız gerekir.'
                        : 'However, to isolate a secondary physical keyboard/numpad and prevent keystrokes leaking into other apps, this driver is required.'}
                    </p>
                    <p className="text-[11px] text-zinc-500 pt-0.5">
                      {language === 'tr'
                        ? 'Kurulum sonrasında bilgisayarınızı bir kez yeniden başlatmanız yeterlidir.'
                        : 'A one-time PC restart is required after driver installation.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    disabled={driverLoading}
                    onClick={() => handleDriverAction('install')}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>{driverLoading ? '...' : (language === 'tr' ? 'Sürücüyü Kur' : 'Install Driver')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. BUTON SESLERİ & ÖZEL SES KLASÖRÜ */}
        <div className="bg-[#181818] border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {language === 'tr' ? 'Tıklama Sesleri & Özel Klasör' : 'Click Sounds & Custom Audio'}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {language === 'tr' ? 'Tuşlara basıldığında oynatılacak varsayılan ses' : 'Default sound played on keystrokes'}
              </p>
            </div>
            <button
              onClick={() => handleToggle('defaultSoundFeedback')}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                settings.defaultSoundFeedback !== false ? 'bg-blue-600' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                  settings.defaultSoundFeedback !== false ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <select
                value={selectedSound}
                onChange={(e) => {
                  updateSetting('selectedSound', e.target.value);
                  handleTestSound(e.target.value);
                }}
                className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 appearance-none pr-8 cursor-pointer"
              >
                {soundList.map(sound => (
                  <option key={sound} value={sound}>{sound}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>

            <button
              onClick={() => handleTestSound(selectedSound)}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>{language === 'tr' ? 'Dinle' : 'Play'}</span>
            </button>

            <button
              onClick={handleOpenSoundsDir}
              className="px-3 py-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>{language === 'tr' ? 'Ses Klasörünü Aç' : 'Open Sounds Folder'}</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 pt-1">
            {language === 'tr'
              ? 'Klasöre .mp3 veya .wav dosyalarınızı atarak IsuDeck içinde istediğiniz sesi kullanabilirsiniz.'
              : 'You can drop .mp3 or .wav files into the sounds folder to use them in IsuDeck.'}
          </p>
        </div>

        {/* 3. GENEL TERCİHLER */}
        <div className="bg-[#181818] border border-white/5 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white border-b border-white/5 pb-3">
            {language === 'tr' ? 'Genel Tercihler' : 'General Preferences'}
          </h2>

          {/* Dil */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Uygulama Dili' : 'Language'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'Arayüz dilini seçin' : 'Select interface language'}</p>
            </div>
            <select
              value={language}
              onChange={handleLanguageChange}
              className="bg-[#121212] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer min-w-[120px]"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="h-px bg-white/5" />

          {/* Görsel Tema & Atmosfer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Görsel Tema & Atmosfer' : 'Visual Theme & Atmosphere'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'Arayüz stilini seçin' : 'Choose interface appearance theme'}</p>
            </div>
            <div className="flex bg-[#121212] p-1 rounded-lg border border-white/10 gap-1">
              {[
                { id: 'midnight', label: 'Midnight Studio' },
                { id: 'dark', label: language === 'tr' ? 'Koyu (Dark)' : 'Dark' },
                { id: 'light', label: language === 'tr' ? 'Açık (Light)' : 'Light' }
              ].map(thm => (
                <button
                  key={thm.id}
                  onClick={() => updateSetting('theme', thm.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    (settings.theme || 'midnight') === thm.id ? 'text-white font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                  style={(settings.theme || 'midnight') === thm.id ? { backgroundColor: accentColor } : {}}
                >
                  {thm.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Renk Teması */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Renk Teması' : 'Color Theme'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'Logolarda, butonlarda ve arayüz vurgularında kullanılan renk paleti' : 'Palette used for logos, buttons and interface accents'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'].map(c => (
                <button
                  key={c}
                  onClick={() => updateSetting('accentColor', c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${accentColor.toLowerCase() === c.toLowerCase() ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110 opacity-75 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20 cursor-pointer shadow-md">
                <input
                  type="color"
                  value={accentColor.startsWith('#') && accentColor.length === 7 ? accentColor : '#3b82f6'}
                  onChange={(e) => updateSetting('accentColor', e.target.value)}
                  className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer bg-transparent border-none"
                  title="Özel Renk"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Deck Arka Plan Işığı (Ambient Glow) */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Deck Ortam Işığı (Ambient Glow)' : 'Deck Ambient Backlight'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'Deck ızgarasının arkasında yumuşak renkli ışık yay' : 'Emit soft accent glow behind the deck grid'}</p>
            </div>
            <button
              onClick={() => updateSetting('deckBacklight', settings?.deckBacklight === false ? true : false)}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                settings?.deckBacklight !== false ? 'bg-blue-600' : 'bg-zinc-800'
              }`}
              style={settings?.deckBacklight !== false ? { backgroundColor: accentColor } : {}}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.deckBacklight !== false ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Minimize to Tray */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Sistem Tepsisine Küçült' : 'Minimize to Tray'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'Kapatıldığında arka planda çalışmaya devam eder' : 'Keep running in system tray on close'}</p>
            </div>
            <button
              onClick={() => handleToggle('minimizeToTray')}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                settings.minimizeToTray ? 'bg-blue-600' : 'bg-zinc-800'
              }`}
              style={settings.minimizeToTray ? { backgroundColor: accentColor } : {}}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings.minimizeToTray ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Varsayılan Başlık Göster */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Buton Başlıklarını Göster' : 'Show Button Titles'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'Varsayılan olarak butonlarda metin görünsün' : 'Display text labels on buttons by default'}</p>
            </div>
            <button
              onClick={() => handleToggle('defaultShowTitle')}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                settings.defaultShowTitle !== false ? 'bg-blue-600' : 'bg-zinc-800'
              }`}
              style={settings.defaultShowTitle !== false ? { backgroundColor: accentColor } : {}}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings.defaultShowTitle !== false ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Eklenti Dinamik Durum Rozetleri */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Eklenti Dinamik Durum Rozetleri' : 'Plugin Dynamic Status Badges'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'OBS, Spotify vb. eklentilerin butonlarda dinamik durum bilgisi (REC, LIVE, MUTE vb.) göstermesine izin ver' : 'Allow plugins (OBS, Spotify, System Monitors, etc.) to show dynamic state badges (REC, LIVE, MUTE, etc.) on buttons'}</p>
            </div>
            <button
              onClick={() => handleToggle('enableDynamicButtonStates')}
              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                settings.enableDynamicButtonStates !== false ? 'bg-blue-600' : 'bg-zinc-800'
              }`}
              style={settings.enableDynamicButtonStates !== false ? { backgroundColor: accentColor } : {}}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings.enableDynamicButtonStates !== false ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Varsayılan Izgara Boyutu */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-white">{language === 'tr' ? 'Varsayılan Buton Sayısı' : 'Default Grid Size'}</span>
              <p className="text-[11px] text-zinc-500">{language === 'tr' ? 'Yeni profiller için ızgara boyutu' : 'Button layout for new profiles'}</p>
            </div>
            <div className="flex bg-[#121212] p-1 rounded-lg border border-white/10">
              {[8, 15, 32].map(size => (
                <button
                  key={size}
                  onClick={() => updateSetting('defaultGridSize', size)}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    (settings.defaultGridSize || 15) === size ? 'text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                  style={(settings.defaultGridSize || 15) === size ? { backgroundColor: accentColor } : {}}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. HAKKINDA & LİSANSLAR */}
        <div className="bg-[#181818] border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {language === 'tr' ? 'Hakkında & Lisanslar' : 'About & Licenses'}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                IsuDeck Core v1.0.0
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              MIT License
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 bg-[#141414] rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span className="text-xs font-bold text-white">
                  {language === 'tr' ? 'Açık Kaynak & Yerel Güvenlik' : 'Open Source & Local Security'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {language === 'tr'
                  ? 'IsuDeck tamamen yerel çalışan, açık kaynak kodlu bir yazılımdır. Telemetri veya arka plan veri toplaması yapmaz.'
                  : 'IsuDeck is 100% locally executed open-source software with zero telemetry or background data collection.'}
              </p>
            </div>

            <div className="p-3.5 bg-[#141414] rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                <span className="text-xs font-bold text-white">
                  {language === 'tr' ? 'Lucide İkon Paketi' : 'Lucide Icon Pack'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {language === 'tr'
                  ? 'Vektör simgeler Lucide Icons projesinden entegre edilmiştir (MIT Lisansı ile korunmaktadır).'
                  : 'Vector icon assets provided by Lucide Icons (Licensed under the MIT License).'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SÜRÜCÜ İŞLEM MODALI (CMD / POWERSHELL AÇILMAZ, SESSİZ & TEMİZ ARAYÜZ) */}
      {driverModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-center relative">
            {driverModal.stage === 'processing' && (
              <div className="space-y-4 py-3">
                <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mx-auto" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">
                    {driverModal.action === 'install' 
                      ? (language === 'tr' ? 'Sürücü Kuruluyor...' : 'Installing Driver...') 
                      : (language === 'tr' ? 'Sürücü Kaldırılıyor...' : 'Uninstalling Driver...')}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed px-2">
                    {language === 'tr'
                      ? 'Lütfen ekranda açılan Windows Yönetici Onayı (UAC) penceresinde "Evet" seçeneğine tıklayın. Komut satırı veya PowerShell penceresi açılmaz.'
                      : 'Please click "Yes" on the Windows UAC elevation prompt. No command prompt or PowerShell window will open.'}
                  </p>
                </div>
              </div>
            )}

            {driverModal.stage === 'success' && (
              <div className="space-y-4 py-2">
                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto text-green-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">
                    {driverModal.action === 'install' 
                      ? (language === 'tr' ? 'Sürücü Başarıyla Kuruldu!' : 'Driver Installed Successfully!') 
                      : (language === 'tr' ? 'Sürücü Başarıyla Kaldırıldı!' : 'Driver Uninstalled Successfully!')}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed px-2">
                    {language === 'tr'
                      ? 'Değişikliklerin sistemde tam olarak geçerli olması için bilgisayarınızı bir kez yeniden başlatmanız önerilir.'
                      : 'A system restart is recommended for the changes to take full effect on your computer.'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleRestartSystem}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>{language === 'tr' ? 'Şimdi Yeniden Başlat' : 'Restart PC Now'}</span>
                  </button>
                  <button
                    onClick={() => setDriverModal(prev => ({ ...prev, open: false }))}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-medium text-xs transition-colors cursor-pointer border border-white/10"
                  >
                    {language === 'tr' ? 'Daha Sonra' : 'Later'}
                  </button>
                </div>
              </div>
            )}

            {driverModal.stage === 'error' && (
              <div className="space-y-4 py-2">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">
                    {language === 'tr' ? 'İşlem Başarısız' : 'Operation Failed'}
                  </h3>
                  <p className="text-xs text-red-300 leading-relaxed px-2 break-all">
                    {driverModal.errorMessage || (language === 'tr' ? 'Yönetici onayı reddedildi veya hata oluştu.' : 'Elevation was rejected or failed.')}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setDriverModal(prev => ({ ...prev, open: false }))}
                    className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    {language === 'tr' ? 'Kapat' : 'Close'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}