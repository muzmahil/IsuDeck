# IsuDeck 🎛️

<p align="center">
  <strong>Turn any spare keyboard or numpad into a dedicated, driver-isolated Virtual Stream Deck.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(64--bit)-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Built%20With-Tauri%20v2%20%2B%20Rust-orange?style=flat-square" alt="Rust Tauri">
  <img src="https://img.shields.io/badge/Frontend-Vite%20%2B%20React%2019-646CFF?style=flat-square" alt="Vite + React">
  <img src="https://img.shields.io/badge/RAM%20Usage-%3C%2040%20MB-emerald?style=flat-square" alt="RAM Usage">
  <img src="https://img.shields.io/badge/License-GPL--3.0-purple?style=flat-square" alt="License">
</p>

---

## 💡 What is IsuDeck?

**IsuDeck by rootcf** is a free, open-source desktop application that repurposes any secondary USB keyboard, wireless numpad, or macro keypad into a fully isolated, professional control studio.

While dedicated hardware consoles cost hundreds of dollars and offer limited physical keys, IsuDeck allows you to turn your existing hardware into an unlimited macro console with **zero hardware costs**.

### 🎯 The Core Difference: True Hardware Driver Isolation
By default, Windows merges all attached keyboards into a single input stream. Pressing a key on a secondary keyboard normally sends characters to whatever game, text document, or active window you are currently in.

**IsuDeck solves this at the kernel level using a low-level Interception driver:**
- Keystrokes from your designated secondary keyboard are identified by their unique Hardware ID (HID).
- Those keystrokes are **swallowed at the OS level** before Windows or your games can ever see them.
- Your primary keyboard, gaming controls, and active typing remain 100% uninterrupted.
- Only your designated IsuDeck macro, soundboard effect, or streaming action triggers instantly.

---

## ✨ Key Features

- 🦀 **Ultra-Lightweight Rust & Tauri Core:** Consumes **under 40 MB of RAM** in the background, unlike bloated 500+ MB Electron alternatives. Ensures zero FPS drops during gaming sessions.
- ⚡ **Time-Critical Realtime Capture:** Operates at `THREAD_PRIORITY_TIME_CRITICAL` and `HIGH_PRIORITY_CLASS` with a 1ms Windows multimedia timer (`timeBeginPeriod(1)`) for instantaneous macro triggering under heavy system load.
- 🧠 **Dynamic Logic & Automation Engine:**
  - **Variables:** Store and calculate custom numeric or text state (`SET_VARIABLE`, `CHANGE_VARIABLE`).
  - **System Metrics:** Built-in `$sys.volume`, `$sys.cpu`, `$sys.ram`, and `$sys.time24` readings.
  - **Dynamic Templates:** Render dynamic values on button labels and badges (e.g., `Master: {vol}%`, `CPU: {$sys.cpu}%`).
  - **Windows Volume Sync:** Automatically synchronize custom volume variables with the Windows Master Audio level.
  - **Conditionals & Loops:** Native `If / Else` branching and `Loop` repetition blocks.
- 💡 **Live Status Badges:** Plugins push live updates in real time — OBS Studio displays glowing `LIVE`, `REC`, `MUTE`, or `STUDIO` indicators directly on keys.
- ⌨️ **Unlimited Keys & Layouts:** Switch between 8-key (2x4), 15-key (3x5), 32-key (4x8), or full 104+ key keyboard layouts across unlimited custom profiles.
- 🎨 **Visual Customization:** Browse hundreds of categorized Lucide vector icons, plugin icons, emojis, or upload custom PNG and SVG artwork.
- 🔌 **Open Plugin Architecture:** Multi-language plugin support over JSON-RPC stdio. Create plugins in Python, Node.js, Rust, Go, or C#.
- 📦 **100% Portable:** Clean self-contained deployment with zero Windows registry pollution.

---

## 📊 Comparison

| Metric | Dedicated Hardware Consoles | IsuDeck |
|---|:---:|:---:|
| **Hardware Cost** | \$150 – \$300+ | **\$0** (Any spare keyboard/numpad) |
| **Available Keys** | 6 / 15 / 32 keys (Fixed) | **104+ keys** (Full-size keyboard) |
| **Background RAM** | 200 – 600 MB | **< 40 MB** (Rust + Tauri) |
| **Driver Isolation** | Dedicated hardware required | **Yes** (Kernel input filter) |
| **Software License** | Proprietary | **Free & Open Source (GNU GPL v3)** |

