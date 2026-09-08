use sqlx::SqlitePool;

use crate::error::AppError;

use super::dto::{SettingsDto, SettingsUpdateInput};

const KEY: &str = "preferences";

pub fn validate_settings(refresh_interval_minutes: u32, theme: &str, _open_links_in_browser: bool) -> Result<(), AppError> {
    if !(1..=1440).contains(&refresh_interval_minutes) || !matches!(theme, "system" | "light" | "dark") {
        return Err(AppError::new("invalid_input", "The settings values are invalid.", false));
    }
    Ok(())
}

pub async fn get(pool: &SqlitePool) -> Result<SettingsDto, AppError> {
    let stored = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(KEY)
        .fetch_optional(pool)
        .await?;
    match stored {
        Some(value) => serde_json::from_str(&value).map_err(|_| AppError::storage("invalid settings")),
        None => Ok(defaults()),
    }
}

pub async fn update(pool: &SqlitePool, input: SettingsUpdateInput) -> Result<SettingsDto, AppError> {
    validate_settings(input.refresh_interval_minutes, &input.theme, input.open_links_in_browser)?;
    let settings = SettingsDto {
        refresh_interval_minutes: input.refresh_interval_minutes,
        theme: input.theme,
        open_links_in_browser: input.open_links_in_browser,
    };
    let value = serde_json::to_string(&settings).map_err(|_| AppError::storage("settings"))?;
    sqlx::query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(KEY)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(settings)
}

fn defaults() -> SettingsDto {
    SettingsDto { refresh_interval_minutes: 60, theme: "system".to_string(), open_links_in_browser: true }
}
