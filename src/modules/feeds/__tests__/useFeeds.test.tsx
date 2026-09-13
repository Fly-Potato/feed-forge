import { act, renderHook, waitFor } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, test } from "vitest";

import { useFeeds } from "../hooks/useFeeds";
import { createAppQueryClient } from "../../../lib/query/client";

const feed = {
  id: 7, title: "OpenAI", url: "https://example.com/feed.xml", siteUrl: null,
  description: null, lastSyncedAt: null, syncError: null,
};

test("shares the feed list and refetches after a malformed add response", async () => {
  const queryClient = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  let listCalls = 0;
  mockIPC((command, payload) => {
    if (command === "feeds_list") { expect(payload).toEqual({ input: {} }); listCalls++; return listCalls === 1 ? [feed] : [feed, { ...feed, id: 8, title: "新订阅" }]; }
    if (command === "feeds_add") { expect(payload).toEqual({ input: { url: feed.url } }); return { id: 8 }; }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  const first = renderHook(() => useFeeds(), { wrapper });
  await waitFor(() => expect(first.result.current.feeds).toHaveLength(1));
  const second = renderHook(() => useFeeds(), { wrapper });
  await waitFor(() => expect(second.result.current.feeds).toHaveLength(1));
  expect(listCalls).toBe(1);
  await act(async () => {
    await expect(first.result.current.create(feed.url)).rejects.toMatchObject({ code: "invalid_response" });
  });
  await waitFor(() => expect(first.result.current.feeds).toHaveLength(2));
  expect(listCalls).toBe(2);
  queryClient.clear();
});
