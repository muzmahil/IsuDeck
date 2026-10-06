#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod platform;
mod action_runner;
mod plugin_manager;

use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{
    command,
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

use action_runner::ActionRunner;
use plugin_manager::PluginManager;

// ==========================================================
// GÖMÜLÜ PORTABLE SESLER (CROSS-PLATFORM)
// ==========================================================
static EMBEDDED_SOUND_CLICK: &[u8] = include_bytes!("../../public/sounds/click.wav");
static EMBEDDED_SOUND_MECH: &[u8] = include_bytes!("../../public/sounds/mech.wav");
static EMBEDDED_SOUND_BEEP: &[u8] = include_bytes!("../../public/sounds/beep.wav");

// ==========================================================
// 1. ENGINE STATE
// ==========================================================

pub struct EngineState {
    pub block_list: Arc<Mutex<HashSet<(String, u16)>>>,
    pub blocked_keys_pressed: Arc<Mutex<HashSet<(i32, u16)>>>,
    pub plugin_manager: Arc<PluginManager>,
    pub minimize_to_tray: Mutex<bool>,
}

// ==========================================================
// 2. TAŞINABİLİR (PORTABLE) KÖK DİZİN & DOSYA SİSTEMİ
// ==========================================================

pub fn isudeck_root(_app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if exe_dir.join("plugins").exists() || exe_dir.join("profiles.json").exists() {
                return Ok(exe_dir.to_path_buf());
            }
            for ancestor in exe_dir.ancestors() {
                if ancestor.join("plugins").exists() && ancestor.join("profiles.json").exists() {
                    return Ok(ancestor.to_path_buf());
                }
            }
            return Ok(exe_dir.to_path_buf());
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        for ancestor in cwd.ancestors() {
            if ancestor.join("plugins").exists() && ancestor.join("profiles.json").exists() {
                return Ok(ancestor.to_path_buf());
            }
        }
        return Ok(cwd);
    }
    std::env::current_dir().map_err(|e| e.to_string())
}

// Ensure portable directories and default files are bootstrapped
fn bootstrap_portable_environment(app: &tauri::AppHandle) {
    let root = match isudeck_root(app) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[BOOTSTRAP] Unable to determine root directory: {}", e);
            return;
        }
    };

    println!("[BOOTSTRAP] IsuDeck directory: {}", root.display());

    #[cfg(windows)]
    {
        // 1. Windows: extract interception.dll if missing
        let dll_path = root.join("interception.dll");
        if !dll_path.exists() {
            let _ = fs::write(&dll_path, platform::windows::bootstrap::EMBEDDED_INTERCEPTION_DLL);
            println!("[BOOTSTRAP] Extracted interception.dll.");
        }

        // 2. Windows: extract drivers/install-interception.exe and install_helper.cmd if missing
        let drivers_dir = root.join("drivers");
        let _ = fs::create_dir_all(&drivers_dir);
        let installer_path = drivers_dir.join("install-interception.exe");
        if !installer_path.exists() {
            let _ = fs::write(&installer_path, platform::windows::bootstrap::EMBEDDED_INSTALLER);
            println!("[BOOTSTRAP] Extracted drivers/install-interception.exe.");
        }
        let helper_path = drivers_dir.join("install_helper.cmd");
        let _ = fs::write(&helper_path, platform::windows::bootstrap::INSTALL_HELPER_CMD);
    }

    // 3. sounds/ directory and default sounds
    let sounds_dir = root.join("sounds");
    let _ = fs::create_dir_all(&sounds_dir);
    let click_path = sounds_dir.join("click.wav");
    if !click_path.exists() {
        let _ = fs::write(&click_path, EMBEDDED_SOUND_CLICK);
    }
    let mech_path = sounds_dir.join("mech.wav");
    if !mech_path.exists() {
        let _ = fs::write(&mech_path, EMBEDDED_SOUND_MECH);
    }
    let beep_path = sounds_dir.join("beep.wav");
    if !beep_path.exists() {
        let _ = fs::write(&beep_path, EMBEDDED_SOUND_BEEP);
    }

    // 4. plugins/ directory
    let plugins_dir = root.join("plugins");
    let _ = fs::create_dir_all(&plugins_dir);

    // 5. Default profiles.json if missing
    let profiles_path = root.join("profiles.json");
    if !profiles_path.exists() {
        let default_profiles = serde_json::json!([
            {
                "id": "default-profile",
                "name": "Default",
                "isActive": true,
                "gridSize": 15,
                "buttons": vec![serde_json::Value::Null; 15]
            }
        ]);
        let _ = fs::write(&profiles_path, serde_json::to_string_pretty(&default_profiles).unwrap());
        println!("[BOOTSTRAP] Created default profiles.json.");
    }

    // 6. Default settings.json if missing
    let settings_path = root.join("settings.json");
    if !settings_path.exists() {
        let default_lang = platform::os::detect_system_language();
        let default_settings = serde_json::json!({
            "minimizeToTray": false,
            "autoStart": false,
            "defaultSoundFeedback": true,
            "defaultShowTitle": true,
            "defaultGridSize": 15,
            "selectedSound": "click.wav",
            "language": default_lang,
            "disclaimerAccepted": false
        });
        let _ = fs::write(&settings_path, serde_json::to_string_pretty(&default_settings).unwrap());
        println!("[BOOTSTRAP] Created default settings.json (Language: {}).", default_lang);
    }
}

