use serde::Deserialize;

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

#[derive(Debug, Deserialize)]
struct RssRoot {
    channel: RssChannel,
}

#[derive(Debug, Deserialize)]
struct RssChannel {
    title: Option<String>,
    link: Option<String>,
    description: Option<String>,
    #[serde(default)]
    item: Vec<RssItem>,
}

#[derive(Debug, Deserialize)]
struct RssItem {
    title: Option<String>,
    link: Option<String>,
    guid: Option<String>,
    author: Option<String>,
    description: Option<String>,
    #[serde(rename = "content:encoded")]
    content: Option<String>,
    pub_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AtomRoot {
    title: Option<String>,
    #[serde(default)]
    link: Vec<AtomLink>,
    #[serde(default)]
    entry: Vec<AtomEntry>,
}

#[derive(Debug, Deserialize)]
struct AtomLink {
    #[serde(rename = "@href")]
    href: Option<String>,
    #[serde(rename = "@rel")]
    rel: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AtomEntry {
    title: Option<String>,
    id: Option<String>,
    #[serde(default)]
    link: Vec<AtomLink>,
    summary: Option<String>,
    content: Option<String>,
    updated: Option<String>,
    published: Option<String>,
    author: Option<AtomAuthor>,
}

#[derive(Debug, Deserialize)]
struct AtomAuthor {
    name: Option<String>,
}

pub fn parse_feed(bytes: &[u8]) -> Result<NormalizedFeed, ParseError> {
    let xml = std::str::from_utf8(bytes).map_err(|_| ParseError::Unsupported)?;
    if let Ok(root) = quick_xml::de::from_str::<RssRoot>(xml) {
        return Ok(NormalizedFeed {
            title: root
                .channel
                .title
                .unwrap_or_else(|| "Untitled feed".to_string()),
            site_url: root.channel.link,
            description: root.channel.description,
            articles: root.channel.item.into_iter().map(normalize_rss).collect(),
        });
    }

    if let Ok(root) = quick_xml::de::from_str::<AtomRoot>(xml) {
        let site_url = root
            .link
            .iter()
            .find(|link| link.rel.as_deref().unwrap_or("alternate") == "alternate")
            .and_then(|link| link.href.clone());
        return Ok(NormalizedFeed {
            title: root
                .title
                .unwrap_or_else(|| "Untitled feed".to_string()),
            site_url,
            description: None,
            articles: root.entry.into_iter().map(normalize_atom).collect(),
        });
    }

    Err(ParseError::Unsupported)
}

fn normalize_rss(item: RssItem) -> NormalizedArticle {
    let url = item.link;
    let title = item.title.unwrap_or_else(|| "Untitled article".to_string());
    let guid = item
        .guid
        .or_else(|| url.clone())
        .unwrap_or_else(|| title.clone());
    NormalizedArticle {
        guid,
        url,
        title,
        author: item.author,
        summary: item.description,
        content: item.content,
        published_at: item.pub_date,
    }
}

fn normalize_atom(item: AtomEntry) -> NormalizedArticle {
    let url = item
        .link
        .iter()
        .find(|link| link.rel.as_deref().unwrap_or("alternate") == "alternate")
        .and_then(|link| link.href.clone());
    let title = item.title.unwrap_or_else(|| "Untitled article".to_string());
    let guid = item.id.or_else(|| url.clone()).unwrap_or_else(|| title.clone());
    NormalizedArticle {
        guid,
        url,
        title,
        author: item.author.and_then(|author| author.name),
        summary: item.summary,
        content: item.content,
        published_at: item.published.or(item.updated),
    }
}
