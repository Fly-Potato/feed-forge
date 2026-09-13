use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, Event};
use quick_xml::{Reader, Writer};
use sqlx::SqlitePool;
use url::Url;

use crate::error::AppError;

use super::dto::OpmlImportResult;

#[derive(Debug, PartialEq)]
pub struct ParsedOutlineFeed {
    pub title: String,
    pub url: String,
    pub group_title: Option<String>,
}

pub fn parse_outline_feeds(content: &str) -> Result<Vec<ParsedOutlineFeed>, AppError> {
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut feeds = Vec::new();
    let mut in_body = false;
    let mut outline_depth = 0_u32;
    let mut top_group: Option<String> = None;

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) if element.name().as_ref() == "body" => in_body = true,
            Ok(Event::End(element)) if element.name().as_ref() == "body" => in_body = false,
            Ok(Event::Start(element)) if in_body && element.name().as_ref() == "outline" => {
                let (title, url) = outline_attributes(&element);
                if let Some(url) = url {
                    push_feed(&mut feeds, title, url, top_group.clone())?;
                } else if outline_depth == 0 {
                    top_group = title.filter(|value| !value.trim().is_empty());
                }
                outline_depth += 1;
            }
            Ok(Event::Empty(element)) if in_body && element.name().as_ref() == "outline" => {
                let (title, url) = outline_attributes(&element);
                if let Some(url) = url {
                    push_feed(&mut feeds, title, url, top_group.clone())?;
                }
            }
            Ok(Event::End(element)) if in_body && element.name().as_ref() == "outline" => {
                outline_depth = outline_depth.saturating_sub(1);
                if outline_depth == 0 {
                    top_group = None;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => return Err(AppError::parse()),
            _ => {}
        }
        buffer.clear();
    }

    Ok(feeds)
}

fn outline_attributes(element: &BytesStart<'_>) -> (Option<String>, Option<String>) {
    let mut title = None;
    let mut url = None;
    for attribute in element.attributes().flatten() {
        match attribute.key.as_ref() {
            "text" | "title" => title = Some(attribute.value.to_string()),
            "xmlUrl" | "xmlurl" => url = Some(attribute.value.to_string()),
            _ => {}
        }
    }
    (title, url)
}

fn push_feed(
    feeds: &mut Vec<ParsedOutlineFeed>,
    title: Option<String>,
    url: String,
    group_title: Option<String>,
) -> Result<(), AppError> {
    let parsed = Url::parse(url.trim()).map_err(|_| AppError::parse())?;
    if matches!(parsed.scheme(), "http" | "https") && parsed.host().is_some() {
        let normalized = parsed.to_string();
        feeds.push(ParsedOutlineFeed {
            title: title
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| normalized.clone()),
            url: normalized,
            group_title,
        });
    }
    Ok(())
}

pub async fn import(pool: &SqlitePool, content: &str) -> Result<OpmlImportResult, AppError> {
    let feeds = parse_outline_feeds(content)?;
    let mut transaction = pool.begin().await?;
    let mut imported = 0;
    let mut skipped = 0;

    for feed in feeds {
        let exists = sqlx::query_scalar::<_, i64>("SELECT id FROM feeds WHERE url = ?")
            .bind(&feed.url)
            .fetch_optional(&mut *transaction)
            .await?;
        if exists.is_some() {
            skipped += 1;
            continue;
        }
        let group_id = if let Some(group_title) = feed.group_title {
            let group_title = group_title.trim();
            match sqlx::query_scalar::<_, i64>(
                "SELECT id FROM feed_groups WHERE title = ? COLLATE NOCASE",
            )
            .bind(group_title)
            .fetch_optional(&mut *transaction)
            .await?
            {
                Some(group_id) => Some(group_id),
                None => {
                    let result =
                        sqlx::query("INSERT INTO feed_groups (title, created_at) VALUES (?, ?)")
                            .bind(group_title)
                            .bind(chrono::Utc::now().to_rfc3339())
                            .execute(&mut *transaction)
                            .await?;
                    Some(result.last_insert_rowid())
                }
            }
        } else {
            None
        };
        sqlx::query("INSERT INTO feeds (title, url, group_id, created_at) VALUES (?, ?, ?, ?)")
            .bind(feed.title)
            .bind(feed.url)
            .bind(group_id)
            .bind(chrono::Utc::now().to_rfc3339())
            .execute(&mut *transaction)
            .await?;
        imported += 1;
    }

    transaction.commit().await?;
    Ok(OpmlImportResult { imported, skipped })
}

pub async fn export(pool: &SqlitePool) -> Result<String, AppError> {
    let feeds = sqlx::query_as::<_, (Option<String>, String, String)>(
        "SELECT groups.title, feeds.title, feeds.url
         FROM feeds
         LEFT JOIN feed_groups AS groups ON groups.id = feeds.group_id
         ORDER BY groups.title IS NULL, groups.title COLLATE NOCASE, feeds.title COLLATE NOCASE, feeds.id",
    )
    .fetch_all(pool)
    .await?;
    let mut writer = Writer::new(Vec::new());
    writer
        .write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))
        .map_err(|_| AppError::parse())?;
    let mut opml = BytesStart::new("opml");
    opml.push_attribute(("version", "2.0"));
    writer
        .write_event(Event::Start(opml))
        .map_err(|_| AppError::parse())?;
    writer
        .write_event(Event::Start(BytesStart::new("body")))
        .map_err(|_| AppError::parse())?;
    let mut open_group: Option<String> = None;
    for (group_title, title, url) in feeds {
        if group_title != open_group {
            if open_group.is_some() {
                writer
                    .write_event(Event::End(BytesEnd::new("outline")))
                    .map_err(|_| AppError::parse())?;
            }
            if let Some(group_title) = &group_title {
                let mut group = BytesStart::new("outline");
                group.push_attribute(("text", group_title.as_str()));
                writer
                    .write_event(Event::Start(group))
                    .map_err(|_| AppError::parse())?;
            }
            open_group = group_title;
        }
        let mut outline = BytesStart::new("outline");
        outline.push_attribute(("type", "rss"));
        outline.push_attribute(("text", title.as_str()));
        outline.push_attribute(("title", title.as_str()));
        outline.push_attribute(("xmlUrl", url.as_str()));
        writer
            .write_event(Event::Empty(outline))
            .map_err(|_| AppError::parse())?;
    }
    if open_group.is_some() {
        writer
            .write_event(Event::End(BytesEnd::new("outline")))
            .map_err(|_| AppError::parse())?;
    }
    writer
        .write_event(Event::End(BytesEnd::new("body")))
        .map_err(|_| AppError::parse())?;
    writer
        .write_event(Event::End(BytesEnd::new("opml")))
        .map_err(|_| AppError::parse())?;
    String::from_utf8(writer.into_inner()).map_err(|_| AppError::parse())
}
