use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStartInput {
    pub feed_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncCancelInput {
    pub job_id: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusInput {
    pub job_id: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAccepted {
    pub job_id: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub job_id: u64,
    pub state: String,
    pub processed: u32,
    pub total: u32,
    pub error: Option<String>,
}

impl SyncStatus {
    pub fn started(job_id: u64) -> Self {
        Self {
            job_id,
            state: "started".to_string(),
            processed: 0,
            total: 0,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum SyncEvent {
    Started { job_id: u64, total: u32 },
    Progress { job_id: u64, processed: u32, total: u32 },
    Completed { job_id: u64, processed: u32 },
    Failed { job_id: u64, message: String },
    Canceled { job_id: u64, processed: u32 },
}
