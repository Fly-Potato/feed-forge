# Feed Forge 本地 RSS 阅读器 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在无账号、无服务端的前提下，交付订阅管理、RSS/Atom 同步、文章阅读状态和 OPML 导入导出的本地 RSS 阅读器 MVP。

**Architecture:** React 只负责界面和本地异步数据缓存；Rust/Tauri 负责 HTTP、解析、SQLite 和同步任务。每个业务模块拥有自己的 IPC facade，Rust command 只做适配和边界校验，业务规则放入 service。

**Tech Stack:** Tauri v2、React 19、TypeScript、Vite、现有 shadcn/Base UI、React hooks、Rust、reqwest、quick-xml、SQLite/sqlx、Tokio、serde、thiserror。

**Spec:** `docs/superpowers/specs/2026-09-07-local-rss-reader-design.md`

## Global Constraints

- 不增加账号、登录、远程 API、远程数据库或多设备同步。
- 前端业务代码只能放在 `src/modules/<business>/`；公共组件放在 `src/components/`。
- RSS 请求和解析只能由 Rust 执行；前端不直接访问订阅 URL。
- 所有 command 使用稳定的 `<business>_<action>` 命名和单对象输入。
- 同步使用 `Channel<SyncEvent>`；同一进度不能同时发送到 Channel 和全局 event。
- 修改 IPC、Rust command 或测试前，先阅读 `docs/testing-strategy.md`。
- Rust 命令必须显式加入 `tauri::generate_handler![]`。

---

### Task 1: 建立 SQLite 和应用状态基础

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/db.rs`
- Create: `src-tauri/src/state.rs`
- Create: `src-tauri/src/error.rs`
- Create: `src-tauri/migrations/0001_initial.sql`
- Test: `src-tauri/src/db.rs` tests

**Interfaces:**
- Produces `AppState { db: SqlitePool }`。
- Produces `AppError { code, message, details, retryable }`，可被 serde 序列化。
- `init_db(app_handle) -> Result<SqlitePool, AppError>` 使用应用数据目录和 `sqlx::migrate!()`。

- [ ] **Step 1: Write the failing test**

在 `db.rs` 添加测试，验证迁移后 `feeds`、`articles`、`settings` 三张表存在，并且 `articles(feed_id, guid)` 唯一约束拒绝重复记录。

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml db`

Expected: FAIL because `init_db`、migration and schema are not present.

- [ ] **Step 3: Write minimal implementation**

添加 SQLite 依赖、迁移文件和 `init_db`；在 Tauri `setup` 中初始化数据库并通过 `.manage(AppState { db })` 注入。数据库只从应用数据目录创建，不能读取前端传入路径。

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml db`

Expected: PASS with the migration and uniqueness assertions.

- [ ] **Step 5: Verify build**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS with `AppState` registered by Tauri.

### Task 2: 实现订阅源管理

**Files:**
- Create: `src-tauri/src/modules/feeds/mod.rs`
- Create: `src-tauri/src/modules/feeds/dto.rs`
- Create: `src-tauri/src/modules/feeds/repository.rs`
- Create: `src-tauri/src/modules/feeds/service.rs`
- Create: `src-tauri/src/modules/feeds/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/modules/feeds/service_tests.rs`

**Interfaces:**
- `feeds_list(input: EmptyInput, state: State<AppState>) -> Result<Vec<FeedSummary>, AppError>`
- `feeds_add(input: AddFeedInput, state: State<AppState>) -> Result<FeedSummary, AppError>`
- `feeds_update(input: UpdateFeedInput, state: State<AppState>) -> Result<FeedSummary, AppError>`
- `feeds_remove(input: RemoveFeedInput, state: State<AppState>) -> Result<RemovedFeed, AppError>`

- [ ] **Step 1: Write the failing service tests**

覆盖以下行为：合法 `http/https` URL 可以添加；`file://`、空 URL 和非 URL 文本返回 `invalid_url`；重复 URL 返回 `duplicate`；删除不存在 ID 返回 `not_found`；列表空结果返回空数组。

