// Pure logic/variable engine used by the deck.
//
// Keeping this code free of Tauri/store imports makes it testable with plain
// Node and ensures the editor, deck and background listener all evaluate
// variables the same way.
//
// Two important behaviours live here:
//   1. Variable values are read fresh from the context on every evaluation.
//      Previously the whole list was captured once, so a SET_VARIABLE followed
//      by an IF in the same button compared against the old value.
//   2. SET_VARIABLE can create new variables. Previously it silently did
//      nothing when the name did not already exist.

const TRUE_STRINGS = new Set(['true', '1', 'yes', 'on']);
const FALSE_STRINGS = new Set(['false', '0', 'no', 'off']);

const NESTED_ACTION_KEYS = ['thenActions', 'elseActions', 'loopActions'];

export const normalizeVariableName = (name) =>
  String(name ?? '').trim().replace(/^\$/, '');

const coerceValue = (type, raw) => {
  if (type === 'number') {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    const text = String(raw ?? '').trim().toLowerCase();
    if (TRUE_STRINGS.has(text)) return true;
    if (FALSE_STRINGS.has(text)) return false;
    return Boolean(raw);
  }

  if (type === 'string') return String(raw ?? '');
  return raw;
};

const inferType = (value) => {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
};

const makeVariableId = () =>
  `var_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Resolve a raw operand to a concrete value.
 * Supports literals, `$name` / `name` variables and `$sys.metric` metrics.
 */
export const resolveValue = (rawValue, context = {}) => {
  const variables = Array.isArray(context.variables) ? context.variables : [];
  const systemMetrics = context.systemMetrics || {};

  if (rawValue === undefined || rawValue === null) return '';

  const trimmed = String(rawValue).trim();

  if (trimmed.startsWith('$sys.')) {
    const metricKey = trimmed.slice(5);
    return Object.prototype.hasOwnProperty.call(systemMetrics, metricKey)
      ? systemMetrics[metricKey]
      : '';
  }

  const cleanName = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed;
  const reducedName = cleanName.toLowerCase();
  const rawName = trimmed.toLowerCase();

  const matchingVariable = variables.find((variable) => {
    if (!variable || variable.name === undefined || variable.name === null) return false;
    const name = String(variable.name).toLowerCase();
    return name === reducedName || name === rawName;
  });

  if (matchingVariable) return matchingVariable.value;

  if (trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed);

  const lower = trimmed.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;

  return trimmed;
};

/** Compare two operands with the requested operator. */
export const compareValues = (left, operator, right, context = {}) => {
  const leftValue = resolveValue(left, context);
  const rightValue = resolveValue(right, context);
  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const bothNumbers =
    leftValue !== '' &&
    rightValue !== '' &&
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber);

  switch (operator) {
    case '==':
    case '=':
      return String(leftValue).toLowerCase() === String(rightValue).toLowerCase();
    case '!=':
      return String(leftValue).toLowerCase() !== String(rightValue).toLowerCase();
    case '>':
      return bothNumbers ? leftNumber > rightNumber : String(leftValue) > String(rightValue);
    case '<':
      return bothNumbers ? leftNumber < rightNumber : String(leftValue) < String(rightValue);
    case '>=':
      return bothNumbers ? leftNumber >= rightNumber : String(leftValue) >= String(rightValue);
    case '<=':
      return bothNumbers ? leftNumber <= rightNumber : String(leftValue) <= String(rightValue);
    case 'contains':
      return String(leftValue).toLowerCase().includes(String(rightValue).toLowerCase());
    default:
      return Boolean(leftValue);
  }
};

/**
 * Return a new variable list with `name` set to `value`.
 * Creates the variable when it does not exist yet.
 */
export const setVariableInList = (variables, name, value) => {
  const list = Array.isArray(variables) ? variables : [];
  const cleanName = normalizeVariableName(name);
  if (!cleanName) return list;

  const index = list.findIndex(
    (variable) =>
      variable &&
      variable.name !== undefined &&
      variable.name !== null &&
      String(variable.name).toLowerCase() === cleanName.toLowerCase()
  );

  if (index === -1) {
    return [
      ...list,
      {
        id: makeVariableId(),
        name: cleanName,
        type: inferType(value),
        value,
        defaultValue: value
      }
    ];
  }

  return list.map((variable, currentIndex) =>
    currentIndex === index
      ? { ...variable, value: coerceValue(variable.type, value) }
      : variable
  );
};

/**
 * Return a new variable list with `name` adjusted by `delta`.
 * Creates the variable (starting from 0) when it does not exist yet.
 */
export const changeVariableInList = (variables, name, delta, min, max) => {
  const list = Array.isArray(variables) ? variables : [];
  const cleanName = normalizeVariableName(name);

  if (!cleanName) {
    return { variables: list, value: null };
  }

  const index = list.findIndex(
    (variable) =>
      variable &&
      variable.name !== undefined &&
      variable.name !== null &&
      String(variable.name).toLowerCase() === cleanName.toLowerCase()
  );

  const current = index === -1 ? 0 : Number(list[index].value || 0);
  const amount = Number(delta);
  let nextValue = Number.isFinite(amount) ? current + amount : current;

  const explicitMin = min === undefined || min === null || min === '' ? undefined : Number(min);
  const explicitMax = max === undefined || max === null || max === '' ? undefined : Number(max);
  const variableMin = index === -1 ? undefined : list[index].min;
  const variableMax = index === -1 ? undefined : list[index].max;

  const minClamp = Number.isFinite(explicitMin) ? explicitMin : variableMin;
  const maxClamp = Number.isFinite(explicitMax) ? explicitMax : variableMax;

  if (minClamp !== undefined && minClamp !== null && Number.isFinite(Number(minClamp))) {
    nextValue = Math.max(Number(minClamp), nextValue);
  }
  if (maxClamp !== undefined && maxClamp !== null && Number.isFinite(Number(maxClamp))) {
    nextValue = Math.min(Number(maxClamp), nextValue);
  }
  if (!Number.isFinite(nextValue)) {
    nextValue = current;
  }

  if (index === -1) {
    return {
      variables: [
        ...list,
        {
          id: makeVariableId(),
          name: cleanName,
          type: 'number',
          value: nextValue,
          defaultValue: 0,
          ...(Number.isFinite(explicitMin) ? { min: explicitMin } : {}),
          ...(Number.isFinite(explicitMax) ? { max: explicitMax } : {})
        }
      ],
      value: nextValue
    };
  }

  const updated = list.map((variable, currentIndex) =>
    currentIndex === index ? { ...variable, value: nextValue } : variable
  );

  return { variables: updated, value: nextValue };
};

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute an action list, including IF/LOOP control flow.
 *
 * `context` supplies accessors so the engine never captures stale state:
 *   getVariables(), setVariables(), getSystemMetrics(), sendToEngine(),
 *   loadProfiles(), saveProfiles(), updateSystemMetrics(), sleep()
 */
export async function executeLogicSequence(actions, context = {}, options = {}) {
  if (!Array.isArray(actions)) return;

  const {
    getVariables = () => [],
    setVariables = () => {},
    getSystemMetrics = () => ({}),
    sendToEngine = () => {},
    loadProfiles = async () => [],
    saveProfiles = async () => {},
    updateSystemMetrics = () => {},
    sleep = defaultSleep
  } = context;

  const executionPhase = options.phase;
  const buildEngineAction = (action) =>
    executionPhase ? { ...action, phase: executionPhase } : action;

  const currentContext = () => ({
    variables: getVariables(),
    systemMetrics: getSystemMetrics()
  });

  const evaluateValue = (value) => resolveValue(value, currentContext());
  const evaluateCondition = (left, operator, right) =>
    compareValues(left, operator, right, currentContext());

  const executeActionList = async (list) => {
    if (!Array.isArray(list)) return;

    for (const act of list) {
      if (!act) continue;

      const type = act.definitionId || act.type;
      const normalizedType = String(type || '').toUpperCase();

      if (type === 'SET_VARIABLE') {
        const variableName = act.variableName || act.varName;
        if (variableName) {
          const value = evaluateValue(act.value);
          setVariables(setVariableInList(getVariables(), variableName, value));
        }
      } else if (type === 'CHANGE_VARIABLE') {
        const variableName = act.variableName || act.varName;
        const operation = act.operation || 'subtract';
        let amount = Number(act.amount !== undefined && act.amount !== '' ? act.amount : 10);
        if (!Number.isFinite(amount)) amount = 10;
        if (operation === 'subtract') amount = -Math.abs(amount);

        const min = act.min !== undefined && act.min !== '' ? Number(act.min) : undefined;
        const max = act.max !== undefined && act.max !== '' ? Number(act.max) : undefined;

        if (variableName) {
          const result = changeVariableInList(
            getVariables(),
            variableName,
            amount,
            min,
            max
          );
          setVariables(result.variables);

          if (act.syncSystemVolume && result.value !== null) {
            sendToEngine({ type: 'SET_SYSTEM_VOLUME', percent: result.value });
            updateSystemMetrics({ volume: result.value });
          }
        }
      } else if (type === 'SET_SYSTEM_VOLUME') {
        const percent = Number(evaluateValue(act.percent ?? 50));
        sendToEngine({ type: 'SET_SYSTEM_VOLUME', percent });
        updateSystemMetrics({ volume: percent });
      } else if (type === 'ADJUST_SYSTEM_VOLUME') {
        const delta = Number(act.delta || -10);
        const metrics = getSystemMetrics();
        const baseVolume = Number(
          metrics.volume !== undefined
            ? metrics.volume
            : resolveValue('$vol', currentContext())
        );
        const nextVolume = Math.max(
          0,
          Math.min(100, (Number.isFinite(baseVolume) ? baseVolume : 0) + delta)
        );
        sendToEngine({ type: 'SET_SYSTEM_VOLUME', percent: nextVolume });
        updateSystemMetrics({ volume: nextVolume });
      } else if (
        type === 'SET_SYSTEM_MUTE' ||
        type === 'MUTE' ||
        type === 'VOLUME_MUTE' ||
        (type === 'MEDIA_BUTTON' &&
          String(act.button || '').toLowerCase() === 'mute')
      ) {
        const metrics = getSystemMetrics();
        const explicit =
          act.muted !== undefined ? act.muted : act.mute !== undefined ? act.mute : act.value;
        const nextMuted =
          explicit !== undefined && explicit !== null && explicit !== ''
            ? typeof explicit === 'string'
              ? explicit.toLowerCase() === 'true'
              : Boolean(explicit)
            : !metrics.mute;

        updateSystemMetrics({ mute: nextMuted });
        sendToEngine({
          type: 'EXECUTE_ACTION',
          actionData: { actions: [buildEngineAction(act)] }
        });
      } else if (type === 'IF_CONDITION') {
        const isMet = evaluateCondition(
          act.leftOperand,
          act.operator || '==',
          act.rightOperand
        );

        if (isMet) {
          if (Array.isArray(act.thenActions) && act.thenActions.length > 0) {
            await executeActionList(act.thenActions);
          } else if (act.thenActionType) {
            await executeActionList([
              {
                type: act.thenActionType,
                definitionId: act.thenActionType,
                key: act.thenArg,
                command: act.thenArg,
                path: act.thenArg,
                url: act.thenArg,
                text: act.thenArg
              }
            ]);
          }
        } else if (Array.isArray(act.elseActions) && act.elseActions.length > 0) {
          await executeActionList(act.elseActions);
        } else if (act.elseActionType) {
          await executeActionList([
            {
              type: act.elseActionType,
              definitionId: act.elseActionType,
              key: act.elseArg,
              command: act.elseArg,
              path: act.elseArg,
              url: act.elseArg,
              text: act.elseArg
            }
          ]);
        }
      } else if (type === 'LOOP_REPEAT') {
        const count = Math.min(Math.max(Number(evaluateValue(act.count) || 1), 1), 100);
        const delayMs = Math.max(Number(act.delay || 50), 0);

        for (let index = 0; index < count; index += 1) {
          if (Array.isArray(act.loopActions) && act.loopActions.length > 0) {
            await executeActionList(act.loopActions);
          } else if (act.nestedActionType) {
            await executeActionList([
              {
                type: act.nestedActionType,
                definitionId: act.nestedActionType,
                key: act.nestedArg,
                command: act.nestedArg,
                path: act.nestedArg,
                url: act.nestedArg,
                text: act.nestedArg
              }
            ]);
          }

          if (delayMs > 0 && index < count - 1) {
            await sleep(delayMs);
          }
        }
      } else if (type === 'DELAY') {
        const duration = Number(act.duration || 100);
        if (duration > 0) {
          await sleep(duration);
        }
      } else if (normalizedType === 'CHANGE_PROFILE' || normalizedType === 'SWITCH_PROFILE') {
        const targetProfileId = act.profileId ?? act.targetProfileId;

        if (targetProfileId === undefined || targetProfileId === null || targetProfileId === '') {
          continue;
        }

        const currentProfiles = await loadProfiles();
        const targetIndex = currentProfiles.findIndex(
          (profile) => String(profile.id) === String(targetProfileId)
        );
        if (targetIndex === -1) continue;

        const updatedProfiles = currentProfiles.map((profile, index) => ({
          ...profile,
          isActive: index === targetIndex
        }));
        await saveProfiles(updatedProfiles);

        const activeProfile = updatedProfiles[targetIndex];
        const blocks = (activeProfile.buttons || [])
          .filter((button) => button?.binding?.hid && button?.binding?.key)
          .map((button) => ({
            hid: button.binding.hid,
            key: button.binding.key
          }));

        sendToEngine({ type: 'init_block_list', blocks });
      } else {
        sendToEngine({
          type: 'EXECUTE_ACTION',
          actionData: { actions: [buildEngineAction(act)] }
        });
      }
    }
  };

  await executeActionList(actions);
}

export const LOGIC_NESTED_ACTION_KEYS = NESTED_ACTION_KEYS;
