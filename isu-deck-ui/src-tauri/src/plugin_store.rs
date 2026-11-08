use crate::{isudeck_root, EngineState};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::command;

const MAX_DOWNLOAD_SIZE: usize = 50 * 1024 * 1024;
const MAX_REGISTRY_SIZE: usize = 8 * 1024 * 1024;
const MAX_EXTRACTED_SIZE: u64 = 200 * 1024 * 1024;
const MAX_ARCHIVE_FILES: usize = 1000;

fn strip_bom(content: &str) -> &str {
    content.strip_prefix('\u{feff}').unwrap_or(content)
}

#[derive(Serialize)]
pub struct InstalledPluginInfo {
    pub identifier: String,
    pub dir_name: String,
    pub name: String,
    pub version: String,
}

fn validate_https_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url).map_err(|error| format!("Invalid URL: {error}"))?;
    if parsed.scheme() != "https" || parsed.host_str().is_none() {
        return Err("Only HTTPS URLs are allowed.".to_string());
    }
    Ok(parsed)
}

fn validate_dir_name(dir_name: &str) -> Result<(), String> {
    if dir_name.is_empty()
        || dir_name == "."
        || dir_name == ".."
        || dir_name.len() > 100
        || !dir_name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
    {
        return Err("Invalid plugin directory name.".to_string());
    }
    Ok(())
}

fn parse_sha256(value: &str) -> Result<[u8; 32], String> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("SHA-256 must contain exactly 64 hexadecimal characters.".to_string());
    }
    let mut digest = [0; 32];
    for (index, byte) in digest.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .map_err(|_| "Invalid SHA-256 value.".to_string())?;
    }
    Ok(digest)
}

fn verify_sha256(data: &[u8], expected: &str) -> Result<(), String> {
    let expected = parse_sha256(expected)?;
    let actual = Sha256::digest(data);
    if actual.as_slice() != expected {
        return Err("Downloaded plugin SHA-256 does not match the expected value.".to_string());
    }
    Ok(())
}

fn validate_registry(content: &str) -> Result<(), String> {
    let registry: Value = serde_json::from_str(strip_bom(content))
        .map_err(|error| format!("Registry JSON is invalid: {error}"))?;
    if registry.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("Unsupported plugin registry schema.".to_string());
    }
    let plugins = registry
        .get("plugins")
        .and_then(Value::as_array)
        .ok_or("Registry plugins must be an array.")?;
    let mut identifiers = HashSet::new();
    let mut directory_names = HashSet::new();
    for plugin in plugins {
        let identifier = plugin
            .get("identifier")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or("Registry plugin is missing its identifier.")?;
        if !identifier
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
        {
            return Err(format!(
                "Registry plugin '{identifier}' has an invalid identifier."
            ));
        }
        if !identifiers.insert(identifier.to_ascii_lowercase()) {
            return Err(format!(
                "Registry contains duplicate plugin identifier '{identifier}'."
            ));
        }
        match plugin.get("dirName") {
            None | Some(Value::Null) => {}
            Some(Value::String(dir_name)) => {
                validate_dir_name(dir_name)?;
                if !directory_names.insert(dir_name.to_ascii_lowercase()) {
                    return Err(format!(
                        "Registry contains duplicate plugin directory '{dir_name}'."
                    ));
                }
            }
            Some(_) => {
                return Err(format!(
                    "Registry plugin '{identifier}' has an invalid directory name."
                ));
            }
        }
        let name_missing = plugin
            .get("name")
            .and_then(Value::as_str)
            .map(str::is_empty)
            .unwrap_or(true);
        let version_missing = plugin
            .get("version")
            .and_then(Value::as_str)
            .map(str::is_empty)
            .unwrap_or(true);
        if name_missing || version_missing {
            return Err(format!(
                "Registry plugin '{identifier}' is missing name or version."
            ));
        }
        let download = plugin
            .get("download")
            .ok_or("Registry plugin is missing its download metadata.")?;
        let url = download
            .get("url")
            .and_then(Value::as_str)
            .ok_or("Registry plugin is missing its download URL.")?;
        validate_https_url(url)?;
        let digest = download
            .get("sha256")
            .and_then(Value::as_str)
            .ok_or("Registry plugin is missing its SHA-256.")?;
        parse_sha256(digest)?;
        match download.get("size") {
            None | Some(Value::Null) => {}
            Some(size) => {
                let size = size.as_u64().ok_or_else(|| {
                    format!("Registry plugin '{identifier}' has an invalid package size.")
                })?;
                if size == 0 || size > MAX_DOWNLOAD_SIZE as u64 {
                    return Err(format!(
                        "Registry plugin '{identifier}' has an unsupported package size."
                    ));
                }
            }
        }
    }
    Ok(())
}

