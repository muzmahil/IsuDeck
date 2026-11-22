// Hold-mode release helpers.
//
// Hold mode runs the full action list on press. On release only actions that
// can undo their press effect are forwarded to the engine. Nested logic blocks
// must be traversed too, otherwise an action inside an IF/LOOP never receives
// its release event.

export const STATIC_ACTION_KEYS = new Set([
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

const NESTED_ACTION_KEYS = ['thenActions', 'elseActions', 'loopActions'];

/**
 * Whether an action should be forwarded on hold release.
 *
 * Core actions that can undo a press are always forwarded. Plugin actions must
 * explicitly opt in (holdRelease/supportsRelease) because there is no way to
 * know whether a plugin handles the `phase` field. Forwarding every plugin
 * action caused some plugins to run twice.
 */
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

  const isPluginAction =
    !STATIC_ACTION_KEYS.has(defId) && !STATIC_ACTION_KEYS.has(rawType);

  if (!isPluginAction) return false;

  return (
    act.holdRelease === true ||
    act.supportsRelease === true ||
    act.release === true
  );
};

/**
 * Recursively collect release actions, including actions nested inside
 * IF_CONDITION and LOOP_REPEAT blocks.
 */
export const collectHoldReleaseActions = (actions, collected = [], seen = new Set()) => {
  if (!Array.isArray(actions)) return collected;

  for (const act of actions) {
    if (!act) continue;
    if (act.id && seen.has(act.id)) continue;
    if (act.id) seen.add(act.id);

    if (isHoldReleaseAction(act)) {
      collected.push(act);
    }

    for (const key of NESTED_ACTION_KEYS) {
      if (Array.isArray(act[key]) && act[key].length > 0) {
        collectHoldReleaseActions(act[key], collected, seen);
      }
    }
  }

  return collected;
};
