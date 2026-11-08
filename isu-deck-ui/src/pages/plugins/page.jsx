'use client';

import { useState, useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import { fileSystem } from '../../utils/fileSystem';
import { fetchRegistry, installPluginFromFile, installPluginFromUrl, isRegistryCacheFresh, readCachedRegistry, uninstallPlugin } from '../../utils/pluginStore';
import { compareVersions, getAppVersion } from '../../utils/updater';
import { marked } from 'marked';

// HTML Temizleme Fonksiyonu (Güvenlik için)
const sanitizeHtml = (html) => {
  if (!html) return '';
  if (typeof window === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowedTags = ['P', 'I', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'B', 'STRONG', 'EM', 'U', 'BR', 'DIV', 'HR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'DEL', 'S'];
  
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

const isNewerVersion = (candidate, current) => {
  const toParts = (version) => String(version || '').split('-')[0].split('.').map(part => Number.parseInt(part, 10) || 0);
  const a = toParts(candidate);
  const b = toParts(current);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0);
  }
  return false;
};

const DEFAULT_REGISTRY_URL = (
  import.meta.env.VITE_PLUGIN_REGISTRY_URL || 'https://isudeck-plugins.pages.dev/registry.json'
).trim();

const Spinner = ({ className = 'w-4 h-4' }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const PluginGlyph = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 11V7a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2 2 2 0 0 1-2-2V7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2 2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h1a2 2 0 0 0 2-2Z" />
  </svg>
);

// Remote icons arrive after the card renders. Show a shimmer until the image
// is decoded, then fade it in instead of popping into place.
function PluginIcon({ src, alt, className = '', glyphClassName = 'w-6 h-6' }) {
  const imgRef = useRef(null);
  const [status, setStatus] = useState(src ? 'loading' : 'empty');

  useEffect(() => {
    setStatus(src ? 'loading' : 'empty');
    const node = imgRef.current;
    if (node?.complete && node.naturalWidth > 0) setStatus('loaded');
  }, [src]);

  const showImage = Boolean(src) && status !== 'error';

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-white/10" aria-hidden="true" />
      )}
      {showImage && (
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`h-full w-full object-cover transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(!src || status === 'error') && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
          <PluginGlyph className={glyphClassName} />
        </div>
      )}
    </div>
  );
}

const PluginCardSkeleton = () => (
  <div className="flex h-60 flex-col rounded-2xl border border-white/5 bg-[#1a1a1a] p-5 animate-pulse">
    <div className="mb-3 flex items-start justify-between">
      <div className="h-12 w-12 rounded-xl bg-white/10" />
      <div className="h-4 w-16 rounded bg-white/5" />
    </div>
    <div className="mt-1 space-y-2">
      <div className="h-4 w-2/3 rounded bg-white/10" />
      <div className="h-3 w-full rounded bg-white/5" />
      <div className="h-3 w-5/6 rounded bg-white/5" />
    </div>
    <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
      <div className="space-y-1.5">
        <div className="h-2.5 w-10 rounded bg-white/5" />
        <div className="h-3 w-16 rounded bg-white/10" />
      </div>
      <div className="h-7 w-16 rounded-lg bg-white/10" />
    </div>
  </div>
);

export default function PluginsView() {
  const { plugins, setPlugins, sendToEngine, t, language, setToast, settings } = useStore();
  const accentColor = settings?.accentColor || '#3b82f6';
  const [filter, setFilter] = useState('installed'); // all, installed, updates
  const [search, setSearch] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [configModal, setConfigModal] = useState({ show: false, plugin: null, values: {} });
  const [isReloading, setIsReloading] = useState(false);
  const [registry, setRegistry] = useState(null);
  const [usingCachedRegistry, setUsingCachedRegistry] = useState(false);
  const [storeBusy, setStoreBusy] = useState(false);
  const [storeMessage, setStoreMessage] = useState('');
  const [platform, setPlatform] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [installModal, setInstallModal] = useState({ show: false, mode: 'file', filePath: '', url: '', sha256: '', dirName: '', error: '' });
  const [confirmModal, setConfirmModal] = useState(null);
  const [pluginsLoading, setPluginsLoading] = useState(true);
  const [busyPluginId, setBusyPluginId] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const didInitRegistry = useRef(false);

  const isPluginBusy = (plugin) => Boolean(
    plugin && busyPluginId && (plugin.identifier === busyPluginId || plugin.dirName === busyPluginId)
  );

  const busyLabel = (action, language) => {
    if (action === 'update') return language === 'tr' ? 'Güncelleniyor…' : 'Updating…';
    if (action === 'uninstall') return language === 'tr' ? 'Kaldırılıyor…' : 'Removing…';
    return language === 'tr' ? 'Kuruluyor…' : 'Installing…';
  };

  const requiresNewerApp = (entry) => Boolean(
    entry?.minAppVersion && appVersion && compareVersions(entry.minAppVersion, appVersion) > 0
  );
  const storeBlockedByAppVersion = (plugin) => (
    (!plugin.installed || plugin.updateAvailable) && requiresNewerApp(plugin.registryEntry || plugin)
  );

  const reloadInstalledPlugins = async (catalog = registry) => {
    const installed = await fileSystem.scanPlugins();
    const byIdentifier = new Map(installed.filter(plugin => plugin.identifier).map(plugin => [plugin.identifier, plugin]));
    const merged = (catalog?.plugins || []).map(entry => {
      const local = byIdentifier.get(entry.identifier);
      if (local) byIdentifier.delete(entry.identifier);
      return local
        ? {
            ...entry,
            ...local,
            actions: Array.isArray(local.actions) ? local.actions.filter(Boolean) : [],
            registryEntry: entry,
            latestVersion: entry.version,
            updateAvailable: isNewerVersion(entry.version, local.version)
          }
        : {
            ...entry,
            actions: Array.isArray(entry.actions) ? entry.actions.filter(Boolean) : [],
            registryEntry: entry,
            installed: false,
            updateAvailable: false,
            iconSrc: entry.icon
          };
    });
    setPlugins([...merged, ...byIdentifier.values()]);
    return [...merged, ...byIdentifier.values()];
  };

  const handleFetchRegistry = async (url = DEFAULT_REGISTRY_URL) => {
    setStoreBusy(true);
    setStoreMessage('');
    setUsingCachedRegistry(false);
    try {
      const result = await fetchRegistry(url);
      setRegistry(result.registry);
      setUsingCachedRegistry(result.offline);
      await reloadInstalledPlugins(result.registry);
      setStoreMessage(result.offline
        ? (language === 'tr' ? 'Önbellekteki katalog gösteriliyor; yenileme başarısız oldu.' : 'Showing the cached catalog; refresh failed.')
        : (language === 'tr' ? 'Katalog güncellendi.' : 'Catalog refreshed.'));
    } catch (error) {
      setStoreMessage(String(error));
    } finally {
      setStoreBusy(false);
    }
  };

  const refreshPluginSelection = async (identifier) => {
    const next = await reloadInstalledPlugins();
    if (identifier) {
      const installed = next.find(item => item.identifier === identifier);
      if (installed) setSelectedPlugin(installed);
    }
    sendToEngine({ type: 'LOAD_PLUGINS' });
  };

  const handleStoreInstall = (plugin) => {
    const entry = plugin.registryEntry || plugin;
    if (!entry.download?.url || !entry.download?.sha256) {
      setStoreMessage(language === 'tr' ? 'Katalog girdisinde indirme URL’si veya SHA-256 eksik.' : 'Catalog entry is missing its download URL or SHA-256.');
      return;
    }
    if (requiresNewerApp(entry)) {
      setStoreMessage(language === 'tr'
        ? `Bu eklenti IsuDeck ${entry.minAppVersion} veya üstünü gerektiriyor.`
        : `This plugin requires IsuDeck ${entry.minAppVersion} or newer.`);
      return;
    }
    const action = plugin.installed ? (language === 'tr' ? 'Güncelle' : 'Update') : (language === 'tr' ? 'Kur' : 'Install');
    setConfirmModal({
      title: `${action} ${entry.name}`,
      message: language === 'tr'
        ? 'Eklenti kodu cihazınızda çalıştırılacaktır. Yalnızca güvendiğiniz katalogları kullanın.'
        : 'Plugin code will run on your device. Only install plugins from catalogs you trust.',
      confirmLabel: action,
      onConfirm: async () => {
        setConfirmModal(null);
        setStoreBusy(true);
        setBusyPluginId(entry.identifier);
        setBusyAction(plugin.installed ? 'update' : 'install');
        setStoreMessage(language === 'tr' ? 'Eklenti indiriliyor ve doğrulanıyor…' : 'Downloading and verifying plugin…');
        try {
          const info = await installPluginFromUrl(entry, plugin.installed ? plugin.dirName : (entry.dirName || null));
          await refreshPluginSelection(info?.identifier || entry.identifier);
          setStoreMessage(language === 'tr' ? 'Eklenti başarıyla kuruldu.' : 'Plugin installed successfully.');
          if (setToast) {
            setToast({
              title: entry.name,
              message: plugin.installed
                ? (language === 'tr' ? 'Güncelleme tamamlandı.' : 'Update complete.')
                : (language === 'tr' ? 'Eklenti kuruldu.' : 'Plugin installed.'),
              variant: 'success'
            });
          }
        } catch (error) {
          setStoreMessage(String(error));
          if (setToast) {
            setToast({
              title: entry.name,
              message: String(error),
              variant: 'error'
            });
          }
        } finally {
          setBusyPluginId(null);
          setBusyAction(null);
          setStoreBusy(false);
        }
      }
    });
  };

  const handleInstallFromFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({ multiple: false, filters: [{ name: 'Plugin ZIP', extensions: ['zip'] }] });
      if (!path || Array.isArray(path)) return;
      setInstallModal({ show: true, mode: 'file', filePath: path, url: '', sha256: '', dirName: '', error: '' });
    } catch (error) {
      setStoreMessage(String(error));
    }
  };

  const handleInstallFromUrl = () => {
    setInstallModal({ show: true, mode: 'url', filePath: '', url: '', sha256: '', dirName: '', error: '' });
  };

  const submitInstall = async () => {
    const { mode, filePath, url, sha256, dirName } = installModal;
    const trimmedUrl = url.trim();
    const trimmedSha = sha256.trim();
    const trimmedDir = dirName.trim();

    if (mode === 'file' && !filePath) {
      setInstallModal(prev => ({ ...prev, error: language === 'tr' ? 'Önce bir ZIP dosyası seçin.' : 'Choose a ZIP file first.' }));
      return;
    }
    if (mode === 'url' && !/^https:\/\//i.test(trimmedUrl)) {
      setInstallModal(prev => ({ ...prev, error: language === 'tr' ? 'Yalnızca HTTPS URL kabul edilir.' : 'Only HTTPS URLs are allowed.' }));
      return;
    }
    if (mode === 'url' && !/^[a-fA-F0-9]{64}$/.test(trimmedSha)) {
      setInstallModal(prev => ({ ...prev, error: language === 'tr' ? 'URL kurulumu için 64 karakterlik SHA-256 zorunludur.' : 'A 64-character SHA-256 is required for URL installs.' }));
      return;
    }
    if (mode === 'file' && trimmedSha && !/^[a-fA-F0-9]{64}$/.test(trimmedSha)) {
      setInstallModal(prev => ({ ...prev, error: language === 'tr' ? 'SHA-256 64 hex karakter olmalıdır.' : 'SHA-256 must contain 64 hexadecimal characters.' }));
      return;
    }

    setStoreBusy(true);
    setBusyPluginId('__manual__');
    setBusyAction('install');
    setStoreMessage(language === 'tr' ? 'Eklenti doğrulanıyor…' : 'Verifying plugin…');
    try {
      const info = mode === 'url'
        ? await installPluginFromUrl({ download: { url: trimmedUrl, sha256: trimmedSha } }, trimmedDir || null)
        : await installPluginFromFile(filePath, trimmedSha || null, trimmedDir || null);
      setInstallModal({ show: false, mode: 'file', filePath: '', url: '', sha256: '', dirName: '', error: '' });
      await refreshPluginSelection(info?.identifier);
      setStoreMessage(language === 'tr' ? 'Eklenti kuruldu.' : 'Plugin installed.');
      if (setToast) {
        setToast({
          title: info?.name || (language === 'tr' ? 'Eklenti' : 'Plugin'),
          message: language === 'tr' ? 'Kurulum tamamlandı.' : 'Installation complete.',
          variant: 'success'
        });
      }
    } catch (error) {
      setInstallModal(prev => ({ ...prev, error: String(error) }));
    } finally {
      setBusyPluginId(null);
      setBusyAction(null);
      setStoreBusy(false);
    }
  };

  const handleUninstallPlugin = (plugin) => {
    setConfirmModal({
      title: language === 'tr' ? 'Eklentiyi Kaldır' : 'Uninstall Plugin',
      message: language === 'tr' ? `${plugin.name} eklentisi ve dosyaları kaldırılacak.` : `${plugin.name} and its files will be removed.`,
      confirmLabel: language === 'tr' ? 'Kaldır' : 'Uninstall',
      destructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setStoreBusy(true);
        setBusyPluginId(plugin.identifier || plugin.dirName);
        setBusyAction('uninstall');
        try {
          await uninstallPlugin(plugin.dirName);
          setSelectedPlugin(null);
          await refreshPluginSelection(null);
          setStoreMessage(language === 'tr' ? 'Eklenti kaldırıldı.' : 'Plugin uninstalled.');
        } catch (error) {
          setStoreMessage(String(error));
        } finally {
          setBusyPluginId(null);
          setBusyAction(null);
          setStoreBusy(false);
        }
      }
    });
  };

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
        let existingConfig = {};
        if (await fileSystem.exists(configPath)) {
            try {
                existingConfig = JSON.parse(await fileSystem.readFile(configPath)) || {};
            } catch (ignored) {
                existingConfig = {};
            }
        }
        await fileSystem.writeFile(configPath, { ...existingConfig, ...values });
        
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
    if (didInitRegistry.current) return;
    didInitRegistry.current = true;

    const initialize = async () => {
      // Drop the old user-editable URL; the catalog address is fixed in the app.
      try { localStorage.removeItem('isu_plugin_registry_url'); } catch (_) { /* ignore */ }

      let cached = null;
      try {
        cached = await readCachedRegistry(DEFAULT_REGISTRY_URL);
        if (cached) {
          setRegistry(cached.registry);
          setUsingCachedRegistry(true);
          await reloadInstalledPlugins(cached.registry);
        } else {
          await reloadInstalledPlugins(null);
        }
      } catch (error) {
        console.error('Plugin registry cache error:', error);
        await reloadInstalledPlugins(null);
      } finally {
        setPluginsLoading(false);
      }

      // Only hit the network when the cache is missing or older than the TTL.
      if (!isRegistryCacheFresh(cached)) {
        await handleFetchRegistry(DEFAULT_REGISTRY_URL);
      }
    };

    initialize();
    if (window.__TAURI_INTERNALS__) {
      import('@tauri-apps/api/core').then(({ invoke }) => invoke('get_platform')).then(setPlatform).catch(error => console.error('Platform lookup failed:', error));
      getAppVersion().then(setAppVersion).catch(error => console.error('Version lookup failed:', error));
    }
  }, []);

  const filteredPlugins = plugins.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
                          (p.tags || []).some(tag => String(tag).toLowerCase().includes(search.toLowerCase()));
    if (filter === 'installed') return matchesSearch && p.installed;
    if (filter === 'updates') return matchesSearch && p.updateAvailable;
    if (filter === 'browse') return matchesSearch && Boolean(p.registryEntry);
    return matchesSearch;
  });

  // Detay Görünümü
  if (selectedPlugin) {
    const detailBusy = isPluginBusy(selectedPlugin);
    const platformMismatch = Boolean(
      platform && selectedPlugin.platforms?.length > 0 && !selectedPlugin.platforms.includes(platform)
    );
    const canInstallFromStore = Boolean(selectedPlugin.registryEntry) &&
      (!selectedPlugin.installed || selectedPlugin.updateAvailable);
    const readmeHtml = selectedPlugin.readme
      ? sanitizeHtml(marked.parse(selectedPlugin.readme.replace(/\\#/g, '#').replace(/\\\*/g, '*')))
      : '';
    const metaRows = [
      { label: t('plugins_page.version', language), value: selectedPlugin.version || '—' },
      { label: t('plugins_page.author', language), value: selectedPlugin.author || '—' },
      { label: t('plugins_page.license', language), value: selectedPlugin.license || 'MIT' },
      { label: t('plugins_page.identifier', language), value: selectedPlugin.identifier || '—', mono: true }
    ];
    if (selectedPlugin.platforms?.length > 0) {
      metaRows.push({ label: t('plugins_page.platforms', language), value: selectedPlugin.platforms.join(', ') });
    }

    return (
      <div className="flex-1 h-full flex flex-col bg-[#121212] text-white overflow-hidden animate-in fade-in duration-300">
        {/* Detail Header */}
        <div className="h-16 border-b border-white/5 bg-[#1a1a1a] flex items-center px-6 gap-4 shrink-0">
          <button
            onClick={() => setSelectedPlugin(null)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
            title={language === 'tr' ? 'Geri' : 'Back'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3 min-w-0">
            <PluginIcon
              src={selectedPlugin.iconSrc}
              alt={selectedPlugin.name}
              className="w-8 h-8 rounded-lg bg-[#252525] border border-white/5"
              glyphClassName="w-4 h-4"
            />
            <h2 className="font-bold text-lg truncate">{selectedPlugin.name}</h2>
            {selectedPlugin.version && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-zinc-400 border border-white/5">v{selectedPlugin.version}</span>
            )}
          </div>
        </div>

        {/* Detail Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 space-y-8">
            {/* Hero */}
            <section className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <PluginIcon
                  src={selectedPlugin.iconSrc}
                  alt={selectedPlugin.name}
                  className="w-20 h-20 shrink-0 rounded-2xl bg-[#252525] border border-white/10"
                  glyphClassName="w-9 h-9"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-white">{selectedPlugin.name}</h1>
                    {selectedPlugin.registryEntry && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">{t('plugins_page.catalog', language)}</span>
                    )}
                    {selectedPlugin.updateAvailable && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {language === 'tr' ? `Yeni sürüm: ${selectedPlugin.latestVersion}` : `Update: ${selectedPlugin.latestVersion}`}
                      </span>
                    )}
                    {selectedPlugin.daemon && (
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        title={language === 'tr' ? 'Canlı Arka Plan Servisi (Daemon)' : 'Live Background Service (Daemon)'}
                      >
                        DAEMON
                      </span>
                    )}
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">{selectedPlugin.description}</p>

                  <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-xs">
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-600">{t('plugins_page.author', language)}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-300">{selectedPlugin.author || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-600">{t('plugins_page.version', language)}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-300">{selectedPlugin.version || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-600">{t('plugins_page.license', language)}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-300">{selectedPlugin.license || 'MIT'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 md:w-44">
                  {canInstallFromStore && (
                    <button
                      disabled={storeBusy || storeBlockedByAppVersion(selectedPlugin) || platformMismatch}
                      onClick={() => handleStoreInstall(selectedPlugin)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50"
                      style={{ backgroundColor: accentColor }}
                    >
                      {detailBusy && (busyAction === 'install' || busyAction === 'update') ? (
                        <>
                          <Spinner className="w-4 h-4" />
                          {busyLabel(busyAction, language)}
                        </>
                      ) : selectedPlugin.installed ? t('plugins_page.update', language) : t('plugins_page.install', language)}
                    </button>
                  )}
                  {selectedPlugin.installed && !selectedPlugin.updateAvailable && (
                    <button
                      onClick={(e) => handleConfigure(e, selectedPlugin)}
                      className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-zinc-200 transition-colors hover:bg-white/5"
                    >
                      {t('plugins_page.configure', language)}
                    </button>
                  )}
                  {selectedPlugin.installed && (
                    <button
                      disabled={storeBusy}
                      onClick={() => handleUninstallPlugin(selectedPlugin)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {detailBusy && busyAction === 'uninstall' ? (
                        <>
                          <Spinner className="w-4 h-4" />
                          {busyLabel('uninstall', language)}
                        </>
                      ) : (language === 'tr' ? 'Eklentiyi Kaldır' : 'Uninstall Plugin')}
                    </button>
                  )}
                  {storeBlockedByAppVersion(selectedPlugin) && (
                    <p className="text-xs leading-relaxed text-amber-400">
                      {language === 'tr'
                        ? `Bu eklenti IsuDeck ${selectedPlugin.registryEntry?.minAppVersion} veya üstünü gerektiriyor.`
                        : `This plugin requires IsuDeck ${selectedPlugin.registryEntry?.minAppVersion} or newer.`}
                    </p>
                  )}
                  {platformMismatch && (
                    <p className="text-xs leading-relaxed text-amber-400">
                      {language === 'tr' ? 'Bu eklenti bu platformu desteklemiyor.' : 'This plugin does not support this platform.'}
                    </p>
                  )}
                </div>
              </div>

              {detailBusy && (
                <div className="plugin-progress mt-6 rounded-full">
                  <span style={{ backgroundColor: accentColor }} />
                </div>
              )}
              {storeMessage && <p className="mt-4 break-words text-xs text-zinc-400">{storeMessage}</p>}
            </section>

            {/* Body */}
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Documentation */}
              <div className="min-w-0 space-y-6">
                {readmeHtml ? (
                  <article className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-6 md:p-8">
                    <h2 className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {t('plugins_page.readme', language)}
                    </h2>
                    <div className="plugin-readme" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
                  </article>
                ) : (
                  <article className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-6 md:p-8">
                    <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {t('plugins_page.overview', language)}
                    </h2>
                    <p className="text-sm leading-relaxed text-zinc-400">{selectedPlugin.description}</p>
                  </article>
                )}

                {selectedPlugin.registryEntry?.screenshots?.length > 0 && (
                  <article className="space-y-4 rounded-2xl border border-white/5 bg-[#1a1a1a] p-6 md:p-8">
                    <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {language === 'tr' ? 'Ekran Görüntüleri' : 'Screenshots'}
                    </h2>
                    <div className="space-y-4">
                      {selectedPlugin.registryEntry.screenshots.map((screenshot, index) => (
                        <img
                          key={screenshot}
                          src={screenshot}
                          alt={`${selectedPlugin.name} screenshot ${index + 1}`}
                          className="w-full rounded-xl border border-white/10"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </article>
                )}
              </div>

              {/* Sidebar */}
              <aside className="space-y-6">
                {selectedPlugin.installed && (
                  <section className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-white">
                          {selectedPlugin.enabled !== false
                            ? (language === 'tr' ? 'Eklenti Aktif' : 'Plugin Enabled')
                            : (language === 'tr' ? 'Eklenti Devre Dışı' : 'Plugin Disabled')}
                        </span>
                        <span className="text-[11px] leading-relaxed text-zinc-500">
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
                  </section>
                )}

                <section className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-6">
                  <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    {t('plugins_page.details', language)}
                  </h2>
                  <dl className="divide-y divide-white/5">
                    {metaRows.map((row) => (
                      <div key={row.label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-zinc-600">{row.label}</dt>
                        <dd className={`text-right text-xs font-medium text-zinc-300 ${row.mono ? 'font-mono break-all' : ''}`}>{row.value}</dd>
                      </div>
                    ))}
                    <div className="flex items-start justify-between gap-4 py-3 last:pb-0">
                      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                        {t('plugins_page.execution_mode', language)}
                      </dt>
                      <dd className="flex items-center gap-1.5 text-right text-xs font-medium text-zinc-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedPlugin.daemon ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`} />
                        {selectedPlugin.daemon ? t('plugins_page.daemon_mode', language) : t('plugins_page.oneshot_mode', language)}
                      </dd>
                    </div>
                  </dl>
                </section>

                {selectedPlugin.registryEntry?.changelog && (
                  <a
                    href={selectedPlugin.registryEntry.changelog}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#1a1a1a] px-5 py-4 text-xs font-medium text-zinc-300 transition-colors hover:border-white/10 hover:text-white"
                  >
                    <span>{language === 'tr' ? 'Değişiklik günlüğü' : 'Changelog'}</span>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                  </a>
                )}

                {selectedPlugin.actions?.length > 0 && (
                  <section className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-6">
                    <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {t('plugins_page.included_actions', language)}
                    </h2>
                    <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {selectedPlugin.actions.map((action, i) => (
                        <li key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold text-white">{action.label || action.name}</div>
                            <div className="truncate text-[10px] text-zinc-500">{action.name}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
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

      {filter === 'browse' && (
        <div className="mb-6 p-4 bg-[#1a1a1a] border border-white/5 rounded-xl space-y-3 shrink-0">
          <div className="flex flex-wrap gap-2">
            <button disabled={storeBusy} onClick={() => handleFetchRegistry(DEFAULT_REGISTRY_URL)} className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: accentColor }}>
              {storeBusy ? (language === 'tr' ? 'Bekleyin…' : 'Working…') : (language === 'tr' ? 'Kataloğu Yenile' : 'Refresh Catalog')}
            </button>
            <button disabled={storeBusy} onClick={handleInstallFromUrl} className="px-4 py-2 rounded-lg text-sm font-bold border border-white/10 text-zinc-200 disabled:opacity-50">
              {language === 'tr' ? 'URL’den ZIP Kur' : 'Install ZIP from URL'}
            </button>
            <button disabled={storeBusy} onClick={handleInstallFromFile} className="px-4 py-2 rounded-lg text-sm font-bold border border-white/10 text-zinc-200 disabled:opacity-50">
              {language === 'tr' ? 'Dosyadan ZIP Kur' : 'Install ZIP from File'}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            {usingCachedRegistry
              ? (language === 'tr' ? 'Önbellekteki katalog gösteriliyor; çevrimdışı da kullanılabilir.' : 'Showing the cached catalog; it is available offline.')
              : (language === 'tr' ? 'Katalog adresi uygulamada sabittir. Liste en fazla 6 saatte bir otomatik yenilenir. ZIP URL kurulumunda SHA-256 zorunludur.' : 'The catalog URL is fixed in the app. It refreshes automatically at most once every 6 hours. SHA-256 is required for URL installs.')}
          </p>
          {storeMessage && <p className="text-xs text-zinc-300 break-words">{storeMessage}</p>}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pr-2 pb-20">
        {pluginsLoading && filteredPlugins.length === 0 && (
          <>
            {Array.from({ length: 8 }).map((_, index) => (
              <PluginCardSkeleton key={`skeleton-${index}`} />
            ))}
          </>
        )}

        {filteredPlugins.map((plugin, idx) => {
          const cardBusy = isPluginBusy(plugin);
          const platformMismatch = Boolean(
            platform && plugin.platforms?.length > 0 && !plugin.platforms.includes(platform)
          );

          return (
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
              <PluginIcon
                src={plugin.iconSrc}
                alt={plugin.name}
                className="w-12 h-12 rounded-xl bg-[#252525] border border-white/5 shadow-inner"
                glyphClassName="w-6 h-6"
              />
              <div className="flex items-center gap-2">
                {plugin.daemon && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20" title={language === 'tr' ? 'Canlı Arka Plan Servisi (Daemon)' : 'Live Background Service (Daemon)'}>DAEMON</span>
                )}
                {plugin.registryEntry && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300">{language === 'tr' ? 'Katalog' : 'Catalog'}</span>
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
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-zinc-600 font-bold uppercase">{t('plugins_page.author', language)}</span>
                <span className="text-xs text-zinc-400 font-medium truncate">{plugin.author}</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (plugin.installed && !plugin.updateAvailable) handleConfigure(e, plugin);
                  else handleStoreInstall(plugin);
                }}
                disabled={storeBusy || storeBlockedByAppVersion(plugin) || platformMismatch}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-60 ${
                cardBusy
                  ? 'bg-[#252525] text-zinc-200 border border-white/10'
                  : plugin.installed
                    ? plugin.updateAvailable ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-[#252525] text-zinc-400 hover:bg-[#333] hover:text-white border border-white/5'
                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
              }`}>
                {cardBusy ? (
                  <>
                    <Spinner className="w-3 h-3" />
                    {busyLabel(busyAction, language)}
                  </>
                ) : plugin.installed
                  ? plugin.updateAvailable ? (language === 'tr' ? 'Güncelle' : 'Update') : t('plugins_page.configure', language)
                  : (language === 'tr' ? 'Kur' : 'Install')}
              </button>
            </div>

            {cardBusy && (
              <div className="plugin-progress absolute inset-x-0 bottom-0">
                <span style={{ backgroundColor: accentColor }} />
              </div>
            )}
          </div>
          );
        })}
        
        {/* Empty State */}
        {!pluginsLoading && filteredPlugins.length === 0 && (
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
      {/* Installation Modal */}
      {installModal.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col animate-in zoom-in-95 duration-200">
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#252525] rounded-t-2xl">
              <h2 className="text-lg font-bold text-white">
                {installModal.mode === 'url'
                  ? (language === 'tr' ? 'URL’den ZIP Kur' : 'Install ZIP from URL')
                  : (language === 'tr' ? 'Dosyadan ZIP Kur' : 'Install ZIP from File')}
              </h2>
              <button
                onClick={() => setInstallModal({ show: false, mode: 'file', filePath: '', url: '', sha256: '', dirName: '', error: '' })}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {installModal.mode === 'url' ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">ZIP URL</span>
                    <input
                      type="url"
                      value={installModal.url}
                      onChange={(event) => setInstallModal(prev => ({ ...prev, url: event.target.value, error: '' }))}
                      placeholder="https://example.com/plugin.zip"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-sm"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">SHA-256</span>
                    <input
                      type="text"
                      value={installModal.sha256}
                      onChange={(event) => setInstallModal(prev => ({ ...prev, sha256: event.target.value, error: '' }))}
                      placeholder="64 hexadecimal characters"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-sm font-mono"
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">ZIP File</span>
                    <p className="text-sm text-zinc-300 bg-[#121212] border border-white/10 rounded-xl px-4 py-3 break-all">{installModal.filePath}</p>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">SHA-256 (optional)</span>
                    <input
                      type="text"
                      value={installModal.sha256}
                      onChange={(event) => setInstallModal(prev => ({ ...prev, sha256: event.target.value, error: '' }))}
                      placeholder="64 hexadecimal characters"
                      className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-sm font-mono"
                    />
                  </label>
                  {!installModal.sha256.trim() && (
                    <p className="text-xs text-amber-400 leading-relaxed">
                      {language === 'tr'
                        ? 'SHA-256 boş. Dosya kaynağı doğrulanamaz; kurulum doğrulanmamış sayılır.'
                        : 'No SHA-256. The file source cannot be verified; this install is considered unverified.'}
                    </p>
                  )}
                </>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{language === 'tr' ? 'Klasör adı (isteğe bağlı)' : 'Folder name (optional)'}</span>
                <input
                  type="text"
                  value={installModal.dirName}
                  onChange={(event) => setInstallModal(prev => ({ ...prev, dirName: event.target.value, error: '' }))}
                  placeholder={language === 'tr' ? 'Boş bırakılırsa plugin kimliği kullanılır' : 'Leave empty to use the plugin identifier'}
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </label>

              {installModal.error && <p className="text-xs text-red-400 break-words leading-relaxed">{installModal.error}</p>}
            </div>

            <div className="h-20 border-t border-white/5 bg-[#252525] rounded-b-2xl flex items-center justify-end px-6 gap-3">
              <button
                onClick={() => setInstallModal({ show: false, mode: 'file', filePath: '', url: '', sha256: '', dirName: '', error: '' })}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                {t('plugins_page.cancel', language)}
              </button>
              <button
                disabled={storeBusy}
                onClick={submitInstall}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {storeBusy ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    {language === 'tr' ? 'Kuruluyor…' : 'Installing…'}
                  </>
                ) : (language === 'tr' ? 'Kur' : 'Install')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-3">
              <h2 className="text-lg font-bold text-white">{confirmModal.title}</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="h-20 border-t border-white/5 bg-[#252525] rounded-b-2xl flex items-center justify-end px-6 gap-3">
              <button onClick={() => setConfirmModal(null)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                {t('plugins_page.cancel', language)}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                style={{ backgroundColor: confirmModal.destructive ? '#dc2626' : accentColor }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
