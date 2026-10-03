'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { LUCIDE_ICONS, LUCIDE_ICONS_LIST, LUCIDE_ICON_CATEGORIES, getLucideCategories, LUCIDE_ATTRIBUTION } from '../utils/lucideIcons';

// HTML Temizleme Fonksiyonu (Güvenlik için)
const sanitizeHtml = (html) => {
  if (!html) return '';
  if (typeof window === 'undefined') return ''; // Next.js SSR Koruması
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Sadece güvenli metin etiketleri
  const allowedTags = ['P', 'I', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'B', 'STRONG', 'EM', 'U', 'BR', 'DIV', 'HR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE'];

  const clean = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) { // Element
        const tagName = child.tagName;

        if (!allowedTags.includes(tagName)) {
          // Potansiyel tehlikeli etiketleri tamamen sil
          if (['SCRIPT', 'STYLE', 'IMG', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'AUDIO', 'VIDEO', 'CANVAS', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'HEAD', 'BODY', 'HTML'].includes(tagName)) {
            child.remove();
          } else {
            // Diğerlerinin sadece etiketini soy, içeriğini bırak
            clean(child);
            while (child.firstChild) {
              node.insertBefore(child.firstChild, child);
            }
            child.remove();
          }
        } else {
          // İzin verilen etiketlerde attribute temizliği
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            const name = attr.name.toLowerCase();
            // Sadece 'class' attribute'una izin ver (Stil için)
            // 'style' attribute'u CSS injection riski taşıdığı için engellendi
            if (name !== 'class') {
              child.removeAttribute(name);
            }
          }
          clean(child);
        }
      }
    }
  };

  clean(doc.body);
  return doc.body.innerHTML;
};

