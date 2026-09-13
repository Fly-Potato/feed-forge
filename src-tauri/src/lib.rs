mod db;
mod error;
mod modules;
mod state;
#[cfg(target_os = "windows")]
mod tray;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! Welcome to Feed Forge.")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(target_os = "windows")]
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(tray::handle_window_event);

    builder
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init_db(&app.handle()))?;
            app.manage(state::AppState {
                db: pool,
                sync: std::sync::Arc::new(state::SyncManager::new()),
            });
            #[cfg(target_os = "windows")]
            tray::setup(app)?;
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
