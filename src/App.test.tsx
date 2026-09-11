import { mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import App from "./App";

const windowControls = vi.hoisted(() => ({
  close: vi.fn(),
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowControls,
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("Windows 应用壳提供完整的窗口控制", () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    expect(screen.getByRole("button", { name: "最小化" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最大化或还原" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭到托盘" })).toBeInTheDocument();
  });

  test("窗口标题栏位于应用内容滚动区域之外", () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    const appShell = screen.getByRole("main");
    const titleBar = screen.getByLabelText("窗口标题栏");
    const contentScroller = screen.getByRole("region", { name: "应用内容" });

    expect(appShell).toHaveClass("h-screen", "overflow-hidden");
    expect(contentScroller).toHaveClass("min-h-0", "overflow-y-auto");
    expect(contentScroller).not.toContainElement(titleBar);
  });

  test("最小化按钮请求最小化当前窗口", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "最小化" }));

    expect(windowControls.minimize).toHaveBeenCalledOnce();
  });

  test("最大化按钮切换当前窗口的最大化状态", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "最大化或还原" }));

    expect(windowControls.toggleMaximize).toHaveBeenCalledOnce();
  });

  test("关闭按钮向当前窗口发出关闭请求", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "关闭到托盘" }));

    expect(windowControls.close).toHaveBeenCalledOnce();
  });

  test("双击窗口标题栏不重复调用公开的最大化 API", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    render(<App />);

    await userEvent.dblClick(screen.getByLabelText("窗口标题栏"));

    expect(windowControls.toggleMaximize).not.toHaveBeenCalled();
  });

  test("显示中文的本地 RSS 阅读器空状态", async () => {
    const calls: string[] = [];
    mockIPC((command) => {
      calls.push(command);
      if (command === "feeds_list") {
        return [];
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Feed Forge" }),
    ).toBeInTheDocument();
    expect(screen.getByText("本地 RSS 阅读器")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "订阅源地址" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加订阅" })).toBeInTheDocument();
    expect(await screen.findByText("暂无订阅源")).toBeInTheDocument();
    expect(screen.getByText("请选择订阅源以查看文章")).toBeInTheDocument();
    await waitFor(() => expect(calls).toEqual(["feeds_list"]));
  });
});
