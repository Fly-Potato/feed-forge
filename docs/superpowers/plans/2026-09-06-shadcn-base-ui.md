# Feed Forge shadcn/ui + Base UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the current shadcn/ui toolchain to Feed Forge with Base UI primitives, then migrate the existing welcome form to generated shadcn components.

**Architecture:** Let the official shadcn CLI own registry configuration, Tailwind CSS v4 integration, design tokens, utilities, and component source. Keep local page state and Tauri `invoke` orchestration in `App.tsx`; generated components remain presentation primitives under `src/components/ui/`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4, shadcn/ui CLI, Base UI, Tauri v2, pnpm 11

**Spec:** `docs/superpowers/specs/2026-09-06-shadcn-base-ui-design.md`

## Global Constraints

- Use Base UI, selected by shadcn base identifier `base`; do not introduce Radix UI.
- Use Base UI with the `nova` visual preset, CSS variables, Tailwind CSS v4, and the `@tailwindcss/vite` plugin.
- Request only `button`, `input`, and `field`; retain `label` and `separator` when the `field` registry item brings them in as required dependencies.
- Preserve `Feed Forge`, `com.feedforge.app`, `greet`, Tauri capabilities, and all `src-tauri/` behavior.
- Do not add routing, state management, form management, a test framework, business modules, external fonts, icons, or extra Tauri plugins.
- Generated components and configuration use the approved test-first exception; verification uses dependency audits and full frontend/Tauri build checks.
- The workspace has no Git metadata, so this plan contains no commit steps.

---

### Task 1: Initialize shadcn and Tailwind v4

