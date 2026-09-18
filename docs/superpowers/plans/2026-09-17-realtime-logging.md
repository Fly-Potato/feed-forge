# Feed Forge 实时日志系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 Tauri 官方日志插件将应用日志写入轮转文件，并在设置界面实时展示当前运行期日志。

**Architecture:** `tauri-plugin-log` 是唯一日志后端，通过 `LogDir` 与 `Webview` target 同时输出。React 在应用启动时订阅官方 `attachLogger`，将最多 1000 条记录保存到独立 Zustand Store，日志页签只消费该 Store。

**Tech Stack:** Tauri v2、`tauri-plugin-log` 2.x、Rust `log` 0.4、React 19、TypeScript 6、Zustand 5、Vitest 5、React Testing Library

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-logging-design.md`

## Global Constraints

- 必须使用 Tauri 官方 log 插件，不自研文件 writer、文件 tail 或日志事件协议。
- 活跃日志文件最大 5 MiB，最多保留 5 个轮转文件；开发为 Debug，生产为 Info。
- UI 只保证展示前端监听建立后的当前运行期日志，内存上限固定为 1000 条。
- 不记录完整 URL、查询参数、Cookie、令牌、OPML/文章内容、签名地址或响应体。
- 不新增日志设置持久化、历史文件读取、导出、上传或远程采集。
- 本次不提交、不推送。

---

### Task 1: 官方插件与 Tauri 日志管线

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Rust 使用 `log::{debug, info, warn, error}` 宏写入全局 logger。
- 前端通过 `@tauri-apps/plugin-log` 的 `attachLogger` 与级别函数接入同一管线。

- [x] **Step 1: 安装成对的官方依赖**

  Run: `pnpm add @tauri-apps/plugin-log`
  Run: `cargo add tauri-plugin-log log --manifest-path src-tauri/Cargo.toml`
  Expected: JavaScript/Rust manifest 与 lockfile 写入兼容的 2.x 插件及 `log` 0.4。

- [x] **Step 2: 注册插件 target 与最小权限**

  在 `lib.rs` 构造 `LogDir`、`Webview` 和仅 debug 的 `Stdout` targets；配置 `RotationStrategy::KeepSome(5)`、`5 * 1024 * 1024` bytes、`UseLocal`、开发 `Debug`/生产 `Info`。在 `default.json` 增加 `log:default`、`core:event:allow-listen` 和 `core:event:allow-unlisten`。

- [x] **Step 3: 验证 Rust 配置可编译**

  Run: `cargo check --manifest-path src-tauri/Cargo.toml`
  Expected: PASS，插件 API、target 和 capability schema 均有效。

### Task 2: 当前运行期日志 Store 与订阅

**Files:**
- Create: `src/modules/logs/types.ts`
- Create: `src/modules/logs/store.ts`
- Create: `src/modules/logs/logger.ts`
- Create: `src/modules/logs/hooks/useLogStream.ts`
- Create: `src/modules/logs/__tests__/store.test.ts`
- Create: `src/modules/logs/__tests__/useLogStream.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `LogLevel = "trace" | "debug" | "info" | "warn" | "error"`。
- `LogEntry = { id: number; level: LogLevel; message: string }`。
- `useLogStore` 暴露 `entries`、`append(record)`、`clear()`。
- `useLogStream()` 在挂载时订阅，在卸载或晚到的订阅 Promise 完成后调用 `UnlistenFn`。
- `appLogger` 暴露 `debug/info/warn/error(scope, message)`，并生成 `[scope] message`。

- [x] **Step 1: 编写 Store 失败测试**

  测试连续追加 1002 条后只保留 ID 3 至 1002，顺序不变；调用 `clear()` 后条目为空但后续 ID 继续单调递增。

- [x] **Step 2: 运行 Store 测试确认失败**

  Run: `pnpm test src/modules/logs/__tests__/store.test.ts`
  Expected: FAIL，原因是 `store.ts` 尚不存在。

- [x] **Step 3: 实现最小 Store 与类型**

  使用 Zustand 单一 store；`append` 在一次 state 更新中分配 ID 并截取最后 1000 条，`clear` 不重置 `nextId`。

- [x] **Step 4: 运行 Store 测试至通过**

  Run: `pnpm test src/modules/logs/__tests__/store.test.ts`
  Expected: PASS。

- [x] **Step 5: 编写订阅 Hook 失败测试**

  Mock 官方 `attachLogger`，断言 `Info=3` 映射为 `info` 并追加；未知级别被忽略；组件卸载后调用官方 unlisten；监听 Promise 在卸载后才完成时仍立即清理；监听拒绝不会产生未处理异常。

- [x] **Step 6: 运行 Hook 测试确认失败**

  Run: `pnpm test src/modules/logs/__tests__/useLogStream.test.tsx`
  Expected: FAIL，原因是 hook 尚不存在。

- [x] **Step 7: 实现 Hook、logger facade 与 App 接线**

  Hook 使用 effect scoped `disposed` 标记处理异步注册竞态；`App` 在 Provider 内调用 `useLogStream()`。logger facade 只格式化 scope，不暴露插件枚举给业务代码。

- [x] **Step 8: 运行日志模块和 App 测试**

  Run: `pnpm test src/modules/logs src/App.test.tsx`
  Expected: PASS，且 React StrictMode 下没有 act 或未处理 Promise 警告。

### Task 3: 设置页实时日志视图

**Files:**
- Create: `src/modules/logs/components/LogViewer.tsx`
- Create: `src/modules/logs/__tests__/LogViewer.test.tsx`
- Modify: `src/modules/settings/components/SettingsDialog.tsx`
- Modify: `src/modules/settings/components/SettingsDialog.test.tsx`

