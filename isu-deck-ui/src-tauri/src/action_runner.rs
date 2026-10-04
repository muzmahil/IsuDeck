use std::time::Duration;
use serde_json::Value;
use crate::platform::PlatformActions;

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
                    let mut cmd = std::process::Command::new(path);
                    if !args.is_empty() {
                        cmd.args(args.split_whitespace());
                    }
                    let _ = cmd.spawn();
                }
            }
            "OPEN_URL" => {
                let url = action.get("url").and_then(|v| v.as_str()).unwrap_or("");
                PlatformActions::open_url(url);
            }
            "HOTKEY" => {
                let key_combo = action.get("key").and_then(|v| v.as_str()).unwrap_or("");
                if !key_combo.is_empty() {
                    PlatformActions::simulate_hotkey(key_combo);
                }
            }
            "SCREENSHOT" => {
                PlatformActions::simulate_hotkey("WIN+SHIFT+S");
            }
            "CLIPBOARD_HISTORY" => {
                PlatformActions::simulate_hotkey("WIN+V");
            }
            "SHOW_DESKTOP" => {
                PlatformActions::simulate_hotkey("WIN+D");
            }
            "TASK_MANAGER" => {
                PlatformActions::simulate_hotkey("CTRL+SHIFT+ESC");
            }
            "CLOSE_WINDOW" => {
                PlatformActions::simulate_hotkey("ALT+F4");
            }
            "LOCK_SCREEN" => {
                PlatformActions::simulate_hotkey("WIN+L");
            }
            "VIRTUAL_DESKTOP_LEFT" => {
                PlatformActions::simulate_hotkey("WIN+CTRL+LEFT");
            }
            "VIRTUAL_DESKTOP_RIGHT" => {
                PlatformActions::simulate_hotkey("WIN+CTRL+RIGHT");
            }
            "TYPE_TEXT" => {
                let text = action.get("text").and_then(|v| v.as_str()).unwrap_or("");
                if !text.is_empty() {
                    PlatformActions::type_text_string(text);
                }
            }
            "RUN_COMMAND" => {
                let cmd_str = action.get("command").and_then(|v| v.as_str()).unwrap_or("");
                let silent = action.get("silent").and_then(|v| v.as_bool()).unwrap_or(true);
                PlatformActions::run_command(cmd_str, silent);
            }
            "OPEN_FOLDER" => {
                let folder = action.get("folder").and_then(|v| v.as_str()).unwrap_or("");
                PlatformActions::open_folder(folder);
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
                    PlatformActions::send_media_key(button);
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
            }
            "PLAY_SOUND" => {
                let path = action.get("path").and_then(|v| v.as_str()).unwrap_or("");
                if !path.is_empty() {
                    PlatformActions::play_audio_file(path);
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
                PlatformActions::set_system_master_volume(percent);
            }
            "ADJUST_SYSTEM_VOLUME" => {
                let delta = action.get("delta")
                    .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
                    .unwrap_or(0.0);
                if delta > 0.0 {
                    let steps = (delta / 2.0).ceil().max(1.0) as usize;
                    for _ in 0..steps {
                        PlatformActions::send_media_key("volumeup");
                        tokio::time::sleep(Duration::from_millis(15)).await;
                    }
                } else if delta < 0.0 {
                    let steps = ((-delta) / 2.0).ceil().max(1.0) as usize;
                    for _ in 0..steps {
                        PlatformActions::send_media_key("volumedown");
                        tokio::time::sleep(Duration::from_millis(15)).await;
                    }
                }
            }
            "SET_SYSTEM_MUTE" => {
                PlatformActions::send_media_key("mute");
            }
            "BRIGHTNESS_UP" => {
                PlatformActions::brightness_up();
            }
            "BRIGHTNESS_DOWN" => {
                PlatformActions::brightness_down();
            }
            "EMPTY_RECYCLE_BIN" => {
                PlatformActions::empty_recycle_bin();
            }
            "SYSTEM_SLEEP" => {
                PlatformActions::system_sleep();
            }
            _ => {
                println!("[ActionRunner] Bilinmeyen temel eylem tipi: {}", action_type);
            }
        }
    }

    pub fn play_audio_file(path: &str) {
        PlatformActions::play_audio_file(path);
    }
}
