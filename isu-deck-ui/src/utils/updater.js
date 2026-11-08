import { invoke } from '@tauri-apps/api/core';

/**
 * Compare two semver strings (e.g. 'v1.1.0' vs '1.0.0')
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if they are equal.
 */
export function compareVersions(v1, v2) {
  const clean1 = (v1 || '').replace(/^[vV]/, '').trim();
  const clean2 = (v2 || '').replace(/^[vV]/, '').trim();

  const parts1 = clean1.split('.').map(num => parseInt(num, 10) || 0);
  const parts2 = clean2.split('.').map(num => parseInt(num, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export async function getAppVersion() {
  try {
    return await invoke('get_app_version');
  } catch {
    return '1.2.0';
  }
}

export async function getPlatform() {
  try {
    return await invoke('get_platform');
  } catch {
    return typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('linux')
      ? 'linux'
      : 'windows';
  }
}

export async function openExternalUrl(url) {
  if (!url) return;
  try {
    await invoke('open_external_url', { url });
  } catch (err) {
    console.error('Failed to open external URL via Tauri, falling back to window.open:', err);
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) {}
  }
}

export async function checkForUpdates() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const currentVersion = await getAppVersion();
    const platform = await getPlatform();
    const response = await fetch('https://api.github.com/repos/muzmahil/IsuDeck/releases/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github.v3+json' }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    const data = await response.json();
    const latestVersion = (data.tag_name || '').replace(/^[vV]/, '').trim();
    let downloadUrl = data.html_url || 'https://github.com/muzmahil/IsuDeck/releases/latest';

    if (Array.isArray(data.assets)) {
      const releaseAsset = platform === 'windows'
        ? data.assets.find(asset => asset.name && /^IsuDeck\.exe$/i.test(asset.name))
        : null;
      if (releaseAsset?.browser_download_url) {
        downloadUrl = releaseAsset.browser_download_url;
      }
    }

    return {
      success: true,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion: data.tag_name || `v${latestVersion}`,
      releaseName: data.name || `Release ${data.tag_name}`,
      releaseNotes: data.body || '',
      publishedAt: data.published_at || '',
      htmlUrl: data.html_url || 'https://github.com/muzmahil/IsuDeck/releases/latest',
      downloadUrl,
      platform
    };
  } catch (error) {
    const currentVersion = await getAppVersion();
    const platform = await getPlatform();
    return {
      success: false,
      updateAvailable: false,
      currentVersion,
      platform,
      htmlUrl: 'https://github.com/muzmahil/IsuDeck/releases/latest',
      error: error.name === 'AbortError' ? 'Connection timed out' : (error.message || 'Failed to check updates')
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
