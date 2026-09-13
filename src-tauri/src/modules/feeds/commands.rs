use tauri::State;

use crate::{error::AppError, state::AppState};

use super::{
    dto::{
        AddFeedInput, EmptyInput, FeedGroup, FeedGroupNameInput, FeedSummary, MoveFeedInput,
        RemoveFeedGroupInput, RemoveFeedInput, RemovedFeed, RemovedFeedGroup, UpdateFeedGroupInput,
        UpdateFeedInput,
    },
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
    service::add_feed(&state.db, &input.url, input.group_id).await
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
    Ok(RemovedFeed {
        feed_id: input.feed_id,
    })
}

#[tauri::command]
pub async fn feeds_groups_list(
    _input: EmptyInput,
    state: State<'_, AppState>,
) -> Result<Vec<FeedGroup>, AppError> {
    service::list_groups(&state.db).await
}

#[tauri::command]
pub async fn feeds_group_create(
    input: FeedGroupNameInput,
    state: State<'_, AppState>,
) -> Result<FeedGroup, AppError> {
    service::create_group(&state.db, &input.title).await
}

#[tauri::command]
pub async fn feeds_group_update(
    input: UpdateFeedGroupInput,
    state: State<'_, AppState>,
) -> Result<FeedGroup, AppError> {
    service::update_group(&state.db, input.group_id, &input.title).await
}

#[tauri::command]
pub async fn feeds_group_remove(
    input: RemoveFeedGroupInput,
    state: State<'_, AppState>,
) -> Result<RemovedFeedGroup, AppError> {
    service::remove_group(&state.db, input.group_id).await?;
    Ok(RemovedFeedGroup {
        group_id: input.group_id,
    })
}

#[tauri::command]
pub async fn feeds_move(
    input: MoveFeedInput,
    state: State<'_, AppState>,
) -> Result<FeedSummary, AppError> {
    service::move_feed(&state.db, input.feed_id, input.group_id).await
}
