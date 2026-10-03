import sys
import json
import argparse
import urllib.request

def send_discord_notification(url, content):
    if not url:
        print("Error: Webhook URL not specified.", file=sys.stderr)
        sys.exit(1)
        
    payload = json.dumps({"content": content}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "IsuDeck-Plugin/1.0"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 204):
                print("Discord message sent successfully.")
                sys.exit(0)
            else:
                print(f"Discord API response status: {resp.status}", file=sys.stderr)
                sys.exit(1)
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    # IsuDeck One-Shot invocation:
    # webhook.exe --action "send_discord_message" --args "{\"content\":\"Hello!\"}"
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", required=True, help="Target IsuDeck action name")
    parser.add_argument("--args", default="{}", help="User input arguments in JSON format")
    parser.add_argument("--get-data", required=False, help="Dynamic data request type")
    
    parsed = parser.parse_args()
    args = json.loads(parsed.args)
    
    if parsed.action == "send_discord_message":
        content = args.get("content", "IsuDeck button triggered.")
        url = args.get("webhookUrl")
        
        # Fallback to defaultWebhookUrl from config.json if not configured in button fields
        if not url:
            try:
                with open("config.json", "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    url = cfg.get("defaultWebhookUrl")
            except Exception:
                pass

        send_discord_notification(url, content)
    else:
        print(f"Unknown action: {parsed.action}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
