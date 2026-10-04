use std::path::{Path, PathBuf};
use windows_sys::Win32::Foundation::FALSE;
use windows_sys::Win32::System::Threading::{
    GetCurrentProcess, GetCurrentThread, GetExitCodeProcess, SetPriorityClass, SetThreadPriority,
    WaitForSingleObject, HIGH_PRIORITY_CLASS, INFINITE, THREAD_PRIORITY_TIME_CRITICAL,
};
use windows_sys::Win32::UI::Shell::{
    ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
};
use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

pub static EMBEDDED_INTERCEPTION_DLL: &[u8] = include_bytes!("../../../engine/interception.dll");
pub static EMBEDDED_INSTALLER: &[u8] = include_bytes!("../../../drivers/install-interception.exe");

pub const INSTALL_HELPER_CMD: &str = "@echo off\r\n\
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

pub fn find_driver_installer(root: &Path, action: &str) -> Option<(PathBuf, String)> {
    let flag = if action == "install" { "/install" } else { "/uninstall" };
    let helper = root.join("drivers").join("install_helper.cmd");
    if helper.exists() {
        return Some((PathBuf::from("cmd.exe"), format!("/c \"{}\" {}", helper.display(), flag)));
    }
    let p1 = root.join("drivers").join("install-interception.exe");
    if p1.exists() { return Some((p1, flag.to_string())); }
    let p2 = root.join("install-interception.exe");
    if p2.exists() { return Some((p2, flag.to_string())); }
    None
}

pub fn enable_realtime_priority() {
    #[link(name = "winmm")]
    extern "system" {
        fn timeBeginPeriod(uPeriod: u32) -> u32;
    }

    unsafe {
        let _ = timeBeginPeriod(1);
        let _ = SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
        let _ = SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
    }
}

pub fn detect_system_language() -> &'static str {
    extern "system" {
        fn GetUserDefaultUILanguage() -> u16;
    }
    let lang_id = unsafe { GetUserDefaultUILanguage() };
    if (lang_id & 0xFF) == 0x1F {
        "tr"
    } else {
        "en"
    }
}

pub fn check_registry_has_interception() -> bool {
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
    false
}

pub fn run_silent_elevated(exe_path: &Path, args: &str) -> Result<bool, String> {
    use std::os::windows::ffi::OsStrExt;

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
