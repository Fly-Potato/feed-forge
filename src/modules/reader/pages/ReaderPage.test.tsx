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

test("clicking the selected article does not undo a manual unread change", async () => {
  const client = createAppQueryClient();
  let savedArticle = article;
  const readInputs: Array<{ articleId: number; isRead: boolean }> = [];
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [savedArticle], total: 1 };
    if (command === "articles_mark_read") {
      const input = (payload as { input: { articleId: number; isRead: boolean } }).input;
      readInputs.push(input);
      savedArticle = { ...savedArticle, isRead: input.isRead };
      return savedArticle;
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));

  await waitFor(() => expect(readInputs).toEqual([{ articleId: 11, isRead: true }]));
  await userEvent.click(await screen.findByRole("button", { name: "标为未读" }));
  await waitFor(() => expect(readInputs).toEqual([
    { articleId: 11, isRead: true },
    { articleId: 11, isRead: false },
  ]));
  expect(await screen.findByRole("button", { name: "标为已读" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /旧文章/ }));
  expect(readInputs).toEqual([
    { articleId: 11, isRead: true },
    { articleId: 11, isRead: false },
  ]);
  client.clear();
});

test("opening an already read article does not write its read state again", async () => {
  const client = createAppQueryClient();
  const readArticle = { ...article, isRead: true };
  const readInputs: unknown[] = [];
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [readArticle], total: 1 };
    if (command === "articles_mark_read") {
      readInputs.push(payload);
      return readArticle;
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));

  expect(screen.getByRole("article")).toHaveTextContent("旧内容");
  expect(screen.getByRole("button", { name: "标为未读" })).toBeInTheDocument();
  expect(readInputs).toEqual([]);
  client.clear();
});

test("reopening an article reuses its in-flight auto-read", async () => {
  useReaderStore.setState({ filter: "unread" });
  const client = createAppQueryClient();
  let savedArticle = article;
  let otherArticle = { ...article, id: 12, guid: "12", title: "另一篇", content: "另一篇内容" };
  const readInputs: Array<{ articleId: number; isRead: boolean }> = [];
  let resolveFirstRead!: (value: typeof savedArticle) => void;
  const pendingFirstRead = new Promise<typeof savedArticle>((resolve) => { resolveFirstRead = resolve; });
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") {
      const items = [savedArticle, otherArticle].filter((item) => !item.isRead);
      return { items, total: items.length };
    }
    if (command === "articles_mark_read") {
      const input = (payload as { input: { articleId: number; isRead: boolean } }).input;
      readInputs.push(input);
      if (input.articleId === 11) return pendingFirstRead;
      otherArticle = { ...otherArticle, isRead: true };
      return otherArticle;
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));
  await userEvent.click(screen.getByRole("button", { name: /另一篇/ }));
  await userEvent.click(screen.getByRole("button", { name: /旧文章/ }));

  expect(readInputs).toEqual([
    { articleId: 11, isRead: true },
    { articleId: 12, isRead: true },
  ]);
  savedArticle = { ...savedArticle, isRead: true };
  resolveFirstRead(savedArticle);
  expect(await screen.findByText("暂无文章")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "标为未读" })).toBeInTheDocument();
  expect(readInputs).toEqual([
    { articleId: 11, isRead: true },
    { articleId: 12, isRead: true },
  ]);
  client.clear();
});

test("a settled auto-read is reused until the article query catches up", async () => {
  const client = createAppQueryClient();
  let savedArticle = article;
  const otherArticle = { ...article, id: 12, guid: "12", title: "另一篇", content: "另一篇内容", isRead: true };
  const readInputs: Array<{ articleId: number; isRead: boolean }> = [];
  let articleReads = 0;
  let resolveRefresh!: (value: { items: typeof article[]; total: number }) => void;
  const pendingRefresh = new Promise<{ items: typeof article[]; total: number }>((resolve) => { resolveRefresh = resolve; });
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") {
      articleReads++;
      return articleReads === 1 ? { items: [article, otherArticle], total: 2 } : pendingRefresh;
    }
    if (command === "articles_mark_read") {
      const input = (payload as { input: { articleId: number; isRead: boolean } }).input;
      readInputs.push(input);
      savedArticle = { ...savedArticle, isRead: input.isRead };
      return savedArticle;
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));
  await waitFor(() => expect(articleReads).toBe(2));
  await userEvent.click(screen.getByRole("button", { name: /另一篇/ }));
  await userEvent.click(screen.getByRole("button", { name: /旧文章/ }));

  expect(readInputs).toEqual([{ articleId: 11, isRead: true }]);
  resolveRefresh({ items: [savedArticle, otherArticle], total: 2 });
  client.clear();
});

