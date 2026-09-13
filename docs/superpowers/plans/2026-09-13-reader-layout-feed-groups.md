# 阅读器布局与订阅分组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除阅读器内容 Header，提供分栏局部刷新，并交付可持久化、可管理、OPML 兼容的两级“分组 → 订阅源”树。

**Architecture:** SQLite 使用独立 `feed_groups` 表和 `feeds.group_id` 可空外键表达严格两级结构；Rust feeds service 是分组与归属规则的权威边界，Tauri command 保持薄适配，React Query 管理 feeds/groups 缓存。阅读器继续使用单个 `useSync` 实例，把全部同步和当前订阅同步暴露给两个面板工具栏；树展示与分组管理留在 feeds 业务模块。

**Tech Stack:** Tauri v2、Rust、SQLx/SQLite、React 19、TypeScript、TanStack Query、Zod、shadcn Base UI、Vitest、React Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-13-reader-layout-feed-groups-design.md`

## Global Constraints

- 开始实现前完整阅读 `docs/testing-strategy.md`，并使用 `feed-forge-development`、`tauri-v2`、`shadcn`、`superpowers:test-driven-development`。
- 只支持“分组 → 订阅源”两级；不增加 `parent_id`、拖拽排序、任意深度目录或展开状态持久化。
- 删除分组必须保留订阅和文章，把订阅归属清为 `NULL`。
- 两个刷新入口都执行网络同步；订阅源栏同步全部，文章栏只同步当前订阅。
- 保留当前有效同步终态触发 feeds/articles 缓存失效的规则。
- 不新增跨窗口或后端全局单任务策略；只防止当前页面和自动定时器重复启动。
- 图标按钮使用项目现有 Lucide 图标、语义色、`aria-label` 和悬停提示，并尊重 reduced-motion。
- 当前未授权提交或推送；每个任务只做 diff 检查，不运行 `git add`、`git commit` 或 `git push`。

---

### Task 1: 数据库迁移与 Rust 分组领域能力

**Files:**
- Create: `src-tauri/migrations/0002_feed_groups.sql`
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/modules/feeds/dto.rs`
- Modify: `src-tauri/src/modules/feeds/repository.rs`
- Modify: `src-tauri/src/modules/feeds/service.rs`
- Modify: `src-tauri/src/modules/feeds/tests.rs`

**Interfaces:**
- Produces: `FeedGroup { id: i64, title: String }`
- Produces: `FeedSummary.group_id: Option<i64>` serialized as `groupId`
- Produces services: `list_groups`, `create_group`, `update_group`, `remove_group`, `move_feed`
- Changes: `add_feed(pool, url, group_id)` accepts `Option<i64>`
- Preserves: existing feeds list/update/remove behavior other than returning `groupId`

- [ ] **Step 1: Write migration tests that require the new table, column, and delete behavior**

Extend `src-tauri/src/db.rs` with the following assertions and a second test that deletes a group while preserving its feed:

```rust
for table in ["feeds", "feed_groups", "articles", "settings"] {
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .bind(table)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(exists, 1, "expected table {table}");
}

let has_group_id: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM pragma_table_info('feeds') WHERE name = 'group_id'",
)
.fetch_one(&pool)
.await
.unwrap();
assert_eq!(has_group_id, 1);
```

The delete test inserts one `feed_groups` row and one referencing `feeds` row, deletes the group, then asserts the feed count is one and `group_id` is null.

- [ ] **Step 2: Run the focused migration tests and verify they fail**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::tests -- --nocapture
```

Expected: failure because `feed_groups` and `feeds.group_id` do not exist.

- [ ] **Step 3: Add the forward-only migration**

Create `0002_feed_groups.sql`:

```sql
CREATE TABLE feed_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL
);

