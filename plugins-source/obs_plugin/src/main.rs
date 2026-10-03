use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;
use tokio_tungstenite::connect_async;
use tungstenite::protocol::Message;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataListItem {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub image: Option<String>,
}

#[derive(Clone)]
struct ObsClient {
    is_connected: Arc<Mutex<bool>>,
    scenes: Arc<Mutex<Vec<String>>>,
    inputs: Arc<Mutex<Vec<(String, String)>>>,
    current_scene: Arc<Mutex<String>>,
    request_tx: Arc<Mutex<Option<mpsc::UnboundedSender<(String, Value, tokio::sync::oneshot::Sender<Value>)>>>>,
    config: Arc<Mutex<(String, u16, String)>>,
    reconnect_notify: Arc<tokio::sync::Notify>,
    stdout_tx: mpsc::UnboundedSender<String>,
}

impl ObsClient {
    fn new(stdout_tx: mpsc::UnboundedSender<String>) -> Self {
        Self {
            is_connected: Arc::new(Mutex::new(false)),
            scenes: Arc::new(Mutex::new(Vec::new())),
            inputs: Arc::new(Mutex::new(Vec::new())),
            current_scene: Arc::new(Mutex::new(String::new())),
            request_tx: Arc::new(Mutex::new(None)),
            config: Arc::new(Mutex::new(("127.0.0.1".to_string(), 4455, "".to_string()))),
            reconnect_notify: Arc::new(tokio::sync::Notify::new()),
            stdout_tx,
        }
    }

    fn emit_state_update(&self, action: &str, filter: Value, state: Value, exclusive: bool) {
        let msg = serde_json::json!({
            "op": "state_update",
            "plugin": "com.isudeck.obsplugin",
            "action": action,
            "filter": filter,
            "exclusive": exclusive,
            "state": state
        });
        let _ = self.stdout_tx.send(msg.to_string());
    }

    fn update_config(&self, config_val: &Value) {
        let mut cfg = self.config.lock().unwrap();
        let mut changed = false;
        if let Some(ip) = config_val.get("ip").and_then(|v| v.as_str()) {
            if cfg.0 != ip {
                cfg.0 = ip.to_string();
                changed = true;
            }
        }
        if let Some(port) = config_val.get("port").and_then(|v| v.as_u64()) {
            if cfg.1 != port as u16 {
                cfg.1 = port as u16;
                changed = true;
            }
        } else if let Some(port_str) = config_val.get("port").and_then(|v| v.as_str()) {
            if let Ok(p) = port_str.parse::<u16>() {
                if cfg.1 != p {
                    cfg.1 = p;
                    changed = true;
                }
            }
        }
        if let Some(pw) = config_val.get("password").and_then(|v| v.as_str()) {
            if cfg.2 != pw {
                cfg.2 = pw.to_string();
                changed = true;
            }
        }
        drop(cfg);
        if changed {
            eprintln!("[OBS PLUGIN] Config changed, reconnecting...");
            self.reconnect_notify.notify_one();
        }
    }

    async fn send_obs_request(&self, request_type: &str, request_data: Value) -> Result<Value, String> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let sender = {
            let lock = self.request_tx.lock().unwrap();
            lock.clone()
        };

