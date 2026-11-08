# IsuDeck Plugin Developer Guide (Plugin SDK)

IsuDeck uses an **isolated child-process plugin architecture**. This keeps the core application ultra-lightweight, fast, and crash-resilient while enabling integration with third-party software and hardware (OBS Studio, Spotify, Discord, Philips Hue, Home Assistant, Voicemeeter, Webhooks, custom services, etc.).

**You do NOT need to install a dedicated SDK.** You can develop an IsuDeck plugin in any programming language that can read command-line arguments or line-delimited JSON from standard input and write to standard output.

The daemon protocol described here is IsuDeck's own line-delimited JSON protocol. It is **not JSON-RPC 2.0**: messages use IsuDeck-specific `op` values and do not use JSON-RPC's `jsonrpc`, `method`, and `result` envelope.

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
│ - No resident process between requests       │        │ - Starts with IsuDeck, stays running in the background │
│ - Launched per action or data request        │        │ - RAM usage depends on implementation                 │
│ - CLI Arguments: --action <name> --args <json│        │ - Bi-directional line-delimited JSON protocol (stdio)  │
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
| `text`, `email`, `url` | Single-line text input | `placeholder`, `required` |
| `password` | Masked input | `placeholder`, `required` |
| `number` | Numeric input | `min`, `max`, `step`, `placeholder`, `required` |
| `select`, `listbox` | Static dropdown | `options: [{ "id": "value", "label": "Label" }]` |
| `dynamic_select` | Dropdown populated by a daemon or one-shot `get_data` handler | `sourceKey` (or `dataType` / `key`) |
| `checkbox` | Boolean toggle | `default`, `required` |
| `slider` | Numeric slider | `min`, `max`, `step`, `default` |
| `color` | Color input | `default` |
| `file` | File picker | `filters: [{ "name": "Audio", "extensions": ["mp3"] }]` |
| `richtext` | Text area with preview | `placeholder`, `required` |

For action fields, `key` is the property name sent to the plugin in `args`; `label`, `placeholder`, `description`, and `required` control the editor. Static select options may be strings or objects with `id`/`value` and `label`/`name`. For plugin configuration, `key` identifies the persisted setting, `value` is its default, and `type` selects the input. Configuration currently supports `text`, `password`, `number`, `checkbox`, `select`, and `richtext`.

An action's `name` is the identifier sent to the plugin in an `execute` message. Each field key becomes a property in that action's `args`. Keep action names unique across plugins where possible because IsuDeck registers actions globally.

### Manifest and plugin files

The plugin folder must contain `plugin.json` and the executable named by `executable` (or the legacy `main` field). The executable path is resolved relative to the plugin folder. `name` is used as the display name. `actions` is an array of action definitions; each action should have a stable `name`, a user-facing `label`, and a `fields` array (which may be empty). `daemon` selects the long-running protocol; if omitted or `false`, the plugin runs as a one-shot process. The legacy `background` boolean is also accepted as a daemon setting.

Common optional manifest properties include `identifier`, `version`, `author`, `license`, `description`, `icon`, `readme`, `config`, and `actions`. Icons and documentation should use paths relative to the plugin folder. Store per-user values in the generated `config.json`; do not package a user's credentials in the manifest or source.

---

## 4. Mode 1: One-Shot (`daemon: false`) Plugin Development

When `daemon: false` (or omitted), IsuDeck does not keep a plugin process running in the background. When a user presses a key, IsuDeck starts the executable for that action, waits for it to exit, and captures stdout/stderr:

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
        return 0
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

---

## 5. Mode 2: Live Daemon (`daemon: true`) Plugin Development

When `daemon: true`, IsuDeck starts the executable as a child process (with its working directory set to the plugin folder) and keeps it running while the plugin is enabled. The process communicates using UTF-8, newline-delimited JSON over stdin and stdout.

#### Transport rules

- Read one complete JSON object per line from `stdin`; a line is one message. A message may arrive at any time, so keep reading until stdin closes.
- Write each response as exactly one JSON object followed by `\n`, then flush stdout. Do not write logs, banners, compiler output, or other text to stdout; send diagnostics to stderr.
- Use the incoming `requestId` unchanged in its matching response. Multiple requests can be in flight, so do not assume responses are handled in the same order as requests.
- `init` is a notification and has no response. IsuDeck sends it after startup and again when configuration is reloaded. Its `config` object contains the saved plugin settings, including any `enabled` property.
- IsuDeck waits up to 4 seconds for a `data_response` and 5 seconds for an `execute_response`. Return useful results promptly; a timed-out request is treated as empty dynamic data or a failed action.
- Malformed or unknown messages should not crash the daemon. Unknown `op` values can be ignored. Keep the process alive to support later requests and live updates.
- When IsuDeck stops or reloads plugins, it terminates the child process; there is no shutdown request in the current protocol.

