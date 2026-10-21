// The desktop wrapper (docs/tech.md "Desktop/Steam"): the same web build in a native window.
// Steamworks (achievements) joins here later as a plugin.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