test("a reopen after settled manual unread is queued before its query refresh", async () => {
  const client = createAppQueryClient();
  let savedArticle = { ...article, isRead: true };
  const otherArticle = { ...article, id: 12, guid: "12", title: "另一篇", content: "另一篇内容", isRead: true };
  const readInputs: Array<{ articleId: number; isRead: boolean }> = [];
  let articleReads = 0;
  let resolveRefresh!: (value: { items: typeof article[]; total: number }) => void;
  const pendingRefresh = new Promise<{ items: typeof article[]; total: number }>((resolve) => { resolveRefresh = resolve; });
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") {
      articleReads++;
      return articleReads === 1 ? { items: [savedArticle, otherArticle], total: 2 } : pendingRefresh;
    }
    if (command === "articles_mark_read") {
      const input = (payload as { input: { articleId: number; isRead: boolean } }).input;
      readInputs.push(input);
      savedArticle = { ...savedArticle, isRead: input.isRead };
      return savedArticle;
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));
  await userEvent.click(screen.getByRole("button", { name: "标为未读" }));
  await waitFor(() => expect(articleReads).toBe(2));
  await userEvent.click(screen.getByRole("button", { name: /另一篇/ }));
  await userEvent.click(screen.getByRole("button", { name: /旧文章/ }));

  await waitFor(() => expect(readInputs).toEqual([
    { articleId: 11, isRead: false },
    { articleId: 11, isRead: true },
  ]));
  resolveRefresh({ items: [savedArticle, otherArticle], total: 2 });
  client.clear();
});

test("keeps an automatically read article open after it leaves the unread results", async () => {
  useReaderStore.setState({ filter: "unread" });
  const client = createAppQueryClient();
  let savedArticle = article;
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") {
      const items = savedArticle.isRead ? [] : [savedArticle];
      return { items, total: items.length };
    }
    if (command === "articles_mark_read") {
      const input = (payload as { input: { articleId: number; isRead: boolean } }).input;
      savedArticle = { ...savedArticle, title: "新文章", content: "新内容", isRead: input.isRead };
      return savedArticle;
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));

  expect(await screen.findByText("暂无文章")).toBeInTheDocument();
  expect(screen.getByRole("article")).toHaveTextContent("新内容");
  expect(screen.getByRole("button", { name: "标为未读" })).toBeInTheDocument();
  client.clear();
});

test("the latest reopen wins over an in-flight manual unread change", async () => {
  const client = createAppQueryClient();
  let savedArticle = { ...article, isRead: true };
  const otherArticle = { ...article, id: 12, guid: "12", title: "另一篇", content: "另一篇内容", isRead: true };
  const readInputs: Array<{ articleId: number; isRead: boolean }> = [];
  let resolveUnread!: (value: typeof savedArticle) => void;
  const pendingUnread = new Promise<typeof savedArticle>((resolve) => { resolveUnread = resolve; });
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [savedArticle, otherArticle], total: 2 };
    if (command === "articles_mark_read") {
      const input = (payload as { input: { articleId: number; isRead: boolean } }).input;
      readInputs.push(input);
      if (!input.isRead) return pendingUnread;
      savedArticle = { ...savedArticle, isRead: true };
      return savedArticle;
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));
  await userEvent.click(screen.getByRole("button", { name: "标为未读" }));
  await userEvent.click(screen.getByRole("button", { name: /另一篇/ }));
  await userEvent.click(screen.getByRole("button", { name: /旧文章/ }));

  expect(readInputs).toEqual([{ articleId: 11, isRead: false }]);
  savedArticle = { ...savedArticle, isRead: false };
  resolveUnread(savedArticle);
  await waitFor(() => expect(readInputs).toEqual([
    { articleId: 11, isRead: false },
    { articleId: 11, isRead: true },
  ]));
  expect(await screen.findByRole("button", { name: "标为未读" })).toBeInTheDocument();
  client.clear();
});

test("an auto-read failure is not shown after selecting another article", async () => {
  const client = createAppQueryClient();
  const otherArticle = { ...article, id: 12, guid: "12", title: "另一篇", content: "另一篇内容", isRead: true };
  let articleReads = 0;
  let rejectRead!: (cause: Error) => void;
  const pendingRead = new Promise<typeof article>((_resolve, reject) => { rejectRead = reject; });
  mockIPC((command) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") {
      articleReads++;
      return { items: [article, otherArticle], total: 2 };
    }
    if (command === "articles_mark_read") return pendingRead;
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));
  await userEvent.click(screen.getByRole("button", { name: /另一篇/ }));

  rejectRead(new Error("private database detail"));
  await waitFor(() => expect(articleReads).toBe(2));
  expect(screen.getByRole("article")).toHaveTextContent("另一篇内容");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  client.clear();
});

