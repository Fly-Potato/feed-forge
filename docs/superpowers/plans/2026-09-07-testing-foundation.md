# Feed Forge Testing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fast frontend component/IPC tests and Rust command tests to the existing Feed Forge Tauri application without introducing desktop E2E infrastructure or coverage gates.

**Architecture:** Vitest runs React Testing Library tests in jsdom and uses Tauri's built-in `mockIPC` bridge to verify the frontend command contract. Rust keeps the existing command as a directly testable pure function and uses the standard `cargo test` harness; package scripts expose each layer separately and together.

**Tech Stack:** Node 24, pnpm 11, Vite 8, React 19, TypeScript 6, Vitest 5, React Testing Library 16, jsdom 30, Tauri v2, Rust built-in test harness

**Spec:** `docs/superpowers/specs/2026-09-07-testing-foundation-design.md`

## Global Constraints

- Use Vitest 5 with jsdom, React Testing Library, user-event, jest-dom, and `@vitest/coverage-v8`.
- Use `@tauri-apps/api/mocks`; do not add a second IPC mocking implementation.
- Use Rust's built-in `cargo test`; do not add `cargo-nextest`, `mockall`, or Rust dev-dependencies.
- Generate terminal and HTML coverage reports without statement, branch, function, or line thresholds.
- Do not add Playwright, WebdriverIO, `tauri-driver`, browser binaries, or desktop E2E tests.
- Do not add CI configuration or modify production behavior.
- Do not test generated `src/components/ui/*` primitives independently; test Feed Forge behavior through `App`.
- Keep Vitest globals disabled and import test APIs explicitly.

---

### Task 1: Add the frontend test harness and IPC behavior tests

**Files:**
- Modify: `package.json:6-31`
- Modify: `pnpm-lock.yaml`
- Modify: `vite.config.ts:1-39`
- Modify: `.gitignore:10-13`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `App` as the default export from `src/App.tsx`; `invoke<string>("greet", { name })` from `@tauri-apps/api/core`.
- Produces: `pnpm test`, `pnpm test:watch`, and `pnpm test:coverage`; shared setup at `src/test/setup.ts`; four frontend behavior tests.

- [ ] **Step 1: Record the missing-harness baseline**

Run:

```powershell
pnpm test
```

Expected: FAIL with `ERR_PNPM_NO_SCRIPT` or an equivalent missing `test` script message. This is the red state for the test-infrastructure change.

- [ ] **Step 2: Install only the approved frontend test dependencies**

Run:

```powershell
pnpm add -D vitest@^5.0.0 @vitest/coverage-v8@^5.0.0 jsdom@^30.0.1 @testing-library/react@^16.3.3 @testing-library/dom@^10 @testing-library/user-event@^14.6.7 @testing-library/jest-dom@^7.0.1
```

Expected: `package.json` and `pnpm-lock.yaml` change; no production dependency is added. Confirm the resolved versions remain compatible with Node 24.18, Vite 8, and React 19.

- [ ] **Step 3: Add the frontend test scripts**

Update the `scripts` object in `package.json` to include the following entries while preserving the existing scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "preview": "vite preview",
    "tauri": "tauri"
  }
}
```

- [ ] **Step 4: Configure Vitest through the existing Vite config**

Change the `defineConfig` import in `vite.config.ts` and add the `test` block without changing the existing plugins, alias, or Tauri development server settings:

```typescript
import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

- [ ] **Step 5: Ignore generated coverage output**

Add `coverage` beside the existing build-output entries in `.gitignore`:

```gitignore
node_modules
dist
dist-ssr
coverage
*.local
```

- [ ] **Step 6: Add shared DOM and Tauri mock cleanup**

Create `src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  clearMocks();
});
```

- [ ] **Step 7: Add the four App behavior tests**

Create `src/App.test.tsx`:

```tsx
import { mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import App from "./App";

describe("App", () => {
  test("renders the greeting form with accessible controls", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Welcome to Feed Forge" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send greeting" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enter a name to verify the desktop bridge.",
    );
  });

  test("sends the greet command with the entered name", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      if (command === "greet") {
        return "Hello, Ada! Welcome to Feed Forge.";
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");
    await user.click(screen.getByRole("button", { name: "Send greeting" }));

    await waitFor(() => {
      expect(calls).toEqual([["greet", { name: "Ada" }]]);
    });
  });

  test("shows the greeting returned by the desktop command", async () => {
    mockIPC((command) => {
      if (command === "greet") {
        return "Hello, Ada! Welcome to Feed Forge.";
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");
    await user.click(screen.getByRole("button", { name: "Send greeting" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Hello, Ada! Welcome to Feed Forge.",
      );
    });
  });

  test("shows a fixed error without leaking the IPC failure", async () => {
    mockIPC((command) => {
      if (command === "greet") {
        throw new Error("sensitive desktop failure");
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Send greeting" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Could not reach the Feed Forge desktop runtime.",
      );
    });
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "sensitive desktop failure",
    );
  });
});
```

