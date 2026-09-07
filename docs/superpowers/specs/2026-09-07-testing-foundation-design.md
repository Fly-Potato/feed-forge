# Feed Forge 前后端测试基础设计

> 文档状态：历史设计记录。当前测试规范与未来路线图以 [`docs/testing-strategy.md`](../../testing-strategy.md) 为准。

## 目标

为现有 Tauri v2、React、TypeScript 和 Vite 工程建立快速、可维护的第一阶段测试基础。测试应覆盖当前 React 交互、Tauri IPC 调用契约和 Rust 命令逻辑，同时保持本地与持续集成执行成本较低。

第一阶段只建立单元、组件和进程内集成测试，不引入真实桌面端到端测试。覆盖率用于观察和发现遗漏，不设置阻断阈值。

## 当前边界

当前应用只有一个跨前后端行为：React 表单调用 `invoke("greet", { name })`，Rust 的 `#[tauri::command]` 返回欢迎文本。工程尚未包含网络、文件系统、数据库、持久化状态或额外 Tauri 插件。

测试基础必须适合后续业务增长，但不为尚不存在的外部依赖预先引入抽象层、mock 框架或复杂运行器。

## 选定方案

### 前端

采用以下组合：

- Vitest 5：测试运行器，与当前 Vite 8、TypeScript 和 ESM 配置共用转换链路。
- React Testing Library：按用户可见行为和可访问语义测试 React 组件。
- `@testing-library/user-event`：模拟接近真实用户的输入和提交操作。
- `@testing-library/jest-dom`：提供面向 DOM 语义的断言。
- jsdom：提供快速、无浏览器进程的 DOM 环境。
- `@vitest/coverage-v8`：按需生成覆盖率报告，不配置阈值。
- `@tauri-apps/api/mocks`：使用现有 Tauri API 包提供的 mock 能力拦截前端 IPC。

依赖安装时使用当时与 Node 24、Vite 8 和 React 19 兼容的当前稳定版本，并由 `pnpm-lock.yaml` 锁定精确版本。设计阶段核实的当前版本为 Vitest 5.0.0、React Testing Library 16.3.3、user-event 14.6.7、jest-dom 7.0.1、jsdom 30.0.1 和 coverage-v8 5.0.0。

### Rust

使用 Rust 内置测试体系和 `cargo test`：

- 与实现同文件的 `#[cfg(test)]` 模块测试私有纯函数和命令逻辑。
- 后续跨模块行为可放入 `src-tauri/tests/` 集成测试。
- Tauri 命令保持为薄适配层；文件、网络或状态逻辑出现后，再拆分为可直接测试的服务或纯函数。

第一阶段不引入 `cargo-nextest`、`mockall` 或其他 Rust 测试依赖。当前只有一个 crate 和极少测试，额外运行器与抽象不会带来足够收益。

## 不采用的方案

### Vitest Browser Mode

Browser Mode 能在真实浏览器中执行组件测试，但需要额外浏览器 provider，启动和持续集成成本更高，而且仍不代表 Tauri WebView 运行时。第一阶段选择 jsdom；只有出现依赖真实布局、浏览器 API 或 jsdom 无法可靠模拟的行为时再重新评估。

### Jest

Jest 生态成熟，但需要为当前 Vite、ESM 和 TypeScript 工程维护额外转换配置。Vitest 能直接复用 Vite 解析和插件链路，因此更适合当前项目。

### 桌面端 E2E

第一阶段不加入 Playwright、WebdriverIO、`tauri-driver` 或真实打包应用测试。真实桌面 E2E 应在出现首个关键完整业务流程后单独设计，届时优先评估 Tauri 官方推荐的 WebdriverIO Tauri service。

## 配置结构

在现有 `vite.config.ts` 中增加 `test` 配置，共用 React 插件、Tailwind 插件和 `@` 路径别名，避免维护第二套 Vite 配置。

Vitest 使用以下约束：

- `environment: "jsdom"`。
- 测试文件匹配 `src/**/*.test.ts` 和 `src/**/*.test.tsx`。
- 不启用全局测试 API；测试显式导入 `describe`、`test`、`expect` 等符号。
- `setupFiles` 指向 `src/test/setup.ts`。
- 覆盖率 provider 使用 V8，输出终端摘要和 HTML 报告，不配置任何阈值。

`src/test/setup.ts` 负责：

- 加载 `@testing-library/jest-dom/vitest`。
- 在每个测试后执行 React Testing Library cleanup。
- 清理 Tauri mock，防止测试之间共享 IPC 状态。