ALTER TABLE feeds
ADD COLUMN group_id INTEGER REFERENCES feed_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_feeds_group_id ON feeds(group_id);
```

Do not edit `0001_initial.sql`; existing databases migrate forward.

- [ ] **Step 4: Run migration tests and verify they pass**

Run the Step 2 command. Expected: both migration tests pass.

- [ ] **Step 5: Write failing feeds service tests**

Add this lifecycle case, then separate tests for blank group title, case-insensitive duplicate title, and nonexistent target group:

```rust
#[tokio::test]
async fn creates_moves_and_removes_group_without_removing_feed() {
    let pool = db::test_pool().await;
    let group = service::create_group(&pool, " 技术 ").await.unwrap();
    let feed = service::add_feed(&pool, "https://example.com/feed.xml", Some(group.id))
        .await
        .unwrap();
    assert_eq!(group.title, "技术");
    assert_eq!(feed.group_id, Some(group.id));

    let moved = service::move_feed(&pool, feed.id, None).await.unwrap();
    assert_eq!(moved.group_id, None);

    service::move_feed(&pool, feed.id, Some(group.id)).await.unwrap();
    service::remove_group(&pool, group.id).await.unwrap();
    assert_eq!(service::list_feeds(&pool).await.unwrap()[0].group_id, None);
}
```

Use `Tech` / `tech` for the duplicate case; assigning group ID 999 must return `not_found` and leave the original group unchanged.

- [ ] **Step 6: Run focused feeds tests and verify they fail to compile**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml modules::feeds -- --nocapture
```

Expected: compile failures for the new DTO fields and service functions.

- [ ] **Step 7: Implement DTOs, repository queries, and service validation**

Add:

```rust
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FeedGroup {
    pub id: i64,
    pub title: String,
}
```

Add `group_id: Option<i64>` to `FeedSummary` and every `FeedSummary` SELECT. Repository functions:

```rust
pub async fn list_groups(pool: &SqlitePool) -> Result<Vec<FeedGroup>, sqlx::Error>;
pub async fn find_group(pool: &SqlitePool, group_id: i64) -> Result<Option<FeedGroup>, sqlx::Error>;
pub async fn find_group_by_title(pool: &SqlitePool, title: &str) -> Result<Option<FeedGroup>, sqlx::Error>;
pub async fn insert_group(pool: &SqlitePool, title: &str) -> Result<FeedGroup, sqlx::Error>;
pub async fn update_group_title(pool: &SqlitePool, group_id: i64, title: &str) -> Result<FeedGroup, sqlx::Error>;
pub async fn remove_group(pool: &SqlitePool, group_id: i64) -> Result<u64, sqlx::Error>;
pub async fn update_group_id(pool: &SqlitePool, feed_id: i64, group_id: Option<i64>) -> Result<FeedSummary, sqlx::Error>;
```

Service functions:

```rust
pub async fn list_groups(pool: &SqlitePool) -> Result<Vec<FeedGroup>, AppError>;
pub async fn create_group(pool: &SqlitePool, title: &str) -> Result<FeedGroup, AppError>;
pub async fn update_group(pool: &SqlitePool, group_id: i64, title: &str) -> Result<FeedGroup, AppError>;
pub async fn remove_group(pool: &SqlitePool, group_id: i64) -> Result<(), AppError>;
pub async fn move_feed(pool: &SqlitePool, feed_id: i64, group_id: Option<i64>) -> Result<FeedSummary, AppError>;
pub async fn add_feed(pool: &SqlitePool, value: &str, group_id: Option<i64>) -> Result<FeedSummary, AppError>;
```

Use `invalid_input / 分组名称不能为空。` for blank names, `duplicate_group / 已存在同名分组。` for duplicates, and existing `not_found` for missing IDs. Validate group existence before feed insert/move.

- [ ] **Step 8: Update existing Rust callers and verify Task 1**

Change existing calls to `add_feed(..., None)` until Task 2 adds command input. Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml modules::feeds -- --nocapture
git diff --check
```

Expected: feeds tests pass. Inspect Task 1 paths only; do not stage or commit.

---

### Task 2: Rust IPC 命令注册与 OPML 分组兼容

**Files:**
- Modify: `src-tauri/src/modules/feeds/dto.rs`
- Modify: `src-tauri/src/modules/feeds/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/modules/opml/service.rs`
- Modify: `src-tauri/src/modules/opml/tests.rs`

**Interfaces:**
- Produces commands: `feeds_groups_list`, `feeds_group_create`, `feeds_group_update`, `feeds_group_remove`, `feeds_move`
- Changes input: `feeds_add({ url, groupId })`
- Produces: `ParsedOutlineFeed { title, url, group_title }`
- Preserves OPML result: `{ imported, skipped }`

- [ ] **Step 1: Add failing OPML tests**

Replace the flat parser assertion and add async import/export cases:

```rust
#[test]
fn parses_root_and_nested_feeds_into_two_levels() {
    let input = r#"<opml version="2.0"><body>
      <outline text="Root" xmlUrl="https://example.com/root.xml"/>
      <outline text="Tech"><outline text="Backend">
        <outline text="Rust" xmlUrl="https://example.com/rust.xml"/>
      </outline></outline>
    </body></opml>"#;
    let feeds = parse_outline_feeds(input).unwrap();
    assert_eq!(feeds[0].group_title, None);
    assert_eq!(feeds[1].group_title.as_deref(), Some("Tech"));
}
```

The async round-trip test imports one grouped and one root feed, exports, and asserts only the grouped feed is nested. The duplicate test imports an existing URL under another OPML group and asserts `skipped == 1` plus unchanged original `group_id`.

- [ ] **Step 2: Run OPML tests and verify failure**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml modules::opml -- --nocapture
```

