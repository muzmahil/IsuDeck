#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod interception;
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

use interception::{find_interception_dll, InterceptionLib, KeyStroke, INTERCEPTION_FILTER_KEY_ALL};
use action_runner::ActionRunner;
use plugin_manager::PluginManager;

// ==========================================================
// GÖMÜLÜ PORTABLE DOSYALAR (TEK EXE İÇİN)
// ==========================================================
static EMBEDDED_INTERCEPTION_DLL: &[u8] = include_bytes!("../engine/interception.dll");
static EMBEDDED_INSTALLER: &[u8] = include_bytes!("../drivers/install-interception.exe");
static EMBEDDED_SOUND_CLICK: &[u8] = include_bytes!("../../public/sounds/click.wav");
static EMBEDDED_SOUND_MECH: &[u8] = include_bytes!("../../public/sounds/mech.wav");
static EMBEDDED_SOUND_BEEP: &[u8] = include_bytes!("../../public/sounds/beep.wav");

const INSTALL_HELPER_CMD: &str = "@echo off\r\n\
setlocal enabledelayedexpansion\r\n\
set \"ACTION=%~1\"\r\n\
if /i \"%ACTION%\"==\"/uninstall\" goto :uninstall\r\n\
\"%~dp0install-interception.exe\" /install\r\n\
if %ERRORLEVEL% equ 0 exit /b 0\r\n\
if exist \"%SystemRoot%\\System32\\drivers\\keyboard.sys\" (\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\keyboard\" /v DisplayName /t REG_SZ /d \"Keyboard Upper Filter Driver\" /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\keyboard\" /v Type /t REG_DWORD /d 1 /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\keyboard\" /v Start /t REG_DWORD /d 1 /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\keyboard\" /v ErrorControl /t REG_DWORD /d 1 /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\mouse\" /v DisplayName /t REG_SZ /d \"Mouse Upper Filter Driver\" /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\mouse\" /v Type /t REG_DWORD /d 1 /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\mouse\" /v Start /t REG_DWORD /d 1 /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\mouse\" /v ErrorControl /t REG_DWORD /d 1 /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e96b-e325-11ce-bfc1-08002be10318}\" /v UpperFilters /t REG_MULTI_SZ /d \"keyboard\\0kbdclass\" /f >nul 2>&1\r\n\
    reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e96f-e325-11ce-bfc1-08002be10318}\" /v UpperFilters /t REG_MULTI_SZ /d \"mouse\\0mouclass\" /f >nul 2>&1\r\n\
    exit /b 0\r\n\
)\r\n\
exit /b 1\r\n\
:uninstall\r\n\
\"%~dp0install-interception.exe\" /uninstall\r\n\
exit /b %ERRORLEVEL%\r\n";

fn detect_system_language() -> &'static str {
    #[cfg(windows)]
    {
        extern "system" {
            fn GetUserDefaultUILanguage() -> u16;
        }
        let lang_id = unsafe { GetUserDefaultUILanguage() };
        if (lang_id & 0xFF) == 0x1F {
            return "tr";
        }
    }
    "en"
}

// ==========================================================
// 1. ENGINE STATE
// ==========================================================

pub struct EngineState {
    pub block_list: Arc<Mutex<HashSet<(String, u16)>>>,
    pub blocked_keys_pressed: Mutex<HashSet<(i32, u16)>>,
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
                if ancestor.join("plugins").exists() && (ancestor.join("profiles.json").exists() || ancestor.join("plugins").join("IsuDeck.OBSPlugin").exists()) {
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

// İlk açılışta gerekli tüm klasör ve dosyaları programın yanına açar
fn bootstrap_portable_environment(app: &tauri::AppHandle) {
    let root = match isudeck_root(app) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[BOOTSTRAP] Kök dizin tespit edilemedi: {}", e);
            return;
        }
    };

    println!("📁 [BOOTSTRAP] IsuDeck Portable Dizin: {}", root.display());

    // 1. interception.dll yoksa oluştur
    let dll_path = root.join("interception.dll");
    if !dll_path.exists() {
        let _ = fs::write(&dll_path, EMBEDDED_INTERCEPTION_DLL);
        println!("✨ [BOOTSTRAP] interception.dll çıkartıldı.");
    }