        if let Some(s) = sender {
            s.send((request_type.to_string(), request_data, tx))
                .map_err(|e| e.to_string())?;
            match tokio::time::timeout(Duration::from_secs(4), rx).await {
                Ok(Ok(val)) => Ok(val),
                Ok(Err(e)) => Err(e.to_string()),
                Err(_) => Err("Request timed out".to_string()),
            }
        } else {
            Err("OBS Studio is not connected".to_string())
        }
    }

    fn start_worker(self: Arc<Self>) {
        tokio::spawn(async move {
            loop {
                let (ip, port, password) = {
                    let cfg = self.config.lock().unwrap();
                    cfg.clone()
                };

                let url = format!("ws://{}:{}", ip, port);
                eprintln!("[OBS PLUGIN] Connecting to OBS WebSocket at {}...", url);

                match connect_async(&url).await {
                    Ok((ws_stream, _)) => {
                        eprintln!("[OBS PLUGIN] WebSocket connection established. Initiating handshake...");
                        let (mut write, mut read) = ws_stream.split();
                        let (req_tx, mut req_rx) = mpsc::unbounded_channel::<(String, Value, tokio::sync::oneshot::Sender<Value>)>();

                        {
                            let mut lock = self.request_tx.lock().unwrap();
                            *lock = Some(req_tx);
                        }

                        let mut pending_map: HashMap<String, tokio::sync::oneshot::Sender<Value>> = HashMap::new();
                        let mut req_counter: u64 = 1;

                        loop {
                            tokio::select! {
                                _ = self.reconnect_notify.notified() => {
                                    eprintln!("[OBS PLUGIN] Reconnect requested due to config change.");
                                    break;
                                }

                                Some((req_type, req_data, resp_tx)) = req_rx.recv() => {
                                    let req_id = format!("req_{}", req_counter);
                                    req_counter += 1;
                                    pending_map.insert(req_id.clone(), resp_tx);

                                    let msg_payload = serde_json::json!({
                                        "op": 6,
                                        "d": {
                                            "requestType": req_type,
                                            "requestId": req_id,
                                            "requestData": req_data
                                        }
                                    });

                                    let _ = write.send(Message::Text(msg_payload.to_string())).await;
                                }

                                msg = read.next() => {
                                    match msg {
                                        Some(Ok(Message::Text(text))) => {
                                            if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
                                                let op = parsed.get("op").and_then(|v| v.as_i64()).unwrap_or(-1);
                                                let d = parsed.get("d");

                                                if op == 0 {
                                                    // OBS WebSocket v5 Hello
                                                    // Event Subscriptions: General(1) | Config(2) | Scenes(4) | Inputs(8) | Transitions(16) | Filters(32) | Outputs(64) | SceneItems(128) | MediaInputs(256) | UI(1024) = 1535
                                                    let mut identify_d = serde_json::json!({
                                                        "rpcVersion": 1,
                                                        "eventSubscriptions": 1535
                                                    });

                                                    if let Some(auth) = d.and_then(|v| v.get("authentication")) {
                                                        let challenge = auth.get("challenge").and_then(|v| v.as_str()).unwrap_or("");
                                                        let salt = auth.get("salt").and_then(|v| v.as_str()).unwrap_or("");

                                                        let mut hasher = Sha256::new();
                                                        hasher.update(format!("{}{}", password, salt));
                                                        let secret = BASE64.encode(hasher.finalize());

                                                        let mut hasher2 = Sha256::new();
                                                        hasher2.update(format!("{}{}", secret, challenge));
                                                        let auth_response = BASE64.encode(hasher2.finalize());

                                                        identify_d["authentication"] = serde_json::Value::String(auth_response);
                                                    }

                                                    let identify_msg = serde_json::json!({
                                                        "op": 1,
                                                        "d": identify_d
                                                    });
                                                    let _ = write.send(Message::Text(identify_msg.to_string())).await;
                                                } else if op == 2 {
                                                    // OBS WebSocket v5 Identified (Authentication Succeeded)
                                                    {
                                                        let mut conn = self.is_connected.lock().unwrap();
                                                        *conn = true;
                                                    }
                                                    eprintln!("✅ [OBS PLUGIN] Successfully connected and authenticated with OBS Studio!");

                                                    // Initial status queries
                                                    let init_queries = [
                                                        ("GetSceneList", "init_scenes", serde_json::json!({})),
                                                        ("GetInputList", "init_inputs", serde_json::json!({})),
                                                        ("GetCurrentProgramScene", "init_cur_scene", serde_json::json!({})),
                                                        ("GetRecordStatus", "init_rec_status", serde_json::json!({})),
                                                        ("GetStreamStatus", "init_stream_status", serde_json::json!({})),
                                                        ("GetVirtualCamStatus", "init_vcam_status", serde_json::json!({})),
                                                        ("GetReplayBufferStatus", "init_replay_status", serde_json::json!({})),
                                                        ("GetStudioModeEnabled", "init_studio_status", serde_json::json!({})),
                                                    ];

                                                    for (req_type, req_id, req_data) in init_queries {
                                                        let q_msg = serde_json::json!({
                                                            "op": 6,
                                                            "d": {
                                                                "requestType": req_type,
                                                                "requestId": req_id,
                                                                "requestData": req_data
                                                            }
                                                        });
                                                        let _ = write.send(Message::Text(q_msg.to_string())).await;
                                                    }
                                                } else if op == 5 {
                                                    // OBS WebSocket v5 Live Events
                                                    if let Some(event_d) = d {
                                                        let event_type = event_d.get("eventType").and_then(|v| v.as_str()).unwrap_or("");
                                                        let event_data = event_d.get("eventData");

                                                        match event_type {
                                                            "CurrentProgramSceneChanged" => {
                                                                if let Some(scene_name) = event_data.and_then(|v| v.get("sceneName")).and_then(|v| v.as_str()) {
                                                                    {
                                                                        let mut cur = self.current_scene.lock().unwrap();
                                                                        *cur = scene_name.to_string();
                                                                    }
                                                                    self.emit_state_update(
                                                                        "change_scene",
                                                                        serde_json::json!({ "sceneName": scene_name }),
                                                                        serde_json::json!({ "active": true, "badge": null, "color": "#22c55e" }),
                                                                        true,
                                                                    );
                                                                }
                                                            }
                                                            "SceneListChanged" => {
                                                                let get_scenes_msg = serde_json::json!({
                                                                    "op": 6,
                                                                    "d": {
                                                                        "requestType": "GetSceneList",
                                                                        "requestId": "init_scenes"
                                                                    }
                                                                });
                                                                let _ = write.send(Message::Text(get_scenes_msg.to_string())).await;
                                                            }
                                                            "InputMuteStateChanged" => {
                                                                if let Some(ed) = event_data {
                                                                    let input_name = ed.get("inputName").and_then(|v| v.as_str()).unwrap_or("");
                                                                    let muted = ed.get("inputMuted").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                    let state = if muted {
                                                                        serde_json::json!({ "active": true, "badge": "MUTE", "color": "#ef4444" })
                                                                    } else {
                                                                        serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                    };
                                                                    self.emit_state_update("toggle_mute", serde_json::json!({ "inputName": input_name }), state.clone(), false);
                                                                    self.emit_state_update("set_mute", serde_json::json!({ "inputName": input_name }), state, false);
                                                                }
                                                            }
                                                            "InputListChanged" | "InputCreated" | "InputRemoved" | "InputNameChanged" => {
                                                                let get_inputs_msg = serde_json::json!({
                                                                    "op": 6,
                                                                    "d": {
                                                                        "requestType": "GetInputList",
                                                                        "requestId": "init_inputs"
                                                                    }
                                                                });
                                                                let _ = write.send(Message::Text(get_inputs_msg.to_string())).await;
                                                            }
                                                            "RecordStateChanged" => {
                                                                if let Some(ed) = event_data {
                                                                    let active = ed.get("outputActive").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                    let state_str = ed.get("outputState").and_then(|v| v.as_str()).unwrap_or("");
                                                                    let is_paused = state_str.contains("PAUSED") || state_str.contains("PAUSE");

                                                                    let (rec_state, pause_state) = if active {
                                                                        if is_paused {
                                                                            (
                                                                                serde_json::json!({ "active": true, "badge": "PAUSE", "color": "#f59e0b" }),
                                                                                serde_json::json!({ "active": true, "badge": "PAUSED", "color": "#f59e0b" }),
                                                                            )
                                                                        } else {
                                                                            (
                                                                                serde_json::json!({ "active": true, "badge": "REC", "color": "#ef4444" }),
                                                                                serde_json::json!({ "active": false, "badge": null, "color": null }),
                                                                            )
                                                                        }
                                                                    } else {
                                                                        (
                                                                            serde_json::json!({ "active": false, "badge": null, "color": null }),
                                                                            serde_json::json!({ "active": false, "badge": null, "color": null }),
                                                                        )
                                                                    };

                                                                    self.emit_state_update("toggle_record", serde_json::json!({}), rec_state.clone(), false);
                                                                    self.emit_state_update("start_record", serde_json::json!({}), rec_state.clone(), false);
                                                                    self.emit_state_update("stop_record", serde_json::json!({}), rec_state, false);
                                                                    self.emit_state_update("toggle_record_pause", serde_json::json!({}), pause_state, false);
                                                                }
                                                            }
                                                            "StreamStateChanged" => {
                                                                if let Some(ed) = event_data {
                                                                    let active = ed.get("outputActive").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                    let state = if active {
                                                                        serde_json::json!({ "active": true, "badge": "LIVE", "color": "#8b5cf6" })
                                                                    } else {
                                                                        serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                    };
                                                                    self.emit_state_update("toggle_stream", serde_json::json!({}), state.clone(), false);
                                                                    self.emit_state_update("start_stream", serde_json::json!({}), state.clone(), false);
                                                                    self.emit_state_update("stop_stream", serde_json::json!({}), state, false);
                                                                }
                                                            }
                                                            "VirtualcamStateChanged" => {
                                                                if let Some(ed) = event_data {
                                                                    let active = ed.get("outputActive").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                    let state = if active {
                                                                        serde_json::json!({ "active": true, "badge": "CAM", "color": "#3b82f6" })
                                                                    } else {
                                                                        serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                    };
                                                                    self.emit_state_update("toggle_virtual_cam", serde_json::json!({}), state.clone(), false);
                                                                    self.emit_state_update("start_virtual_cam", serde_json::json!({}), state.clone(), false);
                                                                    self.emit_state_update("stop_virtual_cam", serde_json::json!({}), state, false);
                                                                }
                                                            }
                                                            "ReplayBufferStateChanged" => {
                                                                if let Some(ed) = event_data {
                                                                    let active = ed.get("outputActive").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                    let state = if active {
                                                                        serde_json::json!({ "active": true, "badge": "REP", "color": "#f59e0b" })
                                                                    } else {
                                                                        serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                    };
                                                                    self.emit_state_update("toggle_replay_buffer", serde_json::json!({}), state.clone(), false);
                                                                    self.emit_state_update("start_replay_buffer", serde_json::json!({}), state.clone(), false);
                                                                    self.emit_state_update("stop_replay_buffer", serde_json::json!({}), state, false);
                                                                }
                                                            }
                                                            "StudioModeStateChanged" => {
                                                                if let Some(ed) = event_data {
                                                                    let enabled = ed.get("studioModeEnabled").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                    let state = if enabled {
                                                                        serde_json::json!({ "active": true, "badge": "STUDIO", "color": "#06b6d4" })
                                                                    } else {
                                                                        serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                    };
                                                                    self.emit_state_update("toggle_studio_mode", serde_json::json!({}), state, false);
                                                                }
                                                            }
                                                            "SceneItemEnableStateChanged" => {
                                                                if let Some(ed) = event_data {
                                                                    let scene_name = ed.get("sceneName").and_then(|v| v.as_str()).unwrap_or("");
                                                                    let item_id = ed.get("sceneItemId").and_then(|v| v.as_i64()).unwrap_or(-1);
                                                                    let enabled = ed.get("sceneItemEnabled").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                    let state = if enabled {
                                                                        serde_json::json!({ "active": true, "badge": "ON", "color": "#22c55e" })
                                                                    } else {
                                                                        serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                    };
                                                                    self.emit_state_update(
                                                                        "toggle_source_visibility",
                                                                        serde_json::json!({ "sceneName": scene_name, "sceneItemId": item_id }),
                                                                        state.clone(),
                                                                        false,
                                                                    );
                                                                    self.emit_state_update(
                                                                        "set_source_visibility",
                                                                        serde_json::json!({ "sceneName": scene_name, "sceneItemId": item_id }),
                                                                        state,
                                                                        false,
                                                                    );
                                                                }
                                                            }
                                                            _ => {}
                                                        }
                                                    }
                                                } else if op == 7 {
                                                    // Request Responses
                                                    if let Some(resp_d) = d {
                                                        let req_id = resp_d.get("requestId").and_then(|v| v.as_str()).unwrap_or("");

                                                        if req_id == "init_scenes" {
                                                            if let Some(scenes_arr) = resp_d.get("responseData").and_then(|v| v.get("scenes")).and_then(|v| v.as_array()) {
                                                                let mut sc_list = Vec::new();
                                                                for s in scenes_arr {
                                                                    if let Some(name) = s.get("sceneName").and_then(|v| v.as_str()) {
                                                                        sc_list.push(name.to_string());
                                                                    }
                                                                }
                                                                let mut lock = self.scenes.lock().unwrap();
                                                                *lock = sc_list;
                                                            }
                                                        } else if req_id == "init_inputs" {
                                                            if let Some(inputs_arr) = resp_d.get("responseData").and_then(|v| v.get("inputs")).and_then(|v| v.as_array()) {
                                                                let mut inp_list = Vec::new();
                                                                for i in inputs_arr {
                                                                    let name = i.get("inputName").and_then(|v| v.as_str()).unwrap_or("");
                                                                    let kind = i.get("inputKind").and_then(|v| v.as_str()).unwrap_or("Audio Source");
                                                                    if !name.is_empty() {
                                                                        inp_list.push((name.to_string(), kind.to_string()));

                                                                        // Query initial mute status for each audio source
                                                                        let mute_req = serde_json::json!({
                                                                            "op": 6,
                                                                            "d": {
                                                                                "requestType": "GetInputMute",
                                                                                "requestId": format!("init_mute_{}", name),
                                                                                "requestData": { "inputName": name }
                                                                            }
                                                                        });
                                                                        let _ = write.send(Message::Text(mute_req.to_string())).await;
                                                                    }
                                                                }
                                                                let mut lock = self.inputs.lock().unwrap();
                                                                *lock = inp_list;
                                                            }
                                                        } else if req_id == "init_cur_scene" {
                                                            if let Some(scene_name) = resp_d.get("responseData").and_then(|v| v.get("currentProgramSceneName")).and_then(|v| v.as_str()) {
                                                                {
                                                                    let mut cur = self.current_scene.lock().unwrap();
                                                                    *cur = scene_name.to_string();
                                                                }
                                                                self.emit_state_update(
                                                                    "change_scene",
                                                                    serde_json::json!({ "sceneName": scene_name }),
                                                                    serde_json::json!({ "active": true, "badge": null, "color": "#22c55e" }),
                                                                    true,
                                                                );
                                                            }
                                                        } else if req_id == "init_rec_status" {
                                                            if let Some(rd) = resp_d.get("responseData") {
                                                                let active = rd.get("outputActive").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                let is_paused = rd.get("outputPaused").and_then(|v| v.as_bool()).unwrap_or(false);
                                                                let state = if active {
                                                                    if is_paused {
                                                                        serde_json::json!({ "active": true, "badge": "PAUSE", "color": "#f59e0b" })
                                                                    } else {
                                                                        serde_json::json!({ "active": true, "badge": "REC", "color": "#ef4444" })
                                                                    }
                                                                } else {
                                                                    serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                };
                                                                self.emit_state_update("toggle_record", serde_json::json!({}), state.clone(), false);
                                                                self.emit_state_update("start_record", serde_json::json!({}), state.clone(), false);
                                                                self.emit_state_update("stop_record", serde_json::json!({}), state, false);
                                                            }
                                                        } else if req_id == "init_stream_status" {
                                                            if let Some(active) = resp_d.get("responseData").and_then(|v| v.get("outputActive")).and_then(|v| v.as_bool()) {
                                                                let state = if active {
                                                                    serde_json::json!({ "active": true, "badge": "LIVE", "color": "#8b5cf6" })
                                                                } else {
                                                                    serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                };
                                                                self.emit_state_update("toggle_stream", serde_json::json!({}), state.clone(), false);
                                                                self.emit_state_update("start_stream", serde_json::json!({}), state.clone(), false);
                                                                self.emit_state_update("stop_stream", serde_json::json!({}), state, false);
                                                            }
                                                        } else if req_id == "init_vcam_status" {
                                                            if let Some(active) = resp_d.get("responseData").and_then(|v| v.get("outputActive")).and_then(|v| v.as_bool()) {
                                                                let state = if active {
                                                                    serde_json::json!({ "active": true, "badge": "CAM", "color": "#3b82f6" })
                                                                } else {
                                                                    serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                };
                                                                self.emit_state_update("toggle_virtual_cam", serde_json::json!({}), state, false);
                                                            }
                                                        } else if req_id == "init_replay_status" {
                                                            if let Some(active) = resp_d.get("responseData").and_then(|v| v.get("outputActive")).and_then(|v| v.as_bool()) {
                                                                let state = if active {
                                                                    serde_json::json!({ "active": true, "badge": "REP", "color": "#f59e0b" })
                                                                } else {
                                                                    serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                };
                                                                self.emit_state_update("toggle_replay_buffer", serde_json::json!({}), state, false);
                                                            }
                                                        } else if req_id == "init_studio_status" {
                                                            if let Some(enabled) = resp_d.get("responseData").and_then(|v| v.get("studioModeEnabled")).and_then(|v| v.as_bool()) {
                                                                let state = if enabled {
                                                                    serde_json::json!({ "active": true, "badge": "STUDIO", "color": "#06b6d4" })
                                                                } else {
                                                                    serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                };
                                                                self.emit_state_update("toggle_studio_mode", serde_json::json!({}), state, false);
                                                            }
                                                        } else if req_id.starts_with("init_mute_") {
                                                            let input_name = &req_id["init_mute_".len()..];
                                                            if let Some(muted) = resp_d.get("responseData").and_then(|v| v.get("inputMuted")).and_then(|v| v.as_bool()) {
                                                                let state = if muted {
                                                                    serde_json::json!({ "active": true, "badge": "MUTE", "color": "#ef4444" })
                                                                } else {
                                                                    serde_json::json!({ "active": false, "badge": null, "color": null })
                                                                };
                                                                self.emit_state_update("toggle_mute", serde_json::json!({ "inputName": input_name }), state.clone(), false);
                                                                self.emit_state_update("set_mute", serde_json::json!({ "inputName": input_name }), state, false);
                                                            }
                                                        }

                                                        if let Some(sender) = pending_map.remove(req_id) {
                                                            let _ = sender.send(resp_d.clone());
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        Some(Ok(Message::Ping(ping_data))) => {
                                            let _ = write.send(Message::Pong(ping_data)).await;
                                        }
                                        Some(Ok(Message::Pong(_))) => {}
                                        Some(Ok(Message::Close(_))) | None => {
                                            break;
                                        }
                                        _ => {}
                                    }
                                }
                            }
                        }

                        {
                            let mut conn = self.is_connected.lock().unwrap();
                            *conn = false;
                            let mut lock = self.request_tx.lock().unwrap();
                            *lock = None;
                        }
                        eprintln!("[OBS PLUGIN] OBS WebSocket connection lost. Reconnecting in 3s...");
                    }
                    Err(err) => {
                        eprintln!("[OBS PLUGIN] Connection to OBS failed ({}). Retrying in 3s...", err);
                    }
                }

                tokio::select! {
                    _ = self.reconnect_notify.notified() => {}
                    _ = tokio::time::sleep(Duration::from_secs(3)) => {}
                }
            }
        });
    }
}

#[tokio::main]
async fn main() {
    eprintln!("[OBS PLUGIN] Standalone process started!");
    let (stdout_tx, mut stdout_rx) = mpsc::unbounded_channel::<String>();

    tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(line) = stdout_rx.recv().await {
            let _ = stdout.write_all(line.as_bytes()).await;
            let _ = stdout.write_all(b"\n").await;
            let _ = stdout.flush().await;
        }
    });

    let client = Arc::new(ObsClient::new(stdout_tx.clone()));
    client.clone().start_worker();

    let stdin = tokio::io::stdin();
    let reader = BufReader::new(stdin);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Ok(msg) = serde_json::from_str::<Value>(trimmed) {
            let op = msg.get("op").and_then(|v| v.as_str()).unwrap_or("");
            match op {
                "init" => {
                    if let Some(cfg) = msg.get("config") {
                        client.update_config(cfg);
                    }
                }

                "get_data" => {
                    let req_id = msg.get("requestId").and_then(|v| v.as_str()).unwrap_or("");
                    let data_type = msg.get("dataType").and_then(|v| v.as_str()).unwrap_or("");
                    let empty_args = serde_json::json!({});
                    let args = msg.get("args").unwrap_or(&empty_args);

                    let is_scenes = data_type.eq_ignore_ascii_case("getscenes")
                        || data_type.eq_ignore_ascii_case("scenes")
                        || data_type.eq_ignore_ascii_case("scenename")
                        || data_type.eq_ignore_ascii_case("targetscene");

                    let is_inputs = data_type.eq_ignore_ascii_case("getinputs")
                        || data_type.eq_ignore_ascii_case("inputs")
                        || data_type.eq_ignore_ascii_case("inputname");

                    let is_scene_items = data_type.eq_ignore_ascii_case("getsceneitems")
                        || data_type.eq_ignore_ascii_case("sceneitems")
                        || data_type.eq_ignore_ascii_case("sourcename")
                        || data_type.eq_ignore_ascii_case("sceneitemid");

                    let mut items: Vec<DataListItem> = Vec::new();

                    if is_scenes {
                        let mut cached = {
                            let lock = client.scenes.lock().unwrap();
                            lock.clone()
                        };

                        if cached.is_empty() {
                            if let Ok(resp) = client.send_obs_request("GetSceneList", serde_json::json!({})).await {
                                if let Some(arr) = resp.get("responseData").and_then(|v| v.get("scenes")).and_then(|v| v.as_array()) {
                                    let mut list = Vec::new();
                                    for s in arr {
                                        if let Some(name) = s.get("sceneName").and_then(|v| v.as_str()) {
                                            list.push(name.to_string());
                                        }
                                    }
                                    let mut lock = client.scenes.lock().unwrap();
                                    *lock = list.clone();
                                    cached = list;
                                }
                            }
                        }

                        items = cached.into_iter().map(|s| DataListItem {
                            id: s.clone(),
                            label: s,
                            description: "OBS Scene".to_string(),
                            image: None,
                        }).collect();
                    } else if is_inputs {
                        let mut cached = {
                            let lock = client.inputs.lock().unwrap();
                            lock.clone()
                        };

                        if cached.is_empty() {
                            if let Ok(resp) = client.send_obs_request("GetInputList", serde_json::json!({})).await {
                                if let Some(arr) = resp.get("responseData").and_then(|v| v.get("inputs")).and_then(|v| v.as_array()) {
                                    let mut list = Vec::new();
                                    for i in arr {
                                        let name = i.get("inputName").and_then(|v| v.as_str()).unwrap_or("");
                                        let kind = i.get("inputKind").and_then(|v| v.as_str()).unwrap_or("Audio Source");
                                        if !name.is_empty() {
                                            list.push((name.to_string(), kind.to_string()));
                                        }
                                    }
                                    let mut lock = client.inputs.lock().unwrap();
                                    *lock = list.clone();
                                    cached = list;
                                }
                            }
                        }

                        items = cached.into_iter().map(|(name, kind)| DataListItem {
                            id: name.clone(),
                            label: name,
                            description: kind,
                            image: None,
                        }).collect();
                    } else if is_scene_items {
                        let target_scene = args.get("sceneName")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| client.current_scene.lock().unwrap().clone());

                        if !target_scene.is_empty() {
                            if let Ok(resp) = client.send_obs_request("GetSceneItemList", serde_json::json!({ "sceneName": target_scene })).await {
                                if let Some(arr) = resp.get("responseData").and_then(|v| v.get("sceneItems")).and_then(|v| v.as_array()) {
                                    for item in arr {
                                        let source_name = item.get("sourceName").and_then(|v| v.as_str()).unwrap_or("");
                                        let item_id = item.get("sceneItemId").and_then(|v| v.as_i64()).unwrap_or(0);
                                        let source_type = item.get("inputKind").or_else(|| item.get("sourceType")).and_then(|v| v.as_str()).unwrap_or("Scene Item");
                                        if !source_name.is_empty() {
                                            items.push(DataListItem {
                                                id: source_name.to_string(),
                                                label: format!("{} (ID: {})", source_name, item_id),
                                                description: format!("Scene: {} [{}]", target_scene, source_type),
                                                image: None,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let resp = serde_json::json!({
                        "op": "data_response",
                        "requestId": req_id,
                        "data": items
                    });
                    let _ = stdout_tx.send(resp.to_string());
                }

                "execute" => {
                    let req_id = msg.get("requestId").and_then(|v| v.as_str()).unwrap_or("");
                    let action = msg.get("action").and_then(|v| v.as_str()).unwrap_or("");
                    let empty_args = serde_json::json!({});
                    let args = msg.get("args").unwrap_or(&empty_args);

                    let (success, message) = match action {
                        "change_scene" | "obs_set_scene" => {
                            let target = args.get("sceneName")
                                .or_else(|| args.get("targetScene"))
                                .or_else(|| args.get("scene"))
                                .or_else(|| args.get("target"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            if target.is_empty() {
                                (false, "No scene name specified".to_string())
                            } else {
                                match client.send_obs_request("SetCurrentProgramScene", serde_json::json!({ "sceneName": target })).await {
                                    Ok(resp) => {
                                        let ok = resp.get("requestStatus").and_then(|s| s.get("result")).and_then(|r| r.as_bool()).unwrap_or(true);
                                        if ok {
                                            (true, format!("Scene changed to: {}", target))
                                        } else {
                                            let comment = resp.get("requestStatus").and_then(|s| s.get("comment")).and_then(|c| c.as_str()).unwrap_or("OBS request failed");
                                            (false, format!("OBS Error: {}", comment))
                                        }
                                    }
                                    Err(e) => (false, format!("OBS Error: {}", e)),
                                }
                            }
                        }

                        "set_preview_scene" => {
                            let target = args.get("sceneName")
                                .or_else(|| args.get("targetScene"))
                                .or_else(|| args.get("scene"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            if target.is_empty() {
                                (false, "No preview scene specified".to_string())
                            } else {
                                match client.send_obs_request("SetCurrentPreviewScene", serde_json::json!({ "sceneName": target })).await {
                                    Ok(_) => (true, format!("Preview scene set to: {}", target)),
                                    Err(e) => (false, format!("OBS Error: {}", e)),
                                }
                            }
                        }

                        "toggle_mute" | "obs_toggle_mute" => {
                            let input = args.get("inputName")
                                .or_else(|| args.get("input"))
                                .or_else(|| args.get("source"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            if input.is_empty() {
                                (false, "No audio input specified".to_string())
                            } else {
                                match client.send_obs_request("ToggleInputMute", serde_json::json!({ "inputName": input })).await {
                                    Ok(_) => (true, format!("Mute toggled for: {}", input)),
                                    Err(e) => (false, format!("OBS Error: {}", e)),
                                }
                            }
                        }

                        "set_mute" | "obs_set_mute" => {
                            let input = args.get("inputName")
                                .or_else(|| args.get("input"))
                                .or_else(|| args.get("source"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let state_str = args.get("muteState").and_then(|v| v.as_str()).unwrap_or("mute");
                            let should_mute = state_str == "mute" || state_str == "true" || args.get("muteState").and_then(|v| v.as_bool()).unwrap_or(false);
                            if input.is_empty() {
                                (false, "No audio input specified".to_string())
                            } else {
                                match client.send_obs_request("SetInputMute", serde_json::json!({ "inputName": input, "inputMuted": should_mute })).await {
                                    Ok(_) => (true, format!("Mute state set for: {}", input)),
                                    Err(e) => (false, format!("OBS Error: {}", e)),
                                }
                            }
                        }

                        "toggle_record" | "obs_toggle_record" => {
                            match client.send_obs_request("ToggleRecord", serde_json::json!({})).await {
                                Ok(_) => (true, "Recording toggled".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "start_record" | "obs_start_record" => {
                            match client.send_obs_request("StartRecord", serde_json::json!({})).await {
                                Ok(_) => (true, "Recording started".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "stop_record" | "obs_stop_record" => {
                            match client.send_obs_request("StopRecord", serde_json::json!({})).await {
                                Ok(_) => (true, "Recording stopped".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "toggle_record_pause" | "obs_toggle_record_pause" => {
                            match client.send_obs_request("ToggleRecordPause", serde_json::json!({})).await {
                                Ok(_) => (true, "Record pause toggled".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "toggle_stream" | "obs_toggle_stream" => {
                            match client.send_obs_request("ToggleStream", serde_json::json!({})).await {
                                Ok(_) => (true, "Streaming toggled".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "start_stream" | "obs_start_stream" => {
                            match client.send_obs_request("StartStream", serde_json::json!({})).await {
                                Ok(_) => (true, "Streaming started".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "stop_stream" | "obs_stop_stream" => {
                            match client.send_obs_request("StopStream", serde_json::json!({})).await {
                                Ok(_) => (true, "Streaming stopped".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "toggle_virtual_cam" | "obs_toggle_virtual_cam" => {
                            match client.send_obs_request("ToggleVirtualCam", serde_json::json!({})).await {
                                Ok(_) => (true, "Virtual Camera toggled".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "start_virtual_cam" => {
                            match client.send_obs_request("StartVirtualCam", serde_json::json!({})).await {
                                Ok(_) => (true, "Virtual Camera started".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "stop_virtual_cam" => {
                            match client.send_obs_request("StopVirtualCam", serde_json::json!({})).await {
                                Ok(_) => (true, "Virtual Camera stopped".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "save_replay_buffer" | "obs_replay_buffer" => {
                            match client.send_obs_request("SaveReplayBuffer", serde_json::json!({})).await {
                                Ok(_) => (true, "Replay buffer saved".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "toggle_replay_buffer" | "obs_toggle_replay_buffer" => {
                            match client.send_obs_request("ToggleReplayBuffer", serde_json::json!({})).await {
                                Ok(_) => (true, "Replay buffer toggled".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "start_replay_buffer" => {
                            match client.send_obs_request("StartReplayBuffer", serde_json::json!({})).await {
                                Ok(_) => (true, "Replay buffer started".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "stop_replay_buffer" => {
                            match client.send_obs_request("StopReplayBuffer", serde_json::json!({})).await {
                                Ok(_) => (true, "Replay buffer stopped".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "toggle_studio_mode" | "obs_toggle_studio_mode" => {
                            match client.send_obs_request("GetStudioModeEnabled", serde_json::json!({})).await {
                                Ok(resp) => {
                                    let enabled = resp.get("responseData").and_then(|v| v.get("studioModeEnabled")).and_then(|v| v.as_bool()).unwrap_or(false);
                                    let _ = client.send_obs_request("SetStudioModeEnabled", serde_json::json!({ "studioModeEnabled": !enabled })).await;
                                    (true, format!("Studio mode {}", if !enabled { "enabled" } else { "disabled" }))
                                }
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "trigger_studio_transition" | "obs_trigger_studio_transition" => {
                            match client.send_obs_request("TriggerStudioModeTransition", serde_json::json!({})).await {
                                Ok(_) => (true, "Studio transition triggered".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "take_screenshot" | "obs_take_screenshot" => {
                            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
                            let home = std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string());
                            let path = format!("{}\\Pictures\\obs_screenshot_{}.png", home, now);
                            let source = args.get("sourceName")
                                .or_else(|| args.get("sceneName"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| client.current_scene.lock().unwrap().clone());

                            match client.send_obs_request("SaveSourceScreenshot", serde_json::json!({
                                "sourceName": source,
                                "imageFormat": "png",
                                "imageFilePath": path
                            })).await {
                                Ok(_) => (true, "Screenshot saved to Pictures".to_string()),
                                Err(e) => (false, format!("OBS Error: {}", e)),
                            }
                        }

                        "set_input_volume" | "obs_set_input_volume" => {
                            let input = args.get("inputName")
                                .or_else(|| args.get("input"))
                                .or_else(|| args.get("source"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let vol_pct = args.get("volumePercent")
                                .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
                                .unwrap_or(100.0) / 100.0;
                            if input.is_empty() {
                                (false, "No audio input specified".to_string())
                            } else {
                                match client.send_obs_request("SetInputVolume", serde_json::json!({
                                    "inputName": input,
                                    "inputVolumeMul": vol_pct
                                })).await {
                                    Ok(_) => (true, format!("Volume set to {:.0}% for {}", vol_pct * 100.0, input)),
                                    Err(e) => (false, format!("OBS Error: {}", e)),
                                }
                            }
                        }

                        "toggle_source_visibility" | "obs_toggle_source_visibility" => {
                            let scene_name = args.get("sceneName")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| client.current_scene.lock().unwrap().clone());
                            let source_name = args.get("sourceName")
                                .or_else(|| args.get("inputName"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            if scene_name.is_empty() || source_name.is_empty() {
                                (false, "Scene and source name are required".to_string())
                            } else {
                                // 1. Get Scene Item ID
                                match client.send_obs_request("GetSceneItemId", serde_json::json!({
                                    "sceneName": scene_name,
                                    "sourceName": source_name
                                })).await {
                                    Ok(id_resp) => {
                                        if let Some(item_id) = id_resp.get("responseData").and_then(|v| v.get("sceneItemId")).and_then(|v| v.as_i64()) {
                                            // 2. Get Scene Item Enabled Status
                                            match client.send_obs_request("GetSceneItemEnabled", serde_json::json!({
                                                "sceneName": scene_name,
                                                "sceneItemId": item_id
                                            })).await {
                                                Ok(en_resp) => {
                                                    let enabled = en_resp.get("responseData").and_then(|v| v.get("sceneItemEnabled")).and_then(|v| v.as_bool()).unwrap_or(false);
                                                    // 3. Toggle Enabled Status
                                                    let _ = client.send_obs_request("SetSceneItemEnabled", serde_json::json!({
                                                        "sceneName": scene_name,
                                                        "sceneItemId": item_id,
                                                        "sceneItemEnabled": !enabled
                                                    })).await;
                                                    (true, format!("Visibility toggled for: {}", source_name))
                                                }
                                                Err(e) => (false, format!("OBS Error: {}", e)),
                                            }
                                        } else {
                                            (false, format!("Source '{}' not found in scene '{}'", source_name, scene_name))
                                        }
                                    }
                                    Err(e) => (false, format!("OBS Error: {}", e)),
                                }
                            }
                        }

                        "set_source_visibility" => {
                            let scene_name = args.get("sceneName")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| client.current_scene.lock().unwrap().clone());
                            let source_name = args.get("sourceName")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let visible_str = args.get("visibility").and_then(|v| v.as_str()).unwrap_or("show");
                            let should_show = visible_str == "show" || visible_str == "true" || args.get("visibility").and_then(|v| v.as_bool()).unwrap_or(true);

                            if scene_name.is_empty() || source_name.is_empty() {
                                (false, "Scene and source name are required".to_string())
                            } else {
                                match client.send_obs_request("GetSceneItemId", serde_json::json!({
                                    "sceneName": scene_name,
                                    "sourceName": source_name
                                })).await {
                                    Ok(id_resp) => {
                                        if let Some(item_id) = id_resp.get("responseData").and_then(|v| v.get("sceneItemId")).and_then(|v| v.as_i64()) {
                                            let _ = client.send_obs_request("SetSceneItemEnabled", serde_json::json!({
                                                "sceneName": scene_name,
                                                "sceneItemId": item_id,
                                                "sceneItemEnabled": should_show
                                            })).await;
                                            (true, format!("Visibility set for: {}", source_name))
                                        } else {
                                            (false, format!("Source '{}' not found in scene '{}'", source_name, scene_name))
                                        }
                                    }
                                    Err(e) => (false, format!("OBS Error: {}", e)),
                                }
                            }
                        }

                        _ => (false, format!("Unknown action: {}", action)),
                    };

                    let resp = serde_json::json!({
                        "op": "execute_response",
                        "requestId": req_id,
                        "success": success,
                        "message": message
                    });
                    let _ = stdout_tx.send(resp.to_string());
                }

                _ => {}
            }
        }
    }
}
