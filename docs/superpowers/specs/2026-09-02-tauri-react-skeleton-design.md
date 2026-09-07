# Feed Forge Tauri v2 最小骨架设计

## 目标

在仓库根目录初始化一个可运行、可构建的 Tauri v2 桌面应用骨架。前端使用 React、TypeScript 和 Vite，依赖由 pnpm 管理；Rust 负责 Tauri 桌面运行时。

## 范围

本次只建立最小工程基础：

- 应用名称为 `Feed Forge`。
- Bundle Identifier 为 `com.feedforge.app`。
- React 前端位于仓库根目录的 `src/`。
- Tauri Rust 工程位于 `src-tauri/`。
- 保留一个简单欢迎页面和一个最小 IPC 示例命令。
- 提供开发、前端构建和 Tauri 构建脚本。

不引入路由、状态管理、UI 组件库、测试框架、业务模块或额外 Tauri 插件。

## 初始化方式

使用官方 `create-tauri-app` 创建 React + TypeScript 模板，并选择 pnpm 作为包管理器。相比手工拼装或先创建 Vite 再执行 `tauri init`，官方脚手架能够保持 Tauri CLI、Rust crate、前端依赖和配置文件的兼容组合。

现有 `mise.toml` 继续作为 Node 24 与 pnpm 11 的工具链声明，不由脚手架覆盖。

## 目录与组件

```text
feed-forge/
├── src/                    # React + TypeScript 前端
├── src-tauri/
│   ├── capabilities/       # 主窗口最小权限
│   ├── src/
│   │   ├── lib.rs          # Tauri Builder 与命令注册
│   │   └── main.rs         # 桌面入口
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
└── mise.toml
```

前端通过 `react-dom/client` 的 `createRoot` 挂载应用。Tauri 的 `beforeDevCommand`、`beforeBuildCommand`、`devUrl` 和 `frontendDist` 分别连接 pnpm/Vite 的开发与生产构建流程。

## 数据流

普通页面渲染完全发生在 React 前端。示例交互通过 `@tauri-apps/api/core` 的 `invoke` 调用 Rust 端显式注册的 Tauri 命令，并将返回字符串显示到页面中。骨架不持久化数据，也不访问网络或文件系统。

## 权限与错误处理

`src-tauri/capabilities/default.json` 只关联主窗口并保留脚手架所需的最小核心权限。不会预先授予文件系统、网络、Shell、对话框等插件权限。

前端 IPC 调用使用 `try/catch` 展示简短失败信息；Rust 示例命令不执行易失败的外部操作。后续业务功能应按需增加插件、capability 和结构化错误类型。

## 验证

初始化完成后执行以下检查：

1. `mise exec -- pnpm install` 成功并生成 pnpm 锁文件。
2. `mise exec -- pnpm build` 完成 React/Vite 生产构建。
3. `cargo check --manifest-path src-tauri/Cargo.toml` 通过 Rust 编译检查。
4. `mise exec -- pnpm tauri info` 能读取当前 Tauri 环境与工程配置。

由于本次范围不引入测试框架，验证以官方脚手架的构建和配置检查为准。
