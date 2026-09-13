import { act, renderHook, waitFor } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, test } from "vitest";

import { createAppQueryClient } from "../../../lib/query/client";
import { useFeeds } from "../../feeds/hooks/useFeeds";
import { useOpml } from "../hooks/useOpml";

const feed = { id: 7, title: "旧订阅", url: "https://example.com/feed.xml", siteUrl: null,
  description: null, lastSyncedAt: null, syncError: null };

test("import refetches feeds even when the response is malformed", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  let reads = 0;
  mockIPC((command) => {
    if (command === "feeds_list") { reads++; return reads === 1 ? [feed] : [feed, { ...feed, id: 8, title: "新订阅" }]; }
    if (command === "opml_import") return { imported: -1, skipped: 0 };
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  const feeds = renderHook(() => useFeeds(), { wrapper });
  const opml = renderHook(() => useOpml(), { wrapper });
  await waitFor(() => expect(feeds.result.current.feeds).toHaveLength(1));
  await act(async () => { await expect(opml.result.current.importContent("<opml />"))
    .rejects.toMatchObject({ code: "invalid_response" }); });
  await waitFor(() => expect(feeds.result.current.feeds).toHaveLength(2));
  expect(reads).toBe(2);
  client.clear();
});