- [ ] **Step 2: Run the focused tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml feeds`

Expected: FAIL because the feed service and DTOs do not exist.

- [ ] **Step 3: Implement repository and service**

使用参数化 SQL 查询和事务；URL 只接受 `http` 和 `https`；`FeedSummary` 使用 camelCase serde 输出；service 不依赖 Tauri runtime。

- [ ] **Step 4: Implement thin commands and registration**

在 `commands.rs` 中完成 state 注入和错误转换，并在 `lib.rs` 的 `generate_handler![]` 中显式注册四个 command。

- [ ] **Step 5: Run focused tests and check**

Run: `cargo test --manifest-path src-tauri/Cargo.toml feeds` and `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS; command registration compiles.

### Task 3: 实现 RSS/Atom 解析和同步任务

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/modules/sync/mod.rs`
- Create: `src-tauri/src/modules/sync/fetcher.rs`
- Create: `src-tauri/src/modules/sync/parser.rs`
- Create: `src-tauri/src/modules/sync/service.rs`
- Create: `src-tauri/src/modules/sync/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/modules/sync/*_tests.rs`

**Interfaces:**
- `sync_start(input: SyncStartInput, on_event: Channel<SyncEvent>, state: State<AppState>) -> Result<SyncAccepted, AppError>`
- `sync_cancel(input: SyncCancelInput, state: State<AppState>) -> Result<SyncCanceled, AppError>`
- `sync_status(input: SyncStatusInput, state: State<AppState>) -> Result<SyncStatus, AppError>`
- `parse_feed(bytes: &[u8]) -> Result<Vec<NormalizedArticle>, ParseError>`

- [ ] **Step 1: Write parser tests with RSS and Atom fixtures**

添加最小 RSS 2.0、Atom 和缺少 guid 的 fixture，断言标题、链接、发布时间、摘要和稳定去重键的规范化结果。

- [ ] **Step 2: Run parser tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml parser`

Expected: FAIL because parser and normalized article types do not exist.

- [ ] **Step 3: Implement fetcher and parser**

使用 `reqwest` 设置连接/读取超时、有限响应体和明确 User-Agent；保存并复用 ETag/Last-Modified；使用 `quick-xml` 将 RSS/Atom 转为内部模型；缺少 guid 时用规范化链接或标题生成去重键。

- [ ] **Step 4: Write sync state tests**

覆盖 `started -> progress -> completed`、网络失败后的 `failed`、取消后的 `canceled`、重复取消幂等和单个 job 只能产生一个终态。

- [ ] **Step 5: Implement commands and transaction**

`sync_start` 立即返回 `jobId`，后台任务通过同一个 Channel 发送进度；写入 feed 同步元数据和文章使用一个数据库事务；Rust 从数据库解析 feed URL，不接受前端替换路径或请求目标。

- [ ] **Step 6: Run sync tests and check**

Run: `cargo test --manifest-path src-tauri/Cargo.toml sync` and `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS with parser fixtures, conditional-request state, transaction and cancellation assertions.

### Task 4: 实现文章查询和阅读状态

**Files:**
- Create: `src-tauri/src/modules/articles/mod.rs`
- Create: `src-tauri/src/modules/articles/dto.rs`
- Create: `src-tauri/src/modules/articles/repository.rs`
- Create: `src-tauri/src/modules/articles/service.rs`
- Create: `src-tauri/src/modules/articles/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/modules/articles/service_tests.rs`

**Interfaces:**
- `articles_list(input: ArticleListInput, state: State<AppState>) -> Result<ArticlePage, AppError>`
- `articles_mark_read(input: MarkReadInput, state: State<AppState>) -> Result<ArticleSummary, AppError>`
- `articles_toggle_star(input: ToggleStarInput, state: State<AppState>) -> Result<ArticleSummary, AppError>`

- [ ] **Step 1: Write failing tests**

覆盖 feed 过滤、`all/unread/starred` 过滤、limit/offset 分页、空列表、已读切换、收藏切换和不存在文章 ID 的 `not_found`。

- [ ] **Step 2: Implement repository/service/commands**

查询只返回 Article DTO；排序固定为 `published_at DESC, id DESC`；更新状态使用单条参数化 SQL，并返回更新后的 DTO；显式注册 commands。

- [ ] **Step 3: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml articles`

Expected: PASS with pagination, filtering and state mutation assertions.

### Task 5: 建立前端模块和 IPC facade

**Files:**
- Modify: `package.json`
- Create: `src/modules/feeds/types.ts`
- Create: `src/modules/feeds/ipc.ts`
- Create: `src/modules/articles/types.ts`
- Create: `src/modules/articles/ipc.ts`
- Create: `src/modules/sync/types.ts`
- Create: `src/modules/sync/ipc.ts`
- Create: `src/lib/ipc/errors.ts`
- Modify: `src/main.tsx`
- Test: `src/modules/*/__tests__/*.test.ts`

**Interfaces:**
- `listFeeds`, `addFeed`, `updateFeed`, `removeFeed`
- `listArticles`, `markArticleRead`, `toggleArticleStar`
- `startSync`, `cancelSync`, `getSyncStatus`

- [x] **Step 1: Write facade tests**

使用 `@tauri-apps/api/mocks`，断言每个 facade 的 command 名、单对象参数、返回值和未知 rejection 的统一错误转换。

- [x] **Step 2: Implement typed facades and local hooks**

所有 facade 从对应 `ipc.ts` 导出；当前使用业务 hooks 管理本地查询状态，避免在依赖缓存尚未稳定前增加全局 provider。

- [x] **Step 3: Test IPC behavior**

验证 facade 的 command 名、单对象参数、返回值和错误归一化；测试结束清理 Tauri mock 和 DOM。

### Task 6: 实现首版阅读界面

**Files:**
- Create: `src/modules/feeds/pages/FeedsPage.tsx`
- Create: `src/modules/feeds/components/FeedList.tsx`
- Create: `src/modules/feeds/components/AddFeedForm.tsx`
- Create: `src/modules/articles/pages/ArticlesPage.tsx`
- Create: `src/modules/articles/components/ArticleList.tsx`
- Create: `src/modules/articles/components/ArticleReader.tsx`
- Create: `src/modules/sync/components/SyncProgress.tsx`
- Modify: `src/App.tsx`
- Test: `src/modules/feeds/pages/FeedsPage.test.tsx`
- Test: `src/modules/articles/pages/ArticlesPage.test.tsx`

- [ ] **Step 1: Write component tests**

覆盖加载、空态、错误提示、添加成功、重复提交禁用、文章过滤、已读/收藏成功和同步失败提示；使用角色、标签和可见文本断言。

- [ ] **Step 2: Implement pages using facades/hooks only**

页面不直接调用 `invoke`；Feed 列表选中 feed 后更新文章查询；文章列表提供全部/未读/收藏过滤；阅读器展示标题、来源、时间和正文/摘要。

- [ ] **Step 3: Implement sync progress state machine**

处理 `started`、`progress`、`completed`、`failed`、`canceled`，忽略重复终态，组件卸载时执行已定义的取消或保留策略，不让 UI 永久停在 loading。

- [ ] **Step 4: Run frontend verification**

Run: `pnpm test` and `pnpm build`

Expected: PASS with visible success, empty and failure states.

### Task 7: 实现 OPML 导入导出和本地设置

**Files:**
- Create: `src-tauri/src/modules/opml/mod.rs`
- Create: `src-tauri/src/modules/opml/service.rs`
- Create: `src-tauri/src/modules/opml/commands.rs`
- Create: `src/modules/opml/ipc.ts`
- Create: `src/modules/settings/ipc.ts`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/modules/opml/service_tests.rs`
- Test: `src/modules/opml/__tests__/ipc.test.ts`

- [ ] **Step 1: Write OPML fixture tests**

验证嵌套 outline 导入、重复 URL 计数、无效 XML 的 `parse` 错误、导出后再次导入的数量一致。

- [ ] **Step 2: Implement import/export commands**

`opml_import` 接受文本内容而不是文件路径；Rust 负责 XML 解析和 URL 校验；`opml_export` 按 title/url 输出稳定排序的 OPML 文本。

- [ ] **Step 3: Implement settings**

只保存刷新间隔、主题和阅读偏好；设置值使用明确 DTO 校验，不允许任意键覆盖数据库结构。

- [ ] **Step 4: Run all verification**

Run: `pnpm test:all`, `pnpm build`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `git diff --check`

Expected: all commands exit 0; report any untested desktop runtime or packaging path explicitly.

## Handoff

计划完成并保存后，建议使用 `superpowers:subagent-driven-development` 按任务逐项实现；每个 Task 结束都要完成自己的测试，再进入下一个 Task。不要在所有 Rust、前端和 IPC 代码完成后才第一次运行测试。