Expected: failure because group-preserving parsing does not exist.

- [ ] **Step 3: Implement the two-level OPML mapping**

Define:

```rust
#[derive(Debug, PartialEq)]
pub struct ParsedOutlineFeed {
    pub title: String,
    pub url: String,
    pub group_title: Option<String>,
}

pub fn parse_outline_feeds(content: &str) -> Result<Vec<ParsedOutlineFeed>, AppError>;
```

Track started outline frames so the first non-feed outline beneath `<body>` is the group for all descendant feed outlines. Root feeds get `None`; deeper directories never create more levels. Import reuses or creates groups case-insensitively inside the transaction, skips duplicate URLs without moving them, and inserts new feeds with `group_id`. Export joins groups, emits grouped feeds inside one outline, then emits ungrouped feeds directly under body. Empty groups are omitted.

- [ ] **Step 4: Add command DTOs and thin adapters**

Add serde camelCase inputs/results:

```rust
pub struct AddFeedInput { pub url: String, pub group_id: Option<i64> }
pub struct FeedGroupNameInput { pub title: String }
pub struct UpdateFeedGroupInput { pub group_id: i64, pub title: String }
pub struct RemoveFeedGroupInput { pub group_id: i64 }
pub struct MoveFeedInput { pub feed_id: i64, pub group_id: Option<i64> }
pub struct RemovedFeedGroup { pub group_id: i64 }
```

Implement the five commands named in Interfaces and explicitly add them to `tauri::generate_handler![]`. Each command only unpacks input, calls Task 1 service, and returns a DTO.

- [ ] **Step 5: Run complete Rust verification**

```powershell
pnpm test:rust
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

Expected: all Rust tests pass and all new commands compile as registered. Inspect only Rust/OPML changes; do not stage or commit.

---

### Task 3: 前端分组契约、IPC facade 与 Query hooks

**Files:**
- Modify: `src/modules/feeds/schema.ts`
- Modify: `src/modules/feeds/types.ts`
- Modify: `src/modules/feeds/ipc.ts`
- Modify: `src/modules/feeds/keys.ts`
- Modify: `src/modules/feeds/hooks/useFeeds.ts`
- Modify: `src/modules/feeds/__tests__/ipc.test.ts`
- Modify: `src/modules/feeds/__tests__/useFeeds.test.tsx`

**Interfaces:**
- Produces type: `FeedGroup`
- Produces facade: `listFeedGroups`, `createFeedGroup`, `updateFeedGroup`, `removeFeedGroup`, `moveFeed`
- Changes facade: `addFeed(url, groupId)`
- Changes hook: exposes groups and group/move mutations while retaining feeds query `status`

- [ ] **Step 1: Write failing IPC contract tests**

Extend every feed fixture with `groupId: null`. Add:

```typescript
await addFeed(feed.url, 3);
expect(calls).toContainEqual(["feeds_add", { input: { url: feed.url, groupId: 3 } }]);

