use sqlx::SqlitePool;
use url::Url;

use crate::error::AppError;

use super::{
    dto::{FeedGroup, FeedSummary},
    repository,
};

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

pub async fn add_feed(
    pool: &SqlitePool,
    value: &str,
    group_id: Option<i64>,
) -> Result<FeedSummary, AppError> {
    let url = normalize_url(value)?;
    if repository::find_by_url(pool, &url).await?.is_some() {
        return Err(AppError::duplicate());
    }
    validate_group(pool, group_id).await?;
    repository::insert(pool, &url, group_id)
        .await
        .map_err(AppError::from)
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

pub async fn list_groups(pool: &SqlitePool) -> Result<Vec<FeedGroup>, AppError> {
    repository::list_groups(pool).await.map_err(AppError::from)
}

pub async fn create_group(pool: &SqlitePool, title: &str) -> Result<FeedGroup, AppError> {
    let title = normalize_group_title(title)?;
    if repository::find_group_by_title(pool, title)
        .await?
        .is_some()
    {
        return Err(duplicate_group());
    }
    repository::insert_group(pool, title)
        .await
        .map_err(AppError::from)
}

pub async fn update_group(
    pool: &SqlitePool,
    group_id: i64,
    title: &str,
) -> Result<FeedGroup, AppError> {
    if repository::find_group(pool, group_id).await?.is_none() {
        return Err(AppError::not_found());
    }
    let title = normalize_group_title(title)?;
    if repository::find_group_by_title(pool, title)
        .await?
        .is_some_and(|group| group.id != group_id)
    {
        return Err(duplicate_group());
    }
    repository::update_group_title(pool, group_id, title)
        .await
        .map_err(AppError::from)
}

pub async fn remove_group(pool: &SqlitePool, group_id: i64) -> Result<(), AppError> {
    if repository::remove_group(pool, group_id).await? == 0 {
        return Err(AppError::not_found());
    }
    Ok(())
}

pub async fn move_feed(
    pool: &SqlitePool,
    feed_id: i64,
    group_id: Option<i64>,
) -> Result<FeedSummary, AppError> {
    if repository::find(pool, feed_id).await?.is_none() {
        return Err(AppError::not_found());
    }
    validate_group(pool, group_id).await?;
    repository::update_group_id(pool, feed_id, group_id)
        .await
        .map_err(AppError::from)
}

fn normalize_group_title(title: &str) -> Result<&str, AppError> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::new("invalid_input", "分组名称不能为空。", false));
    }
    Ok(title)
}

fn duplicate_group() -> AppError {
    AppError::new("duplicate_group", "已存在同名分组。", false)
}

async fn validate_group(pool: &SqlitePool, group_id: Option<i64>) -> Result<(), AppError> {
    if let Some(group_id) = group_id {
        if repository::find_group(pool, group_id).await?.is_none() {
            return Err(AppError::not_found());
        }
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
