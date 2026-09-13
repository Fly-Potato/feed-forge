# 同步任务终态与缓存一致性

作用域：
- `repo`

适用：
- 修改订阅同步的 Rust 执行顺序、Channel 消息处理或前端 feeds/articles 缓存失效时。

结论：
- Rust 按订阅源逐个处理并提交数据库事务；已经提交的订阅源不会因后续订阅源失败或任务取消而回滚。
- 前端仅在 Channel 消息结构有效、jobId 属于当前任务且首次进入 `completed`、`failed` 或 `canceled` 终态时，失效 feeds 和 articles 查询；无效消息与过期任务消息不得触发刷新。
- 三种终态的用户提示仍各自区别；有效终态可覆盖先前畸形进度的协议错误。

联动：
- 变更同步提交边界或终态时，同时核对 Rust `service.rs`、前端 `sync/schema.ts`、`sync/ipc.ts`、`sync/hooks/useSync.ts` 以及终态/旧任务测试。

证据：
- `src-tauri/src/modules/sync/service.rs` 的逐项循环和 `sync_feed` 的每源事务提交。
- `src/modules/sync/__tests__/useSync.test.tsx` 的完成、失败、取消、旧任务和畸形消息用例。