#[command]
fn fs_create_dir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let root = isudeck_root(&app)?;
    fs::create_dir_all(root.join(path)).map_err(|e| e.to_string())
}

#[command]
fn fs_write_file(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    let root = isudeck_root(&app)?;
    let file = root.join(path);
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(file, content).map_err(|e| e.to_string())
}

#[command]
fn fs_read_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let root = isudeck_root(&app)?;
    fs::read_to_string(root.join(path)).map_err(|e| e.to_string())
}

#[command]
fn fs_read_binary(app: tauri::AppHandle, path: String) -> Result<Vec<u8>, String> {
    let root = isudeck_root(&app)?;
    std::fs::read(root.join(path)).map_err(|e| e.to_string())
}

#[command]
fn fs_exists(app: tauri::AppHandle, path: String) -> Result<bool, String> {
    let root = isudeck_root(&app)?;
    Ok(root.join(path).exists())
}

#[command]
fn fs_read_dir(app: tauri::AppHandle, path: String) -> Result<Vec<String>, String> {
    let root = isudeck_root(&app)?;
    let dir = root.join(path);
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                out.push(name.to_string());
            }
        }
    }
    Ok(out)
}

#[command]
fn open_sounds_dir(app: tauri::AppHandle) -> Result<(), String> {
    let root = isudeck_root(&app)?;
    let sounds_dir = root.join("sounds");
    fs::create_dir_all(&sounds_dir).map_err(|e| e.to_string())?;
    
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(sounds_dir.display().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(sounds_dir.display().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn list_custom_sounds(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let root = isudeck_root(&app)?;
    let sounds_dir = root.join("sounds");
    let mut sounds = vec![
        "click.wav".to_string(),
        "mech.wav".to_string(),
        "beep.wav".to_string(),
    ];

    if let Ok(entries) = fs::read_dir(&sounds_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if matches!(ext_lower.as_str(), "mp3" | "wav" | "ogg" | "aac" | "flac") {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if !sounds.contains(&file_name.to_string()) {
                            sounds.push(file_name.to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(sounds)
}

#[command]
fn play_sound_file(app: tauri::AppHandle, sound: String) {
    if let Ok(root) = isudeck_root(&app) {
        let p1 = root.join("sounds").join(&sound);
        if p1.exists() {
            ActionRunner::play_audio_file(&p1.to_string_lossy());
            return;
        }
        let p2 = root.join(&sound);
        if p2.exists() {
            ActionRunner::play_audio_file(&p2.to_string_lossy());
            return;
        }
    }
    ActionRunner::play_audio_file(&sound);
}

// ==========================================================
// 3. SÜRÜCÜ YÖNETİMİ
// ==========================================================

#[command]
async fn manage_driver(app: tauri::AppHandle, action: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        let root = isudeck_root(&app)?;
        let (installer, args) = platform::windows::bootstrap::find_driver_installer(&root, &action)
            .ok_or("drivers/install-interception.exe bulunamadı.")?;

        let success = tauri::async_runtime::spawn_blocking(move || {
            platform::windows::bootstrap::run_silent_elevated(&installer, &args)
        })
        .await
        .map_err(|e| e.to_string())??;

        if success {
            Ok(action)
        } else {
            Err("Sürücü işlemi tamamlanamadı veya yönetici izni reddedildi.".to_string())
        }
    }
    #[cfg(not(windows))]
    {
        Ok("Linux yerleşik mod aktif, ek sürücü gerekmez.".to_string())
    }
}

#[command]
fn check_driver_status(app: tauri::AppHandle) -> String {
    #[cfg(windows)]
    {
        let reg_has = platform::windows::bootstrap::check_registry_has_interception();
        let mem_has = if let Some(dll_path) = platform::windows::interception::find_interception_dll(&app) {
            if let Ok(lib) = platform::windows::interception::InterceptionLib::load(&dll_path) {
                let ctx = (lib.create_context)();
                if !ctx.is_null() {
                    (lib.destroy_context)(ctx);
                    true
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };

        if reg_has && mem_has {
            "active".to_string()
        } else if reg_has && !mem_has {
            "reboot_required_install".to_string()
        } else if !reg_has && mem_has {
            "reboot_required_uninstall".to_string()
        } else {
            "uninstalled".to_string()
        }
    }
    #[cfg(not(windows))]
    {
        "active".to_string()
    }
}

#[command]
fn check_driver_installed(app: tauri::AppHandle) -> bool {
    let status = check_driver_status(app);
    status == "active"
}

#[command]
fn restart_system() -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("shutdown")
            .args(["/r", "/t", "2", "/c", "IsuDeck surucu degisikligi icin bilgisayar yeniden baslatiliyor."])
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("systemctl")
            .arg("reboot")
            .spawn();
    }
    Ok(())
}

// ==========================================================
// 4. KOMUT İŞLEYİCİ (SEND_ACTION)
// ==========================================================

#[command]
async fn send_action(
    action_data: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<EngineState>>,
) -> Result<(), String> {
    let parsed: serde_json::Value = match serde_json::from_str(&action_data) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };

    let msg_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match msg_type {
        "ping" => {
            let _ = app.emit("INPUT_EVENT", serde_json::json!({ "type": "pong" }).to_string());
        }
        "init_block_list" => {
            if let Some(blocks) = parsed.get("blocks").and_then(|v| v.as_array()) {
                let mut new_set = HashSet::new();
                for b in blocks {
                    let hid = b.get("hid").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let key = b.get("key").and_then(|v| {
                        v.as_u64().map(|n| n as u16)
                            .or_else(|| v.as_str().and_then(|s| s.parse::<u16>().ok()))
                    });
                    if key.is_some() {
                        new_set.insert((hid, key.unwrap()));
                    }
                }
                println!("[RUST ENGINE] Block list updated: {} keys", new_set.len());
                let mut lock = state.block_list.lock().unwrap();
                *lock = new_set;
            }
        }
        "SET_MINIMIZE_TO_TRAY" => {
            if let Some(val) = parsed.get("value").and_then(|v| v.as_bool()) {
                let mut lock = state.minimize_to_tray.lock().unwrap();
                *lock = val;
                println!("[RUST ENGINE] Minimize to tray updated: {}", val);
            }
        }
        "SET_SYSTEM_VOLUME" => {
            let percent = parsed.get("percent")
                .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
                .unwrap_or(50.0);
            crate::platform::PlatformActions::set_system_master_volume(percent);
        }
        "EXECUTE_ACTION" => {
            if let Some(action_data_obj) = parsed.get("actionData") {
                if let Some(actions) = action_data_obj.get("actions").and_then(|v| v.as_array()) {
                    for act in actions {
                        let raw_type = act.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        let def_id = act.get("definitionId").and_then(|v| v.as_str()).unwrap_or("");

                        if matches!(raw_type, "SET_VARIABLE" | "CHANGE_VARIABLE" | "IF_CONDITION" | "LOOP_REPEAT")
                            || matches!(def_id, "SET_VARIABLE" | "CHANGE_VARIABLE" | "IF_CONDITION" | "LOOP_REPEAT") {
                            continue;
                        }

                        let is_core = matches!(
                            raw_type,
                            "OPEN_APP"
                                | "OPEN_URL"
                                | "HOTKEY"
                                | "MEDIA_BUTTON"
                                | "PLAY_SOUND"
                                | "DELAY"
                                | "SET_SYSTEM_VOLUME"
                                | "ADJUST_SYSTEM_VOLUME"
                                | "SET_SYSTEM_MUTE"
                                | "BRIGHTNESS_UP"
                                | "BRIGHTNESS_DOWN"
                                | "EMPTY_RECYCLE_BIN"
                                | "SYSTEM_SLEEP"
                                | "SCREENSHOT"
                                | "CLIPBOARD_HISTORY"
                                | "SHOW_DESKTOP"
                                | "TASK_MANAGER"
                                | "CLOSE_WINDOW"
                                | "LOCK_SCREEN"
                                | "TYPE_TEXT"
                                | "RUN_COMMAND"
                                | "OPEN_FOLDER"
                                | "VIRTUAL_DESKTOP_LEFT"
                                | "VIRTUAL_DESKTOP_RIGHT"
                        ) || matches!(
                            def_id,
                            "OPEN_APP"
                                | "OPEN_URL"
                                | "HOTKEY"
                                | "MEDIA_BUTTON"
                                | "PLAY_SOUND"
                                | "DELAY"
                                | "SET_SYSTEM_VOLUME"
                                | "ADJUST_SYSTEM_VOLUME"
                                | "SET_SYSTEM_MUTE"
                                | "VOLUME_UP"
                                | "VOLUME_DOWN"
                                | "MUTE"
                                | "MEDIA_PLAY"
                                | "MEDIA_STOP"
                                | "MEDIA_NEXT"
                                | "MEDIA_PREVIOUS"
                                | "BRIGHTNESS_UP"
                                | "BRIGHTNESS_DOWN"
                                | "EMPTY_RECYCLE_BIN"
                                | "SYSTEM_SLEEP"
                                | "SCREENSHOT"
                                | "CLIPBOARD_HISTORY"
                                | "SHOW_DESKTOP"
                                | "TASK_MANAGER"
                                | "CLOSE_WINDOW"
                                | "LOCK_SCREEN"
                                | "TYPE_TEXT"
                                | "RUN_COMMAND"
                                | "OPEN_FOLDER"
                                | "VIRTUAL_DESKTOP_LEFT"
                                | "VIRTUAL_DESKTOP_RIGHT"
                        );

                        if is_core {
                            println!("[RUST ENGINE] Executing core action: '{}' / '{}'", raw_type, def_id);
                            ActionRunner::run_action(act).await;
                        } else {
                            let lookup_key = if !raw_type.is_empty() && raw_type != "UNKNOWN" { raw_type } else { def_id };
                            if let Some(res) = state.plugin_manager.handle_execute(lookup_key, act) {
                                println!("[RUST ENGINE] Plugin action: {} - {}", res.success, res.message);
                            } else if let Some(res) = state.plugin_manager.handle_execute(def_id, act) {
                                println!("[RUST ENGINE] Plugin action (def_id): {} - {}", res.success, res.message);
                            } else {
                                println!("[RUST ENGINE] Plugin action handler not found: '{}' / '{}'", raw_type, def_id);
                            }
                        }
                    }
                }
            }
        }
        "GET_ACTION_DATA" => {
            let request_id = parsed.get("requestId").and_then(|v| v.as_str()).unwrap_or("");
            let action_name = parsed.get("action").and_then(|v| v.as_str()).unwrap_or("");
            let data_type = parsed.get("dataType").and_then(|v| v.as_str()).unwrap_or("");
            let empty_args = serde_json::json!({});
            let args = parsed.get("args").unwrap_or(&empty_args);

            state.plugin_manager.handle_get_action_data(&app, request_id, action_name, data_type, args);
        }
        "LOAD_PLUGINS" => {
            if let Ok(root) = isudeck_root(&app) {
                let plugins_dir = root.join("plugins");
                state.plugin_manager.load_plugins_from_dir(&plugins_dir);
            }
        }
        "RELOAD_PLUGINS" => {
            if let Ok(root) = isudeck_root(&app) {
                let plugins_dir = root.join("plugins");
                state.plugin_manager.reload_all(&plugins_dir);
            }
        }
        _ => {}
    }

    Ok(())
}

fn start_input_thread(app_handle: tauri::AppHandle, state: Arc<EngineState>) {
    #[cfg(windows)]
    {
        platform::windows::interception::start_windows_interception_thread(
            app_handle,
            state.block_list.clone(),
            state.blocked_keys_pressed.clone(),
        );
    }
    #[cfg(target_os = "linux")]
    {
        platform::linux::evdev::start_linux_input_thread(
            app_handle,
            state.block_list.clone(),
            state.blocked_keys_pressed.clone(),
        );
    }
}

#[command]
fn set_window_always_on_top(always_on_top: bool, app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn update_tray_language(lang: String, app: tauri::AppHandle) -> Result<(), String> {
    let (show_label, quit_label) = match lang.as_str() {
        "en" => ("Show IsuDeck", "Quit"),
        _ => ("IsuDeck'i Göster", "Çıkış Yap"),
    };

    if let (Ok(quit_i), Ok(show_i)) = (
        MenuItem::with_id(&app, "quit", quit_label, true, None::<&str>),
        MenuItem::with_id(&app, "show", show_label, true, None::<&str>),
    ) {
        if let Ok(menu) = Menu::with_items(&app, &[&show_i, &quit_i]) {
            if let Some(tray) = app.tray_by_id("tray") {
                let _ = tray.set_menu(Some(menu));
            }
        }
    }
    Ok(())
}

#[command]
async fn get_autostart_status(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[command]
async fn set_autostart(app: tauri::AppHandle, enable: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let auto = app.autolaunch();
    if enable {
        auto.enable().map_err(|e| e.to_string())?;
    } else {
        auto.disable().map_err(|e| e.to_string())?;
    }
    auto.is_enabled().map_err(|e| e.to_string())
}

// ==========================================================
// 6. ANA TAURI BAŞLATICI
// ==========================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let block_list_arc = Arc::new(Mutex::new(HashSet::new()));
    let plugin_mgr = PluginManager::new();

    let engine_state = Arc::new(EngineState {
        block_list: block_list_arc.clone(),
        blocked_keys_pressed: Arc::new(Mutex::new(HashSet::new())),
        plugin_manager: plugin_mgr,
        minimize_to_tray: Mutex::new(false),
    });

    let state_clone = engine_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_log::Builder::default().build())
        .manage(engine_state)
        .invoke_handler(tauri::generate_handler![
            fs_create_dir,
            fs_write_file,
            fs_read_file,
            fs_exists,
            fs_read_dir,
            send_action,
            fs_read_binary,
            manage_driver,
            check_driver_installed,
            check_driver_status,
            restart_system,
            open_sounds_dir,
            list_custom_sounds,
            play_sound_file,
            set_window_always_on_top,
            update_tray_language,
            get_autostart_status,
            set_autostart
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            state_clone.plugin_manager.set_app_handle(app_handle.clone());

            // 1. Bootstrap (fast - just creates dirs/files if missing)
            bootstrap_portable_environment(&app_handle);

            // 2. Heavy work in background so the window appears immediately
            let app_bg = app_handle.clone();
            let state_bg = state_clone.clone();
            std::thread::spawn(move || {
                // Load plugins from disk (may be slow with many plugins)
                if let Ok(root) = isudeck_root(&app_bg) {
                    let plugins_dir = root.join("plugins");
                    state_bg.plugin_manager.load_plugins_from_dir(&plugins_dir);
                }
                // Start platform input listener (evdev scan on Linux can be slow)
                start_input_thread(app_bg, state_bg);
            });

            // 3. Tray Menu (fast - must stay on main thread)
            let sys_lang = platform::os::detect_system_language();
            let (initial_show, initial_quit) = match sys_lang {
                "en" => ("Show IsuDeck", "Quit"),
                _ => ("IsuDeck'i Göster", "Çıkış Yap"),
            };

            if let (Ok(quit_i), Ok(show_i)) = (
                MenuItem::with_id(app, "quit", initial_quit, true, None::<&str>),
                MenuItem::with_id(app, "show", initial_show, true, None::<&str>),
            ) {
                if let Ok(menu) = Menu::with_items(app, &[&show_i, &quit_i]) {
                    if let Some(icon) = app.default_window_icon() {
                        let _ = TrayIconBuilder::with_id("tray")
                            .icon(icon.clone())
                            .menu(&menu)
                            .show_menu_on_left_click(false)
                            .on_menu_event(|app, event| match event.id.as_ref() {
                                "quit" => app.exit(0),
                                "show" => {
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                                _ => {}
                            })
                            .on_tray_icon_event(|tray, event| {
                                if let TrayIconEvent::Click {
                                    button: MouseButton::Left,
                                    ..
                                } = event
                                {
                                    let app = tray.app_handle();
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            })
                            .build(app);
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<Arc<EngineState>>();
                let minimize = {
                    let lock = state.minimize_to_tray.lock().unwrap();
                    *lock
                };
                if minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}