use sqlx::SqlitePool;

use crate::error::AppError;

use super::{dto::{ArticlePage, ArticleSummary}, repository};

fn validate_filter(filter: &str) -> Result<(), AppError> {
    if matches!(filter, "all" | "unread" | "starred") {
        Ok(())
    } else {
        Err(AppError::new("invalid_input", "文章筛选条件无效。", false))
    }
}

pub async fn list_articles(
    pool: &SqlitePool,
    feed_id: Option<i64>,
    filter: &str,
    limit: u32,
    offset: u32,
) -> Result<ArticlePage, AppError> {
    validate_filter(filter)?;
    repository::list(pool, feed_id, filter, limit, offset)
        .await
        .map_err(AppError::from)
}

pub async fn mark_read(
    pool: &SqlitePool,
    article_id: i64,
    is_read: bool,
) -> Result<ArticleSummary, AppError> {
    repository::update_read(pool, article_id, is_read)
        .await?
        .ok_or_else(AppError::not_found)
}

pub async fn toggle_star(
    pool: &SqlitePool,
    article_id: i64,
    is_starred: bool,
) -> Result<ArticleSummary, AppError> {
    repository::update_star(pool, article_id, is_starred)
        .await?
        .ok_or_else(AppError::not_found)
}
