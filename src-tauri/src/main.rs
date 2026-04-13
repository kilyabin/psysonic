// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK on Wayland is unstable — force X11/XWayland on all Linux packages.
    // Users can still override by setting these vars before launch.
    #[cfg(target_os = "linux")]
    unsafe {
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        if std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }
    psysonic_lib::run();
}
