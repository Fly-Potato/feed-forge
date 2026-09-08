use crate::db;
use crate::modules::articles::service;

async fn seed(pool: &sqlx::SqlitePool) -> (i64, i64) {
    let feed = sqlx::query(
        "INSERT INTO feeds (title, url, created_at) VALUES ('Feed', 'https://example.com', 'now')",
    )
    .execute(pool)
    .await
    .unwrap()
    .last_insert_rowid();
    let first = sqlx::query(
        "INSERT INTO articles (feed_id, guid, title, is_read, is_starred, created_at) VALUES (?, 'one', 'One', 0, 1, 'now')",
    )
    .bind(feed)
    .execute(pool)
    .await
    .unwrap()
    .last_insert_rowid();
    sqlx::query(
        "INSERT INTO articles (feed_id, guid, title, is_read, is_starred, created_at) VALUES (?, 'two', 'Two', 1, 0, 'now')",
    )
    .bind(feed)
    .execute(pool)
    .await
    .unwrap();
    (feed, first)
}

#[tokio::test]
async fn lists_unread_and_starred_articles() {
    let pool = db::test_pool().await;
    let (feed_id, _) = seed(&pool).await;

    let unread = service::list_articles(&pool, Some(feed_id), "unread", 20, 0)
        .await
        .unwrap();
    let starred = service::list_articles(&pool, Some(feed_id), "starred", 20, 0)
        .await
        .unwrap();

    assert_eq!(unread.total, 1);
    assert_eq!(unread.items[0].title, "One");
    assert_eq!(starred.items[0].title, "One");
}

#[tokio::test]
async fn toggles_read_state_and_rejects_unknown_article() {
    let pool = db::test_pool().await;
    let (_, article_id) = seed(&pool).await;

    let article = service::mark_read(&pool, article_id, true).await.unwrap();
    let missing = service::mark_read(&pool, 999, true).await.unwrap_err();

    assert!(article.is_read);
    assert_eq!(missing.code, "not_found");
}
