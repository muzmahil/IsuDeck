use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataListItem {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub image: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActionResult {
    pub success: bool,
    pub message: String,
}

impl ActionResult {
    pub fn ok(msg: &str) -> Self {
        Self { success: true, message: msg.to_string() }
    }
    pub fn fail(msg: &str) -> Self {
        Self { success: false, message: msg.to_string() }
    }
}

pub struct RunningPluginProcess {
    pub name: String,
    stdin: Arc<Mutex<ChildStdin>>,
    pending_data: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<Vec<DataListItem>>>>>,
    pending_exec: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<ActionResult>>>>,
    child: Arc<Mutex<Child>>,
}

impl RunningPluginProcess {
    pub fn send_init(&self, config: &Value) {
        let msg = serde_json::json!({
            "op": "init",
            "config": config
        });
        self.send_line(&msg.to_string());
    }

    pub fn get_data(&self, req_id: &str, data_type: &str, args: &Value) -> Vec<DataListItem> {
        let (tx, rx) = std::sync::mpsc::channel();
        {
            let mut lock = self.pending_data.lock().unwrap();
            lock.insert(req_id.to_string(), tx);
        }

        let msg = serde_json::json!({
            "op": "get_data",
            "requestId": req_id,
            "dataType": data_type,
            "args": args
        });

        if self.send_line(&msg.to_string()) {
            rx.recv_timeout(Duration::from_secs(4)).unwrap_or_else(|_| {
                let mut lock = self.pending_data.lock().unwrap();
                lock.remove(req_id);
                Vec::new()
            })
        } else {
            let mut lock = self.pending_data.lock().unwrap();
            lock.remove(req_id);
            Vec::new()
        }
    }

    pub fn execute(&self, req_id: &str, action: &str, args: &Value) -> ActionResult {
        let (tx, rx) = std::sync::mpsc::channel();
        {
            let mut lock = self.pending_exec.lock().unwrap();
            lock.insert(req_id.to_string(), tx);
        }

        let msg = serde_json::json!({
            "op": "execute",
            "requestId": req_id,
            "action": action,
            "args": args
        });

        if self.send_line(&msg.to_string()) {
            rx.recv_timeout(Duration::from_secs(5)).unwrap_or_else(|_| {
                let mut lock = self.pending_exec.lock().unwrap();
                lock.remove(req_id);
                ActionResult::fail("Plugin response timed out")
            })
        } else {
            let mut lock = self.pending_exec.lock().unwrap();
            lock.remove(req_id);
            ActionResult::fail("Failed to communicate with plugin process")
        }
    }

    fn send_line(&self, line: &str) -> bool {
        if let Ok(mut stdin) = self.stdin.lock() {
            if writeln!(stdin, "{}", line).is_ok() && stdin.flush().is_ok() {
                return true;
            }
        }
        false
    }
}

#[derive(Clone)]
pub enum ActionTarget {
    Daemon {
        proc: Arc<RunningPluginProcess>,
        action_name: String,
    },
    OneShot {
        exe_path: std::path::PathBuf,
        dir_path: std::path::PathBuf,
        action_name: String,
    },
}

pub struct PluginManager {
    processes: Arc<Mutex<Vec<Arc<RunningPluginProcess>>>>,
    action_map: Arc<Mutex<HashMap<String, ActionTarget>>>, // action_name -> ActionTarget
    app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
}

impl PluginManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            processes: Arc::new(Mutex::new(Vec::new())),
            action_map: Arc::new(Mutex::new(HashMap::new())),
            app_handle: Arc::new(Mutex::new(None)),
        })
    }

    pub fn set_app_handle(&self, app: tauri::AppHandle) {
        let mut lock = self.app_handle.lock().unwrap();
        *lock = Some(app);
    }

    pub fn stop_all(&self) {
        let mut procs = self.processes.lock().unwrap();
        for p in procs.drain(..) {
            if let Ok(mut child) = p.child.lock() {
                let _ = child.kill();
            }
        }
        let mut map = self.action_map.lock().unwrap();
        map.clear();
    }

    pub fn reload_all(&self, plugins_dir: &Path) {
        self.stop_all();
        self.load_plugins_from_dir(plugins_dir);
    }

    pub fn load_plugins_from_dir(&self, plugins_dir: &Path) {
        if !plugins_dir.exists() {
            return;
        }

        let entries = match fs::read_dir(plugins_dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let plugin_json = path.join("plugin.json");
            if !plugin_json.exists() {
                continue;
            }

            let content = match fs::read_to_string(&plugin_json) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let manifest: Value = match serde_json::from_str(&content) {
                Ok(m) => m,
                Err(_) => continue,
            };

            let plugin_name = manifest.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown Plugin").to_string();

            // Varsa eklentinin config.json dosyasını oku
            let config_json = path.join("config.json");
            let mut config_val = serde_json::json!({});
            if config_json.exists() {
                if let Ok(cfg_content) = fs::read_to_string(config_json) {
                    if let Ok(v) = serde_json::from_str(&cfg_content) {
                        config_val = v;
                    }
                }
            }

            // Plugin enabled / disabled check
            let is_enabled = config_val.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            if !is_enabled {
                println!("[PluginManager] Plugin disabled: {}", plugin_name);
                continue;
            }

            // Eklenti türü: daemon (canlı/uzun çalışan) veya on_demand (tek seferlik)
            let is_daemon = manifest.get("daemon")
                .and_then(|v| v.as_bool())
                .or_else(|| manifest.get("background").and_then(|v| v.as_bool()))
                .unwrap_or(false);

            // Eklenti çalıştırılabilir dosyasını bul
            let mut exe_name = manifest.get("executable")
                .or_else(|| manifest.get("main"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if exe_name.is_empty() {
                if let Ok(dir_entries) = fs::read_dir(&path) {
                    for f in dir_entries.flatten() {
                        let p = f.path();
                        if p.is_file() {
                            #[cfg(windows)]
                            let is_exec = p.extension().map(|e| e == "exe").unwrap_or(false);

                            #[cfg(not(windows))]
                            let is_exec = {
                                use std::os::unix::fs::PermissionsExt;
                                // Accept files with no extension OR common Linux plugin patterns (.sh, .py, native binary)
                                let has_no_unwanted_ext = p.extension()
                                    .map(|e| !matches!(e.to_str().unwrap_or(""), "json" | "md" | "txt" | "log" | "dll" | "so"))
                                    .unwrap_or(true);
                                let is_executable = std::fs::metadata(&p)
                                    .map(|m| m.permissions().mode() & 0o111 != 0)
                                    .unwrap_or(false);
                                has_no_unwanted_ext && is_executable
                            };

                            if is_exec {
                                if let Some(n) = p.file_name().and_then(|n| n.to_str()) {
                                    exe_name = n.to_string();
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            if exe_name.is_empty() {
                continue;
            }

            let exe_path = path.join(&exe_name);
            if !exe_path.exists() {
                println!("[PluginManager] Plugin executable not found: {:?}", exe_path);
                continue;
            }

            // On Linux, do not attempt to execute Windows .exe binaries
            #[cfg(not(windows))]
            if exe_name.to_lowercase().ends_with(".exe") {
                // Windows-only binary on Linux, ignore execution
                continue;
            }

            // 1. One-Shot Plugin
            if !is_daemon {
                println!("[PluginManager] Registered one-shot plugin: {} (0 MB idle RAM)", plugin_name);
                if let Some(actions) = manifest.get("actions").and_then(|a| a.as_array()) {
                    let mut map = self.action_map.lock().unwrap();
                    for act in actions {
                        if let Some(act_name) = act.get("name").and_then(|n| n.as_str()) {
                            map.insert(
                                act_name.to_lowercase(),
                                ActionTarget::OneShot {
                                    exe_path: exe_path.clone(),
                                    dir_path: path.clone(),
                                    action_name: act_name.to_string(),
                                },
                            );
                        }
                    }
                }
                continue;
            }

            // 2. Daemon Plugin
            let mut already_running_proc: Option<Arc<RunningPluginProcess>> = None;
            {
                let procs = self.processes.lock().unwrap();
                for p in procs.iter() {
                    if p.name == plugin_name {
                        if let Ok(mut child) = p.child.lock() {
                            if child.try_wait().ok().flatten().is_none() {
                                already_running_proc = Some(p.clone());
                                break;
                            }
                        }
                    }
                }
            }

            if let Some(proc) = already_running_proc {
                proc.send_init(&config_val);
                if let Some(actions) = manifest.get("actions").and_then(|a| a.as_array()) {
                    let mut map = self.action_map.lock().unwrap();
                    for act in actions {
                        if let Some(act_name) = act.get("name").and_then(|n| n.as_str()) {
                            map.insert(
                                act_name.to_lowercase(),
                                ActionTarget::Daemon {
                                    proc: proc.clone(),
                                    action_name: act_name.to_string(),
                                },
                            );
                        }
                    }
                }
                continue;
            }

            println!("[PluginManager] Starting daemon plugin: {} ({:?})", plugin_name, exe_path);

            let mut cmd = Command::new(&exe_path);
            cmd.current_dir(&path)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit());

            #[cfg(windows)]
            cmd.creation_flags(CREATE_NO_WINDOW);

            let mut child = match cmd.spawn() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[PluginManager] Failed to start daemon plugin: {:?}, error: {}", exe_path, e);
                    continue;
                }
            };

            let stdin = match child.stdin.take() {
                Some(s) => Arc::new(Mutex::new(s)),
                None => continue,
            };

            let stdout = match child.stdout.take() {
                Some(s) => s,
                None => continue,
            };

            let pending_data: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<Vec<DataListItem>>>>> = Arc::new(Mutex::new(HashMap::new()));
            let pending_exec: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<ActionResult>>>> = Arc::new(Mutex::new(HashMap::new()));

            let pending_data_clone = pending_data.clone();
            let pending_exec_clone = pending_exec.clone();
            let app_handle_clone = self.app_handle.clone();

            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        let trimmed = l.trim();
                        if trimmed.is_empty() {
                            continue;
                        }
                        if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
                            let op = val.get("op").and_then(|v| v.as_str()).unwrap_or("");
                            let req_id = val.get("requestId").and_then(|v| v.as_str()).unwrap_or("");

                            if op == "data_response" {
                                let mut lock = pending_data_clone.lock().unwrap();
                                if let Some(tx) = lock.remove(req_id) {
                                    let items: Vec<DataListItem> = val.get("data")
                                        .and_then(|d| serde_json::from_value(d.clone()).ok())
                                        .unwrap_or_default();
                                    let _ = tx.send(items);
                                }
                            } else if op == "execute_response" {
                                let mut lock = pending_exec_clone.lock().unwrap();
                                if let Some(tx) = lock.remove(req_id) {
                                    let success = val.get("success").and_then(|s| s.as_bool()).unwrap_or(false);
                                    let message = val.get("message").and_then(|m| m.as_str()).unwrap_or("").to_string();
                                    let _ = tx.send(ActionResult { success, message });
                                }
                            } else if op == "state_update" {
                                if let Ok(guard) = app_handle_clone.lock() {
                                    if let Some(app) = guard.as_ref() {
                                        let _ = app.emit("plugin_button_state_update", val);
                                    }
                                }
                            }
                        }
                    }
                }
            });

            let running_proc = Arc::new(RunningPluginProcess {
                name: plugin_name.clone(),
                stdin,
                pending_data,
                pending_exec,
                child: Arc::new(Mutex::new(child)),
            });

            running_proc.send_init(&config_val);

            if let Some(actions) = manifest.get("actions").and_then(|a| a.as_array()) {
                let mut map = self.action_map.lock().unwrap();
                for act in actions {
                    if let Some(act_name) = act.get("name").and_then(|n| n.as_str()) {
                        map.insert(
                            act_name.to_lowercase(),
                            ActionTarget::Daemon {
                                proc: running_proc.clone(),
                                action_name: act_name.to_string(),
                            },
                        );
                    }
                }
            }

            let mut procs = self.processes.lock().unwrap();
            procs.push(running_proc);
        }
    }

    pub fn handle_get_action_data(
        &self,
        app: &tauri::AppHandle,
        request_id: &str,
        action_name: &str,
        data_type: &str,
        args: &Value,
    ) {
        let norm = action_name.to_lowercase();
        let clean_name = norm
            .rsplit(|c| c == '.' || c == ':' || c == '/')
            .next()
            .unwrap_or(&norm);

        let target_entry = {
            let map = self.action_map.lock().unwrap();
            map.get(clean_name).cloned()
                .or_else(|| map.get(&norm).cloned())
                .or_else(|| {
                    map.iter().find_map(|(k, v)| {
                        if clean_name.ends_with(k) || k.ends_with(clean_name) || norm.ends_with(k) {
                            Some(v.clone())
                        } else {
                            None
                        }
                    })
                })
        };

        let items = match target_entry {
            Some(ActionTarget::Daemon { proc, .. }) => proc.get_data(request_id, data_type, args),
            Some(ActionTarget::OneShot { exe_path, dir_path, .. }) => {
                let mut cmd = Command::new(&exe_path);
                cmd.current_dir(&dir_path)
                    .arg("--get-data")
                    .arg(data_type)
                    .arg("--args")
                    .arg(serde_json::to_string(args).unwrap_or_default());
                #[cfg(windows)]
                cmd.creation_flags(CREATE_NO_WINDOW);

                if let Ok(output) = cmd.output() {
                    let out_str = String::from_utf8_lossy(&output.stdout);
                    serde_json::from_str::<Vec<DataListItem>>(&out_str).unwrap_or_default()
                } else {
                    Vec::new()
                }
            }
            None => Vec::new(),
        };

        let response = serde_json::json!({
            "type": "ACTION_DATA_RESPONSE",
            "requestId": request_id,
            "data": items
        });

        let _ = app.emit("ACTION_DATA_RESPONSE", response.to_string());
    }

    pub fn handle_execute(&self, action_name: &str, args: &Value) -> Option<ActionResult> {
        let norm = action_name.to_lowercase();
        let clean_name = norm
            .rsplit(|c| c == '.' || c == ':' || c == '/')
            .next()
            .unwrap_or(&norm);

        let target_entry = {
            let map = self.action_map.lock().unwrap();
            map.get(clean_name).cloned()
                .or_else(|| map.get(&norm).cloned())
                .or_else(|| {
                    map.iter().find_map(|(k, v)| {
                        if clean_name.ends_with(k) || k.ends_with(clean_name) || norm.ends_with(k) {
                            Some(v.clone())
                        } else {
                            None
                        }
                    })
                })
        };

        match target_entry {
            Some(ActionTarget::Daemon { proc, action_name }) => {
                let req_id = format!("exec_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
                Some(proc.execute(&req_id, &action_name, args))
            }
            Some(ActionTarget::OneShot { exe_path, dir_path, action_name }) => {
                let mut cmd = Command::new(&exe_path);
                cmd.current_dir(&dir_path)
                    .arg("--action")
                    .arg(&action_name)
                    .arg("--args")
                    .arg(serde_json::to_string(args).unwrap_or_default());

                #[cfg(windows)]
                cmd.creation_flags(CREATE_NO_WINDOW);

                match cmd.output() {
                    Ok(output) => {
                        if output.status.success() {
                            let msg = String::from_utf8_lossy(&output.stdout).trim().to_string();
                            Some(ActionResult::ok(if msg.is_empty() { "Action executed" } else { &msg }))
                        } else {
                            let err_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
                            Some(ActionResult::fail(if err_msg.is_empty() { "Execution failed" } else { &err_msg }))
                        }
                    }
                    Err(e) => Some(ActionResult::fail(&format!("Failed to spawn executable: {}", e))),
                }
            }
            None => None,
        }
    }
}
