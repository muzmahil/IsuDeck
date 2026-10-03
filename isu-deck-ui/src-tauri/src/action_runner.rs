use std::process::Command;
use std::time::Duration;
use serde_json::Value;

#[link(name = "winmm")]
extern "system" {
    fn mciSendStringW(
        lpsz_command: *const u16,
        lpsz_return_string: *mut u16,
        cch_return: u32,
        hwnd_callback: *mut std::ffi::c_void,
    ) -> u32;
}

pub struct ActionRunner;

impl ActionRunner {
    pub async fn run_action(action: &Value) {
        let action_type = action.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let def_id = action.get("definitionId").and_then(|v| v.as_str()).unwrap_or("");

        let effective_type = if matches!(
            action_type,
            "OPEN_APP"
                | "OPEN_URL"
                | "HOTKEY"
                | "MEDIA_BUTTON"
                | "PLAY_SOUND"
                | "DELAY"
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
        ) {
            action_type
        } else if matches!(
            def_id,
            "OPEN_APP"
                | "OPEN_URL"
                | "HOTKEY"
                | "MEDIA_BUTTON"
                | "PLAY_SOUND"
                | "DELAY"
                | "VOLUME_UP"
                | "VOLUME_DOWN"
                | "MUTE"
                | "MEDIA_PLAY"
                | "MEDIA_STOP"
                | "MEDIA_NEXT"
                | "MEDIA_PREVIOUS"
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
        ) {
            if def_id.starts_with("VOLUME_") || def_id.starts_with("MEDIA_") || def_id == "MUTE" {
                "MEDIA_BUTTON"
            } else {
                def_id
            }
        } else {
            action_type
        };

        match effective_type {
            "OPEN_APP" => {
                let path = action.get("path").and_then(|v| v.as_str()).unwrap_or("");
                let args = action.get("args").and_then(|v| v.as_str()).unwrap_or("");
                if !path.is_empty() {
                    let mut cmd = Command::new(path);
                    if !args.is_empty() {
                        cmd.args(args.split_whitespace());
                    }
                    let _ = cmd.spawn();
                }
            }
            "OPEN_URL" => {
                let url = action.get("url").and_then(|v| v.as_str()).unwrap_or("");
                if !url.is_empty() {
                    let _ = Command::new("cmd")
                        .args(["/c", "start", "", url])
                        .spawn();
                }
            }
            "HOTKEY" => {
                let key_combo = action.get("key").and_then(|v| v.as_str()).unwrap_or("");
                if !key_combo.is_empty() {
                    Self::simulate_hotkey(key_combo);
                }
            }
            "SCREENSHOT" => {
                Self::simulate_hotkey("WIN+SHIFT+S");
            }
            "CLIPBOARD_HISTORY" => {
                Self::simulate_hotkey("WIN+V");
            }
            "SHOW_DESKTOP" => {
                Self::simulate_hotkey("WIN+D");
            }
            "TASK_MANAGER" => {
                Self::simulate_hotkey("CTRL+SHIFT+ESC");
            }
            "CLOSE_WINDOW" => {
                Self::simulate_hotkey("ALT+F4");
            }
            "LOCK_SCREEN" => {
                Self::simulate_hotkey("WIN+L");
            }
            "VIRTUAL_DESKTOP_LEFT" => {
                Self::simulate_hotkey("WIN+CTRL+LEFT");
            }
            "VIRTUAL_DESKTOP_RIGHT" => {
                Self::simulate_hotkey("WIN+CTRL+RIGHT");
            }
            "TYPE_TEXT" => {
                let text = action.get("text").and_then(|v| v.as_str()).unwrap_or("");
                if !text.is_empty() {
                    Self::type_text_string(text);
                }
            }
            "RUN_COMMAND" => {
                let cmd_str = action.get("command").and_then(|v| v.as_str()).unwrap_or("");
                let silent = action.get("silent").and_then(|v| v.as_bool()).unwrap_or(true);
                if !cmd_str.is_empty() {
                    use std::os::windows::process::CommandExt;
                    let mut cmd = Command::new("powershell");
                    if silent {
                        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                        cmd.args(["-NoProfile", "-NonInteractive", "-Command", cmd_str]);
                    } else {
                        cmd.args(["-NoExit", "-Command", cmd_str]);
                    }
                    let _ = cmd.spawn();
                }
            }
            "OPEN_FOLDER" => {
                let folder = action.get("folder").and_then(|v| v.as_str()).unwrap_or("");
                if !folder.is_empty() {
                    let _ = Command::new("explorer").arg(folder).spawn();
                } else {
                    Self::simulate_hotkey("WIN+E");
                }
            }
            "MEDIA_BUTTON" => {
                let mut button = action.get("button").and_then(|v| v.as_str()).unwrap_or("");
                if button.is_empty() {
                    button = match def_id {
                        "VOLUME_UP" => "volumeup",
                        "VOLUME_DOWN" => "volumedown",
                        "MUTE" => "mute",
                        "MEDIA_PLAY" => "playpause",
                        "MEDIA_STOP" => "stop",
                        "MEDIA_NEXT" => "next",
                        "MEDIA_PREVIOUS" => "previous",
                        _ => "",
                    };
                }
                let multiplier = action.get("multiplier")
                    .and_then(|v| v.as_i64().or_else(|| v.as_str()?.parse().ok()))
                    .unwrap_or(1)
                    .max(1) as usize;

                for _ in 0..multiplier {
                    Self::send_media_key(button);
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
            }
            "PLAY_SOUND" => {
                let path = action.get("path").and_then(|v| v.as_str()).unwrap_or("");
                if !path.is_empty() {
                    Self::play_audio_file(path);
                }
            }
            "DELAY" => {
                let duration = action.get("duration")
                    .and_then(|v| v.as_u64().or_else(|| v.as_str()?.parse().ok()))
                    .unwrap_or(100);
                tokio::time::sleep(Duration::from_millis(duration)).await;
            }
            "SET_SYSTEM_VOLUME" => {
                let percent = action.get("percent")
                    .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
                    .unwrap_or(50.0);
                Self::set_system_master_volume(percent);
            }
            "ADJUST_SYSTEM_VOLUME" => {
                let delta = action.get("delta")
                    .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
                    .unwrap_or(0.0);
                if delta > 0.0 {
                    let steps = (delta / 2.0).ceil().max(1.0) as usize;
                    for _ in 0..steps {
                        Self::send_media_key("volumeup");
                        tokio::time::sleep(Duration::from_millis(15)).await;
                    }
                } else if delta < 0.0 {
                    let steps = ((-delta) / 2.0).ceil().max(1.0) as usize;
                    for _ in 0..steps {
                        Self::send_media_key("volumedown");
                        tokio::time::sleep(Duration::from_millis(15)).await;
                    }
                }
            }
            "SET_SYSTEM_MUTE" => {
                Self::send_media_key("mute");
            }
            "BRIGHTNESS_UP" => {
                let ps_cmd = "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, [Math]::Min(100, (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness + 10))";
                use std::os::windows::process::CommandExt;
                let _ = Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", ps_cmd])
                    .creation_flags(0x08000000)
                    .spawn();
            }
            "BRIGHTNESS_DOWN" => {
                let ps_cmd = "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, [Math]::Max(0, (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness - 10))";
                use std::os::windows::process::CommandExt;
                let _ = Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", ps_cmd])
                    .creation_flags(0x08000000)
                    .spawn();
            }
            "EMPTY_RECYCLE_BIN" => {
                use std::os::windows::process::CommandExt;
                let _ = Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"])
                    .creation_flags(0x08000000)
                    .spawn();
            }
            "SYSTEM_SLEEP" => {
                use std::os::windows::process::CommandExt;
                let _ = Command::new("rundll32.exe")
                    .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                    .creation_flags(0x08000000)
                    .spawn();
            }
            _ => {
                println!("[ActionRunner] Bilinmeyen temel eylem tipi: {}", action_type);
            }
        }
    }

    pub fn set_system_master_volume(level_percent: f64) {
        let scalar = (level_percent.clamp(0.0, 100.0) / 100.0) as f32;
        let ps_cmd = format!(
            "$w=New-Object -ComObject Wscript.Shell; \
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid(\"5CDF2C82-841E-4546-9722-0CF74078229A\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {{
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
}}
[Guid(\"D666063F-1587-4E43-81F1-B948E807363F\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {{
    int Activate(ref System.Guid id, int clsCtx, IntPtr activationParams, out IAudioEndpointVolume aev);
}}
[Guid(\"A95664D2-9614-4F35-A746-DE8DB63617E6\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {{
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}}
[ComImport, Guid(\"BCDE0395-E52F-467C-8E3D-C4579291692E\")]
public class MMDeviceEnumerator {{ }}
public class AudioHelper {{
    public static void SetVolume(float level) {{
        IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        IMMDevice device;
        enumerator.GetDefaultAudioEndpoint(0, 1, out device);
        IAudioEndpointVolume epv;
        Guid iid = typeof(IAudioEndpointVolume).GUID;
        device.Activate(ref iid, 23, IntPtr.Zero, out epv);
        epv.SetMasterVolumeLevelScalar(level, Guid.Empty);
    }}
}}
'@
[AudioHelper]::SetVolume({});",
            scalar
        );

        use std::os::windows::process::CommandExt;
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_cmd])
            .creation_flags(0x08000000)
            .spawn();
    }

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn play_audio_file(path: &str) {
        let mut final_path = std::path::PathBuf::from(path);
        if !final_path.exists() {
            if let Ok(exe) = std::env::current_exe() {
                if let Some(parent) = exe.parent() {
                    let p1 = parent.join("sounds").join(path);
                    if p1.exists() {
                        final_path = p1;
                    } else {
                        let p2 = parent.join(path);
                        if p2.exists() {
                            final_path = p2;
                        }
                    }
                }
            }
        }
        let clean_path = final_path.to_string_lossy().replace('/', "\\");
        let close_cmd = Self::to_wide("close isu_deck_sound");
        let open_cmd = Self::to_wide(&format!("open \"{}\" type mpegvideo alias isu_deck_sound", clean_path));
        let play_cmd = Self::to_wide("play isu_deck_sound from 0");

        unsafe {
            mciSendStringW(close_cmd.as_ptr(), std::ptr::null_mut(), 0, std::ptr::null_mut());
            mciSendStringW(open_cmd.as_ptr(), std::ptr::null_mut(), 0, std::ptr::null_mut());
            mciSendStringW(play_cmd.as_ptr(), std::ptr::null_mut(), 0, std::ptr::null_mut());
        }
    }

    fn send_media_key(btn: &str) {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            keybd_event, KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, VK_MEDIA_NEXT_TRACK,
            VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK, VK_MEDIA_STOP, VK_VOLUME_DOWN,
            VK_VOLUME_MUTE, VK_VOLUME_UP,
        };

        let vk: u8 = match btn.to_lowercase().as_str() {
            "volumeup" | "volume_up" => VK_VOLUME_UP as u8,
            "volumedown" | "volume_down" => VK_VOLUME_DOWN as u8,
            "mute" => VK_VOLUME_MUTE as u8,
            "playpause" | "play_pause" | "play" | "pause" => VK_MEDIA_PLAY_PAUSE as u8,
            "stop" => VK_MEDIA_STOP as u8,
            "next" => VK_MEDIA_NEXT_TRACK as u8,
            "previous" | "prev" => VK_MEDIA_PREV_TRACK as u8,
            _ => return,
        };

        unsafe {
            keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, 0);
            std::thread::sleep(Duration::from_millis(30));
            keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
        }
    }

    fn simulate_hotkey(combo: &str) {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            keybd_event, KEYEVENTF_KEYUP, VK_CONTROL, VK_LWIN, VK_MENU, VK_SHIFT,
        };

        let parts: Vec<&str> = combo.split('+').map(|s| s.trim()).collect();
        let mut keys_to_release = Vec::new();

        for part in parts {
            let upper = part.to_uppercase();
            let vk: u8 = match upper.as_str() {
                "CTRL" | "CONTROL" => VK_CONTROL as u8,
                "SHIFT" => VK_SHIFT as u8,
                "ALT" => VK_MENU as u8,
                "WIN" | "WINDOWS" => VK_LWIN as u8,
                s if s.len() == 1 => s.as_bytes()[0],
                s if s.starts_with('F') && s.len() <= 3 => {
                    if let Ok(num) = s[1..].parse::<u8>() {
                        if num >= 1 && num <= 24 {
                            0x6F + num
                        } else { 0 }
                    } else { 0 }
                }
                "ENTER" | "RETURN" => 0x0D,
                "ESC" | "ESCAPE" => 0x1B,
                "TAB" => 0x09,
                "SPACE" => 0x20,
                "BACKSPACE" => 0x08,
                "DELETE" | "DEL" => 0x2E,
                "LEFT" => 0x25,
                "UP" => 0x26,
                "RIGHT" => 0x27,
                "DOWN" => 0x28,
                "PRINTSCREEN" | "PRTSC" => 0x2C,
                "INSERT" => 0x2D,
                "HOME" => 0x24,
                "END" => 0x23,
                "PAGEUP" | "PGUP" => 0x21,
                "PAGEDOWN" | "PGDN" => 0x22,
                _ => 0,
            };

            if vk != 0 {
                unsafe { keybd_event(vk, 0, 0, 0); }
                keys_to_release.push(vk);
            }
        }

        std::thread::sleep(Duration::from_millis(20));

        // Ters sırada serbest bırak
        for vk in keys_to_release.into_iter().rev() {
            unsafe { keybd_event(vk, 0, KEYEVENTF_KEYUP, 0); }
        }
    }

    fn type_text_string(text: &str) {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
            KEYEVENTF_UNICODE,
        };

        for ch in text.encode_utf16() {
            let mut inputs = [
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: 0,
                            wScan: ch,
                            dwFlags: KEYEVENTF_UNICODE,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: 0,
                            wScan: ch,
                            dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
            ];

            unsafe {
                SendInput(
                    inputs.len() as u32,
                    inputs.as_mut_ptr(),
                    std::mem::size_of::<INPUT>() as i32,
                );
            }
            std::thread::sleep(Duration::from_millis(5));
        }
    }
}
