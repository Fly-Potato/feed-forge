use tauri::State;

use crate::{error::AppError, state::AppState};

use super::{dto::{EmptyInput, OpmlImportInput, OpmlImportResult}, service};

#[tauri::command]
pub async fn opml_import(
    input: OpmlImportInput,
    state: State<'_, AppState>,
) -> Result<OpmlImportResult, AppError> {
    let result = service::import(&state.db, &input.content).await;
    match &result {
        Ok(summary) => log::info!(
            target: "feed-forge::opml",
            "opml import completed imported={} skipped={}",
            summary.imported,
            summary.skipped
        ),
        Err(error) => log::warn!(
            target: "feed-forge::opml",
            "opml import failed error_code={}",
            error.code
        ),
    }
    result
}

#[tauri::command]
pub async fn opml_export(
    _input: EmptyInput,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let result = service::export(&state.db).await;
    match &result {
        Ok(content) => log::info!(
            target: "feed-forge::opml",
            "opml export completed bytes={}",
            content.len()
        ),
        Err(error) => log::warn!(
            target: "feed-forge::opml",
            "opml export failed error_code={}",
            error.code
        ),
    }
    result
}
