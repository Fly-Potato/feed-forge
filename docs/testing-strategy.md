# Feed Forge 测试策略

本文档是 Feed Forge 当前测试规范与未来测试规划的唯一长期依据。修改功能、测试、IPC 或 Rust 命令时，应先阅读本文档；测试工具、规则、命令或路线图状态发生变化时，应在同一次变更中更新本文档。

`docs/superpowers/specs/` 保存历史设计决策，`docs/superpowers/plans/` 保存一次性实施记录。它们用于追溯背景，不代表当前策略。

## 当前测试分层

| 层级 | 工具 | 当前职责 |
| --- | --- | --- |
| 前端单元与组件测试 | Vitest 5、React Testing Library、user-event、jest-dom、jsdom | 验证用户可见行为、交互、状态和错误提示 |
| 前端 IPC 契约测试 | `@tauri-apps/api/mocks` | 验证 Tauri 命令名、参数、返回值处理和失败处理 |
| Rust 单元测试 | Rust 内置测试框架、`cargo test` | 验证纯函数、命令逻辑和领域行为 |
| 覆盖率 | `@vitest/coverage-v8` | 生成终端摘要与 HTML 报告，用于发现遗漏 |

当前不使用真实浏览器组件测试、桌面端 E2E、`cargo-nextest` 或通用 mock 框架。

## 强制规则

### 通用

- 功能行为发生变化时，必须在最接近该行为的测试层补充或更新测试。
- 测试应验证公开行为和稳定契约，不依赖内部状态、实现细节或大面积快照。
- 测试不得使用固定延时等待异步结果。
- 不为尚未出现的网络、文件系统、数据库或运行时边界预先引入测试抽象。
- 修复缺陷时，应增加能够复现原问题的回归测试；无法自动化时，在变更说明中记录原因和人工验证方式。

### 前端与 IPC

- 组件测试优先使用角色、标签和可见文本查询元素。
- 用户交互使用 `@testing-library/user-event`。
- 异步状态使用 `findBy*`、`waitFor` 或等价的异步语义断言。
- IPC 测试使用 `@tauri-apps/api/mocks`；处理器必须显式验证命令名和参数，未声明的命令应立即失败。
- 每个测试结束后必须清理 DOM 和 Tauri mock，测试之间不得共享 IPC 状态。
- 不单独测试 `src/components/ui/*` 中的上游基础组件；通过 Feed Forge 的业务组合验证它们。

### Rust

- 纯函数和私有命令逻辑优先使用同文件 `#[cfg(test)]` 模块测试。
- 跨模块公开行为可放入 `src-tauri/tests/` 集成测试。
- Tauri 命令应保持为薄适配层；出现文件、网络或状态逻辑后，将业务逻辑拆到可直接测试的函数或服务。
- 只有需要验证命令注册、managed state 或 runtime 事件时，才引入 Tauri runtime 测试设施。

## 文件组织

```text
src/**/*.test.ts
src/**/*.test.tsx
src/test/setup.ts
src-tauri/src/*.rs          # 同文件单元测试
src-tauri/tests/*.rs        # 后续跨模块集成测试
```

测试文件与对应前端源码就近放置。共享测试初始化仅放在 `src/test/setup.ts`，测试辅助代码不得被生产入口导入。

## 标准命令

| 命令 | 用途 |
| --- | --- |
| `pnpm test` | 单次执行前端测试 |
| `pnpm test:watch` | 监听前端测试 |
| `pnpm test:coverage` | 执行前端测试并生成 V8 覆盖率报告 |
| `pnpm test:rust` | 执行 Rust 测试 |
| `pnpm test:all` | 顺序执行前端与 Rust 测试 |
| `pnpm build` | 验证 TypeScript 与前端生产构建 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 验证 Rust 编译与类型检查 |

按变更范围执行验证：

- 仅前端行为：至少运行 `pnpm test` 和 `pnpm build`。
- 仅 Rust 行为：至少运行 `pnpm test:rust` 和 `cargo check --manifest-path src-tauri/Cargo.toml`。
- IPC 或跨前后端行为：运行 `pnpm test:all`、`pnpm build` 和 `cargo check --manifest-path src-tauri/Cargo.toml`。
- 测试配置、依赖或覆盖率规则：额外运行 `pnpm test:coverage`。

## 覆盖率策略

覆盖率用于观察关键行为遗漏，当前不设置语句、分支、函数或行覆盖率阈值。评审以关键业务路径是否有有效断言为准，不追求单一百分比。

业务模块和测试基线稳定后，才根据实际分布评估阈值。未来若启用阈值，应优先约束项目自有业务代码，并排除生成代码与上游 UI 基础组件。

## 未来路线图

路线图状态只使用以下四种值：

- `暂缓`：当前收益不足，等待触发条件。
- `已触发`：触发条件已经出现，需要完成选型或设计。
- `实施中`：方案已确认并正在落地。
- `已完成`：能力已经落地，相关当前规则应移入本文档对应章节。

| 规划 | 当前状态 | 触发条件 |
| --- | --- | --- |
| Vitest Browser Mode | 暂缓 | jsdom 无法可靠覆盖真实布局、Canvas 或所需浏览器 API |
| Tauri 桌面 E2E | 暂缓 | 出现跨窗口、系统权限、文件选择、托盘或打包后关键流程 |
| `cargo-nextest` | 暂缓 | Rust workspace、crate 或测试数量增长，现有执行时间成为明确瓶颈 |
| 网络与文件测试设施 | 已触发 | HTTPS RSS 抓取已成为核心业务边界，需要可重复验证 TLS 客户端能力且不依赖公网可用性 |

达到任一触发条件时，先把对应状态改为 `已触发`，记录实际场景和约束，再开展选型。方案确定后更新状态和当前规则；不要只在临时计划或讨论中记录结论。

当前触发场景是 HTTPS 订阅源同步。默认回归测试在编译和客户端构建阶段验证 rustls 后端及加密 provider 已启用，不访问公网；另保留默认忽略的真实订阅源 smoke test，用于显式验证下载和解析链路。当前暂不引入通用网络 mock 框架，后续若需要稳定断言响应、重试或超时语义，再评估本地 HTTP 测试服务或专用 mock 工具。
