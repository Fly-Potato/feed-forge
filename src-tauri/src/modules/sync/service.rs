use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use sqlx::{FromRow, SqlitePool};
use tauri::ipc::Channel;

use crate::error::AppError;
use crate::state::SyncManager;

use super::dto::{SyncEvent, SyncStatus};
use super::parser::parse_feed_at;

#[derive(Debug, FromRow)]
struct FeedForSync {
    id: i64,
    url: String,
    etag: Option<String>,
    last_modified: Option<String>,
}

pub async fn run(
    pool: SqlitePool,
    manager: Arc<SyncManager>,
    feed_id: Option<i64>,
    job_id: u64,
    canceled: Arc<AtomicBool>,
    channel: Channel<SyncEvent>,
) {
    let started_at = Instant::now();
    let result = run_inner(&pool, &manager, feed_id, job_id, canceled.clone(), &channel).await;
    match result {
        Ok(processed) if canceled.load(Ordering::Relaxed) => {
            log::info!(
                target: "feed-forge::sync",
                "sync canceled job_id={} processed={} elapsed_ms={}",
                job_id,
                processed,
                started_at.elapsed().as_millis()
            );
            let _ = channel.send(SyncEvent::Canceled { job_id, processed });
            manager.update(SyncStatus {
                job_id,
                state: "canceled".to_string(),
                processed,
                total: processed,
                error: None,
            });
        }
        Ok(processed) => {
            log::info!(
                target: "feed-forge::sync",
                "sync completed job_id={} processed={} elapsed_ms={}",
                job_id,
                processed,
                started_at.elapsed().as_millis()
            );
            let _ = channel.send(SyncEvent::Completed { job_id, processed });
            manager.update(SyncStatus {
                job_id,
                state: "completed".to_string(),
                processed,
                total: processed,
                error: None,
            });
        }
        Err(error) => {
            log::error!(
                target: "feed-forge::sync",
                "sync failed job_id={} error_code={} elapsed_ms={}",
                job_id,
                error.code,
                started_at.elapsed().as_millis()
            );
            let message = error.message.clone();
            let _ = channel.send(SyncEvent::Failed {
                job_id,
                message: message.clone(),
            });
            manager.update(SyncStatus {
                job_id,
                state: "failed".to_string(),
                processed: 0,
                total: 0,
                error: Some(message),
            });
        }
    }
}

async fn run_inner(
    pool: &SqlitePool,
    manager: &SyncManager,
    feed_id: Option<i64>,
    job_id: u64,
    canceled: Arc<AtomicBool>,
    channel: &Channel<SyncEvent>,
) -> Result<u32, AppError> {
    let feeds = if let Some(feed_id) = feed_id {
        sqlx::query_as::<_, FeedForSync>(
            "SELECT id, url, etag, last_modified FROM feeds WHERE id = ?",
        )
        .bind(feed_id)
        .fetch_optional(pool)
        .await?
        .into_iter()
        .collect::<Vec<_>>()
    } else {
        sqlx::query_as::<_, FeedForSync>(
            "SELECT id, url, etag, last_modified FROM feeds ORDER BY id",
        )
        .fetch_all(pool)
        .await?
    };

    let total = feeds.len() as u32;
    log::debug!(
        target: "feed-forge::sync",
        "sync sources resolved job_id={} total={}",
        job_id,
        total
    );
    let _ = channel.send(SyncEvent::Started { job_id, total });
    manager.update(SyncStatus {
        job_id,
        state: "started".to_string(),
        processed: 0,
        total,
        error: None,
    });

    let mut processed = 0;
    for feed in feeds {
        if canceled.load(Ordering::Relaxed) {
            break;
        }
        sync_feed(pool, manager, &feed).await?;
        processed += 1;
        let _ = channel.send(SyncEvent::Progress {
            job_id,
            processed,
            total,
        });
        manager.update(SyncStatus {
            job_id,
            state: "progress".to_string(),
            processed,
            total,
            error: None,
        });
    }
    Ok(processed)
}

async fn sync_feed(
    pool: &SqlitePool,
    manager: &SyncManager,
    feed: &FeedForSync,
) -> Result<(), AppError> {
    let mut request = manager.client.get(&feed.url);
    if let Some(etag) = &feed.etag {
        request = request.header(IF_NONE_MATCH, etag);
    }
    if let Some(last_modified) = &feed.last_modified {
        request = request.header(IF_MODIFIED_SINCE, last_modified);
    }
    let response = request.send().await.map_err(|_| AppError::network())?;
    if response.status() == reqwest::StatusCode::NOT_MODIFIED {
        mark_synced(pool, feed.id).await?;
        return Ok(());
    }
    if !response.status().is_success() {
        return Err(AppError::network());
    }
    if response.content_length().unwrap_or(0) > 4 * 1024 * 1024 {
        return Err(AppError::network());
    }
    let etag = response
        .headers()
        .get(ETAG)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let last_modified = response
        .headers()
        .get(LAST_MODIFIED)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let body = response.bytes().await.map_err(|_| AppError::network())?;
    if body.len() > 4 * 1024 * 1024 {
        return Err(AppError::network());
    }
    let parsed = parse_feed_at(&body, &feed.url).map_err(|_| AppError::parse())?;

    let mut transaction = pool.begin().await?;
    sqlx::query(
        "UPDATE feeds SET title = ?, site_url = ?, description = ?, etag = ?, last_modified = ?, last_synced_at = ?, sync_error = NULL WHERE id = ?",
    )
    .bind(parsed.title)
    .bind(parsed.site_url)
    .bind(parsed.description)
    .bind(etag)
    .bind(last_modified)
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(feed.id)
    .execute(&mut *transaction)
    .await?;
    for article in parsed.articles {
        sqlx::query(
            "INSERT INTO articles (feed_id, guid, url, title, author, summary, content, published_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(feed_id, guid) DO UPDATE SET url = excluded.url, title = excluded.title, author = excluded.author, summary = excluded.summary, content = excluded.content, published_at = excluded.published_at",
        )
        .bind(feed.id)
        .bind(article.guid)
        .bind(article.url)
        .bind(article.title)
        .bind(article.author)
        .bind(article.summary)
        .bind(article.content)
        .bind(article.published_at)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(())
}

async fn mark_synced(pool: &SqlitePool, feed_id: i64) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE feeds SET last_synced_at = ?, sync_error = NULL WHERE id = ?",
    )
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(feed_id)
    .execute(pool)
    .await?;
    Ok(())
}
