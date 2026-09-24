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
async fn updating_feed_source_clears_http_cache_and_keeps_articles() {
    let pool = db::test_pool().await;
    let old_group = service::create_group(&pool, "旧分组").await.unwrap();
    let new_group = service::create_group(&pool, "新分组").await.unwrap();
    let feed = service::add_feed(
        &pool,
        "https://example.com/old.xml",
        Some(old_group.id),
    )
    .await
    .unwrap();
    sqlx::query(
        "UPDATE feeds SET etag = 'old-etag', last_modified = 'yesterday', last_synced_at = 'today', sync_error = 'old error' WHERE id = ?",
    )
    .bind(feed.id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO articles (feed_id, guid, title, created_at) VALUES (?, 'article-1', 'Existing article', 'now')",
    )
    .bind(feed.id)
    .execute(&pool)
    .await
    .unwrap();

    let updated = service::update_feed_source(
        &pool,
        feed.id,
        " https://example.com/new.xml ",
        Some(new_group.id),
    )
    .await
    .unwrap();

    assert_eq!(updated.url, "https://example.com/new.xml");
    assert_eq!(updated.group_id, Some(new_group.id));
    assert_eq!(updated.last_synced_at, None);
    assert_eq!(updated.sync_error, None);
    let cache: (Option<String>, Option<String>) =
        sqlx::query_as("SELECT etag, last_modified FROM feeds WHERE id = ?")
            .bind(feed.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(cache, (None, None));
    let article_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM articles WHERE feed_id = ?")
            .bind(feed.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(article_count, 1);
}

#[tokio::test]
async fn updating_feed_source_rejects_another_saved_url() {
    let pool = db::test_pool().await;
    let existing = service::add_feed(&pool, "https://example.com/existing.xml", None)
        .await
        .unwrap();
    let edited = service::add_feed(&pool, "https://example.com/edited.xml", None)
        .await
        .unwrap();

    let error = service::update_feed_source(&pool, edited.id, &existing.url, None)
        .await
        .unwrap_err();

    assert_eq!(error.code, "duplicate");
    assert_eq!(
        service::list_feeds(&pool)
            .await
            .unwrap()
            .into_iter()
            .find(|feed| feed.id == edited.id)
            .unwrap()
            .url,
        "https://example.com/edited.xml"
    );
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
