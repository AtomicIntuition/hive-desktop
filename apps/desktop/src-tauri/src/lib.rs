mod commands;
mod tray;

use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Create system tray
            tray::create_tray(app.handle())?;

            // Attempt to spawn the Node.js runtime server
            let shell = app.handle().shell();
            let result = shell
                .command("node")
                .args(["-e", "require('@hive-desktop/runtime')"])
                .spawn();

            match result {
                Ok(child) => {
                    println!("[tauri] Runtime server spawned (pid: {})", child.pid());
                }
                Err(e) => {
                    // Try npx as fallback
                    println!("[tauri] Could not spawn runtime via node: {e}");
                    println!("[tauri] Runtime server not auto-started — start manually with: pnpm dev:runtime");
                }
            }

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
