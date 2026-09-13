use crate::db;
use crate::modules::feeds::service;

#[tokio::test]
async fn add_feed_rejects_non_http_url() {
    let pool = db::test_pool().await;

    let result = service::add_feed(&pool, "file:///subscriptions.xml", None).await;

    assert_eq!(result.unwrap_err().code, "invalid_url");
}

#[tokio::test]
async fn add_feed_rejects_duplicates_and_lists_saved_feed() {
    let pool = db::test_pool().await;

    let first = service::add_feed(&pool, "https://example.com/feed.xml", None)
        .await
        .unwrap();
    let duplicate = service::add_feed(&pool, "https://example.com/feed.xml", None)
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

#[tokio::test]
async fn creates_renames_moves_and_removes_group_without_removing_feed() {
    let pool = db::test_pool().await;
    let group = service::create_group(&pool, " 技术 ").await.unwrap();
    let feed = service::add_feed(&pool, "https://example.com/feed.xml", Some(group.id))
        .await
        .unwrap();

    assert_eq!(group.title, "技术");
    assert_eq!(feed.group_id, Some(group.id));

    let renamed = service::update_group(&pool, group.id, " 工程 ")
        .await
        .unwrap();
    assert_eq!(renamed.title, "工程");
    assert_eq!(service::list_groups(&pool).await.unwrap()[0].title, "工程");

    let moved = service::move_feed(&pool, feed.id, None).await.unwrap();
    assert_eq!(moved.group_id, None);

    service::move_feed(&pool, feed.id, Some(group.id))
        .await
        .unwrap();
    service::remove_group(&pool, group.id).await.unwrap();
    let feeds = service::list_feeds(&pool).await.unwrap();
    assert_eq!(feeds.len(), 1);
    assert_eq!(feeds[0].group_id, None);
}

#[tokio::test]
async fn group_names_reject_blank_and_case_insensitive_duplicates() {
    let pool = db::test_pool().await;
    let blank = service::create_group(&pool, "   ").await.unwrap_err();
    assert_eq!(blank.code, "invalid_input");

    service::create_group(&pool, "Tech").await.unwrap();
    let duplicate = service::create_group(&pool, "tech").await.unwrap_err();
    assert_eq!(duplicate.code, "duplicate_group");
}

#[tokio::test]
async fn moving_to_missing_group_keeps_original_assignment() {
    let pool = db::test_pool().await;
    let group = service::create_group(&pool, "Tech").await.unwrap();
    let feed = service::add_feed(&pool, "https://example.com/feed.xml", Some(group.id))
        .await
        .unwrap();

    let failure = service::move_feed(&pool, feed.id, Some(999))
        .await
        .unwrap_err();
    assert_eq!(failure.code, "not_found");
    assert_eq!(
        service::list_feeds(&pool).await.unwrap()[0].group_id,
        Some(group.id)
    );
}
