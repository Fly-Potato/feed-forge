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
        Self::new("invalid_url", "订阅源地址必须使用 http 或 https 协议。", false)
    }

    pub fn duplicate() -> Self {
        Self::new("duplicate", "已订阅该订阅源。", false)
    }

    pub fn not_found() -> Self {
        Self::new("not_found", "未找到请求的本地记录。", false)
    }

    pub fn network() -> Self {
        Self::new("network", "无法下载订阅源。", true)
    }

    pub fn parse() -> Self {
        Self::new("parse", "无法解析订阅源格式。", false)
    }

    pub fn storage<E: std::fmt::Display>(_error: E) -> Self {
        Self {
            code: "storage".to_string(),
            message: "本地数据库操作失败。".to_string(),
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
