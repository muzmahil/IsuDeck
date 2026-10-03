// ==============================================================================
// IsuDeck Built-in Lucide Vector Icon Catalog
// License: MIT (Lucide Contributors - https://lucide.dev)
// ==============================================================================

export const LUCIDE_ATTRIBUTION = "Icons by Lucide (MIT License - https://lucide.dev)";

export const getLucideCategories = (lang = 'en') => [
  { id: 'all', label: lang === 'tr' ? 'Tümü' : 'All' },
  { id: 'streaming', label: lang === 'tr' ? 'Yayın & Stüdyo' : 'Streaming & Studio' },
  { id: 'media', label: lang === 'tr' ? 'Medya & Ses' : 'Media & Audio' },
  { id: 'hardware', label: lang === 'tr' ? 'Donanım & Cihazlar' : 'Hardware & Devices' },
  { id: 'system', label: lang === 'tr' ? 'Sistem & Windows' : 'System & Windows' },
  { id: 'gaming', label: lang === 'tr' ? 'Oyun & Eğlence' : 'Gaming & Fun' },
  { id: 'office', label: lang === 'tr' ? 'Üretkenlik & Araçlar' : 'Productivity & Apps' },
  { id: 'arrows', label: lang === 'tr' ? 'Yön & Navigasyon' : 'Navigation & UI' }
];

export const LUCIDE_ICON_CATEGORIES = getLucideCategories('en');

