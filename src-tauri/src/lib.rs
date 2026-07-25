#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Öffnet externe Links (z. B. "powered by HA Fleet Manager") im System-Browser.
        .plugin(tauri_plugin_opener::init())
        // Alle Geräte-HTTP-Aufrufe laufen über dieses Plugin – umgeht CORS,
        // siehe docs/REQUIREMENTS.md §3.
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
