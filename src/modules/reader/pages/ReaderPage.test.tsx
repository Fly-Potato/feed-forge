import { render, screen, waitFor, within } from "@testing-library/react";
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
  description: null, lastSyncedAt: null, syncError: null };
const article = { id: 11, feedId: 7, guid: "11", url: null, title: "旧文章", author: null,
  summary: null, content: "旧内容", publishedAt: null, isRead: false, isStarred: false };

afterEach(() => useReaderStore.setState({ selectedFeedId: undefined, selectedArticleId: undefined, filter: "all" }));

test("renders the current query article and clears selection when a filtered result drops it", async () => {
  const client = createAppQueryClient();
  let savedArticle = article;
  let articleReads = 0;
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
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
  await userEvent.click(within(await screen.findByRole("list", { name: "订阅源" })).getByRole("button"));
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
