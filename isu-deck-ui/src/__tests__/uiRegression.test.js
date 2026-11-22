import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => fs.readFileSync(path.resolve(here, '..', relativePath), 'utf8');

test('action list no longer uses backdrop blur on the full-screen overlay', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('backdrop-blur-sm'), false);
});

test('action list scroller has no transition-all', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(
    /space-y-3 overflow-y-auto pr-2 flex-1 min-h-0 rounded-xl transition-all/.test(source),
    false
  );
  assert.equal(source.includes('action-card'), true);
});

test('editor does not hardcode blue accent classes anymore', () => {
  const source = read('components/ActionEditor.jsx');
  const forbidden = ['bg-blue-600', 'text-blue-400', 'border-blue-400', 'border-blue-500'];
  for (const className of forbidden) {
    assert.equal(
      source.includes(className),
      false,
      `ActionEditor still contains ${className}`
    );
  }
});

test('binding tab keeps its primary actions visible with a sticky footer', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('sticky bottom-0'), true);
});

test('action cards avoid content-visibility scroll anchoring traps', () => {
  const css = read('globals.css');
  assert.equal(css.includes('.action-card'), true);
  assert.equal(css.includes('content-visibility: auto'), false);
  assert.equal(css.includes('contain: layout style'), true);
  assert.equal(css.includes('overflow-anchor: none'), true);
});

test('action list is not styled with custom scrollbars', () => {
  const css = read('globals.css');
  assert.equal(css.includes('::-webkit-scrollbar'), false);
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('action-list'), true);
});

test('editor does not subscribe to unused system metrics', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('state.systemMetrics'), false);
});

test('ambient glow is skipped while the editor is open', () => {
  const source = read('page.jsx');
  assert.equal(source.includes('deckBacklight !== false && !isEditorOpen'), true);
});

test('release notes are rendered as markdown instead of plain text', () => {
  const source = read('components/UpdatePrompt.jsx');
  assert.equal(source.includes("from '../utils/markdown'"), true);
  assert.equal(source.includes('renderMarkdown('), true);
  assert.equal(source.includes('dangerouslySetInnerHTML'), true);
  assert.equal(source.includes('<pre'), false);
  // Links inside release notes must leave the webview via the OS browser.
  assert.equal(source.includes("closest?.('a[href]')"), true);
  assert.equal(source.includes('openExternalUrl('), true);
});

test('markdown rendering goes through the sanitizer', () => {
  const source = read('utils/markdown.js');
  assert.equal(source.includes("from 'marked'"), true);
  assert.equal(source.includes('export const renderMarkdown'), true);
  assert.equal(source.includes('export const sanitizeHtml'), true);
  assert.equal(source.includes("'SCRIPT'"), true);
  assert.equal(/renderMarkdown[\s\S]*sanitizeHtml\(marked\.parse/.test(source), true);
});

test('plugin readme and release notes share one markdown pipeline', () => {
  const source = read('pages/plugins/page.jsx');
  assert.equal(source.includes("from '../../utils/markdown'"), true);
  assert.equal(source.includes('const sanitizeHtml ='), false);
  assert.equal(source.includes("from 'marked'"), false);
});

test('light theme remaps the missing editor surfaces', () => {
  const css = read('globals.css');
  for (const surface of ['#101012', '#161619', '#1c1c20', '#18181c']) {
    assert.equal(css.includes(surface), true, `globals.css is missing ${surface}`);
  }
});

test('editor no longer ships debug console noise', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('console.log'), false);
});

test('nested slot moves handle the same-parent case', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('const sameParent ='), true);
});

test('logic cards use the same surface as regular action cards', () => {
  const source = read('components/ActionEditor.jsx');
  for (const shade of ['bg-[#161619]', 'bg-[#1c1c20]']) {
    assert.equal(source.includes(shade), false, `logic cards still use ${shade}`);
  }
  assert.equal(source.includes('bg-[#1e1e1e]'), true);
});

test('plugin modals are shared by the list and detail views', () => {
  const source = read('pages/plugins/page.jsx');
  assert.equal(source.includes('const overlays = ('), true);
  const rendered = source.split('{overlays}').length - 1;
  assert.equal(rendered >= 2, true, 'overlays must render in both list and detail views');
});

test('tauri window disables the native drag handler so HTML5 drag and drop works', () => {
  const config = JSON.parse(read('../src-tauri/tauri.conf.json'));
  const windows = config.app?.windows ?? [];
  assert.equal(windows.length > 0, true);
  for (const win of windows) {
    assert.equal(win.dragDropEnabled, false);
  }
});

test('dropped actions fall back to the in-memory drag state', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('draggingAction || null'), true);
});

test('binding tab uses the large keycap layout with collapsible technical details', () => {
  const source = read('components/ActionEditor.jsx');
  assert.equal(source.includes('rounded-[2rem]'), true);
  assert.equal(source.includes('border-b-[7px]'), true);
  assert.equal(source.includes('showBindingDetails'), true);
  assert.equal(source.includes("t('editor.binding.details', language)"), true);
});

test('binding translations expose the technical details label', () => {
  for (const locale of ['tr', 'en']) {
    const messages = JSON.parse(read(`../locales/${locale}.json`));
    assert.equal(typeof messages.editor.binding.details, 'string');
    assert.equal(messages.editor.binding.details.length > 0, true);
  }
});
