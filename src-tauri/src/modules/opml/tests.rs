use super::service::parse_outline_urls;
use crate::modules::settings::service::validate_settings;

#[test]
fn parses_nested_outline_urls_and_skips_non_http_urls() {
    let input = r#"<opml version="2.0"><body><outline text="Tech"><outline text="Rust" xmlUrl="https://example.com/rust.xml"/><outline text="Local" xmlUrl="file:///tmp/feed.xml"/></outline></body></opml>"#;
    assert_eq!(
        parse_outline_urls(input).unwrap(),
        vec![("Rust".to_string(), "https://example.com/rust.xml".to_string())]
    );
}

#[test]
fn rejects_invalid_settings() {
    assert!(validate_settings(0, "system", true).is_err());
    assert!(validate_settings(30, "sepia", true).is_err());
    assert!(validate_settings(30, "dark", false).is_ok());
}
