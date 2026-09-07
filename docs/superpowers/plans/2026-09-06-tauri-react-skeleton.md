# Feed Forge Tauri v2 Minimal Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable and buildable Tauri v2 desktop application skeleton with a React, TypeScript, and Vite frontend managed by pnpm.

**Architecture:** Use the official `create-tauri-app` React TypeScript template to establish compatible frontend and Rust dependencies. Keep React in the repository-root `src/`, Tauri in `src-tauri/`, expose one synchronous `greet(name: &str) -> String` command, and grant only the main window's core capability.

**Tech Stack:** Node 24, pnpm 11, React, TypeScript, Vite, Rust, Tauri v2

**Spec:** `docs/superpowers/specs/2026-09-02-tauri-react-skeleton-design.md`

## Global Constraints

- Product name is exactly `Feed Forge`.
- Bundle identifier is exactly `com.feedforge.app`.
- Preserve the existing `mise.toml` declaring Node 24 and pnpm 11.
- Do not add routing, state management, a UI component library, a test framework, business modules, or extra Tauri plugins.
- Generated code and configuration use the approved TDD exception; verification is the build/configuration sequence required by the spec.
- The current workspace has no Git metadata, so this plan contains no commit steps.

---

### Task 1: Generate and integrate the official skeleton

**Files:**
- Create: `.gitignore`
- Create: `index.html`
- Create: `package.json`
- Create: `src/`
- Create: `src-tauri/`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`

**Interfaces:**
- Consumes: `mise.toml` tool versions and official `create-tauri-app` 4.7.4 CLI.
- Produces: a React TypeScript Vite package and Tauri v2 Rust crate rooted in this workspace.

- [x] **Step 1: Generate outside the repository root**

Run:

```powershell
mise exec -- pnpm create tauri-app .tauri-scaffold --manager pnpm --template react-ts --identifier com.feedforge.app --tauri-version 2 --yes
```

Expected: `.tauri-scaffold/` contains the official React TypeScript Tauri v2 template without touching existing repository files.

- [x] **Step 2: Copy generated application files into the root**

Copy only the generated application files and directories needed by the template. Preserve `mise.toml`, `docs/`, `.agents/`, and `skills-lock.json` byte-for-byte.

- [x] **Step 3: Remove the temporary scaffold directory**

Verify that the resolved `.tauri-scaffold` path is inside this workspace, then remove only that directory.

- [x] **Step 4: Check the integrated structure**

Run:

```powershell
@('src','src-tauri','package.json','index.html','tsconfig.json','vite.config.ts') | ForEach-Object { "$_=$(Test-Path $_)" }
```

Expected: every path reports `True`.

### Task 2: Reduce the template to the documented minimal application

**Files:**
- Modify: `package.json`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/main.tsx`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: React `createRoot`, Tauri `invoke`, and the generated Tauri builder.
- Produces: Rust command `greet(name: &str) -> String` registered as `greet`; React calls `invoke<string>("greet", { name })` and displays success or failure text.

- [x] **Step 1: Remove generated optional plugin dependencies**

Delete `@tauri-apps/plugin-opener`, `tauri-plugin-opener`, the Rust `.plugin(tauri_plugin_opener::init())` registration, and `opener:default` permission if present. Keep only React, Tauri core API/CLI, Vite, and TypeScript dependencies required by the skeleton.

- [x] **Step 2: Configure application metadata and build hooks**

Set `src-tauri/tauri.conf.json` to include:

```json
{
  "productName": "Feed Forge",
  "identifier": "com.feedforge.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  }
}
```

Retain the generated schema/version, window label `main`, window title `Feed Forge`, sensible generated window dimensions, and bundle icon configuration.

- [x] **Step 3: Implement and register the minimal Rust command**

Use this command and builder shape in `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! Welcome to Feed Forge.")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running Feed Forge");
}
```

Keep `src-tauri/src/main.rs` as a desktop-only call to `feed_forge_lib::run()`.

- [x] **Step 4: Restrict the main-window capability**

Set `src-tauri/capabilities/default.json` to the generated schema plus:

```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

- [x] **Step 5: Implement the React welcome and IPC flow**

Use `createRoot(document.getElementById("root")!)` in `src/main.tsx`. In `src/App.tsx`, keep a controlled name input and submit button; call `invoke<string>("greet", { name })` inside `try/catch`, display the returned greeting, and display a short fixed failure message when invocation rejects.

- [x] **Step 6: Keep styling minimal and dependency-free**

Use plain CSS for a centered readable page, form controls, focus state, and status message. Do not add assets or libraries solely for decoration.

### Task 3: Install and verify the complete skeleton

**Files:**
- Create: `pnpm-lock.yaml`
- Create: `dist/` as ignored build output
- Modify: generated Cargo lock/build artifacts only as normal tool output

**Interfaces:**
- Consumes: completed frontend and Tauri configuration.
- Produces: fresh dependency locks and build/check evidence for every verification required by the spec.

- [x] **Step 1: Install frontend dependencies**

Run:

```powershell
mise exec -- pnpm install
```

Expected: exit code 0 and a root `pnpm-lock.yaml`.

- [x] **Step 2: Build the React/Vite frontend**

Run:

```powershell
mise exec -- pnpm build
```

Expected: exit code 0 and Vite production output in `dist/`.

- [x] **Step 3: Check the Rust application**

Run:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: exit code 0 with the `feed-forge` crate checked successfully.

- [x] **Step 4: Inspect the Tauri environment and project configuration**

Run:

```powershell
mise exec -- pnpm tauri info
```

Expected: exit code 0 and output recognizing Tauri v2, the React/Vite frontend, Rust, Node, and pnpm.

- [x] **Step 5: Audit the final scope**

Confirm `productName`, identifier, build hooks, main-window capability, registered `greet` command, frontend error handling, required path set, ignored build outputs, and the absence of routing, state libraries, UI libraries, test frameworks, and optional Tauri plugins.
