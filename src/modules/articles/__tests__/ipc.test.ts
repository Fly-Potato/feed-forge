import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { listArticles, markArticleRead, toggleArticleStar } from "../ipc";

const article = {
  id: 11, feedId: 7, guid: "11", url: null, title: "文章", author: null,
  summary: null, content: null, publishedAt: null, isRead: false, isStarred: false,
};

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
      return { ...article, isRead: true };
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
      return { ...article, isStarred: true };
    });

    await toggleArticleStar(11, true);

    expect(calls).toEqual([
      ["articles_toggle_star", { input: { articleId: 11, isStarred: true } }],
    ]);
  });
  test("rejects an article page with a malformed ID", async () => {
    mockIPC((command, payload) => {
      if (command !== "articles_list") throw new Error(`Unexpected IPC command: ${command}`);
      expect(payload).toEqual({ input: { feedId: 7, filter: "all", limit: 100, offset: 0 } });
      return { items: [{ ...article, id: "bad" }], total: 1 };
    });
    await expect(listArticles({ feedId: 7, filter: "all", limit: 100, offset: 0 }))
      .rejects.toMatchObject({ code: "invalid_response", retryable: false });
  });
});
