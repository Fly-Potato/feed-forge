# 前端数据、状态与 IPC 校验接入设计

日期：2026-09-13

## 目标与范围

在现有 React + TypeScript + Tauri v2 桌面应用中直接依赖 Zod、Zustand、`@tanstack/react-query`，迁移前端所有已使用的 IPC 返回契约及阅读器的数据/状态管理。保留现有用户可见操作、Rust command 名称与输入输出协议、Channel 进度机制和 Tauri 权限。`docs/testing-strategy.md` 是当前测试规则的权威来源；本文件仅记录本次设计。

不引入通用 IPC dispatcher、类型生成、额外全局事件总线、持久化客户端缓存或不相关的 UI 改版。Rust 仍负责权威输入校验和业务规则；Zod 负责前端对运行时返回数据的信任边界。

## 职责与文件边界

| 责任 | 位置与方式 | 不承担 |
| --- | --- | --- |
| IPC 契约 | 各业务模块的 schema/type 和 `ipc.ts`；`invoke<unknown>` 后解析返回值 | 不在组件里调用 `invoke`，不缓存业务数据 |
| 异步数据 | feeds、articles、settings 的业务 hooks 和各自 query keys；根级单个稳定 `QueryClientProvider` | 不持有临时 UI 选择 |
| 阅读器 UI 状态 | 独立阅读器业务模块的 Zustand store，使用细粒度 selector | 不保存 feeds、article 对象、settings 或查询 loading/error |
| 页面组合 | `App.tsx` 保留 Provider/入口编排，阅读器布局及业务交互移至阅读器业务页面 | 不在 App 中手工维护多份异步数据 |
| 局部瞬态状态 | 设置弹窗草稿、表单文本、一次性提示及本次同步进度仍由所属组件/hook 管理 | 不无差别搬入 Zustand |

Zustand store 只保存 `selectedFeedId`、`selectedArticleId` 和文章 `filter`；当前只由阅读器页面使用的侧栏折叠状态留在页面本地，初始窄屏折叠逻辑继续尊重现有视口行为。组件从当前查询结果按 ID 派生选中文章，不复制文章对象。切换订阅源或筛选条件清空文章选择；成功删除当前订阅源则清空订阅源和文章选择；仅在 feeds 查询成功时依据有效结果清理已消失的选择，不能把读取失败误判成空列表。文章被更新后若不再满足当前筛选，则取消其选择。

## IPC 运行时校验与错误

每个业务模块维护与当前 Rust DTO 一致的 Zod schema，并从 schema 推导对外返回类型：

- feeds：订阅源列表、单个订阅源及删除结果；
- articles：文章分页、文章读取状态/收藏状态更新结果；
- settings：读取和保存结果，主题与刷新间隔保持 Rust 当前有效取值；
- OPML：导入数量和导出 XML 字符串；
- sync：启动/取消确认与 `started`、`progress`、`completed`、`failed`、`canceled` 的 Channel 判别联合消息。

schema 检查必需字段、nullable 字段、非负计数、合法枚举与安全整数 ID；对象容忍额外字段以兼容非破坏性协议扩展。各 facade 在 `invoke<unknown>` 取得成功结果后解析，不能以 TypeScript 泛型假装完成校验；命令拒绝维持原有安全错误归一化。无效的成功返回值转换为固定文案且不可重试的 `IpcError(code: "invalid_response")`，不在界面泄露原始 payload、schema issues 或底层堆栈。尤其对 mutation：Rust 操作可能已成功但响应不合法，因此 UI 不报告成功，仍失效对应缓存以重新读取权威状态。Rust 拒绝的结构化错误也检查稳定的 `code`、`message`、`retryable` 类型，错误格式不合法时使用现有通用安全错误。

Channel 回调先将消息当作 `unknown` 解析；无效消息仅上报可见的协议错误并忽略该消息，绝不将其视为有效终态或触发缓存失效，也不从 Channel 回调抛出未处理异常。同步 hook 仍持有该次 job 的进度及取消状态；新任务与旧 Channel 回调隔离，防止旧任务的终态消息误刷新当前任务状态。只有经过校验且属于本次任务的 `completed`、`failed`、`canceled` 才失效 feeds/articles，且每次任务的终态只触发一次；三种状态继续分别显示成功、失败、取消，不把后两者伪装成成功。此前若有无效消息，后续有效终态仍须显示真实终态。原因是 `src-tauri/src/modules/sync/service.rs` 逐项提交，后续失败或取消不会回滚已同步的订阅源。`sync_status` 在当前前端未调用，不为其预建 facade。

## Query 缓存与更新语义

根入口创建稳定的 `QueryClient`；测试每次渲染使用隔离实例，关闭测试重试，不共享缓存。桌面本地 IPC 默认关闭窗口重新聚焦与网络重连引起的自动重取。读取只对标记 `retryable` 的已归一化 IPC 错误有限重试；契约错误、参数错误和所有 mutation 不自动重试。更新来源以显式 mutation、导入、有效同步终态和查询切换为准。

feeds、settings 使用固定 query key；articles key 包含订阅源 ID 和筛选条件（以及当前固定分页参数），未选择订阅源时禁用查询且向界面呈现空列表，不沿用前一个订阅源的旧页面。成功添加/重命名/删除订阅源后更新或失效 feeds 列表，删除时清理该订阅源文章缓存；读取和收藏状态更新后失效相关 articles 列表，以便重算 `unread`/`starred` 的成员和分页总数，避免只修改当前可见行导致筛选结果错误。保存设置成功后写入 settings 缓存，保留现有草稿与失败提示。OPML 导入成功后失效 feeds；导出无查询失效。同步任务经过校验的完成、失败或取消终态都失效 feeds 与 articles，以反映可能已经逐项提交的结果。失效和后续读取失败不能把一次已成功的写操作显示成“写入失败”；界面仍能展示查询错误及重试入口/现有错误状态。

设置的主题生效与自动刷新定时器仍随已验证的 settings 数据更新，卸载或间隔变化时清理定时器；不得因为 Query 的重渲染额外创建计时器。现有订阅管理弹窗在保存、导入或订阅 mutation 期间仍禁止关闭，失败时保留用户草稿。筛选切换和订阅切换不复用先前选择的文章对象。

## 测试与实施边界

遵循 `docs/testing-strategy.md`：先补会失败的边界与用户行为测试，再依次接入直接依赖和 Provider、各业务 Zod schema/IPC facade、Query hooks/失效，以及阅读器 Zustand store/页面。改写已有 IPC mock 中返回 `{}` 等不符合契约的测试桩，让正例返回真实 DTO，单独用畸形响应测试 `invalid_response`。保持当前命令名和参数断言。

重点验证：所有 IPC 正常/畸形响应与安全错误；同步完成、部分成功后失败或取消时的刷新与各自提示、无效终态及旧任务消息不触发刷新；OPML 导入成功后订阅刷新；订阅增删改及文章读/星标操作在不同筛选条件下的一致性；删除订阅、筛选切换、加载失败时的选择清理边界；设置草稿、主题、刷新定时器及 busy 弹窗。组件测试以角色和可见行为断言，QueryClient/Zustand 在测试间隔离，Tauri mock 仍在每例结束清理。

本变更不预期修改 Rust command、权限或测试栈，故不为其增加不必要抽象。验收至少执行 `pnpm test:all`、`pnpm build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`pnpm test:coverage`、`git diff --check` 并核对变更范围；如实际达到测试路线图新触发条件，先更新 `docs/testing-strategy.md` 再评估测试设施。mock 测试通过不等同于打包桌面运行时验证。
