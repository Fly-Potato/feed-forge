---
name: feed-forge-development
description: Use when adding or changing Feed Forge React/TypeScript business modules, shared components, Rust/Tauri modules, IPC commands, events, capabilities, or their tests
---

# Feed Forge 开发规范

## 何时使用

只要任务涉及以下任一内容，就先使用本 Skill：

- `src/modules/<业务>/` 业务代码
- `src/components/` 公共组件
- `src-tauri/src/` Rust 业务或 Tauri 集成
- `invoke`、Tauri command、Channel、event、capability
- 前后端契约、IPC mock、Rust command 测试

开始修改 IPC、Rust command 或测试前，先阅读 `docs/testing-strategy.md`。涉及 Tauri v2 API 时，同时遵循 `tauri-v2` Skill。

## 核心边界

按业务垂直切片组织代码。前端业务、Rust 业务和 IPC 契约应能按同一个业务名定位；command 是薄适配层，业务规则放在可直接测试的 service 中。

不要为了“看起来统一”建立通用 CRUD、通用 IPC dispatcher、全局事件总线或提前引入类型生成。只有已有重复和明确收益时才抽象。

## 前端目录

业务代码必须位于 `src/modules/<business>/`，业务名使用小写 kebab-case：

```text
src/modules/feeds/
├── pages/          # 页面级组合
├── components/     # 仅 feeds 使用的组件
├── hooks/          # 业务状态和交互
├── ipc.ts          # 本业务唯一的 Tauri 调用 facade
├── types.ts        # 业务类型和 IPC DTO
├── index.ts        # 模块对外入口
└── __tests__/      # 本业务测试
```

`App.tsx` 只做应用级组合、Provider 和入口编排，不承载业务逻辑。

公共组件必须放在 `src/components/`：

- `src/components/ui/`：基础 UI 组件。
- `src/components/common/`：跨业务复用且不含业务语义的组合组件。
- 只被一个业务使用的组件留在该业务的 `components/`。

组件和 hook 不得散落直接调用 `invoke`；统一调用本业务 `ipc.ts` 暴露的类型化函数。

## Rust 目录

```text
src-tauri/src/
├── lib.rs             # Builder、插件和显式 command 注册
├── state.rs           # managed state
├── error.rs           # 公共 IPC 错误
├── events.rs          # 跨业务 event 定义（确有需要时）
├── commands/mod.rs    # command re-export
└── modules/feeds/
    ├── mod.rs
    ├── commands.rs    # Tauri 薄适配层
    ├── dto.rs         # IPC 输入/输出
    ├── service.rs     # 领域规则，可直接单测
    ├── repository.rs  # 文件、网络、数据库等外部资源
    └── error.rs       # 业务内部错误映射
```

command 只负责参数反序列化、边界校验、状态注入、service 调用和错误转换。不要在 command 中堆积文件、网络、数据库或复杂状态逻辑。

`lib.rs` 必须显式维护 `tauri::generate_handler![]` 注册列表。新增函数但未注册属于未完成实现。

## IPC 契约

### Command

命名格式固定为 `<business>_<action>`，使用小写 snake_case，例如：

```text
feeds_list
feeds_create
feeds_update
feeds_sync
```

每个 command 对应一个明确用例，参数统一为一个输入对象，返回明确 DTO：

```text
src/modules/feeds/ipc.ts
  -> invoke("feeds_list", input)
  -> Rust feeds_list(input, State<AppState>)
  -> service
  -> Output / AppError
```

command 名是稳定的公共协议。破坏性变更应新增 command 或提供明确兼容策略；不要仅因 Rust 函数重命名就修改 wire name，也不要预先添加没有兼容需求的 `v1` 前缀。

### DTO 和错误

- 输入、输出和可选字段都要显式定义。
- 对外字段使用 camelCase；Rust 侧显式设置 serde 命名规则。
- Rust command 返回 `Result<Output, AppError>`。
- `AppError` 至少包含稳定 `code` 和安全 `message`，可选 `details`、`retryable`。
- 内部错误、路径、堆栈、SQL、令牌和敏感上下文不得直接返回前端。
- 前端 facade 统一 normalize 未知 rejection；业务 UI 按错误码处理。
- scope、会话、权限和资源归属从可信应用上下文解析，不能信任前端或模型传入的跨 scope ID、路径或权限参数。

