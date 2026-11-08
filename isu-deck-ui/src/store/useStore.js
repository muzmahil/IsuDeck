import { create } from 'zustand';
import { dictionary } from '../utils/dictionary';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fileSystem } from '../utils/fileSystem';

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
    const updated = state.variables.map(v => {
      if (v.name.toLowerCase() === name.toLowerCase()) {
        const parsedVal = v.type === 'number' ? Number(val) : (v.type === 'boolean' ? Boolean(val) : String(val));
        return { ...v, value: parsedVal };
      }
      return v;
    });
    fileSystem.writeFile('variables.json', updated).catch(() => {});
    return { variables: updated };
  }),

  changeVariableValue: (name, delta, min, max, syncSystemVolume) => set((state) => {
    let newCalculatedVal = null;
    const updated = state.variables.map(v => {
      if (v.name.toLowerCase() === name.toLowerCase()) {
        const curNum = Number(v.value || 0);
        let nextVal = curNum + delta;
        const minClamp = min !== undefined ? min : v.min;
        const maxClamp = max !== undefined ? max : v.max;
        if (minClamp !== undefined && minClamp !== null) nextVal = Math.max(minClamp, nextVal);
        if (maxClamp !== undefined && maxClamp !== null) nextVal = Math.min(maxClamp, nextVal);
        newCalculatedVal = nextVal;
        return { ...v, value: nextVal };
      }
      return v;
    });

    fileSystem.writeFile('variables.json', updated).catch(() => {});

    if (syncSystemVolume && newCalculatedVal !== null) {
      const { sendToEngine } = get();
      sendToEngine({ type: 'SET_SYSTEM_VOLUME', percent: newCalculatedVal });
    }

    return { variables: updated };
  }),

  updateSystemMetrics: (partial) => set((state) => ({
    systemMetrics: { ...state.systemMetrics, ...partial }
  })),

  executeLogicSequence: async (actions, options = {}) => {
    if (!actions || !Array.isArray(actions)) return;
    const { variables, setVariableValue, changeVariableValue, systemMetrics, sendToEngine } = get();
    const executionPhase = options?.phase;

    const buildEngineAction = (act) => executionPhase ? { ...act, phase: executionPhase } : act;

    const evaluateValue = (valStr) => {
      if (valStr === undefined || valStr === null) return '';
      const trimmed = String(valStr).trim();
      if (trimmed.startsWith('$sys.')) {
        const metricKey = trimmed.slice(5);
        return systemMetrics[metricKey] !== undefined ? systemMetrics[metricKey] : '';
      }
      const cleanVar = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed;
      const matchingVar = variables.find(v => v.name.toLowerCase() === cleanVar.toLowerCase() || v.name.toLowerCase() === trimmed.toLowerCase());
      if (matchingVar) {
        return matchingVar.value;
      }
      if (!isNaN(trimmed) && trimmed !== '') {
        return Number(trimmed);
      }
      if (trimmed.toLowerCase() === 'true') return true;
      if (trimmed.toLowerCase() === 'false') return false;
      return trimmed;
    };

    const evaluateCondition = (left, op, right) => {
      const lVal = evaluateValue(left);
      const rVal = evaluateValue(right);
      const lNum = Number(lVal);
      const rNum = Number(rVal);
      const bothNumbers = !isNaN(lNum) && !isNaN(rNum) && lVal !== '' && rVal !== '';

      switch (op) {
        case '==':
        case '=':
          return String(lVal).toLowerCase() === String(rVal).toLowerCase();
        case '!=':
          return String(lVal).toLowerCase() !== String(rVal).toLowerCase();
        case '>':
          return bothNumbers ? lNum > rNum : String(lVal) > String(rVal);
        case '<':
          return bothNumbers ? lNum < rNum : String(lVal) < String(rVal);
        case '>=':
          return bothNumbers ? lNum >= rNum : String(lVal) >= String(rVal);
        case '<=':
          return bothNumbers ? lNum <= rNum : String(lVal) <= String(rVal);
        case 'contains':
          return String(lVal).toLowerCase().includes(String(rVal).toLowerCase());
        default:
          return Boolean(lVal);
      }
    };

    const executeActionList = async (list) => {
      if (!list || !Array.isArray(list)) return;
      for (const act of list) {
        if (!act) continue;
        const type = act.definitionId || act.type;
        const normalizedType = String(type || '').toUpperCase();

        if (type === 'SET_VARIABLE') {
          const varName = act.variableName || act.varName;
          if (varName) {
            const val = evaluateValue(act.value);
            setVariableValue(varName, val);
          }
        } else if (type === 'CHANGE_VARIABLE') {
          const varName = act.variableName || act.varName;
          const op = act.operation || 'subtract';
          let amount = Number(act.amount !== undefined && act.amount !== '' ? act.amount : 10);
          if (op === 'subtract') amount = -amount;
          const min = act.min !== undefined && act.min !== '' ? Number(act.min) : undefined;
          const max = act.max !== undefined && act.max !== '' ? Number(act.max) : undefined;
          const syncVolume = !!act.syncSystemVolume;
          if (varName) {
            changeVariableValue(varName, amount, min, max, syncVolume);
          }
        } else if (type === 'SET_SYSTEM_VOLUME') {
          const percent = Number(evaluateValue(act.percent ?? 50));
          sendToEngine({ type: 'SET_SYSTEM_VOLUME', percent });
        } else if (type === 'ADJUST_SYSTEM_VOLUME') {
          const delta = Number(act.delta || -10);
          const matchingVol = variables.find(v => v.name.toLowerCase() === 'vol');
          if (matchingVol) {
            changeVariableValue('vol', delta, 0, 100, true);
          } else {
            sendToEngine({ type: 'EXECUTE_ACTION', actionData: { actions: [buildEngineAction(act)] } });
          }
        } else if (type === 'IF_CONDITION') {
          const isMet = evaluateCondition(act.leftOperand, act.operator || '==', act.rightOperand);
          if (isMet) {
            if (act.thenActions && Array.isArray(act.thenActions) && act.thenActions.length > 0) {
              await executeActionList(act.thenActions);
            } else if (act.thenActionType) {
              await executeActionList([{ type: act.thenActionType, definitionId: act.thenActionType, key: act.thenArg, command: act.thenArg, path: act.thenArg, url: act.thenArg, text: act.thenArg }]);
            }
          } else {
            if (act.elseActions && Array.isArray(act.elseActions) && act.elseActions.length > 0) {
              await executeActionList(act.elseActions);
            } else if (act.elseActionType) {
              await executeActionList([{ type: act.elseActionType, definitionId: act.elseActionType, key: act.elseArg, command: act.elseArg, path: act.elseArg, url: act.elseArg, text: act.elseArg }]);
            }
          }
        } else if (type === 'LOOP_REPEAT') {
          const count = Math.min(Math.max(Number(evaluateValue(act.count) || 1), 1), 100);
          const delayMs = Math.max(Number(act.delay || 50), 0);
          for (let i = 0; i < count; i++) {
            if (act.loopActions && Array.isArray(act.loopActions) && act.loopActions.length > 0) {
              await executeActionList(act.loopActions);
            } else if (act.nestedActionType) {
              await executeActionList([{ type: act.nestedActionType, definitionId: act.nestedActionType, key: act.nestedArg, command: act.nestedArg, path: act.nestedArg, url: act.nestedArg, text: act.nestedArg }]);
            }
            if (delayMs > 0 && i < count - 1) {
              await new Promise(r => setTimeout(r, delayMs));
            }
          }
        } else if (type === 'DELAY') {
          const duration = Number(act.duration || 100);
          if (duration > 0) {
            await new Promise(r => setTimeout(r, duration));
          }
        } else if (normalizedType === 'CHANGE_PROFILE' || normalizedType === 'SWITCH_PROFILE') {
          const targetProfileId = act.profileId ?? act.targetProfileId;
          if (targetProfileId === undefined || targetProfileId === null || targetProfileId === '') {
            console.error('Profile change action is missing its target profile ID.');
            continue;
          }

          const currentProfiles = await get().loadProfiles();
          const targetIndex = currentProfiles.findIndex(
            profile => String(profile.id) === String(targetProfileId)
          );
          if (targetIndex === -1) {
            console.error(`Profile change action target not found: ${targetProfileId}`);
            continue;
          }

          const updatedProfiles = currentProfiles.map((profile, index) => ({
            ...profile,
            isActive: index === targetIndex
          }));
          await get().saveProfiles(updatedProfiles);
          const activeProfile = updatedProfiles[targetIndex];
          const blocks = (activeProfile.buttons || [])
            .filter(button => button?.binding?.hid && button?.binding?.key)
            .map(button => ({
              hid: button.binding.hid,
              key: button.binding.key
            }));
          sendToEngine({ type: 'init_block_list', blocks });
        } else {
          // Standard system / plugin action
          sendToEngine({ type: 'EXECUTE_ACTION', actionData: { actions: [buildEngineAction(act)] } });
        }
      }
    };

    await executeActionList(actions);
  },

  executeHoldRelease: async (actions) => {
    if (!actions || !Array.isArray(actions)) return;
    const { sendToEngine } = get();

    for (const act of actions) {
      if (!act) continue;
      if (!isHoldReleaseAction(act)) continue;

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
    console.log("[Store] Dinleyiciler başlatılıyor...");
    
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

      console.log("🔥 [STORE] ACTION DATA GELDİ:", data);

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
      console.log("[Store] Dinleyiciler kapatılıyor...");
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

const STATIC_ACTION_KEYS = new Set([
  'OPEN_APP', 'OPEN_URL', 'HOTKEY', 'PLAY_SOUND',
  'MEDIA_BUTTON', 'VOLUME_UP', 'VOLUME_DOWN', 'MUTE', 'VOLUME_MUTE',
  'MEDIA_PLAY', 'MEDIA_PLAY_PAUSE', 'MEDIA_STOP', 'MEDIA_NEXT', 'MEDIA_PREV', 'MEDIA_PREVIOUS',
  'DELAY', 'CHANGE_PROFILE', 'SWITCH_PROFILE',
  'SCREENSHOT', 'CLIPBOARD_HISTORY', 'SHOW_DESKTOP', 'TOGGLE_DESKTOP',
  'TASK_MANAGER', 'OPEN_TASK_MANAGER', 'CLOSE_WINDOW', 'LOCK_SCREEN', 'SYSTEM_LOCK',
  'TYPE_TEXT', 'TEXT_MACRO', 'RUN_COMMAND', 'OPEN_FOLDER',
  'VIRTUAL_DESKTOP_LEFT', 'VIRTUAL_DESKTOP_RIGHT',
  'BRIGHTNESS_UP', 'BRIGHTNESS_DOWN', 'TIMER_START', 'EMPTY_RECYCLE_BIN', 'SYSTEM_SLEEP', 'SWITCH_AUDIO_OUTPUT'
]);

const HOLD_RELEASE_CORE_ACTIONS = new Set(['MUTE', 'VOLUME_MUTE', 'SET_SYSTEM_MUTE']);

// Hold mode executes the full action sequence once on press. On release only
// actions that can undo their press effect are forwarded to the engine.
export const isHoldReleaseAction = (act) => {
  if (!act) return false;

  const defId = String(act.definitionId || act.type || '').toUpperCase();
  const rawType = String(act.type || '').toUpperCase();

  if (HOLD_RELEASE_CORE_ACTIONS.has(defId) || HOLD_RELEASE_CORE_ACTIONS.has(rawType)) {
    return true;
  }

  if (
    (rawType === 'MEDIA_BUTTON' || defId === 'MEDIA_BUTTON') &&
    String(act.button || '').toLowerCase() === 'mute'
  ) {
    return true;
  }

  // Every action that is not a built-in system action is a plugin action.
  return !STATIC_ACTION_KEYS.has(defId) && !STATIC_ACTION_KEYS.has(rawType);
};

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
