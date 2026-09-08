use tauri::State;

use crate::{error::AppError, state::AppState};

use super::{dto::{EmptyInput, OpmlImportInput, OpmlImportResult}, service};

#[tauri::command]
pub async fn opml_import(
    input: OpmlImportInput,
    state: State<'_, AppState>,
) -> Result<OpmlImportResult, AppError> {
    service::import(&state.db, &input.content).await
}

#[tauri::command]
pub async fn opml_export(
    _input: EmptyInput,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    service::export(&state.db).await
}