fn resolve_registry_url(base: &reqwest::Url, value: &str) -> Result<String, String> {
    let resolved = if value.starts_with("https://") {
        validate_https_url(value)?
    } else if value.starts_with("//") {
        return Err(format!(
            "Registry URL '{value}' must not be protocol-relative."
        ));
    } else {
        base.join(value)
            .map_err(|error| format!("Invalid registry URL '{value}': {error}"))?
    };
    if resolved.scheme() != "https" {
        return Err(format!("Registry URL '{value}' must use HTTPS."));
    }
    Ok(resolved.to_string())
}

fn normalize_registry(content: &str, base_url: &str) -> Result<String, String> {
    let base = validate_https_url(base_url)?;
    let mut registry: Value = serde_json::from_str(strip_bom(content))
        .map_err(|error| format!("Registry JSON is invalid: {error}"))?;

    if let Some(plugins) = registry.get_mut("plugins").and_then(Value::as_array_mut) {
        for plugin in plugins {
            if let Some(download) = plugin.get_mut("download").and_then(Value::as_object_mut) {
                if let Some(url) = download
                    .get("url")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                {
                    download.insert(
                        "url".to_string(),
                        Value::String(resolve_registry_url(&base, &url)?),
                    );
                }
            }

            if let Some(icon) = plugin
                .get("icon")
                .and_then(Value::as_str)
                .map(str::to_string)
            {
                plugin["icon"] = Value::String(resolve_registry_url(&base, &icon)?);
            }

            if let Some(screenshots) = plugin.get_mut("screenshots").and_then(Value::as_array_mut) {
                for screenshot in screenshots.iter_mut() {
                    if let Some(value) = screenshot.as_str().map(str::to_string) {
                        *screenshot = Value::String(resolve_registry_url(&base, &value)?);
                    }
                }
            }

            if let Some(changelog) = plugin
                .get("changelog")
                .and_then(Value::as_str)
                .map(str::to_string)
            {
                plugin["changelog"] = Value::String(resolve_registry_url(&base, &changelog)?);
            }
        }
    }

    let normalized = serde_json::to_string(&registry)
        .map_err(|error| format!("Registry JSON is invalid: {error}"))?;
    validate_registry(&normalized)?;
    Ok(normalized)
}