    // 2. drivers/install-interception.exe ve install_helper.cmd yoksa oluştur
    let drivers_dir = root.join("drivers");
    let _ = fs::create_dir_all(&drivers_dir);
    let installer_path = drivers_dir.join("install-interception.exe");
    if !installer_path.exists() {
        let _ = fs::write(&installer_path, EMBEDDED_INSTALLER);
        println!("✨ [BOOTSTRAP] drivers/install-interception.exe çıkartıldı.");
    }
    let helper_path = drivers_dir.join("install_helper.cmd");
    let _ = fs::write(&helper_path, INSTALL_HELPER_CMD);

    // 3. sounds/ klasörü ve varsayılan sesleri oluştur
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

    // 4. plugins/ klasörünü oluştur
    let plugins_dir = root.join("plugins");
    let _ = fs::create_dir_all(&plugins_dir);

    // 5. profiles.json yoksa varsayılan profil oluştur
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
        println!("✨ [BOOTSTRAP] profiles.json oluşturuldu.");
    }

    // 6. settings.json yoksa varsayılan ayarları oluştur (Sistem diline göre)
    let settings_path = root.join("settings.json");
    if !settings_path.exists() {
        let default_lang = detect_system_language();
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
        println!("✨ [BOOTSTRAP] settings.json oluşturuldu (Dil: {}).", default_lang);
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

// Ses Klasörünü Windows Explorer'da Aç
#[command]
fn open_sounds_dir(app: tauri::AppHandle) -> Result<(), String> {
    let root = isudeck_root(&app)?;
    let sounds_dir = root.join("sounds");
    fs::create_dir_all(&sounds_dir).map_err(|e| e.to_string())?;
    
    std::process::Command::new("explorer")
        .arg(sounds_dir.display().to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Ses Dosyalarını Listele
#[command]
fn list_custom_sounds(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let root = isudeck_root(&app)?;
    let sounds_dir = root.join("sounds");
    fs::create_dir_all(&sounds_dir).map_err(|e| e.to_string())?;

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

// Ses Çal (Yerel winmm ile gecikmesiz çalma)
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

fn find_driver_installer(app: &tauri::AppHandle, action: &str) -> Option<(PathBuf, String)> {
    let flag = if action == "install" { "/install" } else { "/uninstall" };
    if let Ok(root) = isudeck_root(app) {
        let helper = root.join("drivers").join("install_helper.cmd");
        if helper.exists() {
            return Some((PathBuf::from("cmd.exe"), format!("/c \"{}\" {}", helper.display(), flag)));
        }
        let p1 = root.join("drivers").join("install-interception.exe");
        if p1.exists() { return Some((p1, flag.to_string())); }
        let p2 = root.join("install-interception.exe");
        if p2.exists() { return Some((p2, flag.to_string())); }
    }
    None
}

fn check_registry_has_interception() -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::System::Registry::{
            RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_LOCAL_MACHINE, KEY_READ,
        };

        let subkey: Vec<u16> = std::ffi::OsStr::new("SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e96b-e325-11ce-bfc1-08002be10318}")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let val_name: Vec<u16> = std::ffi::OsStr::new("UpperFilters")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey: HKEY = std::ptr::null_mut();
        let res = unsafe {
            RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                subkey.as_ptr(),
                0,
                KEY_READ,
                &mut hkey,
            )
        };

        if res != 0 || hkey.is_null() {
            return false;
        }

        let mut buf: Vec<u16> = vec![0; 1024];
        let mut buf_size = (buf.len() * 2) as u32;
        let mut val_type = 0;

        let q_res = unsafe {
            RegQueryValueExW(
                hkey,
                val_name.as_ptr(),
                std::ptr::null_mut(),
                &mut val_type,
                buf.as_mut_ptr() as *mut u8,
                &mut buf_size,
            )
        };

        unsafe { RegCloseKey(hkey) };

        if q_res == 0 {
            let str_val = String::from_utf16_lossy(&buf);
            return str_val.to_lowercase().contains("keyboard");
        }
    }
    false
}

fn run_silent_elevated(exe_path: &std::path::Path, args: &str) -> Result<bool, String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Foundation::FALSE;
        use windows_sys::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};
        use windows_sys::Win32::UI::Shell::{
            ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

        let verb: Vec<u16> = std::ffi::OsStr::new("runas")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let file: Vec<u16> = exe_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let params: Vec<u16> = std::ffi::OsStr::new(args)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut exec_info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOCLOSEPROCESS,
            hwnd: std::ptr::null_mut(),
            lpVerb: verb.as_ptr(),
            lpFile: file.as_ptr(),
            lpParameters: params.as_ptr(),
            lpDirectory: std::ptr::null(),
            nShow: SW_HIDE,
            hInstApp: std::ptr::null_mut(),
            lpIDList: std::ptr::null_mut(),
            lpClass: std::ptr::null(),
            hkeyClass: std::ptr::null_mut(),
            dwHotKey: 0,
            Anonymous: unsafe { std::mem::zeroed() },
            hProcess: std::ptr::null_mut(),
        };

        let ok = unsafe { ShellExecuteExW(&mut exec_info) };
        if ok == FALSE || exec_info.hProcess.is_null() {
            return Err("Kullanıcı yönetici onayını (UAC) iptal etti veya işlem başlatılamadı.".to_string());
        }

        let h_proc = exec_info.hProcess;
        unsafe {
            WaitForSingleObject(h_proc, INFINITE);
            let mut exit_code: u32 = 0;
            GetExitCodeProcess(h_proc, &mut exit_code);
            windows_sys::Win32::Foundation::CloseHandle(h_proc);
            Ok(exit_code == 0)
        }
    }
    #[cfg(not(windows))]
    {
        Err("Yalnızca Windows işletim sisteminde desteklenmektedir.".to_string())
    }
}