await createFeedGroup("技术");
await updateFeedGroup(3, "工程");
await moveFeed(42, null);
await removeFeedGroup(3);
expect(calls).toEqual([
  ["feeds_group_create", { input: { title: "技术" } }],
  ["feeds_group_update", { input: { groupId: 3, title: "工程" } }],
  ["feeds_move", { input: { feedId: 42, groupId: null } }],
  ["feeds_group_remove", { input: { groupId: 3 } }],
]);
```

Add malformed response tests for a feed missing `groupId` and a group missing `title`.

- [ ] **Step 2: Run focused IPC tests and verify failure**

```powershell
pnpm test -- src/modules/feeds/__tests__/ipc.test.ts
```

Expected: missing schemas/facades and fixture validation failures.

- [ ] **Step 3: Implement schemas, types, and facade functions**

Add:

```typescript
export const feedGroupSchema = z.object({ id: positiveId, title: z.string() });
export const feedGroupListSchema = z.array(feedGroupSchema);
export const removedFeedGroupSchema = z.object({ groupId: positiveId });
```

Add `groupId: positiveId.nullable()` to `feedSummarySchema` and export `FeedGroup`. Every facade invokes `unknown`, normalizes command rejection, and parses successful results.

- [ ] **Step 4: Write failing hook tests**

Render two `useFeeds` consumers and assert only one `feeds_groups_list` request. Move a feed, observe refetched authoritative `groupId`, and verify all group mutations invalidate `feedKeys.all`. Add a group-query failure case that exposes the safe error while feeds-list `status` still becomes `success`, preserving selection cleanup semantics.

- [ ] **Step 5: Extend query keys and `useFeeds`**

```typescript
export const feedKeys = {
  all: ["feeds"] as const,
  list: ["feeds", "list"] as const,
  groups: ["feeds", "groups"] as const,
};
```

Keep feeds and groups as separate shared queries. Return `feeds`, `groups`, combined `loading`/`error`, feeds-list `status`, and:

```typescript
create(url: string, groupId: number | null): Promise<FeedSummary>
rename(feedId: number, title: string): Promise<FeedSummary>
remove(feedId: number): Promise<void>
move(feedId: number, groupId: number | null): Promise<FeedSummary>
createGroup(title: string): Promise<FeedGroup>
renameGroup(groupId: number, title: string): Promise<FeedGroup>
removeGroup(groupId: number): Promise<void>
```

Invalidate `feedKeys.all` after group/assignment mutations; retain article-cache removal on feed deletion. A failed groups query must not be represented as a successful empty group list.

- [ ] **Step 6: Run feeds frontend tests and scope check**

```powershell
pnpm test -- src/modules/feeds/__tests__/ipc.test.ts src/modules/feeds/__tests__/useFeeds.test.tsx
git diff --check
```

Expected: both files pass. Inspect `src/modules/feeds`; do not stage or commit.

---

### Task 4: 二级树组件与订阅分组管理

**Files:**
- Create: `src/components/ui/collapsible.tsx`
- Create: `src/modules/feeds/tree.ts`
- Create: `src/modules/feeds/__tests__/FeedList.test.tsx`
- Create: `src/modules/feeds/components/FeedGroupManager.tsx`
- Create: `src/modules/feeds/__tests__/SubscriptionManager.test.tsx`
- Modify: `src/modules/feeds/components/FeedList.tsx`
- Modify: `src/modules/feeds/components/AddFeedForm.tsx`
- Modify: `src/modules/feeds/components/SubscriptionManager.tsx`
- Modify: `src/modules/settings/components/SettingsDialog.tsx`

**Interfaces:**
- Produces: `buildFeedTree(groups, feeds): FeedTreeGroup[]`
- Changes `FeedList`: accepts groups and renders an accessible two-level tree
- Changes `AddFeedForm.onAdd(url, groupId)` and adds group selection
- Changes subscription/settings props to carry group CRUD and feed-move callbacks

- [ ] **Step 1: Add official Base UI Collapsible source**

```powershell
pnpm exec shadcn add collapsible --dry-run
pnpm exec shadcn add collapsible
```

Review the added `src/components/ui/collapsible.tsx`; retain Base UI composition and project aliases. Do not overwrite unrelated UI files.

- [ ] **Step 2: Write failing tree builder and `FeedList` tests**

Use two real groups, one empty group, grouped feeds, and one ungrouped feed:

```typescript
expect(buildFeedTree(groups, feeds).map((node) => node.title)).toEqual([
  "工程",
  "技术",
  "未分组",
]);
expect(buildFeedTree(groups, feeds).at(-1)?.id).toBeNull();
```

Assert one root `tree`; group `treeitem` nodes with `aria-expanded="true"`; nested `group` lists; feed leaves with `aria-selected`; no third nested group. Clicking a group hides leaves without calling `onSelect`; clicking a leaf supplies its feed ID.

- [ ] **Step 3: Run the tree tests and verify failure**

```powershell
pnpm test -- src/modules/feeds/__tests__/FeedList.test.tsx
```

Expected: failure because builder and tree UI do not exist.

- [ ] **Step 4: Implement tree builder and accessible tree**

```typescript
export interface FeedTreeGroup {
  id: number | null;
  title: string;
  feeds: FeedSummary[];
  synthetic: boolean;
}

