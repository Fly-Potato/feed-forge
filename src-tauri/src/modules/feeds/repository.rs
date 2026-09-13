use sqlx::SqlitePool;

use super::dto::{FeedGroup, FeedSummary};

pub async fn list(pool: &SqlitePool) -> Result<Vec<FeedSummary>, sqlx::Error> {
    sqlx::query_as::<_, FeedSummary>(
        "SELECT id, title, url, site_url, description, last_synced_at, sync_error, group_id
         FROM feeds ORDER BY title COLLATE NOCASE, id",
    )
    .fetch_all(pool)
    .await
}

pub async fn find(pool: &SqlitePool, feed_id: i64) -> Result<Option<FeedSummary>, sqlx::Error> {
    sqlx::query_as::<_, FeedSummary>(
        "SELECT id, title, url, site_url, description, last_synced_at, sync_error, group_id
         FROM feeds WHERE id = ?",
    )
    .bind(feed_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_url(pool: &SqlitePool, url: &str) -> Result<Option<FeedSummary>, sqlx::Error> {
    sqlx::query_as::<_, FeedSummary>(
        "SELECT id, title, url, site_url, description, last_synced_at, sync_error, group_id
         FROM feeds WHERE url = ?",
    )
    .bind(url)
    .fetch_optional(pool)
    .await
}

pub async fn insert(
    pool: &SqlitePool,
    url: &str,
    group_id: Option<i64>,
) -> Result<FeedSummary, sqlx::Error> {
    let now = chrono::Utc::now().to_rfc3339();
    let result =
        sqlx::query("INSERT INTO feeds (title, url, group_id, created_at) VALUES (?, ?, ?, ?)")
            .bind(url)
            .bind(url)
            .bind(group_id)
            .bind(now)
            .execute(pool)
            .await?;
    find(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_title(
    pool: &SqlitePool,
    feed_id: i64,
    title: &str,
) -> Result<FeedSummary, sqlx::Error> {
    sqlx::query("UPDATE feeds SET title = ? WHERE id = ?")
        .bind(title)
        .bind(feed_id)
        .execute(pool)
        .await?;
    find(pool, feed_id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn remove(pool: &SqlitePool, feed_id: i64) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query("DELETE FROM feeds WHERE id = ?")
        .bind(feed_id)
        .execute(pool)
        .await?
        .rows_affected())
}

pub async fn list_groups(pool: &SqlitePool) -> Result<Vec<FeedGroup>, sqlx::Error> {
    sqlx::query_as::<_, FeedGroup>(
        "SELECT id, title FROM feed_groups ORDER BY title COLLATE NOCASE, id",
    )
    .fetch_all(pool)
    .await
}

pub async fn find_group(
    pool: &SqlitePool,
    group_id: i64,
) -> Result<Option<FeedGroup>, sqlx::Error> {
    sqlx::query_as::<_, FeedGroup>("SELECT id, title FROM feed_groups WHERE id = ?")
        .bind(group_id)
        .fetch_optional(pool)
        .await
}

pub async fn find_group_by_title(
    pool: &SqlitePool,
    title: &str,
) -> Result<Option<FeedGroup>, sqlx::Error> {
    sqlx::query_as::<_, FeedGroup>(
        "SELECT id, title FROM feed_groups WHERE title = ? COLLATE NOCASE",
    )
    .bind(title)
    .fetch_optional(pool)
    .await
}

pub async fn insert_group(pool: &SqlitePool, title: &str) -> Result<FeedGroup, sqlx::Error> {
    let result = sqlx::query("INSERT INTO feed_groups (title, created_at) VALUES (?, ?)")
        .bind(title)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(pool)
        .await?;
    find_group(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_group_title(
    pool: &SqlitePool,
    group_id: i64,
    title: &str,
) -> Result<FeedGroup, sqlx::Error> {
    sqlx::query("UPDATE feed_groups SET title = ? WHERE id = ?")
        .bind(title)
        .bind(group_id)
        .execute(pool)
        .await?;
    find_group(pool, group_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn remove_group(pool: &SqlitePool, group_id: i64) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query("DELETE FROM feed_groups WHERE id = ?")
        .bind(group_id)
        .execute(pool)
        .await?
        .rows_affected())
}

pub async fn update_group_id(
    pool: &SqlitePool,
    feed_id: i64,
    group_id: Option<i64>,
) -> Result<FeedSummary, sqlx::Error> {
    sqlx::query("UPDATE feeds SET group_id = ? WHERE id = ?")
        .bind(group_id)
        .bind(feed_id)
        .execute(pool)
        .await?;
    find(pool, feed_id).await?.ok_or(sqlx::Error::RowNotFound)
}
