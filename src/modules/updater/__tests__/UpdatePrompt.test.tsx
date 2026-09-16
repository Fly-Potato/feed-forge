import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { UpdatePrompt } from "../components/UpdatePrompt";
import type { UpdaterController } from "../hooks/useUpdater";

function controller(overrides: Partial<UpdaterController> = {}): UpdaterController {
  return {
    currentVersion: "0.1.0",
    status: "available",
    update: { version: "0.1.1", notes: "修复同步问题", install: vi.fn() },
    progress: undefined,
    error: null,
    promptOpen: true,
    check: vi.fn(),
    install: vi.fn(),
    dismissPrompt: vi.fn(),
    ...overrides,
  };
}

test("shows release details and lets the user postpone installation", async () => {
  const updater = controller();
  render(<UpdatePrompt updater={updater} />);

  expect(screen.getByRole("alertdialog", { name: "发现新版本 0.1.1" })).toBeInTheDocument();
  expect(screen.getByText("修复同步问题")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "稍后" }));
  expect(updater.dismissPrompt).toHaveBeenCalledOnce();
});

test("starts installation only after explicit confirmation", async () => {
  const updater = controller();
  render(<UpdatePrompt updater={updater} />);

  await userEvent.click(screen.getByRole("button", { name: "下载并安装" }));

  expect(updater.install).toHaveBeenCalledOnce();
});

test("shows determinate download progress while installing", () => {
  render(<UpdatePrompt updater={controller({
    status: "installing",
    progress: { downloaded: 50, total: 100 },
  })} />);

  expect(screen.getByText("正在下载 50%")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "正在安装..." })).toBeDisabled();
});
