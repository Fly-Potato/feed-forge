use feed_rs::model::{Entry, Feed, Link, Text};

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("the feed format is not supported")]
    Unsupported,
}

#[derive(Debug)]
pub struct NormalizedFeed {
    pub title: String,
    pub site_url: Option<String>,
    pub description: Option<String>,
    pub articles: Vec<NormalizedArticle>,
}

#[derive(Debug, Clone)]
pub struct NormalizedArticle {
    pub guid: String,
    pub url: Option<String>,
    pub title: String,
    pub author: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub published_at: Option<String>,
}

pub fn parse_feed_at(bytes: &[u8], source_url: &str) -> Result<NormalizedFeed, ParseError> {
    let feed = feed_rs::parser::Builder::new()
        .base_uri(Some(source_url))
        .id_generator(stable_id)
        .sanitize_content(false)
        .build()
        .parse(bytes)
        .map_err(|_| ParseError::Unsupported)?;

    Ok(normalize_feed(feed))
}

fn stable_id(links: &[Link], title: &Option<Text>, _base_uri: Option<&str>) -> String {
    preferred_link(links)
        .map(ToOwned::to_owned)
        .or_else(|| title.as_ref().map(|value| value.content.clone()))
        .unwrap_or_else(|| "Untitled article".to_string())
}

fn normalize_feed(feed: Feed) -> NormalizedFeed {
    NormalizedFeed {
        title: text_content(feed.title).unwrap_or_else(|| "Untitled feed".to_string()),
        site_url: preferred_link(&feed.links).map(ToOwned::to_owned),
        description: text_content(feed.description),
        articles: feed.entries.into_iter().map(normalize_article).collect(),
    }
}

fn normalize_article(entry: Entry) -> NormalizedArticle {
    let url = preferred_link(&entry.links).map(ToOwned::to_owned);
    let title = text_content(entry.title).unwrap_or_else(|| "Untitled article".to_string());
    let guid = non_empty(entry.id)
        .or_else(|| url.clone())
        .unwrap_or_else(|| title.clone());

    NormalizedArticle {
        guid,
        url,
        title,
        author: entry
            .authors
            .into_iter()
            .map(|author| author.name)
            .find(|name| !name.trim().is_empty()),
        summary: text_content(entry.summary),
        content: entry.content.and_then(|content| content.body),
        published_at: entry
            .published
            .or(entry.updated)
            .map(|date| date.to_rfc3339()),
    }
}

fn preferred_link(links: &[Link]) -> Option<&str> {
    links
        .iter()
        .find(|link| {
            !link.href.trim().is_empty() && matches!(link.rel.as_deref(), None | Some("alternate"))
        })
        .map(|link| link.href.as_str())
}

fn text_content(value: Option<Text>) -> Option<String> {
    value.and_then(|text| non_empty(text.content))
}

fn non_empty(value: String) -> Option<String> {
    (!value.trim().is_empty()).then_some(value)
}
