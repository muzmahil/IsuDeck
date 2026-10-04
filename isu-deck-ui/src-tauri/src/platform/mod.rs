#[cfg(windows)]
pub mod windows;
#[cfg(windows)]
pub use windows as os;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "linux")]
pub use linux as os;

pub use os::PlatformActions;
