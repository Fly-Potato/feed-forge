import { act, renderHook, waitFor } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, test } from "vitest";

import { createAppQueryClient } from "../../../lib/query/client";
import { useArticles } from "../hooks/useArticles";
import { articleKeys } from "../keys";
import type { ArticleFilter } from "../types";

const article = { id: 11, feedId: 7, guid: "11", url: null, title: "文章", author: null,
  summary: null, content: null, publishedAt: null, isRead: false, isStarred: false };

test("does not fetch without a feed and keys results by feed and filter", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const inputs: unknown[] = [];
  mockIPC((command, payload) => {
    if (command === "articles_list") {
      const input = (payload as { input: { filter: string } }).input;
      inputs.push(input);
      return { items: [{ ...article, title: input.filter }], total: 1 };
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  const { result, rerender } = renderHook(({ id, filter }) => useArticles(id, filter), {
    initialProps: { id: undefined as number | undefined, filter: "unread" as ArticleFilter }, wrapper,
  });
  expect(inputs).toHaveLength(0);
  expect(result.current.items).toEqual([]);
  rerender({ id: 7, filter: "unread" });
  await waitFor(() => expect(result.current.items[0]?.title).toBe("unread"));
  rerender({ id: 7, filter: "starred" });
  await waitFor(() => expect(result.current.items[0]?.title).toBe("starred"));
  expect(inputs).toEqual([
    { feedId: 7, filter: "unread", limit: 100, offset: 0 },
    { feedId: 7, filter: "starred", limit: 100, offset: 0 },
  ]);
  client.clear();
});

test("a read mutation refreshes the filtered page and total", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  let isRead = false;
  let lists = 0;
  mockIPC((command, payload) => {
    if (command === "articles_list") { lists++; return { items: isRead ? [] : [article], total: isRead ? 0 : 1 }; }
    if (command === "articles_mark_read") {
      expect(payload).toEqual({ input: { articleId: 11, isRead: true } });
      isRead = true;
      return { ...article, isRead: true };
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  const { result } = renderHook(() => useArticles(7, "unread"), { wrapper });
  await waitFor(() => expect(result.current.total).toBe(1));
  await act(async () => { await result.current.setRead(11, true); });
  await waitFor(() => expect(result.current.total).toBe(0));
  expect(result.current.items).toEqual([]);
  expect(lists).toBe(2);
  client.clear();
});

test("an in-flight article write invalidates its origin feed after selection changes", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  let resolveRead!: (value: typeof article) => void;
  const pending = new Promise<typeof article>((resolve) => { resolveRead = resolve; });
  mockIPC((command) => {
    if (command === "articles_list") return { items: [article], total: 1 };
    if (command === "articles_mark_read") return pending;
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  const { result, rerender } = renderHook(({ id }) => useArticles(id, "all"), { initialProps: { id: 7 }, wrapper });
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  let write!: Promise<unknown>;
  act(() => { write = result.current.setRead(11, true); });
  rerender({ id: 8 });
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  await act(async () => { resolveRead({ ...article, isRead: true }); await write; });
  expect(client.getQueryState(articleKeys.list(7, "all"))?.isInvalidated).toBe(true);
  client.clear();
});