### 5.1. Initialization (`init`):
IsuDeck sends the stored user configuration when launching or reloading the plugin:
```json
{"op": "init", "config": {"ip": "127.0.0.1", "port": 4455, "password": "pass"}}
```

### 5.2. Dynamic Data Queries (`get_data` and `data_response`)
When a user opens an action configuration that uses a `dynamic_select` field:
```json
{"op": "get_data", "requestId": "req_1", "dataType": "GetScenes", "args": {}}
```
The plugin responds on `stdout`:
```json
{"op": "data_response", "requestId": "req_1", "data": [{"id": "scene1", "label": "Gameplay Scene", "description": "Optional detail", "image": null}]}
```

`dataType` is taken from the field's `sourceKey`, then `dataType`, then `key`, in that order. `args` contains values of the other, non-dynamic fields in the same action, which lets a data provider depend on another selection (for example, list scene items for the selected scene). Each item must have a string `id` and `label`; `description` and `image` are optional. `image` may be a URL or image source understood by the UI. Return `data: []` when there are no options or the request cannot be fulfilled; the current protocol has no separate error field for data requests.

For a `daemon: false` one-shot plugin, IsuDeck instead runs:

```text
plugin.exe --get-data <dataType> --args <JSON>
```

Print a JSON array of data items to stdout and exit. Do not print informational text to stdout.

### 5.3. Action Execution (`execute` and `execute_response`)
When a key is pressed:
```json
{"op": "execute", "requestId": "exec_12345", "action": "toggle_mute", "args": {"source": "Mic"}}
```
The plugin responds on `stdout`:
```json
{"op": "execute_response", "requestId": "exec_12345", "success": true, "message": "Microphone muted"}
```

Always return an `execute_response`, including for unknown actions and failures. `success` must be a boolean and `message` a user-readable string. An OBS/HTTP/etc. error must not be reported as a successful action. A one-shot plugin receives the same action through:

```text
plugin.exe --action <action-name> --args <JSON>
```

For one-shot execution, exit with code 0 on success and non-zero on failure. IsuDeck displays trimmed stdout as the success message and trimmed stderr as the failure message. Do not print diagnostic text to stdout. One-shot dynamic-data requests use the `--get-data` form above and return a JSON array instead.

### 5.4. Live Dynamic Button State, Colors & Badges (`state_update`)
The plugin can publish live state at any time by writing a single JSON line to stdout:

```json
{
  "op": "state_update",
  "plugin": "com.example.counter",
  "action": "reset_counter",
  "filter": {},
  "exclusive": false,
  "state": {
    "badge": "0",
    "badgeColor": "#3b82f6",
    "pulse": false,
    "showDot": false,
    "color": "#3b82f6",
    "active": true
  }
}
```

`plugin` should be the plugin's stable manifest `identifier`; `action` must match the manifest action `name`. `filter` is an object containing action argument names and their values, such as `{"inputName":"Mic/Aux"}`. Use `{}` to update all buttons using that action. A button with a non-empty filter is updated only when all specified values match its configured action arguments (matching is case-insensitive; OBS integrations also support the `source`/`input` aliases for `inputName`, and `targetScene`/`scene`/`target` aliases for `sceneName`). `exclusive: true` clears the active/badge state from other filters for the same action before applying this update.

Send a complete `state` object for the state you want displayed. To clear a badge, send `"badge": null` and set `"active": false` as appropriate. Do not send secrets or large payloads in state updates.

#### Supported `state` Properties:
| Property | Type | Description |
|---|---|---|
| `badge` | `string` | Any custom badge text, numbers, status, or emojis (e.g. `"REC"`, `"MUTE"`, `"60 FPS"`, `"🔴 LIVE"`, `"99+"`, `"%85"`, `"PAUSE"`, `"CAM"`) |
| `badgeColor` | `string` | Hex or CSS color for badge text and border (e.g. `"#ef4444"`, `"#22c55e"`, `"#3b82f6"`) |
| `badgeBg` | `string` | Custom background color for the badge (e.g. `"#ef444433"`, `"rgba(34, 197, 94, 0.25)"`) |
| `badgeBorder` | `string` | Custom border color for the badge (optional) |
| `badgeBackgroundColor` | `string` | Alias for `badgeBg` |
| `badgeDotColor` | `string` | Color for the badge's leading dot |
| `pulse` | `boolean` | Set `true` to make the badge pulsate continuously |
| `showDot` | `boolean` | Set `false` to hide the leading dot inside the badge |
| `bgColor` | `string` | Custom background color for the entire button surface |
| `backgroundColor` / `buttonBg` | `string` | Aliases for the button surface color |
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
          action: "reset_counter",
          filter: {},
          exclusive: false,
          state: { badge: "0", badgeColor: "#3b82f6", borderColor: "#3b82f6", active: true }
        });
      }
    }
  } catch (e) {
    // Send diagnostics to stderr; never write non-protocol text to stdout.
    console.error(e);
  }
});

