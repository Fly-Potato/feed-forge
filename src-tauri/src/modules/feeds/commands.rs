use tauri::State;

use crate::{error::AppError, state::AppState};

use super::{
    dto::{
        AddFeedInput, EmptyInput, FeedGroup, FeedGroupNameInput, FeedSummary, MoveFeedInput,
        RemoveFeedGroupInput, RemoveFeedInput, RemovedFeed, RemovedFeedGroup, UpdateFeedGroupInput,
        UpdateFeedInput, UpdateFeedSourceInput,
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
    let result = service::add_feed(&state.db, &input.url, input.group_id).await;
    match &result {
        Ok(feed) => log::info!(
            target: "feed-forge::feeds",
            "feed added feed_id={} group_id={:?}",
            feed.id,
            feed.group_id
        ),
        Err(error) => log::warn!(
            target: "feed-forge::feeds",
            "feed add failed error_code={}",
            error.code
        ),
    }
    result
}

#[tauri::command]
pub async fn feeds_update(
    input: UpdateFeedInput,
    state: State<'_, AppState>,
) -> Result<FeedSummary, AppError> {
    let result = service::update_feed(&state.db, input.feed_id, input.title.as_deref()).await;
    match &result {
        Ok(_) => log::info!(target: "feed-forge::feeds", "feed updated feed_id={}", input.feed_id),
        Err(error) => log::warn!(
            target: "feed-forge::feeds",
            "feed update failed feed_id={} error_code={}",
            input.feed_id,
            error.code
        ),
    }
    result
}

#[tauri::command]
pub async fn feeds_update_source(
    input: UpdateFeedSourceInput,
    state: State<'_, AppState>,
) -> Result<FeedSummary, AppError> {
    let result =
        service::update_feed_source(&state.db, input.feed_id, &input.url, input.group_id).await;
    match &result {
        Ok(_) => log::info!(
            target: "feed-forge::feeds",
            "feed source updated feed_id={} group_id={:?}",
            input.feed_id,
            input.group_id
        ),
        Err(error) => log::warn!(
            target: "feed-forge::feeds",
            "feed source update failed feed_id={} error_code={}",
            input.feed_id,
            error.code
        ),
    }
    result
}

#[tauri::command]
pub async fn feeds_remove(
    input: RemoveFeedInput,
    state: State<'_, AppState>,
) -> Result<RemovedFeed, AppError> {
    if let Err(error) = service::remove_feed(&state.db, input.feed_id).await {
        log::warn!(
            target: "feed-forge::feeds",
            "feed remove failed feed_id={} error_code={}",
            input.feed_id,
            error.code
        );
        return Err(error);
    }
    log::info!(target: "feed-forge::feeds", "feed removed feed_id={}", input.feed_id);
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
    let result = service::create_group(&state.db, &input.title).await;
    match &result {
        Ok(group) => {
            log::info!(target: "feed-forge::feeds", "feed group created group_id={}", group.id)
        }
        Err(error) => log::warn!(
            target: "feed-forge::feeds",
            "feed group create failed error_code={}",
            error.code
        ),
    }
    result
}

#[tauri::command]
pub async fn feeds_group_update(
    input: UpdateFeedGroupInput,
    state: State<'_, AppState>,
) -> Result<FeedGroup, AppError> {
    let result = service::update_group(&state.db, input.group_id, &input.title).await;
    match &result {
        Ok(_) => log::info!(
            target: "feed-forge::feeds",
            "feed group updated group_id={}",
            input.group_id
        ),
        Err(error) => log::warn!(
            target: "feed-forge::feeds",
            "feed group update failed group_id={} error_code={}",
            input.group_id,
            error.code
        ),
    }
    result
}

#[tauri::command]
pub async fn feeds_group_remove(
    input: RemoveFeedGroupInput,
    state: State<'_, AppState>,
) -> Result<RemovedFeedGroup, AppError> {
    if let Err(error) = service::remove_group(&state.db, input.group_id).await {
        log::warn!(
            target: "feed-forge::feeds",
            "feed group remove failed group_id={} error_code={}",
            input.group_id,
            error.code
        );
        return Err(error);
    }
    log::info!(
        target: "feed-forge::feeds",
        "feed group removed group_id={}",
        input.group_id
    );
    Ok(RemovedFeedGroup {
        group_id: input.group_id,
    })
}

#[tauri::command]
pub async fn feeds_move(
    input: MoveFeedInput,
    state: State<'_, AppState>,
) -> Result<FeedSummary, AppError> {
    let result = service::move_feed(&state.db, input.feed_id, input.group_id).await;
    match &result {
        Ok(_) => log::info!(
            target: "feed-forge::feeds",
            "feed moved feed_id={} group_id={:?}",
            input.feed_id,
            input.group_id
        ),
        Err(error) => log::warn!(
            target: "feed-forge::feeds",
            "feed move failed feed_id={} error_code={}",
            input.feed_id,
            error.code
        ),
    }
    result
}
