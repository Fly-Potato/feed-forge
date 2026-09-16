# GitHub Release 与自动更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Feed Forge 增加 Windows x64 GitHub Release 流水线、签名更新产物，以及启动自动检查和设置内手动检查更新的用户体验。

**Architecture:** 前端新增独立 `updater` 业务切片，由 service 封装 Tauri 插件、hook 管理状态，提示组件和设置页只消费稳定状态接口。Rust 仅注册官方 updater/process 插件；GitHub Actions 将普通 CI 与带写权限的 Tag 发布分离，Release 始终先生成草稿。

**Tech Stack:** Tauri v2、React 19、TypeScript 6、Vitest 5、pnpm 11、GitHub Actions、`tauri-apps/tauri-action@v1`

**Spec:** 用户于 2026-09-15 在当前会话确认的 Windows 优先 GitHub Release 与自动更新方案。

## Global Constraints

- 首期只发布 Windows x64 NSIS，不启用 macOS 或 Linux 发布矩阵。
- 生产 identifier 保持 `com.feedforge.app`；开发命令继续合并 `src-tauri/tauri.dev.conf.json`。
- 自动检查不得阻塞主界面；没有更新和检查失败都不得影响阅读器使用。
- 下载和安装必须由用户确认；不实现强制更新、静默安装、多通道或降级。
- updater 私钥不得进入仓库；公钥写入 `tauri.conf.json`，私钥通过 GitHub Actions Secret 提供。
- 普通 CI 使用只读权限；只有 Tag 发布 Job 使用 `contents: write`。
- 本次不提交、不推送、不创建 GitHub Release，也不修改无关的订阅管理基线失败。

---

### Task 1: 前端更新状态与用户交互

**Files:**
- Create: `src/modules/updater/types.ts`
- Create: `src/modules/updater/service.ts`
- Create: `src/modules/updater/hooks/useUpdater.ts`
- Create: `src/modules/updater/components/UpdatePrompt.tsx`
- Create: `src/modules/updater/components/UpdatePanel.tsx`
- Create: `src/modules/updater/__tests__/service.test.ts`
- Create: `src/modules/updater/__tests__/useUpdater.test.tsx`
- Create: `src/modules/updater/__tests__/UpdatePrompt.test.tsx`
- Create: `src/modules/updater/__tests__/UpdatePanel.test.tsx`
- Create: `src/modules/settings/components/SettingsDialog.test.tsx`
- Modify: `src/modules/settings/components/SettingsDialog.tsx`
- Modify: `src/modules/reader/pages/ReaderPage.tsx`

**Interfaces:**
- `checkForUpdate(): Promise<AvailableUpdate | null>` 封装 `@tauri-apps/plugin-updater`。
- `getCurrentVersion(): Promise<string>` 封装 `@tauri-apps/api/app`。
- `AvailableUpdate.install(onProgress): Promise<void>` 封装下载、签名验证、安装和 relaunch。
- `useUpdater()` 产生 `currentVersion`、`status`、`update`、`progress`、`error`、`promptOpen`、`check`、`install`、`dismissPrompt`。

- [x] **Step 1: 编写 service 失败测试**

  Mock Tauri updater/process/app API，断言无更新返回 `null`，有更新时保留版本和说明，安装进度换算成百分比且安装后调用 `relaunch()`。

- [x] **Step 2: 运行 service 测试确认因模块不存在而失败**

  Run: `pnpm test src/modules/updater/__tests__/service.test.ts`
  Expected: FAIL，原因是 `../service` 尚不存在。

- [x] **Step 3: 实现最小 service 与类型**

  `AvailableUpdate` 只暴露 `version`、`notes` 和 `install`；下载回调仅处理 `Started`、`Progress`、`Finished`，未知事件不改变状态。

- [x] **Step 4: 运行 service 测试至通过**

  Run: `pnpm test src/modules/updater/__tests__/service.test.ts`
  Expected: PASS。

- [x] **Step 5: 编写 hook 与提示组件失败测试**

  断言生产环境挂载后自动检查一次；发现更新时打开提示；“稍后”关闭提示；“下载并安装”显示忙碌状态；失败显示安全中文错误；手动检查可报告“已是最新版本”。

- [x] **Step 6: 运行 hook/组件测试确认按预期失败**

  Run: `pnpm test src/modules/updater/__tests__/useUpdater.test.tsx src/modules/updater/__tests__/UpdatePrompt.test.tsx src/modules/updater/__tests__/UpdatePanel.test.tsx`
  Expected: FAIL，原因是 hook 和组件尚不存在。

- [x] **Step 7: 实现 hook、提示组件和页面接线**

  `ReaderPage` 只创建一次 updater controller；`UpdatePrompt` 负责自动提示；`SettingsDialog` 增加“关于”标签，显示当前版本、检查状态和手动操作，不直接调用 Tauri API。

