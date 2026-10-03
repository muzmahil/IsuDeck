# IsuDeck Plugin Developer Guide (Plugin SDK)

IsuDeck uses an **isolated child-process plugin architecture**. This keeps the core application ultra-lightweight, fast, and crash-resilient while enabling integration with third-party software and hardware (OBS Studio, Spotify, Discord, Philips Hue, Home Assistant, Voicemeeter, Webhooks, custom services, etc.).

**You do NOT need to install any heavy SDK or third-party packages.** You can develop an IsuDeck plugin in any programming language (Python, Node.js / JavaScript, C#, Rust, Go, C++, PowerShell, Batch) using standard CLI arguments or simple line-by-line `stdin`/`stdout` JSON messaging.

---

## 1. Architecture and Execution Modes

IsuDeck plugins operate in one of two execution modes:

```text
                                  +-----------------------+
                                  |   IsuDeck Core Engine |
                                  +-----------------------+
                                      │               ▲
          ┌───────────────────────────┴───────────────┴───────────────────────────┐
          │ (daemon: false / One-Shot)                                             │ (daemon: true / Daemon)
          ▼                                                                        ▼
┌──────────────────────────────────────────────┐        ┌────────────────────────────────────────────────────────┐
│            One-Shot Plugin (On-Demand)       │        │                  Live Daemon Plugin                    │
│ - Idle RAM Usage: 0 MB                       │        │ - RAM Usage: Process-dependent (~10-25 MB)             │
│ - Spawned ONLY when the user presses a key   │        │ - Starts with IsuDeck, stays running in the background │
│ - CLI Arguments: --action <name> --args <json│        │ - Bi-directional line-delimited JSON-RPC (stdio)       │
│ - Best for: Webhooks, Quick Commands, Alerts │        │ - Live button state & badge push (state_update)        │
│                                              │        │ - Best for: OBS WebSocket, Spotify, Hardware Monitors  │
└──────────────────────────────────────────────┘        └────────────────────────────────────────────────────────┘
```

---

## 2. Plugin Directory Structure

Each plugin lives inside its own folder under the IsuDeck `plugins/` directory:

```text
plugins/
└── IsuDeck.DiscordWebhook/
    ├── plugin.json         # (Required) Manifest containing identity, mode (daemon), config and actions
    ├── webhook.exe         # (Required) Standalone executable (.exe)
    ├── icon.svg            # (Recommended) Plugin icon (SVG or PNG)
    ├── config.json         # (Auto-generated) User-configured values and enabled/disabled state
    └── README.md           # (Recommended) Documentation and setup guide
```

---

## 3. Manifest Specification: `plugin.json`

IsuDeck reads `plugin.json` to discover plugins, render their configuration in the UI, and register actions for keys.

### Complete `plugin.json` Schema Example:
```json
{
  "name": "Discord Webhook Sender",
  "identifier": "com.isudeck.discordwebhook",
  "version": "1.0.0",
  "author": "IsuDeck Community",
  "description": "Send instant Discord messages and stream alerts directly from your IsuDeck keys.",
  "executable": "webhook.exe",
  "icon": "icon.svg",
  "daemon": false,
  "config": [
    {
      "key": "webhookUrl",
      "type": "text",
      "label": "Default Webhook URL",
      "placeholder": "https://discord.com/api/webhooks/...",
      "required": false,
      "value": ""
    }
  ],
  "actions": [
    {
      "name": "send_message",
      "label": "Send Channel Message",
      "icon": "icon.svg",
      "fields": [
        {
          "key": "content",
          "type": "text",
          "label": "Message Content",
          "placeholder": "Stream is live!",
          "required": true
        },
        {
          "key": "customUrl",
          "type": "text",
          "label": "Custom Webhook URL (Optional)",
          "placeholder": "Leave empty to use default webhook URL",
          "required": false
        }
      ]
    }
  ]
}
```

### Supported Field and Config Input Types:
| Type | Description | Usage and Parameters |
|---|---|---|
| `text` | Single-line text input | `placeholder`, `required`, `value` |
| `password` | Masked secure input | `placeholder`, `value` |
| `number` | Numeric stepper/input | `min`, `max`, `value` |
| `select` | Static dropdown selection | `options: [{ "id": "val", "label": "Label" }]` |
| `dynamic_select` | Dynamically fetched from plugin | `dataType: "GetScenes"` |
| `file` | Desktop file browser dialog | `filters: [{ "name": "Audio", "extensions": ["mp3"] }]` |

---

## 4. Mode 1: One-Shot (`daemon: false`) Plugin Development

When `daemon: false` (or omitted), IsuDeck does **not** keep your process running in background (**0 MB Idle RAM**). When a user presses a key, IsuDeck executes your binary on the fly:

```bash
your_plugin.exe --action "<action_name>" --args "{\"content\":\"Stream starting!\"}"
```

### Python One-Shot Example (`webhook.py`):
```python
import sys
import json
import argparse
import urllib.request

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", required=True)
    parser.add_argument("--args", default="{}")
    parsed_args = parser.parse_args()

    action = parsed_args.action
    args = json.loads(parsed_args.args)

    if action == "send_message":
        content = args.get("content", "Greetings from IsuDeck!")
        webhook_url = args.get("customUrl")
        
        if webhook_url:
            req = urllib.request.Request(
                webhook_url,
                data=json.dumps({"content": content}).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "IsuDeck"}
            )
            urllib.request.urlopen(req, timeout=5)

        print("Message sent successfully.")
        sys.exit(0)
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
```

---

## 5. Mode 2: Live Daemon (`daemon: true`) Plugin Development

`daemon: true` plugins start once when IsuDeck boots up and communicate continuously via line-delimited **JSON-RPC over stdin and stdout**.

### 5.1. Initialization (`init`):
IsuDeck sends the stored user configuration when launching or reloading the plugin:
```json
{"op": "init", "config": {"ip": "127.0.0.1", "port": 4455, "password": "pass"}}
```

### 5.2. Dynamic Data Queries (`get_data` and `data_response`):
When a user opens an action configuration that uses a `dynamic_select` field:
```json
{"op": "get_data", "requestId": "req_1", "dataType": "GetScenes", "args": {}}
```
The plugin responds on `stdout`:
```json
{"op": "data_response", "requestId": "req_1", "data": [{"id": "scene1", "label": "Gameplay Scene"}]}
```

### 5.3. Action Execution (`execute` and `execute_response`):
When a key is pressed:
```json
{"op": "execute", "requestId": "exec_12345", "action": "toggle_mute", "args": {"source": "Mic"}}
```
The plugin responds on `stdout`:
```json
{"op": "execute_response", "requestId": "exec_12345", "success": true, "message": "Microphone muted"}
```

### 5.4. Live Dynamic Button State, Colors & Badges (`state_update`):
The plugin can update any button's visual appearance, surface background color, custom gradient, status badge, label text, or glowing border at any time by printing a single JSON line to `stdout`:

```json
{
  "op": "state_update",
  "plugin": "com.isudeck.monitor",
  "action": "cpu_usage",
  "filter": {},
  "exclusive": false,
  "state": {
    "badge": "CPU: 48%",
    "badgeColor": "#22c55e",
    "badgeBg": "#22c55e25",
    "pulse": false,
    "showDot": true,
    "bgColor": "#14532d",
    "color": "#22c55e",
    "label": "4.2 GHz",
    "textColor": "#ffffff",
    "iconColor": "#4ade80",
    "active": true
  }
}
```

#### Supported `state` Properties:
| Property | Type | Description |
|---|---|---|
| `badge` | `string` | Any custom badge text, numbers, status, or emojis (e.g. `"REC"`, `"MUTE"`, `"60 FPS"`, `"🔴 LIVE"`, `"99+"`, `"%85"`, `"PAUSE"`, `"CAM"`) |
| `badgeColor` | `string` | Hex or CSS color for badge text and border (e.g. `"#ef4444"`, `"#22c55e"`, `"#3b82f6"`) |
| `badgeBg` | `string` | Custom background color for the badge (e.g. `"#ef444433"`, `"rgba(34, 197, 94, 0.25)"`) |
| `badgeBorder` | `string` | Custom border color for the badge (optional) |
| `pulse` | `boolean` | Set `true` to make the badge pulsate continuously |
| `showDot` | `boolean` | Set `false` to hide the leading dot inside the badge |
| `bgColor` | `string` | Custom background color for the entire button surface (creates a sleek top-to-bottom surface gradient) |
| `bgGradient` | `string` | Complete custom CSS gradient for the button (e.g. `"linear-gradient(135deg, #ef4444, #991b1b)"`) |
| `solidBg` | `string` | Solid background color for the button (e.g. `"#dc2626"`) |
| `color` / `borderColor` | `string` | Glowing border and accent highlight color (e.g. `"#22c55e"`) |
| `glowColor` | `string` | Custom glow shadow color (e.g. `"#22c55e"`) |
| `label` / `title` | `string` | Dynamically override the button's title / label text |
| `textColor` | `string` | Dynamically set the button's label text color |
| `iconColor` | `string` | Dynamically set the vector / Lucide icon stroke color |
| `active` | `boolean` | Active state flag (activates ring & glow border) |


### Node.js Daemon Example (`monitor.js`):
```javascript
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    
    if (msg.op === "init") {
      // Configuration received from IsuDeck
    } 
    else if (msg.op === "execute") {
      if (msg.action === "reset_counter") {
        send({
          op: "execute_response",
          requestId: msg.requestId,
          success: true,
          message: "Counter reset"
        });
        
        // Push live badge update to buttons
        send({
          op: "state_update",
          plugin: "com.example.counter",
          action: "counter_button",
          filter: {},
          exclusive: false,
          state: { badge: "0", badgeColor: "#3b82f6", borderColor: "#3b82f6", active: true }
        });
      }
    }
  } catch (e) {
    // JSON parse error
  }
});
```

---

## 6. Packaging and Compiling to Standalone Executable

Because IsuDeck launches standard Windows executables, package your plugin as a single standalone `.exe`:

- **Python:** `pyinstaller --onefile --noconsole plugin.py`
- **Node.js:** `npx pkg plugin.js --target node18-win-x64 --output plugin.exe` (or `bun build --compile`)
- **C# / .NET:** `dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true`
- **Rust / Go:** `cargo build --release` / `go build -o plugin.exe`

---

## 7. Distribution and Installation

1. Create a plugin directory (e.g. `c:\IsuDeck\plugins\MyAwesomePlugin\`).
2. Copy `plugin.json`, your compiled `.exe`, and `icon.svg` into this directory.
3. Open or reload IsuDeck. Your plugin will appear on the **Plugins** page with a toggle switch, and its actions will be immediately available in the Action Editor.

---

## 8. Best Practices

1. **Flush Output Streams:** Always flush stdout (`sys.stdout.flush()` / `stdout.flush()`) after printing messages.
2. **Non-blocking Execution:** Do not block inside `execute` or `get_data` handlers. Spawn background tasks for slow operations (IsuDeck timeout is 5 seconds).
3. **Auto-Reconnect:** If an external service (OBS, Spotify, etc.) disconnects, the daemon process should silently attempt reconnection in the background without crashing.
