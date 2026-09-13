import { act, renderHook, waitFor } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, test } from "vitest";

import { createAppQueryClient } from "../../../lib/query/client";
import { useFeeds } from "../hooks/useFeeds";

const feed = {
  id: 7,
  title: "OpenAI",
  url: "https://example.com/feed.xml",
  siteUrl: null,
  description: null,
  lastSyncedAt: null,
  syncError: null,
  groupId: null,
};

const group = { id: 3, title: "技术" };

function setup() {
  const queryClient = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useFeeds", () => {
  test("shares feed and group queries and refetches both after a malformed add response", async () => {
    const { queryClient, wrapper } = setup();
    let listCalls = 0;
    let groupCalls = 0;
    mockIPC((command, payload) => {
      if (command === "feeds_list") {
        expect(payload).toEqual({ input: {} });
        listCalls++;
        return listCalls === 1 ? [feed] : [feed, { ...feed, id: 8, title: "新订阅" }];
      }
      if (command === "feeds_groups_list") {
        expect(payload).toEqual({ input: {} });
        groupCalls++;
        return [group];
      }
      if (command === "feeds_add") {
        expect(payload).toEqual({ input: { url: feed.url, groupId: null } });
        return { id: 8 };
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    const first = renderHook(() => useFeeds(), { wrapper });
    await waitFor(() => expect(first.result.current.feeds).toHaveLength(1));
    await waitFor(() => expect(first.result.current.groups).toEqual([group]));
    const second = renderHook(() => useFeeds(), { wrapper });
    await waitFor(() => expect(second.result.current.groups).toEqual([group]));
    expect(listCalls).toBe(1);
    expect(groupCalls).toBe(1);

    await act(async () => {
      await expect(first.result.current.create(feed.url, null)).rejects.toMatchObject({
        code: "invalid_response",
      });
    });
    await waitFor(() => expect(first.result.current.feeds).toHaveLength(2));
    await waitFor(() => expect(groupCalls).toBe(2));
    expect(listCalls).toBe(2);
    queryClient.clear();
  });

  test("moves feeds and invalidates all feed data after every group mutation", async () => {
    const { queryClient, wrapper } = setup();
    let listCalls = 0;
    let groupCalls = 0;
    let assignedGroupId: number | null = null;
    let groups = [group];
    mockIPC((command, payload) => {
      if (command === "feeds_list") {
        listCalls++;
        return [{ ...feed, groupId: assignedGroupId }];
      }
      if (command === "feeds_groups_list") {
        groupCalls++;
        return groups;
      }
      if (command === "feeds_move") {
        expect(payload).toEqual({ input: { feedId: feed.id, groupId: group.id } });
        assignedGroupId = group.id;
        return { ...feed, groupId: group.id };
      }
      if (command === "feeds_group_create") {
        groups = [...groups, { id: 4, title: "设计" }];
        return groups[1];
      }
      if (command === "feeds_group_update") {
        groups = groups.map((item) => item.id === group.id ? { ...item, title: "工程" } : item);
        return groups[0];
      }
      if (command === "feeds_group_remove") {
        groups = groups.filter((item) => item.id !== group.id);
        assignedGroupId = null;
        return { groupId: group.id };
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    const hook = renderHook(() => useFeeds(), { wrapper });
    await waitFor(() => expect(hook.result.current.groups).toEqual([group]));

    await act(async () => { await hook.result.current.move(feed.id, group.id); });
    await waitFor(() => expect(hook.result.current.feeds[0]?.groupId).toBe(group.id));
    expect([listCalls, groupCalls]).toEqual([2, 2]);

    await act(async () => { await hook.result.current.createGroup("设计"); });
    await waitFor(() => expect(hook.result.current.groups).toHaveLength(2));
    expect([listCalls, groupCalls]).toEqual([3, 3]);

    await act(async () => { await hook.result.current.renameGroup(group.id, "工程"); });
    await waitFor(() => expect(hook.result.current.groups?.[0]?.title).toBe("工程"));
    expect([listCalls, groupCalls]).toEqual([4, 4]);

    await act(async () => { await hook.result.current.removeGroup(group.id); });
    await waitFor(() => expect(hook.result.current.groups).toEqual([{ id: 4, title: "设计" }]));
    await waitFor(() => expect(hook.result.current.feeds[0]?.groupId).toBeNull());
    expect([listCalls, groupCalls]).toEqual([5, 5]);
    queryClient.clear();
  });

  test("exposes a group-query failure without changing the feed-list status", async () => {
    const { queryClient, wrapper } = setup();
    mockIPC((command) => {
      if (command === "feeds_list") return [feed];
      if (command === "feeds_groups_list") {
        throw { code: "storage_error", message: "无法加载订阅分组。", retryable: true };
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    const hook = renderHook(() => useFeeds(), { wrapper });
    await waitFor(() => expect(hook.result.current.status).toBe("success"));
    await waitFor(() => expect(hook.result.current.error).toBe("无法加载订阅分组。"));
    expect(hook.result.current.feeds).toEqual([feed]);
    expect(hook.result.current.groups).toBeUndefined();
    queryClient.clear();
  });
});