export function buildFeedTree(groups: FeedGroup[], feeds: FeedSummary[]): FeedTreeGroup[];
```

Sort groups and leaves by title. Include empty real groups; append synthetic “未分组” only when a null-group feed exists. Each group row uses a controlled Collapsible defaulting open. Use `role="tree"`, `role="treeitem"`, `aria-expanded`, `role="group"`, and `aria-selected`; use semantic tokens, `cn()`, flex gaps, and Button-managed icon sizes.

- [ ] **Step 5: Write failing subscription management tests**

Test creating a trimmed group, selecting a group while adding a feed, moving an existing feed to “未分组”, renaming a group, and confirming group deletion. Assert deletion copy includes “组内订阅源会保留并移动到未分组” and each async action balances `onBusyChange(true/false)`.

- [ ] **Step 6: Implement focused group management**

Create:

```typescript
interface FeedGroupManagerProps {
  groups: FeedGroup[];
  feeds: FeedSummary[];
  disabled: boolean;
  onCreate: (title: string) => Promise<unknown>;
  onRename: (groupId: number, title: string) => Promise<unknown>;
  onRemove: (groupId: number) => Promise<unknown>;
  onMoveFeed: (feedId: number, groupId: number | null) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
}
```

Use existing Field/Input/Select/AlertDialog/Button components. Keep feed rename/removal in `SubscriptionManager`; place group CRUD and assignment in `FeedGroupManager`. Extend AddFeedForm with “未分组” plus real groups and pass null for the ungrouped option. Wire all props through SettingsDialog.

- [ ] **Step 7: Run component tests and scope check**

```powershell
pnpm test -- src/modules/feeds/__tests__/FeedList.test.tsx src/modules/feeds/__tests__/SubscriptionManager.test.tsx
git diff --check
```

Expected: tests pass and shadcn did not rewrite unrelated files. Do not stage or commit.

---

### Task 5: 同步门禁、分栏工具栏与 Header 删除

**Files:**
- Modify: `src/modules/sync/hooks/useSync.ts`
- Modify: `src/modules/sync/__tests__/useSync.test.tsx`
- Modify: `src/modules/sync/components/SyncProgress.tsx`
- Modify: `src/modules/articles/components/ArticleList.tsx`
- Create: `src/modules/articles/__tests__/ArticleList.test.tsx`
- Modify: `src/modules/reader/pages/ReaderPage.tsx`
- Modify: `src/modules/reader/pages/ReaderPage.test.tsx`
- Modify: `src/modules/settings/components/SettingsDialog.tsx`

**Interfaces:**
- Changes `useSync`: returns `isRunning` and `targetFeedId`
- Changes `start(feedId?)`: ignores a second page-level call while active
- Changes `ArticleList`: owns the single expanded article toolbar and list states
- Changes `ReaderPage`: removes content Header and composes scoped refresh actions

- [ ] **Step 1: Write failing sync-hook gate tests**

Use a deferred `sync_start`, call `start()` twice before resolution, and assert one IPC call. Complete the first job with a valid terminal event, then permit `start(7)`:

```typescript
expect(result.current.isRunning).toBe(true);
expect(result.current.targetFeedId).toBeUndefined();
await waitFor(() => expect(result.current.isRunning).toBe(false));
await act(async () => { await result.current.start(7); });
expect(syncStartCalls).toHaveLength(2);
```

Retain stale-job, malformed-event, failed and canceled assertions.

- [ ] **Step 2: Run sync tests and verify failure**

```powershell
pnpm test -- src/modules/sync/__tests__/useSync.test.tsx
```

Expected: missing render state and duplicate-call guard failures.

- [ ] **Step 3: Implement pending/running state without changing terminal cache rules**

```typescript
const runningRef = useRef(false);
const [isRunning, setIsRunning] = useState(false);
const [targetFeedId, setTargetFeedId] = useState<number | undefined>();
```

Return immediately when `runningRef.current` is true. Otherwise set both running values before awaiting IPC. Clear them only on command rejection or the first valid completed/failed/canceled event for the current generation. Invalid/stale messages neither clear the gate nor invalidate caches. The automatic timer inherits the same guard.

- [ ] **Step 4: Write failing ArticleList and ReaderPage tests**

ArticleList tests cover toolbar presence during no selection, loading, error, empty, and populated states; filters; icon-only current-feed refresh; disabled refresh without selection.

ReaderPage tests include:

```typescript
expect(screen.queryByRole("heading", { name: "Feed Forge" })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "同步全部订阅源" })).toBeEnabled();
expect(screen.getByRole("button", { name: "同步当前订阅源" })).toBeDisabled();
expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
```

After selecting feed 7, the current-feed action must send `{ input: { feedId: 7 } }`; the all-feeds action must send `{ input: { feedId: undefined } }` even while a feed is selected. During an active task both refresh buttons are disabled and only the active action is busy. Collapsing the feed sidebar must leave sync, expand, and settings reachable.

- [ ] **Step 5: Run UI tests and verify failure**

```powershell
pnpm test -- src/modules/articles/__tests__/ArticleList.test.tsx src/modules/reader/pages/ReaderPage.test.tsx
```

Expected: failures against the current Header and toolbar structure.

- [ ] **Step 6: Consolidate the article toolbar**

Extend ArticleList props with `feedSelected`, `loading`, `error`, `onRefresh`, `refreshing`, and `onCollapse`. Render one toolbar containing title, existing filters, RefreshCw action, and collapse action; render all body states beneath it. Remove the duplicate expanded outer article toolbar from ReaderPage; keep a compact collapsed rail with refresh and expand icons.

- [ ] **Step 7: Recompose ReaderPage and Settings trigger**

Remove the `<header>` block. Make the feeds aside a flex column with fixed top toolbar, scrollable tree, scoped SyncProgress, and bottom SettingsDialog. Pass all Task 3 groups/actions to tree/settings.

Use this action contract:

```tsx
<Button
  variant="ghost"
  size="icon-sm"
  aria-label="同步全部订阅源"
  title="同步全部订阅源"
  aria-busy={sync.isRunning && sync.targetFeedId === undefined}
  disabled={sync.isRunning}
  onClick={() => void sync.start()}
