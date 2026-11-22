import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectHoldReleaseActions,
  isHoldReleaseAction
} from '../utils/holdRelease.js';

test('core mute actions are released', () => {
  assert.equal(isHoldReleaseAction({ definitionId: 'MUTE' }), true);
  assert.equal(isHoldReleaseAction({ type: 'VOLUME_MUTE' }), true);
  assert.equal(isHoldReleaseAction({ definitionId: 'SET_SYSTEM_MUTE' }), true);
  assert.equal(
    isHoldReleaseAction({ definitionId: 'MEDIA_BUTTON', button: 'mute' }),
    true
  );
});

test('non-reversible core actions are not released', () => {
  assert.equal(isHoldReleaseAction({ definitionId: 'OPEN_URL' }), false);
  assert.equal(isHoldReleaseAction({ definitionId: 'DELAY' }), false);
});

test('plugin actions must opt in before receiving a release', () => {
  const plugin = { definitionId: 'PLUGIN_OBS_MUTE' };

  assert.equal(isHoldReleaseAction(plugin), false);
  assert.equal(isHoldReleaseAction({ ...plugin, holdRelease: true }), true);
  assert.equal(isHoldReleaseAction({ ...plugin, supportsRelease: true }), true);
  assert.equal(isHoldReleaseAction({ ...plugin, release: true }), true);
});

test('collectHoldReleaseActions finds nested actions inside IF and LOOP', () => {
  const nestedMute = { id: 'mute-2', definitionId: 'MUTE' };
  const nestedLoopMute = { id: 'mute-3', definitionId: 'MUTE' };

  const actions = [
    { id: 'if-1', definitionId: 'IF_CONDITION', thenActions: [nestedMute] },
    {
      id: 'loop-1',
      definitionId: 'LOOP_REPEAT',
      loopActions: [nestedLoopMute]
    },
    { id: 'url-1', definitionId: 'OPEN_URL' }
  ];

  const collected = collectHoldReleaseActions(actions);
  assert.deepEqual(
    collected.map((action) => action.id),
    ['mute-2', 'mute-3']
  );
});

test('collectHoldReleaseActions does not recurse forever on cycles', () => {
  const cyclic = { id: 'loop', definitionId: 'LOOP_REPEAT', loopActions: [] };
  cyclic.loopActions.push(cyclic);

  assert.doesNotThrow(() => collectHoldReleaseActions([cyclic]));
  assert.equal(collectHoldReleaseActions([cyclic]).length, 0);
});
