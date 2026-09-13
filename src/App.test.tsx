import { mockIPC as tauriMockIPC } from "@tauri-apps/api/mocks";
import { act, render, screen, waitFor } from "@testing-library/react";
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

const defaultSettings = {
  refreshIntervalMinutes: 60,
  theme: "system" as const,
  openLinksInBrowser: true,
};

function mockIPC(handler: Parameters<typeof tauriMockIPC>[0]) {
  tauriMockIPC((command, payload) => {
    try {
      return handler(command, payload);
    } catch (cause) {
      if (
        command === "settings_get" &&
        cause instanceof Error &&
        cause.message.startsWith("Unexpected IPC command:")
      ) {
        return defaultSettings;
      }
      throw cause;
    }
  });
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove("dark");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
      writable: true,
    });
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
    expect(contentScroller).toHaveClass("min-h-0", "overflow-x-auto", "overflow-y-auto");
    expect(contentScroller).not.toContainElement(titleBar);
  });

  test("主布局始终保持水平三栏并提供左右侧栏折叠操作", () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    const mainGrid = screen.getByRole("group", { name: "主布局" });
    const headerInner = screen.getByRole("heading", { name: "Feed Forge" }).parentElement?.parentElement;
    expect(headerInner).not.toHaveClass("mx-auto", "max-w-[1600px]");
    expect(mainGrid).not.toHaveClass("mx-auto", "max-w-[1600px]");
    expect(mainGrid).toHaveStyle({
      gridTemplateColumns: "280px minmax(280px, 380px) minmax(0, 1fr)",
    });
    expect(screen.getByRole("button", { name: "折叠订阅源栏" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "折叠文章列表栏" })).toBeInTheDocument();
  });

  test("窄窗口自动折叠订阅源栏和文章列表栏", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 640 });
    window.dispatchEvent(new Event("resize"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "展开订阅源栏" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "展开文章列表栏" })).toBeInTheDocument();
    });
  });

  test("更宽的窄窗口只自动折叠订阅源栏", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    window.dispatchEvent(new Event("resize"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "展开订阅源栏" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "折叠文章列表栏" })).toBeInTheDocument();
    });
  });

  test("侧栏折叠后可手动展开", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "折叠订阅源栏" }));
    expect(screen.getByRole("button", { name: "展开订阅源栏" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "展开订阅源栏" }));

    expect(screen.getByRole("button", { name: "折叠订阅源栏" })).toHaveFocus();
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
    expect(screen.queryByRole("textbox", { name: "订阅源地址" })).not.toBeInTheDocument();
    expect(await screen.findByText("暂无订阅源")).toBeInTheDocument();
    expect(screen.getByText("请选择订阅源以查看文章")).toBeInTheDocument();
    await waitFor(() => expect(calls).toEqual(expect.arrayContaining(["feeds_list", "settings_get"])));
  });

  test("设置弹窗集中展示应用设置和订阅操作", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      if (command === "settings_get") {
        return {
          refreshIntervalMinutes: 60,
          theme: "system",
          openLinksInBrowser: true,
        };
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    expect(screen.queryByRole("textbox", { name: "订阅源地址" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(await screen.findByRole("dialog", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "常规" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "订阅管理" }));
    expect(screen.getByRole("textbox", { name: "订阅源地址" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "导入与导出" }));
    expect(screen.getByRole("textbox", { name: "OPML 内容" })).toBeInTheDocument();
  });

  test("应用已保存的主题并安排自动刷新", async () => {
    const interval = vi.spyOn(window, "setInterval");
    const clearInterval = vi.spyOn(window, "clearInterval");
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      if (command === "settings_get") {
        return {
          refreshIntervalMinutes: 30,
          theme: "dark",
          openLinksInBrowser: true,
        };
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
      expect(interval).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);
    });
    const scheduledCall = interval.mock.calls.findIndex(([, delay]) => delay === 30 * 60 * 1000);
    const timer = interval.mock.results[scheduledCall]?.value;
    unmount();
    expect(clearInterval).toHaveBeenCalledWith(timer);
    interval.mockRestore();
    clearInterval.mockRestore();
  });

  test("设置加载失败时不保留可保存的草稿", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      if (command === "settings_get") throw new Error("无法读取设置");
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("桌面操作失败");
    expect(screen.getByRole("button", { name: "保存设置" })).toBeDisabled();
  });

  test("常规设置保存失败后保留用户草稿", async () => {
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      if (command === "settings_get") return defaultSettings;
      if (command === "settings_update") throw new Error("保存设置失败");
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    const externalBrowser = await screen.findByRole("switch", { name: "在外部浏览器打开链接" });
    await userEvent.click(externalBrowser);
    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("桌面操作失败");
    expect(externalBrowser).not.toBeChecked();
  });

  test("常规设置保存期间阻止关闭弹窗", async () => {
    let resolveUpdate!: (value: typeof defaultSettings) => void;
    const update = new Promise<typeof defaultSettings>((resolve) => {
      resolveUpdate = resolve;
    });
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      if (command === "settings_get") return defaultSettings;
      if (command === "settings_update") return update;
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    await userEvent.click(await screen.findByRole("button", { name: "保存设置" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭" })).toBeDisabled();

    await act(async () => resolveUpdate(defaultSettings));
    await waitFor(() => expect(screen.getByRole("button", { name: "关闭" })).toBeEnabled());
  });

  test("添加订阅期间阻止关闭设置弹窗", async () => {
    let resolveAdd!: (value: unknown) => void;
    const add = new Promise((resolve) => {
      resolveAdd = resolve;
    });
    mockIPC((command) => {
      if (command === "feeds_list") return [];
      if (command === "settings_get") return defaultSettings;
      if (command === "feeds_add") return add;
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    await userEvent.click(await screen.findByRole("tab", { name: "订阅管理" }));
    await userEvent.type(screen.getByRole("textbox", { name: "订阅源地址" }), "https://example.com/feed.xml");
    await userEvent.click(screen.getByRole("button", { name: "添加订阅" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭" })).toBeDisabled();

    await act(async () => resolveAdd({
      id: 1,
      title: "Example",
      url: "https://example.com/feed.xml",
      siteUrl: null,
      description: null,
      lastSyncedAt: null,
      syncError: null,
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "关闭" })).toBeEnabled());
  });

  test("设置弹窗加载并保存常规设置", async () => {
    const calls: Array<[string, unknown]> = [];
    const settings = {
      refreshIntervalMinutes: 60,
      theme: "system",
      openLinksInBrowser: true,
    };
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      if (command === "feeds_list") return [];
      if (command === "settings_get") return settings;
      if (command === "settings_update") return settings;
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    await screen.findByText("阅读偏好");
    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(calls).toContainEqual(["settings_update", { input: settings }]);
    });
  });

  test("设置弹窗完成订阅重命名和确认删除", async () => {
    const calls: Array<[string, unknown]> = [];
    const feed = {
      id: 42,
      title: "OpenAI",
      url: "https://github.com/openai/codex/releases.atom",
      siteUrl: null,
      description: null,
      lastSyncedAt: null,
      syncError: null,
    };
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      if (command === "feeds_list") return [feed];
      if (command === "settings_get") {
        return {
          refreshIntervalMinutes: 60,
          theme: "system",
          openLinksInBrowser: true,
        };
      }
      if (command === "feeds_update") return { ...feed, title: "OpenAI 新闻" };
      if (command === "feeds_remove") return { feedId: feed.id };
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    await userEvent.click(await screen.findByRole("tab", { name: "订阅管理" }));

    await userEvent.click(screen.getByRole("button", { name: "重命名 OpenAI" }));
    const titleInput = screen.getByRole("textbox", { name: "订阅名称 OpenAI" });
    expect(titleInput).toHaveFocus();
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "OpenAI 新闻");
    await userEvent.click(screen.getByRole("button", { name: "保存订阅名称" }));

    await userEvent.click(await screen.findByRole("button", { name: "删除 OpenAI 新闻" }));
    expect(screen.getByRole("alertdialog", { name: "删除订阅源？" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "删除 OpenAI 新闻" })).not.toBeInTheDocument();
      expect(calls).toContainEqual([
        "feeds_update",
        { input: { feedId: 42, title: "OpenAI 新闻" } },
      ]);
      expect(calls).toContainEqual(["feeds_remove", { input: { feedId: 42 } }]);
    });
  });

  test("取消订阅重命名后把焦点还给重命名按钮", async () => {
    const feed = {
      id: 42,
      title: "OpenAI",
      url: "https://github.com/openai/codex/releases.atom",
      siteUrl: null,
      description: null,
      lastSyncedAt: null,
      syncError: null,
    };
    mockIPC((command) => {
      if (command === "feeds_list") return [feed];
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    await userEvent.click(await screen.findByRole("tab", { name: "订阅管理" }));
    await userEvent.click(screen.getByRole("button", { name: "重命名 OpenAI" }));
    const titleInput = screen.getByRole("textbox", { name: "订阅名称 OpenAI" });
    await userEvent.clear(titleInput);
    await userEvent.click(screen.getByRole("button", { name: "保存订阅名称" }));

    expect(titleInput).toHaveAttribute("aria-invalid", "true");
    expect(titleInput).toHaveAccessibleDescription("订阅名称不能为空。");

    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByRole("button", { name: "重命名 OpenAI" })).toHaveFocus();
  });
});
