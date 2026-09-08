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
        return Err(AppError::not_found());
    }
    Ok(SyncAccepted { job_id: input.job_id })
}

#[tauri::command]
pub fn sync_status(
    input: SyncStatusInput,
    state: State<'_, AppState>,
) -> Result<SyncStatus, AppError> {
    state.sync.status(input.job_id).ok_or_else(AppError::not_found)
}