async fn download_https(url: &str, max_size: usize) -> Result<Vec<u8>, String> {
    let parsed = validate_https_url(url)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.url().scheme() != "https" {
                attempt.error("HTTPS downloads may not redirect to non-HTTPS URLs")
            } else if attempt.previous().len() >= 10 {
                attempt.error("Too many redirects")
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|error| format!("Unable to initialize HTTPS client: {error}"))?;
    let mut response = client
        .get(parsed)
        .send()
        .await
        .map_err(|error| format!("Download failed: {error}"))?;
    if response.url().scheme() != "https" {
        return Err("HTTPS download redirected to a non-HTTPS URL.".to_string());
    }
    if !response.status().is_success() {
        return Err(format!(
            "Download failed with HTTP status {}.",
            response.status()
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > max_size as u64)
    {
        return Err(format!(
            "Download exceeds the {} MB limit.",
            max_size / (1024 * 1024)
        ));
    }

    let mut data = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Download failed: {error}"))?
    {
        if data.len().saturating_add(chunk.len()) > max_size {
            return Err(format!(
                "Download exceeds the {} MB limit.",
                max_size / (1024 * 1024)
            ));
        }
        data.extend_from_slice(&chunk);
    }
    Ok(data)
}

fn safe_archive_path(name: &str) -> Result<PathBuf, String> {
    if name.contains('\\') {
        return Err("Plugin archive contains an invalid path.".to_string());
    }
    let path = Path::new(name);
    if path
        .components()
        .any(|component| !matches!(component, Component::Normal(_) | Component::CurDir))
    {
        return Err("Plugin archive contains an unsafe path.".to_string());
    }
    Ok(path.to_path_buf())
}

fn read_plugin_manifest(plugin_dir: &Path) -> Result<Value, String> {
    let manifest_path = plugin_dir.join("plugin.json");
    let manifest_text = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Plugin manifest could not be read: {error}"))?;
    let manifest: Value = serde_json::from_str(strip_bom(&manifest_text))
        .map_err(|error| format!("Plugin manifest is invalid: {error}"))?;
    if manifest
        .get("identifier")
        .and_then(Value::as_str)
        .map(str::is_empty)
        .unwrap_or(true)
    {
        return Err("Plugin manifest must contain an identifier.".to_string());
    }
    let executable = manifest
        .get("executable")
        .or_else(|| manifest.get("main"))
        .and_then(Value::as_str)
        .ok_or("Plugin manifest must name an executable.")?;
    let executable_path = safe_archive_path(executable)?;
    if executable_path.as_os_str().is_empty() || !plugin_dir.join(executable_path).is_file() {
        return Err("Plugin executable is missing from the archive.".to_string());
    }
    Ok(manifest)
}

fn manifest_string(manifest: &Value, key: &str) -> String {
    manifest
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn unique_path(parent: &Path, prefix: &str) -> PathBuf {
    let ticks = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    parent.join(format!(".{prefix}-{}-{ticks}", std::process::id()))
}

fn extract_archive(archive: Vec<u8>, temp_dir: &Path) -> Result<PathBuf, String> {
    let mut zip = zip::ZipArchive::new(Cursor::new(archive))
        .map_err(|error| format!("Plugin archive is invalid: {error}"))?;
    if zip.len() == 0 || zip.len() > MAX_ARCHIVE_FILES {
        return Err("Plugin archive has an invalid number of entries.".to_string());
    }
    let mut total_size = 0u64;
    let mut paths = HashSet::new();
    for index in 0..zip.len() {
        let mut entry = zip
            .by_index(index)
            .map_err(|error| format!("Plugin archive is invalid: {error}"))?;
        let name = entry.name().to_string();
        let relative = safe_archive_path(&name)?;
        if !paths.insert(relative.clone()) {
            return Err("Plugin archive contains duplicate paths.".to_string());
        }
        if entry
            .unix_mode()
            .is_some_and(|mode| (mode & 0o170000) == 0o120000)
        {
            return Err("Plugin archives may not contain symbolic links.".to_string());
        }

        let remaining = MAX_EXTRACTED_SIZE.saturating_sub(total_size);
        let expected_size = entry.size();
        if expected_size > remaining {
            return Err("Expanded plugin exceeds the 200 MB limit.".to_string());
        }

        let output = temp_dir.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&output).map_err(|error| error.to_string())?;
            continue;
        }
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)
            .map_err(|error| error.to_string())?;
        let mut limited = std::io::Read::take(&mut entry, remaining.saturating_add(1));
        let copied = std::io::copy(&mut limited, &mut file)
            .map_err(|error| format!("Plugin archive extraction failed: {error}"))?;
        if copied > remaining {
            return Err("Expanded plugin exceeds the 200 MB limit.".to_string());
        }
        if copied != expected_size {
            return Err("Plugin archive entry was truncated.".to_string());
        }
        total_size = total_size.saturating_add(copied);
    }

    let plugin_dir = if temp_dir.join("plugin.json").is_file() {
        temp_dir.to_path_buf()
    } else {
        let children = fs::read_dir(temp_dir)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        if children.len() != 1 || !children[0].path().is_dir() {
            return Err(
                "Archive must contain plugin.json at its root or in one top-level folder."
                    .to_string(),
            );
        }
        let nested = children[0].path();
        if !nested.join("plugin.json").is_file() {
            return Err("Archive does not contain plugin.json.".to_string());
        }
        nested
    };

    // config.json is per-user state. Never accept it from a package: updates keep the
    // existing file, and the app writes it when the user saves settings.
    let packaged_config = plugin_dir.join("config.json");
    if packaged_config.is_file() {
        fs::remove_file(&packaged_config)
            .map_err(|error| format!("Unable to discard packaged plugin configuration: {error}"))?;
    }

    Ok(plugin_dir)
}

