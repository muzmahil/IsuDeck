import test from 'node:test';
import assert from 'node:assert/strict';

import {
  changeVariableInList,
  compareValues,
  executeLogicSequence,
  resolveValue,
  setVariableInList
} from '../utils/logicEngine.js';

const createContext = (initial = {}) => {
  let variables = initial.variables ? [...initial.variables] : [];
  const systemMetrics = {
    volume: 50,
    mute: false,
    cpu: 10,
    ram: 20,
    battery: 80,
    ...(initial.systemMetrics || {})
  };
  const sent = [];

  const context = {
    getVariables: () => variables,
    setVariables: (next) => {
      variables = next;
    },
    getSystemMetrics: () => systemMetrics,
    sendToEngine: (payload) => sent.push(payload),
    updateSystemMetrics: (partial) => Object.assign(systemMetrics, partial),
    loadProfiles: async () => initial.profiles || [],
    saveProfiles: async () => {},
    sleep: async () => {}
  };

  return {
    context,
    sent,
    systemMetrics,
    getVariables: () => variables
  };
};

test('resolveValue resolves literals', () => {
  assert.equal(resolveValue('5'), 5);
  assert.equal(resolveValue('hello'), 'hello');
  assert.equal(resolveValue('true'), true);
  assert.equal(resolveValue('false'), false);
  assert.equal(resolveValue(undefined), '');
  assert.equal(resolveValue(null), '');
});

test('resolveValue resolves user variables with optional $ prefix', () => {
  const context = {
    variables: [
      { name: 'vol', value: 42 },
      { name: 'Counter', value: 7 }
    ],
    systemMetrics: {}
  };

  assert.equal(resolveValue('$vol', context), 42);
  assert.equal(resolveValue('vol', context), 42);
  assert.equal(resolveValue('counter', context), 7);
  assert.equal(resolveValue('$COUNTER', context), 7);
});

test('resolveValue resolves system metrics', () => {
  const context = {
    variables: [],
    systemMetrics: { cpu: 33, mute: true }
  };

  assert.equal(resolveValue('$sys.cpu', context), 33);
  assert.equal(resolveValue('$sys.mute', context), true);
  assert.equal(resolveValue('$sys.unknown', context), '');
});

test('compareValues supports numeric and string comparison', () => {
  const context = { variables: [{ name: 'counter', value: 10 }], systemMetrics: {} };

  assert.equal(compareValues('$counter', '==', '10', context), true);
  assert.equal(compareValues('$counter', '>', '5', context), true);
  assert.equal(compareValues('$counter', '<', '5', context), false);
  assert.equal(compareValues('hello world', 'contains', 'WORLD', context), true);
  assert.equal(compareValues('a', '!=', 'b', context), true);
});

test('setVariableInList updates the existing variable and coerces types', () => {
  const variables = [{ id: 'v1', name: 'vol', type: 'number', value: 50 }];
  const updated = setVariableInList(variables, '$vol', '75');

  assert.equal(updated.length, 1);
  assert.equal(updated[0].value, 75);
  assert.equal(updated[0].name, 'vol');
});

test('setVariableInList creates a missing variable', () => {
  const updated = setVariableInList([], 'micMuted', true);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].name, 'micMuted');
  assert.equal(updated[0].type, 'boolean');
  assert.equal(updated[0].value, true);
});

test('setVariableInList ignores empty variable names', () => {
  const variables = [{ id: 'v1', name: 'vol', type: 'number', value: 50 }];
  assert.equal(setVariableInList(variables, '  ', 1), variables);
});

test('changeVariableInList clamps to min and max', () => {
  const variables = [{ id: 'v1', name: 'vol', type: 'number', value: 95, min: 0, max: 100 }];

  const up = changeVariableInList(variables, 'vol', 20, undefined, undefined);
  assert.equal(up.value, 100);

  const down = changeVariableInList(variables, 'vol', -200, 0, 100);
  assert.equal(down.value, 0);
});

test('changeVariableInList creates a missing variable from zero', () => {
  const result = changeVariableInList([], 'fresh', 5, 0, 100);

  assert.equal(result.value, 5);
  assert.equal(result.variables.length, 1);
  assert.equal(result.variables[0].name, 'fresh');
  assert.equal(result.variables[0].value, 5);
});

