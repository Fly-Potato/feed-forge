#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! Welcome to Feed Forge.")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
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
