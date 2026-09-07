# Feed Forge 开发 Skill 设计

## 状态

待审阅。本文只定义约束和落地边界，不创建 Skill 文件，也不改变现有业务代码。

## 目标

建立仓库级 `feed-forge-development` Skill，用于约束 Feed Forge 的 React/TypeScript 前端、Rust/Tauri 后端以及前后端 IPC 开发方式。

目标是让新增业务具备稳定的目录边界、可追踪的 command 契约和与现有测试策略一致的验证路径，同时避免为了规范提前引入类型生成、通用业务框架或无实际需求的抽象。

## 当前基线

- 前端入口和演示业务在 `src/App.tsx`。
- 公共基础组件在 `src/components/ui/`。
- Tauri 入口、`greet` command 和 command 注册在 `src-tauri/src/lib.rs`。
- 当前测试策略使用 Vitest、React Testing Library、Tauri mocks 和 Rust 内置测试。
- 仓库使用 Tauri v2、React、TypeScript、Vite 和 Rust。

现有演示代码不需要为了建立规范立即迁移；下一项真实业务按新规范落地即可。

## 目录设计

### 前端

业务代码必须位于 `src/modules/<business>/`，业务名使用小写 kebab-case。

```text
src/
├── modules/
│   └── feeds/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── ipc.ts
│       ├── types.ts
│       ├── index.ts
│       └── __tests__/
├── components/
│   ├── ui/
│   └── common/
└── lib/
    └── ipc/
        └── errors.ts
```

- `pages/` 负责页面级组合和布局。
- `components/` 只放当前业务使用的组件。
- `hooks/` 只放当前业务状态和交互逻辑。
- `ipc.ts` 是当前业务唯一的 command 调用入口。
- `types.ts` 放业务类型和 IPC DTO 类型。
- `App.tsx` 只做应用级组合，不承载业务逻辑。
- `src/components/ui/` 放基础 UI；跨业务且无业务语义的组合组件放 `src/components/common/`。

### Rust 后端

```text
src-tauri/src/
├── lib.rs
├── state.rs
├── error.rs
├── events.rs
├── commands/
│   └── mod.rs
└── modules/
    └── feeds/
        ├── mod.rs
        ├── commands.rs
        ├── dto.rs
        ├── service.rs
        ├── repository.rs
        └── error.rs
```

- `commands.rs` 只负责 Tauri 参数、状态注入、输入校验、service 调用和错误转换。
- `service.rs` 承载可直接单元测试的业务规则。
- `repository.rs` 负责文件、网络、数据库或其他外部资源。
- `dto.rs` 与内部领域模型分离，避免内部模型直接成为 IPC 协议。
- `lib.rs` 保留显式 `generate_handler![]` 注册，避免动态发现 command。

## IPC 契约

### Command

命名固定为 `<business>_<action>`，使用小写 snake_case，例如 `feeds_list`、`feeds_create`、`feeds_sync`。

每个 command 只对应一个明确用例，输入统一为一个对象，输出为明确 DTO，Rust 返回 `Result<Output, AppError>`。

```text
Frontend module ipc.ts
    -> invoke("feeds_list", input)
    -> Rust command adapter
    -> service
    -> DTO / AppError
```

command 名是稳定的公共协议，不因 Rust 函数内部重命名而随意改变。破坏性协议变更需要新增 command 或采用明确的兼容策略；不为尚未出现的版本需求预先加 `v1` 前缀。

### DTO 与错误

- IPC DTO 显式定义输入、输出和可选字段。
- 对外字段统一使用 camelCase；Rust 侧显式配置序列化规则。
- `AppError` 至少包含稳定 `code` 和用户可处理的 `message`，`details` 只能放非敏感诊断信息。
- 不把 Rust 内部错误字符串、路径、堆栈或调试信息直接透传给前端。
- 前端在 IPC 层统一归一化未知异常，业务组件按错误码处理分支。

### Event

command 用于需要响应和成功/失败结果的调用；event 只用于单向、fire-and-forget 的生命周期、状态或进度通知。

event 命名固定为 `<business>:<event>`，例如 `feeds:sync-progress`、`feeds:sync-completed`。

### 安全与权限

新增 command 时必须同时检查注册、窗口作用域、插件权限和 capability 配置。涉及文件、网络、系统 API 或事件监听时采用最小权限原则，并在变更说明中列出权限影响。

## Skill 工作流

最终 Skill 固定以下检查顺序：

1. 判定变更属于业务模块、公共组件、Rust 业务、IPC 或 capability。
2. 检查对应前后端业务目录和现有契约。
3. 先定义 IPC 输入、输出、错误和副作用，再实现 command。
4. 前端调用集中到业务模块的 `ipc.ts`，组件不直接散落 `invoke`。
5. Rust command 保持薄，业务规则放入 service。
6. 在最接近行为的测试层补充测试。
7. 按变更范围执行 `pnpm test`、`pnpm build`、`pnpm test:rust` 和 `cargo check --manifest-path src-tauri/Cargo.toml`。
8. 最后复核 command 注册、DTO、命名、capability 和前后端路径一致性。

## 测试约束

- 前端业务使用 Vitest、React Testing Library 和 user-event。
- IPC 测试使用 `@tauri-apps/api/mocks`，明确断言 command 名和参数。
- Rust 优先测试 service 和纯函数；只有验证注册、managed state 或 runtime event 时才引入 Tauri runtime 测试。
- IPC 或跨端变更按现有策略执行 `pnpm test:all`、`pnpm build` 和 Rust check。

## 暂不纳入

- 不立即迁移当前 `greet` 演示代码。
- 不立即引入 Rust 到 TypeScript 的自动类型生成。
- 不建立通用 CRUD、通用 command dispatcher 或跨业务状态框架。
- 不把只服务单个业务的组件提前提升为公共组件。

## 后续实施

设计通过后：

1. 创建 `.agents/skills/feed-forge-development/SKILL.md`。
2. 如正文超过可维护长度，再拆出 IPC 参考文件；第一版优先保持单文件。
3. 更新根 `AGENTS.md` 的 Skill 触发说明。
4. 选择一个真实业务作为示例，按 Skill 实施并验证。
5. 根据示例暴露出的歧义修订 Skill，再进行部署前测试。
