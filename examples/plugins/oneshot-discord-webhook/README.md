# Discord Webhook One-Shot Plugin Example

This plugin demonstrates the **One-Shot (On-Demand / 0 MB Idle RAM)** execution model of IsuDeck using a simple Python script.

## Execution Model
1. In `plugin.json`, `"daemon": false` is specified.
2. When IsuDeck starts, this plugin is not kept running in the background.
3. When the user presses the key, IsuDeck executes:
   `webhook.exe --action "send_discord_message" --args "{\"content\":\"Stream starting!\"}"`
   The script sends the notification and immediately terminates.

## How to Compile to .exe
```bash
pip install pyinstaller
pyinstaller --onefile --noconsole webhook.py
```
Copy the generated `dist/webhook.exe`, along with `plugin.json` and `icon.svg`, into `c:\IsuDeck\plugins\DiscordWebhook\`.
