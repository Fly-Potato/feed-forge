use tauri::State;

use crate::{error::AppError, state::AppState};

use super::{dto::{EmptyInput, SettingsDto, SettingsUpdateInput}, service};

#[tauri::command]
pub async fn settings_get(_input: EmptyInput, state: State<'_, AppState>) -> Result<SettingsDto, AppError> {
    service::get(&state.db).await
}

#[tauri::command]
pub async fn settings_update(input: SettingsUpdateInput, state: State<'_, AppState>) -> Result<SettingsDto, AppError> {
    service::update(&state.db, input).await
}
