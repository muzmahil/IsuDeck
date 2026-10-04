use std::process::Command;
use std::time::Duration;

pub struct LinuxActions;

impl LinuxActions {
    pub fn open_url(url: &str) {
        if !url.is_empty() {
            let _ = Command::new("xdg-open").arg(url).spawn();
        }
    }

    pub fn open_folder(folder: &str) {
        if !folder.is_empty() {
            let _ = Command::new("xdg-open").arg(folder).spawn();
        } else {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            let _ = Command::new("xdg-open").arg(home).spawn();
        }
    }

    pub fn run_command(cmd_str: &str, _silent: bool) {
        if !cmd_str.is_empty() {
            let _ = Command::new("sh")
                .arg("-c")
                .arg(cmd_str)
                .spawn();
        }
    }

    pub fn brightness_up() {
        if Command::new("brightnessctl").args(["set", "+10%"]).spawn().is_err() {
            let _ = Command::new("xbacklight").args(["-inc", "10"]).spawn();
        }
    }

    pub fn brightness_down() {
        if Command::new("brightnessctl").args(["set", "10%-"]).spawn().is_err() {
            let _ = Command::new("xbacklight").args(["-dec", "10"]).spawn();
        }
    }

    pub fn empty_recycle_bin() {
        if Command::new("trash-empty").spawn().is_err() {
            let _ = Command::new("sh")
                .arg("-c")
                .arg("rm -rf ~/.local/share/Trash/*")
                .spawn();
        }
    }

    pub fn system_sleep() {
        let _ = Command::new("systemctl").arg("suspend").spawn();
    }

    pub fn set_system_master_volume(level_percent: f64) {
        let level = level_percent.clamp(0.0, 100.0) / 100.0;
        // 1. PipeWire / WirePlumber
        if Command::new("wpctl")
            .args(["set-volume", "@DEFAULT_AUDIO_SINK@", &format!("{:.2}", level)])
            .spawn()
            .is_err()
        {
            // 2. PulseAudio
            if Command::new("pactl")
                .args(["set-sink-volume", "@DEFAULT_SINK@", &format!("{}%", level_percent.round() as i64)])
                .spawn()
                .is_err()
            {
                // 3. ALSA
                let _ = Command::new("amixer")
                    .args(["sset", "Master", &format!("{}%", level_percent.round() as i64)])
                    .spawn();
            }
        }
    }

    pub fn play_audio_file(path: &str) {
        let mut final_path = std::path::PathBuf::from(path);
        if !final_path.exists() {
            if let Ok(exe) = std::env::current_exe() {
                if let Some(parent) = exe.parent() {
                    let p1 = parent.join("sounds").join(path);
                    if p1.exists() {
                        final_path = p1;
                    }
                }
            }
        }

        let path_str = final_path.to_string_lossy();
        if Command::new("paplay").arg(&*path_str).spawn().is_err() {
            if Command::new("pw-play").arg(&*path_str).spawn().is_err() {
                let _ = Command::new("aplay").arg(&*path_str).spawn();
            }
        }
    }

    pub fn send_media_key(btn: &str) {
        let playerctl_cmd = match btn.to_lowercase().as_str() {
            "volumeup" | "volume_up" => {
                let _ = Command::new("wpctl").args(["set-volume", "@DEFAULT_AUDIO_SINK@", "5%+"]).spawn();
                return;
            }
            "volumedown" | "volume_down" => {
                let _ = Command::new("wpctl").args(["set-volume", "@DEFAULT_AUDIO_SINK@", "5%-"]).spawn();
                return;
            }
            "mute" => {
                let _ = Command::new("wpctl").args(["set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"]).spawn();
                return;
            }
            "playpause" | "play_pause" | "play" | "pause" => "play-pause",
            "stop" => "stop",
            "next" => "next",
            "previous" | "prev" => "previous",
            _ => return,
        };

        let _ = Command::new("playerctl").arg(playerctl_cmd).spawn();
    }

    pub fn simulate_hotkey(combo: &str) {
        // xdotool / ydotool desteği
        let _ = Command::new("xdotool").args(["key", combo]).spawn();
    }

    pub fn type_text_string(text: &str) {
        let _ = Command::new("xdotool").args(["type", "--delay", "5", text]).spawn();
    }
}
