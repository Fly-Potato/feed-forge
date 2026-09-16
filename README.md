<h1 align="center">Feed Forge</h1>

<p align="center">
  一个 Windows 优先、数据保存在本机的 RSS/Atom 桌面阅读器。
</p>

Feed Forge 使用 Tauri v2、React 和 Rust 构建。它将订阅源、文章以及阅读状态保存在本地 SQLite 数据库中，不依赖账号或云端服务。

## 功能

- 添加和浏览 RSS/Atom 订阅源
- 手动刷新单个订阅源或全部订阅源
- 按全部、未读和收藏筛选文章
- 阅读经过清理的文章内容，并切换已读与收藏状态
- 导入和导出 OPML 订阅列表
- 使用 ETag 和 Last-Modified 减少重复下载
- 在本地持久化订阅、文章及阅读状态

> [!NOTE]
> 项目当前处于 MVP 阶段，以 Windows 桌面环境为主要开发和验证目标。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 桌面运行时 | Tauri v2 |
| 前端 | React 19、TypeScript、Vite |
| UI | Tailwind CSS、shadcn、Base UI |
| Rust 后端 | Tokio、Reqwest、quick-xml |
| 数据存储 | SQLite、SQLx |
| 测试 | Vitest、React Testing Library、Rust 内置测试框架 |

前端通过 Tauri IPC 调用 Rust command。Rust 负责订阅源下载、RSS/Atom 解析、同步任务和 SQLite 持久化；React 负责订阅列表、文章列表与阅读界面。

## 环境要求

- Node.js 24
- pnpm 11
- Rust stable 工具链
- Tauri v2 对应平台的系统依赖

Windows 开发环境需要 Microsoft C++ Build Tools 的“使用 C++ 的桌面开发”工作负载和 WebView2。其他平台请参阅 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)。

## 快速开始

安装依赖：

```powershell
pnpm install
```

启动桌面开发环境：

```powershell
pnpm dev:desktop
```

构建桌面安装包：

```powershell
pnpm build:desktop
```

Tauri 会自动调用 `pnpm dev` 或 `pnpm build` 完成前端开发服务器启动和生产构建。

## 开发与验证

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Vite 前端开发服务器 |
| `pnpm build` | 执行 TypeScript 检查并构建前端 |
| `pnpm dev:desktop` | 使用独立开发标识启动 Tauri 桌面应用 |
| `pnpm build:desktop` | 构建使用生产标识的桌面安装包 |
| `pnpm test` | 运行前端测试 |
| `pnpm test:watch` | 以监听模式运行前端测试 |
| `pnpm test:coverage` | 运行前端测试并生成覆盖率报告 |
| `pnpm test:rust` | 运行 Rust 测试 |
| `pnpm test:all` | 依次运行前端和 Rust 测试 |
| `pnpm check:release-version vX.Y.Z` | 校验发布标签与三处应用版本一致 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 检查 Rust 代码 |

测试分层、约束和验证范围详见 [测试策略](./docs/testing-strategy.md)。

## 项目结构

```text
feed-forge/
├── src/
│   ├── components/ui/     # 通用 UI 基础组件
│   ├── lib/               # 前端共享能力
│   └── modules/           # feeds、articles、sync、opml 等业务模块
├── src-tauri/
│   ├── capabilities/      # Tauri 权限配置
│   ├── migrations/        # SQLite 数据库迁移
│   └── src/               # Rust command、service 与持久化代码
├── docs/                  # 测试策略及历史设计文档
└── package.json           # pnpm 脚本与前端依赖
```

业务模块按领域组织。前端模块将 IPC 调用集中在各自的 `ipc.ts` 中，Rust 模块则将 Tauri command 保持为薄适配层，并把业务逻辑放入 service 和 repository。

## 本地数据

首次启动时，Feed Forge 会在 Tauri 应用数据目录中创建 `feed-forge.db`。数据库使用 SQLite WAL 模式，并在启动阶段自动执行迁移。

开发运行使用 `com.feedforge.app.dev`，生产构建使用 `com.feedforge.app`。Tauri 会据此选择不同的应用数据目录，因此两种运行方式不会共享数据库、订阅、文章、阅读状态或用户设置。

> [!IMPORTANT]
> Feed Forge 当前没有账号系统、云端数据库或多设备同步。删除应用数据目录会同时删除本机的订阅、文章和阅读状态。

## 发布与自动更新

正式版本通过 GitHub Release 发布，首期只构建 Windows x64 NSIS 安装包。推送 `vX.Y.Z` 标签会触发 [Release 工作流](./.github/workflows/release.yml)，先执行完整验证，再创建草稿 Release；草稿不会自动向用户开放。

发布前需要同步以下三个版本号，并确保它们与标签去掉 `v` 后完全一致：

- `package.json` 的 `version`
- `src-tauri/Cargo.toml` 的 `[package].version`
- `src-tauri/tauri.conf.json` 的 `version`

可以在创建标签前本地检查：

```powershell
pnpm check:release-version v0.1.0
```

仓库的 Actions Secrets 需要配置：

- `TAURI_SIGNING_PRIVATE_KEY`：Tauri updater 私钥全文。私钥必须长期保存在仓库外，不能提交到 Git。
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：生成私钥时设置的密码；无密码私钥可留空。

推荐发布流程：

1. 同步三处版本号，运行测试、前端构建、Rust 检查和版本校验。
2. 创建并推送对应的 `vX.Y.Z` 标签。
3. 等待 Release 工作流生成草稿，检查 NSIS 安装包、签名文件和 `latest.json`。
4. 在干净的 Windows 环境验证安装、启动和基本阅读功能后，再发布草稿。
5. 首次启用自动更新以及后续每个重要版本，都从已发布的旧版本实际升级到新版本，验证下载、签名校验、安装和重启完整链路。

开发配置 `src-tauri/tauri.dev.conf.json` 只用于本地数据隔离，不应合并到生产打包参数或 Release 工作流。自动更新使用 GitHub Release 中的 `latest.json`，安装前始终需要用户确认。
