import { render, screen, waitFor, within } from "@testing-library/react";
import { act } from "@testing-library/react";
import type { Channel } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ close: vi.fn(), minimize: vi.fn(), toggleMaximize: vi.fn() }),
}));

import { createAppQueryClient } from "../../../lib/query/client";
import { useReaderStore } from "../store";
import { ReaderPage } from "./ReaderPage";

const feed = { id: 7, title: "订阅", url: "https://example.com/feed.xml", siteUrl: null,
  description: null, lastSyncedAt: null, syncError: null, groupId: null };
const article = { id: 11, feedId: 7, guid: "11", url: null, title: "旧文章", author: null,
  summary: null, content: "旧内容", publishedAt: null, isRead: false, isStarred: false };

afterEach(() => useReaderStore.setState({ selectedFeedId: undefined, selectedArticleId: undefined, filter: "all" }));

test("renders the current query article and clears selection when a filtered result drops it", async () => {
  const client = createAppQueryClient();
  let savedArticle = article;
  let articleReads = 0;
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") {
      articleReads++;
      const filter = (payload as { input: { filter: string } }).input.filter;
      const items = filter === "unread" && savedArticle.isRead ? [] : [savedArticle];
      return { items, total: items.length };
    }
    if (command === "articles_mark_read") { savedArticle = { ...article, title: "新文章", content: "新内容", isRead: true }; return savedArticle; }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await waitFor(() => expect(useReaderStore.getState().selectedFeedId).toBe(7));
  await waitFor(() => expect(articleReads).toBe(1));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));
  expect(screen.getByRole("article")).toHaveTextContent("旧内容");
  await userEvent.click(screen.getByRole("button", { name: "标为已读" }));
  await waitFor(() => expect(screen.getByRole("article")).toHaveTextContent("新内容"));
  await userEvent.click(screen.getByRole("button", { name: "未读" }));
  expect(screen.getByText("请选择文章开始阅读")).toBeInTheDocument();
  client.clear();
});

test("a failed feeds query never clears the previously selected feed", async () => {
  useReaderStore.getState().selectFeed(7);
  const client = createAppQueryClient();
  mockIPC((command) => {
    if (command === "feeds_list") throw new Error("private failure");
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [article], total: 1 };
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("桌面操作失败"));
  expect(useReaderStore.getState().selectedFeedId).toBe(7);
  client.clear();
});

test("a failed article write shows the safe error and retains the current article", async () => {
  useReaderStore.getState().selectFeed(7);
  useReaderStore.getState().selectArticle(11);
  const client = createAppQueryClient();
  mockIPC((command) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [article], total: 1 };
    if (command === "articles_mark_read") throw new Error("private database detail");
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  expect(await screen.findByRole("article")).toHaveTextContent("旧内容");
  await userEvent.click(screen.getByRole("button", { name: "标为已读" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("桌面操作失败。");
  expect(screen.getByRole("article")).toHaveTextContent("旧内容");
  client.clear();
});

test("removes the content header and keeps scoped refresh and settings actions reachable", async () => {
  const client = createAppQueryClient();
  const channels: Array<Channel<unknown>> = [];
  const syncInputs: Array<{ feedId?: number }> = [];
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [], total: 0 };
    if (command === "sync_start") {
      const value = payload as { input: { feedId?: number }; onEvent: Channel<unknown> };
      syncInputs.push(value.input);
      channels.push(value.onEvent);
      return { jobId: syncInputs.length };
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });

  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  expect(screen.queryByRole("heading", { name: "Feed Forge" })).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "同步全部订阅源" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "同步当前订阅源" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();

  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  const currentRefresh = screen.getByRole("button", { name: "同步当前订阅源" });
  await waitFor(() => expect(currentRefresh).toBeEnabled());
  await userEvent.click(currentRefresh);
  expect(syncInputs).toEqual([{ feedId: 7 }]);
  expect(currentRefresh).toBeDisabled();
  expect(currentRefresh).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("button", { name: "同步全部订阅源" })).toBeDisabled();

  act(() => { channels[0].onmessage({ event: "completed", data: { jobId: 1, processed: 1 } }); });
  expect(await screen.findByRole("status")).toHaveTextContent("同步完成");
  const allRefresh = screen.getByRole("button", { name: "同步全部订阅源" });
  await waitFor(() => expect(allRefresh).toBeEnabled());
  await userEvent.click(allRefresh);
  expect(syncInputs).toEqual([{ feedId: 7 }, { feedId: undefined }]);
  expect(allRefresh).toHaveAttribute("aria-busy", "true");

  await userEvent.click(screen.getByRole("button", { name: "折叠订阅源栏" }));
  expect(screen.getByRole("button", { name: "展开订阅源栏" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "同步全部订阅源" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
  client.clear();
});

test("opens settings in a larger dialog while preserving viewport margins", async () => {
  const client = createAppQueryClient();
  mockIPC((command) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [], total: 0 };
    throw new Error(`Unexpected IPC command: ${command}`);
  });

  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "设置" }));

  const dialog = await screen.findByRole("dialog", { name: "设置" });
  expect(dialog).toHaveClass("h-[min(700px,calc(100vh-2rem))]");
  expect(dialog.style.maxWidth).toContain("1080px");
  expect(dialog.style.maxWidth).toContain("2rem");
  client.clear();
});