test("a successful all query clears a retained article that no longer exists", async () => {
  const client = createAppQueryClient();
  let articleExists = true;
  mockIPC((command) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") {
      const items = articleExists ? [article] : [];
      return { items, total: items.length };
    }
    if (command === "articles_mark_read") {
      articleExists = false;
      return { ...article, isRead: true };
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(within(await screen.findByRole("tree", { name: "订阅源" })).getByRole("treeitem", { name: /订阅https/ }));
  await userEvent.click(await screen.findByRole("button", { name: /旧文章/ }));

  expect(await screen.findByText("请选择文章开始阅读")).toBeInTheDocument();
  expect(useReaderStore.getState().selectedArticleId).toBeUndefined();
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

test("opens the add-feed dialog from the feed panel title actions", async () => {
  const client = createAppQueryClient();
  mockIPC((command) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [{ id: 3, title: "技术" }];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [], total: 0 };
    throw new Error(`Unexpected IPC command: ${command}`);
  });

  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  const feedPanel = screen.getByRole("complementary", { name: "订阅源面板" });
  await userEvent.click(await within(feedPanel).findByRole("button", { name: "添加订阅源" }));

  expect(screen.getByRole("dialog", { name: "添加订阅源" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "添加到分组" })).toHaveTextContent("未分组");
  client.clear();
});

test("adds a feed to the selected group from the title dialog", async () => {
  const client = createAppQueryClient();
  const addInputs: Array<{ url: string; groupId: number | null }> = [];
  mockIPC((command, payload) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [{ id: 3, title: "技术" }];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [], total: 0 };
    if (command === "feeds_add") {
      const input = (payload as { input: { url: string; groupId: number | null } }).input;
      addInputs.push(input);
      return { ...feed, id: 8, title: "新订阅", url: input.url, groupId: input.groupId };
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });

  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "添加订阅源" }));
  await userEvent.click(screen.getByRole("combobox", { name: "添加到分组" }));
  await userEvent.click(await screen.findByRole("option", { name: "技术" }));
  await userEvent.type(screen.getByRole("textbox", { name: "订阅源地址" }), "https://example.com/new.xml");
  await userEvent.click(screen.getByRole("button", { name: "添加订阅" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "添加订阅源" })).not.toBeInTheDocument());
  expect(addInputs).toEqual([{ url: "https://example.com/new.xml", groupId: 3 }]);
  client.clear();
});

test("keeps the add-feed dialog open while submission is pending", async () => {
  const client = createAppQueryClient();
  let resolveAdd!: (value: typeof feed) => void;
  const pendingAdd = new Promise<typeof feed>((resolve) => { resolveAdd = resolve; });
  mockIPC((command) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [], total: 0 };
    if (command === "feeds_add") return pendingAdd;
    throw new Error(`Unexpected IPC command: ${command}`);
  });

  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "添加订阅源" }));
  await userEvent.type(screen.getByRole("textbox", { name: "订阅源地址" }), "https://example.com/new.xml");
  await userEvent.click(screen.getByRole("button", { name: "添加订阅" }));

  expect(screen.getByRole("button", { name: "正在添加..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "添加订阅源" })).toBeInTheDocument();

  resolveAdd({ ...feed, id: 8, url: "https://example.com/new.xml" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "添加订阅源" })).not.toBeInTheDocument());
  client.clear();
});

test("retains the add-feed dialog values after a failed submission", async () => {
  const client = createAppQueryClient();
  mockIPC((command) => {
    if (command === "feeds_list") return [feed];
    if (command === "feeds_groups_list") return [{ id: 3, title: "技术" }];
    if (command === "settings_get") return { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
    if (command === "articles_list") return { items: [], total: 0 };
    if (command === "feeds_add") {
      throw { code: "duplicate", message: "订阅源已存在。", retryable: false };
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });

  render(<QueryClientProvider client={client}><ReaderPage /></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "添加订阅源" }));
  await userEvent.click(screen.getByRole("combobox", { name: "添加到分组" }));
  await userEvent.click(await screen.findByRole("option", { name: "技术" }));
  await userEvent.type(screen.getByRole("textbox", { name: "订阅源地址" }), "https://example.com/duplicate.xml");
  await userEvent.click(screen.getByRole("button", { name: "添加订阅" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("订阅源已存在。");
  expect(screen.getByRole("dialog", { name: "添加订阅源" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "订阅源地址" })).toHaveValue("https://example.com/duplicate.xml");
  expect(screen.getByRole("combobox", { name: "添加到分组" })).toHaveTextContent("技术");
  expect(screen.getByRole("button", { name: "添加订阅" })).toBeEnabled();
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

test("keeps settings tab panels vertically scrollable without horizontal scrolling", async () => {
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

  const tabs = screen.getByRole("tablist").parentElement;
  expect(tabs).toHaveClass("min-w-0");

  for (const tabName of ["常规", "订阅管理", "导入与导出"]) {
    await userEvent.click(screen.getByRole("tab", { name: tabName }));
    expect(screen.getByRole("tabpanel")).toHaveClass(
      "min-w-0",
      "overflow-x-hidden",
      "overflow-y-auto",
    );
  }
  client.clear();
});

test("shows localized labels for settings select values", async () => {
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

  const refreshSelect = screen.getByRole("combobox", { name: "自动刷新间隔" });
  const themeSelect = screen.getByRole("combobox", { name: "主题" });
  expect(refreshSelect).toHaveTextContent("60 分钟");
  expect(themeSelect).toHaveTextContent("跟随系统");

  await userEvent.click(refreshSelect);
  await userEvent.click(await screen.findByRole("option", { name: "每天" }));
  expect(refreshSelect).toHaveTextContent("每天");

  await userEvent.click(themeSelect);
  await userEvent.click(await screen.findByRole("option", { name: "深色" }));
  expect(themeSelect).toHaveTextContent("深色");
  client.clear();
});