- [ ] **Step 8: Run the frontend tests and inspect the result**

Run:

```powershell
pnpm test
```

Expected: PASS with 1 test file and 4 tests. If the IPC parameter test fails, inspect the actual `mockIPC` payload and correct the test only if it reflects the installed Tauri v2 API contract; do not weaken the command-name assertion.

- [ ] **Step 9: Verify coverage generation and ignore behavior**

Run:

```powershell
pnpm test:coverage
```

Expected: PASS, terminal coverage summary is printed, and `coverage/index.html` exists.

Run:

```powershell
git status --short
```

Expected: `coverage/` does not appear.

- [ ] **Step 10: Verify the production frontend build**

Run:

```powershell
pnpm build
```

Expected: PASS with TypeScript compilation and Vite production output.

- [ ] **Step 11: Review and commit the frontend test foundation**

Run:

```powershell
git diff --check
git add -- package.json pnpm-lock.yaml vite.config.ts .gitignore src/test/setup.ts src/App.test.tsx
git diff --cached --name-status
git diff --cached --check
git commit -m "test(frontend): 接入 Vitest 测试基础"
```

Expected: the staged list contains exactly the six Task 1 paths before the commit.

---

### Task 2: Add the Rust command test and unified test scripts

**Files:**
- Modify: `src-tauri/src/lib.rs:1-12`
- Modify: `package.json:6-14`
- Test: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: private function `fn greet(name: &str) -> String`; Task 1's `pnpm test` script.
- Produces: Rust test `tests::greet_returns_welcome_message`; `pnpm test:rust`; `pnpm test:all`.

- [ ] **Step 1: Record the current Rust test baseline**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: PASS with no project-authored Rust tests. Record the reported test count before adding the characterization test.

- [ ] **Step 2: Add a direct characterization test for the Rust command**

Append this internal module to `src-tauri/src/lib.rs` after `run`:

```rust
#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greet_returns_welcome_message() {
        assert_eq!(
            greet("Ada"),
            "Hello, Ada! Welcome to Feed Forge."
        );
    }
}
```

No production refactor is required: `greet` is already a private pure function, and an internal test module can call it directly.

- [ ] **Step 3: Run the focused Rust test**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml greet_returns_welcome_message
```

Expected: PASS with 1 matching test.

- [ ] **Step 4: Add Rust and aggregate package scripts**

Add these entries to the existing `scripts` object in `package.json`:

```json
{
  "scripts": {
    "test:rust": "cargo test --manifest-path src-tauri/Cargo.toml",
    "test:all": "pnpm test && pnpm test:rust"
  }
}
```

Keep the Task 1 scripts and all pre-existing scripts unchanged.

- [ ] **Step 5: Verify both package-level test commands**

Run:

```powershell
pnpm test:rust
```

Expected: PASS with the Rust greeting test.

Run:

```powershell
pnpm test:all
```

Expected: PASS with 4 frontend tests followed by 1 Rust test.

- [ ] **Step 6: Run the complete acceptance suite**

Run each command independently so failures remain attributable to one layer:

```powershell
pnpm test
pnpm test:coverage
pnpm test:rust
pnpm test:all
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: every command exits with code 0; coverage prints a report without enforcing percentages; the frontend suite reports 4 tests and the Rust suite reports 1 test.

- [ ] **Step 7: Audit excluded tooling and generated output**

Run:

```powershell
rg -n "playwright|webdriverio|tauri-driver|cargo-nextest|thresholds" package.json pnpm-lock.yaml src-tauri/Cargo.toml vite.config.ts
```

Expected: no matches. If transitive package metadata produces a lockfile-only match, confirm it is not a direct dependency or configured test runner before proceeding.

Run:

```powershell
git status --short
```

Expected: no `coverage/`, `dist/`, `node_modules/`, or `src-tauri/target/` entries.

- [ ] **Step 8: Review and commit the Rust test integration**

Run:

```powershell
git diff --check
git add -- package.json src-tauri/src/lib.rs
git diff --cached --name-status
git diff --cached --check
git commit -m "test(rust): 覆盖问候命令逻辑"
```

Expected: the staged list contains exactly `package.json` and `src-tauri/src/lib.rs` before the commit.

- [ ] **Step 9: Verify the final repository state**

Run:

```powershell
git status --short --branch
git log -4 --oneline
```

Expected: the worktree is clean on `main`, and the two test commits appear above the plan and design commits. Do not push unless explicitly requested.
