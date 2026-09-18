use tauri::{ipc::Channel, State};

use crate::{error::AppError, state::AppState};

use super::{
    dto::{SyncAccepted, SyncCancelInput, SyncEvent, SyncStartInput, SyncStatus, SyncStatusInput},
    service,
};

#[tauri::command]
pub async fn sync_start(
    input: SyncStartInput,
    on_event: Channel<SyncEvent>,
    state: State<'_, AppState>,
) -> Result<SyncAccepted, AppError> {
    let (job_id, canceled) = state.sync.create_job();
    log::info!(
        target: "feed-forge::sync",
        "sync accepted job_id={} feed_id={:?}",
        job_id,
        input.feed_id
    );
    tauri::async_runtime::spawn(service::run(
        state.db.clone(),
        state.sync.clone(),
        input.feed_id,
        job_id,
        canceled,
        on_event,
    ));
    Ok(SyncAccepted { job_id })
}

#[tauri::command]
pub fn sync_cancel(
    input: SyncCancelInput,
    state: State<'_, AppState>,
) -> Result<SyncAccepted, AppError> {
    if !state.sync.cancel(input.job_id) {
        log::warn!(
            target: "feed-forge::sync",
            "sync cancel rejected job_id={} error_code=not_found",
            input.job_id
        );
        return Err(AppError::not_found());
    }
    log::info!(target: "feed-forge::sync", "sync cancel requested job_id={}", input.job_id);
    Ok(SyncAccepted { job_id: input.job_id })
}

#[tauri::command]
pub fn sync_status(
    input: SyncStatusInput,
    state: State<'_, AppState>,
) -> Result<SyncStatus, AppError> {
    state.sync.status(input.job_id).ok_or_else(AppError::not_found)
}
