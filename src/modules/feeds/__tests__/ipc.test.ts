import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import {
  addFeed,
  createFeedGroup,
  listFeedGroups,
  listFeeds,
  moveFeed,
  removeFeed,
  removeFeedGroup,
  updateFeedGroup,
} from "../ipc";
import * as feedsIpc from "../ipc";

const feed = {
  id: 42, title: "OpenAI", url: "https://example.com/feed.xml",
  siteUrl: null, description: null, lastSyncedAt: null, syncError: null, groupId: null,
};

const group = { id: 3, title: "技术" };

describe("feeds IPC facade", () => {
  test("calls feeds_list with an object input", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return [];
    });

    await expect(listFeeds()).resolves.toEqual([]);
    expect(calls).toEqual([["feeds_list", { input: {} }]]);
  });

  test("wraps the feed URL and group in the feeds_add input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return feed;
    });

    await addFeed("https://github.com/openai/codex/releases.atom", 3);

    expect(calls).toEqual([
      [
        "feeds_add",
        { input: { url: "https://github.com/openai/codex/releases.atom", groupId: 3 } },
      ],
    ]);
  });

  test("wraps the feed ID in the feeds_remove input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return { feedId: 42 };
    });

    await expect(removeFeed(42)).resolves.toEqual({ feedId: 42 });
    expect(calls).toEqual([["feeds_remove", { input: { feedId: 42 } }]]);
  });

  test("wraps the feed ID and title in the feeds_update input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return feed;
    });

    expect(feedsIpc).toHaveProperty("updateFeed");
    await feedsIpc.updateFeed(42, "OpenAI");

    expect(calls).toEqual([
      ["feeds_update", { input: { feedId: 42, title: "OpenAI" } }],
    ]);
  });

  test("uses the feed-group command names and camelCase inputs", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      if (command === "feeds_group_create") return group;
      if (command === "feeds_group_update") return { ...group, title: "工程" };
      if (command === "feeds_move") return feed;
      if (command === "feeds_group_remove") return { groupId: group.id };
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    await createFeedGroup("技术");
    await updateFeedGroup(3, "工程");
    await moveFeed(42, null);
    await removeFeedGroup(3);

    expect(calls).toEqual([
      ["feeds_group_create", { input: { title: "技术" } }],
      ["feeds_group_update", { input: { groupId: 3, title: "工程" } }],
      ["feeds_move", { input: { feedId: 42, groupId: null } }],
      ["feeds_group_remove", { input: { groupId: 3 } }],
    ]);
  });

  test("lists and validates feed groups", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return [group];
    });

    await expect(listFeedGroups()).resolves.toEqual([group]);
    expect(calls).toEqual([["feeds_groups_list", { input: {} }]]);
  });

  test("normalizes unknown command failures", async () => {
    mockIPC(() => {
      throw new Error("private failure");
    });

    await expect(listFeeds()).rejects.toMatchObject({
      code: "internal",
      message: "桌面操作失败。",
    });
  });

  test("rejects a feed missing a required nullable field", async () => {
    mockIPC((command, payload) => {
      if (command !== "feeds_add") throw new Error(`Unexpected IPC command: ${command}`);
      expect(payload).toEqual({ input: { url: feed.url, groupId: null } });
      const { groupId: _groupId, ...malformed } = feed;
      return malformed;
    });
    await expect(addFeed(feed.url, null)).rejects.toMatchObject({
      code: "invalid_response", retryable: false, message: "桌面返回的数据格式无效。",
    });
  });

  test("rejects a feed group missing its title", async () => {
    mockIPC(() => [{ id: 3 }]);

    await expect(listFeedGroups()).rejects.toMatchObject({
      code: "invalid_response", retryable: false, message: "桌面返回的数据格式无效。",
    });
  });
});
