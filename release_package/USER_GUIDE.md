# IsuDeck User Guide 🎛️

This comprehensive guide explains all features of **IsuDeck**, including initial setup, hardware driver isolation, advanced logic and flow controls, variable bindings, and plugin integrations.

---

## 📑 Table of Contents
1. [What is IsuDeck and How Does it Work?](#1-what-is-isudeck-and-how-does-it-work)
2. [Initial Setup & Driver Configuration](#2-initial-setup--driver-configuration)
3. [Profiles & Grid Layouts](#3-profiles--grid-layouts)
4. [Button Appearance & Customization](#4-button-appearance--customization)
   - [Vector Icons (Lucide)](#vector-icons-lucide)
   - [Plugin Custom Icons](#plugin-custom-icons)
   - [Emojis & Custom Artwork](#emojis--custom-artwork)
5. [Logic & Flow Controls](#5-logic--flow-controls)
   - [Variables Engine](#variables-engine)
   - [System Metrics & Variables ($sys)](#system-metrics--variables-sys)
   - [Dynamic Template Substitution ({vol}% & {$sys.volume}%)](#dynamic-template-substitution-vol--sysvolume)
   - [Windows Master Volume Binding & Step Sync](#windows-master-volume-binding--step-sync)
   - [Conditional Branching (If / Else Logic)](#conditional-branching-if--else-logic)
   - [Loops & Repeat Sequences](#loops--repeat-sequences)
6. [Plugin Ecosystem & OBS Studio Integration](#6-plugin-ecosystem--obs-studio-integration)
7. [Low-Latency Realtime Input Architecture](#7-low-latency-realtime-input-architecture)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. What is IsuDeck and How Does it Work?

**IsuDeck** is an open-source, high-performance desktop application built with Rust and Tauri that turns any spare USB keyboard or numpad into a dedicated, driver-isolated Virtual Stream Deck.

- **Hardware-Level Driver Isolation:** Windows natively merges multiple keyboards into a single input stream. IsuDeck uses a low-level kernel filter driver (Interception) to isolate your secondary keyboard by its unique Hardware ID (HID). Keystrokes are swallowed before reaching Windows applications and games, executing only your assigned macros and actions.
- **Ultra-Lightweight Footprint:** Consumes under 40 MB RAM in the background, ensuring zero frame drops in games.

---

## 2. Initial Setup & Driver Configuration

1. Launch `IsuDeck.exe`.
2. Navigate to the **Settings** tab on the left sidebar.
3. Under **Hardware Input Driver Status**, click **"Install Driver"** and approve administrator privileges.
4. Restart your PC once to activate the kernel-level input filter.
5. Connect your secondary keyboard and begin assigning buttons.

---

## 3. Profiles & Grid Layouts

- **Flexible Grids:** Choose between 8 Keys (2x4), 15 Keys (3x5), or 32 Keys (4x8) grid layouts.
- **Multiple Profiles:** Create unlimited profiles for different games, streaming workflows, or development setups. Switch between them instantly using the `CHANGE_PROFILE` action.
- **Mini Mode & Window Pinning:** Toggle compact mini mode or pin the window to stay always on top while working.

---

## 4. Button Appearance & Customization

Right-click any key on the grid to open the Button Editor.

### Vector Icons (Lucide)
Browse hundreds of vector icons categorized by Media, System, Devices, Streaming, and Tools with customizable icon colors.

### Plugin Custom Icons
Access custom icons bundled by installed plugins (such as OBS Studio scenes, camera controls, audio toggles) under the **Plugin Icons** tab with dedicated category filters.

### Emojis & Custom Artwork
Select from an extensive emoji library or upload custom PNG, JPG, or SVG images with custom button backgrounds and border themes.

---

## 5. Logic & Flow Controls

IsuDeck includes a built-in macro and automation engine that supports dynamic variables, calculations, system bindings, conditional statements, and loops.

### Variables Engine
Store state and manipulate variables on button press:
- `SET_VARIABLE`: Assigns a constant number, string, or evaluated system expression to a variable.
- `CHANGE_VARIABLE`: Increments or decrements a variable by a specific step amount (e.g. `+5` or `-10`) with optional minimum/maximum clamps.

### System Metrics & Variables ($sys)
Read live system metrics in real time:
- `$sys.volume`: Windows master audio level (0-100)
- `$sys.cpu`: Real-time CPU utilization percentage
- `$sys.ram`: Real-time RAM utilization percentage
- `$sys.time24` / `$sys.time12`: Current system time

### Dynamic Template Substitution ({vol}% & {$sys.volume}%)
Use curly braces inside button labels and badges to dynamically render real-time values:
- Button Title: `Master: {vol}%`
- Dynamic Badge: `{$sys.volume}%`

### Windows Master Volume Binding & Step Sync
When configuring `CHANGE_VARIABLE`, enabling **"Sync with Windows Master Volume"** automatically synchronizes Windows system volume with your variable on every keypress (e.g. reducing or increasing master volume by 10% per tap).

### Conditional Branching (If / Else Logic)
Use `IF_CONDITION` to evaluate conditions and execute different actions dynamically:
- **Operators:** `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`
- **Example:** If `vol == 0`, trigger `MUTE`, otherwise set system volume to the current variable value.

### Loops & Repeat Sequences
Use `LOOP_REPEAT` to execute a sequence of actions multiple times with customizable millisecond delays.

---

## 6. Plugin Ecosystem & OBS Studio Integration

IsuDeck features a modular plugin architecture communicating over JSON-RPC stdio:
- **OBS Studio Plugin:** Connects via OBS WebSocket v5 to change scenes, switch preview/program in studio mode, toggle audio source mute, start/stop streams and recordings, and trigger transitions.
- **Dynamic Status Badges:** Plugins can dynamically push live status badges (`LIVE`, `REC`, `MUTE`), volume levels, and border glow effects to buttons in real time.
- **SDK & Documentation:** Refer to **[PLUGIN_SDK.md](./PLUGIN_SDK.md)** for developer instructions on building custom plugins in Rust, Python, C#, or Node.js.

---

## 7. Low-Latency Realtime Input Architecture

To guarantee instantaneous key response under heavy CPU loads or gaming:
- **Time-Critical Capture Thread:** The background input interception thread runs at `THREAD_PRIORITY_TIME_CRITICAL`.
- **High Process Priority:** IsuDeck runs under Windows `HIGH_PRIORITY_CLASS`.
- **1ms Precision Timer:** Activates Windows multimedia timer `timeBeginPeriod(1)` to ensure 1 millisecond response precision.

---

## 8. Troubleshooting & FAQ

### Secondary keyboard still types in Windows?
1. Open **Settings** and ensure the hardware driver status indicates active.
2. Confirm you restarted your computer after driver installation.
3. Verify that the recorded key binding shows a valid Hardware ID (HID).

### OBS Studio plugin is not connecting?
1. In OBS Studio, open **Tools -> WebSocket Server Settings** and ensure the server is enabled on port `4455`.
2. If password authentication is enabled, enter your password in the IsuDeck Plugins configuration panel.

---

## 9. License & Copyright

**IsuDeck by rootcf**  
Copyright (C) 2026 rootcf.  
This software is licensed under the **GNU General Public License v3 (GNU GPL v3)**. For full terms and conditions, refer to [LICENSE.md](./LICENSE.md).

---
*IsuDeck by rootcf — Open Source, Driver-Isolated Virtual Stream Deck.*