process.stdout.on("error", (error) => {
  console.error("stdout error:", error);
});
```

---

## 6. Packaging and Compiling to Standalone Executable

IsuDeck launches a native executable on the current operating system. Include the executable and all required runtime files in the plugin directory. A single-file executable is convenient, but not required:

- **Python:** `pyinstaller --onefile --noconsole plugin.py`
- **Node.js:** `npx pkg plugin.js --target node18-win-x64 --output plugin.exe` (or `bun build --compile`)
- **C# / .NET:** `dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true`
- **Rust / Go:** `cargo build --release` / `go build -o plugin.exe`

---

## 7. Distribution and Installation

1. Create a plugin directory (e.g. `C:\IsuDeck\plugins\MyAwesomePlugin\`).
2. Copy `plugin.json`, the executable built for the user's operating system, and any required assets into this directory.
3. Open or reload IsuDeck. Your plugin will appear on the **Plugins** page with a toggle switch, and its actions will be immediately available in the Action Editor.

---

## 8. Best Practices

1. **Keep stdout protocol-only:** Every stdout line must be a complete protocol JSON message (or, for one-shot data queries, the JSON array). Flush after writing each line. Send logs to stderr.
2. **Meet response deadlines:** Respond to daemon data requests within 4 seconds and action requests within 5 seconds. Use async work or a background task for slow services, but still return an explicit response before the deadline.
3. **Handle connectivity loss:** A daemon that depends on an external service should reconnect with a bounded delay/backoff, keep processing IsuDeck messages, and return a clear failure if an action is requested while disconnected.
4. **Validate all input:** Treat action arguments and saved configuration as untrusted. Validate types, lengths, ranges, and file paths; do not build shell commands by concatenating user-provided strings.
5. **Protect credentials:** Never log passwords, tokens, or webhook URLs. Use local-only service bindings by default and do not expose control interfaces to untrusted networks.
6. **Return truthful results:** Check service response status and propagate errors; do not return success merely because a request was sent.
7. **Test both modes:** Exercise malformed input, unknown operations/actions, service unavailable, timeout, and recovery after reconnect.

## 9. Publishing a Plugin Store Package

The recommended layout is a metadata-only catalog on Cloudflare Pages plus packages on GitHub Releases, R2, or any other HTTPS host. The catalog is a single JSON document:

```json
{
  "schemaVersion": 1,
  "plugins": [
    {
      "identifier": "com.example.plugin",
      "name": "Example Plugin",
      "version": "1.0.0",
      "author": "Example",
      "description": "What the plugin does.",
      "license": "MIT",
      "tags": ["example"],
      "platforms": ["windows"],
      "minAppVersion": "1.2.0",
      "dirName": "ExamplePlugin",
      "daemon": true,
      "actions": [],
      "icon": "https://cdn.example.com/icon.png",
      "screenshots": ["https://cdn.example.com/screenshot.png"],
      "changelog": "https://cdn.example.com/CHANGELOG.md",
      "download": {
        "url": "https://github.com/example/releases/download/v1.0.0/plugin.zip",
        "sha256": "<64 hex characters>",
        "size": 123456
      }
    }
  ]
}
```

`identifier`, `name`, `version`, `download.url`, and `download.sha256` are required. `dirName` falls back to the identifier, `size` is an optional pre-check, and `icon`/`screenshots`/`changelog` may be absolute HTTPS URLs or paths relative to the catalog. Downloads may redirect, but every hop must stay on HTTPS.

Publish the catalog to the online Cloudflare Pages project and make sure its package URLs point to HTTPS downloads hosted with the plugin release. Plugin releases are managed independently of the IsuDeck application build. Enter the deployed `registry.json` URL in **Plugins > Browse**, or set `VITE_PLUGIN_REGISTRY_URL` before building the app to use a default address. Only distribute builds you are authorized to publish, and never include user credentials or local configuration.

Store installation accepts HTTPS only, verifies the ZIP hash before extraction, rejects path traversal and symbolic links, imposes compressed and expanded size/file-count limits, validates the manifest/executable, stops the target plugin before replacing files, and preserves its existing `config.json`. Any `config.json` included in a package is discarded, so plugins cannot ship user state or credentials; uninstalling removes the configuration with the plugin folder. Local ZIP installation may omit the hash, but the UI warns that this is unverified.

SHA-256 is an integrity check, not a publisher signature: if an attacker controls the registry, they can replace both the package URL and hash. The current version has no Ed25519 signature verification, so users should only configure catalogs they trust. A `Verified` badge must not be used to imply cryptographic verification until signed metadata is implemented.
