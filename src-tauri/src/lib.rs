mod db;
mod error;
mod modules;
mod state;
#[cfg(target_os = "windows")]
mod tray;

use tauri::Manager;
use tauri_plugin_log::{
    log::LevelFilter, FileOpenStrategy, RotationStrategy, Target, TargetKind, TimezoneStrategy,
};

const MAX_LOG_FILE_SIZE: u128 = 5 * 1024 * 1024;

fn log_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let mut targets = vec![
        Target::new(TargetKind::LogDir { file_name: None }),
        Target::new(TargetKind::Webview),
    ];
    #[cfg(debug_assertions)]
    targets.push(Target::new(TargetKind::Stdout));

    tauri_plugin_log::Builder::new()
        .targets(targets)
        .level(if cfg!(debug_assertions) {
            LevelFilter::Debug
        } else {
            LevelFilter::Info
        })
        .level_for("sqlx", LevelFilter::Warn)
        .level_for("reqwest", LevelFilter::Warn)
        .rotation_strategy(RotationStrategy::KeepSome(5))
        .max_file_size(MAX_LOG_FILE_SIZE)
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .file_open_strategy(FileOpenStrategy::Append)
        .build()
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! Welcome to Feed Forge.")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(log_plugin())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(target_os = "windows")]
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(tray::handle_window_event);

    builder
        .setup(|app| {
            log::info!(target: "feed-forge::app", "database initialization started");
            let pool = match tauri::async_runtime::block_on(db::init_db(&app.handle())) {
                Ok(pool) => pool,
                Err(error) => {
                    log::error!(
                        target: "feed-forge::app",
                        "database initialization failed error_code={}",
                        error.code
                    );
                    return Err(error.into());
                }
            };
            log::info!(target: "feed-forge::app", "database initialization completed");
            app.manage(state::AppState {
                db: pool,
                sync: std::sync::Arc::new(state::SyncManager::new()),
            });
            #[cfg(target_os = "windows")]
            tray::setup(app)?;
            log::info!(target: "feed-forge::app", "application setup completed");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            modules::feeds::commands::feeds_list,
            modules::feeds::commands::feeds_add,
            modules::feeds::commands::feeds_update,
            modules::feeds::commands::feeds_remove,
            modules::feeds::commands::feeds_groups_list,
            modules::feeds::commands::feeds_group_create,
            modules::feeds::commands::feeds_group_update,
            modules::feeds::commands::feeds_group_remove,
            modules::feeds::commands::feeds_move,
            modules::articles::commands::articles_list,
            modules::articles::commands::articles_mark_read,
            modules::articles::commands::articles_toggle_star,
            modules::sync::commands::sync_start,
            modules::sync::commands::sync_cancel,
            modules::sync::commands::sync_status,
            modules::opml::commands::opml_import,
            modules::opml::commands::opml_export,
            modules::settings::commands::settings_get,
            modules::settings::commands::settings_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Feed Forge");
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greet_returns_welcome_message() {
        assert_eq!(greet("Ada"), "Hello, Ada! Welcome to Feed Forge.");
    }
}