>
  <RefreshCw aria-hidden="true" data-icon="inline-start" />
</Button>
```

Apply rotation only to the active target with `motion-reduce:animate-none`. Current-feed refresh calls `sync.start(selectedFeedId)` and is disabled without selection or during any sync. Change SettingsDialog trigger to `variant="ghost" size="icon-sm"`.

- [ ] **Step 8: Preserve visible and accessible sync feedback**

Allow SyncProgress to accept compact placement without changing messages. Render it under the initiating toolbar, with an `aria-live="polite"` status available while collapsed. Errors remain `role="alert"`; completed, failed and canceled remain distinct.

- [ ] **Step 9: Run focused frontend tests and scope check**

```powershell
pnpm test -- src/modules/sync/__tests__/useSync.test.tsx src/modules/articles/__tests__/ArticleList.test.tsx src/modules/feeds/__tests__/FeedList.test.tsx src/modules/feeds/__tests__/SubscriptionManager.test.tsx src/modules/reader/pages/ReaderPage.test.tsx
git diff --check
```

Expected: all focused tests pass. Confirm `AppTitleBar` remains unchanged; do not stage or commit.

---

### Task 6: 全量验证与人工验收

**Files:**
- Verify only; update `docs/testing-strategy.md` only if a genuinely new roadmap trigger is discovered.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified evidence and a scoped working tree; no commit or push.

- [ ] **Step 1: Run the complete automated suite**

```powershell
pnpm test:all
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

Expected: every command exits 0. On failure, use `superpowers:systematic-debugging`, fix only the root cause, then rerun the failing command and the full sequence.

- [ ] **Step 2: Audit database and IPC evidence**

Confirm tests prove migration preservation, delete-to-null behavior, command registration, matching camelCase payloads, and `invalid_response` handling for malformed successful results.

- [ ] **Step 3: Perform desktop/manual layout checks**

Run the development application and inspect the default window plus widths around 900px and 700px. Verify no content Header or unintended page scrollbar; settings remains reachable expanded/collapsed; both refresh scopes are correct; active feedback is visible; tree focus/collapse works; light/dark semantic colors work; reduced-motion disables rotation.

- [ ] **Step 4: Review final scope and preserve user changes**

```powershell
git status --short
git diff --stat
git diff --name-status
```

Compare every changed path with this plan. Preserve unrelated changes and report environmental/manual limitations. Do not stage, commit, push, or create a PR unless the user separately requests it.
