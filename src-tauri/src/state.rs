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
        let _ = rustls::crypto::ring::default_provider().install_default();
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

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use crate::modules::sync::parser::parse_feed_at;

    use super::SyncManager;

    #[test]
    fn rustls_backend_is_available_for_sync_client() {
        SyncManager::new();
        reqwest::Client::builder()
            .tls_backend_rustls()
            .build()
            .expect("the sync client requires the rustls HTTPS backend");
    }

    #[tokio::test]
    #[ignore = "requires public network access"]
    async fn downloads_and_parses_github_atom_feed() {
        let response = tokio::time::timeout(
            Duration::from_secs(20),
            SyncManager::new()
                .client
                .get("https://github.com/openai/codex/releases.atom")
                .send(),
        )
        .await
        .expect("the GitHub Atom request timed out")
        .expect("the GitHub Atom request failed")
        .error_for_status()
        .expect("GitHub returned an error status");
        let body = response.bytes().await.expect("the response body was invalid");
        let feed = parse_feed_at(&body, "https://github.com/openai/codex/releases.atom")
            .expect("GitHub did not return a supported feed");

        assert!(!feed.title.trim().is_empty());
        assert!(!feed.articles.is_empty());
    }

    #[tokio::test]
    #[ignore = "requires public network access"]
    async fn downloads_and_parses_tauri_rss_feed() {
        let url = "https://v2.tauri.app/blog/rss.xml";
        let response = tokio::time::timeout(
            Duration::from_secs(20),
            SyncManager::new().client.get(url).send(),
        )
        .await
        .expect("the Tauri RSS request timed out")
        .expect("the Tauri RSS request failed")
        .error_for_status()
        .expect("Tauri returned an error status");
        let body = response
            .bytes()
            .await
            .expect("the response body was invalid");
        let feed = parse_feed_at(&body, url).expect("Tauri did not return a supported feed");

        assert_eq!(feed.title, "Tauri | Blog");
        assert!(!feed.articles.is_empty());
        assert!(feed
            .articles
            .iter()
            .any(|article| article.content.is_some()));
        assert!(feed
            .articles
            .iter()
            .any(|article| article.published_at.is_some()));
    }
}
