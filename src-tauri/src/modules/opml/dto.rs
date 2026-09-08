use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpmlImportInput {
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpmlImportResult {
    pub imported: u32,
    pub skipped: u32,
}

#[derive(Debug, Deserialize)]
pub struct EmptyInput {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub refresh_interval_minutes: u32,
    pub theme: String,
    pub open_links_in_browser: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsUpdateInput {
    pub refresh_interval_minutes: u32,
    pub theme: String,
    pub open_links_in_browser: bool,
}
