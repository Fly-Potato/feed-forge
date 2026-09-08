import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { addFeed, listFeeds, removeFeed } from "../ipc";

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
      return {};
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

  test("normalizes unknown command failures", async () => {
    mockIPC(() => {
      throw new Error("private failure");
    });

    await expect(listFeeds()).rejects.toMatchObject({
      code: "internal",
      message: "桌面操作失败。",
    });
  });
});