test('SET_VARIABLE followed by IF reads the fresh value in the same button', async () => {
  const { context, sent, getVariables } = createContext();
  const thenAction = { definitionId: 'OPEN_URL', url: 'https://example.com' };

  await executeLogicSequence([
    { definitionId: 'SET_VARIABLE', variableName: 'counter', value: '5' },
    {
      definitionId: 'IF_CONDITION',
      leftOperand: 'counter',
      operator: '==',
      rightOperand: '5',
      thenActions: [thenAction],
      elseActions: [{ definitionId: 'OPEN_URL', url: 'https://else.example.com' }]
    }
  ], context);

  assert.equal(getVariables()[0].value, 5);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], {
    type: 'EXECUTE_ACTION',
    actionData: { actions: [thenAction] }
  });
});

test('SET_VARIABLE creates a new variable that IF can use immediately', async () => {
  const { context, sent, getVariables } = createContext();
  const thenAction = { definitionId: 'OPEN_URL', url: 'https://new.example.com' };

  await executeLogicSequence([
    { definitionId: 'SET_VARIABLE', variableName: 'brandNew', value: 9 },
    {
      definitionId: 'IF_CONDITION',
      leftOperand: 'brandNew',
      operator: '==',
      rightOperand: '9',
      thenActions: [thenAction]
    }
  ], context);

  assert.equal(getVariables()[0].name, 'brandNew');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].actionData.actions[0], thenAction);
});

test('CHANGE_VARIABLE followed by IF uses the updated value', async () => {
  const { context, sent, getVariables } = createContext({
    variables: [{ id: 'v1', name: 'counter', type: 'number', value: 2 }]
  });
  const thenAction = { definitionId: 'OPEN_URL', url: 'https://changed.example.com' };

  await executeLogicSequence([
    {
      definitionId: 'CHANGE_VARIABLE',
      variableName: 'counter',
      operation: 'add',
      amount: 3,
      min: 0,
      max: 100
    },
    {
      definitionId: 'IF_CONDITION',
      leftOperand: 'counter',
      operator: '==',
      rightOperand: '5',
      thenActions: [thenAction]
    }
  ], context);

  assert.equal(getVariables()[0].value, 5);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].actionData.actions[0], thenAction);
});

test('CHANGE_VARIABLE with syncSystemVolume updates engine and metrics', async () => {
  const { context, sent, systemMetrics } = createContext({
    variables: [{ id: 'v1', name: 'vol', type: 'number', value: 40, min: 0, max: 100 }]
  });

  await executeLogicSequence([
    {
      definitionId: 'CHANGE_VARIABLE',
      variableName: 'vol',
      operation: 'add',
      amount: 20,
      syncSystemVolume: true
    }
  ], context);

  assert.equal(sent[0].type, 'SET_SYSTEM_VOLUME');
  assert.equal(sent[0].percent, 60);
  assert.equal(systemMetrics.volume, 60);
});

test('ADJUST_SYSTEM_VOLUME clamps between 0 and 100', async () => {
  const { context, sent, systemMetrics } = createContext({
    systemMetrics: { volume: 95 }
  });

  await executeLogicSequence([
    { definitionId: 'ADJUST_SYSTEM_VOLUME', delta: 20 }
  ], context);

  assert.equal(sent[0].percent, 100);
  assert.equal(systemMetrics.volume, 100);
});

test('MUTE toggles the $sys.mute metric for later IF checks', async () => {
  const { context, systemMetrics } = createContext({
    systemMetrics: { mute: false }
  });

  await executeLogicSequence([{ definitionId: 'MUTE' }], context);
  assert.equal(systemMetrics.mute, true);

  await executeLogicSequence([{ definitionId: 'MUTE' }], context);
  assert.equal(systemMetrics.mute, false);
});

test('LOOP_REPEAT executes nested actions the requested number of times', async () => {
  const { context, sent } = createContext();
  const nested = { definitionId: 'OPEN_URL', url: 'https://loop.example.com' };

  await executeLogicSequence([
    { definitionId: 'LOOP_REPEAT', count: 3, delay: 0, loopActions: [nested] }
  ], context);

  assert.equal(sent.length, 3);
  for (const payload of sent) {
    assert.deepEqual(payload.actionData.actions[0], nested);
  }
});

test('hold phase is attached to engine actions', async () => {
  const { context, sent } = createContext();

  await executeLogicSequence(
    [{ definitionId: 'OPEN_URL', url: 'https://phase.example.com' }],
    context,
    { phase: 'press' }
  );

  assert.equal(sent[0].actionData.actions[0].phase, 'press');
});
