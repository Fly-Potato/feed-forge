# Feed Forge 实时日志系统设计

## 目标

Feed Forge 使用 Tauri 官方 `tauri-plugin-log` 建立单一日志管线，同时将日志实时写入轮转文件并推送到主 Webview，在设置界面中展示当前运行期日志。

## 边界

- 官方插件负责日志注册、格式化、文件写入、轮转和 Webview 推送，不自研 logger、文件 tail 或事件协议。
- UI 保存前端开始监听后收到的当前运行期日志，不读取旧会话日志，也不补回 Webview 监听建立前的 Rust 启动日志。
- 完整历史以 Tauri `app_log_dir` 下的文件为准；开发与生产继续由不同 identifier 隔离。
- 首版不实现日志上传、导出、动态级别配置、文件删除或历史文件浏览。

## 日志管线

Rust 使用 `log` crate，前端使用 `@tauri-apps/plugin-log`。插件同时配置：

- `LogDir`：持久化日志文件。
- `Webview`：通过官方 `log://log` 事件推送当前日志。
- `Stdout`：仅开发构建启用，方便本地诊断。

Capability 只授予 `log:default`、`core:event:allow-listen` 和 `core:event:allow-unlisten`；后两项分别用于官方 `attachLogger` 建立和清理监听，不扩大到完整 core event 权限集。

文件使用本地时区、每个活跃文件最大 5 MiB、保留 5 个轮转文件并继续追加当前会话。生产默认 `Info`，开发默认 `Debug`；高噪声依赖最低限制为 `Warn`。

## 前端模块

新增 `src/modules/logs/`：

- `types.ts` 定义应用内部日志级别与日志条目。
- `store.ts` 使用 Zustand 保存最多 1000 条日志，提供追加和清空视图操作。
- `hooks/useLogStream.ts` 在应用挂载时调用官方 `attachLogger`，将数值级别映射为应用类型，并在卸载时清理监听。
- `logger.ts` 集中封装前端 `debug/info/warn/error`，业务组件不得分散直接调用插件。
- `components/LogViewer.tsx` 提供级别筛选、关键字搜索、自动滚动和清空视图。

`App` 在启动时挂载日志监听，确保日志面板尚未打开时仍持续收集记录。设置对话框增加“日志”页签，但不把日志状态塞入设置 DTO 或数据库。

## 日志内容

记录应用初始化以及订阅、同步、OPML、设置和更新操作的阶段边界、成功结果与失败点。使用稳定 target，例如 `feed-forge::sync`、`feed-forge::feeds`。

日志只记录业务 ID、任务 ID、数量、阶段、耗时和安全错误分类。不得记录完整订阅 URL、URL 查询参数、Cookie、令牌、OPML 内容、文章正文、签名地址或底层响应体。避免逐文章、逐数据库行记录，确保 Tauri event 系统只承载低频诊断事件。

## 错误与退化

- 未知 Webview 日志级别忽略，不污染 UI 状态。
- 监听建立失败不阻塞阅读器；错误只输出到浏览器控制台。
- 日志面板清空只影响内存视图，不删除文件。
- 插件文件 target 初始化失败沿用官方插件启动错误语义，不额外维护第二套降级 logger。

## 测试与验收

- Store 测试覆盖顺序、1000 条上限和清空语义。
- Hook 测试覆盖级别映射、未知级别忽略、异步监听清理和监听失败不抛出。
- LogViewer 测试覆盖筛选、搜索、清空和空状态。
- SettingsDialog 测试覆盖日志页签可访问。
- 跨端验证运行 `pnpm test:all`、`pnpm build`、`cargo check --manifest-path src-tauri/Cargo.toml` 和 `git diff --check`。
- 桌面人工验收确认开发日志文件持续写入、UI 同步出现同一日志、关闭再打开页签仍保留当前运行期日志，并确认开发目录与生产目录隔离。
