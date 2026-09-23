use super::dto::SyncEvent;
use super::parser::{parse_feed_at, NormalizedFeed, ParseError};

fn parse_feed(bytes: &[u8]) -> Result<NormalizedFeed, ParseError> {
    parse_feed_at(bytes, "https://example.com/feed.xml")
}

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
fn parses_namespaced_rss_item_with_content_and_publish_date() {
    let xml = r#"
        <rss version="2.0"
             xmlns:atom="http://www.w3.org/2005/Atom"
             xmlns:content="http://purl.org/rss/1.0/modules/content/">
          <channel>
            <title>Example Feed</title>
            <link>https://example.com</link>
            <description>News</description>
            <atom:link rel="self" href="https://example.com/feed.xml" />
            <atom:link rel="prev-archive" href="https://example.com/archive.xml" />
            <item>
              <title>First item</title>
              <link>https://example.com/first</link>
              <guid>item-1</guid>
              <description>Summary</description>
              <pubDate>Sun, 06 Sep 2026 12:00:00 GMT</pubDate>
              <content:encoded><![CDATA[<p>Full article</p>]]></content:encoded>
            </item>
          </channel>
        </rss>
    "#;

    let feed = parse_feed(xml.as_bytes()).unwrap();

    assert_eq!(feed.title, "Example Feed");
    assert_eq!(feed.site_url.as_deref(), Some("https://example.com/"));
    assert_eq!(feed.description.as_deref(), Some("News"));
    assert_eq!(feed.articles.len(), 1);
    assert_eq!(feed.articles[0].guid, "item-1");
    assert_eq!(
        feed.articles[0].url.as_deref(),
        Some("https://example.com/first")
    );
    assert_eq!(feed.articles[0].summary.as_deref(), Some("Summary"));
    assert_eq!(
        feed.articles[0].content.as_deref(),
        Some("<p>Full article</p>")
    );
    assert_eq!(
        feed.articles[0].published_at.as_deref(),
        Some("2026-09-06T12:00:00+00:00")
    );
}

#[test]
fn parses_rss_0_92() {
    let xml = r#"
        <rss version="0.92">
          <channel>
            <title>Legacy Feed</title>
            <link>https://example.com</link>
            <description>Legacy news</description>
            <item>
              <title>Legacy item</title>
              <link>https://example.com/legacy</link>
              <description>Legacy summary</description>
            </item>
          </channel>
        </rss>
    "#;

    let feed = parse_feed(xml.as_bytes()).unwrap();

    assert_eq!(feed.title, "Legacy Feed");
    assert_eq!(feed.articles.len(), 1);
    assert_eq!(feed.articles[0].guid, "https://example.com/legacy");
}

#[test]
fn parses_rss_0_91() {
    let xml = r#"
        <rss version="0.91">
          <channel>
            <title>RSS 0.91 Feed</title>
            <link>https://example.com</link>
            <description>Legacy news</description>
            <item>
              <title>RSS 0.91 item</title>
              <link>https://example.com/rss-091</link>
            </item>
          </channel>
        </rss>
    "#;

    let feed = parse_feed(xml.as_bytes()).unwrap();

    assert_eq!(feed.title, "RSS 0.91 Feed");
    assert_eq!(feed.articles[0].guid, "https://example.com/rss-091");
}

#[test]
fn parses_rss_1_0_rdf_with_dublin_core_date() {
    let xml = r#"
        <rdf:RDF
          xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
          xmlns="http://purl.org/rss/1.0/"
          xmlns:dc="http://purl.org/dc/elements/1.1/">
          <channel rdf:about="https://example.com/feed">
            <title>RDF Feed</title>
            <link>https://example.com</link>
            <description>RDF news</description>
          </channel>
          <item rdf:about="https://example.com/rdf-item">
            <title>RDF item</title>
            <link>https://example.com/rdf-item</link>
            <description>RDF summary</description>
            <dc:date>2026-09-08T09:30:00Z</dc:date>
          </item>
        </rdf:RDF>
    "#;

    let feed = parse_feed(xml.as_bytes()).unwrap();

    assert_eq!(feed.title, "RDF Feed");
    assert_eq!(feed.articles.len(), 1);
    assert_eq!(feed.articles[0].guid, "https://example.com/rdf-item");
    assert_eq!(
        feed.articles[0].published_at.as_deref(),
        Some("2026-09-08T09:30:00+00:00")
    );
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
    assert_eq!(
        feed.articles[0].published_at.as_deref(),
        Some("2026-09-07T12:00:00+00:00")
    );
}

