use sqlx::SqlitePool;
use url::Url;

use crate::error::AppError;

use super::{dto::FeedSummary, repository};

fn normalize_url(value: &str) -> Result<String, AppError> {
    let parsed = Url::parse(value.trim()).map_err(|_| AppError::invalid_url())?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host().is_none() {
        return Err(AppError::invalid_url());
    }
    Ok(parsed.to_string())
}

pub async fn list_feeds(pool: &SqlitePool) -> Result<Vec<FeedSummary>, AppError> {
    repository::list(pool).await.map_err(AppError::from)
}

pub async fn add_feed(pool: &SqlitePool, value: &str) -> Result<FeedSummary, AppError> {
    let url = normalize_url(value)?;
    if repository::find_by_url(pool, &url).await?.is_some() {
        return Err(AppError::duplicate());
    }
    repository::insert(pool, &url).await.map_err(AppError::from)
}

pub async fn update_feed(
    pool: &SqlitePool,
    feed_id: i64,
    title: Option<&str>,
) -> Result<FeedSummary, AppError> {
    if repository::find(pool, feed_id).await?.is_none() {
        return Err(AppError::not_found());
    }
    let title = title.map(str::trim).filter(|value| !value.is_empty());
    match title {
        Some(title) => repository::update_title(pool, feed_id, title)
            .await
            .map_err(AppError::from),
        None => repository::find(pool, feed_id)
            .await?
            .ok_or_else(AppError::not_found),
    }
}

pub async fn remove_feed(pool: &SqlitePool, feed_id: i64) -> Result<(), AppError> {
    if repository::remove(pool, feed_id).await? == 0 {
        return Err(AppError::not_found());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::normalize_url;

    #[test]
    fn normalizes_valid_https_url() {
        assert_eq!(
            normalize_url(" https://example.com/feed.xml ").unwrap(),
            "https://example.com/feed.xml"
        );
    }
}
