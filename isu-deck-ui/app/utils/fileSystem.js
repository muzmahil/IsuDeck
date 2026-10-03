import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';

const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

export const fileSystem = {
  // Uygulama klasörünü başlat (Yoksa oluştur)
  async init() {
    if (!isTauri()) return;
    try {
      const exists = await invoke('fs_exists', { path: 'plugins' });
      if (!exists) {
        await invoke('fs_create_dir', { path: 'plugins' });
      }
    } catch (e) {
      console.error('FileSystem Init Error:', e);
      throw e;
    }
  },

  // Dosya varlığını kontrol et, yoksa varsayılan içerikle oluştur
  async ensureFile(filename, defaultContent) {
    if (!isTauri()) {
      // Tarayıcı Fallback (LocalStorage)
      const key = `isu_${filename.replace('.json', '')}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(defaultContent));
      }
      return;
    }

    try {
      const exists = await invoke('fs_exists', { path: filename });
      if (!exists) {
        await invoke('fs_write_file', { 
          path: filename, 
          content: JSON.stringify(defaultContent, null, 2) 
        });
      }
    } catch (e) {
      console.error(`Ensure File Error (${filename}):`, e);
    }
  },

  async readFile(filename) {
    if (!isTauri()) {
      const key = `isu_${filename.replace('.json', '')}`;
      return localStorage.getItem(key);
    }
    return await invoke('fs_read_file', { path: filename });
  },

  async writeFile(filename, content) {
    const strContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    if (!isTauri()) {
      const key = `isu_${filename.replace('.json', '')}`;
      localStorage.setItem(key, strContent);
      return;
    }
    try {
      await invoke('fs_write_file', { path: filename, content: strContent });
    } catch (e) {
      console.error(`Write File Error (${filename}):`, e);
    }
  },

  // Pluginleri Tara
  async scanPlugins() {
    if (!isTauri()) return [];
    const plugins = [];
    try {
      const exists = await invoke('fs_exists', { path: 'plugins' });
      if (!exists) {
        await invoke('fs_create_dir', { path: 'plugins' });
        return [];
      }

      const entries = await invoke('fs_read_dir', { path: 'plugins' });
      
      for (const entryName of entries) {
        try {
            const jsonPath = `plugins/${entryName}/plugin.json`;
            const readmePath = `plugins/${entryName}/README.md`;
            const configPath = `plugins/${entryName}/config.json`;
            
            const jsonExists = await invoke('fs_exists', { path: jsonPath });

            if (jsonExists) {
              const jsonContent = await invoke('fs_read_file', { path: jsonPath });
              const pluginData = JSON.parse(jsonContent);
              
              // Load User Config
              let userConfig = {};
              const configExists = await invoke('fs_exists', { path: configPath });
              if (configExists) {
                 try {
                    const configContent = await invoke('fs_read_file', { path: configPath });
                    userConfig = JSON.parse(configContent);
                 } catch(e) { console.warn('Config parse error', e); }
              }

              // Merge Config
              if (pluginData.config && Array.isArray(pluginData.config)) {
                  pluginData.config = pluginData.config.map(cfg => ({
                      ...cfg,
                      value: userConfig[cfg.key] !== undefined ? userConfig[cfg.key] : cfg.value
                  }));
              }

              let readme = null;
              const readmeExists = await invoke('fs_exists', { path: readmePath });
              if (readmeExists) {
                readme = await invoke('fs_read_file', { path: readmePath });
              }

              // İkon Yükleme Yardımcısı (SVG, PNG, JPG, JPEG destekli)
              const loadIcon = async (iconPath) => {
  if (!iconPath) return null;

  // Uzak URL ise dokunma
  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
      return iconPath;
  }

  try {
      // ./ veya / ile başlıyorsa temizle
      const cleanPath = iconPath.replace(/^(\.?\/)/, '');
      const relativePath = `plugins/${entryName}/${cleanPath}`;
      
      const exists = await invoke('fs_exists', { path: relativePath });
      
      if (exists) {
          // 🔥 DEĞİŞİKLİK BURADA:
          // Rust'tan binary (sayı dizisi) olarak veriyi çekiyoruz
          const bytes = await invoke('fs_read_binary', { path: relativePath });
          
          // Dosya uzantısına göre MIME tipini belirle
          const ext = cleanPath.split('.').pop().toLowerCase();
          let mime = 'image/png'; // Varsayılan
          if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
          if (ext === 'svg') mime = 'image/svg+xml';
          if (ext === 'gif') mime = 'image/gif';
          
          // Blob oluştur ve URL'e çevir
          const blob = new Blob([new Uint8Array(bytes)], { type: mime });
          return URL.createObjectURL(blob);
      }
  } catch (e) {
      console.warn(`Icon load error (${iconPath}):`, e);
  }
  return null;
};

              const pluginIconSrc = await loadIcon(pluginData.icon || pluginData.iconSrc);

              if (pluginData.actions) {
                for (const action of pluginData.actions) {
                    if (action.icon) action.iconSrc = await loadIcon(action.icon);
                }
              }

              plugins.push({
                ...pluginData,
                dirName: entryName,
                readme,
                iconSrc: pluginIconSrc,
                installed: true,
                enabled: userConfig.enabled !== undefined ? userConfig.enabled : (pluginData.enabled !== undefined ? pluginData.enabled : true),
                daemon: pluginData.daemon !== undefined ? pluginData.daemon : (pluginData.background !== undefined ? pluginData.background : false)
              });
            }
        } catch (err) {
            console.warn(`Skipping plugin ${entryName}:`, err);
        }
      }
    } catch (e) {
      console.error('Plugin Scan Error:', e);
    }
    return plugins;
  },

  // Wrapper Metotlar
  createDir: (path) => invoke("fs_create_dir", { path }),
  exists: (path) => invoke("fs_exists", { path }),
  readDir: (path) => invoke("fs_read_dir", { path })
};