import sys
import json
import time
import threading
import psutil

running = True
refresh_sec = 2

def send(payload):
    """Write single-line JSON to IsuDeck stdout and flush buffer."""
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()

def monitor_loop():
    """Periodically publish CPU and RAM stats to IsuDeck buttons via state_update."""
    global running, refresh_sec
    while running:
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            ram_percent = psutil.virtual_memory().percent

            # Determine CPU badge color
            cpu_color = "#22c55e" if cpu_percent < 60 else ("#f59e0b" if cpu_percent < 85 else "#ef4444")
            
            # Push live CPU state
            send({
                "op": "state_update",
                "plugin": "com.isudeck.example.systemmonitor",
                "action": "show_cpu",
                "filter": {},
                "exclusive": False,
                "state": {
                    "badge": f"{int(cpu_percent)}%",
                    "badgeColor": cpu_color,
                    "borderColor": cpu_color,
                    "active": True
                }
            })

            # Determine RAM badge color
            ram_color = "#3b82f6" if ram_percent < 75 else "#ef4444"
            
            # Push live RAM state
            send({
                "op": "state_update",
                "plugin": "com.isudeck.example.systemmonitor",
                "action": "show_ram",
                "filter": {},
                "exclusive": False,
                "state": {
                    "badge": f"{int(ram_percent)}%",
                    "badgeColor": ram_color,
                    "borderColor": ram_color,
                    "active": True
                }
            })
        except Exception:
            pass

        time.sleep(max(1, refresh_sec))

def main():
    global refresh_sec, running
    
    # Start background polling thread
    t = threading.Thread(target=monitor_loop, daemon=True)
    t.start()

    # Listen to IsuDeck stdin (JSON-RPC)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue

        op = msg.get("op")
        req_id = msg.get("requestId")

        if op == "init":
            # Configuration received on startup or settings change
            config = msg.get("config", {})
            if "refreshInterval" in config:
                try:
                    refresh_sec = int(config["refreshInterval"])
                except Exception:
                    pass

        elif op == "execute":
            # User clicked a key assigned to this plugin
            action = msg.get("action")
            send({
                "op": "execute_response",
                "requestId": req_id,
                "success": True,
                "message": f"Action {action} executed."
            })

if __name__ == "__main__":
    main()