// Flat Monochrome SVG İkonlar
const STATIC_ACTION_TYPES = {
  OPEN_APP: {
    id: 'OPEN_APP',
    label: 'action_types.OPEN_APP.label',
    category: 'action_types.categories.apps',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>,
    default: { path: '', args: '' },
    fields: [
      { key: 'path', type: 'file', label: 'action_types.OPEN_APP.path', placeholder: 'C:\\Program Files\\...', filters: [{ name: 'Applications', extensions: ['exe', 'lnk', 'bat', 'cmd', 'sh', 'app'] }], required: true },
      { key: 'args', type: 'text', label: 'action_types.OPEN_APP.args', placeholder: 'action_types.OPEN_APP.args_placeholder' },
      { warningKey: 'action_types.OPEN_APP.warning' }
    ]
  },
  OPEN_URL: {
    id: 'OPEN_URL',
    label: 'action_types.OPEN_URL.label',
    category: 'action_types.categories.internet',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
    default: { url: 'https://' },
    fields: [
      { key: 'url', type: 'text', label: 'action_types.OPEN_URL.url', placeholder: 'https://example.com', required: true }
    ]
  },
  HOTKEY: {
    id: 'HOTKEY',
    label: 'action_types.HOTKEY.label',
    category: 'action_types.categories.input',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M6 12h.001"/><path d="M10 12h.001"/><path d="M14 12h.001"/><path d="M18 12h.001"/><path d="M7 16h10"/></svg>,
    default: { key: '' },
    fields: [
      { key: 'key', type: 'text', label: 'action_types.HOTKEY.key', placeholder: 'CTRL+SHIFT+A', required: true }
    ]
  },
  PLAY_SOUND: {
    id: 'PLAY_SOUND',
    label: 'action_types.PLAY_SOUND.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
    default: { key: '' },
    fields: [
      { key: 'path', type: 'file', label: 'action_types.PLAY_SOUND.path', placeholder: 'C:\\Sounds\\click.wav', filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac'] }], required: true },
      { key: 'volume', type: 'number', label: 'action_types.PLAY_SOUND.volume', placeholder: '0-100', width: 'w-24' }
    ]
  },
  VOLUME_UP: {
    id: 'MEDIA_BUTTON',
    label: 'action_types.VOLUME_UP.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
    default: { button: 'volumeup' },
    fields: [
      { key: 'multiplier', type: 'number', label: 'action_types.VOLUME_UP.multiplier', placeholder: 'Number', width: 'w-24' }
    ]
  },
  VOLUME_DOWN: {
    id: 'MEDIA_BUTTON',
    label: 'action_types.VOLUME_DOWN.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
    default: { button: 'volumedown' },
    fields: [
      { key: 'multiplier', type: 'number', label: 'action_types.VOLUME_DOWN.multiplier', placeholder: 'Number', width: 'w-24' }
    ]
  },
  MUTE: {
    id: 'MEDIA_BUTTON',
    label: 'action_types.MUTE.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>,
    default: { button: 'mute' }
  },
  MEDIA_PLAY: {
    id: 'MEDIA_BUTTON',
    label: 'action_types.MEDIA_PLAY.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>,
    default: { button: 'playpause' }
  },
  MEDIA_STOP: {
    id: 'MEDIA_BUTTON',
    label: 'action_types.MEDIA_STOP.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/></svg>,
    default: { button: 'stop' }
  },
  MEDIA_NEXT: {
    id: 'MEDIA_BUTTON',
    label: 'action_types.MEDIA_NEXT.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>,
    default: { button: 'next' }
  },
  MEDIA_PREVIOUS: {
    id: 'MEDIA_BUTTON',
    label: 'action_types.MEDIA_PREVIOUS.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>,
    default: { button: 'previous' }
  },
  DELAY: {
    id: 'DELAY',
    label: 'action_types.DELAY.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    default: { duration: 100 },
    fields: [
      { key: 'duration', type: 'number', label: 'action_types.DELAY.duration', width: 'w-24', required: true }
    ]
  },
  CHANGE_PROFILE: {
    id: 'CHANGE_PROFILE',
    label: 'action_types.CHANGE_PROFILE.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>,
    default: { profileId: '' },
    fields: [
      { key: 'profileId', type: 'select', label: 'action_types.CHANGE_PROFILE.profileId', options: [], required: true }
    ]
  },
  SCREENSHOT: {
    id: 'SCREENSHOT',
    label: 'action_types.SCREENSHOT.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
    default: {},
    fields: []
  },
  CLIPBOARD_HISTORY: {
    id: 'CLIPBOARD_HISTORY',
    label: 'action_types.CLIPBOARD_HISTORY.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>,
    default: {},
    fields: []
  },
  SHOW_DESKTOP: {
    id: 'SHOW_DESKTOP',
    label: 'action_types.SHOW_DESKTOP.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>,
    default: {},
    fields: []
  },
  TASK_MANAGER: {
    id: 'TASK_MANAGER',
    label: 'action_types.TASK_MANAGER.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    default: {},
    fields: []
  },
  CLOSE_WINDOW: {
    id: 'CLOSE_WINDOW',
    label: 'action_types.CLOSE_WINDOW.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>,
    default: {},
    fields: []
  },
  LOCK_SCREEN: {
    id: 'LOCK_SCREEN',
    label: 'action_types.LOCK_SCREEN.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    default: {},
    fields: []
  },
  TYPE_TEXT: {
    id: 'TYPE_TEXT',
    label: 'action_types.TYPE_TEXT.label',
    category: 'action_types.categories.input',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>,
    default: { text: '' },
    fields: [
      { key: 'text', type: 'text', label: 'action_types.TYPE_TEXT.text', placeholder: 'Yazılacak metin...', required: true }
    ]
  },
  RUN_COMMAND: {
    id: 'RUN_COMMAND',
    label: 'action_types.RUN_COMMAND.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>,
    default: { command: '', silent: true },
    fields: [
      { key: 'command', type: 'text', label: 'action_types.RUN_COMMAND.command', placeholder: 'shutdown /s /t 0 veya ping 8.8.8.8', required: true },
      { key: 'silent', type: 'checkbox', label: 'action_types.RUN_COMMAND.silent' }
    ]
  },
  OPEN_FOLDER: {
    id: 'OPEN_FOLDER',
    label: 'action_types.OPEN_FOLDER.label',
    category: 'action_types.categories.apps',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>,
    default: { folder: '' },
    fields: [
      { key: 'folder', type: 'text', label: 'action_types.OPEN_FOLDER.folder', placeholder: 'C:\\Users\\... veya klasör yolu', required: true }
    ]
  },
  VIRTUAL_DESKTOP_LEFT: {
    id: 'VIRTUAL_DESKTOP_LEFT',
    label: 'action_types.VIRTUAL_DESKTOP_LEFT.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
    default: {},
    fields: []
  },
  VIRTUAL_DESKTOP_RIGHT: {
    id: 'VIRTUAL_DESKTOP_RIGHT',
    label: 'action_types.VIRTUAL_DESKTOP_RIGHT.label',
    category: 'action_types.categories.system',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
    default: {},
    fields: []
  },
  SET_VARIABLE: {
    id: 'SET_VARIABLE',
    label: 'action_types.SET_VARIABLE.label',
    category: 'action_types.categories.logic',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>,
    default: { variableName: 'vol', value: '50' },
    fields: [
      { key: 'variableName', type: 'text', label: 'action_types.SET_VARIABLE.name', placeholder: 'vol', required: true },
      { key: 'value', type: 'text', label: 'action_types.SET_VARIABLE.value', placeholder: '50, true, hello or $sys.cpu', required: true }
    ]
  },
  CHANGE_VARIABLE: {
    id: 'CHANGE_VARIABLE',
    label: 'action_types.CHANGE_VARIABLE.label',
    category: 'action_types.categories.logic',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>,
    default: { variableName: 'vol', operation: 'subtract', amount: 10, min: 0, max: 100, syncSystemVolume: true },
    fields: [
      { key: 'variableName', type: 'text', label: 'action_types.CHANGE_VARIABLE.name', placeholder: 'vol', required: true },
      { key: 'operation', type: 'select', label: 'action_types.CHANGE_VARIABLE.operation_label', options: [
        { value: 'add', labelKey: 'action_types.CHANGE_VARIABLE.add' },
        { value: 'subtract', labelKey: 'action_types.CHANGE_VARIABLE.subtract' }
      ], default: 'subtract' },
      { key: 'amount', type: 'number', label: 'action_types.CHANGE_VARIABLE.delta', placeholder: '10', width: 'w-32', required: true },
      { key: 'min', type: 'number', label: 'action_types.CHANGE_VARIABLE.min', placeholder: '0', width: 'w-24' },
      { key: 'max', type: 'number', label: 'action_types.CHANGE_VARIABLE.max', placeholder: '100', width: 'w-24' },
      { key: 'syncSystemVolume', type: 'checkbox', label: 'action_types.CHANGE_VARIABLE.sync_volume', description: 'action_types.CHANGE_VARIABLE.sync_volume_desc' }
    ]
  },
  SET_SYSTEM_VOLUME: {
    id: 'SET_SYSTEM_VOLUME',
    label: 'action_types.SET_SYSTEM_VOLUME.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
    default: { percent: 50 },
    fields: [
      { key: 'percent', type: 'number', min: 0, max: 100, label: 'action_types.SET_SYSTEM_VOLUME.volume', placeholder: '0-100', width: 'w-32', required: true }
    ]
  },
  ADJUST_SYSTEM_VOLUME: {
    id: 'ADJUST_SYSTEM_VOLUME',
    label: 'action_types.ADJUST_SYSTEM_VOLUME.label',
    category: 'action_types.categories.media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="19" x2="19" y1="9" y2="15"/><line x1="16" x2="22" y1="12" y2="12"/></svg>,
    default: { delta: -10 },
    fields: [
      { key: 'delta', type: 'number', label: 'action_types.ADJUST_SYSTEM_VOLUME.delta', placeholder: '-10 or +10', width: 'w-32', required: true }
    ]
  },
  IF_CONDITION: {
    id: 'IF_CONDITION',
    label: 'action_types.IF_CONDITION.label',
    category: 'action_types.categories.logic',
    isBlock: true,
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" x2="21" y1="20" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" x2="21" y1="15" y2="21"/><line x1="4" x2="9" y1="4" y2="9"/></svg>,
    default: { leftOperand: 'vol', operator: '==', rightOperand: '0', hasElse: false, thenActions: [], elseActions: [] },
    fields: [
      { key: 'leftOperand', type: 'text', label: 'action_types.IF_CONDITION.variable', placeholder: 'vol or $sys.cpu', required: true },
      { key: 'operator', type: 'select', label: 'action_types.IF_CONDITION.operator', options: [
        { value: '==', labelKey: 'action_types.operators.eq' },
        { value: '!=', labelKey: 'action_types.operators.neq' },
        { value: '>', labelKey: 'action_types.operators.gt' },
        { value: '<', labelKey: 'action_types.operators.lt' },
        { value: '>=', labelKey: 'action_types.operators.gte' },
        { value: '<=', labelKey: 'action_types.operators.lte' },
        { value: 'contains', labelKey: 'action_types.operators.contains' }
      ], default: '==' },
      { key: 'rightOperand', type: 'text', label: 'action_types.IF_CONDITION.compare_value', placeholder: '0 or 100', required: true },
      { key: 'hasElse', type: 'checkbox', label: 'action_types.IF_CONDITION.enable_else' }
    ]
  },
  LOOP_REPEAT: {
    id: 'LOOP_REPEAT',
    label: 'action_types.LOOP_REPEAT.label',
    category: 'action_types.categories.logic',
    isBlock: true,
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>,
    default: { count: 3, delay: 100, loopActions: [] },
    fields: [
      { key: 'count', type: 'number', min: 1, max: 100, label: 'action_types.LOOP_REPEAT.count', placeholder: '3', width: 'w-24', required: true },
      { key: 'delay', type: 'number', min: 0, label: 'action_types.LOOP_REPEAT.delay', placeholder: '100', width: 'w-24' }
    ]
  },
};

export default function ActionEditor({ isOpen, onClose, buttonIndex, onSave, initialData, existingButtons = [], onStealBinding, profiles = [] }) {
  const { lastMessage, setIsInputRecording, t, language, plugins, sendToEngine, customSounds, settings } = useStore();
  const accentColor = settings?.accentColor || '#3b82f6';
  const [activeTab, setActiveTab] = useState('appearance');

  // Plugin aksiyonlarını statik aksiyonlarla birleştir
  const ACTION_TYPES = useMemo(() => {
    const types = { ...STATIC_ACTION_TYPES };

    if (plugins && plugins.length > 0) {
      plugins.forEach(plugin => {
        if (plugin.actions) {
          plugin.actions.forEach(action => {
            const typeKey = `${action.name}`;
            types[typeKey] = {
              id: typeKey,
              definitionId: typeKey,
              isPlugin: true,
              pluginIdentifier: plugin.identifier || plugin.name,
              label: action.label || action.name,
              category: plugin.name,
              icon: action.iconSrc ? <img src={action.iconSrc} className="w-6 h-6 object-contain" alt="" /> :
                (plugin.iconSrc ? <img src={plugin.iconSrc} className="w-6 h-6 object-contain" alt="" /> : 
                <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11V7a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2 2 2 0 0 1-2-2V7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2 2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h1a2 2 0 0 0 2-2Z"/></svg>),
              default: {},
              fields: action.fields || []
            };

            if (action.fields) {
              action.fields.forEach(field => {
                types[typeKey].default[field.key] = field.default || '';
              });
            }
          });
        }
      });
    }
    return types;
  }, [plugins]);

  // Form State
  const [label, setLabel] = useState('');
  const [bgColor, setBgColor] = useState('#2a2a2a');
  const [bgImage, setBgImage] = useState(null);
  const [iconType, setIconType] = useState('emoji');
  const [selectedEmoji, setSelectedEmoji] = useState('⭐');
  const [selectedLucideIcon, setSelectedLucideIcon] = useState('star');
  const [selectedLucideColor, setSelectedLucideColor] = useState('#ffffff');
  const [lucideSearch, setLucideSearch] = useState('');
  const [selectedLucideCategory, setSelectedLucideCategory] = useState('all');
  const [selectedPluginIcon, setSelectedPluginIcon] = useState(null);
  const [pluginIconSearch, setPluginIconSearch] = useState('');
  const [selectedPluginCategory, setSelectedPluginCategory] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);
  const [actions, setActions] = useState([]);
  const [assignedKey, setAssignedKey] = useState(null);
  const [bindingData, setBindingData] = useState(null);
  const [showTitle, setShowTitle] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(false);
  const [soundFeedback, setSoundFeedback] = useState(false);
  const [customSound, setCustomSound] = useState('');
  const [disableDynamicState, setDisableDynamicState] = useState(false);
  const [textAlignment, setTextAlignment] = useState('center');
  const [textSize, setTextSize] = useState('normal');

  // UI/Logic State
  const [isRecording, setIsRecording] = useState(false);
  const [actionSearch, setActionSearch] = useState('');
  const [actionPluginFilter, setActionPluginFilter] = useState('all');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const startMessageRef = useRef(null);
  const fileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [modal, setModal] = useState({ show: false, type: 'alert', title: '', message: '', onConfirm: () => { } });
  const lastInitializedRef = useRef(null);

  const [dynamicOptions, setDynamicOptions] = useState({}); // { [actionId_fieldKey]: options[] }
  const [manualInputs, setManualInputs] = useState({}); // { [actionId_fieldKey]: boolean }
  const pendingRequests = useRef({}); // { [requestId]: cacheKey }
  const [openDropdown, setOpenDropdown] = useState(null); // { actionId, fieldKey }
  const dynamicCache = useRef({});
  const inFlightRequests = useRef({});
  const initializedActions = useRef(new Set());
  const [activeDropTarget, setActiveDropTarget] = useState(null); // 'main' or `${parentId}_${listKey}`
  const [draggingAction, setDraggingAction] = useState(null);

  // Lucide İkon Filtreleme (Memoized for high performance)
  const filteredLucideIcons = useMemo(() => {
    return LUCIDE_ICONS_LIST.filter(item => {
      const matchesCat = selectedLucideCategory === 'all' || item.category === selectedLucideCategory;
      const q = lucideSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        item.id.toLowerCase().includes(q) || 
        item.name.toLowerCase().includes(q) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q)));
      return matchesCat && matchesSearch;
    });
  }, [selectedLucideCategory, lucideSearch]);

  // Plugin İkonlarını Topla & Filtrele
  const allPluginIcons = useMemo(() => {
    const list = [];
    if (plugins && plugins.length > 0) {
      plugins.forEach(p => {
        const pName = p.name || 'Plugin';
        const pId = p.identifier || p.name;
        
        // 1. Plugin Ana İkonu
        if (p.iconSrc || p.icon) {
          list.push({
            id: `${pId}_main`,
            pluginName: pName,
            category: pName,
            name: `${pName} Main Icon`,
            src: p.iconSrc || p.icon,
            svg: p.iconSvg || null
          });
        }

        // 2. plugin.json 'icons' dizisi
        if (p.icons && Array.isArray(p.icons)) {
          p.icons.forEach((ic, icIdx) => {
            list.push({
              id: ic.id || `${pId}_ic_${icIdx}`,
              pluginName: pName,
              category: ic.category || pName,
              name: ic.name || ic.label || `${pName} Icon ${icIdx + 1}`,
              src: ic.src || ic.url || null,
              svg: ic.svg || null
            });
          });
        }

        // 3. Plugin Aksiyon İkonları
        if (p.actions && Array.isArray(p.actions)) {
          p.actions.forEach((act, aIdx) => {
            if (act.iconSrc || act.icon || act.iconSvg) {
              list.push({
                id: `${pId}_act_${act.name || aIdx}`,
                pluginName: pName,
                category: pName,
                name: act.label || act.name,
                src: act.iconSrc || act.icon,
                svg: act.iconSvg || null
              });
            }
          });
        }
      });
    }
    return list;
  }, [plugins]);

  const filteredPluginIcons = useMemo(() => {
    return allPluginIcons.filter(item => {
      const matchesCat = selectedPluginCategory === 'all' || item.category === selectedPluginCategory || item.pluginName === selectedPluginCategory;
      const q = pluginIconSearch.toLowerCase().trim();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.pluginName.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [allPluginIcons, selectedPluginCategory, pluginIconSearch]);

  const pluginCategories = useMemo(() => {
    const cats = new Set(['all']);
    allPluginIcons.forEach(ic => {
      if (ic.pluginName) cats.add(ic.pluginName);
    });
    return Array.from(cats);
  }, [allPluginIcons]);

  useEffect(() => {
    setIsInputRecording(isRecording && isOpen);
    return () => setIsInputRecording(false);
  }, [isRecording, isOpen, setIsInputRecording]);

  // WebSocket'ten gelen tuş verisini dinle
  useEffect(() => {
    if (isRecording && lastMessage && lastMessage.type === 'inputPressed') {
      if (startMessageRef.current && lastMessage === startMessageRef.current) return;

      // Çakışma Kontrolü
      const conflictIndex = existingButtons.findIndex((btn, idx) =>
        idx !== buttonIndex &&
        btn?.binding?.key === lastMessage.key &&
        btn?.binding?.hid === lastMessage.hid
      );

      if (conflictIndex !== -1) {
        setConflictInfo({
          index: conflictIndex,
          label: existingButtons[conflictIndex].label || `Button ${conflictIndex + 1}`,
          binding: { ...lastMessage }
        });
        setIsRecording(false);
        return;
      }

      setAssignedKey(`Key: ${lastMessage.key}`);
      setBindingData({
        type: lastMessage.type,
        hid: lastMessage.hid,
        handler: lastMessage.handler,
        key: lastMessage.key
      });
      setIsRecording(false);

    }
  }, [lastMessage, isRecording, existingButtons, buttonIndex]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'ACTION_DATA_RESPONSE') {
      const { requestId, data: responseData } = lastMessage;

      // Bu istek bizim şu an beklediğimiz bir istek mi?
      const cacheKey = pendingRequests.current[requestId];

      // 👇 AJAN LOG 1: Bakalım elimizde ne var?
      console.log("🕵️‍♂️ [DEBUG] Gelen Request ID:", requestId);
      console.log("🕵️‍♂️ [DEBUG] Bulunan Cache Key:", cacheKey);

      if (cacheKey) {
        const rawList = Array.isArray(responseData) ? responseData : [];

        const safeData = rawList.map(item => ({
          id: item.id || item.Id,
          label: item.label || item.Label,
          description: item.description || item.Description,
          image: item.image || item.Image
        }));

        // 👇 AJAN LOG 2: Veri düzgün dönüştü mü?
        console.log("🕵️‍♂️ [DEBUG] Dönüştürülen Veri (İlk Öğe):", safeData[0]);

        // State güncelle
        setDynamicOptions(prev => {
          const newState = { ...prev, [cacheKey]: safeData };
          // 👇 AJAN LOG 3: State güncelleniyor mu?
          console.log("🕵️‍♂️ [DEBUG] Yeni State Anahtarları:", Object.keys(newState));
          return newState;
        });

        delete inFlightRequests.current[cacheKey];
        delete pendingRequests.current[requestId];
      } else {
        console.warn("⚠️ [DEBUG] Cache Key bulunamadı! Request ID eşleşmiyor:", requestId);
        console.warn("      Beklenen ID'ler:", Object.keys(pendingRequests.current));
      }
    }
  }, [lastMessage]);





  // Modal Açılış/Sıfırlama
  useEffect(() => {
    // Sonsuz döngüyü engellemek için sadece isOpen veya buttonIndex değiştiğinde bir kez çalıştır
    const initKey = `${buttonIndex}_${isOpen}`;
    if (isOpen && lastInitializedRef.current !== initKey) {
      lastInitializedRef.current = initKey;

      setActiveTab('appearance');
      setActionSearch(''); // Arama geçmişini temizle
      setCollapsedCategories({}); // Kategorileri aç

      setConflictInfo(null);
      if (initialData) {
        setLabel(initialData.label || '');
        setBgColor(initialData.bgColor || '#2a2a2a');
        setBgImage(initialData.bgImage || null);
        setIconType(initialData.iconType || 'emoji'); // emoji, lucide, image, none
        setSelectedEmoji(initialData.selectedEmoji || '⭐');
        setSelectedLucideIcon(initialData.selectedLucideIcon || 'star');
        setSelectedLucideColor(initialData.selectedLucideColor || '#ffffff');
        setLucideSearch('');
        setSelectedLucideCategory('all');
        setSelectedPluginIcon(initialData.selectedPluginIcon || null);
        setPluginIconSearch('');
        setSelectedPluginCategory('all');
        setSelectedImage(initialData.selectedImage || null);
        const loadedActions = Array.isArray(initialData.actions)
          ? initialData.actions.map(a => {
            if (typeof a === 'string') return { id: Math.random(), type: 'UNKNOWN', label: a, expanded: false };

            // UI için doğru tanımı bul (definitionId)
            let definitionId = a.definitionId;
            if (!definitionId) {
              if (ACTION_TYPES[a.type]) {
                definitionId = a.type;
              } else {
                const match = Object.entries(ACTION_TYPES).find(([key, val]) =>
                  val.id === a.type && (val.id !== 'MEDIA_BUTTON' || val.default?.button === a.button)
                );
                if (match) definitionId = match[0];
              }
            }
            return {
              ...a,
              id: a.id || `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              definitionId,
              expanded: false
            };
          })
          : [];
        setActions(loadedActions);
        setBindingData(initialData.binding || null);
        setAssignedKey(initialData.binding ? `Key: ${initialData.binding.key}` : null);
        setShowTitle(initialData.showTitle !== undefined ? initialData.showTitle : true);
        setHapticFeedback(initialData.hapticFeedback || false);
        setSoundFeedback(initialData.soundFeedback || false);
        setCustomSound(initialData.customSound || '');
        setDisableDynamicState(initialData.disableDynamicState || false);
        setTextAlignment(initialData.textAlignment || 'center');
        setTextSize(initialData.textSize || 'normal');
      } else {
        setLabel(`KEY ${buttonIndex + 1}`);
        setBgColor('#2a2a2a');
        setBgImage(null);
        setIconType('emoji');
        setSelectedEmoji('⭐');
        setSelectedLucideIcon('star');
        setSelectedLucideColor('#ffffff');
        setLucideSearch('');
        setSelectedLucideCategory('all');
        setSelectedPluginIcon(null);
        setPluginIconSearch('');
        setSelectedPluginCategory('all');
        setSelectedImage(null);
        setActions([]);
        setBindingData(null);
        setAssignedKey(null);
        setShowTitle(true);
        setHapticFeedback(false);
        setSoundFeedback(false);
        setCustomSound('');
        setDisableDynamicState(false);
        setTextAlignment('center');
        setTextSize('normal');
      }
    }
  }, [isOpen, buttonIndex, initialData, ACTION_TYPES]); // ACTION_TYPES ve initialData referansları değişse bile ref kontrolü korur

  const handleRecordingToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      if (bindingData) {
        setAssignedKey(`Key: ${bindingData.key}`);
      } else {
        setAssignedKey(null);
      }
    } else {
      startMessageRef.current = lastMessage;
      setIsRecording(true); // Bu işlem ClientLayout'taki isInputRecording'i tetikler
      setAssignedKey(t('editor.binding.waiting', language));
    }
  };

  const handleRemoveBinding = () => {
    setIsRecording(false);
    setBindingData(null);
    setAssignedKey(null);
  };

  const addAction = (typeKey) => {
    // Plugin Config Validation
    if (typeKey.startsWith('PLUGIN_')) {
      const plugin = plugins.find(p => typeKey.startsWith(`PLUGIN_${p.identifier}_`));
      if (plugin && plugin.config) {
        const missingConfig = plugin.config.find(cfg => {
          const isRequired = cfg.fields && cfg.fields.some(f => f.required);
          if (!isRequired) return false;
          return !cfg.value || cfg.value === '' || cfg.value === 'NO_KEY';
        });

        if (missingConfig) {
          setModal({
            show: true,
            type: 'alert',
            title: language === 'tr' ? 'Hata' : 'Error',
            message: `${t('editor.errors.plugin_config_missing', language)} ${plugin.name} - ${missingConfig.name}`,
            onConfirm: () => setModal(prev => ({ ...prev, show: false }))
          });
          return;
        }
      }
    }

    const def = ACTION_TYPES[typeKey];
    if (!def) return; // Tanım bulunamazsa çökme
    setActions([...actions, {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: def.id,
      definitionId: typeKey,
      label: def.label,
      expanded: true,
      ...def.default
    }]);
  };

  const duplicateAction = (action) => {
    const newAction = { ...action, id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, expanded: true };
    setActions([...actions, newAction]);
  };

  const fetchDynamicData = (action, fieldKey) => {
    const def = ACTION_TYPES[action.definitionId];
    const field = def?.fields?.find(f => f.key === fieldKey);

    if (!field || (field.source !== 'dynamic' && field.type !== 'dynamic_select')) return;

    const cacheKey = `${action.id}_${fieldKey}`;

    // Cache varsa
    if (dynamicCache.current[cacheKey]) {
      setDynamicOptions(prev => ({
        ...prev,
        [cacheKey]: dynamicCache.current[cacheKey]
      }));
      return;
    }

    // Zaten istek atıldıysa
    if (inFlightRequests.current[cacheKey]) return;

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    inFlightRequests.current[cacheKey] = true;
    pendingRequests.current[requestId] = cacheKey;

    const args = {};
    def.fields?.forEach(f => {
      if (action[f.key] !== undefined && f.source !== 'dynamic' && f.type !== 'dynamic_select') {
        args[f.key] = action[f.key];
      }
    });

    // sourceKey yoksa dataType veya field.key kullan
    const dataType = field.sourceKey || field.dataType || field.key;

    sendToEngine({
      type: 'GET_ACTION_DATA',
      requestId,
      action: action.definitionId,
      dataType,
      args
    });

    // Fail-safe
    setTimeout(() => {
      delete inFlightRequests.current[cacheKey];
      delete pendingRequests.current[requestId];
    }, 5000);
  };

  const updateAction = (id, field, value) => {
    setActions(prevActions => {
      // 1️⃣ Aksiyonu güncelle
      const newActions = prevActions.map(a =>
        a.id === id ? { ...a, [field]: value } : a
      );

      const action = newActions.find(a => a.id === id);
      if (!action) return newActions;

      const def = ACTION_TYPES[action.definitionId];
      if (!def?.fields) return newActions;

      // 2️⃣ SADECE:
      // - dynamic olan
      // - değiştirilen field HARİÇ
      def.fields.forEach(f => {
        if (
          f.source === 'dynamic' &&
          f.key !== field // <<< KRİTİK SATIR
        ) {
          fetchDynamicData(action, f.key);
        }
      });

      return newActions;
    });
  };

  const moveActionUp = (index) => {
    if (index === 0) return;
    const newActions = [...actions];
    [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
    setActions(newActions);
  };

  const moveActionDown = (index) => {
    if (index === actions.length - 1) return;
    const newActions = [...actions];
    [newActions[index + 1], newActions[index]] = [newActions[index], newActions[index + 1]];
    setActions(newActions);
  };

  const toggleActionExpand = (id) => {
    setActions(actions.map(a => a.id === id ? { ...a, expanded: !a.expanded } : a));
  };

  const addNestedAction = (parentId, listKey, typeKey) => {
    const def = ACTION_TYPES[typeKey];
    if (!def) return;
    const newSubAction = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: def.id,
      definitionId: typeKey,
      label: def.label,
      expanded: true,
      ...def.default
    };
    setActions(prev => prev.map(act => {
      if (act.id === parentId) {
        const currentList = Array.isArray(act[listKey]) ? act[listKey] : [];
        return {
          ...act,
          [listKey]: [...currentList, newSubAction]
        };
      }
      return act;
    }));
  };

  const updateNestedAction = (parentId, listKey, subActionId, field, value) => {
    setActions(prev => prev.map(act => {
      if (act.id === parentId) {
        const currentList = Array.isArray(act[listKey]) ? act[listKey] : [];
        const updatedList = currentList.map(sub => {
          if (sub.id === subActionId) {
            return { ...sub, [field]: value };
          }
          return sub;
        });
        return { ...act, [listKey]: updatedList };
      }
      return act;
    }));
  };

  const deleteNestedAction = (parentId, listKey, subActionId) => {
    setActions(prev => prev.map(act => {
      if (act.id === parentId) {
        const currentList = Array.isArray(act[listKey]) ? act[listKey] : [];
        return { ...act, [listKey]: currentList.filter(sub => sub.id !== subActionId) };
      }
      return act;
    }));
  };

  const moveNestedAction = (parentId, listKey, subActionIdx, direction) => {
    setActions(prev => prev.map(act => {
      if (act.id === parentId) {
        const currentList = [...(Array.isArray(act[listKey]) ? act[listKey] : [])];
        const targetIdx = subActionIdx + direction;
        if (targetIdx >= 0 && targetIdx < currentList.length) {
          const temp = currentList[subActionIdx];
          currentList[subActionIdx] = currentList[targetIdx];
          currentList[targetIdx] = temp;
        }
        return { ...act, [listKey]: currentList };
      }
      return act;
    }));
  };

  const toggleNestedActionExpand = (parentId, listKey, subActionId) => {
    setActions(prev => prev.map(act => {
      if (act.id === parentId) {
        const currentList = Array.isArray(act[listKey]) ? act[listKey] : [];
        const updatedList = currentList.map(sub => {
          if (sub.id === subActionId) {
            return { ...sub, expanded: !sub.expanded };
          }
          return sub;
        });
        return { ...act, [listKey]: updatedList };
      }
      return act;
    }));
  };

  const handleDragStartCatalog = (e, typeKey) => {
    try {
      const payload = JSON.stringify({
        source: 'catalog',
        typeKey
      });
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.effectAllowed = 'copyMove';
      if (typeof window !== 'undefined') {
        window.__isudeck_drag = { source: 'catalog', typeKey };
      }
      setDraggingAction({ source: 'catalog', typeKey });
    } catch (err) {
      console.error('Drag start error:', err);
    }
  };

  const handleDragStartExisting = (e, actionId, parentId = null, listKey = null, index = 0) => {
    try {
      const payload = JSON.stringify({
        source: 'existing',
        actionId,
        parentId,
        listKey,
        index
      });
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.effectAllowed = 'copyMove';
      if (typeof window !== 'undefined') {
        window.__isudeck_drag = { source: 'existing', actionId, parentId, listKey, index };
      }
      setDraggingAction({ source: 'existing', actionId, parentId, listKey, index });
    } catch (err) {
      console.error('Drag start existing error:', err);
    }
  };

  const handleDragEnd = () => {
    setActiveDropTarget(null);
    setDraggingAction(null);
    if (typeof window !== 'undefined') {
      window.__isudeck_drag = null;
    }
  };

  const getDroppedData = (e) => {
    try {
      const text = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('application/json');
      if (text) {
        return JSON.parse(text);
      }
    } catch (err) {}
    if (typeof window !== 'undefined' && window.__isudeck_drag) {
      return window.__isudeck_drag;
    }
    return null;
  };

  const handleDropOnMain = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const data = getDroppedData(e);
    handleDragEnd();
    if (!data) return;

    try {
      if (data.source === 'catalog') {
        addAction(data.typeKey);
      } else if (data.source === 'existing' && data.parentId && data.listKey) {
        // Move from nested slot to main actions list
        const parent = actions.find(a => a.id === data.parentId);
        if (!parent) return;
        const subList = Array.isArray(parent[data.listKey]) ? parent[data.listKey] : [];
        const itemToMove = subList.find(s => s.id === data.actionId);
        if (!itemToMove) return;

        deleteNestedAction(data.parentId, data.listKey, data.actionId);
        setActions(prev => [...prev, { ...itemToMove, id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }]);
      }
    } catch (err) {
      console.error('Drop on main error:', err);
    }
  };

  const handleDropOnSlot = (e, parentId, listKey) => {
    e.preventDefault();
    e.stopPropagation();
    const data = getDroppedData(e);
    handleDragEnd();
    if (!data) return;

    try {
      if (data.source === 'catalog') {
        const def = ACTION_TYPES[data.typeKey];
        if (!def || def.isBlock) return; // Prevent nesting blocks inside blocks
        addNestedAction(parentId, listKey, data.typeKey);
      } else if (data.source === 'existing') {
        if (data.parentId === parentId && data.listKey === listKey) {
          return;
        }
        if (data.parentId && data.listKey) {
          const oldParent = actions.find(a => a.id === data.parentId);
          if (!oldParent) return;
          const oldList = Array.isArray(oldParent[data.listKey]) ? oldParent[data.listKey] : [];
          const itemToMove = oldList.find(s => s.id === data.actionId);
          if (!itemToMove) return;

          deleteNestedAction(data.parentId, data.listKey, data.actionId);
          setActions(prev => prev.map(a => {
            if (a.id === parentId) {
              const currentList = Array.isArray(a[listKey]) ? a[listKey] : [];
              return {
                ...a,
                [listKey]: [...currentList, { ...itemToMove, id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }]
              };
            }
            return a;
          }));
        } else {
          const itemToMove = actions.find(a => a.id === data.actionId);
          if (!itemToMove) return;
          const def = ACTION_TYPES[itemToMove.definitionId];
          if (def?.isBlock) return;

          setActions(prev => prev.filter(a => a.id !== data.actionId).map(a => {
            if (a.id === parentId) {
              const currentList = Array.isArray(a[listKey]) ? a[listKey] : [];
              return {
                ...a,
                [listKey]: [...currentList, { ...itemToMove, id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }]
              };
            }
            return a;
          }));
        }
      }
    } catch (err) {
      console.error('Slot drop error:', err);
    }
  };

  const getGroupedActions = () => {
    const groups = {};
    Object.entries(ACTION_TYPES).forEach(([key, action]) => {
      if (!action) return;
      
      // Filter by plugin / category dropdown
      if (actionPluginFilter !== 'all') {
        if (actionPluginFilter === 'builtin' && action.isPlugin) return;
        if (actionPluginFilter !== 'builtin') {
          if (!action.isPlugin) return;
          if (action.category !== actionPluginFilter && action.pluginIdentifier !== actionPluginFilter) return;
        }
      }

      const translatedLabel = action.isPlugin ? action.label : t(action.label, language);
      const translatedCategory = action.isPlugin ? action.category : t(action.category, language);

      // Arama filtresi
      if (!actionSearch ||
        translatedLabel.toLowerCase().includes(actionSearch.toLowerCase()) ||
        translatedCategory.toLowerCase().includes(actionSearch.toLowerCase()) ||
        key.toLowerCase().includes(actionSearch.toLowerCase())) {
        if (!groups[action.category]) groups[action.category] = [];
        groups[action.category].push({ ...action, typeKey: key });
      }
    });
    return groups;
  };

  const toggleCategory = (category) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBgImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBgImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = async (actionId, fieldKey, filters = [], parentId = null, listKey = null) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: filters
      });

      if (selected && typeof selected === 'string') {
        if (parentId && listKey) {
          updateNestedAction(parentId, listKey, actionId, fieldKey, selected);
        } else {
          updateAction(actionId, fieldKey, selected);
        }
      }
    } catch (err) {
      console.log('Tauri API bulunamadı veya tarayıcı modunda:', err);
      setModal({
        show: true,
        type: 'alert',
        title: language === 'tr' ? 'Hata' : 'Error',
        message: t('editor.errors.file_picker_desktop', language),
        onConfirm: () => setModal(prev => ({ ...prev, show: false }))
      });
    }
  };

  const renderFieldInput = (targetAct, field, onUpdateField, parentId = null, listKey = null) => {
    const actDef = ACTION_TYPES[targetAct.definitionId] || ACTION_TYPES[targetAct.type];
    const isPluginAct = actDef?.isPlugin;

    return (
      <div className="flex flex-col gap-1.5 mb-2">
        {field.label && (
          <label className="text-xs font-medium text-zinc-400">
            {isPluginAct ? field.label : t(field.label, language)} {field.required && <span className="text-red-500">*</span>}
          </label>
        )}
        {(field.type === 'text' || field.type === 'password' || field.type === 'email' || field.type === 'url') && (
          <input
            type={field.type}
            value={targetAct[field.key] || ''}
            onChange={(e) => onUpdateField(field.key, e.target.value)}
            placeholder={isPluginAct ? field.placeholder : t(field.placeholder, language)}
            maxLength={field.maxLength}
            minLength={field.minLength}
            className="bg-[#121212] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full focus:border-blue-500 outline-none transition-colors"
          />
        )}
        {field.type === 'number' && (
          <input
            type="number"
            value={targetAct[field.key] !== undefined ? targetAct[field.key] : ''}
            onChange={(e) => onUpdateField(field.key, e.target.value === '' ? '' : parseInt(e.target.value))}
            min={field.min}
            max={field.max}
            placeholder={isPluginAct ? field.placeholder : t(field.placeholder, language)}
            className={`bg-[#121212] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 outline-none transition-colors ${field.width || 'w-full'}`}
          />
        )}
        {field.type === 'file' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={targetAct[field.key] || ''}
              onChange={(e) => onUpdateField(field.key, e.target.value)}
              placeholder={isPluginAct ? field.placeholder : t(field.placeholder, language)}
              className={`bg-[#121212] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 outline-none transition-colors ${field.width || 'w-full'}`}
            />
            <button
              onClick={() => handleFileSelect(targetAct.id, field.key, field.filters, parentId, listKey)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded border border-white/5 transition-colors flex items-center justify-center cursor-pointer shrink-0"
              title={t('editor.actions.file_select', language)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
            </button>
          </div>
        )}
        {field.type === 'checkbox' && (
          <div className="flex items-center gap-2.5 bg-[#121212] border border-white/10 rounded px-3 py-2 cursor-pointer" onClick={() => onUpdateField(field.key, !targetAct[field.key])}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${targetAct[field.key] ? 'bg-blue-600 border-blue-600' : 'bg-zinc-800 border-zinc-600'}`}>
              {targetAct[field.key] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <span className="text-xs text-zinc-300 select-none">{(isPluginAct ? field.description : t(field.description, language)) || (isPluginAct ? field.placeholder : t(field.placeholder, language)) || (language === 'tr' ? 'Etkinleştir' : 'Enable')}</span>
          </div>
        )}
        {field.type === 'slider' && (
          <div className="flex items-center gap-3 bg-[#121212] border border-white/10 rounded px-3 py-2">
            <input
              type="range"
              min={field.min || 0}
              max={field.max || 100}
              step={field.step || 1}
              value={targetAct[field.key] !== undefined ? targetAct[field.key] : (field.default || 0)}
              onChange={(e) => onUpdateField(field.key, parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-xs font-bold text-blue-400 w-10 text-right">
              {targetAct[field.key] !== undefined ? targetAct[field.key] : (field.default || 0)}
            </span>
          </div>
        )}
        {field.type === 'color' && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={targetAct[field.key] || '#000000'}
              onChange={(e) => onUpdateField(field.key, e.target.value)}
              className="h-8 w-10 bg-transparent border border-white/10 rounded cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={targetAct[field.key] || '#000000'}
              onChange={(e) => onUpdateField(field.key, e.target.value)}
              className="bg-[#121212] border border-white/10 rounded px-2 py-1 text-xs text-white w-24 focus:border-blue-500 outline-none transition-colors uppercase"
              maxLength={7}
            />
          </div>
        )}
        {(field.type === 'select' || field.type === 'listbox' || field.type === 'dynamic_select') && (
          (field.source === 'dynamic' || field.type === 'dynamic_select') ? (
            <div className="flex gap-2">
              {manualInputs[`${targetAct.id}_${field.key}`] ? (
                <input
                  type="text"
                  value={targetAct[field.key] || ''}
                  onChange={(e) => onUpdateField(field.key, e.target.value)}
                  placeholder={actDef?.isPlugin ? (field.placeholder || "Sahne veya kaynak adını yazın...") : t(field.placeholder, language)}
                  className="bg-[#121212] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full focus:border-blue-500 outline-none transition-colors"
                />
              ) : (
                <div className="relative w-full">
                  <select
                    value={targetAct[field.key] || ''}
                    onChange={(e) => onUpdateField(field.key, e.target.value)}
                    onClick={() => {
                      if (!dynamicOptions[`${targetAct.id}_${field.key}`] || dynamicOptions[`${targetAct.id}_${field.key}`].length === 0) {
                        fetchDynamicData(targetAct, field.key);
                      }
                    }}
                    className="bg-[#121212] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full focus:border-blue-500 outline-none transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" disabled>
                      {dynamicOptions[`${targetAct.id}_${field.key}`]?.length > 0
                        ? (language === 'tr' ? `Seçiniz (${dynamicOptions[`${targetAct.id}_${field.key}`].length} Öğe)` : `Select (${dynamicOptions[`${targetAct.id}_${field.key}`].length} Items)`)
                        : (targetAct[field.key] ? (language === 'tr' ? "Kayıtlı değer seçildi" : "Saved value selected") : (language === 'tr' ? "Veri Yükleniyor / OBS Kapalı" : "Loading Data / OBS Offline"))}
                    </option>
                    {targetAct[field.key] && !dynamicOptions[`${targetAct.id}_${field.key}`]?.some(opt => (opt.id === targetAct[field.key] || opt.label === targetAct[field.key])) && (
                      <option value={targetAct[field.key]}>
                        {targetAct[field.key]} {language === 'tr' ? '(Kayıtlı)' : '(Saved)'}
                      </option>
                    )}
                    {dynamicOptions[`${targetAct.id}_${field.key}`]?.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label || opt.id}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setManualInputs(prev => ({
                    ...prev,
                    [`${targetAct.id}_${field.key}`]: !prev[`${targetAct.id}_${field.key}`]
                  }));
                }}
                title={manualInputs[`${targetAct.id}_${field.key}`] ? (language === 'tr' ? "Listeden Seç" : "Select from List") : (language === 'tr' ? "Elle Yaz" : "Type Manually")}
                className={`p-1.5 border rounded transition-colors shrink-0 ${manualInputs[`${targetAct.id}_${field.key}`] ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-zinc-800 border-white/10 hover:bg-zinc-700 hover:text-white text-zinc-400'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  delete dynamicCache.current[`${targetAct.id}_${field.key}`];
                  delete inFlightRequests.current[`${targetAct.id}_${field.key}`];
                  fetchDynamicData(targetAct, field.key);
                }}
                title={language === 'tr' ? "Listeyi Yenile" : "Refresh List"}
                className="p-1.5 bg-zinc-800 border border-white/10 rounded hover:bg-zinc-700 hover:text-white text-zinc-400 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                value={targetAct[field.key] || ''}
                onChange={(e) => onUpdateField(field.key, e.target.value)}
                className="bg-[#121212] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full focus:border-blue-500 outline-none transition-colors appearance-none cursor-pointer"
              >
                {(field.key === 'profileId' ? profiles.map(p => ({ value: p.id, label: p.name })) : (field.items || field.options))?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.labelKey ? t(opt.labelKey, language) : opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
          )
        )}
        {field.type === 'richtext' && (
          <div className="space-y-2">
            <textarea
              value={targetAct[field.key] || ''}
              onChange={(e) => onUpdateField(field.key, e.target.value)}
              placeholder={isPluginAct ? field.placeholder : t(field.placeholder, language)}
              className="bg-[#121212] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white w-full focus:border-blue-500 outline-none transition-colors min-h-[70px] resize-y"
            />
            <div className="bg-[#1a1a1a] border border-white/5 rounded p-2">
              <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-bold">{t('editor.appearance.preview', language)}</div>
              <div
                className="prose prose-invert prose-sm max-w-none text-zinc-300 [&>h1]:text-white [&>h1]:text-base [&>h1]:font-bold [&>h2]:text-white [&>h2]:text-sm [&>h2]:font-bold [&>p]:my-1 text-xs"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(targetAct[field.key]) }}
              />
            </div>
            {field.description && <p className="text-[10px] text-zinc-500">{isPluginAct ? field.description : t(field.description, language)}</p>}
          </div>
        )}
        {field.warningKey && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mt-1">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span className="font-medium leading-tight">{t(field.warningKey, language)}</span>
          </div>
        )}
        {field.richtext && (
          <div
            className="prose prose-invert prose-sm max-w-none text-zinc-400 text-xs [&>p]:my-1"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(typeof field.richtext === 'string' ? (field.richtext.startsWith('action_types.') ? t(field.richtext, language) : field.richtext) : '') }}
          />
        )}
      </div>
    );
  };

  const renderNestedSlot = (parentAct, listKey, theme) => {
    const subList = Array.isArray(parentAct[listKey]) ? parentAct[listKey] : [];
    const targetKey = `${parentAct.id}_${listKey}`;
    const isHovered = activeDropTarget === targetKey;

    return (
      <div className={`pl-4 pr-3 py-2 border-l-[6px] ${theme.spineColor} ${theme.bgCavity} transition-all duration-150`}>
        {/* Sub-actions List */}
        {subList.length > 0 && (
          <div className="space-y-2 mb-2">
            {subList.map((subAct, subIdx) => {
              const subDef = ACTION_TYPES[subAct.definitionId] || ACTION_TYPES[subAct.type];
              return (
                <div
                  key={subAct.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStartExisting(e, subAct.id, parentAct.id, listKey, subIdx)}
                  onDragEnd={handleDragEnd}
                  className="bg-[#18181c] border border-white/10 hover:border-white/20 rounded-xl p-2.5 text-xs space-y-2 shadow-sm transition-all group/sub"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing font-mono text-sm leading-none shrink-0" title="Sürükle">
                        ⠿
                      </span>
                      {subDef?.fields?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleNestedActionExpand(parentAct.id, listKey, subAct.id)}
                          className="p-0.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title={subAct.expanded ? 'Küçült' : 'Genişlet'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${subAct.expanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                      )}
                      <span className="w-4 h-4 rounded bg-zinc-800 text-[10px] flex items-center justify-center text-zinc-400 font-mono shrink-0">
                        {subIdx + 1}
                      </span>
                      <span className="font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                        {subDef?.icon && <span className="w-3.5 h-3.5 text-zinc-400 shrink-0">{subDef.icon}</span>}
                        {subDef?.isPlugin ? subAct.label : (subDef ? t(subDef.label, language) : (subAct.label || subAct.type))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveNestedAction(parentAct.id, listKey, subIdx, -1)}
                        disabled={subIdx === 0}
                        className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Yukarı Taşı"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNestedAction(parentAct.id, listKey, subIdx, 1)}
                        disabled={subIdx === subList.length - 1}
                        className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Aşağı Taşı"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNestedAction(parentAct.id, listKey, subAct.id)}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                        title={language === 'tr' ? 'Sil' : 'Delete'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg>
                      </button>
                    </div>
                  </div>

                  {subAct.expanded && subDef?.fields?.length > 0 && (
                    <div className="pl-4 space-y-2 border-t border-white/5 pt-2">
                      {subDef.fields.map((f, fIdx) => (
                        <div key={f.key || fIdx}>
                          {renderFieldInput(subAct, f, (fieldKey, val) => updateNestedAction(parentAct.id, listKey, subAct.id, fieldKey, val), parentAct.id, listKey)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Drop Target Cavity */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            if (activeDropTarget !== targetKey) setActiveDropTarget(targetKey);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveDropTarget(targetKey);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            if (activeDropTarget === targetKey) setActiveDropTarget(null);
          }}
          onDrop={(e) => handleDropOnSlot(e, parentAct.id, listKey)}
          className={`p-3 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-wrap items-center justify-between gap-2 cursor-pointer ${
            isHovered
              ? `${theme.bgActive} ${theme.borderHover} shadow-[0_0_25px_${theme.glowColor}] scale-[1.01]`
              : 'border-white/15 hover:border-white/25 bg-black/30 hover:bg-black/40'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium pointer-events-none">
            <svg className={`w-4 h-4 transition-transform ${isHovered ? 'scale-125 animate-bounce text-white' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 21h8"/>
            </svg>
            <span className={isHovered ? 'text-white font-bold' : 'text-zinc-300'}>
              {isHovered ? t('action_types.IF_CONDITION.drop_zone_hover', language) : (subList.length === 0 ? theme.emptyHint : t('action_types.IF_CONDITION.drag_hint', language))}
            </span>
          </div>

          {/* Quick-Add Dropdown right inside slot */}
          <div className="relative">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addNestedAction(parentAct.id, listKey, e.target.value);
                }
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-white/10 rounded-lg px-2.5 py-1 text-xs font-medium outline-none transition-all cursor-pointer appearance-none pr-6"
            >
              <option value="" disabled>{t('action_types.IF_CONDITION.quick_add', language)}</option>
              {Object.entries(getGroupedActions()).map(([cat, acts]) => {
                const validActs = acts.filter(a => !a.isBlock);
                if (validActs.length === 0) return null;
                return (
                  <optgroup key={cat} label={validActs[0]?.isPlugin ? cat : t(cat, language)}>
                    {validActs.map(a => (
                      <option key={a.typeKey} value={a.typeKey}>
                        {a.isPlugin ? a.label : t(a.label, language)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleCustomSoundSelect = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'flac'] }]
      });

      if (selected && typeof selected === 'string') {
        setCustomSound(selected);
      }
    } catch (err) {
      console.log('Ses dosyası seçme hatası:', err);
    }
  };

  const handlePlayPreviewSound = async (soundPath) => {
    const snd = soundPath || customSound || settings?.selectedSound || 'click.wav';
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('play_sound_file', { sound: snd });
    } catch {
      const audio = new Audio(snd.startsWith('/') || snd.startsWith('http') ? snd : `/sounds/${snd}`);
      audio.play().catch(() => {});
    }
  };

  const handleClose = () => {
    if (isRecording) {
      setIsRecording(false);
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!actions.length) return;

    actions.forEach(action => {
      if (initializedActions.current.has(action.id)) return;

      const def = ACTION_TYPES[action.definitionId];
      if (!def?.fields) return;

      def.fields.forEach(f => {
        if (f.source === 'dynamic' || f.type === 'dynamic_select') {
          // Sadece daha önce fetch edilmemişse
          const cacheKey = `${action.id}_${f.key}`;
          if (!dynamicCache.current[cacheKey]) {
            fetchDynamicData(action, f.key);
          }
        }
      });

      initializedActions.current.add(action.id);
    });
  }, [isOpen, actions, ACTION_TYPES]);

  // Component kapatıldığında temizlik
  useEffect(() => {
    const inFlight = inFlightRequests.current;
    const pending = pendingRequests.current;
    return () => {
      // Component kapatıldığında cache'i ve pending istekleri temizle
      Object.keys(inFlight).forEach(key => {
        delete inFlight[key];
      });
      Object.keys(pending).forEach(key => {
        delete pending[key];
      });
    };
  }, []);

  if (!isOpen) return null;



  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-[90vh] bg-[#1e1e1e] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Conflict Modal Overlay */}
        {conflictInfo && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-[#252525] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto ring-1 ring-yellow-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-2">{t('editor.binding.conflict_title', language)}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  <span className="font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded mx-1">{conflictInfo.binding.key}</span>
                  {t('editor.binding.conflict_msg', language)}
                  <span className="text-blue-400 font-bold mx-1">{conflictInfo.label}</span>
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setBindingData(conflictInfo.binding);
                    setAssignedKey(`Key: ${conflictInfo.binding.key}`);
                    setConflictInfo(null);
                  }}
                  className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm font-bold transition-colors border border-white/5"
                >
                  {t('editor.binding.apply_anyway', language)}
                </button>
                <button
                  onClick={() => {
                    if (onStealBinding) onStealBinding(conflictInfo.index);
                    setBindingData(conflictInfo.binding);
                    setAssignedKey(`Key: ${conflictInfo.binding.key}`);
                    setConflictInfo(null);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
                >
                  {t('editor.binding.remove_other', language)}
                </button>
                <button
                  onClick={() => setConflictInfo(null)}
                  className="w-full py-2 text-zinc-500 hover:text-white text-sm font-medium transition-colors"
                >
                  {t('editor.footer.cancel', language)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* General Alert/Confirm Modal */}
        {modal.show && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-[#252525] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${modal.type === 'confirm' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                {modal.type === 'confirm' ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{modal.title}</h3>
                <p className="text-zinc-400 text-sm mt-1">{modal.message}</p>
              </div>
              <div className="flex gap-3 justify-center mt-6">
                {modal.type === 'confirm' && (
                  <button
                    onClick={() => setModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {t('profiles.cancel', language)}
                  </button>
                )}
                <button
                  onClick={modal.onConfirm}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${modal.type === 'confirm' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}`}
                >
                  {modal.type === 'confirm' ? t('editor.footer.delete_button', language) : 'OK'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#252525]">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            {t('editor.edit_button', language)} <span className="text-blue-500">#{buttonIndex + 1}</span>
          </h2>
          <button onClick={handleClose} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6 18 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-16 md:w-48 bg-[#181818] border-r border-white/5 p-2 md:p-4 space-y-2 shrink-0">
            {[
              { id: 'appearance', label: t('editor.tabs.appearance', language) },
              { id: 'actions', label: t('editor.tabs.actions', language) },
              { id: 'binding', label: t('editor.tabs.binding', language) },
              { id: 'settings', label: t('editor.tabs.settings', language) }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-center md:text-left px-2 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${activeTab === tab.id ? 'font-bold border' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                style={activeTab === tab.id ? { backgroundColor: `${accentColor}15`, color: accentColor, borderColor: `${accentColor}40` } : {}}
              >
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.label.substring(0, 2)}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className={`flex-1 p-4 md:p-6 ${activeTab === 'actions' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>

            {/* --- GÖRÜNÜM TAB --- */}
            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('editor.appearance.button_title', language)}</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-700"
                    placeholder={language === 'tr' ? 'Örn: OBS Sahne 1' : 'e.g. OBS Scene 1'}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('editor.appearance.bg_color', language)}</label>
                  <div className="flex gap-3 flex-wrap items-center">
                    {['#2a2a2a', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setBgColor(color)}
                        className={`w-10 h-10 rounded-lg border-2 transition-all shadow-lg cursor-pointer ${bgColor.toLowerCase() === color.toLowerCase() ? 'border-white scale-110 shadow-white/20' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}

                    {/* Custom Color Picker & Input */}
                    <div className="flex items-center gap-2 ml-2 pl-4 border-l border-white/10">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-white/10 hover:border-white/20 transition-all shadow-lg group">
                        <input 
                          type="color" 
                          value={bgColor.startsWith('#') && bgColor.length === 7 ? bgColor : '#2a2a2a'} 
                          onChange={(e) => setBgColor(e.target.value)}
                          className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer bg-transparent border-none"
                        />
                      </div>
                      <input 
                        type="text"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        placeholder="#HEX or rgb()"
                        className="bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white w-32 focus:border-blue-500/50 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between h-[34px]">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('editor.appearance.bg_image', language)}</label>
                      {bgImage && (
                        <button onClick={() => setBgImage(null)} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">{t('editor.appearance.remove', language)}</button>
                      )}
                    </div>
                    <div onClick={() => bgFileInputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-zinc-500 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer group relative overflow-hidden h-60">
                      <input type="file" ref={bgFileInputRef} className="hidden" accept="image/*" onChange={handleBgImageUpload} />
                      {bgImage ? (
                        <>
                          <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${bgImage})` }} />
                          <span className="relative z-10 text-xs font-medium text-white drop-shadow-md">{t('editor.appearance.change_image', language)}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 mb-2 group-hover:text-zinc-300 transition-colors" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          <span className="text-xs font-medium">{t('editor.appearance.select_image', language)}</span>
                        </>
                      )}
                    </div>
                  </div>

                    <div className="space-y-3">
                    <div className="flex items-center justify-between h-[34px]">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('editor.appearance.icon_selection', language)}</label>
                      <div className="flex bg-[#121212] rounded-lg p-1 border border-white/5">
                        <button type="button" onClick={() => setIconType('none')} className={`px-2 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${iconType === 'none' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t('editor.appearance.none', language)}</button>
                        <button type="button" onClick={() => setIconType('lucide')} className={`px-2 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${iconType === 'lucide' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>{t('editor.appearance.lucide', language)}</button>
                        <button type="button" onClick={() => setIconType('plugin')} className={`px-2 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${iconType === 'plugin' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>{t('editor.appearance.plugin_icons', language)}</button>
                        <button type="button" onClick={() => setIconType('emoji')} className={`px-2 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${iconType === 'emoji' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t('editor.appearance.emoji', language)}</button>
                        <button type="button" onClick={() => setIconType('image')} className={`px-2 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${iconType === 'image' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t('editor.appearance.image', language)}</button>
                      </div>
                    </div>

                    {iconType === 'plugin' ? (
                      <div className="bg-[#121212] p-3 rounded-xl border border-white/5 h-60 flex flex-col gap-2.5">
                        {/* Arama ve Kategori Filtresi */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              placeholder={t('editor.appearance.search_plugin_icons', language)}
                              value={pluginIconSearch}
                              onChange={(e) => setPluginIconSearch(e.target.value)}
                              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                            />
                            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                          </div>

                          <select
                            value={selectedPluginCategory}
                            onChange={(e) => setSelectedPluginCategory(e.target.value)}
                            className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500/50 cursor-pointer max-w-[130px] truncate"
                          >
                            <option value="all">{t('editor.appearance.all_plugins', language)}</option>
                            {pluginCategories.filter(c => c !== 'all').map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {/* Plugin İkon Grid */}
                        {filteredPluginIcons.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                            <span className="text-xs">{t('editor.appearance.no_plugin_icons', language)}</span>
                          </div>
                        ) : (
                          <div className="flex-1 grid grid-cols-6 gap-2 overflow-y-auto content-start pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                            {filteredPluginIcons.map((item) => {
                              const isSelected = selectedPluginIcon?.id === item.id || selectedPluginIcon === item.src;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setSelectedPluginIcon(item.src || item.svg || item)}
                                  title={`${item.pluginName} - ${item.name}`}
                                  className={`aspect-square flex flex-col items-center justify-center p-2 rounded-lg transition-all cursor-pointer group ${
                                    isSelected 
                                      ? 'border shadow-md scale-105' 
                                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                  }`}
                                  style={isSelected ? { borderColor: accentColor, backgroundColor: `${accentColor}25`, boxShadow: `0 0 10px ${accentColor}30` } : {}}
                                >
                                  {item.svg ? (
                                    <div className="w-7 h-7 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: item.svg }} />
                                  ) : item.src ? (
                                    <img src={item.src} alt={item.name} className="w-7 h-7 object-contain drop-shadow-sm group-hover:scale-110 transition-transform" />
                                  ) : (
                                    <span className="text-xs font-bold text-zinc-400">?</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Bilgi Barı */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-zinc-500 shrink-0">
                          <span className="flex items-center gap-1 text-zinc-400 truncate max-w-[200px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            {selectedPluginIcon ? (typeof selectedPluginIcon === 'object' ? (selectedPluginIcon.name || selectedPluginIcon.id) : 'Custom Icon') : 'None selected'}
                          </span>
                          <span className="text-zinc-500">
                            {filteredPluginIcons.length} {language === 'tr' ? 'ikon' : 'icons'}
                          </span>
                        </div>
                      </div>
                    ) : iconType === 'lucide' ? (
                      <div className="bg-[#121212] p-3 rounded-xl border border-white/5 h-60 flex flex-col gap-2.5">
                        {/* Arama ve Renk Seçimi */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              placeholder={t('editor.appearance.search_icons', language)}
                              value={lucideSearch}
                              onChange={(e) => setLucideSearch(e.target.value)}
                              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                            />
                            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                          </div>

                          {/* Renk Paleti */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {['#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7'].map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setSelectedLucideColor(c)}
                                className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${selectedLucideColor.toLowerCase() === c.toLowerCase() ? 'scale-125 border-white ring-1 ring-white/50' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                            <div className="relative w-4 h-4 rounded-full overflow-hidden border border-white/20 cursor-pointer">
                              <input
                                type="color"
                                value={selectedLucideColor.startsWith('#') && selectedLucideColor.length === 7 ? selectedLucideColor : '#ffffff'}
                                onChange={(e) => setSelectedLucideColor(e.target.value)}
                                className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer bg-transparent border-none"
                                title={t('editor.appearance.icon_color', language)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Kategori Filtre Butonları */}
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none shrink-0">
                          {getLucideCategories(language).map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setSelectedLucideCategory(cat.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                                selectedLucideCategory === cat.id 
                                  ? 'text-white font-bold shadow-xs' 
                                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                              }`}
                              style={selectedLucideCategory === cat.id ? { backgroundColor: accentColor } : {}}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>

                        {/* İkon Grid */}
                        <div className="flex-1 grid grid-cols-8 gap-2 overflow-y-auto content-start pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                          {filteredLucideIcons.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedLucideIcon(item.id)}
                              title={item.name || item.id}
                              className={`aspect-square flex flex-col items-center justify-center p-1 rounded-lg transition-all cursor-pointer group ${
                                selectedLucideIcon === item.id 
                                  ? 'border shadow-md scale-105' 
                                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
                              }`}
                              style={selectedLucideIcon === item.id ? { borderColor: accentColor, backgroundColor: `${accentColor}25`, boxShadow: `0 0 10px ${accentColor}30` } : {}}
                            >
                              <svg 
                                className="w-5 h-5 transition-transform group-hover:scale-110" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke={selectedLucideIcon === item.id ? selectedLucideColor : '#d4d4d8'} 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                dangerouslySetInnerHTML={{ __html: item.svg }}
                              />
                            </button>
                          ))}
                        </div>

                        {/* Lisans Referansı */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-zinc-500 shrink-0">
                          <span className="flex items-center gap-1 text-zinc-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            {selectedLucideIcon}
                          </span>
                          <span className="text-zinc-500 hover:text-zinc-400 transition-colors">
                            {t('editor.appearance.icon_credit', language)}
                          </span>
                        </div>
                      </div>
                    ) : iconType === 'emoji' ? (
                      <div className="grid grid-cols-8 gap-2 bg-[#121212] p-4 rounded-xl border border-white/5 h-60 overflow-y-auto content-start">
                        {[
                          "🏠", "🎮", "📷", "🎤", "🎧", "🔇", "🔊", "⏯️", "⏹️", "⏺️", "⚙️", "📁", "🌐", "💬", "🔥", "✨", "🚀", "💡", "🔔", "🛑", "⚠️", "✅", "❌", "❤️", "💻", "🖱️", "⌨️", "📱", "🔋", "🔌", "💿", "💾",
                          "🎵", "🎬", "🎨", "🎭", "🎪", "🎫", "🎟️", "🎠", "🎡", "🎢", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖",
                          "🚗", "🚘", "🚙", "🚚", "🚛", "🚜", "🚲", "🛴", "🛵", "🏍️", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "🚁", "🛩️",
                          "✈️", "🛫", "🛬", "🚀", "🛰️", "💺", "🛶", "⛵", "🛥️", "🚤", "🛳️", "⛴️", "🚢", "⚓", "🚧", "⛽", "🚏", "🚦", "🚥", "🗺️", "🗿", "🗽", "⛲", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛱️", "🏖️",
                          "🏝️", "⛰️", "🏔️", "🗻", "🌋", "🏜️", "🏕️", "⛺", "🛤️", "🛣️", "🏗️", "🏭", "🏠", "🏡", "🏘️", "🏚️", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪", "🏫", "🏩", "💒", "🏛️", "⛪", "🕌", "🕍",
                          "🕋", "⛩️", "🗾", "🎑", "🏞️", "🌅", "🌄", "🌠", "🎇", "🎆", "🌇", "🌆", "🏙️", "🌃", "🌌", "🌉", "🌁", "⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿",
                          "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🗑️", "🛢️",
                          "💸", "💵", "💴", "💶", "💷", "💰", "💳", "💎", "⚖️", "🔧", "🔨", "⚒️", "🛠️", "⛏️", "🔩", "⚙️", "⛓️", "🔫", "💣", "🔪", "🗡️", "⚔️", "🛡️", "🚬", "⚰️", "⚱️", "🏺", "🔮", "📿", "🧿", "💈", "⚗️",
                          "🔭", "🔬", "🕳️", "💊", "💉", "🩸", "🩹", "stethoscope", "🌡️", "🏷️", "🔖", "🚽", "🚰", "🚿", "🛁", "🛀", "🔑", "🗝️", "🛋️", "🛏️", "🛌", "🧸", "🖼️", "🛍️", "🛒", "🎁", "🎈", "🎏", "🎀", "🎊",
                          "🎉", "🎎", "🏮", "🎐", "🧧", "✉️", "📩", "📨", "📧", "💌", "📥", "📤", "📦", "🏷️", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃", "📄", "📑", "🧾", "📊", "📈", "📉", "🗒️", "🗓️", "📆", "📅",
                          "📇", "🗃️", "🗳️", "🗄️", "📋", "📁", "📂", "🗂️", "🗞️", "📰", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📖", "🔖", "🔗", "📎", "🖇️", "📐", "📏", "📌", "📍", "✂️", "🖊️", "🖋️", "✒️", "🖌️",
                          "🖍️", "📝", "✏️", "🔍", "🔎", "🔏", "🔐", "🔒", "🔓"
                        ].map((emoji, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedEmoji(emoji)}
                            className={`aspect-square flex items-center justify-center text-2xl rounded-lg transition-all cursor-pointer ${selectedEmoji === emoji ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-white/5'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : iconType === 'image' ? (
                      <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-zinc-500 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer group relative overflow-hidden h-60">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        {selectedImage ? (
                          <img src={selectedImage} alt="Selected" className="absolute inset-0 w-full h-full object-contain p-4" />
                        ) : (
                          <>
                            <svg className="w-10 h-10 mb-4 group-hover:text-zinc-300 transition-colors" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                            <span className="text-sm font-medium">{t('editor.appearance.select_image', language)}</span>
                            <span className="text-xs text-zinc-600 mt-2">{t('editor.appearance.image_hint', language)}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="h-60 flex items-center justify-center text-zinc-600 border border-white/5 rounded-xl bg-[#121212]">
                        <span className="text-sm">{t('editor.appearance.no_icon_msg', language)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- AKSİYONLAR TAB (GENİŞLETİLMİŞ & FERAH TASARIM) --- */}
            {activeTab === 'actions' && (
              <div className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-6 h-full w-full animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-0">

                {/* SOL PANEL - AKSİYON SEÇİMİ (GENİŞLETİLMİŞ COL-SPAN-5) */}
                <div className="col-span-12 md:col-span-5 flex flex-col h-full min-h-0 border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0 md:pr-4">
                  {/* Arama & Filtreleme */}
                  <div className="mb-4 sticky top-0 bg-[#1e1e1e] z-10 pb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('editor.actions.add_action', language)}</h3>
                    </div>

                    {/* Plugin / Kategori Filtre Dropdown */}
                    <div className="relative">
                      <select
                        value={actionPluginFilter}
                        onChange={(e) => setActionPluginFilter(e.target.value)}
                        className="w-full bg-[#141416] border border-white/10 hover:border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer pr-8 font-medium"
                      >
                        <option value="all">{t('editor.actions.filter_all', language)}</option>
                        <option value="builtin">{t('editor.actions.filter_builtin', language)}</option>
                        {plugins && plugins.length > 0 && (
                          <optgroup label={language === 'tr' ? 'Eklentiler' : 'Plugins'}>
                            {plugins.map(p => (
                              <option key={p.identifier || p.name} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>

                    <div className="relative group">
                      <input
                        type="text"
                        placeholder={t('editor.actions.search', language)}
                        value={actionSearch}
                        onChange={(e) => setActionSearch(e.target.value)}
                        className="w-full bg-[#121212] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    </div>
                  </div>

                  {/* Kategorili Liste */}
                  <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    {Object.entries(getGroupedActions()).map(([category, categoryActions]) => (
                      <div key={category} className="space-y-2">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="flex items-center justify-between w-full py-1 text-left group cursor-pointer"
                        >
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-white transition-colors flex items-center gap-1.5">
                            {categoryActions[0]?.isPlugin ? category : t(category, language)}
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/5 text-zinc-500 font-normal">
                              {categoryActions.length}
                            </span>
                          </span>
                          <span className={`text-zinc-500 group-hover:text-zinc-300 transition-transform duration-200 ${collapsedCategories[category] ? '-rotate-90' : 'rotate-0'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                          </span>
                        </button>

                        {!collapsedCategories[category] && (
                          <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-200">
                            {categoryActions.map((type) => (
                              <div
                                key={type.typeKey}
                                draggable={true}
                                onDragStart={(e) => handleDragStartCatalog(e, type.typeKey)}
                                onDragEnd={handleDragEnd}
                                onClick={() => addAction(type.typeKey)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addAction(type.typeKey); } }}
                                className="flex items-center justify-between p-2.5 bg-[#141416] border border-white/5 rounded-xl hover:border-blue-500/40 hover:bg-[#1a1a1f] hover:shadow-md transition-all text-left group/btn cursor-grab active:cursor-grabbing select-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                                  <span className="text-zinc-500 group-hover/btn:text-zinc-300 font-mono text-sm leading-none shrink-0" title="Sürükle">
                                    ⠿
                                  </span>
                                  <div className="w-8 h-8 rounded-lg bg-zinc-800/70 flex items-center justify-center text-lg shrink-0 group-hover/btn:bg-blue-600/20 group-hover/btn:scale-105 transition-all text-white">
                                    {type.icon}
                                  </div>
                                  <div className="truncate">
                                    <div className="text-xs font-medium text-zinc-200 group-hover/btn:text-white truncate">
                                      {type.isPlugin ? type.label : t(type.label, language)}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 truncate">
                                      {type.isPlugin ? category : (type.definitionId || type.typeKey)}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); addAction(type.typeKey); }}
                                  className="w-6 h-6 rounded-md bg-white/5 hover:bg-blue-600 text-zinc-500 hover:text-white flex items-center justify-center shrink-0 transition-all ml-2 cursor-pointer"
                                  title={language === 'tr' ? 'Listeye Ekle' : 'Add to List'}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {Object.keys(getGroupedActions()).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
                        <svg className="w-8 h-8 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <span className="text-xs">{t('editor.actions.no_actions', language)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SAĞ PANEL - SEÇİLEN AKSİYON LİSTESİ (COL-SPAN-7) */}
                <div className="col-span-12 md:col-span-7 flex flex-col h-full min-h-0 w-full gap-3 bg-[#121212] rounded-xl border border-white/5 p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('editor.actions.action_order', language)}</h3>
                    {actions.length > 0 && (
                      <button onClick={() => setActions([])} className="text-[10px] font-medium text-red-400 hover:text-red-300 transition-colors hover:underline cursor-pointer">{t('editor.actions.clear_all', language)}</button>
                    )}
                  </div>

                  {actions.length === 0 ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        if (activeDropTarget !== 'main') setActiveDropTarget('main');
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setActiveDropTarget('main');
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget)) return;
                        if (activeDropTarget === 'main') setActiveDropTarget(null);
                      }}
                      onDrop={handleDropOnMain}
                      className={`flex-1 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${
                        activeDropTarget === 'main'
                          ? 'border-blue-400 bg-blue-500/10 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <svg className={`w-8 h-8 mb-2 transition-transform ${activeDropTarget === 'main' ? 'scale-125 animate-bounce text-blue-400' : 'text-zinc-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 21h8"/>
                      </svg>
                      <span className="text-sm font-medium">{activeDropTarget === 'main' ? t('action_types.IF_CONDITION.drop_zone_hover', language) : t('editor.actions.no_actions', language)}</span>
                      <span className="text-xs mt-1 text-zinc-500">{t('action_types.IF_CONDITION.drag_hint', language)}</span>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        if (activeDropTarget !== 'main') setActiveDropTarget('main');
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setActiveDropTarget('main');
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget)) return;
                        if (activeDropTarget === 'main') setActiveDropTarget(null);
                      }}
                      onDrop={handleDropOnMain}
                      className={`space-y-3 overflow-y-auto pr-2 flex-1 min-h-0 rounded-xl transition-all duration-200 ${
                        activeDropTarget === 'main' ? 'ring-2 ring-blue-500/30 bg-blue-500/[0.02]' : ''
                      }`}
                    >
                      {actions.map((act, idx) => {
                        const actionDef = ACTION_TYPES[act.definitionId];

                        if (!actionDef) {
                          return (
                            <div key={act.id} className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm shrink-0">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-amber-300 truncate">
                                    {t('editor.actions.missing_plugin_title', language)}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 font-mono truncate">
                                    ID: {act.definitionId || act.type || 'Unknown'}
                                  </span>
                                  <span className="text-[10px] text-amber-400/80 leading-tight line-clamp-2 mt-0.5">
                                    {t('editor.actions.missing_plugin_msg', language)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => moveActionUp(idx)} disabled={idx === 0} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg></button>
                                <button onClick={() => moveActionDown(idx)} disabled={idx === actions.length - 1} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></button>
                                <button onClick={() => setActions(actions.filter(a => a.id !== act.id))} className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer" title="Sil"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6 18 18" /></svg></button>
                              </div>
                            </div>
                          );
                        }

                        if (actionDef.isBlock && act.definitionId === 'IF_CONDITION') {
                          return (
                            <div
                              key={act.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStartExisting(e, act.id, null, null, idx)}
                              onDragEnd={handleDragEnd}
                              className="flex flex-col rounded-2xl overflow-hidden border-2 border-amber-500/70 bg-[#151518] shadow-lg transition-all group"
                            >
                              {/* ÜST KOL (TOP SHOULDER OF C-HOOK) */}
                              <div className="bg-[#1c1a16] border-b-2 border-amber-500/60 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className="text-zinc-500 group-hover:text-zinc-300 cursor-grab active:cursor-grabbing font-mono text-sm leading-none shrink-0" title="Sürükle">
                                    ⠿
                                  </span>
                                  <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 text-xs flex items-center justify-center font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-black tracking-wider text-xs uppercase shadow-sm">
                                    {t('action_types.IF_CONDITION.if_keyword', language)}
                                  </span>

                                  {/* Değişken Girişi */}
                                  <div className="flex items-center bg-[#121214] border border-amber-500/30 rounded-lg px-2.5 py-1 focus-within:border-amber-400 shadow-inner">
                                    <span className="text-amber-400 mr-1 text-[11px] font-mono font-bold">$</span>
                                    <input
                                      type="text"
                                      value={act.leftOperand || ''}
                                      onChange={(e) => updateAction(act.id, 'leftOperand', e.target.value)}
                                      placeholder="vol"
                                      className="bg-transparent text-white outline-none w-20 sm:w-24 text-xs font-mono font-semibold"
                                    />
                                  </div>

                                  {/* Koşul Operatörü */}
                                  <div className="relative">
                                    <select
                                      value={act.operator || '=='}
                                      onChange={(e) => updateAction(act.id, 'operator', e.target.value)}
                                      className="bg-[#121214] border border-amber-500/30 hover:border-amber-400 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold outline-none cursor-pointer appearance-none pr-6 shadow-inner"
                                    >
                                      {[
                                        { value: '==', labelKey: 'action_types.operators.eq' },
                                        { value: '!=', labelKey: 'action_types.operators.neq' },
                                        { value: '>', labelKey: 'action_types.operators.gt' },
                                        { value: '<', labelKey: 'action_types.operators.lt' },
                                        { value: '>=', labelKey: 'action_types.operators.gte' },
                                        { value: '<=', labelKey: 'action_types.operators.lte' },
                                        { value: 'contains', labelKey: 'action_types.operators.contains' }
                                      ].map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                          {t(opt.labelKey, language)}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-amber-400">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                  </div>

                                  {/* Karşılaştırma Değeri */}
                                  <div className="flex items-center bg-[#121214] border border-amber-500/30 rounded-lg px-2.5 py-1 focus-within:border-amber-400 shadow-inner">
                                    <input
                                      type="text"
                                      value={act.rightOperand || ''}
                                      onChange={(e) => updateAction(act.id, 'rightOperand', e.target.value)}
                                      placeholder="0"
                                      className="bg-transparent text-white outline-none w-16 sm:w-20 text-xs font-mono font-semibold"
                                    />
                                  </div>

                                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-xs uppercase tracking-wide">
                                    {t('action_types.IF_CONDITION.then_keyword', language)}
                                  </span>
                                </div>

                                {/* Sağ Kontroller */}
                                <div className="flex items-center gap-1 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => updateAction(act.id, 'hasElse', !act.hasElse)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      act.hasElse
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
                                    }`}
                                  >
                                    {act.hasElse ? t('action_types.IF_CONDITION.remove_else', language) : t('action_types.IF_CONDITION.enable_else', language)}
                                  </button>
                                  <button onClick={() => moveActionUp(idx)} disabled={idx === 0} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg></button>
                                  <button onClick={() => moveActionDown(idx)} disabled={idx === actions.length - 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></button>
                                  <button onClick={() => duplicateAction(act)} className="p-1 text-zinc-400 hover:text-blue-400 transition-colors cursor-pointer" title="Çoğalt"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg></button>
                                  <button onClick={() => setActions(actions.filter(a => a.id !== act.id))} className="p-1 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer" title="Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="M6 6 18 18" /></svg></button>
                                </div>
                              </div>

                              {/* BİRİNCİ KANCA AĞZI: THEN / İSE DALI */}
                              {renderNestedSlot(act, 'thenActions', {
                                spineColor: 'border-amber-500',
                                bgCavity: 'bg-amber-500/[0.04]',
                                borderHover: 'border-amber-400',
                                bgActive: 'bg-amber-500/20',
                                glowColor: 'rgba(245,158,11,0.3)',
                                emptyHint: t('action_types.IF_CONDITION.empty_then', language)
                              })}

                              {/* ORTA KOL: DEĞİLSE / ELSE (varsa) */}
                              {act.hasElse && (
                                <>
                                  <div className="bg-[#1c1a16] border-y-2 border-amber-500/60 p-2 sm:p-2.5 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-black font-black tracking-wider text-xs uppercase shadow-sm">
                                        {t('action_types.IF_CONDITION.else_keyword', language)}
                                      </span>
                                      <span className="text-zinc-400 text-xs">
                                        ({t('action_types.IF_CONDITION.is_not_met', language)})
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateAction(act.id, 'hasElse', false)}
                                      className="text-[11px] text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                                    >
                                      {t('action_types.IF_CONDITION.remove_else', language)}
                                    </button>
                                  </div>

                                  {/* İKİNCİ KANCA AĞZI: ELSE DALI */}
                                  {renderNestedSlot(act, 'elseActions', {
                                    spineColor: 'border-amber-500',
                                    bgCavity: 'bg-amber-500/[0.03]',
                                    borderHover: 'border-amber-400',
                                    bgActive: 'bg-amber-500/20',
                                    glowColor: 'rgba(245,158,11,0.3)',
                                    emptyHint: t('action_types.IF_CONDITION.empty_else', language)
                                  })}
                                </>
                              )}

                              {/* ALT TABAN KAPANISI (BOTTOM CAP OF C-HOOK) */}
                              <div className="bg-[#121214] border-t-2 border-amber-500/60 py-1.5 px-4 flex items-center justify-between text-[11px] font-mono text-amber-400/80">
                                <span className="flex items-center gap-1.5">
                                  <span>└──</span>
                                  <span className="font-bold tracking-wider">{t('action_types.IF_CONDITION.end_if', language)}</span>
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {(act.thenActions?.length || 0) + (act.hasElse ? (act.elseActions?.length || 0) : 0)} {language === 'tr' ? 'alt eylem' : 'sub-actions'}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        if (actionDef.isBlock && act.definitionId === 'LOOP_REPEAT') {
                          return (
                            <div
                              key={act.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStartExisting(e, act.id, null, null, idx)}
                              onDragEnd={handleDragEnd}
                              className="flex flex-col rounded-2xl overflow-hidden border-2 border-blue-500/70 bg-[#13151b] shadow-lg transition-all group"
                            >
                              {/* ÜST KOL (TOP SHOULDER OF LOOP C-HOOK) */}
                              <div className="bg-[#131924] border-b-2 border-blue-500/60 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className="text-zinc-500 group-hover:text-zinc-300 cursor-grab active:cursor-grabbing font-mono text-sm leading-none shrink-0" title="Sürükle">
                                    ⠿
                                  </span>
                                  <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-300 text-xs flex items-center justify-center font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="px-2.5 py-1 rounded-lg bg-blue-500 text-white font-black tracking-wider text-xs uppercase shadow-sm">
                                    {t('action_types.LOOP_REPEAT.loop_keyword', language)}
                                  </span>

                                  {/* Tekrar Sayısı */}
                                  <div className="flex items-center bg-[#101217] border border-blue-500/30 rounded-lg px-2.5 py-1 focus-within:border-blue-400 shadow-inner">
                                    <input
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={act.count !== undefined ? act.count : 3}
                                      onChange={(e) => updateAction(act.id, 'count', parseInt(e.target.value) || 1)}
                                      className="bg-transparent text-white font-bold outline-none w-10 text-xs text-center font-mono"
                                    />
                                    <span className="text-blue-300 text-xs font-semibold ml-1.5">{t('action_types.LOOP_REPEAT.times', language)}</span>
                                  </div>

                                  {/* Gecikme */}
                                  <div className="flex items-center bg-[#101217] border border-blue-500/30 rounded-lg px-2.5 py-1 focus-within:border-blue-400 shadow-inner">
                                    <span className="text-zinc-400 text-xs mr-1.5">{t('action_types.LOOP_REPEAT.delay', language)}:</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={act.delay !== undefined ? act.delay : 100}
                                      onChange={(e) => updateAction(act.id, 'delay', parseInt(e.target.value) || 0)}
                                      className="bg-transparent text-white font-bold outline-none w-12 text-xs text-center font-mono"
                                    />
                                    <span className="text-zinc-400 text-[10px] ml-1">ms</span>
                                  </div>
                                </div>

                                {/* Sağ Kontroller */}
                                <div className="flex items-center gap-1 ml-auto">
                                  <button onClick={() => moveActionUp(idx)} disabled={idx === 0} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg></button>
                                  <button onClick={() => moveActionDown(idx)} disabled={idx === actions.length - 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></button>
                                  <button onClick={() => duplicateAction(act)} className="p-1 text-zinc-400 hover:text-blue-400 transition-colors cursor-pointer" title="Çoğalt"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg></button>
                                  <button onClick={() => setActions(actions.filter(a => a.id !== act.id))} className="p-1 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer" title="Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="M6 6 18 18" /></svg></button>
                                </div>
                              </div>

                              {/* DÖNGÜ KANCA AĞZI: LOOP ACTIONS */}
                              {renderNestedSlot(act, 'loopActions', {
                                spineColor: 'border-blue-500',
                                bgCavity: 'bg-blue-500/[0.04]',
                                borderHover: 'border-blue-400',
                                bgActive: 'bg-blue-500/20',
                                glowColor: 'rgba(59,130,246,0.3)',
                                emptyHint: t('action_types.LOOP_REPEAT.empty_loop', language)
                              })}

                              {/* DÖNGÜ ALT TABAN KAPANISI */}
                              <div className="bg-[#0e1015] border-t-2 border-blue-500/60 py-1.5 px-4 flex items-center justify-between text-[11px] font-mono text-blue-400/80">
                                <span className="flex items-center gap-1.5">
                                  <span>└──</span>
                                  <span className="font-bold tracking-wider">{t('action_types.LOOP_REPEAT.end_loop', language)}</span>
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {act.loopActions?.length || 0} {language === 'tr' ? 'alt eylem' : 'sub-actions'}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={act.id}
                            draggable={true}
                            onDragStart={(e) => handleDragStartExisting(e, act.id, null, null, idx)}
                            onDragEnd={handleDragEnd}
                            className="flex flex-col p-3 bg-[#1e1e1e] border border-white/10 hover:border-white/20 rounded-xl group transition-all shadow-md"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-600 group-hover:text-zinc-400 cursor-grab active:cursor-grabbing font-mono text-sm leading-none" title="Sürükle">
                                  ⠿
                                </span>
                                {actionDef.fields?.length > 0 && (
                                  <button onClick={() => toggleActionExpand(act.id)} className="p-1 cursor-pointer float-left text-zinc-500 hover:text-white transition-colors" title={act.expanded ? 'Küçült' : 'Genişlet'}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${act.expanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
                                  </button>
                                )}
                                <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-400 text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                                <span className="text-sm font-bold text-white flex items-center gap-2">
                                  {actionDef.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{actionDef.icon}</span>}
                                  {actionDef.isPlugin ? act.label : t(act.label, language)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => moveActionUp(idx)} disabled={idx === 0} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg></button>
                                <button onClick={() => moveActionDown(idx)} disabled={idx === actions.length - 1} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></button>
                                <button onClick={() => duplicateAction(act)} className="p-1 text-zinc-500 hover:text-blue-400 transition-colors cursor-pointer" title="Çoğalt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg></button>
                                <button onClick={() => setActions(actions.filter(a => a.id !== act.id))} className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer" title="Sil"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6 18 18" /></svg></button>
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {act.expanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                  animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pl-6 space-y-3">
                                    {actionDef.fields?.map((field, fIdx) => (
                                      <div key={field.key || fIdx}>
                                        {renderFieldInput(act, field, (k, v) => updateAction(act.id, k, v))}
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- BINDING TAB --- */}
            {activeTab === 'binding' && (
              <div className="min-h-full flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col items-center justify-center w-full max-w-md space-y-6 py-8">
                  <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-3xl flex flex-col items-center justify-center border-2 transition-all duration-300 ${isRecording
                    ? 'border-blue-500 bg-blue-500/10 animate-pulse shadow-[0_0_30px_rgba(59,130,246,0.2)]'
                    : assignedKey && assignedKey.startsWith('Key:')
                      ? 'border-green-500 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.2)] scale-105'
                      : 'border-white/10 bg-[#121212]'
                    }`}>
                    {isRecording ? (
                      <>
                        <svg className="w-10 h-10 text-blue-500 animate-spin mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest animate-pulse">{t('editor.binding.waiting', language)}</span>
                      </>
                    ) : assignedKey && assignedKey.startsWith('Key:') ? (
                      <>
                        <span className="text-4xl font-black text-green-400 mb-2 drop-shadow-md">{assignedKey.replace('Key: ', '')}</span>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                          <svg className="w-3 h-3 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">{t('editor.binding.assigned', language)}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-zinc-700">{t('editor.binding.none', language)}</span>
                    )}
                  </div>

                  {!isRecording && bindingData && (
                    <div className="w-full max-w-xs bg-[#121212] rounded-lg border border-white/5 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 font-bold">{t('editor.binding.handler_id', language)}</span>
                        <span className="text-zinc-300 bg-white/5 px-2 py-0.5 rounded">{bindingData.handler}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('editor.binding.hid_path', language)}</span>
                        <p className="text-[10px] text-zinc-400 break-all bg-black/20 p-2 rounded border border-white/5 leading-relaxed">
                          {bindingData.hid}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium text-white">
                      {isRecording ? t('editor.binding.press_key', language) : assignedKey && assignedKey.startsWith('Key:') ? t('editor.binding.key_defined', language) : t('editor.binding.key_combo', language)}
                    </h3>
                    <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                      {isRecording
                        ? t('editor.binding.desc_recording', language)
                        : assignedKey && assignedKey.startsWith('Key:')
                          ? t('editor.binding.desc_assigned', language)
                          : t('editor.binding.desc_default', language)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handleRecordingToggle}
                      className={`px-8 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${isRecording ? 'bg-red-500/10 text-red-500 border border-red-500/50' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'}`}
                    >
                      {isRecording ? t('editor.binding.cancel', language) : t('editor.binding.start_rec', language)}
                    </button>

                    {!isRecording && (bindingData || assignedKey) && (
                      <button
                        onClick={handleRemoveBinding}
                        className="px-6 py-3 rounded-xl font-bold text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6 18 18"/></svg>
                        {t('editor.binding.remove', language)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- AYARLAR TAB --- */}
            {activeTab === 'settings' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between p-4 bg-[#121212] rounded-xl border border-white/5">
                  <div>
                    <h4 className="text-sm font-medium text-white">{t('editor.settings.show_title', language)}</h4>
                    <p className="text-xs text-zinc-500">{t('editor.settings.show_title_desc', language)}</p>
                  </div>
                  <button
                    onClick={() => setShowTitle(!showTitle)}
                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${showTitle ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${showTitle ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#121212] rounded-xl border border-white/5">
                  <div>
                    <h4 className="text-sm font-medium text-white">{t('editor.settings.haptic', language)}</h4>
                    <p className="text-xs text-zinc-500">{t('editor.settings.haptic_desc', language)}</p>
                  </div>
                  <button
                    onClick={() => setHapticFeedback(!hapticFeedback)}
                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${hapticFeedback ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${hapticFeedback ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                {/* Ses Geri Bildirimi & Özel Ses */}
                <div className="p-4 bg-[#121212] rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">{t('editor.settings.sound', language)}</h4>
                      <p className="text-xs text-zinc-500">{t('editor.settings.sound_desc', language)}</p>
                    </div>
                    <button
                      onClick={() => setSoundFeedback(!soundFeedback)}
                      className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${soundFeedback ? 'bg-blue-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${soundFeedback ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {soundFeedback && (
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-400">{t('editor.settings.custom_sound', language)}</span>
                        {customSound && (
                          <button
                            type="button"
                            onClick={() => setCustomSound('')}
                            className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            {language === 'tr' ? 'Varsayılana Sıfırla' : 'Reset to Default'}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={customSound}
                          onChange={(e) => setCustomSound(e.target.value)}
                          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer truncate"
                        >
                          <option value="">{t('editor.settings.default_sound_opt', language)} ({settings?.selectedSound || 'click.wav'})</option>
                          {customSounds && customSounds.map((snd) => (
                            <option key={snd} value={snd}>{snd}</option>
                          ))}
                          {customSound && !customSounds?.includes(customSound) && (
                            <option value={customSound}>{customSound.split(/[\\/]/).pop()}</option>
                          )}
                        </select>

                        <button
                          type="button"
                          onClick={handleCustomSoundSelect}
                          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 font-medium transition-colors cursor-pointer shrink-0"
                          title={t('editor.settings.browse_sound', language)}
                        >
                          {t('editor.settings.browse_sound', language)}
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePlayPreviewSound(customSound)}
                          className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer shrink-0"
                          title={language === 'tr' ? 'Sesi Dinle' : 'Test Sound'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Eklenti Canlı Durum İkonları (Toggle) */}
                <div className="flex items-center justify-between p-4 bg-[#121212] rounded-xl border border-white/5">
                  <div>
                    <h4 className="text-sm font-medium text-white">{t('editor.settings.plugin_dynamic_state', language)}</h4>
                    <p className="text-xs text-zinc-500">{t('editor.settings.plugin_dynamic_state_desc', language)}</p>
                  </div>
                  <button
                    onClick={() => setDisableDynamicState(!disableDynamicState)}
                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${!disableDynamicState ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${!disableDynamicState ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#121212] rounded-xl border border-white/5">
                  <div>
                    <h4 className="text-sm font-medium text-white">{t('editor.settings.text_align', language)}</h4>
                    <p className="text-xs text-zinc-500">{t('editor.settings.text_align_desc', language)}</p>
                  </div>
                  <div className="flex bg-black/20 rounded-lg p-1 border border-white/5">
                    {['top', 'center', 'bottom'].map(align => (
                      <button key={align} onClick={() => setTextAlignment(align)} className={`p-2 rounded-md transition-all cursor-pointer ${textAlignment === align ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`} title={align}>
                        {align === 'top' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><path d="M3 3h18" /></svg>}
                        {align === 'center' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><path d="M3 12h18" /></svg>}
                        {align === 'bottom' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><path d="M3 21h18" /></svg>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#121212] rounded-xl border border-white/5">
                  <div>
                    <h4 className="text-sm font-medium text-white">{t('editor.settings.text_size', language)}</h4>
                    <p className="text-xs text-zinc-500">{t('editor.settings.text_size_desc', language)}</p>
                  </div>
                  <div className="flex bg-black/20 rounded-lg p-1 border border-white/5">
                    {['small', 'normal', 'large'].map(size => (
                      <button key={size} onClick={() => setTextSize(size)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${textSize === size ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>{size === 'small' ? 'S' : size === 'normal' ? 'M' : 'L'}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 border-t border-white/5 bg-[#252525] flex items-center justify-between px-6">
          <div>
            {initialData && (
              <button
                onClick={() => {
                  setModal({
                    show: true,
                    type: 'confirm',
                    title: t('editor.footer.delete_button', language),
                    message: t('editor.footer.delete_confirm', language),
                    onConfirm: () => {
                      onSave(null);
                      onClose();
                      setModal(prev => ({ ...prev, show: false }));
                    }
                  });
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                {t('editor.footer.delete_button', language)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              {t('editor.footer.cancel', language)}
            </button>
            <button onClick={() => { onSave({ label, bgColor, bgImage, iconType, selectedEmoji, selectedLucideIcon, selectedLucideColor, selectedPluginIcon, selectedImage, actions, binding: bindingData, showTitle, hapticFeedback, soundFeedback, customSound, disableDynamicState, textAlignment, textSize }); handleClose(); }} className="px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-all cursor-pointer hover:brightness-110" style={{ backgroundColor: accentColor }}>
              {t('editor.footer.save', language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}