#[test]
fn atom_missing_id_ignores_non_alternate_links() {
    let xml = r#"
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Atom Feed</title>
          <link rel="self" href="https://example.com/feed.xml" />
          <entry>
            <title>Title fallback</title>
            <link rel="self" href="https://example.com/entries/1.atom" />
            <link rel="enclosure" href="https://example.com/audio.mp3" />
            <updated>2026-09-07T12:00:00Z</updated>
          </entry>
        </feed>
    "#;

    let feed = parse_feed(xml.as_bytes()).unwrap();

    assert_eq!(feed.site_url, None);
    assert_eq!(feed.articles[0].url, None);
    assert_eq!(feed.articles[0].guid, "Title fallback");
}

#[test]
fn parses_json_feed_1_1() {
    let json = r#"
        {
          "version": "https://jsonfeed.org/version/1.1",
          "title": "JSON Feed",
          "home_page_url": "https://example.com",
          "description": "JSON news",
          "items": [
            {
              "id": "json-item-1",
              "url": "https://example.com/json-item",
              "title": "JSON item",
              "summary": "JSON summary",
              "content_html": "<p>JSON content</p>",
              "date_published": "2026-09-09T10:15:00Z",
              "authors": [{ "name": "Example Author" }]
            }
          ]
        }
    "#;

    let feed = parse_feed(json.as_bytes()).unwrap();

    assert_eq!(feed.title, "JSON Feed");
    assert_eq!(feed.site_url.as_deref(), Some("https://example.com/"));
    assert_eq!(feed.description.as_deref(), Some("JSON news"));
    assert_eq!(feed.articles.len(), 1);
    assert_eq!(feed.articles[0].guid, "json-item-1");
    assert_eq!(feed.articles[0].author.as_deref(), Some("Example Author"));
    assert_eq!(
        feed.articles[0].content.as_deref(),
        Some("<p>JSON content</p>")
    );
    assert_eq!(
        feed.articles[0].published_at.as_deref(),
        Some("2026-09-09T10:15:00+00:00")
    );
}

#[test]
fn parses_json_feed_1_0() {
    let json = r#"
        {
          "version": "https://jsonfeed.org/version/1",
          "title": "JSON Feed 1.0",
          "items": [{ "id": "json-1.0-item", "content_text": "Plain text" }]
        }
    "#;

    let feed = parse_feed(json.as_bytes()).unwrap();

    assert_eq!(feed.title, "JSON Feed 1.0");
    assert_eq!(feed.articles[0].guid, "json-1.0-item");
    assert_eq!(feed.articles[0].content.as_deref(), Some("Plain text"));
}

#[test]
fn rejects_xml_without_a_supported_feed_root() {
    let xml = r#"<document><title>Not a feed</title></document>"#;

    assert!(parse_feed(xml.as_bytes()).is_err());
}

#[test]
fn resolves_relative_links_against_the_subscription_url() {
    let xml = r#"
        <rss version="2.0">
          <channel>
            <title>Relative Feed</title>
            <link>./</link>
            <description>Relative links</description>
            <item>
              <title>Relative item</title>
              <link>posts/first</link>
            </item>
          </channel>
        </rss>
    "#;

    let feed = parse_feed_at(xml.as_bytes(), "https://example.com/blog/feed.xml").unwrap();

    assert_eq!(feed.site_url.as_deref(), Some("https://example.com/blog/"));
    assert_eq!(
        feed.articles[0].url.as_deref(),
        Some("https://example.com/blog/posts/first")
    );
    assert_eq!(
        feed.articles[0].guid,
        "https://example.com/blog/posts/first"
    );
}
