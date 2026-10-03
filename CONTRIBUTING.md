# Contributing to IsuDeck

Thank you for your interest in contributing to **IsuDeck by rootcf**! We welcome bug reports, feature requests, plugin additions, and code contributions from the community.

---

## 🛠️ Development Setup

### Prerequisites
- **Windows 10 / 11 (64-bit)**
- **Rust toolchain:** `rustup default stable-x86_64-pc-windows-msvc`
- **Node.js:** v18+ or v20+ with npm
- **C++ Build Tools:** Visual Studio 2022 Build Tools (C++ development workload)

### Clone & Install
```bash
git clone https://github.com/muzmahil/IsuDeck.git
cd IsuDeck/isu-deck-ui
npm install
```

### Running in Development
```bash
# In isu-deck-ui directory:
npm run tauri dev
```

---

## 🏗️ Project Architecture

- **`isu-deck-ui/src-tauri/`**: Rust backend engine, input capture thread (`interception.rs`), macro execution engine (`action_runner.rs`), and plugin supervisor (`plugin_manager.rs`).
- **`isu-deck-ui/app/`**: Next.js 16 UI with Zustand state management and Tailwind CSS styling.
- **`plugins/`**: Installed official and community plugins.
- **`plugins-source/`**: Source code of built-in plugins (e.g. OBS Studio WebSocket plugin).
- **`examples/plugins/`**: Reference implementations for one-shot and daemon plugins (Python, Node.js).
- **`drivers/`**: Low-level kernel interception driver installer.

---

## 🔌 Developing Plugins

If you want to contribute a plugin, refer to the [PLUGIN_SDK.md](./PLUGIN_SDK.md) documentation. You can develop plugins in any language using our JSON-RPC stdio protocol.

---

## 📜 Coding Guidelines

- Keep all commit messages descriptive (e.g., `feat: ...`, `fix: ...`).
- Ensure `npm run build` and `cargo check` succeed before opening a pull request.
- Respect the **GNU General Public License v3** under which this project is distributed.