#[command]
async fn manage_driver(app: tauri::AppHandle, action: String) -> Result<String, String> {
    let (installer, args) = find_driver_installer(&app, &action).ok_or("drivers/install-interception.exe bulunamadı.")?;

    let success = tauri::async_runtime::spawn_blocking(move || {
        run_silent_elevated(&installer, &args)
    })
    .await
    .map_err(|e| e.to_string())??;

    if success {
        Ok(action)
    } else {
        Err("Sürücü işlemi tamamlanamadı veya yönetici izni reddedildi.".to_string())
    }
}

#[command]
fn check_driver_status(app: tauri::AppHandle) -> String {
    let reg_has = check_registry_has_interception();
    let mem_has = if let Some(dll_path) = find_interception_dll(&app) {
        if let Ok(lib) = InterceptionLib::load(&dll_path) {
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

#[command]
fn check_driver_installed(app: tauri::AppHandle) -> bool {
    let status = check_driver_status(app);
    status == "active"
}

#[command]
fn restart_system() -> Result<(), String> {
    let _ = std::process::Command::new("shutdown")
        .args(["/r", "/t", "2", "/c", "IsuDeck surucu degisikligi icin bilgisayar yeniden baslatiliyor."])
        .spawn();
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
                println!("[RUST ENGINE] Blok listesi güncellendi: {} tuş", new_set.len());
                let mut lock = state.block_list.lock().unwrap();
                *lock = new_set;
            }
        }
        "SET_MINIMIZE_TO_TRAY" => {
            if let Some(val) = parsed.get("value").and_then(|v| v.as_bool()) {
                let mut lock = state.minimize_to_tray.lock().unwrap();
                *lock = val;
                println!("[RUST ENGINE] Minimize to tray güncellendi: {}", val);
            }
        }
        "SET_SYSTEM_VOLUME" => {
            let percent = parsed.get("percent")
                .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
                .unwrap_or(50.0);
            ActionRunner::set_system_master_volume(percent);
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
                            println!("[RUST ENGINE] Core Action çalıştırılıyor: '{}' / '{}'", raw_type, def_id);
                            ActionRunner::run_action(act).await;
                        } else {
                            let lookup_key = if !raw_type.is_empty() && raw_type != "UNKNOWN" { raw_type } else { def_id };
                            if let Some(res) = state.plugin_manager.handle_execute(lookup_key, act) {
                                println!("[RUST ENGINE] Eklenti Aksiyon: {} - {}", res.success, res.message);
                            } else if let Some(res) = state.plugin_manager.handle_execute(def_id, act) {
                                println!("[RUST ENGINE] Eklenti Aksiyon (def_id): {} - {}", res.success, res.message);
                            } else {
                                println!("[RUST ENGINE] Eklenti Aksiyon işleyicisi bulunamadı: '{}' / '{}'", raw_type, def_id);
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

// ==========================================================
// 5. INTERCEPTION ARKA PLAN DİNLEYİCİSİ (ULTRA DÜŞÜK GECİKME)
// ==========================================================

fn start_interception_thread(app_handle: tauri::AppHandle, state: Arc<EngineState>) {
    let dll_path = match find_interception_dll(&app_handle) {
        Some(p) => p,
        None => {
            eprintln!("[RUST ENGINE] interception.dll bulunamadı.");
            return;
        }
    };

    let lib = match InterceptionLib::load(&dll_path) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[RUST ENGINE] interception.dll yüklenemedi: {}", e);
            return;
        }
    };

    std::thread::spawn(move || {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Threading::{
                GetCurrentProcess, GetCurrentThread, SetPriorityClass, SetThreadPriority,
                HIGH_PRIORITY_CLASS, THREAD_PRIORITY_TIME_CRITICAL,
            };

            #[link(name = "winmm")]
            extern "system" {
                fn timeBeginPeriod(uPeriod: u32) -> u32;
            }

            let _ = timeBeginPeriod(1);
            let _ = SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
            let _ = SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
        }

        let context = (lib.create_context)();
        if context.is_null() {
            eprintln!("[RUST ENGINE] Interception context oluşturulamadı (Sürücü kurulu olmayabilir).");
            return;
        }

        (lib.set_filter)(context, *lib.is_keyboard, INTERCEPTION_FILTER_KEY_ALL);
        println!("🚀 [RUST ENGINE] Interception dinleyici thread devrede! (THREAD_PRIORITY_TIME_CRITICAL / 1ms Timer)");

        let mut stroke = KeyStroke::default();

        loop {
            let device = (lib.wait)(context);
            if device == 0 {
                break;
            }

            let received = (lib.receive)(context, device, &mut stroke, 1);
            if received <= 0 {
                continue;
            }

            let is_down = (stroke.state & 1) == 0;
            let hid = lib.get_device_hid(context, device);
            let key_code = stroke.code;

            let is_blocked = {
                let lock = state.block_list.lock().unwrap();
                lock.contains(&(hid.clone(), key_code))
            };

            if is_down {
                if is_blocked {
                    {
                        let mut pressed = state.blocked_keys_pressed.lock().unwrap();
                        pressed.insert((device, key_code));
                    }

                    let payload = serde_json::json!({
                        "type": "inputPressed",
                        "hid": hid,
                        "handler": device,
                        "key": key_code
                    });
                    let _ = app_handle.emit("INPUT_EVENT", &payload);
                } else {
                    // Engellenmeyen tuşları Windows'a gecikmesiz olarak hemen ilet
                    (lib.send)(context, device, &stroke, 1);

                    let payload = serde_json::json!({
                        "type": "inputPressed",
                        "hid": hid,
                        "handler": device,
                        "key": key_code
                    });
                    let _ = app_handle.emit("INPUT_EVENT", &payload);
                }
            } else {
                let was_blocked = {
                    let mut pressed = state.blocked_keys_pressed.lock().unwrap();
                    pressed.remove(&(device, key_code))
                };

                if !was_blocked {
                    (lib.send)(context, device, &stroke, 1);
                }
            }
        }

        (lib.destroy_context)(context);
    });
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

// ==========================================================
// 6. ANA TAURI BAŞLATICI
// ==========================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let block_list_arc = Arc::new(Mutex::new(HashSet::new()));
    let plugin_mgr = PluginManager::new();

    let engine_state = Arc::new(EngineState {
        block_list: block_list_arc.clone(),
        blocked_keys_pressed: Mutex::new(HashSet::new()),
        plugin_manager: plugin_mgr,
        minimize_to_tray: Mutex::new(false),
    });

    let state_clone = engine_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
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
            update_tray_language
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            state_clone.plugin_manager.set_app_handle(app_handle.clone());

            // 1. Taşınabilir ortamı başlat (Tek exe için gerekli klasör ve dosyaları oluşturur)
            bootstrap_portable_environment(&app_handle);

            // 2. Dış eklentileri plugins/ dizininden dinamik olarak yükle ve süreçlerini başlat
            if let Ok(root) = isudeck_root(&app_handle) {
                let plugins_dir = root.join("plugins");
                state_clone.plugin_manager.load_plugins_from_dir(&plugins_dir);
            }

            // 3. Interception dinleyicisini başlat
            start_interception_thread(app_handle, state_clone);

            // 4. Tray Menü
            let sys_lang = detect_system_language();
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
                let should_minimize = {
                    let state = window.state::<Arc<EngineState>>();
                    let lock = state.minimize_to_tray.lock().unwrap();
                    *lock
                };

                if should_minimize {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Tauri başlatılırken hata oluştu");
}