fn extract_and_install(
    app: tauri::AppHandle,
    manager: Arc<crate::plugin_manager::PluginManager>,
    archive: Vec<u8>,
    requested_dir_name: Option<String>,
    expected_identifier: Option<String>,
) -> Result<InstalledPluginInfo, String> {
    if let Some(dir_name) = &requested_dir_name {
        validate_dir_name(dir_name)?;
    }

    let root = isudeck_root(&app)?;
    let plugins_dir = root.join("plugins");
    fs::create_dir_all(&plugins_dir).map_err(|error| error.to_string())?;
    let temp_dir = unique_path(&plugins_dir, "plugin.extract");
    fs::create_dir(&temp_dir).map_err(|error| error.to_string())?;

    let result = (|| {
        let plugin_dir = extract_archive(archive, &temp_dir)?;

        let manifest = read_plugin_manifest(&plugin_dir)?;
        let identifier = manifest_string(&manifest, "identifier");
        if let Some(expected) = &expected_identifier {
            if &identifier != expected {
                return Err("Plugin identifier does not match the registry entry.".to_string());
            }
        }

        let dir_name = match &requested_dir_name {
            Some(name) => name.clone(),
            None => {
                validate_dir_name(&identifier)?;
                identifier.clone()
            }
        };
        let target = plugins_dir.join(&dir_name);

        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::PermissionsExt;
            let executable = manifest
                .get("executable")
                .or_else(|| manifest.get("main"))
                .and_then(Value::as_str)
                .ok_or("Plugin manifest must name an executable.")?;
            let executable_path = plugin_dir.join(safe_archive_path(executable)?);
            fs::set_permissions(&executable_path, fs::Permissions::from_mode(0o755))
                .map_err(|error| format!("Unable to make plugin executable: {error}"))?;
        }

        if let Ok(metadata) = fs::symlink_metadata(&target) {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err("Plugin target is not a regular directory.".to_string());
            }
        }
        let existing_config = target.join("config.json");
        if let Ok(metadata) = fs::symlink_metadata(&existing_config) {
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err("Existing plugin configuration is not a regular file.".to_string());
            }
        }

        manager.stop_plugin(&dir_name);
        if existing_config.is_file() {
            if let Err(error) = fs::copy(existing_config, plugin_dir.join("config.json")) {
                manager.load_plugins_from_dir(&plugins_dir);
                return Err(format!("Unable to preserve plugin configuration: {error}"));
            }
        }

        let backup = unique_path(&plugins_dir, &format!("{dir_name}.backup"));
        if target.exists() {
            if let Err(error) = fs::rename(&target, &backup) {
                manager.load_plugins_from_dir(&plugins_dir);
                return Err(format!(
                    "Unable to stage current plugin for update: {error}"
                ));
            }
        }
        if let Err(error) = fs::rename(&plugin_dir, &target) {
            if backup.exists() {
                let _ = fs::rename(&backup, &target);
            }
            manager.load_plugins_from_dir(&plugins_dir);
            return Err(format!("Unable to install plugin: {error}"));
        }
        let _ = fs::remove_dir_all(&temp_dir);
        manager.load_plugins_from_dir(&plugins_dir);
        if backup.exists() {
            if let Err(error) = fs::remove_dir_all(&backup) {
                eprintln!("[PluginStore] Unable to clean plugin backup: {error}");
            }
        }

        Ok(InstalledPluginInfo {
            identifier,
            dir_name,
            name: manifest_string(&manifest, "name"),
            version: manifest_string(&manifest, "version"),
        })
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&temp_dir);
    }
    result
}

