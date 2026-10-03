# Interactive Counter Node.js Daemon Plugin Example

This plugin demonstrates how to build a full-featured **Live Daemon (`daemon: true`)** plugin for IsuDeck using Node.js / JavaScript.

## Features
- Receives initial configuration via `init` on startup.
- Increments or resets the counter upon key execution.
- Emits `state_update` messages to update button badges in real time.
- Handles `get_data` queries to provide options for dynamic dropdown fields (`dynamic_select`).

## How to Compile to .exe
```bash
npm install -g pkg
pkg counter.js --target node18-win-x64 --output counter.exe
```
or using Bun:
```bash
bun build --compile --outfile counter.exe counter.js
```
Copy the generated `counter.exe`, along with `plugin.json` and `icon.svg`, into `c:\IsuDeck\plugins\NodeCounter\`.