- [x] **Step 8: 运行 updater 与 ReaderPage 相关测试**

  Run: `pnpm test src/modules/updater src/modules/reader/pages/ReaderPage.test.tsx`
  Expected: 新增 updater 测试和 ReaderPage 测试全部 PASS。

### Task 2: Tauri 插件、权限与签名产物

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `.gitignore`

**Interfaces:**
- 前端只获得 `core:app:allow-version`、`updater:allow-check`、`updater:allow-download-and-install`、`process:allow-restart` 所需最小权限。
- updater endpoint 固定为 `https://github.com/Fly-Potato/feed-forge/releases/latest/download/latest.json`。

- [x] **Step 1: 安装成对的 JavaScript 与 Rust 插件依赖**

  Run: `pnpm add @tauri-apps/plugin-updater @tauri-apps/plugin-process`
  Run: `cargo add tauri-plugin-updater tauri-plugin-process --manifest-path src-tauri/Cargo.toml`
  Expected: manifests 与 lockfiles 记录当前兼容版本。

- [x] **Step 2: 注册插件并设置最小 capability**

  在 `lib.rs` 的 Builder 注册 updater/process；在 capability 中逐项添加版本读取、检查、下载安装和重启权限，不使用 wildcard 或整套默认权限。

- [x] **Step 3: 生成长期 updater 密钥并配置公钥**

  Run: `pnpm tauri signer generate -w C:\Users\Potato\.tauri\feed-forge.key`
  Expected: 私钥只写入用户目录，公钥内容写入 `tauri.conf.json`；任何仓库内临时密钥路径都加入 `.gitignore`。

- [x] **Step 4: 配置 Windows updater bundle**

  在 `tauri.conf.json` 设置 `bundle.targets` 为 `nsis`、`bundle.createUpdaterArtifacts` 为 `true`，并配置 updater 公钥、GitHub endpoint 和 Windows `passive` 安装模式。

- [x] **Step 5: 验证 Tauri 配置与编译**

  Run: `pnpm build`
  Run: `cargo check --manifest-path src-tauri/Cargo.toml`
  Expected: 两个命令退出码均为 0，生成 capability schema 可解析新增权限。

### Task 3: 普通 CI 与 Tag 发布流水线

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `scripts/check-release-version.mjs`
- Create: `scripts/check-release-version.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `pnpm check:release-version -- <tag>` 校验 `package.json`、`Cargo.toml`、`tauri.conf.json` 与 `vX.Y.Z` 标签一致。
- `ci.yml` 在 PR/main 上验证但不创建 Release。
- `release.yml` 只在 `v*` Tag 上构建 Windows x64 NSIS Draft Release。

- [x] **Step 1: 编写版本校验脚本失败测试**

  使用临时 fixture 覆盖版本一致、标签缺少 `v`、三处版本不一致和非法 SemVer；测试不得修改仓库 manifests。

- [x] **Step 2: 运行脚本测试确认因实现不存在而失败**

  Run: `node --test scripts/check-release-version.test.mjs`
  Expected: FAIL，原因是校验模块尚不存在。

- [x] **Step 3: 实现版本校验并接入 package script**

  脚本读取明确路径，错误时输出每个不一致来源并返回非零退出码；`package.json` 增加 `check:release-version`。

- [x] **Step 4: 运行版本测试至通过**

  Run: `node --test scripts/check-release-version.test.mjs`
  Expected: PASS。

- [x] **Step 5: 创建只读 CI 工作流**

  使用 Windows runner、Node 24、pnpm 11、Rust stable 与 Rust cache，执行 frozen install、`pnpm test:all`、`pnpm build`、Cargo check；不授予 `contents: write`。

- [x] **Step 6: 创建 Draft Release 工作流**

  Tag 触发后先执行版本校验和完整验证，再将 `TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 注入 `tauri-apps/tauri-action@v1`，使用 `v__VERSION__`、`releaseDraft: true`、`prerelease: false`。

- [x] **Step 7: 更新发布文档**

  README 记录 SemVer 同步、Tag 触发、所需 Secrets、Draft 验收、禁止合并开发配置，以及首次真实升级必须通过旧版本到新版本的人工 smoke。

- [x] **Step 8: 执行最终验证**

  Run: `pnpm test:all`
  Run: `pnpm build`
  Run: `cargo check --manifest-path src-tauri/Cargo.toml`
  Run: `node --test scripts/check-release-version.test.mjs`
  Run: `git diff --check`
  Expected: 本次新增测试、构建、Rust 检查、版本脚本和 diff 检查均通过；若既有订阅测试仍失败，单独记录其原始失败并证明 updater 定向测试通过。