## 测试组织

测试与业务源码就近放置：

```text
src/
├── App.tsx
├── App.test.tsx
└── test/
    └── setup.ts

src-tauri/src/
└── lib.rs                # 文件内 #[cfg(test)] 模块
```

不为 shadcn 生成的 `src/components/ui/*` 基础组件逐个编写测试。项目只验证 Feed Forge 对这些组件的组合、状态变化和业务交互，避免重复测试上游组件实现。

## 首批前端测试

`src/App.test.tsx` 覆盖以下行为：

1. 页面初始状态展示标题、带可访问名称的姓名输入框、提交按钮和初始提示。
2. 用户输入姓名并提交后，IPC 收到命令 `greet` 和参数 `{ name }`。
3. IPC 成功返回时，状态区域展示返回的欢迎文本。
4. IPC 抛出异常时，状态区域展示固定错误 `Could not reach the Feed Forge desktop runtime.`，不暴露内部异常内容。

测试通过角色、标签和可见文本查询元素，不依赖 CSS 类名、React state、组件实例或大面积 snapshot。异步状态使用 `findBy*`、`waitFor` 或异步语义断言等待，不使用固定延时。

## 首批 Rust 测试

在 `src-tauri/src/lib.rs` 中增加内部测试模块，直接验证 `greet` 对代表性姓名生成预期欢迎文本。

当前 `greet` 不执行外部操作，可直接作为纯函数测试，不需要启动 Tauri runtime。只有未来需要验证命令注册、managed state 或 runtime 事件时，才考虑 `tauri::test::mock_builder`。

## IPC mock 与隔离

前端测试通过 `mockIPC` 设置单个测试所需的命令处理行为。处理器必须显式检查命令名和参数，避免一个宽泛 mock 掩盖错误的 IPC 契约。

每个测试结束后调用 `clearMocks`，测试之间不得复用返回值、调用计数或事件监听器。mock 代码只存在于测试文件和测试 setup 中，不能被生产入口导入。

## 包脚本

在 `package.json` 中提供：

- `test`：单次执行前端测试，适合 CI。
- `test:watch`：监听模式，适合本地开发。
- `test:coverage`：单次执行并生成 V8 覆盖率报告。
- `test:rust`：对 `src-tauri/Cargo.toml` 执行 `cargo test`。
- `test:all`：顺序执行前端和 Rust 测试。

构建脚本保持原有职责，不把测试隐式塞入 `build`；CI 或提交验证显式调用 `test:all` 和 `build`，让失败来源清晰。

## 覆盖率策略

第一阶段生成覆盖率报告但不设置语句、分支、函数或行覆盖率阈值。评审关注关键行为是否有测试，而不是追求数字。

业务模块数量和测试基线稳定后，再根据实际覆盖率分布决定阈值。届时应优先对项目自有业务代码设要求，不用生成的 shadcn 基础组件稀释或抬高指标。

## 错误处理与失败诊断

- 前端测试失败应显示用户行为、可访问查询和最终 DOM，而不是内部实现细节。
- IPC mock 遇到未声明命令时应失败，防止拼写错误或参数漂移静默通过。
- Rust 测试直接断言领域输出；未来可失败操作应使用结构化错误并分别覆盖成功和失败路径。
- 前端、Rust、覆盖率和构建命令保持独立，便于快速定位失败层次。

## 实施范围

预计新增或修改：

```text
package.json
pnpm-lock.yaml
vite.config.ts
src/test/setup.ts
src/App.test.tsx
src-tauri/src/lib.rs
```

第一阶段不新增 CI 配置、E2E 目录、浏览器二进制、Rust dev-dependencies 或生产依赖。

## 验收标准

1. `pnpm test` 通过全部前端测试，且命令执行后退出。
2. `pnpm test:coverage` 成功生成覆盖率摘要和 HTML 报告，不因百分比阻断。
3. `pnpm test:rust` 通过全部 Rust 测试。
4. `pnpm test:all` 能顺序完成前端与 Rust 测试。
5. `pnpm build` 通过 TypeScript 和 Vite 生产构建。
6. `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
7. 测试证明 `greet` 的 IPC 命令名、参数、成功返回和失败提示契约。
8. 不存在 Playwright、WebdriverIO、`cargo-nextest` 或硬性覆盖率阈值。

## 后续升级条件

本设计形成时的升级方向已迁移到 [`docs/testing-strategy.md`](../../testing-strategy.md) 的“未来路线图”。后续状态、触发条件和选型结论只在该文档维护，避免历史设计与当前策略产生分歧。
