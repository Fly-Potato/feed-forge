use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, Event};
use quick_xml::{Reader, Writer};
use sqlx::SqlitePool;
use url::Url;

use crate::error::AppError;

use super::dto::OpmlImportResult;

pub fn parse_outline_urls(content: &str) -> Result<Vec<(String, String)>, AppError> {
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut feeds = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) | Ok(Event::Empty(element))
                if element.name().as_ref() == "outline" =>
            {
                let mut title = None;
                let mut url = None;
                for attribute in element.attributes().flatten() {
                    match attribute.key.as_ref() {
                        "text" | "title" => title = Some(attribute.value.to_string()),
                        "xmlUrl" | "xmlurl" => url = Some(attribute.value.to_string()),
                        _ => {}
                    }
                }
                if let Some(url) = url {
                    let parsed = Url::parse(url.trim()).map_err(|_| AppError::parse())?;
                    if matches!(parsed.scheme(), "http" | "https") && parsed.host().is_some() {
                        let normalized = parsed.to_string();
                        feeds.push((
                            title.filter(|value| !value.trim().is_empty()).unwrap_or_else(|| normalized.clone()),
                            normalized,
                        ));
                    }
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

pub async fn import(pool: &SqlitePool, content: &str) -> Result<OpmlImportResult, AppError> {
    let feeds = parse_outline_urls(content)?;
    let mut transaction = pool.begin().await?;
    let mut imported = 0;
    let mut skipped = 0;

    for (title, url) in feeds {
        let exists = sqlx::query_scalar::<_, i64>("SELECT id FROM feeds WHERE url = ?")
            .bind(&url)
            .fetch_optional(&mut *transaction)
            .await?;
        if exists.is_some() {
            skipped += 1;
            continue;
        }
        sqlx::query("INSERT INTO feeds (title, url, created_at) VALUES (?, ?, ?)")
            .bind(title)
            .bind(url)
            .bind(chrono::Utc::now().to_rfc3339())
            .execute(&mut *transaction)
            .await?;
        imported += 1;
    }

    transaction.commit().await?;
    Ok(OpmlImportResult { imported, skipped })
}

pub async fn export(pool: &SqlitePool) -> Result<String, AppError> {
    let feeds = sqlx::query_as::<_, (String, String)>(
        "SELECT title, url FROM feeds ORDER BY title COLLATE NOCASE, id",
    )
    .fetch_all(pool)
    .await?;
    let mut writer = Writer::new(Vec::new());
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None))).map_err(|_| AppError::parse())?;
    let mut opml = BytesStart::new("opml");
    opml.push_attribute(("version", "2.0"));
    writer.write_event(Event::Start(opml)).map_err(|_| AppError::parse())?;
    writer.write_event(Event::Start(BytesStart::new("body"))).map_err(|_| AppError::parse())?;
    for (title, url) in feeds {
        let mut outline = BytesStart::new("outline");
        outline.push_attribute(("type", "rss"));
        outline.push_attribute(("text", title.as_str()));
        outline.push_attribute(("title", title.as_str()));
        outline.push_attribute(("xmlUrl", url.as_str()));
        writer.write_event(Event::Empty(outline)).map_err(|_| AppError::parse())?;
    }
    writer.write_event(Event::End(BytesEnd::new("body"))).map_err(|_| AppError::parse())?;
    writer.write_event(Event::End(BytesEnd::new("opml"))).map_err(|_| AppError::parse())?;
    String::from_utf8(writer.into_inner()).map_err(|_| AppError::parse())
}
