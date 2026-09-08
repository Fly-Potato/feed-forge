# Feed Forge 本地 RSS 阅读器设计

## 目标

将 Feed Forge 建设为 Windows 优先的本地 RSS/Atom 阅读器。所有订阅、文章、已读状态和收藏状态保存在本机；Rust 负责抓取、解析、同步和 SQLite 持久化，React 负责阅读界面和本地交互。

## 非目标

- 账号、登录、OAuth、JWT 或远程用户系统
- 云端 API、远程数据库和多设备同步
- 前端直接请求 RSS URL
- 首版全文搜索、推荐算法、插件系统和多窗口阅读

## MVP 范围

1. 添加、列出、修改和删除订阅源。
2. 手动刷新单个订阅或全部订阅。
3. 解析 RSS 2.0 和 Atom，保存规范化文章。
4. 查看文章列表，切换已读和收藏状态。
5. 使用 ETag/Last-Modified 减少重复下载。
6. OPML 订阅导入和导出。
7. 本地设置：刷新间隔、主题和阅读偏好。

## 架构

### 前端

沿用 React 19、TypeScript、Vite、现有 shadcn/Base UI 和 Tailwind。业务代码按 `src/modules/<business>/` 组织；Tauri 调用集中在业务 `ipc.ts`。当前使用业务 hooks 管理本地异步数据和 mutation；纯 UI 状态使用 React state，后续在缓存需求明确时再引入查询库。

### Rust

沿用 Tauri v2。Rust 使用 `reqwest` 发起 HTTP 请求，使用 `quick-xml` 将 RSS/Atom 外部格式转换为内部 DTO，使用 SQLite 持久化。数据库位于 Tauri 应用数据目录，不接受前端传入数据库路径。

### 同步

短操作使用 command。同步是长任务：`sync_start` 立即返回 `jobId`，通过本次调用关联的 `Channel<SyncEvent>` 推送进度；`sync_cancel` 负责协作取消。相同进度不同时广播为全局 event。

## 数据模型

```text
feeds
- id INTEGER PRIMARY KEY
- title TEXT NOT NULL
- url TEXT NOT NULL UNIQUE
- site_url TEXT
- description TEXT
- etag TEXT
- last_modified TEXT
- last_synced_at TEXT
- sync_error TEXT
- created_at TEXT NOT NULL

articles
- id INTEGER PRIMARY KEY
- feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE
- guid TEXT NOT NULL
- url TEXT
- title TEXT NOT NULL
- author TEXT
- summary TEXT
- content TEXT
- published_at TEXT
- is_read INTEGER NOT NULL DEFAULT 0
- is_starred INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- UNIQUE(feed_id, guid)

settings
- key TEXT PRIMARY KEY
- value TEXT NOT NULL
```

没有稳定 guid 时，service 使用规范化链接和发布时间生成稳定去重键。同步写入文章和 feed 状态必须在事务中完成。

## IPC 契约

### Feed commands

```text
feeds_list({}) -> FeedSummary[]
feeds_add({ url }) -> FeedSummary
feeds_update({ feedId, title? }) -> FeedSummary
feeds_remove({ feedId }) -> { feedId }
```

### Article commands

```text
articles_list({ feedId?, filter, limit, offset }) -> ArticlePage
articles_mark_read({ articleId, isRead }) -> ArticleSummary
articles_toggle_star({ articleId, isStarred }) -> ArticleSummary
```

### Sync commands

```text
sync_start({ feedId? }, onEvent: Channel<SyncEvent>) -> { jobId }
sync_cancel({ jobId }) -> { jobId }
sync_status({ jobId }) -> SyncStatus
```

`SyncEvent` 必须包含 `started`、`progress`、`completed`、`failed`、`canceled` 五类语义；每个 job 只能产生一个终态。取消和重复启动的行为必须在 service 测试中固定下来。

### OPML commands

```text
opml_import({ content }) -> { importedCount, skippedCount }
opml_export({}) -> { content }
```

### 错误

公共错误至少包含 `code` 和安全 `message`。首批错误码为：`invalid_input`、`invalid_url`、`not_found`、`duplicate`、`network`、`parse`、`storage`、`busy`、`canceled`、`internal`。

Rust 不返回本地路径、堆栈、数据库语句、令牌或底层异常原文。URL 只允许 `http` 和 `https`，并限制超时、响应体大小和重定向行为。

## 验证标准

- 添加 RSS URL 后，订阅出现在列表中。
- 手动同步能保存新文章，重复同步不会产生重复文章。
- ETag/Last-Modified 请求条件被保存并复用。
- 同步失败只影响对应订阅，并展示稳定错误状态。
- 已读和收藏状态重启应用后仍保留。
- OPML 导入可跳过重复 URL，导出结果可以再次导入。
- 前端 IPC mock、Rust service 测试和跨端构建均通过。
