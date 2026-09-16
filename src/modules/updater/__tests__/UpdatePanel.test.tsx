import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { UpdatePanel } from "../components/UpdatePanel";
import type { UpdaterController } from "../hooks/useUpdater";

function controller(overrides: Partial<UpdaterController> = {}): UpdaterController {
  return {
    currentVersion: "0.1.0",
    status: "idle",
    update: null,
    progress: undefined,
    error: null,
    promptOpen: false,
    check: vi.fn(),
    install: vi.fn(),
    dismissPrompt: vi.fn(),
    ...overrides,
  };
}

test("shows the current version and supports a manual update check", async () => {
  const updater = controller();
  render(<UpdatePanel updater={updater} />);

  expect(screen.getByText("当前版本 0.1.0")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "检查更新" }));
  expect(updater.check).toHaveBeenCalledOnce();
});

test("reports an up-to-date result without offering installation", () => {
  render(<UpdatePanel updater={controller({ status: "up-to-date" })} />);

  expect(screen.getByRole("status")).toHaveTextContent("当前已是最新版本。");
  expect(screen.queryByRole("button", { name: /安装/ })).not.toBeInTheDocument();
});

test("offers the available release and surfaces safe errors", async () => {
  const updater = controller({
    status: "available",
    update: { version: "0.1.1", notes: "", install: vi.fn() },
    error: "无法检查更新，请稍后重试。",
  });
  render(<UpdatePanel updater={updater} />);

  expect(screen.getByText("发现新版本 0.1.1")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("无法检查更新，请稍后重试。");
  await userEvent.click(screen.getByRole("button", { name: "下载并安装 0.1.1" }));
  expect(updater.install).toHaveBeenCalledOnce();
});