export const LUCIDE_ICONS_LIST = [
  // --- STREAMING & STUDIO ---
  { id: 'mic', name: 'Microphone', category: 'streaming', tags: ['mic', 'audio', 'voice', 'sound'], svg: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>' },
  { id: 'mic-off', name: 'Mic Mute', category: 'streaming', tags: ['mic', 'mute', 'silent', 'voice'], svg: '<line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/>' },
  { id: 'video', name: 'Camera', category: 'streaming', tags: ['video', 'webcam', 'stream', 'camera'], svg: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="12" height="12" x="2" y="6" rx="2"/>' },
  { id: 'video-off', name: 'Camera Off', category: 'streaming', tags: ['video', 'webcam', 'off', 'hide'], svg: '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><line x1="2" x2="22" y1="2" y2="22"/>' },
  { id: 'radio', name: 'Live Broadcast', category: 'streaming', tags: ['live', 'radio', 'stream', 'on-air'], svg: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>' },
  { id: 'disc', name: 'Record', category: 'streaming', tags: ['disc', 'record', 'rec', 'save'], svg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>' },
  { id: 'clapperboard', name: 'Clapperboard', category: 'streaming', tags: ['movie', 'scene', 'obs', 'action'], svg: '<path d="M20.2 6 3 11l-.9-3 17.2-5z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>' },
  { id: 'layers', name: 'Scenes & Layers', category: 'streaming', tags: ['scene', 'layer', 'obs', 'sources'], svg: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>' },
  { id: 'cast', name: 'Stream Cast', category: 'streaming', tags: ['cast', 'stream', 'screen', 'share'], svg: '<path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 12a9 9 0 0 1 8 8"/><path d="M2 16a5 5 0 0 1 4 4"/><line x1="2" x2="2.01" y1="20" y2="20"/>' },
  { id: 'sparkles', name: 'Effects / VFX', category: 'streaming', tags: ['effects', 'vfx', 'sparkles', 'magic'], svg: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>' },
  { id: 'airplay', name: 'Airplay / Display', category: 'streaming', tags: ['airplay', 'screen', 'mirror', 'display'], svg: '<path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1"/><polygon points="12 15 17 21 7 21 12 15"/>' },

  // --- MEDIA & AUDIO ---
  { id: 'play', name: 'Play', category: 'media', tags: ['play', 'start', 'music', 'video'], svg: '<polygon points="6 3 20 12 6 21 6 3"/>' },
  { id: 'pause', name: 'Pause', category: 'media', tags: ['pause', 'stop', 'hold'], svg: '<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>' },
  { id: 'square', name: 'Stop', category: 'media', tags: ['stop', 'square', 'end'], svg: '<rect width="18" height="18" x="3" y="3" rx="2"/>' },
  { id: 'play-pause', name: 'Play / Pause', category: 'media', tags: ['play', 'pause', 'toggle'], svg: '<polygon points="5 3 13 8.5 5 14 5 3"/><line x1="16" x2="16" y1="3" y2="14"/><line x1="20" x2="20" y1="3" y2="14"/>' },
  { id: 'skip-forward', name: 'Next Track', category: 'media', tags: ['next', 'skip', 'forward'], svg: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>' },
  { id: 'skip-back', name: 'Previous Track', category: 'media', tags: ['prev', 'back', 'skip'], svg: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>' },
  { id: 'volume-2', name: 'Volume High', category: 'media', tags: ['volume', 'loud', 'audio', 'sound'], svg: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' },
  { id: 'volume-1', name: 'Volume Low', category: 'media', tags: ['volume', 'quiet', 'audio'], svg: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' },
  { id: 'volume-x', name: 'Mute', category: 'media', tags: ['mute', 'silent', 'no audio'], svg: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>' },
  { id: 'music', name: 'Music', category: 'media', tags: ['music', 'song', 'spotify', 'audio'], svg: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  { id: 'music-2', name: 'Musical Note', category: 'media', tags: ['note', 'song', 'sound'], svg: '<circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/>' },
  { id: 'headphones', name: 'Headphones', category: 'media', tags: ['headset', 'audio', 'listen'], svg: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>' },
  { id: 'speaker', name: 'Speaker', category: 'media', tags: ['speaker', 'audio', 'output'], svg: '<rect width="16" height="20" x="4" y="2" rx="2"/><circle cx="12" cy="14" r="4"/><line x1="12" x2="12.01" y1="6" y2="6"/>' },
  { id: 'repeat', name: 'Repeat', category: 'media', tags: ['repeat', 'loop', 'song'], svg: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>' },
  { id: 'shuffle', name: 'Shuffle', category: 'media', tags: ['shuffle', 'random', 'music'], svg: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.5-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>' },

  // --- HARDWARE & DEVICES ---
  { id: 'keyboard', name: 'Keyboard', category: 'hardware', tags: ['keyboard', 'numpad', 'input', 'deck'], svg: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M6 12h.001"/><path d="M10 12h.001"/><path d="M14 12h.001"/><path d="M18 12h.001"/><path d="M7 16h10"/>' },
  { id: 'mouse', name: 'Mouse', category: 'hardware', tags: ['mouse', 'click', 'cursor'], svg: '<rect width="14" height="20" x="5" y="2" rx="7"/><path d="M12 6v4"/>' },
  { id: 'monitor', name: 'Monitor', category: 'hardware', tags: ['screen', 'display', 'desktop'], svg: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>' },
  { id: 'smartphone', name: 'Mobile / Phone', category: 'hardware', tags: ['phone', 'mobile', 'android', 'ios'], svg: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>' },
  { id: 'hard-drive', name: 'Hard Drive', category: 'hardware', tags: ['disk', 'storage', 'ssd'], svg: '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>' },
  { id: 'cpu', name: 'Processor / CPU', category: 'hardware', tags: ['cpu', 'chip', 'system', 'processor'], svg: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>' },
  { id: 'gamepad-2', name: 'Gamepad / Controller', category: 'gaming', tags: ['game', 'gamepad', 'joystick', 'play'], svg: '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>' },
  { id: 'battery-charging', name: 'Battery', category: 'hardware', tags: ['battery', 'charge', 'power'], svg: '<path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><path d="M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1"/><path d="m11 7-3 5h4l-3 5"/><line x1="22" x2="22" y1="11" y2="13"/>' },
  { id: 'wifi', name: 'Wi-Fi / Network', category: 'hardware', tags: ['wifi', 'network', 'internet', 'wireless'], svg: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>' },
  { id: 'bluetooth', name: 'Bluetooth', category: 'hardware', tags: ['bluetooth', 'device', 'wireless'], svg: '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>' },
  { id: 'usb', name: 'USB Device', category: 'hardware', tags: ['usb', 'port', 'drive'], svg: '<circle cx="10" cy="7" r="1"/><circle cx="4" cy="20" r="1"/><path d="M4.7 19.3 19 5"/><path d="m21 3-3 1 2 2Z"/><circle cx="17" cy="14" r="1"/><path d="m14 17 3-3"/><path d="m7 14-3-3"/>' },

  // --- SYSTEM & WINDOWS ---
  { id: 'power', name: 'Power / Shutdown', category: 'system', tags: ['power', 'off', 'shutdown'], svg: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>' },
  { id: 'lock', name: 'Lock', category: 'system', tags: ['lock', 'security', 'password', 'protect'], svg: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
  { id: 'unlock', name: 'Unlock', category: 'system', tags: ['unlock', 'open'], svg: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>' },
  { id: 'camera', name: 'Screenshot', category: 'system', tags: ['camera', 'screenshot', 'capture', 'snip'], svg: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>' },
  { id: 'clipboard', name: 'Clipboard History', category: 'system', tags: ['clipboard', 'copy', 'paste', 'history'], svg: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' },
  { id: 'terminal', name: 'Terminal / CMD', category: 'system', tags: ['terminal', 'cmd', 'powershell', 'code', 'command'], svg: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>' },
  { id: 'settings', name: 'Settings', category: 'system', tags: ['settings', 'config', 'gear', 'tools'], svg: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
  { id: 'refresh-cw', name: 'Refresh / Reload', category: 'system', tags: ['refresh', 'reload', 'sync'], svg: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>' },
  { id: 'sliders', name: 'Sliders / Mix', category: 'system', tags: ['slider', 'fader', 'equalizer', 'volume'], svg: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>' },
  { id: 'bell', name: 'Notification', category: 'system', tags: ['bell', 'alert', 'notify'], svg: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' },
  { id: 'sun', name: 'Brightness High', category: 'system', tags: ['sun', 'bright', 'light'], svg: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>' },
  { id: 'moon', name: 'Dark Mode / Sleep', category: 'system', tags: ['moon', 'dark', 'night', 'sleep'], svg: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>' },
  { id: 'shield', name: 'Security / Shield', category: 'system', tags: ['shield', 'security', 'antivirus', 'safe'], svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>' },
  { id: 'clock', name: 'Clock / Timer', category: 'system', tags: ['clock', 'time', 'timer', 'alarm'], svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
  { id: 'trash-2', name: 'Recycle Bin', category: 'system', tags: ['trash', 'delete', 'bin', 'clean'], svg: '<path d="3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>' },

  // --- PRODUCTIVITY & APPS ---
  { id: 'folder', name: 'Folder', category: 'office', tags: ['folder', 'directory', 'explorer', 'files'], svg: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' },
  { id: 'folder-open', name: 'Open Folder', category: 'office', tags: ['folder', 'open', 'explorer'], svg: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>' },
  { id: 'globe', name: 'Browser / Web', category: 'office', tags: ['globe', 'web', 'internet', 'url', 'site'], svg: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>' },
  { id: 'link', name: 'Link / URL', category: 'office', tags: ['link', 'url', 'hyperlink'], svg: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
  { id: 'file-text', name: 'Document / Text', category: 'office', tags: ['file', 'text', 'doc', 'macro', 'notes'], svg: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>' },
  { id: 'message-square', name: 'Chat / Discord', category: 'office', tags: ['chat', 'message', 'discord', 'talk'], svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  { id: 'mail', name: 'Mail', category: 'office', tags: ['mail', 'email', 'message'], svg: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>' },
  { id: 'calculator', name: 'Calculator', category: 'office', tags: ['calc', 'math', 'numbers'], svg: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>' },
  { id: 'calendar', name: 'Calendar / Schedule', category: 'office', tags: ['calendar', 'date', 'schedule', 'event'], svg: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>' },
  { id: 'check-circle-2', name: 'Checkmark / Done', category: 'office', tags: ['check', 'done', 'success', 'ok'], svg: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>' },
  { id: 'bookmark', name: 'Bookmark', category: 'office', tags: ['bookmark', 'save', 'favorite'], svg: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>' },
  { id: 'download', name: 'Download', category: 'office', tags: ['download', 'save', 'get'], svg: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>' },
  { id: 'upload', name: 'Upload', category: 'office', tags: ['upload', 'send', 'file'], svg: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>' },
  { id: 'save', name: 'Save / Floppy', category: 'office', tags: ['save', 'disk', 'store'], svg: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>' },

  // --- GAMING & FUN ---
  { id: 'zap', name: 'Flash / Lightning', category: 'gaming', tags: ['zap', 'flash', 'macro', 'quick', 'energy'], svg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { id: 'flame', name: 'Flame / Fire', category: 'gaming', tags: ['fire', 'flame', 'hot', 'streak'], svg: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>' },
  { id: 'star', name: 'Star', category: 'gaming', tags: ['star', 'favorite', 'badge', 'rating'], svg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  { id: 'heart', name: 'Heart', category: 'gaming', tags: ['heart', 'love', 'like'], svg: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' },
  { id: 'trophy', name: 'Trophy / Win', category: 'gaming', tags: ['trophy', 'win', 'reward', 'first'], svg: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M18 4H6v7a6 6 0 0 0 12 0V4Z"/>' },
  { id: 'crown', name: 'Crown / Leader', category: 'gaming', tags: ['crown', 'king', 'leader', 'vip'], svg: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>' },
  { id: 'swords', name: 'Crossed Swords', category: 'gaming', tags: ['sword', 'battle', 'pvp', 'fight'], svg: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>' },
  { id: 'dice-5', name: 'Dice / RNG', category: 'gaming', tags: ['dice', 'random', 'rng', 'game'], svg: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>' },
  { id: 'crosshair', name: 'Crosshair / Aim', category: 'gaming', tags: ['aim', 'target', 'crosshair', 'fps'], svg: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>' },
  { id: 'skull', name: 'Skull', category: 'gaming', tags: ['skull', 'death', 'hardcore'], svg: '<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>' },

  // --- NAVIGATION & UI ---
  { id: 'arrow-left', name: 'Arrow Left / Back', category: 'arrows', tags: ['arrow', 'left', 'back'], svg: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>' },
  { id: 'arrow-right', name: 'Arrow Right', category: 'arrows', tags: ['arrow', 'right', 'next'], svg: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' },
  { id: 'arrow-up', name: 'Arrow Up', category: 'arrows', tags: ['arrow', 'up'], svg: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>' },
  { id: 'arrow-down', name: 'Arrow Down', category: 'arrows', tags: ['arrow', 'down'], svg: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>' },
  { id: 'chevron-left', name: 'Chevron Left', category: 'arrows', tags: ['chevron', 'left'], svg: '<path d="m15 18-6-6 6-6"/>' },
  { id: 'chevron-right', name: 'Chevron Right', category: 'arrows', tags: ['chevron', 'right'], svg: '<path d="m9 18 6-6-6-6"/>' },
  { id: 'corner-up-left', name: 'Return / Back', category: 'arrows', tags: ['back', 'return', 'exit'], svg: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>' },
  { id: 'pin', name: 'Pin / Always on Top', category: 'arrows', tags: ['pin', 'stay', 'top', 'lock'], svg: '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>' },
  { id: 'home', name: 'Home Deck', category: 'arrows', tags: ['home', 'main', 'deck', 'dashboard'], svg: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { id: 'grid', name: 'Grid Layout', category: 'arrows', tags: ['grid', 'layout', 'deck'], svg: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>' },
  { id: 'eye', name: 'Show / Visibility', category: 'arrows', tags: ['eye', 'view', 'show', 'visible'], svg: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' },
  { id: 'eye-off', name: 'Hide / Hidden', category: 'arrows', tags: ['eye', 'hide', 'hidden', 'invisible'], svg: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>' }
];

export const LUCIDE_ICONS = Object.fromEntries(
  LUCIDE_ICONS_LIST.map(icon => [icon.id, icon])
);

export default LUCIDE_ICONS;

