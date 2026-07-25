mod network;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Öffnet externe Links (z. B. "powered by HA Fleet Manager") im System-Browser.
        .plugin(tauri_plugin_opener::init())
        // Alle Geräte-HTTP-Aufrufe laufen über dieses Plugin – umgeht CORS,
        // siehe docs/REQUIREMENTS.md §3.
        .plugin(tauri_plugin_http::init())
        // Macht die Rust-Funktion für TypeScript aufrufbar (via `invoke`).
        .invoke_handler(tauri::generate_handler![network::list_local_networks])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
