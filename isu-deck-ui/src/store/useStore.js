import { create } from 'zustand';
import { dictionary } from '../utils/dictionary';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fileSystem } from '../utils/fileSystem';
import {
  changeVariableInList,
  executeLogicSequence as runLogicSequence,
  setVariableInList
} from '../utils/logicEngine';
import {
  STATIC_ACTION_KEYS,
  collectHoldReleaseActions,
  isHoldReleaseAction
} from '../utils/holdRelease';

export { isHoldReleaseAction } from '../utils/holdRelease';

let profileWriteQueue = Promise.resolve();

// Tracks bindings that are currently held down. Windows key auto-repeat sends
// repeated key-down events, so this prevents hold-mode actions from spamming.
const heldBindingKeys = new Set();

export const getHoldBindingKey = (message) => {
  if (!message) return '';
  const hid = message.hid !== undefined && message.hid !== null ? String(message.hid) : '*';
  return `${hid}::${String(message.key)}`;
};

export const claimHoldBinding = (key) => {
  if (!key) return false;
  if (heldBindingKeys.has(key)) return false;
  heldBindingKeys.add(key);
  return true;
};

export const releaseHoldBinding = (key) => {
  if (!key) return false;
  return heldBindingKeys.delete(key);
};

const enqueueProfileWrite = (operation) => {
  const result = profileWriteQueue.then(operation, operation);
  profileWriteQueue = result.catch(() => {});
  return result;
};

