import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { addFeed, listFeeds, removeFeed } from "../ipc";
import * as feedsIpc from "../ipc";

const feed = {
  id: 42, title: "OpenAI", url: "https://example.com/feed.xml",
  siteUrl: null, description: null, lastSyncedAt: null, syncError: null,
};

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

  test("wraps the feed URL in the feeds_add input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return feed;
    });

    await addFeed("https://github.com/openai/codex/releases.atom");

    expect(calls).toEqual([
      [
        "feeds_add",
        { input: { url: "https://github.com/openai/codex/releases.atom" } },
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
      expect(payload).toEqual({ input: { url: feed.url } });
      const { siteUrl: _siteUrl, ...malformed } = feed;
      return malformed;
    });
    await expect(addFeed(feed.url)).rejects.toMatchObject({
      code: "invalid_response", retryable: false, message: "桌面返回的数据格式无效。",
    });
  });
});