### Command、Channel 和 Event

- 需要明确成功/失败结果的请求使用 command。
- 长任务不要让 `invoke` 长时间等待；command 立即返回 job/accepted DTO，进度使用与本次调用关联的 `Channel<T>`。
- 长任务进度类型必须有明确的 `started`、`progress`、`completed`、`failed`、`canceled` 终态语义；取消使用单独 command，并在 Rust 侧校验归属和幂等性。
- 只有跨窗口广播、生命周期或状态变化等 fire-and-forget 消息才使用 event。
- event 命名为 `<business>:<event>`，例如 `feeds:sync-completed`。
- 不要把同一进度同时作为 Channel 和全局 event；这样会产生重复、乱序和监听竞态。

### 权限

新增 IPC 时逐项核对：command 注册、窗口 label、capability、插件权限和实际调用名。涉及文件、网络、系统 API 或事件监听时采用最小权限，禁止 wildcard 权限。

## 强制工作流

1. 判定变更是业务模块、公共组件、Rust 业务、IPC 还是 capability。
2. 检查现有业务目录、调用路径和 `docs/testing-strategy.md`。
3. 先写清输入、输出、错误、权限、副作用、长任务终态和取消语义。
4. 前端把调用集中到业务 `ipc.ts`，Rust 把业务逻辑放入 service。
5. 先补能失败的契约或边界测试，再实现最小纵向切片。
6. 同步更新 command 注册、DTO、capability 和前后端调用。
7. 按范围验证：
   - 仅前端：`pnpm test`、`pnpm build`
   - 仅 Rust：`pnpm test:rust`、`cargo check --manifest-path src-tauri/Cargo.toml`
   - IPC/跨端：`pnpm test:all`、`pnpm build`、`cargo check --manifest-path src-tauri/Cargo.toml`
8. 检查错误路径、空状态、重复提交/取消、权限拒绝、注册遗漏、`git diff --check` 和变更范围。
9. 最终报告实际运行的命令、未覆盖场景和环境限制；不能把 mock 全绿当成打包运行时已验证。

## 测试要求

- 前端业务使用 Vitest、React Testing Library 和 user-event，验证用户可见行为。
- IPC 测试使用 `@tauri-apps/api/mocks`，显式断言 command 名、参数、成功值和失败处理。
- Rust 优先测试 DTO 校验、service、错误映射、边界和并发语义；只有验证注册、managed state 或 runtime event 时才引入 Tauri runtime 测试。
- 跨前后端变更至少覆盖一个成功路径和一个关键失败路径；长任务额外覆盖进度终态、取消竞态和重复调用语义。

## 红线与常见误区

| 误区 | 处理 |
|---|---|
| 把业务放到 `src/features/` 或根目录 | 使用 `src/modules/<业务>/`，除非用户明确批准目录迁移 |
| 组件直接 `invoke` | 移到业务 `ipc.ts`，组件只依赖 facade/hook |
| 新 command 没进 `generate_handler![]` | 注册是完成条件，不是收尾工作 |
| 用普通 `invoke` 等待长任务 | 返回 job/accepted，使用关联 Channel 表达进度 |
| 同时使用 Channel 和全局 event 传同一进度 | 选择一个权威进度源 |
| 把底层错误原样返回 | 映射为稳定错误码和固定安全文案 |
| 只测 happy path 或“测试后补” | 先写会失败的契约/边界测试，再实现最小切片 |
| 用前端参数决定 scope、路径或权限 | Rust 从可信上下文解析并再次校验 |
| 为一次复用提前抽象通用框架 | 保持领域 facade 和 service 薄而明确 |

## 完成检查

完成前必须能回答：

- 业务文件是否都在正确的 `src/modules/<业务>/`？
- 公共组件是否确实跨业务且无业务语义？
- 每个 command 的 wire name、DTO、错误码和注册位置是否一致？
- capability、窗口作用域和插件权限是否最小且已验证？
- 前端、Rust 和 IPC mock 是否覆盖成功与关键失败路径？
- 长任务是否定义终态、取消、重试和清理语义？
- 验证命令是否实际运行并记录结果？
