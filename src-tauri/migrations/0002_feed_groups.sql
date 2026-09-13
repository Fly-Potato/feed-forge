CREATE TABLE feed_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL
);

ALTER TABLE feeds
ADD COLUMN group_id INTEGER REFERENCES feed_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_feeds_group_id ON feeds(group_id);
