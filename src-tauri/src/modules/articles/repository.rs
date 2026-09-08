use sqlx::{QueryBuilder, Sqlite, SqlitePool};

use super::dto::{ArticlePage, ArticleSummary};

fn add_filters<'a>(
    query: &mut QueryBuilder<'a, Sqlite>,
    feed_id: Option<i64>,
    filter: &str,
) {
    query.push(" WHERE 1 = 1");
    if let Some(feed_id) = feed_id {
        query.push(" AND feed_id = ").push_bind(feed_id);
    }
    match filter {
        "unread" => query.push(" AND is_read = 0"),
        "starred" => query.push(" AND is_starred = 1"),
        _ => query,
    };
}

pub async fn list(
    pool: &SqlitePool,
    feed_id: Option<i64>,
    filter: &str,
    limit: u32,
    offset: u32,
) -> Result<ArticlePage, sqlx::Error> {
    let mut count = QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM articles");
    add_filters(&mut count, feed_id, filter);
    let total: i64 = count.build_query_scalar().fetch_one(pool).await?;

    let mut items = QueryBuilder::<Sqlite>::new(
        "SELECT id, feed_id, guid, url, title, author, summary, content, published_at,
         is_read != 0 AS is_read, is_starred != 0 AS is_starred FROM articles",
    );
    add_filters(&mut items, feed_id, filter);
    items
        .push(" ORDER BY published_at DESC, id DESC LIMIT ")
        .push_bind(limit.min(200))
        .push(" OFFSET ")
        .push_bind(offset);
    let rows = items.build_query_as::<ArticleSummary>().fetch_all(pool).await?;
    Ok(ArticlePage {
        items: rows,
        total: total.max(0) as u32,
    })
}

pub async fn update_read(
    pool: &SqlitePool,
    article_id: i64,
    is_read: bool,
) -> Result<Option<ArticleSummary>, sqlx::Error> {
    sqlx::query("UPDATE articles SET is_read = ? WHERE id = ?")
        .bind(is_read)
        .bind(article_id)
        .execute(pool)
        .await?;
    find(pool, article_id).await
}

pub async fn update_star(
    pool: &SqlitePool,
    article_id: i64,
    is_starred: bool,
) -> Result<Option<ArticleSummary>, sqlx::Error> {
    sqlx::query("UPDATE articles SET is_starred = ? WHERE id = ?")
        .bind(is_starred)
        .bind(article_id)
        .execute(pool)
        .await?;
    find(pool, article_id).await
}

async fn find(pool: &SqlitePool, article_id: i64) -> Result<Option<ArticleSummary>, sqlx::Error> {
    sqlx::query_as::<_, ArticleSummary>(
        "SELECT id, feed_id, guid, url, title, author, summary, content, published_at,
         is_read != 0 AS is_read, is_starred != 0 AS is_starred FROM articles WHERE id = ?",
    )
    .bind(article_id)
    .fetch_optional(pool)
    .await
}
