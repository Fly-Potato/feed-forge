import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { exportOpml, importOpml } from "../ipc";

describe("OPML IPC", () => {
  test("imports OPML text through a typed command", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return { imported: 2, skipped: 1 };
    });

    await expect(importOpml("<opml />")).resolves.toEqual({ imported: 2, skipped: 1 });
    expect(calls).toEqual([["opml_import", { input: { content: "<opml />" } }]]);
  });

  test("exports OPML with an empty object input", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return "<opml />";
    });

    await expect(exportOpml()).resolves.toBe("<opml />");
    expect(calls).toEqual([["opml_export", { input: {} }]]);
  });
});
