use super::service::{self, parse_outline_feeds};
use crate::db;
use crate::modules::feeds::service as feeds_service;
use crate::modules::settings::service::validate_settings;

#[test]
fn parses_root_and_deeply_nested_feeds_into_two_levels() {
    let input = r#"<opml version="2.0"><body>
      <outline text="Root" xmlUrl="https://example.com/root.xml"/>
      <outline text="Tech"><outline text="Backend">
        <outline text="Rust" xmlUrl="https://example.com/rust.xml"/>
        <outline text="Local" xmlUrl="file:///tmp/feed.xml"/>
      </outline></outline>
    </body></opml>"#;
    let feeds = parse_outline_feeds(input).unwrap();

    assert_eq!(feeds.len(), 2);
    assert_eq!(feeds[0].title, "Root");
    assert_eq!(feeds[0].group_title, None);
    assert_eq!(feeds[1].title, "Rust");
    assert_eq!(feeds[1].group_title.as_deref(), Some("Tech"));
}

#[tokio::test]
async fn imports_and_exports_grouped_and_ungrouped_feeds() {
    let pool = db::test_pool().await;
    let input = r#"<opml version="2.0"><body>
      <outline text="Root" xmlUrl="https://example.com/root.xml"/>
      <outline text="Tech"><outline text="Rust" xmlUrl="https://example.com/rust.xml"/></outline>
    </body></opml>"#;

    let result = service::import(&pool, input).await.unwrap();
    let exported = service::export(&pool).await.unwrap();
    let parsed = parse_outline_feeds(&exported).unwrap();

    assert_eq!(result.imported, 2);
    assert_eq!(result.skipped, 0);
    assert!(exported.contains("<outline text=\"Tech\">"));
    assert_eq!(
        parsed
            .iter()
            .find(|feed| feed.title == "Root")
            .unwrap()
            .group_title,
        None
    );
    assert_eq!(
        parsed
            .iter()
            .find(|feed| feed.title == "Rust")
            .unwrap()
            .group_title
            .as_deref(),
        Some("Tech")
    );
}

#[tokio::test]
async fn duplicate_opml_feed_keeps_its_existing_group() {
    let pool = db::test_pool().await;
    let original = feeds_service::create_group(&pool, "Original")
        .await
        .unwrap();
    feeds_service::add_feed(&pool, "https://example.com/feed.xml", Some(original.id))
        .await
        .unwrap();
    let input = r#"<opml version="2.0"><body><outline text="Imported"><outline text="Feed" xmlUrl="https://example.com/feed.xml"/></outline></body></opml>"#;

    let result = service::import(&pool, input).await.unwrap();
    let feeds = feeds_service::list_feeds(&pool).await.unwrap();

    assert_eq!(result.imported, 0);
    assert_eq!(result.skipped, 1);
    assert_eq!(feeds[0].group_id, Some(original.id));
}

#[tokio::test]
async fn imports_repeated_feeds_under_a_trimmed_group_once() {
    let pool = db::test_pool().await;
    let input = r#"<opml version="2.0"><body><outline text=" Tech ">
      <outline text="One" xmlUrl="https://example.com/one.xml"/>
      <outline text="Two" xmlUrl="https://example.com/two.xml"/>
    </outline></body></opml>"#;

    let result = service::import(&pool, input).await.unwrap();
    let groups = feeds_service::list_groups(&pool).await.unwrap();

    assert_eq!(result.imported, 2);
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].title, "Tech");
}

#[test]
fn rejects_invalid_settings() {
    assert!(validate_settings(0, "system", true).is_err());
    assert!(validate_settings(30, "sepia", true).is_err());
    assert!(validate_settings(30, "dark", false).is_ok());
}
