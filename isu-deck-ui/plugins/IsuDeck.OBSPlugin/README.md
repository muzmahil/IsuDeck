# OBS Studio Official Plugin

The official OBS Studio integration for IsuDeck, powered by high-performance WebSocket v5 real-time bidirectional connectivity.

---

## ⚡ Features & Actions

- **Change Scene (`change_scene`):** Instantly switch program scenes in OBS Studio. Live scenes are dynamically populated in your action editor dropdown and show a real-time `LIVE` status badge.
- **Set Preview Scene (`set_preview_scene`):** Change the preview scene when in Studio Mode.
- **Toggle Mute (`toggle_mute`):** Toggle mute status for any audio input or microphone (e.g. `Mic/Aux`, Desktop Audio) with live `MUTE` status indicator badges.
- **Set Mute State (`set_mute`):** Explicitly mute or unmute a designated audio source.
- **Set Audio Volume (`set_input_volume`):** Set exact volume level percentage (0% to 100%) for any audio source.
- **Recording Controls:**
  - `toggle_record`: Start or stop local recording (displays `REC` badge).
  - `start_record`: Explicitly begin recording.
  - `stop_record`: Stop recording.
  - `toggle_record_pause`: Pause or resume ongoing recording (displays `PAUSE` badge).
- **Streaming Controls:**
  - `toggle_stream`: Start or stop live streaming to Twitch, YouTube, Kick, etc. (displays `LIVE` badge).
  - `start_stream`: Explicitly start live broadcast.
  - `stop_stream`: Stop broadcast.
- **Virtual Camera Controls:**
  - `toggle_virtual_cam`: Enable or disable the OBS Virtual Camera for Discord, Zoom, or Teams (displays `CAM` badge).
  - `start_virtual_cam` / `stop_virtual_cam`: Explicit start/stop commands.
- **Replay Buffer:**
  - `toggle_replay_buffer`: Start or stop the replay buffer in the background (displays `REP` badge).
  - `save_replay_buffer`: Instantly save the replay buffer for highlight clips.
- **Studio Mode & Transitions:**
  - `toggle_studio_mode`: Enable or disable Studio Mode (displays `STUDIO` badge).
  - `trigger_studio_transition`: Trigger a transition between Preview and Program scenes.
- **Source / Layer Visibility (`toggle_source_visibility` & `set_source_visibility`):**
  - Show, hide, or toggle any scene item / overlay / webcam inside your OBS scenes.
- **Screenshot Capture (`take_screenshot`):**
  - Instantly captures a screenshot of the active program output and saves it to your Pictures directory.

---

## 🔧 Setup & Configuration

1. In OBS Studio, navigate to **Tools > WebSocket Server Settings** (Araçlar > WebSocket Sunucusu Ayarları).
2. Ensure **Enable WebSocket server** (WebSocket sunucusunu etkinleştir) is checked.
3. Note the **Server Port** (default `4455`).
4. If authentication is enabled, copy or set your server password.
5. In IsuDeck, open **Plugins**, click **Configure** on the **OBS Studio** plugin, verify the Host and Port, enter your password if configured, and click **Save**.
