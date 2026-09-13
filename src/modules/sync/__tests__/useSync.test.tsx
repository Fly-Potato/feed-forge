import { act, renderHook, waitFor } from "@testing-library/react";
import type { Channel } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, test } from "vitest";

import { createAppQueryClient } from "../../../lib/query/client";
import { useArticles } from "../../articles/hooks/useArticles";
import { useFeeds } from "../../feeds/hooks/useFeeds";
import { useSync } from "../hooks/useSync";

const feed = { id: 7, title: "订阅", url: "https://example.com/feed.xml", siteUrl: null,
  description: null, lastSyncedAt: null, syncError: null, groupId: null };

test.each([
  { event: "completed", data: { jobId: 9, processed: 1 } },
  { event: "failed", data: { jobId: 9, message: "同步失败" } },
  { event: "canceled", data: { jobId: 9, processed: 1 } },
] as const)("valid $event refreshes feed and article queries only once", async (terminal) => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  let feedReads = 0;
  let articleReads = 0;
  let channel!: Channel<unknown>;
  mockIPC((command, payload) => {
    if (command === "feeds_list") { feedReads++; return [feed]; }
    if (command === "feeds_groups_list") return [];
    if (command === "articles_list") { articleReads++; return { items: [], total: 0 }; }
    if (command === "sync_start") { channel = (payload as { onEvent: Channel<unknown> }).onEvent; return { jobId: 9 }; }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  renderHook(() => useFeeds(), { wrapper });
  renderHook(() => useArticles(7, "all"), { wrapper });
  const sync = renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect([feedReads, articleReads]).toEqual([1, 1]));
  await act(async () => { await sync.result.current.start(); });
  act(() => { channel.onmessage({ event: "progress", data: { jobId: 9, processed: 1, total: 2 } }); });
  act(() => { channel.onmessage(terminal); channel.onmessage(terminal); });
  await waitFor(() => expect([feedReads, articleReads]).toEqual([2, 2]));
  expect(sync.result.current.event?.event).toBe(terminal.event);
  client.clear();
});

test("malformed and old-job terminal messages do not refresh the current job", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  let reads = 0;
  const channels: Array<Channel<unknown>> = [];
  mockIPC((command, payload) => {
    if (command === "feeds_list") { reads++; return [feed]; }
    if (command === "feeds_groups_list") return [];
    if (command === "sync_start") { channels.push((payload as { onEvent: Channel<unknown> }).onEvent); return { jobId: channels.length }; }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  renderHook(() => useFeeds(), { wrapper });
  const sync = renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(reads).toBe(1));
  await act(async () => { await sync.result.current.start(); });
  act(() => { channels[0].onmessage({ event: "completed", data: { jobId: 1, processed: 1 } }); });
  await waitFor(() => expect(reads).toBe(2));
  await act(async () => { await sync.result.current.start(); });
  act(() => {
    channels[0].onmessage({ event: "completed", data: { jobId: 1, processed: 1 } });
    channels[1].onmessage({ event: "completed", data: { jobId: 2, processed: "bad" } });
  });
  expect(reads).toBe(2);
  expect(sync.result.current.event?.event).not.toBe("completed");
  client.clear();
});

test("a valid failure overrides an earlier malformed progress message", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  let reads = 0;
  let channel!: Channel<unknown>;
  mockIPC((command, payload) => {
    if (command === "feeds_list") { reads++; return [feed]; }
    if (command === "feeds_groups_list") return [];
    if (command === "sync_start") { channel = (payload as { onEvent: Channel<unknown> }).onEvent; return { jobId: 9 }; }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  renderHook(() => useFeeds(), { wrapper });
  const sync = renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(reads).toBe(1));
  await act(async () => { await sync.result.current.start(); });
  act(() => { channel.onmessage({ event: "progress", data: { jobId: 9, processed: "bad", total: 2 } }); });
  expect(sync.result.current.error).toBe("桌面返回的数据格式无效。");
  expect(reads).toBe(1);
  act(() => { channel.onmessage({ event: "failed", data: { jobId: 9, message: "同步失败" } }); });
  await waitFor(() => expect(reads).toBe(2));
  expect(sync.result.current.error).toBeNull();
  expect(sync.result.current.event).toMatchObject({ event: "failed" });
  client.clear();
});

test("ignores duplicate starts until the current job reaches a valid terminal event", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const channels: Array<Channel<unknown>> = [];
  const syncStartCalls: unknown[] = [];
  let resolveFirst!: (value: { jobId: number }) => void;
  const firstAccepted = new Promise<{ jobId: number }>((resolve) => { resolveFirst = resolve; });
  mockIPC((command, payload) => {
    if (command === "sync_start") {
      syncStartCalls.push(payload);
      channels.push((payload as { onEvent: Channel<unknown> }).onEvent);
      return syncStartCalls.length === 1 ? firstAccepted : { jobId: 10 };
    }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  const sync = renderHook(() => useSync(), { wrapper });

  let first!: Promise<void>;
  await act(async () => {
    first = sync.result.current.start();
    await sync.result.current.start(7);
  });
  expect(syncStartCalls).toHaveLength(1);
  expect(sync.result.current.isRunning).toBe(true);
  expect(sync.result.current.targetFeedId).toBeUndefined();

  await act(async () => {
    resolveFirst({ jobId: 9 });
    await first;
  });
  act(() => { channels[0].onmessage({ event: "completed", data: { jobId: 9, processed: 1 } }); });
  await waitFor(() => expect(sync.result.current.isRunning).toBe(false));

  await act(async () => { await sync.result.current.start(7); });
  expect(syncStartCalls).toHaveLength(2);
  expect(sync.result.current.isRunning).toBe(true);
  expect(sync.result.current.targetFeedId).toBe(7);
  client.clear();
});
