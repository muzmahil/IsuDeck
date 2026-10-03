'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useStore from '../../store/useStore';
import { fileSystem } from '../../utils/fileSystem';

export default function ProfilesPage() {
  const { t, language, sendToEngine, settings, saveProfiles: storeSaveProfiles } = useStore();
  const accentColor = settings?.accentColor || '#3b82f6';
  const [profiles, setProfiles] = useState([]);
  const [editModal, setEditModal] = useState({ show: false, id: null, name: '', icon: '📁' });
  const [modal, setModal] = useState({ show: false, type: 'alert', title: '', message: '', onConfirm: () => {} });
  const [draggedIndex, setDraggedIndex] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const loadProfiles = async () => {
        try {
            const content = await fileSystem.readFile('profiles.json');
            if (content) {
                let loadedProfiles = JSON.parse(content);
                // Eğer hiç aktif profil yoksa ilkini aktif yap (Migration)
                if (loadedProfiles.length > 0 && !loadedProfiles.some(p => p.isActive)) {
                    loadedProfiles[0].isActive = true;
                    await fileSystem.writeFile('profiles.json', loadedProfiles);
                }
                setProfiles(loadedProfiles);
                if (storeSaveProfiles) storeSaveProfiles(loadedProfiles);
            } else {
                const initialGrid = settings?.defaultGridSize || 15;
                const defaultProfile = {
                    id: Date.now(),
                    name: 'Default Profile',
                    icon: '📁',
                    gridSize: initialGrid,
                    buttons: Array(initialGrid).fill(null),
                    isActive: true
                };
                await fileSystem.writeFile('profiles.json', [defaultProfile]);
                setProfiles([defaultProfile]);
                if (storeSaveProfiles) storeSaveProfiles([defaultProfile]);
            }
        } catch (e) {
            console.error("Profiles Load Error:", e);
        }
    };
    loadProfiles();
  }, []);

  const saveProfiles = (newProfiles) => {
    setProfiles(newProfiles);
    fileSystem.writeFile('profiles.json', newProfiles);
    if (storeSaveProfiles) storeSaveProfiles(newProfiles);
  };

  const createProfile = () => {
    const defaultGrid = settings?.defaultGridSize || 15;
    const newProfile = {
      id: Date.now(),
      name: `Profil ${profiles.length + 1}`,
      icon: '📁',
      gridSize: defaultGrid,
      buttons: Array(defaultGrid).fill(null),
      isActive: false
    };
    saveProfiles([...profiles, newProfile]);
  };

  const deleteProfile = (e, index) => {
    e.stopPropagation();
    if (profiles.length <= 1) {
        setModal({
            show: true,
            type: 'alert',
            title: t('profiles.delete_confirm_title', language),
            message: t('profiles.min_profile_msg', language),
            onConfirm: () => setModal(prev => ({ ...prev, show: false }))
        });
        return;
    }
    
    setModal({
        show: true,
        type: 'confirm',
        title: t('profiles.delete_confirm_title', language),
        message: t('profiles.delete_confirm_msg', language),
        onConfirm: () => {
            const deletedProfile = profiles[index];
            const newProfiles = profiles.filter((_, i) => i !== index);
            
            // Eğer silinen profil aktifse, kalanlardan ilkini aktif yap
            if (deletedProfile.isActive && newProfiles.length > 0) {
                newProfiles[0].isActive = true;
            }
            
            saveProfiles(newProfiles);

            // Aktif profil değişmiş olabileceği için backend'i güncelle
            const activeProfile = newProfiles.find(p => p.isActive) || newProfiles[0];
            if (activeProfile) {
                const buttons = activeProfile.buttons || [];
                const blocks = buttons
                  .filter(btn => btn?.binding?.hid && btn?.binding?.key)
                  .map(btn => ({
                    hid: btn.binding.hid,
                    key: btn.binding.key
                  }));
                
                sendToEngine({ type: "init_block_list", blocks });
            }
            setModal(prev => ({ ...prev, show: false }));
        }
    });
  };

  const activateProfile = (index) => {
    const newProfiles = profiles.map((p, i) => ({
        ...p,
        isActive: i === index
    }));
    saveProfiles(newProfiles);

    // Backend'e yeni profilin tuşlarını bildir
    const selected = newProfiles[index];
    const buttons = selected.buttons || [];
    const blocks = buttons
      .filter(btn => btn?.binding?.hid && btn?.binding?.key)
      .map(btn => ({
        hid: btn.binding.hid,
        key: btn.binding.key
      }));
    
    sendToEngine({ type: "init_block_list", blocks });
    
   
  };

  const duplicateProfile = (e, profile) => {
    e.stopPropagation();
    const newProfile = {
        ...profile,
        id: Date.now(),
        name: `${profile.name} (Kopya)`,
        isActive: false
    };
    saveProfiles([...profiles, newProfile]);
  };

  const startEditing = (e, profile) => {
      e.stopPropagation();
      setEditModal({
          show: true,
          id: profile.id,
          name: profile.name,
          icon: profile.icon || '📁'
      });
  };

  const saveProfileDetails = () => {
      if (!editModal.name.trim()) return;
      const newProfiles = profiles.map(p => 
          p.id === editModal.id ? { ...p, name: editModal.name, icon: editModal.icon } : p
      );
      saveProfiles(newProfiles);
      setEditModal(prev => ({ ...prev, show: false }));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newProfiles = [...profiles];
    const [draggedItem] = newProfiles.splice(draggedIndex, 1);
    newProfiles.splice(index, 0, draggedItem);
    
    saveProfiles(newProfiles);
    setDraggedIndex(null);
  };

  return (
    <main className="flex-1 bg-[#121212] p-4 md:p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-white">{t('profiles.title', language)}</h1>
                <p className="text-zinc-400 text-sm mt-1">{t('profiles.subtitle', language)}</p>
            </div>
            <button 
                onClick={createProfile}
                className="px-4 py-2 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-lg cursor-pointer"
                style={{ backgroundColor: accentColor, boxShadow: `0 10px 20px -5px ${accentColor}40` }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                {t('profiles.new_profile', language)}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((profile, index) => (
                <div 
                    key={profile.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => activateProfile(index)}
                    className={`group relative bg-[#181818] border rounded-2xl p-5 transition-all cursor-pointer overflow-hidden ${
                        profile.isActive
                        ? 'shadow-lg ring-1' 
                        : 'border-white/5 hover:border-white/10 hover:bg-[#1e1e1e]'
                    }`}
                    style={profile.isActive ? { borderColor: `${accentColor}80`, boxShadow: `0 0 30px -10px ${accentColor}50`, outlineColor: accentColor } : {}}
                >
                    {/* Active Badge */}
                    {profile.isActive && (
                        <div 
                            className="absolute top-4 right-4 px-2 py-1 border rounded text-[10px] font-bold uppercase tracking-wider"
                            style={{ backgroundColor: `${accentColor}25`, borderColor: `${accentColor}40`, color: accentColor }}
                        >
                            {t('profiles.active', language)}
                        </div>
                    )}

                    <div className="flex items-center gap-4 mb-6">
                        <div 
                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${profile.isActive ? 'text-white shadow-md' : 'bg-zinc-800 text-zinc-400'}`}
                            style={profile.isActive ? { backgroundColor: accentColor, boxShadow: `0 0 16px ${accentColor}40` } : {}}
                        >
                            {(!profile.icon || profile.icon === '📁') ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                            ) : (
                              profile.icon || (profile.gridSize === 8 ? 'S' : profile.gridSize === 32 ? 'L' : 'M')
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 group/title">
                                <h3 className={`font-bold truncate ${profile.isActive ? 'text-white' : 'text-zinc-300'}`}>{profile.name}</h3>
                                <button onClick={(e) => startEditing(e, profile)} className="opacity-0 group-hover/title:opacity-100 text-zinc-500 hover:text-white transition-opacity p-1 cursor-pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">{profile.gridSize} {t('profiles.buttons', language)} • {profile.buttons.filter(b => b).length} {t('profiles.filled', language)}</p>
                        </div>
                    </div>

                    {/* Mini Preview Grid */}
                    <div className={`grid gap-1 mb-6 opacity-50 pointer-events-none ${
                        profile.gridSize === 8 ? 'grid-cols-4 aspect-[2/1]' : 
                        profile.gridSize === 32 ? 'grid-cols-8 aspect-[2/1]' : 
                        'grid-cols-5 aspect-[16/10]'
                    }`}>
                        {Array.from({ length: profile.gridSize }).map((_, i) => {
                            const btn = profile.buttons[i];
                            return (
                                <div key={i} className={`rounded-sm ${btn ? 'bg-zinc-600' : 'bg-zinc-800/50'}`} style={btn?.bgColor ? { backgroundColor: btn.bgColor } : {}} />
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                        <button 
                            onClick={(e) => duplicateProfile(e, profile)}
                            className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
                        >
                            {t('profiles.duplicate', language)}
                        </button>
                        <button 
                            onClick={(e) => deleteProfile(e, index)}
                            className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                            title={t('profiles.delete', language)}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Alert/Confirm Modal */}
        {modal.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="bg-[#1e1e1e] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${modal.type === 'confirm' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {modal.type === 'confirm' ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">{modal.title}</h3>
                        <p className="text-zinc-400 text-sm mt-1">{modal.message}</p>
                    </div>
                    <div className="flex gap-3 justify-center mt-6">
                        {modal.type === 'confirm' && (
                            <button 
                                onClick={() => setModal(prev => ({ ...prev, show: false }))}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                İptal
                            </button>
                        )}
                        <button 
                            onClick={modal.onConfirm}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer ${modal.type === 'confirm' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}`}
                        >
                            {modal.type === 'confirm' ? t('profiles.delete', language) : 'OK'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Profile Modal */}
        {editModal.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="bg-[#1e1e1e] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">{t('profiles.edit_title', language)}</h3>
                        <button onClick={() => setEditModal(prev => ({ ...prev, show: false }))} className="text-zinc-400 hover:text-white cursor-pointer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('profiles.profile_name', language)}</label>
                            <input 
                                type="text" 
                                value={editModal.name}
                                onChange={(e) => setEditModal(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                placeholder={t('profiles.profile_name', language)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('profiles.profile_icon', language)}</label>
                            <div className="grid grid-cols-8 gap-2 bg-[#121212] p-3 rounded-xl border border-white/10 max-h-48 overflow-y-auto">
                                {[
                                    "📁", "🏠", "🎮", "🎨", "🎵", "🎬", "💼", "🎓", "🚀", "⭐", 
                                    "❤️", "🔥", "💡", "⚙️", "🔒", "🌐", "💬", "📅", "📊", "📝",
                                    "📷", "🎥", "🎤", "🎧", "🎹", "🎺", "🎸", "🎻", "⚽", "🏀",
                                    "🚗", "✈️", "🍔", "🍕", "☕", "🍺", "🎉", "🎁", "🛒", "💰"
                                ].map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => setEditModal(prev => ({ ...prev, icon: emoji }))}
                                        className={`aspect-square flex items-center justify-center text-xl rounded-lg transition-all cursor-pointer ${editModal.icon === emoji ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-white/5'}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setEditModal(prev => ({ ...prev, show: false }))}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            {t('profiles.cancel', language)}
                        </button>
                        <button 
                            onClick={saveProfileDetails}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                        >
                            {t('profiles.save', language)}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </main>
  );
}