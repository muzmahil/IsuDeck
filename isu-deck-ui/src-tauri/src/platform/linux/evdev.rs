use std::sync::{Arc, Mutex};
use std::collections::HashSet;
use tauri::{AppHandle, Emitter};

/// Starts a background thread that reads keyboard events via Linux evdev.
/// Emits "INPUT_EVENT" to the frontend when a configured button device+key is pressed.
pub fn start_linux_input_thread(
    app_handle: AppHandle,
    block_list: Arc<Mutex<HashSet<(String, u16)>>>,
    _blocked_keys_pressed: Arc<Mutex<HashSet<(i32, u16)>>>,
) {
    std::thread::spawn(move || {
        println!("[LINUX ENGINE] Scanning /dev/input for keyboard devices...");

        // Find all keyboard devices
        let devices: Vec<(std::path::PathBuf, evdev::Device)> = evdev::enumerate()
            .filter(|(_, d)| {
                d.supported_keys().map_or(false, |keys| {
                    keys.contains(evdev::Key::KEY_ENTER) && keys.contains(evdev::Key::KEY_SPACE)
                })
            })
            .collect();

        if devices.is_empty() {
            println!("[LINUX ENGINE] No keyboard devices found. Make sure the user is in the 'input' group.");
            // Emit a status so the frontend can show a warning
            let _ = app_handle.emit(
                "INPUT_EVENT",
                serde_json::json!({
                    "type": "engine_status",
                    "status": "no_devices",
                    "message": "No keyboard devices found. Run: sudo usermod -aG input $USER && reboot"
                })
                .to_string(),
            );
            return;
        }

        println!("[LINUX ENGINE] Found {} keyboard device(s):", devices.len());
        for (path, dev) in &devices {
            println!("  - {:?} ({})", path, dev.name().unwrap_or("unknown"));
        }

        // Send ready status to frontend
        let _ = app_handle.emit(
            "INPUT_EVENT",
            serde_json::json!({
                "type": "engine_status",
                "status": "ready",
                "device_count": devices.len()
            })
            .to_string(),
        );

        // Spawn one thread per keyboard device so they are read in parallel
        let mut handles = Vec::new();
        for (path, _dev) in devices {
            let app_clone = app_handle.clone();
            let block_list_clone = block_list.clone();
            let path_clone = path.clone();

            let handle = std::thread::spawn(move || {
                // Re-open the device inside the thread for exclusive async read
                let mut device = match evdev::Device::open(&path_clone) {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("[LINUX ENGINE] Cannot open {:?}: {}. Check 'input' group membership.", path_clone, e);
                        return;
                    }
                };

                // Build a unique device identifier from its path
                let dev_hid = path_clone
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                println!("[LINUX ENGINE] Listening on device: {} ({})", dev_hid, path_clone.display());

                loop {
                    // fetch_events blocks until events are available
                    match device.fetch_events() {
                        Ok(events) => {
                            for ev in events {
                                // Only handle EV_KEY events (key press / release)
                                if ev.event_type() != evdev::EventType::KEY {
                                    continue;
                                }

                                let key_code = ev.code(); // raw scancode / HID usage
                                let key_value = ev.value(); // 0 = release, 1 = press, 2 = repeat

                                // key_value == 1 → key pressed
                                if key_value == 1 {
                                    // Check if this (device, key) pair is in the block list
                                    let is_blocked = {
                                        let bl = block_list_clone.lock().unwrap();
                                        bl.contains(&(dev_hid.clone(), key_code))
                                    };

                                    // Emit INPUT_EVENT to frontend regardless of block status
                                    // (frontend decides which profile button to trigger)
                                    let event_payload = serde_json::json!({
                                        "type": "key_press",
                                        "hid": dev_hid,
                                        "key": key_code,
                                        "blocked": is_blocked
                                    });

                                    let _ = app_clone.emit("INPUT_EVENT", event_payload.to_string());
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[LINUX ENGINE] Error reading device {}: {}", dev_hid, e);
                            // Device was unplugged or lost — stop this thread
                            break;
                        }
                    }
                }
            });

            handles.push(handle);
        }

        // Wait for all device threads (they only exit on device error/unplug)
        for h in handles {
            let _ = h.join();
        }

        println!("[LINUX ENGINE] All device listener threads have exited.");
    });
}
