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

        // Find all keyboard devices: any device supporting standard keys
        let devices: Vec<(std::path::PathBuf, evdev::Device)> = evdev::enumerate()
            .filter(|(_, d)| {
                d.supported_keys().map_or(false, |keys| {
                    // Check if device supports common keys (letters, space, enter or numpad)
                    keys.contains(evdev::Key::KEY_ENTER) || 
                    keys.contains(evdev::Key::KEY_SPACE) ||
                    keys.contains(evdev::Key::KEY_A) ||
                    keys.contains(evdev::Key::KEY_1)
                })
            })
            .collect();

        if devices.is_empty() {
            println!("[LINUX ENGINE] No keyboard devices found. Make sure the user is in the 'input' group (sudo usermod -aG input $USER).");
            let _ = app_handle.emit(
                "INPUT_EVENT",
                serde_json::json!({
                    "type": "SHOW_TOAST",
                    "title": "Giriş Aygıtı Uyarısı",
                    "message": "Klavye aygıtı okunamadı. 'input' grubunda olduğunuzdan emin olun (sudo usermod -aG input $USER).",
                    "variant": "warning"
                })
                .to_string(),
            );
            return;
        }

        println!("[LINUX ENGINE] Found {} keyboard device(s):", devices.len());
        for (path, dev) in &devices {
            println!("  - {:?} ({})", path, dev.name().unwrap_or("unknown"));
        }

        // Spawn one thread per keyboard device so they are read in parallel
        let mut handles = Vec::new();
        for (path, _dev) in devices {
            let app_clone = app_handle.clone();
            let block_list_clone = block_list.clone();
            let path_clone = path.clone();

            let handle = std::thread::spawn(move || {
                let mut device = match evdev::Device::open(&path_clone) {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("[LINUX ENGINE] Cannot open {:?}: {}. (Permissions issue? Check input group or udev rules)", path_clone, e);
                        return;
                    }
                };

                let dev_name = device.name().unwrap_or("keyboard").to_string();
                let dev_path_str = path_clone.to_string_lossy().to_string();
                let dev_node = path_clone
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("event")
                    .to_string();

                println!("[LINUX ENGINE] Listening on device: {} ({:?})", dev_name, path_clone);

                loop {
                    match device.fetch_events() {
                        Ok(events) => {
                            for ev in events {
                                if ev.event_type() != evdev::EventType::KEY {
                                    continue;
                                }

                                let key_code = ev.code();
                                let key_value = ev.value(); // 0 = release, 1 = press, 2 = repeat

                                // key_value == 1 (press)
                                if key_value == 1 {
                                    let is_blocked = {
                                        let bl = block_list_clone.lock().unwrap();
                                        bl.contains(&(dev_node.clone(), key_code)) ||
                                        bl.contains(&(dev_path_str.clone(), key_code)) ||
                                        bl.contains(&(dev_name.clone(), key_code)) ||
                                        bl.contains(&("*".to_string(), key_code))
                                    };

                                    // Emit event compatible with useStore / page.js / ActionEditor
                                    let event_payload = serde_json::json!({
                                        "type": "inputPressed",
                                        "hid": dev_node,
                                        "deviceName": dev_name,
                                        "devicePath": dev_path_str,
                                        "key": key_code,
                                        "blocked": is_blocked
                                    });

                                    let _ = app_clone.emit("INPUT_EVENT", &event_payload);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[LINUX ENGINE] Error reading device {}: {}", dev_node, e);
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
