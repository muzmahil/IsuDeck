'use client';

import { useState, useEffect, useRef } from 'react';
import ActionEditor from './components/ActionEditor';
import useStore from './store/useStore';
import DeckGrid from './components/DeckGrid';
import { fileSystem } from './utils/fileSystem';

export default function Home() {
  const { 
    lastMessage, 
    activeTab, 
    isInputRecording, 
    profileUpdateTrigger,
    connectionStatus,
    sendToEngine,
    settings,
    updateSetting,
    setProfiles,
    isMiniMode,
    language,
    t,
    lastHandledMsgId,
    markMessageHandled,
    executeLogicSequence
  } = useStore();
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeckCustomizerOpen, setIsDeckCustomizerOpen] = useState(false);
  const [selectedButtonIndex, setSelectedButtonIndex] = useState(null);
  const [buttons, setButtons] = useState(Array(15).fill(null));
  const [pressedButtonIndex, setPressedButtonIndex] = useState(null);
  const [gridSize, setGridSize] = useState(15);
  const [allProfiles, setAllProfiles] = useState([]);
  const bgFileInputRef = useRef(null);

  const accentColor = settings?.accentColor || '#3b82f6';

  // Butonların güncel halini ref içinde tut (Stale closure önlemek için)
  const buttonsRef = useRef(buttons);
  useEffect(() => {
    buttonsRef.current = buttons;
  }, [buttons]);

  // Aynı mesajı tekrar işlememek için ref
  const processedMessageRef = useRef(null);

  // --- 1. PROFİLLERİ YÜKLE ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const content = await fileSystem.readFile('profiles.json');
        if (content) {
          const profiles = JSON.parse(content);
          setAllProfiles(profiles);
          if (profiles && profiles.length > 0) {
            const activeProfile = profiles.find(p => p.isActive) || profiles[0];
            let loadedButtons = activeProfile.buttons || Array(15).fill(null);
            let loadedGridSize = activeProfile.gridSize || 15;

            if (loadedButtons.length < loadedGridSize) {
              loadedButtons = [...loadedButtons, ...Array(loadedGridSize - loadedButtons.length).fill(null)];
            }
            setButtons(loadedButtons);
            setGridSize(loadedGridSize);
          }
        }
      } catch (e) {
        console.error("Profil yüklenirken hata:", e);
      }
    };
    loadData();
  }, [profileUpdateTrigger]);

  // Ses Çalma Yardımcısı (Buton özel sesi veya genel ayar sesi)
  const playButtonAudio = (btn) => {
    const playSound = btn?.soundFeedback !== undefined 
      ? btn.soundFeedback 
      : (settings?.defaultSoundFeedback !== false);
    if (!playSound) return;

    const soundToPlay = btn?.customSound || settings?.selectedSound || 'click.wav';
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('play_sound_file', { sound: soundToPlay }).catch(() => {
        const audio = new Audio(soundToPlay.startsWith('/') || soundToPlay.startsWith('http') ? soundToPlay : `/sounds/${soundToPlay}`);
        audio.play().catch(() => {});
      });
    }).catch(() => {
      const audio = new Audio(soundToPlay.startsWith('/') || soundToPlay.startsWith('http') ? soundToPlay : `/sounds/${soundToPlay}`);
      audio.play().catch(() => {});
    });
  };

  // --- 3. WEBSOCKET DİNLEYİCİSİ (INPUTLARI YAKALAR) ---
  useEffect(() => {
    if (isInputRecording) return; // Kayıt modundaysa işlem yapma

    if (lastMessage && lastMessage.type === 'inputPressed') {
      const msgId = lastMessage._msgId;
      // Mükerrer işlem kontrolü (global ve yerel)
      if (msgId && (msgId === lastHandledMsgId || msgId === processedMessageRef.current)) return;
      if (msgId) {
        processedMessageRef.current = msgId;
        markMessageHandled(msgId);
      }
      
      const currentButtons = buttonsRef.current;

      const matchDetails = currentButtons.map((btn, index) => {
        if (!btn || !btn.binding) return null;
        
        // Tuş ve HID karşılaştırması
        const btnKey = String(btn.binding.key);
        const msgKey = String(lastMessage.key);
        
        if (btnKey !== msgKey) return null;

        // HID eşleşmesi: Generic hook veya boş ise doğrudan eşleşir
        let isHidMatch = true;
        if (btn.binding.hid && lastMessage.hid) {
            const bHid = String(btn.binding.hid);
            const mHid = String(lastMessage.hid);
            isHidMatch = (bHid === mHid) || 
                         (bHid.includes(mHid) || mHid.includes(bHid)) ||
                         (bHid === 'any' || mHid === 'any');
        }

        return isHidMatch ? index : null;
      });

      const btnIndex = matchDetails.find(idx => idx !== null);

      if (btnIndex !== undefined && btnIndex !== null) {
        console.log(`✅ [EŞLEŞME] Buton ${btnIndex} çalışıyor!`);
        
        // A) Görsel Efekt
        setPressedButtonIndex(btnIndex);
        setTimeout(() => setPressedButtonIndex(null), 150);

        // B) KOMUTU ATEŞLE
        const button = currentButtons[btnIndex];
        if (button) {
            playButtonAudio(button);

            // Mantık ve Değişken Motorunu Çalıştır
            if (button.actions && button.actions.length > 0 && executeLogicSequence) {
              executeLogicSequence(button.actions);
            }

            const payload = {
                type: 'EXECUTE_ACTION',
                buttonIndex: btnIndex,
                actionData: {
                    label: button.label,
                    actions: button.actions || [],
                    binding: button.binding
                },
                timestamp: Date.now()
            };
            console.log("[PAGE] Aksiyon gönderiliyor:", payload);
            sendToEngine(payload);
        }
      }
    }
  }, [lastMessage, isInputRecording, sendToEngine, lastHandledMsgId, markMessageHandled, executeLogicSequence]);

  const changeGridSize = async (size) => {
    setGridSize(size);
    let newButtons = [...buttons];
    if (size > newButtons.length) {
      newButtons = [...newButtons, ...Array(size - newButtons.length).fill(null)];
      setButtons(newButtons);
    }

    try {
      const content = await fileSystem.readFile('profiles.json');
      const profiles = content ? JSON.parse(content) : [];
      if (profiles.length > 0) {
        const activeIndex = profiles.findIndex(p => p.isActive);
        if (activeIndex !== -1) {
          profiles[activeIndex].gridSize = size;
          profiles[activeIndex].buttons = newButtons;
        } else {
          profiles[0].gridSize = size;
          profiles[0].buttons = newButtons;
        }
        await fileSystem.writeFile('profiles.json', profiles);
        setProfiles(profiles);
      }
    } catch (e) {
      console.error("Grid size save error:", e);
    }

    // Grid boyutu değişince de backend'i güncelle (Eksik olan parça)
    const blocks = newButtons
      .filter(btn => btn?.binding?.hid && btn?.binding?.key)
      .map(btn => ({ hid: btn.binding.hid, key: btn.binding.key }));
    
    sendToEngine({ type: "init_block_list", blocks });
    console.log("📤 Grid boyutu değişti, blok listesi güncellendi.");
  };

  const triggerButton = (index) => {
    const button = buttons[index];
    if (!button) return;

    setPressedButtonIndex(index);
    setTimeout(() => setPressedButtonIndex(null), 150);

    playButtonAudio(button);

    // Mantık ve Değişken Motorunu Çalıştır
    if (button.actions && button.actions.length > 0 && executeLogicSequence) {
      executeLogicSequence(button.actions);
    }

    const payload = {
      type: 'EXECUTE_ACTION',
      buttonIndex: index,
      actionData: {
        label: button.label,
        actions: button.actions || [],
        binding: button.binding
      },
      timestamp: Date.now()
    };
    
    console.log("[PAGE] Aksiyon gönderiliyor:", payload);
    sendToEngine(payload);
  };

  const handleEditButton = (index) => {
    setSelectedButtonIndex(index);
    setIsEditorOpen(true);
  };

  const handleSave = async (buttonData) => {
    const newButtons = [...buttons];
    if (buttonData === null) {
      newButtons[selectedButtonIndex] = null;
    } else {
      newButtons[selectedButtonIndex] = buttonData;
    }
    setButtons(newButtons);
    
    try {
      const content = await fileSystem.readFile('profiles.json');
      const profiles = content ? JSON.parse(content) : [];
      if (profiles.length > 0) {
        const activeIndex = profiles.findIndex(p => p.isActive);
        if (activeIndex !== -1) {
          profiles[activeIndex].buttons = newButtons;
          profiles[activeIndex].gridSize = gridSize;
        } else {
          profiles[0].buttons = newButtons;
          profiles[0].gridSize = gridSize;
        }
        await fileSystem.writeFile('profiles.json', profiles);
        setProfiles(profiles);
      }
    } catch (e) {
      console.error("Profile save error:", e);
    }

    // Block Listesini Güncelle (Kayıt sırasında da gönderiyoruz ki güncel kalsın)
    const blocks = newButtons
      .filter(btn => btn?.binding?.hid && btn?.binding?.key)
      .map(btn => ({
        hid: btn.binding.hid,
        key: btn.binding.key
      }));
    
    sendToEngine({
      type: "init_block_list",
      blocks: blocks
    });
  };

  const handleStealBinding = async (indexToClear) => {
    const newButtons = [...buttons];
    if (newButtons[indexToClear]) {
      newButtons[indexToClear] = { ...newButtons[indexToClear], binding: null };
      setButtons(newButtons);
      
      try {
        const content = await fileSystem.readFile('profiles.json');
        const profiles = content ? JSON.parse(content) : [];
        if (profiles.length > 0) {
           const activeIndex = profiles.findIndex(p => p.isActive);
           if (activeIndex !== -1) profiles[activeIndex].buttons = newButtons;
           else profiles[0].buttons = newButtons;
           await fileSystem.writeFile('profiles.json', profiles);
           setProfiles(profiles);
        }
      } catch (e) {
        console.error("Steal binding save error:", e);
      }
      
      const blocks = newButtons.filter(btn => btn?.binding?.hid && btn?.binding?.key)
        .map(btn => ({ hid: btn.binding.hid, key: btn.binding.key }));
      sendToEngine({ type: "init_block_list", blocks });
    }
  };

  const handleBgImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSetting('deckBackground', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const paletteColors = [
    { id: '#3b82f6', label: 'Blue (Mavi)' },
    { id: '#8b5cf6', label: 'Purple (Mor)' },
    { id: '#10b981', label: 'Emerald (Zümrüt)' },
    { id: '#f59e0b', label: 'Amber (Kehribar)' },
    { id: '#ef4444', label: 'Rose (Kırmızı)' },
    { id: '#06b6d4', label: 'Cyan (Camgöbeği)' },
    { id: '#ec4899', label: 'Pink (Pembe)' }
  ];

  return (
    <main className={`flex-1 bg-[#0a0a0a] flex flex-col items-center justify-center ${isMiniMode ? 'p-2' : 'p-4 md:p-8 lg:p-12'} h-full overflow-hidden relative`}>
      {/* Arka Plan Görseli Katmanı */}
      {settings?.deckBackground ? (
        <>
          <div 
            className="absolute inset-0 z-0 opacity-35 transition-opacity duration-700 pointer-events-none" 
            style={{ 
              backgroundImage: `url(${settings.deckBackground})`,
              backgroundSize: settings.deckBackgroundFit === 'stretch' ? '100% 100%' : (settings.deckBackgroundFit === 'contain' ? 'contain' : (settings.deckBackgroundFit === 'tile' ? 'auto' : 'cover')),
              backgroundRepeat: settings.deckBackgroundFit === 'tile' ? 'repeat' : 'no-repeat',
              backgroundPosition: 'center'
            }} 
          />
          <div className="absolute inset-0 bg-black/50 z-0 pointer-events-none backdrop-blur-[2px]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[#070709] pointer-events-none z-0" />
      )}

      {/* Arka Plan Ortam Işığı (Ambient Glow) */}
      {settings?.deckBacklight !== false && (
        <div 
          className="absolute w-[500px] md:w-[750px] h-[350px] md:h-[450px] rounded-full blur-[140px] md:blur-[180px] opacity-25 pointer-events-none transition-all duration-700 z-0"
          style={{ backgroundColor: accentColor }}
        />
      )}
      
      {activeTab === 'deck' && (
        <div className={`flex flex-col items-center ${isMiniMode ? 'gap-2' : 'gap-5'} w-full relative z-10`}>
          <div className="flex items-center gap-2">
            {/* Minimal Grid Boyut & Görünüm Barı */}
            <div className={`flex items-center bg-[#161616]/80 backdrop-blur-md ${isMiniMode ? 'p-0.5 rounded-lg' : 'p-1 rounded-xl'} border border-white/10 shadow-xl gap-0.5`}>
              {[8, 15, 32].map((size) => (
                <button
                  key={size}
                  onClick={() => changeGridSize(size)}
                  className={`${isMiniMode ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'} rounded-lg font-semibold transition-all cursor-pointer ${
                    gridSize === size 
                      ? 'text-white shadow-xs' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                  style={gridSize === size ? { backgroundColor: accentColor } : {}}
                >
                  {isMiniMode ? size : t(`deck.keys_${size}`, language)}
                </button>
              ))}

              {!isMiniMode && (
                <>
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <button
                    onClick={() => setIsDeckCustomizerOpen(true)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5"
                    title={language === 'tr' ? 'Deck Görünümü & Işık Ayarları' : 'Deck Appearance & Backlight'}
                  >
                    <div className="w-3 h-3 rounded-full border border-white/30 shadow-xs transition-transform hover:scale-110" style={{ backgroundColor: accentColor }} />
                    <svg className="w-3.5 h-3.5 text-zinc-400 hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>
                  </button>
                </>
              )}
            </div>
          </div>

          <DeckGrid 
            buttons={buttons} 
            gridSize={gridSize} 
            onTrigger={triggerButton} 
            onEdit={handleEditButton} 
            pressedButtonIndex={pressedButtonIndex}
            readOnly={false}
          />
        </div>
      )}

      {/* Deck Customizer Modal */}
      {isDeckCustomizerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsDeckCustomizerOpen(false)}>
          <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                {language === 'tr' ? 'Deck Görünüm & Işık Ayarları' : 'Deck Appearance & Lighting'}
              </h3>
              <button onClick={() => setIsDeckCustomizerOpen(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg>
              </button>
            </div>

            {/* 1. Renk Paleti (Accent Color) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                {language === 'tr' ? 'Renk Teması' : 'Color Theme'}
              </label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {paletteColors.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => updateSetting('accentColor', col.id)}
                    className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${accentColor.toLowerCase() === col.id.toLowerCase() ? 'scale-125 border-white shadow-lg shadow-white/20' : 'border-transparent hover:scale-110 opacity-80 hover:opacity-100'}`}
                    style={{ backgroundColor: col.id }}
                    title={col.label}
                  />
                ))}
                {/* Özel Renk Seçici */}
                <div className="relative w-7 h-7 rounded-full overflow-hidden border border-white/20 cursor-pointer shadow-md">
                  <input
                    type="color"
                    value={accentColor.startsWith('#') && accentColor.length === 7 ? accentColor : '#3b82f6'}
                    onChange={(e) => updateSetting('accentColor', e.target.value)}
                    className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer bg-transparent border-none"
                    title={language === 'tr' ? 'Özel Renk Seç' : 'Custom Color'}
                  />
                </div>
              </div>
            </div>

            {/* 2. Ortam Işığı (Ambient Glow) */}
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
              <div>
                <span className="text-xs font-bold text-white block">{language === 'tr' ? 'Deck Ortam Işığı (Ambient Glow)' : 'Deck Ambient Backlight'}</span>
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

            {/* 3. Arka Plan Görseli (Background Image) */}
            <div className="space-y-2.5 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white block">{language === 'tr' ? 'Deck Arka Plan Görseli' : 'Deck Background Image'}</span>
                {settings?.deckBackground && (
                  <button
                    onClick={() => updateSetting('deckBackground', null)}
                    className="text-[11px] text-red-400 hover:text-red-300 transition-colors cursor-pointer font-medium"
                  >
                    {language === 'tr' ? 'Görseli Kaldır' : 'Remove Image'}
                  </button>
                )}
              </div>

              <input type="file" ref={bgFileInputRef} className="hidden" accept="image/*" onChange={handleBgImageUpload} />
              
              <div 
                onClick={() => bgFileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 hover:border-white/25 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden transition-all bg-white/5 hover:bg-white/10"
              >
                {settings?.deckBackground ? (
                  <>
                    <div 
                      className="absolute inset-0 opacity-60" 
                      style={{ 
                        backgroundImage: `url(${settings.deckBackground})`,
                        backgroundSize: settings.deckBackgroundFit === 'stretch' ? '100% 100%' : (settings.deckBackgroundFit === 'contain' ? 'contain' : (settings.deckBackgroundFit === 'tile' ? 'auto' : 'cover')),
                        backgroundRepeat: settings.deckBackgroundFit === 'tile' ? 'repeat' : 'no-repeat',
                        backgroundPosition: 'center'
                      }} 
                    />
                    <span className="relative z-10 text-xs font-bold text-white bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-xs border border-white/10">
                      {language === 'tr' ? 'Görseli Değiştir' : 'Change Image'}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 transition-colors mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">{language === 'tr' ? 'Görsel Yükle (PNG, JPG, WebP)' : 'Upload Image (PNG, JPG, WebP)'}</span>
                  </>
                )}
              </div>

              {/* Görsel Yerleşim Modu (Fit Mode Selector) */}
              {settings?.deckBackground && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    {language === 'tr' ? 'Görsel Yerleşimi' : 'Image Fit Mode'}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 bg-[#121212] p-1 rounded-xl border border-white/5">
                    {[
                      { id: 'cover', label: language === 'tr' ? 'Kapla' : 'Cover' },
                      { id: 'stretch', label: language === 'tr' ? 'Uzat' : 'Stretch' },
                      { id: 'contain', label: language === 'tr' ? 'Sığdır' : 'Fit' },
                      { id: 'tile', label: language === 'tr' ? 'Döşe' : 'Tile' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateSetting('deckBackgroundFit', mode.id)}
                        className={`py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          (settings.deckBackgroundFit || 'cover') === mode.id
                            ? 'text-white font-bold shadow-xs'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                        style={(settings.deckBackgroundFit || 'cover') === mode.id ? { backgroundColor: accentColor } : {}}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsDeckCustomizerOpen(false)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                {language === 'tr' ? 'Tamam' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ActionEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        buttonIndex={selectedButtonIndex}
        initialData={selectedButtonIndex !== null ? buttons[selectedButtonIndex] : null}
        onSave={handleSave}
        existingButtons={buttons}
        onStealBinding={handleStealBinding}
        profiles={allProfiles}
      />
    </main>
  );
}