**Interfaces:**
- `LogViewer` 无 props，直接订阅 `useLogStore`。
- 级别筛选值为 `all | LogLevel`；搜索对 message 做不区分大小写匹配。
- “清空视图”只调用 Store `clear()`；自动滚动默认开启。

- [x] **Step 1: 编写 LogViewer 失败测试**

  预置 info/error 日志，断言默认同时展示；选择 error 后隐藏 info；输入关键字后只保留匹配项；点击“清空视图”后展示空状态。

- [x] **Step 2: 运行组件测试确认失败**

  Run: `pnpm test src/modules/logs/__tests__/LogViewer.test.tsx`
  Expected: FAIL，原因是组件尚不存在。

- [x] **Step 3: 实现日志工具栏与列表**

  使用现有 Button、Input、Select、Switch 与 Lucide 图标；列表使用固定高度、等宽字体、换行和滚动容器，不引入虚拟列表或新 UI 依赖。

- [x] **Step 4: 运行 LogViewer 测试至通过**

  Run: `pnpm test src/modules/logs/__tests__/LogViewer.test.tsx`
  Expected: PASS。

- [x] **Step 5: 编写设置页签失败测试**

  打开设置，点击“日志”，断言日志工具栏和空状态可见；切回“常规”后保存按钮语义保持不变。

- [x] **Step 6: 运行设置测试确认失败**

  Run: `pnpm test src/modules/settings/components/SettingsDialog.test.tsx`
  Expected: FAIL，因为“日志”页签尚不存在。

- [x] **Step 7: 接入设置页签**

  扩展 `SettingsTab` 为 `general | subscriptions | data | logs | about`，在“导入与导出”和“关于”之间加入日志页签与 `LogViewer`。

- [x] **Step 8: 运行设置与阅读器测试**

  Run: `pnpm test src/modules/settings/components/SettingsDialog.test.tsx src/modules/reader/pages/ReaderPage.test.tsx`
  Expected: PASS，既有设置和阅读器交互无回归。

### Task 4: 关键业务边界日志

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/modules/feeds/commands.rs`
- Modify: `src-tauri/src/modules/sync/commands.rs`
- Modify: `src-tauri/src/modules/sync/service.rs`
- Modify: `src-tauri/src/modules/opml/commands.rs`
- Modify: `src-tauri/src/modules/settings/commands.rs`
- Modify: `src/modules/updater/service.ts`
- Modify: `src/modules/updater/__tests__/service.test.ts`

**Interfaces:**
- Rust targets 固定为 `feed-forge::app`、`feed-forge::feeds`、`feed-forge::sync`、`feed-forge::opml`、`feed-forge::settings`。
- 前端 updater 使用 `appLogger` scope `updater`。
- 所有日志只包含 ID、数量、阶段、耗时和安全错误码，不包含原始 URL 或内容。

- [x] **Step 1: 编写 updater 日志失败测试**

  Mock 官方插件边界，调用检查、安装成功和检查失败路径，断言用户可见返回行为不变，并断言发送到插件的消息只包含固定 scope、版本和安全失败分类，不包含 URL、响应体或底层错误文本。

- [x] **Step 2: 运行 updater 测试确认失败**

  Run: `pnpm test src/modules/updater/__tests__/service.test.ts`
  Expected: FAIL，因为 updater 尚未写入应用日志。

- [x] **Step 3: 增加前端和 Rust 阶段边界日志**

  updater 记录检查开始、无更新、发现版本、安装完成和安全失败分类；Rust 在数据库初始化、feed mutation、同步任务、OPML 和设置更新的入口/成功/失败边界记录低频日志。对底层错误只使用既有 `AppError.code` 或固定分类，不输出原始 URL、内容或响应体。

- [x] **Step 4: 运行聚焦测试与 Rust 测试**

  Run: `pnpm test src/modules/updater/__tests__/service.test.ts src/modules/logs`
  Run: `pnpm test:rust`
  Expected: PASS，日志接入不改变既有业务结果或同步终态。

### Task 5: 全量验证与桌面验收

**Files:**
- Modify if required by verified behavior only: `docs/testing-strategy.md`

**Interfaces:**
- 自动化验证覆盖前端、脚本、Rust、TypeScript 与 capability 编译。
- 桌面验收验证官方插件的真实文件与 Webview 双 target，不用 mock 结果代替。

- [x] **Step 1: 运行全量自动化验证**

  Run: `pnpm test:all`
  Run: `pnpm build`
  Run: `cargo check --manifest-path src-tauri/Cargo.toml`
  Run: `git diff --check`
  Expected: 所有命令退出码为 0，无新增 warning 或格式问题。

- [ ] **Step 2: 启动桌面开发应用进行人工验收**

  Run: `pnpm dev:desktop`
  Expected: 设置 -> 日志实时出现应用日志；关闭再打开页签仍保留当前运行期记录；`com.feedforge.app.dev` 对应 `app_log_dir` 中的日志文件持续增长。

- [x] **Step 3: 验证轮转和环境边界**

  通过日志配置和运行目录确认活跃文件限制为 5 MiB、保留策略为 5 个归档；确认生产 identifier 仍为 `com.feedforge.app`、开发 identifier 仍为 `com.feedforge.app.dev`，未合并配置。

- [x] **Step 4: 检查最终范围**

  Run: `git status --short`
  Run: `git diff --stat`
  Expected: 只包含日志系统、必要业务埋点、测试、依赖锁文件和本设计/计划文档。
