use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::modules::sync::dto::SyncStatus;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub sync: Arc<SyncManager>,
}

pub struct SyncManager {
    next_id: AtomicU64,
    jobs: Mutex<HashMap<u64, Job>>,
    pub client: reqwest::Client,
}

struct Job {
    canceled: Arc<AtomicBool>,
    status: SyncStatus,
}

impl SyncManager {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            jobs: Mutex::new(HashMap::new()),
            client: reqwest::Client::new(),
        }
    }

    pub fn create_job(&self) -> (u64, Arc<AtomicBool>) {
        let job_id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let canceled = Arc::new(AtomicBool::new(false));
        self.jobs.lock().unwrap().insert(
            job_id,
            Job {
                canceled: canceled.clone(),
                status: SyncStatus::started(job_id),
            },
        );
        (job_id, canceled)
    }

    pub fn cancel(&self, job_id: u64) -> bool {
        let jobs = self.jobs.lock().unwrap();
        if let Some(job) = jobs.get(&job_id) {
            job.canceled.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    pub fn update(&self, status: SyncStatus) {
        if let Some(job) = self.jobs.lock().unwrap().get_mut(&status.job_id) {
            job.status = status;
        }
    }

    pub fn status(&self, job_id: u64) -> Option<SyncStatus> {
        self.jobs.lock().unwrap().get(&job_id).map(|job| job.status.clone())
    }
}
