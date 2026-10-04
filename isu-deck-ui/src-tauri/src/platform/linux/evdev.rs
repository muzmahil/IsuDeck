use std::sync::{Arc, Mutex};
use std::collections::HashSet;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

pub fn start_linux_input_thread(
    app_handle: AppHandle,
    block_list: Arc<Mutex<HashSet<(String, u16)>>>,
    blocked_keys_pressed: Arc<Mutex<HashSet<(i32, u16)>>>,
) {
    std::thread::spawn(move || {
        println!("🚀 [LINUX ENGINE] Linux evdev dinleyici thread başlatılıyor...");

        // evdev ile tüm giriş cihazlarını tara
        // Not: Kullanıcı grubunun 'input' grubunda olması gerekir (sudo usermod -aG input $USER)
        let devices = evdev::enumerate().collect::<Vec<_>>();
        println!("🔍 [LINUX ENGINE] {} giriş cihazı tespit edildi.", devices.len());

        for (path, device) in &devices {
            if let Some(name) = device.name() {
                let is_kbd = device.supported_keys().map_or(false, |keys| {
                    keys.contains(evdev::Key::KEY_ENTER) && keys.contains(evdev::Key::KEY_SPACE)
                });
                if is_kbd {
                    println!("⌨️ [LINUX ENGINE] Klavye bulundu: '{}' -> {:?}", name, path);
                }
            }
        }

        // Klavye izleme döngüsü
        loop {
            // Dinleme ve olay döngüsü
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}