**Files:**
- Create: `components.json`
- Create: `src/index.css`
- Create: `src/lib/utils.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: existing Vite React application and pnpm toolchain.
- Produces: `@/*` alias resolving to `src/*`, global shadcn theme CSS, and `cn(...inputs: ClassValue[]): string` for generated components.

- [x] **Step 1: Capture the existing build baseline**

Run:

```powershell
mise exec -- pnpm build
```

Expected: exit code 0 before shadcn changes.

- [x] **Step 2: Add the TypeScript alias expected by shadcn**

Add to `tsconfig.json` compiler options. TypeScript 6 resolves these relative substitutions from the config directory without the deprecated `baseUrl` option:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

Add the same alias to Vite while preserving the Tauri development server settings:

```ts
import path from "node:path";

resolve: {
  alias: {
    "@": path.resolve(import.meta.dirname, "./src"),
  },
},
```

Ensure `@types/node` is present as a development dependency so `node:path`, `process`, and `import.meta.dirname` are type-checked without suppression comments.

- [x] **Step 3: Install and register Tailwind CSS v4**

Run:

```powershell
mise exec -- pnpm add -D tailwindcss @tailwindcss/vite
```

Import `tailwindcss` from `@tailwindcss/vite`, add `tailwindcss()` after `react()` in the existing Vite plugin array, create `src/index.css` with `@import "tailwindcss";`, and import `./index.css` from `src/main.tsx`. These are required preflight conditions when initializing shadcn in an existing Vite project.

- [x] **Step 4: Initialize shadcn with Base UI**

Run:

```powershell
mise exec -- pnpm dlx shadcn@latest init --template vite --base base --preset nova --yes --no-monorepo --pointer
```

Expected: CLI creates `components.json` and `src/lib/utils.ts`, installs Base UI and component utility dependencies, and extends the existing global Tailwind stylesheet with theme tokens without changing Tauri files.

- [x] **Step 5: Apply the Feed Forge theme tokens**

Keep the generated Tailwind import and `@theme inline` mappings, then set the light theme tokens in `src/index.css` to the approved cold-gray, navy, white, and forge-orange palette:

```css
:root {
  --background: oklch(0.97 0.01 250);
  --foreground: oklch(0.22 0.04 257);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.04 257);
  --primary: oklch(0.6 0.17 45);
  --primary-foreground: oklch(0.98 0.01 80);
  --muted: oklch(0.94 0.01 250);
  --muted-foreground: oklch(0.5 0.03 255);
  --border: oklch(0.87 0.02 250);
  --ring: oklch(0.6 0.17 45);
}
```

- [x] **Step 6: Verify the generated global stylesheet import**

Ensure `src/main.tsx` contains:

```ts
import "./index.css";
```

Keep the existing React `createRoot` and `StrictMode` structure unchanged.

- [x] **Step 7: Audit generated configuration before adding components**

Confirm `components.json` resolves components to `@/components`, utilities to `@/lib/utils`, uses CSS variables, and selects the Base UI/Nova configuration. Confirm `package.json` contains `@base-ui/react`, `tailwindcss`, and `@tailwindcss/vite`, with no `@radix-ui/*` dependency.

### Task 2: Generate the minimal UI component set

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/field.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/separator.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `components.json`, Tailwind theme variables, and `cn` utility from Task 1.
- Produces: `Button`, `Input`, `Field`, and `FieldLabel` React components for the welcome form.

- [x] **Step 1: Generate only the approved components**

Run:

```powershell
mise exec -- pnpm dlx shadcn@latest add button input field --yes
```

Expected: the requested components are created under `src/components/ui/`; `field` may also create its required `label` and `separator` dependencies. Dependencies are updated only as required by this component graph.

- [x] **Step 2: Verify the component base**

Run:

```powershell
rg -n '@base-ui/react|@radix-ui/' src/components package.json
```

Expected: generated primitives import `@base-ui/react`; no `@radix-ui/` matches exist.

- [x] **Step 3: Verify generated sources type-check before page migration**

Run:

```powershell
mise exec -- pnpm build
```

Expected: exit code 0 with generated components included in TypeScript checking.

### Task 3: Migrate the welcome form

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/App.css`

**Interfaces:**
- Consumes: `Button`, `Input`, `Field`, and `FieldLabel` from Task 2; `invoke<string>("greet", { name })` from the existing Tauri API flow.
- Produces: the same controlled-name and status behavior rendered with shadcn/Base UI presentation components.

- [x] **Step 1: Replace native presentation elements with generated components**

Use this component structure in `src/App.tsx` while retaining the existing state and `try/catch`:

```tsx
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { invoke } from "@tauri-apps/api/core";
import { useState, type FormEvent } from "react";

function App() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState(
    "Enter a name to verify the desktop bridge.",
  );

  async function greet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const greeting = await invoke<string>("greet", { name });
      setMessage(greeting);
    } catch {
      setMessage("Could not reach the Feed Forge desktop runtime.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <section
        className="w-full max-w-xl rounded-xl border border-border border-t-4 border-t-primary bg-card p-8 text-card-foreground shadow-xl sm:p-11"
        aria-labelledby="welcome-title"
      >
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-primary">
          Desktop skeleton · Tauri v2
        </p>
        <h1 id="welcome-title" className="text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome to Feed Forge
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground">
          React renders this interface. Rust answers through one minimal IPC command.
        </p>

        <form className="mt-8" onSubmit={greet}>
          <Field>
            <FieldLabel htmlFor="greet-input">Name</FieldLabel>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                id="greet-input"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Enter a name"
              />
              <Button type="submit">Send greeting</Button>
            </div>
          </Field>
        </form>

        <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      </section>
    </main>
  );
}

export default App;
```

- [x] **Step 2: Remove the superseded stylesheet**

Remove `src/App.css` only after confirming `App.tsx` no longer imports it. The file is fully replaced by Tailwind utilities and generated theme CSS.

- [x] **Step 3: Review page semantics and scope**

Confirm the label targets `greet-input`, the status region remains present, narrow layout stacks the action below the input, and the page adds no icons, external font, theme toggle, validation, or new business behavior.

### Task 4: Verify the integrated application

**Files:**
- Verify: `components.json`
- Verify: `package.json`
- Verify: `pnpm-lock.yaml`
- Verify: `src/`
- Verify: `src-tauri/`

**Interfaces:**
- Consumes: all completed shadcn/Base UI integration files.
- Produces: fresh evidence that the frontend design system and unchanged Tauri application build together.

- [x] **Step 1: Verify the frozen dependency graph**

Run:

```powershell
mise exec -- pnpm install --frozen-lockfile
```

Expected: exit code 0 with no lockfile changes.

- [x] **Step 2: Build the frontend**

Run:

```powershell
mise exec -- pnpm build
```

Expected: exit code 0 for TypeScript, Tailwind CSS v4, generated components, and Vite.

- [x] **Step 3: Check the Rust side**

Run:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: exit code 0 for `feed-forge`.

- [x] **Step 4: Inspect Tauri configuration**

Run:

```powershell
mise exec -- pnpm tauri info
```

Expected: exit code 0, React/Vite recognized, and no Tauri plugins listed.

- [x] **Step 5: Run the final dependency and source audit**

Confirm `@base-ui/react` is present; `@radix-ui/`, routing, state management, form management, test frameworks, and extra Tauri plugins are absent; `src-tauri/tauri.conf.json` still contains `Feed Forge` and `com.feedforge.app`.

- [x] **Step 6: Inspect the local page when browser control is available**

Start Vite on the existing fixed port and inspect the desktop and narrow layouts, focus state, submit interaction, and browser-only IPC error message. Stop the server afterward. If the browser control service is unavailable, record that limitation without installing another browser framework.

Observed: Vite started successfully on `http://127.0.0.1:1420/`, but this session did not provide a trusted browser control service. The server was stopped and no alternate browser framework was installed.
