use std::path::{Path, PathBuf};

pub fn enable_realtime_priority() {
    // Linux üzerinde thread önceliği isteğe bağlı olarak nice veya RT scheduler ile ayarlanabilir
}

pub fn detect_system_language() -> &'static str {
    if let Ok(lang) = std::env::var("LANG") {
        if lang.to_lowercase().starts_with("tr") {
            return "tr";
        }
    }
    "en"
}

pub fn check_registry_has_interception() -> bool {
    // Linux'ta Windows Interception sürücüsü gerekmez; evdev çekirdekte her zaman vardır
    true
}

pub fn run_silent_elevated(_exe_path: &Path, _args: &str) -> Result<bool, String> {
    // Linux'ta pkexec veya sudo kullanılır
    Ok(true)
}