const useStore = create((set, get) => ({
  // ... (Diğer State ve Setter'lar AYNI KALSIN) ...
  activeTab: 'deck',
  connectionStatus: 'disconnected',
  latency: 0,
  lastMessage: null,
  toast: null,
  isInputRecording: false,
  plugins: [],
  language: 'en',
  isMiniMode: false,
  isAlwaysOnTop: false,
  customSounds: ['click.wav', 'mech.wav', 'beep.wav'],
  isDriverInstalled: true,
  driverStatus: 'active',
  lastHandledMsgId: null,
  markMessageHandled: (msgId) => set({ lastHandledMsgId: msgId }),
  updateInfo: null,
  updatePromptOpen: false,
  setUpdatePromptOpen: (open) => set({ updatePromptOpen: open }),
  isCheckingUpdate: false,
  settingsLoaded: false,
  setUpdateInfo: (info) => set({ updateInfo: info }),
  setIsCheckingUpdate: (bool) => set({ isCheckingUpdate: bool }),
  settings: {
    theme: 'dark', // midnight, dark, light
    accentColor: '#3b82f6',
    deckBackground: null,
    deckBackgroundFit: 'cover', // cover, stretch, contain, tile
    deckBacklight: true,
    minimizeToTray: false,
    autoStart: false,
    autoCheckUpdates: true,
    skippedUpdateVersion: null,
    deferredUpdateVersion: null,
    updateReminderAt: 0,
    defaultSoundFeedback: true,
    defaultShowTitle: true,
    defaultGridSize: 15,
    selectedSound: 'click.wav',
    enableDynamicButtonStates: true,
    port: 12345
  },

  dynamicButtonStates: {},
  setDynamicButtonState: (payload) => set((state) => {
    const { action, filter = {}, exclusive, state: btnState } = payload;
    if (!action) return state;

    const filterEntries = Object.entries(filter).sort(([a], [b]) => a.localeCompare(b));
    const filterKey = filterEntries.map(([k, v]) => `${k}:${v}`).join(';');
    const lookupKey = `${action}::${filterKey}`;

    let newStates = { ...state.dynamicButtonStates };
    if (exclusive) {
      Object.keys(newStates).forEach((k) => {
        if (k.startsWith(`${action}::`) && k !== lookupKey) {
          newStates[k] = { ...newStates[k], active: false, badge: null };
        }
      });
    }

    newStates[lookupKey] = btnState;
    return { dynamicButtonStates: newStates };
  }),

  // Variables & System Metrics State
  variables: [
    { id: 'var_vol', name: 'vol', type: 'number', value: 50, defaultValue: 50, min: 0, max: 100, step: 10, description: 'Master Volume' },
    { id: 'var_counter', name: 'counter', type: 'number', value: 0, defaultValue: 0, min: 0, max: 9999, step: 1, description: 'General Counter' }
  ],
  systemMetrics: {
    volume: 50,
    mute: false,
    cpu: 15,
    ram: 42,
    time24: '12:00',
    time12: '12:00 PM',
    battery: 100
  },

  loadVariables: async () => {
    try {
      const content = await fileSystem.readFile('variables.json');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ variables: parsed });
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Variables load fallback:", e);
    }
    const defaultVars = get().variables;
    await fileSystem.writeFile('variables.json', defaultVars);
    return defaultVars;
  },

  saveVariables: async (newVars) => {
    set({ variables: newVars });
    await fileSystem.writeFile('variables.json', newVars);
  },

  setVariableValue: (name, val) => set((state) => {
    const updated = setVariableInList(state.variables, name, val);
    fileSystem.writeFile('variables.json', updated).catch(() => {});
    return { variables: updated };
  }),

  changeVariableValue: (name, delta, min, max, syncSystemVolume) => set((state) => {
    const { variables: updated, value } = changeVariableInList(
      state.variables,
      name,
      delta,
      min,
      max
    );

    fileSystem.writeFile('variables.json', updated).catch(() => {});

    if (syncSystemVolume && value !== null) {
      state.sendToEngine({ type: 'SET_SYSTEM_VOLUME', percent: value });
      return {
        variables: updated,
        systemMetrics: { ...state.systemMetrics, volume: value }
      };
    }

    return { variables: updated };
  }),

  updateSystemMetrics: (partial) => set((state) => ({
    systemMetrics: { ...state.systemMetrics, ...partial }
  })),

  /**
   * Refresh clock/battery metrics and, when the native engine exposes
   * `get_system_metrics`, CPU/RAM usage as well.
   */
  refreshSystemMetrics: async (partial = {}) => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const next = {
      time24: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      time12: now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      ...partial
    };

    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.getBattery === 'function'
      ) {
        const battery = await navigator.getBattery();
        if (battery && Number.isFinite(Number(battery.level))) {
          next.battery = Math.round(Number(battery.level) * 100);
        }
      }
    } catch (_) {
      /* Battery API unavailable in this webview. */
    }

    try {
      const nativeMetrics = await invoke('get_system_metrics');
      if (nativeMetrics && typeof nativeMetrics === 'object') {
        if (nativeMetrics.cpu !== undefined && nativeMetrics.cpu !== null) {
          next.cpu = Math.round(Number(nativeMetrics.cpu));
        }
        if (nativeMetrics.ram !== undefined && nativeMetrics.ram !== null) {
          next.ram = Math.round(Number(nativeMetrics.ram));
        }
        if (nativeMetrics.battery !== undefined && nativeMetrics.battery !== null) {
          next.battery = Math.round(Number(nativeMetrics.battery));
        }
      }
    } catch (_) {
      /* Native metrics command not available (browser preview or older build). */
    }

    set((state) => ({ systemMetrics: { ...state.systemMetrics, ...next } }));
    return get().systemMetrics;
  },

  executeLogicSequence: async (actions, options = {}) => {
    await runLogicSequence(actions, {
      getVariables: () => get().variables,
      setVariables: (variables) => {
        set({ variables });
        fileSystem.writeFile('variables.json', variables).catch(() => {});
      },
      getSystemMetrics: () => get().systemMetrics,
      sendToEngine: (payload) => get().sendToEngine(payload),
      loadProfiles: () => get().loadProfiles(),
      saveProfiles: (profiles) => get().saveProfiles(profiles),
      updateSystemMetrics: (partial) => get().updateSystemMetrics(partial)
    }, options);
  },

  executeHoldRelease: async (actions) => {
    const releaseActions = collectHoldReleaseActions(actions);
    if (releaseActions.length === 0) return;

    const { sendToEngine } = get();
    for (const act of releaseActions) {
      await sendToEngine({
        type: 'EXECUTE_ACTION',
        actionData: { actions: [{ ...act, phase: 'release' }] }
      });
    }
  },

  setIsDriverInstalled: (val) => set({ isDriverInstalled: val }),
  setDriverStatus: (status) => set({ driverStatus: status, isDriverInstalled: status === 'active' }),
  setIsMiniMode: (val) => set({ isMiniMode: val }),
  setIsAlwaysOnTop: async (val) => {
    set({ isAlwaysOnTop: val });
    try {
      await invoke('set_window_always_on_top', { alwaysOnTop: val });
    } catch (e) {
      console.error('set_window_always_on_top error:', e);
    }
  },
  toggleAlwaysOnTop: async () => {
    const current = get().isAlwaysOnTop;
    const next = !current;
    set({ isAlwaysOnTop: next });
    try {
      await invoke('set_window_always_on_top', { alwaysOnTop: next });
    } catch (e) {
      console.error('set_window_always_on_top error:', e);
    }
  },
  setCustomSounds: (sounds) => set({ customSounds: sounds }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLatency: (latency) => set({ latency }),
  setLastMessage: (message) => set({ lastMessage: message }),
  setToast: (toast) => set({ toast }),
  setIsInputRecording: (isRecording) => set({ isInputRecording: isRecording }),
  profiles: [],
  setProfiles: (profiles) => set({ profiles }),
  setPlugins: (plugins) => set({ plugins }),
  setLanguage: (lang) => {
    set({ language: lang });
    try {
      invoke('update_tray_language', { lang });
    } catch (e) {
      console.error('update_tray_language error:', e);
    }
  },

  checkDriver: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let status = 'uninstalled';
      try {
        status = await invoke('check_driver_status');
      } catch (_) {
        const installed = await invoke('check_driver_installed');
        status = installed ? 'active' : 'uninstalled';
      }
      set({
        driverStatus: status,
        isDriverInstalled: status === 'active'
      });
      return status;
    } catch (e) {
      console.log('checkDriver error:', e);
      return 'uninstalled';
    }
  },

  t: (key, lang) => {
    if (typeof key !== 'string') return key || '';
    if (!dictionary || !dictionary[lang]) return key;
    const keys = key.split('.');
    let value = dictionary[lang] || dictionary['en'];
    for (const k of keys) { value = value?.[k]; }
    return value || key;
  },

  // --- YENİ İLETİŞİM FONKSİYONU (Tauri Invoke) ---
  sendToEngine: async (payload) => {
    try {
      await invoke('send_action', {
        actionData: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Engine Send Error:", err);
      set({ connectionStatus: 'disconnected' });
    }
  },

  // --- YENİ DİNLEME FONKSİYONU (Tauri Event) ---
 startListener: async () => {
  try {
    // 👂 1. KULAK: Sadece Tuş Vuruşlarını ve Ping'i Dinler (INPUT_EVENT)
    const unlistenInput = await listen('INPUT_EVENT', (event) => {
      let data = event.payload;
      
      // String kontrolü (Ping vs için)
      if (typeof data === 'string') {
        if (data.trim() === 'pong') {
          data = { type: 'pong' };
        } else {
          try { data = JSON.parse(data); } catch { return; }
        }
      }

      if (data) {
        // Tuş basıldıysa veya toast mesajıysa store'a işle
        if (data.type === 'SHOW_TOAST') {
            set({ toast: data });
        } else {
            // "inputPressed" gibi olaylar buraya düşer
            if (!data._msgId) {
              data._msgId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              data._timestamp = Date.now();
            }
            set({ lastMessage: data });
        }
      }
    });

    // 👂 2. KULAK: Sadece Veri Cevaplarını Dinler (ACTION_DATA_RESPONSE)
    // Rust tarafında: app_handle.emit("ACTION_DATA_RESPONSE", json_string) denmeli.
    const unlistenActionData = await listen('ACTION_DATA_RESPONSE', (event) => {
      let data = event.payload;

      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }

      if (data) {
        // Bunu da lastMessage'a atıyoruz ki ActionEditor yakalasın
        // (ActionEditor useEffect içinde lastMessage'ı dinliyor zaten)
        set({ lastMessage: data });
      }
    });

    // 👂 3. KULAK: Plugin Canlı Buton Durumlarını Dinler (plugin_button_state_update)
    const unlistenPluginState = await listen('plugin_button_state_update', (event) => {
      let payload = event.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (payload && payload.action) {
        get().setDynamicButtonState(payload);
      }
    });

    // 👋 TEMİZLİK: Fonksiyon return ettiğinde (unmount olduğunda) dinleyicileri kapat
    return () => {
      unlistenInput();
      unlistenActionData();
      unlistenPluginState();
    };

  } catch (e) {
    console.error('[Store] Listener başlatma hatası:', e);
    return null;
  }
},

  // --- UYGULAMAYI YENİDEN BAŞLAT ---
  restartApp: async () => {
    try {
      // Tauri v2 Process Plugin (Dinamik import)
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error("Relaunch error:", err);
    }
  },

  // --- AYAR YÖNETİMİ ---
  loadSettings: async () => {
    try {
      const content = await fileSystem.readFile('settings.json');
      if (content) {
        const parsed = JSON.parse(content);
        set((state) => ({ settings: { ...state.settings, ...parsed } }));
        if (parsed.language) {
          set({ language: parsed.language });
          if (typeof window !== 'undefined') {
            localStorage.setItem('isu_language', parsed.language);
          }
        }
        const { sendToEngine } = get();
        if (parsed.minimizeToTray !== undefined) {
          sendToEngine({ type: 'SET_MINIMIZE_TO_TRAY', value: !!parsed.minimizeToTray });
        }
        await get().checkDriver();
      }
    } catch (e) {
      console.error("Settings Load Error:", e);
    } finally {
      set({ settingsLoaded: true });
    }
  },

  updateSetting: async (key, value) => {
    const { settings, sendToEngine } = get();
    const newSettings = { ...settings, [key]: value };
    set({ settings: newSettings });
    await fileSystem.writeFile('settings.json', newSettings);

    if (key === 'minimizeToTray') {
      sendToEngine({ type: 'SET_MINIMIZE_TO_TRAY', value: !!value });
    }
  },

  // --- PROFİL YÖNETİMİ & RAM CACHE ---
  loadProfiles: async () => {
    try {
      const content = await fileSystem.readFile('profiles.json');
      if (content) {
        const parsed = JSON.parse(content);
        set({ profiles: parsed });
        return parsed;
      }
    } catch (e) {
      console.error("Profiles Load Error:", e);
    }
    return [];
  },

  saveProfiles: async (newProfiles) => {
    return enqueueProfileWrite(async () => {
      await fileSystem.writeFile('profiles.json', newProfiles);
      set({ profiles: newProfiles });
      return newProfiles;
    });
  },

  updateActiveProfile: (profileId, changes) => enqueueProfileWrite(async () => {
    if (profileId === null || profileId === undefined) {
      throw new Error('Cannot save deck changes without an active profile ID.');
    }

    const content = await fileSystem.readFile('profiles.json');
    const profiles = content ? JSON.parse(content) : [];
    const profileIndex = profiles.findIndex(profile => String(profile.id) === String(profileId));
    if (profileIndex === -1) {
      throw new Error(`Active profile ${profileId} was not found while saving deck changes.`);
    }

    const activeProfile = profiles.find(profile => profile.isActive) || profiles[0];
    if (String(activeProfile.id) !== String(profileId)) {
      throw new Error('Active profile changed before deck changes could be saved.');
    }

    const updatedProfiles = profiles.map((profile, index) =>
      index === profileIndex ? { ...profile, ...changes } : profile
    );
    await fileSystem.writeFile('profiles.json', updatedProfiles);
    set({ profiles: updatedProfiles });
    return updatedProfiles;
  }),

  persistLoadedProfiles: async (loadedProfiles) => {
    return enqueueProfileWrite(async () => {
      await fileSystem.writeFile('profiles.json', loadedProfiles);
      set({ profiles: loadedProfiles });
      return loadedProfiles;
    });
  },
}));

