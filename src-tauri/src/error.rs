use serde::Serialize;

#[derive(Debug, Serialize, thiserror::Error)]
#[serde(rename_all = "camelCase")]
#[error("{message}")]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    pub retryable: bool,
}

impl AppError {
    pub fn new(code: &str, message: &str, retryable: bool) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
            retryable,
        }
    }

    pub fn invalid_url() -> Self {
        Self::new("invalid_url", "The feed URL must use http or https.", false)
    }

    pub fn duplicate() -> Self {
        Self::new("duplicate", "This feed is already subscribed.", false)
    }

    pub fn not_found() -> Self {
        Self::new("not_found", "The requested local record was not found.", false)
    }

    pub fn network() -> Self {
        Self::new("network", "The feed could not be downloaded.", true)
    }

    pub fn parse() -> Self {
        Self::new("parse", "The feed format could not be parsed.", false)
    }

    pub fn storage<E: std::fmt::Display>(_error: E) -> Self {
        Self {
            code: "storage".to_string(),
            message: "The local database operation failed.".to_string(),
            details: None,
            retryable: true,
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        Self::storage(error)
    }
}

impl From<sqlx::migrate::MigrateError> for AppError {
    fn from(error: sqlx::migrate::MigrateError) -> Self {
        Self::storage(error)
    }
}