#[command]
pub async fn plugin_store_fetch_registry(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
    let data = download_https(&url, MAX_REGISTRY_SIZE).await?;
    let content =
        String::from_utf8(data).map_err(|error| format!("Registry is not valid UTF-8: {error}"))?;
    let content = normalize_registry(&content, &url)?;
    let fetched_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let cache_content = serde_json::json!({
        "sourceUrl": url,
        "content": content,
        "fetchedAt": fetched_at
    });
    let root = isudeck_root(&app)?;
    let cache_path = root.join("plugin_registry_cache.json");
    let temp_path = unique_path(&root, "plugin-registry-cache");
    let backup_path = unique_path(&root, "plugin-registry-backup");
    fs::write(
        &temp_path,
        serde_json::to_vec(&cache_content).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Unable to write plugin registry cache: {error}"))?;
    if cache_path.exists() {
        fs::rename(&cache_path, &backup_path)
            .map_err(|error| format!("Unable to stage plugin registry cache: {error}"))?;
    }
    if let Err(error) = fs::rename(&temp_path, &cache_path) {
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, &cache_path);
        }
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Unable to update plugin registry cache: {error}"));
    }
    if backup_path.exists() {
        fs::remove_file(backup_path)
            .map_err(|error| format!("Registry cached, but old cache cleanup failed: {error}"))?;
    }
    Ok(content)
}

#[command]
pub async fn plugin_store_install_from_url(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<EngineState>>,
    url: String,
    sha256: String,
    dir_name: Option<String>,
    expected_identifier: Option<String>,
    expected_size: Option<u64>,
) -> Result<InstalledPluginInfo, String> {
    parse_sha256(&sha256)?;
    if let Some(name) = &dir_name {
        validate_dir_name(name)?;
    }
    let data = download_https(&url, MAX_DOWNLOAD_SIZE).await?;
    if expected_size.is_some_and(|size| size != data.len() as u64) {
        return Err("Downloaded plugin size does not match the registry.".to_string());
    }
    verify_sha256(&data, &sha256)?;
    let manager = state.plugin_manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        extract_and_install(app, manager, data, dir_name, expected_identifier)
    })
    .await
    .map_err(|error| format!("Plugin installation task failed: {error}"))?
}

#[command]
pub async fn plugin_store_install_from_file(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<EngineState>>,
    path: String,
    sha256: Option<String>,
    dir_name: Option<String>,
) -> Result<InstalledPluginInfo, String> {
    if let Some(name) = &dir_name {
        validate_dir_name(name)?;
    }
    if let Some(expected) = &sha256 {
        parse_sha256(expected)?;
    }
    let manager = state.plugin_manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let archive_path = PathBuf::from(path);
        let metadata = fs::metadata(&archive_path).map_err(|error| error.to_string())?;
        if !metadata.is_file() || metadata.len() > MAX_DOWNLOAD_SIZE as u64 {
            return Err("Plugin archive must be a file no larger than 50 MB.".to_string());
        }
        let mut archive = Vec::with_capacity(metadata.len() as usize);
        fs::File::open(archive_path)
            .map_err(|error| error.to_string())?
            .take(MAX_DOWNLOAD_SIZE as u64 + 1)
            .read_to_end(&mut archive)
            .map_err(|error| error.to_string())?;
        if archive.len() > MAX_DOWNLOAD_SIZE {
            return Err("Plugin archive exceeds the 50 MB limit.".to_string());
        }
        if let Some(expected) = sha256 {
            verify_sha256(&archive, &expected)?;
        }
        extract_and_install(app, manager, archive, dir_name, None)
    })
    .await
    .map_err(|error| format!("Plugin installation task failed: {error}"))?
}

#[command]
pub fn plugin_store_uninstall(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<EngineState>>,
    dir_name: String,
) -> Result<(), String> {
    validate_dir_name(&dir_name)?;
    let plugins_dir = isudeck_root(&app)?.join("plugins");
    let target = plugins_dir.join(&dir_name);
    let metadata = fs::symlink_metadata(&target).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Plugin target is not a regular directory.".to_string());
    }
    let removed = unique_path(&plugins_dir, &format!("{dir_name}.removed"));
    state.plugin_manager.stop_plugin(&dir_name);
    fs::rename(&target, &removed).map_err(|error| format!("Unable to remove plugin: {error}"))?;
    fs::remove_dir_all(removed).map_err(|error| format!("Unable to clean removed plugin: {error}"))
}

