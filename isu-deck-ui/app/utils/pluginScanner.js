// Eski importları sil, bunları yapıştır:
import { readDir, readTextFile, readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path'; // Yol birleştirme işi hala burada

export const scanPlugins = async () => {
  try {
    // Tarayıcıda mıyız kontrolü (Tauri yoksa patlamasın)
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
      return [];
    }

    console.log("Plugin taraması başlıyor...");

    // 1. Plugins klasörünü RESOURCE dizininde ara
    // Capabilities dosyasında $RESOURCE/plugins izni verdiğimiz için burası çalışır.
    const pluginsDirName = 'plugins';

    // Klasör var mı?
    // Not: v2'de exists fonksiyonu da plugin-fs'den gelir
    // baseDir: BaseDirectory.Resource diyerek .exe'nin yanına bak diyoruz.
    try {
        const entries = await readDir(pluginsDirName, { baseDir: BaseDirectory.Resource });
        
        const plugins = [];

        for (const entry of entries) {
            if (entry.isDirectory) {
                // Her klasörün içine gir (Örn: plugins/Spotify)
                // Burada join kullanarak tam yolu buluyoruz ama okurken yine baseDir kullanacağız.
                const pluginJsonPath = await join(pluginsDirName, entry.name, 'plugin.json');
                const readmePath = await join(pluginsDirName, entry.name, 'README.md');

                // JSON dosyasını okumaya çalış
                try {
                    // readTextFile, baseDir ile çalışır.
                    const jsonContent = await readTextFile(pluginJsonPath, { baseDir: BaseDirectory.Resource });
                    const pluginData = JSON.parse(jsonContent);

                    // README okuma (Varsa)
                    let readmeContent = null;
                    try {
                        readmeContent = await readTextFile(readmePath, { baseDir: BaseDirectory.Resource });
                    } catch {}

                    // İkon okuma (Base64 çevirme)
                    let iconSrc = null;
                    if (pluginData.icon) {
                        try {
                            const iconPath = await join(pluginsDirName, entry.name, pluginData.icon);
                            const iconBytes = await readFile(iconPath, { baseDir: BaseDirectory.Resource });
                            
                            // Byte array'i Base64 yap
                            const base64Icon = btoa(
                                new Uint8Array(iconBytes)
                                .reduce((data, byte) => data + String.fromCharCode(byte), '')
                            );
                            
                            const ext = pluginData.icon.split('.').pop().toLowerCase();
                            const mime = ext === 'svg' ? 'image/svg+xml' : (ext === 'png' ? 'image/png' : 'image/jpeg');
                            iconSrc = `data:${mime};base64,${base64Icon}`;
                        } catch (err) {
                            console.warn("İkon okunamadı:", err);
                        }
                    }

                    plugins.push({
                        ...pluginData,
                        dirName: entry.name, // Klasör adı
                        readme: readmeContent,
                        iconSrc: iconSrc || pluginData.icon,
                        installed: true
                    });

                } catch (err) {
                    // plugin.json yoksa veya bozuksa bu klasörü geç
                    console.warn(`[${entry.name}] geçerli bir plugin değil:`, err);
                }
            }
        }
        return plugins;

    } catch (err) {
        console.error("Plugins klasörü okunamadı (İzin hatası veya klasör yok):", err);
        return [];
    }

  } catch (e) {
    console.error('Kritik tarama hatası:', e);
    return [];
  }
};