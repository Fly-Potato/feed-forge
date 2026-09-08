use tauri::State;

use crate::{
    error::AppError,
    state::AppState,
};

use super::{
    dto::{AddFeedInput, EmptyInput, FeedSummary, RemoveFeedInput, RemovedFeed, UpdateFeedInput},
    service,
};

#[tauri::command]
pub async fn feeds_list(
    _input: EmptyInput,
    state: State<'_, AppState>,
) -> Result<Vec<FeedSummary>, AppError> {
    service::list_feeds(&state.db).await
}

#[tauri::command]
pub async fn feeds_add(
    input: AddFeedInput,
    state: State<'_, AppState>,
) -> Result<FeedSummary, AppError> {
    service::add_feed(&state.db, &input.url).await
}

#[tauri::command]
pub async fn feeds_update(
    input: UpdateFeedInput,
    state: State<'_, AppState>,
) -> Result<FeedSummary, AppError> {
    service::update_feed(&state.db, input.feed_id, input.title.as_deref()).await
}

#[tauri::command]
pub async fn feeds_remove(
    input: RemoveFeedInput,
    state: State<'_, AppState>,
) -> Result<RemovedFeed, AppError> {
    service::remove_feed(&state.db, input.feed_id).await?;
    Ok(RemovedFeed { feed_id: input.feed_id })
}
