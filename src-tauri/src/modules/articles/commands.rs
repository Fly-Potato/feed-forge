use tauri::State;

use crate::{error::AppError, state::AppState};

use super::{
    dto::{ArticleListInput, ArticlePage, ArticleSummary, MarkReadInput, ToggleStarInput},
    service,
};

#[tauri::command]
pub async fn articles_list(
    input: ArticleListInput,
    state: State<'_, AppState>,
) -> Result<ArticlePage, AppError> {
    service::list_articles(
        &state.db,
        input.feed_id,
        &input.filter,
        input.limit,
        input.offset,
    )
    .await
}

#[tauri::command]
pub async fn articles_mark_read(
    input: MarkReadInput,
    state: State<'_, AppState>,
) -> Result<ArticleSummary, AppError> {
    service::mark_read(&state.db, input.article_id, input.is_read).await
}

#[tauri::command]
pub async fn articles_toggle_star(
    input: ToggleStarInput,
    state: State<'_, AppState>,
) -> Result<ArticleSummary, AppError> {
    service::toggle_star(&state.db, input.article_id, input.is_starred).await
}
