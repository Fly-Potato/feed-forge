use sqlx::SqlitePool;

use super::dto::FeedSummary;

pub async fn list(pool: &SqlitePool) -> Result<Vec<FeedSummary>, sqlx::Error> {
    sqlx::query_as::<_, FeedSummary>(
        "SELECT id, title, url, site_url, description, last_synced_at, sync_error
         FROM feeds ORDER BY title COLLATE NOCASE, id",
    )
    .fetch_all(pool)
    .await
}

pub async fn find(pool: &SqlitePool, feed_id: i64) -> Result<Option<FeedSummary>, sqlx::Error> {
    sqlx::query_as::<_, FeedSummary>(
        "SELECT id, title, url, site_url, description, last_synced_at, sync_error
         FROM feeds WHERE id = ?",
    )
    .bind(feed_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_url(
    pool: &SqlitePool,
    url: &str,
) -> Result<Option<FeedSummary>, sqlx::Error> {
    sqlx::query_as::<_, FeedSummary>(
        "SELECT id, title, url, site_url, description, last_synced_at, sync_error
         FROM feeds WHERE url = ?",
    )
    .bind(url)
    .fetch_optional(pool)
    .await
}

pub async fn insert(pool: &SqlitePool, url: &str) -> Result<FeedSummary, sqlx::Error> {
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "INSERT INTO feeds (title, url, created_at) VALUES (?, ?, ?)",
    )
    .bind(url)
    .bind(url)
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
