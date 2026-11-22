import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindingHidsMatch,
  bindingMatchesMessage,
  findButtonIndexByBinding
} from '../utils/bindingMatch.js';

test('bindingHidsMatch accepts identical HID paths', () => {
  assert.equal(bindingHidsMatch('HID\\\\VID_1234', 'HID\\\\VID_1234'), true);
});

test('bindingHidsMatch accepts partial HID paths in either direction', () => {
  assert.equal(bindingHidsMatch('HID\\\\VID_1234&PID_ABCD', 'VID_1234'), true);
  assert.equal(bindingHidsMatch('VID_1234', 'HID\\\\VID_1234&PID_ABCD'), true);
});

test('bindingHidsMatch treats wildcard handlers as a match', () => {
  for (const wildcard of ['*', 'any', 'KEYBOARD_HOOK', 'keyboard_hook']) {
    assert.equal(bindingHidsMatch(wildcard, 'HID\\\\something'), true);
    assert.equal(bindingHidsMatch('HID\\\\something', wildcard), true);
  }
});

test('bindingHidsMatch treats missing values as a match', () => {
  assert.equal(bindingHidsMatch(null, 'HID\\\\x'), true);
  assert.equal(bindingHidsMatch('HID\\\\x', undefined), true);
  assert.equal(bindingHidsMatch('', ''), true);
});

test('bindingHidsMatch rejects different HID paths', () => {
  assert.equal(bindingHidsMatch('HID\\\\A', 'HID\\\\B'), false);
});

test('bindingMatchesMessage requires the same key', () => {
  const binding = { key: 'F13', hid: 'HID\\\\A' };

  assert.equal(bindingMatchesMessage(binding, { key: 'F13', hid: 'HID\\\\A' }), true);
  assert.equal(bindingMatchesMessage(binding, { key: 'F14', hid: 'HID\\\\A' }), false);
});

test('bindingMatchesMessage handles missing bindings and keys', () => {
  assert.equal(bindingMatchesMessage(null, { key: 'F13' }), false);
  assert.equal(bindingMatchesMessage({ hid: 'HID\\\\A' }, { key: 'F13' }), false);
  assert.equal(bindingMatchesMessage({ key: 'F13' }, null), false);
});

test('findButtonIndexByBinding returns the first matching button', () => {
  const buttons = [
    null,
    { binding: { key: 'F13', hid: 'HID\\\\A' } },
    { binding: { key: 'F13', hid: 'HID\\\\B' } }
  ];

  assert.equal(findButtonIndexByBinding(buttons, { key: 'F13', hid: 'HID\\\\B' }), 2);
  assert.equal(findButtonIndexByBinding(buttons, { key: 'F14', hid: 'HID\\\\A' }), null);
  assert.equal(findButtonIndexByBinding(null, { key: 'F13' }), null);
});

test('keyboard hook bindings work on every surface', () => {
  const buttons = [{ binding: { key: 'F13', hid: 'KEYBOARD_HOOK' } }];
  assert.equal(findButtonIndexByBinding(buttons, { key: 'F13', hid: 'HID\\\\A' }), 0);
});
