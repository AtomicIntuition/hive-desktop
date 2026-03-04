mod commands;
mod tray;

use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

// Store the runtime child process so we can kill it on exit
static RUNTIME_CHILD: Mutex<Option<CommandChild>> = Mutex::new(None);

/// Find node binary — Finder-launched apps have a minimal PATH
fn find_node() -> Option<String> {
    let candidates = [
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        "/usr/bin/node",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    // Check HOME-relative paths (nvm, fnm, etc.)
    if let Ok(home) = std::env::var("HOME") {
        let home_candidates = [
            format!("{home}/.nvm/current/bin/node"),
            format!("{home}/.local/share/fnm/aliases/default/bin/node"),
            format!("{home}/.local/bin/node"),
        ];
        for path in &home_candidates {
            if std::path::Path::new(path).exists() {
                return Some(path.clone());
            }
        }
    }
    None
}

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

    // Find node binary
    let node_path = match find_node() {
        Some(p) => {
            println!("[tauri] Found node at: {p}");
            p
        }
        None => {
            println!("[tauri] Node.js not found. Tried common paths.");
            println!("[tauri] Install Node.js v22+ and restart the app.");
            return;
        }
    };

    // Get app data dir for the database
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));

    // Ensure data dir exists
    let _ = std::fs::create_dir_all(&data_dir);

    let script_path = resource_path.to_string_lossy().to_string();
    let data_path = data_dir.to_string_lossy().to_string();

    // Build PATH that includes the node binary's parent dir (for npx/npm)
    let node_dir = std::path::Path::new(&node_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let system_path = std::env::var("PATH").unwrap_or_default();
    let full_path = if system_path.is_empty() {
        format!("{node_dir}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin")
    } else {
        format!("{node_dir}:{system_path}")
    };

    let shell = app.handle().shell();
    let result = shell
        .command(&node_path)
        .args(["--no-warnings", &script_path])
        .env("HIVE_DATA_DIR", &data_path)
        .env("PATH", &full_path)
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
            println!("[tauri] Node path: {node_path}");
            println!("[tauri] Script path: {script_path}");
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
