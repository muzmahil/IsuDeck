# System Monitor Daemon Plugin Example

This plugin demonstrates the **Live Daemon (`daemon: true`)** execution model of IsuDeck using Python.

## Execution Model
1. In `plugin.json`, `"daemon": true` is specified.
2. When IsuDeck boots, this plugin starts as a persistent background process.
3. The plugin monitors hardware metrics in the background and sends `state_update` messages over `stdout`.
4. Buttons assigned to CPU and RAM actions display dynamic color-coded badges (e.g. `42%`, `#22c55e`).

## How to Compile to .exe
```bash
pip install pyinstaller psutil
pyinstaller --onefile --noconsole monitor.py
```
Copy the generated `dist/monitor.exe`, along with `plugin.json` and `icon.svg`, into `c:\IsuDeck\plugins\SystemMonitor\`.
