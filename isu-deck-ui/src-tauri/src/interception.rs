use libloading::{Library, Symbol};
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub type InterceptionContext = *mut std::ffi::c_void;
pub type InterceptionDevice = i32;
pub type InterceptionFilter = u16;
pub type InterceptionPredicate = extern "C" fn(InterceptionDevice) -> i32;

#[allow(dead_code)]
pub const INTERCEPTION_FILTER_KEY_ALL: u16 = 0xFFFF;
#[allow(dead_code)]
pub const INTERCEPTION_FILTER_KEY_DOWN: u16 = 0x0001;
#[allow(dead_code)]
pub const INTERCEPTION_FILTER_KEY_UP: u16 = 0x0002;
#[allow(dead_code)]
pub const INTERCEPTION_FILTER_KEY_E0: u16 = 0x0004;

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct KeyStroke {
    pub code: u16,
    pub state: u16,
    pub information: u32,
}

pub struct InterceptionLib {
    _lib: Library,
    pub create_context: Symbol<'static, extern "C" fn() -> InterceptionContext>,
    pub destroy_context: Symbol<'static, extern "C" fn(InterceptionContext)>,
    pub set_filter: Symbol<'static, extern "C" fn(InterceptionContext, InterceptionPredicate, InterceptionFilter)>,
    pub is_keyboard: Symbol<'static, extern "C" fn(InterceptionDevice) -> i32>,
    pub wait: Symbol<'static, extern "C" fn(InterceptionContext) -> InterceptionDevice>,
    pub receive: Symbol<'static, extern "C" fn(InterceptionContext, InterceptionDevice, *mut KeyStroke, u32) -> i32>,
    pub send: Symbol<'static, extern "C" fn(InterceptionContext, InterceptionDevice, *const KeyStroke, u32) -> i32>,
    pub get_hardware_id: Symbol<'static, extern "C" fn(InterceptionContext, InterceptionDevice, *mut u16, u32) -> u32>,
}

unsafe impl Send for InterceptionLib {}
unsafe impl Sync for InterceptionLib {}

impl InterceptionLib {
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Arc<Self>, String> {
        let lib = unsafe { Library::new(path.as_ref()) }.map_err(|e| e.to_string())?;

        unsafe {
            let create_context: Symbol<extern "C" fn() -> InterceptionContext> =
                lib.get(b"interception_create_context").map_err(|e| e.to_string())?;
            let destroy_context: Symbol<extern "C" fn(InterceptionContext)> =
                lib.get(b"interception_destroy_context").map_err(|e| e.to_string())?;
            let set_filter: Symbol<extern "C" fn(InterceptionContext, InterceptionPredicate, InterceptionFilter)> =
                lib.get(b"interception_set_filter").map_err(|e| e.to_string())?;
            let is_keyboard: Symbol<extern "C" fn(InterceptionDevice) -> i32> =
                lib.get(b"interception_is_keyboard").map_err(|e| e.to_string())?;
            let wait: Symbol<extern "C" fn(InterceptionContext) -> InterceptionDevice> =
                lib.get(b"interception_wait").map_err(|e| e.to_string())?;
            let receive: Symbol<extern "C" fn(InterceptionContext, InterceptionDevice, *mut KeyStroke, u32) -> i32> =
                lib.get(b"interception_receive").map_err(|e| e.to_string())?;
            let send: Symbol<extern "C" fn(InterceptionContext, InterceptionDevice, *const KeyStroke, u32) -> i32> =
                lib.get(b"interception_send").map_err(|e| e.to_string())?;
            let get_hardware_id: Symbol<extern "C" fn(InterceptionContext, InterceptionDevice, *mut u16, u32) -> u32> =
                lib.get(b"interception_get_hardware_id").map_err(|e| e.to_string())?;

            Ok(Arc::new(Self {
                create_context: std::mem::transmute(create_context),
                destroy_context: std::mem::transmute(destroy_context),
                set_filter: std::mem::transmute(set_filter),
                is_keyboard: std::mem::transmute(is_keyboard),
                wait: std::mem::transmute(wait),
                receive: std::mem::transmute(receive),
                send: std::mem::transmute(send),
                get_hardware_id: std::mem::transmute(get_hardware_id),
                _lib: lib,
            }))
        }
    }

    pub fn get_device_hid(&self, context: InterceptionContext, device: InterceptionDevice) -> String {
        let mut buffer = [0u16; 512];
        let bytes_written = (self.get_hardware_id)(context, device, buffer.as_mut_ptr(), (buffer.len() * 2) as u32);
        
        if bytes_written == 0 {
            return "UNKNOWN_DEVICE".to_string();
        }

        let chars_count = (bytes_written as usize / 2).min(buffer.len());
        let raw = String::from_utf16_lossy(&buffer[..chars_count]);
        let clean = raw.trim_matches('\0').trim().to_string();

        if clean.is_empty() {
            return "UNKNOWN_DEVICE".to_string();
        }

        // C# engine ile uyumlu: Eğer içinde VID_ geçiyorsa standart formata dönüştür
        if let Some(vid_idx) = clean.find("VID_") {
            let slice = &clean[vid_idx..];
            if let Some(end_idx) = slice.find('#').or_else(|| slice.find('\\')) {
                return slice[..end_idx].to_string();
            }
            return slice.to_string();
        }

        clean
    }
}

pub fn find_interception_dll(app: &tauri::AppHandle) -> Option<PathBuf> {
    use tauri::Manager;

    // 1. Exe dizini veya altındaki engine klasörü
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let p1 = exe_dir.join("interception.dll");
            if p1.exists() { return Some(p1); }
            let p2 = exe_dir.join("engine").join("interception.dll");
            if p2.exists() { return Some(p2); }
        }
    }

    // 2. Tauri Resource dizini
    if let Ok(resource) = app.path().resolve("engine/interception.dll", tauri::path::BaseDirectory::Resource) {
        if resource.exists() {
            return Some(resource);
        }
    }

    // 4. Çalışma dizini yolları
    let paths = [
        PathBuf::from("engine/interception.dll"),
        PathBuf::from("interception.dll"),
        PathBuf::from("src-tauri/engine/interception.dll"),
        PathBuf::from("../src-tauri/engine/interception.dll"),
    ];
    for p in &paths {
        if p.exists() {
            return Some(p.clone());
        }
    }
    None
}
