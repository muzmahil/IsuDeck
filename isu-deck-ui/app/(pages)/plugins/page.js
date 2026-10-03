'use client';

import { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { fileSystem } from '../../utils/fileSystem';
import { marked } from 'marked';

// HTML Temizleme Fonksiyonu (Güvenlik için)
const sanitizeHtml = (html) => {
  if (!html) return '';
  if (typeof window === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowedTags = ['P', 'I', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'B', 'STRONG', 'EM', 'U', 'BR', 'DIV', 'HR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'A', 'IMG'];
  
  const clean = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) { // Element
        const tagName = child.tagName;
        if (!allowedTags.includes(tagName)) {
          if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'AUDIO', 'VIDEO', 'CANVAS', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'HEAD', 'BODY', 'HTML'].includes(tagName)) {
            child.remove();
          } else {
            clean(child);
            while (child.firstChild) {
              node.insertBefore(child.firstChild, child);
            }
            child.remove();
          }
        } else {
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            const name = attr.name.toLowerCase();
            if (!['class', 'src', 'alt', 'href', 'target', 'title'].includes(name)) {
              child.removeAttribute(attr.name);
            }
          }
          clean(child);
        }
      }
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
};

export default function PluginsView() {
  const { plugins, setPlugins, sendToEngine, t, language, setToast, settings } = useStore();
  const accentColor = settings?.accentColor || '#3b82f6';
  const [filter, setFilter] = useState('installed'); // all, installed, updates
  const [search, setSearch] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [configModal, setConfigModal] = useState({ show: false, plugin: null, values: {} });
  const [isReloading, setIsReloading] = useState(false);

  const handleTogglePlugin = async (e, plugin) => {
    e.stopPropagation();
    const newEnabled = plugin.enabled === false ? true : false;
    try {
      const configPath = `plugins/${plugin.dirName}/config.json`;
      let currentConfig = {};
      const exists = await fileSystem.exists(configPath);
      if (exists) {
        const raw = await fileSystem.readFile(configPath);
        try { currentConfig = JSON.parse(raw) || {}; } catch (_) {}
      }
      currentConfig.enabled = newEnabled;
      await fileSystem.writeFile(configPath, currentConfig);

      const updated = plugins.map(p => p.dirName === plugin.dirName ? { ...p, enabled: newEnabled } : p);
      setPlugins(updated);

      if (selectedPlugin && selectedPlugin.dirName === plugin.dirName) {
        setSelectedPlugin({ ...selectedPlugin, enabled: newEnabled });
      }

      sendToEngine({ type: 'LOAD_PLUGINS' });

      if (setToast) {
        setToast({
          title: plugin.name,
          message: newEnabled 
            ? (language === 'tr' ? 'Eklenti etkinleştirildi' : 'Plugin enabled') 
            : (language === 'tr' ? 'Eklenti devre dışı bırakıldı (Uyku modunda)' : 'Plugin disabled (Sleeping)'),
          variant: 'success'
        });
      }
    } catch (err) {
      console.error("Toggle plugin error:", err);
    }
  };

  const handleReloadPlugins = async () => {
    setIsReloading(true);
    try {
      sendToEngine({ type: 'LOAD_PLUGINS' });
      const loaded = await fileSystem.scanPlugins();
      setPlugins(loaded);
      if (setToast) {
        setToast({
          message: language === 'tr' ? 'Eklentiler başarıyla yeniden başlatıldı!' : 'Plugins reloaded successfully!',
          type: 'success'
        });
      }
    } catch (e) {
      console.error('Reload plugins error:', e);
    } finally {
      setTimeout(() => setIsReloading(false), 700);
    }
  };

  const handleConfigure = async (e, plugin) => {
    e.stopPropagation();
    // Initialize values from plugin.config (already merged by fileSystem)
    const initialValues = {};
    if (plugin.config) {
        plugin.config.forEach(cfg => {
            initialValues[cfg.key] = cfg.value;
        });
    }

    setConfigModal({
        show: true,
        plugin: plugin,
        values: initialValues
    });
  };

  const handleSaveConfig = async () => {
    const { plugin, values } = configModal;
    try {
        const configPath = `plugins/${plugin.dirName}/config.json`;
        await fileSystem.writeFile(configPath, values);
        
        // Update store locally
        const updatedPlugins = plugins.map(p => {
            if (p.dirName === plugin.dirName) {
                return {
                    ...p,
                    config: p.config.map(cfg => ({
                        ...cfg,
                        value: values[cfg.key]
                    }))
                };
            }
            return p;
        });
        setPlugins(updatedPlugins);
        
        // Engine'e pluginleri yeniden yüklemesi için komut gönder
        sendToEngine({ type: 'LOAD_PLUGINS' });

        setConfigModal({ show: false, plugin: null, values: {} });
    } catch (err) {
        console.error("Config save error", err);
    }
  };

  const updateConfigValue = (key, value) => setConfigModal(prev => ({ ...prev, values: { ...prev.values, [key]: value } }));

  useEffect(() => {
    const scan = async () => {
      const loaded = await fileSystem.scanPlugins();
      setPlugins(loaded);
    };
    scan();
  }, [setPlugins]);

  const filteredPlugins = plugins.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.description.toLowerCase().includes(search.toLowerCase());
    if (filter === 'installed') return matchesSearch && p.installed;
    if (filter === 'updates') return matchesSearch && p.updateAvailable;
    return matchesSearch;
  });

  // Detay Görünümü (Visual Studio Style)
  if (selectedPlugin) {
    return (
      <div className="flex-1 h-full flex flex-col bg-[#121212] text-white overflow-hidden animate-in fade-in duration-300">
        {/* Detail Header */}
        <div className="h-16 border-b border-white/5 bg-[#1a1a1a] flex items-center px-6 gap-4 shrink-0">
          <button 
            onClick={() => setSelectedPlugin(null)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-[#252525] flex items-center justify-center text-lg shadow-inner border border-white/5 overflow-hidden">
                {selectedPlugin.iconSrc ? (
                  <img src={selectedPlugin.iconSrc} alt={selectedPlugin.name} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11V7a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2 2 2 0 0 1-2-2V7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2 2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h1a2 2 0 0 0 2-2Z"/></svg>
                )}
              </div>
              <h2 className="font-bold text-lg">{selectedPlugin.name}</h2>
          </div>
        </div>

        {/* Detail Content */}
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Readme & Description */}
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h3 className="text-xl font-bold mb-4 text-white">{t('plugins_page.overview', language)}</h3>
                        <p className="text-zinc-400 leading-relaxed">{selectedPlugin.description}</p>
                    </div>

                    {selectedPlugin.readme && (
                        <div className="space-y-4">
                            <hr></hr>
                            <div className="rounded-xl overflow-hidden pb-12">
                                <div 
                                    className="prose prose-invert prose-sm max-w-none text-zinc-400 leading-relaxed 
                                    prose-headings:text-white prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-4
                                    prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                                    prose-strong:text-white prose-strong:font-bold
                                    prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                                    prose-ul:list-disc prose-ol:list-decimal prose-li:my-1"
                                    dangerouslySetInnerHTML={{ 
                                      __html: sanitizeHtml(marked.parse(selectedPlugin.readme.replace(/\\#/g, '#').replace(/\\\*/g, '*'))) 
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Metadata & Actions */}
                <div className="space-y-6">
                    <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 space-y-6 sticky top-0">
                        {/* Enable / Disable Toggle Switch Card */}
                        {selectedPlugin.installed && (
                          <div className="flex items-center justify-between p-3.5 bg-black/20 rounded-xl border border-white/5">
                            <div>
                              <span className="text-xs font-bold text-white block">
                                {selectedPlugin.enabled !== false ? (language === 'tr' ? 'Eklenti Aktif' : 'Plugin Enabled') : (language === 'tr' ? 'Eklenti Devre Dışı' : 'Plugin Disabled')}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {selectedPlugin.daemon 
                                  ? (language === 'tr' ? 'Canlı Arka Plan Servisi (Daemon)' : 'Live Background Service (Daemon)') 
                                  : (language === 'tr' ? 'İsteğe Bağlı Çalışır (One-Shot)' : 'On-Demand Execution (One-Shot)')}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleTogglePlugin(e, selectedPlugin)}
                              className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                                selectedPlugin.enabled !== false ? 'bg-blue-600' : 'bg-zinc-700'
                              }`}
                              style={selectedPlugin.enabled !== false ? { backgroundColor: accentColor } : {}}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${selectedPlugin.enabled !== false ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Execution Mode</div>
                                <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${selectedPlugin.daemon ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`} />
                                  <span>{selectedPlugin.daemon ? 'DAEMON (Background Service)' : 'ONE-SHOT (Zero Idle RAM)'}</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Version</div>
                                <div className="text-sm text-white">{selectedPlugin.version}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Author</div>
                                <div className="text-sm text-white">{selectedPlugin.author}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">License</div>
                                <div className="text-sm text-white">{selectedPlugin.license || 'MIT'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Identifier</div>
                                <div className="text-xs text-zinc-400 break-all">{selectedPlugin.identifier}</div>
                            </div>
                        </div>

                        {selectedPlugin.actions && selectedPlugin.actions.length > 0 && (
                            <div className="pt-6 border-t border-white/5">
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Included Actions</div>
                                <div className="space-y-2">
                                    {selectedPlugin.actions.map((action, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-lg">
                                                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-white truncate">{action.label || action.name}</div>
                                                <div className="text-[10px] text-zinc-500 truncate">{action.name}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-[#121212] text-white overflow-hidden p-4 md:p-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('plugins_page.title', language).split(' ')[0]} <span style={{ color: accentColor }}>{t('plugins_page.title', language).split(' ').slice(1).join(' ')}</span></h1>
          <p className="text-zinc-400 text-sm mt-1">{t('plugins_page.subtitle', language)}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleReloadPlugins}
            disabled={isReloading}
            className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 text-sm font-medium py-2.5 px-4 rounded-xl text-white transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            title={language === 'tr' ? 'Tüm eklentileri yeniden başlat' : 'Reload all plugins'}
          >
            <svg
              className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`}
              style={{ color: accentColor }}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isReloading ? (language === 'tr' ? 'Yeniden Başlatılıyor...' : 'Reloading...') : (language === 'tr' ? 'Eklentileri Yeniden Başlat' : 'Reload Plugins')}</span>
          </button>

          <div className="relative">
            <input 
              type="text" 
              placeholder={t('plugins_page.search_placeholder', language)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#1a1a1a] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none w-64 transition-all placeholder:text-zinc-600"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 mb-6 border-b border-white/5 pb-1 shrink-0">
        {['installed', 'updates', 'browse'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pb-3 text-sm font-medium transition-all relative cursor-pointer ${filter === f ? 'font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            style={filter === f ? { color: accentColor } : {}}
          >
            {f === 'installed' ? t('plugins_page.filter_installed', language) : f === 'updates' ? t('plugins_page.filter_updates', language) : t('plugins_page.filter_browse', language)}
            {filter === f && <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-t-full" style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pr-2 pb-20">
        {filteredPlugins.map((plugin, idx) => (
          <div 
            key={plugin.identifier || idx} 
            onClick={() => setSelectedPlugin(plugin)}
            className={`border border-white/5 rounded-2xl p-5 transition-all group flex flex-col h-60 relative overflow-hidden cursor-pointer ${!plugin.bgColor ? 'bg-[#1a1a1a] hover:bg-[#1f1f1f] hover:border-white/10' : 'hover:brightness-110'}`}
            style={plugin.backColor ? { 
                background: `linear-gradient(145deg, ${plugin.backColor}26 0%, #1a1a1a 100%)`,
                borderColor: `${plugin.backColor}33`
            } : {}}
          >
            {/* Background Glow on Hover */}
            <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ backgroundImage: plugin.backColor ? `linear-gradient(to bottom right, ${plugin.backColor}33, transparent)` : 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.05), transparent)' }}
            />

            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-[#252525] flex items-center justify-center text-2xl shadow-inner border border-white/5 overflow-hidden">
                {plugin.iconSrc ? (
                  <img src={plugin.iconSrc} alt={plugin.name} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11V7a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2 2 2 0 0 1-2-2V7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2 2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h1a2 2 0 0 0 2-2Z"/></svg>
                )}
              </div>
              <div className="flex items-center gap-2">
                {plugin.daemon && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20" title={language === 'tr' ? 'Canlı Arka Plan Servisi (Daemon)' : 'Live Background Service (Daemon)'}>DAEMON</span>
                )}
                {plugin.installed && (
                  <button
                    type="button"
                    onClick={(e) => handleTogglePlugin(e, plugin)}
                    className={`w-8 h-4.5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                      plugin.enabled !== false ? 'bg-blue-600' : 'bg-zinc-700'
                    }`}
                    style={plugin.enabled !== false ? { backgroundColor: accentColor } : {}}
                    title={plugin.enabled !== false ? (language === 'tr' ? 'Eklenti Açık (Tıkla ve Devre Dışı Bırak)' : 'Plugin Enabled (Click to Disable)') : (language === 'tr' ? 'Eklenti Kapalı (Tıkla ve Etkinleştir)' : 'Plugin Disabled (Click to Enable)')}
                  >
                    <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${plugin.enabled !== false ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 relative z-10 min-h-0">
              <h3 className="font-bold text-white text-lg leading-tight mb-1 group-hover:text-blue-400 transition-colors truncate">{plugin.name}</h3>
              <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{plugin.description}</p>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5 relative z-10">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-600 font-bold uppercase">{t('plugins_page.author', language)}</span>
                <span className="text-xs text-zinc-400 font-medium">{plugin.author}</span>
              </div>
              <button 
                onClick={(e) => plugin.installed ? handleConfigure(e, plugin) : e.stopPropagation()}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                plugin.installed 
                  ? 'bg-[#252525] text-zinc-400 hover:bg-[#333] hover:text-white border border-white/5' 
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
              }`}>
                {plugin.installed ? t('plugins_page.configure', language) : t('plugins_page.install', language)}
              </button>
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {filteredPlugins.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-500">
            <svg className="w-12 h-12 mb-4 text-zinc-600 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <p className="text-sm">{t('plugins_page.no_results', language)}</p>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {configModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#252525] rounded-t-2xl">
                    <h2 className="text-lg font-bold text-white flex items-center gap-3">
                        <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                        {configModal.plugin?.name} {t('plugins_page.settings_title', language)}
                    </h2>
                    <button onClick={() => setConfigModal({ show: false, plugin: null, values: {} })} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {configModal.plugin?.config?.length > 0 ? (
                        configModal.plugin.config.map((cfg, idx) => {
                            const field = cfg.fields?.[0] || cfg;
                            const fieldType = field.type || 'text';
                            const fieldKey = cfg.key || field.key || `cfg_${idx}`;
                            const label = field.label || field.name || fieldKey;
                            const placeholder = field.placeholder || '';
                            const isRequired = !!field.required;
                            const val = configModal.values[fieldKey] !== undefined ? configModal.values[fieldKey] : (cfg.value ?? '');

                            return (
                            <div key={fieldKey} className="space-y-2">
                                {fieldType !== 'checkbox' && (
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                                        {t(label, language)} {isRequired && <span className="text-red-500">*</span>}
                                    </label>
                                )}
                                
                                {(fieldType === 'text' || fieldType === 'password') && (
                                    <input 
                                        type={fieldType} 
                                        value={val}
                                        onChange={(e) => updateConfigValue(fieldKey, e.target.value)}
                                        placeholder={t(placeholder, language)}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                                    />
                                )}
                                {fieldType === 'number' && (
                                    <input 
                                        type="number" 
                                        value={val}
                                        onChange={(e) => updateConfigValue(fieldKey, e.target.value)}
                                        placeholder={t(placeholder, language)}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                                    />
                                )}
                                {fieldType === 'checkbox' && (
                                    <label className="flex items-center gap-3 p-3 bg-[#121212] border border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={!!val}
                                            onChange={(e) => updateConfigValue(fieldKey, e.target.checked)}
                                            className="w-5 h-5 rounded border-zinc-600 text-blue-600 focus:ring-blue-500 bg-zinc-700"
                                        />
                                        <span className="text-sm font-medium text-white">{t(label, language)}</span>
                                    </label>
                                )}
                                {fieldType === 'select' && (
                                    <select
                                        value={val}
                                        onChange={(e) => updateConfigValue(fieldKey, e.target.value)}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                                    >
                                        {(field.options || []).map(opt => (
                                            <option key={opt.id || opt.value || opt} value={opt.id || opt.value || opt}>
                                                {opt.label || opt.name || opt}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {fieldType === 'richtext' && (
                                    <div className="space-y-2">
                                        <textarea
                                            value={val}
                                            onChange={(e) => updateConfigValue(fieldKey, e.target.value)}
                                            placeholder={t(placeholder, language)}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors min-h-[100px] resize-y"
                                        />
                                        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-3">
                                            <div className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider font-bold">{t('plugins_page.preview', language)}</div>
                                            <div 
                                                className="prose prose-invert prose-sm max-w-none text-zinc-300 [&>h1]:text-white [&>h1]:text-lg [&>h1]:font-bold [&>h2]:text-white [&>h2]:text-base [&>h2]:font-bold [&>p]:my-1"
                                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(val) }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-zinc-500 py-10">{t('plugins_page.no_config', language)}</div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-20 border-t border-white/5 bg-[#252525] rounded-b-2xl flex items-center justify-end px-6 gap-3">
                    <button onClick={() => setConfigModal({ show: false, plugin: null, values: {} })} className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">{t('plugins_page.cancel', language)}</button>
                    <button onClick={handleSaveConfig} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer" style={{ backgroundColor: accentColor }}>{t('plugins_page.save', language)}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
