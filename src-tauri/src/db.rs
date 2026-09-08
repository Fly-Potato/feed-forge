use std::path::Path;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use tauri::Manager;

use crate::error::AppError;

pub async fn init_db(app: &tauri::AppHandle) -> Result<sqlx::SqlitePool, AppError> {
    let data_dir = app.path().app_data_dir().map_err(AppError::storage)?;
    std::fs::create_dir_all(&data_dir).map_err(AppError::storage)?;
    connect(Path::new(&data_dir).join("feed-forge.db")).await
}

async fn connect(path: std::path::PathBuf) -> Result<sqlx::SqlitePool, AppError> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

#[cfg(test)]
pub(crate) async fn test_pool() -> sqlx::SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    pool
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn migration_creates_feed_article_and_settings_tables() {
        let pool = super::test_pool().await;

        for table in ["feeds", "articles", "settings"] {
            let exists: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
            )
            .bind(table)
            .fetch_one(&pool)
            .await
            .unwrap();

            assert_eq!(exists, 1, "expected table {table}");
        }
    }
}
