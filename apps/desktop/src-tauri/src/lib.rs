mod commands;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Create system tray
            tray::create_tray(app.handle())?;

            // Log that we're ready
            println!("[tauri] Hive Desktop ready");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_runtime_port,
            commands::get_app_version,
            commands::get_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hive Desktop");
}