#[command]
pub fn plugin_store_validate(app: tauri::AppHandle, dir_name: String) -> Result<(), String> {
    validate_dir_name(&dir_name)?;
    let plugin_dir = isudeck_root(&app)?.join("plugins").join(dir_name);
    let metadata = fs::symlink_metadata(&plugin_dir).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Plugin target is not a regular directory.".to_string());
    }
    read_plugin_manifest(&plugin_dir)?;
    Ok(())
}

#[command]
pub fn plugin_manager_stop_plugin(
    state: tauri::State<'_, Arc<EngineState>>,
    dir_name: String,
) -> Result<(), String> {
    validate_dir_name(&dir_name)?;
    state.plugin_manager.stop_plugin(&dir_name);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn archive_paths_reject_traversal_and_absolute_names() {
        assert!(safe_archive_path("../outside").is_err());
        assert!(safe_archive_path("/outside").is_err());
        assert!(safe_archive_path(r"..\outside").is_err());
        assert!(safe_archive_path("assets/icon.svg").is_ok());
    }

    fn build_test_archive(entries: &[(&str, &[u8])]) -> Vec<u8> {
        use std::io::Write;
        let mut buffer = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buffer);
            let options = zip::write::SimpleFileOptions::default();
            for (name, data) in entries {
                writer.start_file(*name, options).unwrap();
                writer.write_all(data).unwrap();
            }
            writer.finish().unwrap();
        }
        buffer.into_inner()
    }

    #[test]
    fn archive_extraction_validates_manifest_and_flat_layout() {
        let temp_dir = unique_path(&std::env::temp_dir(), "plugin-archive-test");
        fs::create_dir_all(&temp_dir).unwrap();

        let archive = build_test_archive(&[
            (
                "plugin.json",
                br#"{"identifier":"com.test.plugin","name":"Test","version":"1.0.0","executable":"test.exe"}"#,
            ),
            ("test.exe", b"fake-binary"),
        ]);
        let plugin_dir = extract_archive(archive, &temp_dir).unwrap();
        assert!(plugin_dir.join("plugin.json").is_file());
        assert!(plugin_dir.join("test.exe").is_file());
        let manifest = read_plugin_manifest(&plugin_dir).unwrap();
        assert_eq!(manifest["identifier"], "com.test.plugin");

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn registry_accepts_external_links_without_optional_fields() {
        let registry = serde_json::json!({
            "schemaVersion": 1,
            "plugins": [{
                "identifier": "com.example.plugin",
                "name": "Example",
                "version": "1.0.0",
                "icon": "https://cdn.example.com/icon.svg",
                "download": {
                    "url": "https://github.com/example/releases/download/v1/plugin.zip",
                    "sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
                }
            }]
        });
        let content = registry.to_string();
        assert!(validate_registry(&content).is_ok());

        let normalized = normalize_registry(&content, "https://plugins.example.com/registry.json")
            .expect("external metadata must normalize");
        let value: Value = serde_json::from_str(&normalized).unwrap();
        let plugin = &value["plugins"][0];
        assert_eq!(
            plugin["download"]["url"],
            "https://github.com/example/releases/download/v1/plugin.zip"
        );
        assert_eq!(plugin["icon"], "https://cdn.example.com/icon.svg");
    }

    #[test]
    fn utf8_bom_is_accepted_in_registries() {
        let content = "\u{feff}{\"schemaVersion\":1,\"plugins\":[]}";
        assert!(validate_registry(content).is_ok());
        assert!(normalize_registry(content, "https://example.com/registry.json").is_ok());
    }

    #[test]
    fn utf8_bom_is_accepted_in_manifests() {
        let dir = unique_path(&std::env::temp_dir(), "plugin-manifest-bom");
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("plugin.json"),
            "\u{feff}{\"identifier\":\"com.test.plugin\",\"executable\":\"test.exe\"}",
        )
        .unwrap();
        fs::write(dir.join("test.exe"), b"fake-binary").unwrap();

        assert!(read_plugin_manifest(&dir).is_ok());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn archive_extraction_discards_packaged_config() {
        let temp_dir = unique_path(&std::env::temp_dir(), "plugin-archive-config");
        fs::create_dir_all(&temp_dir).unwrap();

        let archive = build_test_archive(&[
            (
                "plugin.json",
                br#"{"identifier":"com.test.plugin","name":"Test","version":"1.0.0","executable":"test.exe"}"#,
            ),
            ("test.exe", b"fake-binary"),
            ("config.json", br#"{"apiKey":"packaged-secret"}"#),
        ]);
        let plugin_dir = extract_archive(archive, &temp_dir).unwrap();
        assert!(plugin_dir.join("test.exe").is_file());
        assert!(!plugin_dir.join("config.json").exists());

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn archive_extraction_rejects_traversal_entries() {
        let temp_dir = unique_path(&std::env::temp_dir(), "plugin-archive-traversal");
        fs::create_dir_all(&temp_dir).unwrap();

        let archive = build_test_archive(&[("../outside.txt", b"bad")]);
        assert!(extract_archive(archive, &temp_dir).is_err());

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn plugin_directory_names_are_path_safe() {
        assert!(validate_dir_name("IsuDeck.Plugin_1").is_ok());
        assert!(validate_dir_name("..").is_err());
        assert!(validate_dir_name("nested/plugin").is_err());
    }

    #[test]
    fn sha256_verification_rejects_bad_hashes() {
        assert!(verify_sha256(
            b"foo",
            "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
        )
        .is_ok());
        assert!(verify_sha256(b"foo", &"0".repeat(64)).is_err());
        assert!(parse_sha256("not-a-hash").is_err());
    }

    #[test]
    fn registry_urls_must_use_https() {
        assert!(validate_https_url("https://example.com/registry.json").is_ok());
        assert!(validate_https_url("http://example.com/registry.json").is_err());
    }

    #[test]
    fn registry_requires_unique_ids_and_integrity_metadata() {
        let valid = serde_json::json!({
            "schemaVersion": 1,
            "plugins": [{
                "identifier": "com.example.plugin",
                "dirName": "ExamplePlugin",
                "name": "Example",
                "version": "1.0.0",
                "download": {
                    "url": "https://example.com/plugin.zip",
                    "sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
                    "size": 3
                }
            }]
        });
        assert!(validate_registry(&valid.to_string()).is_ok());

        let mut duplicate = valid.clone();
        duplicate["plugins"]
            .as_array_mut()
            .unwrap()
            .push(valid["plugins"][0].clone());
        assert!(validate_registry(&duplicate.to_string()).is_err());
    }

    #[test]
    fn relative_registry_assets_are_resolved_against_the_catalog() {
        let registry = serde_json::json!({
            "schemaVersion": 1,
            "plugins": [{
                "identifier": "com.example.plugin",
                "dirName": "ExamplePlugin",
                "name": "Example",
                "version": "1.0.0",
                "icon": "icons/example.svg",
                "screenshots": ["screenshots/example/1.png"],
                "changelog": "changelog/example.md",
                "download": {
                    "url": "plugins/com.example.plugin/1.0.0/example.zip",
                    "sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
                    "size": 3
                }
            }]
        });

        let normalized = normalize_registry(
            &registry.to_string(),
            "https://plugins.example.com/catalog/registry.json",
        )
        .unwrap();
        let value: Value = serde_json::from_str(&normalized).unwrap();
        let plugin = &value["plugins"][0];
        assert_eq!(
            plugin["download"]["url"],
            "https://plugins.example.com/catalog/plugins/com.example.plugin/1.0.0/example.zip"
        );
        assert_eq!(
            plugin["icon"],
            "https://plugins.example.com/catalog/icons/example.svg"
        );
        assert_eq!(
            plugin["screenshots"][0],
            "https://plugins.example.com/catalog/screenshots/example/1.png"
        );
    }
}
