mod commands;
mod tray;

use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

// Store the runtime child process so we can kill it on exit
static RUNTIME_CHILD: Mutex<Option<CommandChild>> = Mutex::new(None);

fn spawn_runtime(app: &tauri::App) {
    // Resolve the bundled runtime script from Tauri resources
    let resource_path = app
        .path()
        .resource_dir()
        .expect("failed to resolve resource dir")
        .join("runtime-bundle.mjs");

    if !resource_path.exists() {
        println!("[tauri] Runtime bundle not found at: {}", resource_path.display());
        println!("[tauri] Start manually with: pnpm dev:runtime");
        return;
    }

    // Get app data dir for the database
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));

    // Ensure data dir exists
    let _ = std::fs::create_dir_all(&data_dir);

    let script_path = resource_path.to_string_lossy().to_string();
    let data_path = data_dir.to_string_lossy().to_string();

    let shell = app.handle().shell();
    let result = shell
        .command("node")
        .args(["--no-warnings", &script_path])
        .env("HIVE_DATA_DIR", &data_path)
        .spawn();

    match result {
        Ok((_rx, child)) => {
            println!("[tauri] Runtime server spawned (pid: {})", child.pid());
            if let Ok(mut guard) = RUNTIME_CHILD.lock() {
                *guard = Some(child);
            }
        }
        Err(e) => {
            println!("[tauri] Could not spawn runtime: {e}");
            println!("[tauri] Make sure Node.js (v22+) is installed and in your PATH");
            println!("[tauri] Or start manually with: pnpm dev:runtime");
        }
    }
}

fn kill_runtime() {
    if let Ok(mut guard) = RUNTIME_CHILD.lock() {
        if let Some(child) = guard.take() {
            println!("[tauri] Stopping runtime server (pid: {})", child.pid());
            let _ = child.kill();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Create system tray
            tray::create_tray(app.handle())?;

            // Spawn the bundled Node.js runtime
            spawn_runtime(app);

            println!("[tauri] Hive Desktop ready");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_runtime_port,
            commands::get_app_version,
            commands::get_data_dir,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Hive Desktop");

    app.run(|_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            kill_runtime();
        }
    });
}
