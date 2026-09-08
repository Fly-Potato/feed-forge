use crate::db;
use crate::modules::feeds::service;

#[tokio::test]
async fn add_feed_rejects_non_http_url() {
    let pool = db::test_pool().await;

    let result = service::add_feed(&pool, "file:///subscriptions.xml").await;

    assert_eq!(result.unwrap_err().code, "invalid_url");
}

#[tokio::test]
async fn add_feed_rejects_duplicates_and_lists_saved_feed() {
    let pool = db::test_pool().await;

    let first = service::add_feed(&pool, "https://example.com/feed.xml")
        .await
        .unwrap();
    let duplicate = service::add_feed(&pool, "https://example.com/feed.xml")
        .await
        .unwrap_err();
    let feeds = service::list_feeds(&pool).await.unwrap();

    assert_eq!(first.url, "https://example.com/feed.xml");
    assert_eq!(duplicate.code, "duplicate");
    assert_eq!(feeds.len(), 1);
}

#[tokio::test]
async fn remove_feed_returns_not_found_for_unknown_id() {
    let pool = db::test_pool().await;

    let result = service::remove_feed(&pool, 999).await;

    assert_eq!(result.unwrap_err().code, "not_found");
}