export const getDynamicStateForButton = (button, dynamicStates) => {
  if (!button || !button.actions || !Array.isArray(button.actions) || !dynamicStates) return null;

  for (const act of button.actions) {
    if (!act) continue;
    const defId = act.definitionId || act.type;
    if (!defId) continue;

    // Normal/statik temel eylemleri eklenti canlı durumlarıyla eşleştirme
    const upperDefId = String(defId).toUpperCase();
    const upperType = String(act.type || '').toUpperCase();
    if (STATIC_ACTION_KEYS.has(upperDefId) || STATIC_ACTION_KEYS.has(upperType)) {
      continue;
    }

    const cleanDefId = String(defId).split('.').pop().toLowerCase();

    for (const [key, state] of Object.entries(dynamicStates)) {
      if (!state) continue;
      const [actionName, ...filterParts] = key.split('::');
      if (!actionName) continue;
      const filterPart = filterParts.join('::');

      const cleanActionName = actionName.split('.').pop().toLowerCase();
      const isActionMatch =
        actionName.toLowerCase() === defId.toLowerCase() ||
        cleanActionName === cleanDefId ||
        defId.toLowerCase() === `plugin_${actionName.toLowerCase()}` ||
        defId.toLowerCase().endsWith(`_${actionName.toLowerCase()}`);

      if (!isActionMatch) continue;

      if (!filterPart) {
        return state;
      } else {
        const filters = filterPart.split(';');
        const matchesAll = filters.every(f => {
          const colonIdx = f.indexOf(':');
          if (colonIdx === -1) return true;
          const k = f.slice(0, colonIdx);
          const v = f.slice(colonIdx + 1);

          // Eylemdeki alan değerini bul (örn: sceneName, targetScene, inputName, source)
          const actVal = act[k] ?? (k === 'sceneName' ? (act.targetScene || act.scene || act.target) : (k === 'inputName' ? (act.source || act.input) : undefined));
          if (actVal === undefined || actVal === null || String(actVal).trim() === '') {
            return false;
          }
          return String(actVal).trim().toLowerCase() === String(v).trim().toLowerCase();
        });
        if (matchesAll) {
          return state;
        }
      }
    }
  }
  return null;
};

export default useStore;
