use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct EmptyInput {}

#[derive(Debug, Deserialize)]#[serde(rename_all = "camelCase")]
pub struct AddFeedInput {
    pub url: String,
}

#[derive(Debug, Deserialize)]#[serde(rename_all = "camelCase")]
pub struct UpdateFeedInput {
    pub feed_id: i64,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]#[serde(rename_all = "camelCase")]
pub struct RemoveFeedInput {
    pub feed_id: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FeedSummary {
    pub id: i64,
    pub title: String,
    pub url: String,
    pub site_url: Option<String>,
    pub description: Option<String>,
    pub last_synced_at: Option<String>,
    pub sync_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovedFeed {
    pub feed_id: i64,
}
