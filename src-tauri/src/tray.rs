use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Runtime, Window, WindowEvent,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Debug, PartialEq, Eq)]
enum TrayMenuAction {
    About,
    Quit,
}

fn tray_menu_action(id: &str) -> Option<TrayMenuAction> {
    match id {
        "about" => Some(TrayMenuAction::About),
        "quit" => Some(TrayMenuAction::Quit),
        _ => None,
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn show_about(app: &AppHandle) {
    let package_info = app.package_info();
    app.dialog()
        .message(format!(
            "Feed Forge\n版本 {}\n\n本地 RSS 阅读器",
            package_info.version
        ))
        .title("关于 Feed Forge")
        .kind(MessageDialogKind::Info)
        .show(|_| {});
}

pub fn setup(app: &mut App) -> tauri::Result<()> {
    let about = MenuItemBuilder::with_id("about", "关于 Feed Forge").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&about)
        .separator()
        .item(&quit)
        .build()?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Feed Forge")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match tray_menu_action(event.id().as_ref()) {
            Some(TrayMenuAction::About) => show_about(app),
            Some(TrayMenuAction::Quit) => app.exit(0),
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() == MAIN_WINDOW_LABEL {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{tray_menu_action, TrayMenuAction};

    #[test]
    fn maps_supported_tray_menu_ids_to_actions() {
        assert_eq!(tray_menu_action("about"), Some(TrayMenuAction::About));
        assert_eq!(tray_menu_action("quit"), Some(TrayMenuAction::Quit));
        assert_eq!(tray_menu_action("unexpected"), None);
    }
}