---

## 🏗️ Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Secondary USB Keyboard / Numpad              │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Keystroke
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               Low-Level Interception Kernel Driver              │
│       • Filters by Device HID (Hardware ID)                     │
│       • Swallows keypress (Windows never sees raw input)        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Captured Event
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   IsuDeck Rust Engine (Tauri v2)                │
│       • TIME_CRITICAL thread with 1ms timer precision           │
│       • Logic & Flow Processor (Variables, If/Else, Loops)      │
│       • Plugin Supervisor (JSON-RPC stdio IPC)                  │
└────────────────┬───────────────────────────────┬────────────────┘
                 │ Tauri Events                  │ stdio JSON-RPC
                 ▼                               ▼
┌─────────────────────────────────┐   ┌───────────────────────────┐
│     IsuDeck UI (Vite + React)   │   │     External Plugins      │
│   • Profile & Button Editor     │   │   • OBS Studio (WebSocket)│
│   • Realtime Live State Badges  │   │   • Custom Python/Node/Go │
└─────────────────────────────────┘   └───────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Download & Install Driver
1. Download the latest release from the [Releases](https://github.com/muzmahil/IsuDeck/releases) tab.
2. Launch `IsuDeck.exe`.
3. Open the **Settings** tab on the left sidebar.
4. Under **Hardware Input Driver Status**, click **Install Driver** (requires administrator elevation).
5. **Restart your computer once** to activate the kernel-level input filter.

### 2. Configure Your First Key
1. Plug in your secondary keyboard or numpad.
2. Open IsuDeck and click any button on the grid.
3. Select **Record Key** and press a key on your secondary keyboard.
4. Choose an action (e.g., Open Application, OBS Scene Switch, System Volume, or Custom Macro).
5. Customize the button with Lucide vector icons, colors, or live badges.

---

## 🛠️ Building from Source

### Prerequisites
- **OS:** Windows 10 / 11 (64-bit)
- **Rust:** `rustup default stable-x86_64-pc-windows-msvc`
- **Node.js:** v18+ or v20+ with `npm`
- **C++ Tools:** Visual Studio 2022 C++ Build Tools

### Build Instructions (Windows)
```bash
# 1. Clone repository
git clone https://github.com/muzmahil/IsuDeck.git
cd IsuDeck

# 2. Install frontend dependencies
cd isu-deck-ui
npm install

# 3. Build frontend (Vite)
npm run build

# 4. Build Rust backend
cd src-tauri
cargo build --release
```

---

## 🐧 Linux Quick Install (Single Command)

To install IsuDeck on any Linux system (Ubuntu, Mint, Debian, Fedora, Arch) into `~/IsuDeck` with a terminal command `isudeck` and an applications menu shortcut, run:

```bash
curl -fsSL https://raw.githubusercontent.com/muzmahil/IsuDeck/main/install.sh | bash
```

After installation, manage IsuDeck directly from your terminal:
- **Launch:** `isudeck`
- **Update to Latest Version:** `isudeck update`
- **Uninstall Completely:** `isudeck uninstall`
- **Help:** `isudeck --help`

- **Desktop Shortcut:** Search for **IsuDeck** in your applications menu.
- **Directory:** All configuration, sounds, and plugins live in `~/IsuDeck`.


---

## 📚 Documentation

- 📖 **[USER_GUIDE.md](./USER_GUIDE.md)** — Comprehensive user guide, macro logic, dynamic variables, and troubleshooting.
- 🔌 **[PLUGIN_SDK.md](./PLUGIN_SDK.md)** — Developer guide and JSON-RPC specification for writing custom plugins.
- 🤝 **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Guidelines for contributing code, features, and plugins.
- ⚖️ **[LICENSE.md](./LICENSE.md)** — Full GNU General Public License v3 legal text.

---

## 📄 License & Attribution

**IsuDeck by rootcf**  
Copyright (C) 2026 rootcf.  
This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3** as published by the Free Software Foundation.

See the [LICENSE.md](./LICENSE.md) file for details.
