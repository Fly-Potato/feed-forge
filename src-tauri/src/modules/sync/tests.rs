use super::dto::SyncEvent;
use super::parser::parse_feed;

#[test]
fn serializes_channel_events_with_frontend_field_names() {
    let event = serde_json::to_value(SyncEvent::Started {
        job_id: 7,
        total: 2,
    })
    .unwrap();

    assert_eq!(
        event,
        serde_json::json!({
            "event": "started",
            "data": { "jobId": 7, "total": 2 }
        })
    );
}

#[test]
fn parses_rss_item_with_guid_and_publish_date() {
    let xml = r#"
        <rss version="2.0">
          <channel>
            <title>Example Feed</title>
            <link>https://example.com</link>
            <description>News</description>
            <item>
              <title>First item</title>
              <link>https://example.com/first</link>
              <guid>item-1</guid>
              <description>Summary</description>
              <pubDate>2026-09-07T12:00:00Z</pubDate>
            </item>
          </channel>
        </rss>
    "#;

    let feed = parse_feed(xml.as_bytes()).unwrap();

    assert_eq!(feed.title, "Example Feed");
    assert_eq!(feed.articles[0].guid, "item-1");
    assert_eq!(feed.articles[0].url.as_deref(), Some("https://example.com/first"));
}

#[test]
fn parses_atom_entry_and_generates_guid_when_missing() {
    let xml = r#"
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Atom Feed</title>
          <link href="https://example.com" />
          <entry>
            <title>Atom item</title>
            <link href="https://example.com/atom" />
            <summary>Atom summary</summary>
            <updated>2026-09-07T12:00:00Z</updated>
          </entry>
        </feed>
    "#;

    let feed = parse_feed(xml.as_bytes()).unwrap();

    assert_eq!(feed.title, "Atom Feed");
    assert_eq!(feed.articles.len(), 1);
    assert_eq!(feed.articles[0].guid, "https://example.com/atom");
}
