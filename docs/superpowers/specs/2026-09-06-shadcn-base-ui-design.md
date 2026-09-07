# Feed Forge shadcn/ui + Base UI 接入设计

## 目标

在现有 Tauri v2、React、TypeScript 和 Vite 最小骨架中接入当前 shadcn/ui 工具链，并明确使用 Base UI 作为无样式组件基座。接入后，欢迎页表单实际使用生成到仓库内的 shadcn 组件，以验证配置、样式和 Base UI 依赖均已生效。

本设计只覆盖前端设计系统基础，不改变现有 Rust 命令、Tauri Capability、应用标识或构建连接方式。

## 与原骨架设计的关系

本设计仅替代原设计中“不引入 UI 组件库”的限制。以下约束继续有效：

- 应用名称保持 `Feed Forge`。
- Bundle Identifier 保持 `com.feedforge.app`。
- 前端继续位于根目录 `src/`，Tauri Rust 工程继续位于 `src-tauri/`。
- 保留现有 `greet` IPC 示例及其前端错误处理。
- 不引入路由、状态管理、测试框架、业务模块或额外 Tauri 插件。
- `mise.toml` 继续声明 Node 24 与 pnpm 11。

## 方案

使用官方 shadcn CLI 初始化现有 Vite 项目，选择：

- 模板：`vite`
- 组件基座：`base`，即 Base UI
- 视觉预设：`nova`（与 `base` 组合后形成 Base UI + Nova 配置）
- 主题方式：CSS variables
- Tailwind：Tailwind CSS v4 与 `@tailwindcss/vite`
- 导入别名：`@/*` 映射到 `src/*`
- 按钮指针样式：启用

现有 Vite 项目先安装并注册 Tailwind CSS v4：

```powershell
mise exec -- pnpm add -D tailwindcss @tailwindcss/vite
```

`vite.config.ts` 注册 `@tailwindcss/vite`，`src/index.css` 先包含 `@import "tailwindcss";`，且由 `src/main.tsx` 导入。随后使用的初始化命令为：

```powershell
mise exec -- pnpm dlx shadcn@latest init --template vite --base base --preset nova --yes --no-monorepo --pointer
```

组件由 CLI 生成，不手工复制远端注册表源码：

```powershell
mise exec -- pnpm dlx shadcn@latest add button input field --yes
```

选择官方 CLI 而非手工拼装，是为了让 `components.json`、Tailwind v4、Base UI 依赖、工具函数和组件源码保持同一版注册表契约。选择实际迁移欢迎页而非只初始化配置，是为了用源码导入和运行构建证明接入有效。

## 文件与职责

预计新增或修改以下前端文件：

```text
feed-forge/
├── components.json              # shadcn CLI、注册表、样式与路径配置
├── package.json                 # Base UI、Tailwind 和组件工具依赖
├── pnpm-lock.yaml               # 精确依赖锁定
├── tsconfig.json                # @/* TypeScript 路径别名
├── vite.config.ts               # @ 别名与 Tailwind Vite 插件
└── src/
    ├── App.tsx                  # 使用 shadcn 表单组件的欢迎页
    ├── index.css                # Tailwind 导入、shadcn 主题变量与页面基础样式
    ├── main.tsx                 # 导入全局样式
    ├── components/ui/
    │   ├── button.tsx           # shadcn Button，Base UI 基座
    │   ├── field.tsx            # shadcn Field 组合
    │   ├── input.tsx            # shadcn Input
    │   ├── label.tsx            # Field 所需的标签组件
    │   └── separator.tsx        # Field 所需的 Base UI 分隔组件
    └── lib/utils.ts             # className 合并工具
```

现有 `src/App.css` 的页面样式迁移为 Tailwind utilities 与 `src/index.css` 中的主题基础样式后删除，避免两套样式来源并存。`src-tauri/` 不作功能性修改。

## 组件与数据流

欢迎页继续由 `App` 持有 `name` 和 `message` 两个本地状态。表单使用生成的 `Field`、`Input` 和 `Button`：

1. 用户在 `Input` 中更新 `name`。
2. 提交表单时阻止浏览器默认提交。
3. 前端继续调用 `invoke<string>("greet", { name })`。
4. 成功时将 Rust 返回字符串写入状态区域。
5. 失败时继续显示固定、简短且不泄漏内部错误的提示。

Base UI 只承担组件 primitive 和可访问交互语义；业务状态、IPC 调用和错误边界仍由 `App` 控制。此次不增加表单库或 schema 验证库。

## 样式与可访问性

保留现有 Feed Forge 视觉方向：冷灰页面、白色面板、深蓝主操作和熔炉橙强调。颜色改由 shadcn CSS variables 与 Tailwind utilities 表达，组件的 hover、focus-visible、disabled 和 invalid 状态沿用生成组件的标准实现。

表单标签与输入通过 `Field` 组合保持关联，结果区域保留 `role="status"`。布局继续支持窄窗口，不增加动画、外部字体、图标包或装饰资源。

## 依赖边界

接入完成后应满足：

- 存在直接依赖 `@base-ui/react`。
- 不存在 `@radix-ui/*` 直接依赖或生成源码导入。
- 存在 Tailwind CSS v4 和 `@tailwindcss/vite`。
- 仅保留生成组件实际需要的 class 合并、variant 和动画依赖。
- 不添加路由、状态管理、表单管理、测试框架或额外 Tauri 插件。

## 验证

本次属于 CLI 生成组件与配置接入，沿用原骨架明确批准的不新增测试框架约束。完成后执行：

1. `mise exec -- pnpm install --frozen-lockfile`，验证锁文件一致。
2. `mise exec -- pnpm build`，验证 TypeScript、Tailwind、shadcn 组件和 Vite 生产构建。
3. `cargo check --manifest-path src-tauri/Cargo.toml`，确认前端接入未破坏 Tauri Rust 工程。
4. `mise exec -- pnpm tauri info`，确认 Tauri 仍识别 React/Vite 配置且没有新增插件。
5. 审计 `components.json`、`package.json` 与生成组件导入，确认基座为 Base UI、没有 Radix UI。
6. 启动本地 Vite 页面，检查欢迎页布局、键盘焦点和浏览器环境下的 IPC 失败提示；若会话没有可用浏览器控制服务，则明确记录该环境限制。

## 非目标

- 不批量添加未使用的 shadcn 组件；保留 `field` 注册表项自动带入的 `label` 和 `separator`。
- 不增加暗色模式切换器或主题管理器。
- 不定制或维护私有 shadcn registry。
- 不重构 Tauri 命令和 Rust 模块。
- 不实现业务表单校验或持久化。
