import { invoke } from '@tauri-apps/api/core';
import { fileSystem } from './fileSystem';

const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
const CACHE_FILE = 'plugin_registry_cache.json';

// The catalog is static, so re-downloading it on every visit only burns requests.
// Automatic refreshes happen at most once per window; the Refresh button bypasses this.
export const REGISTRY_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export const isRegistryCacheFresh = (cached, maxAgeMs = REGISTRY_CACHE_MAX_AGE_MS) => {
  if (!cached || !cached.fetchedAt) return false;
  const age = Date.now() - cached.fetchedAt;
  return age >= 0 && age < maxAgeMs;
};

const parseRegistry = (content) => {
  const registry = JSON.parse(content);
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.plugins)) {
    throw new Error('Unsupported plugin registry schema.');
  }
  return registry;
};

const registryCandidates = (url) => {
  const trimmed = url.trim();
  const candidates = [trimmed];
  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname.toLowerCase().endsWith('.json')) {
      const base = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
      candidates.push(new URL('registry.json', base).toString());
    }
  } catch (_) {
    // Keep the raw value so Rust can return the validation error.
  }
  return [...new Set(candidates)];
};

export const fetchRegistry = async (url) => {
  if (!isTauri()) throw new Error('Plugin store requires the IsuDeck desktop app.');

  const candidates = registryCandidates(url);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const content = await invoke('plugin_store_fetch_registry', { url: candidate });
      return { registry: parseRegistry(content), offline: false, sourceUrl: candidate };
    } catch (error) {
      lastError = error;
    }
  }

  for (const candidate of candidates) {
    const cached = await readCachedRegistry(candidate);
    if (cached) return { registry: cached.registry, offline: true, sourceUrl: candidate };
  }
  throw lastError;
};

export const readCachedRegistry = async (url) => {
  try {
    const cached = isTauri()
      ? (await fileSystem.exists(CACHE_FILE) ? await fileSystem.readFile(CACHE_FILE) : null)
      : await fileSystem.readFile(CACHE_FILE);
    if (!cached) return null;
    const cache = JSON.parse(cached);
    if (cache.sourceUrl !== url || typeof cache.content !== 'string') return null;
    return {
      registry: parseRegistry(cache.content),
      fetchedAt: Number(cache.fetchedAt) || 0
    };
  } catch (_) {
    return null;
  }
};

export const installPluginFromUrl = (plugin, dirName = null) =>
  invoke('plugin_store_install_from_url', {
    url: plugin.download.url,
    sha256: plugin.download.sha256,
    dirName,
    expectedIdentifier: plugin.identifier || null,
    expectedSize: plugin.download.size || null
  });

export const installPluginFromFile = (path, sha256 = null, dirName = null) =>
  invoke('plugin_store_install_from_file', { path, sha256, dirName });

export const uninstallPlugin = (dirName) =>
  invoke('plugin_store_uninstall', { dirName });
