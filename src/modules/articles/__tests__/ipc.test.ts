import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { listArticles, markArticleRead, toggleArticleStar } from "../ipc";

describe("articles IPC facade", () => {
  test("wraps article filters in the articles_list input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return { items: [], total: 0 };
    });

    await listArticles({ feedId: 7, filter: "unread", limit: 100, offset: 0 });

    expect(calls).toEqual([
      [
        "articles_list",
        { input: { feedId: 7, filter: "unread", limit: 100, offset: 0 } },
      ],
    ]);
  });

  test("wraps read state in the articles_mark_read input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return {};
    });

    await markArticleRead(11, true);

    expect(calls).toEqual([
      ["articles_mark_read", { input: { articleId: 11, isRead: true } }],
    ]);
  });

  test("wraps star state in the articles_toggle_star input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return {};
    });

    await toggleArticleStar(11, true);

    expect(calls).toEqual([
      ["articles_toggle_star", { input: { articleId: 11, isStarred: true } }],
    ]);
  });
});
