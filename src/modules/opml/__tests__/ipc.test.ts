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
  test("rejects negative imported counts", async () => {
    mockIPC((command) => {
      if (command !== "opml_import") throw new Error(`Unexpected IPC command: ${command}`);
      return { imported: -1, skipped: 0 };
    });
    await expect(importOpml("<opml />")).rejects.toMatchObject({ code: "invalid_response" });
  });

  test("rejects a non-string OPML export", async () => {
    mockIPC((command) => {
      if (command !== "opml_export") throw new Error(`Unexpected IPC command: ${command}`);
      return { xml: "<opml />" };
    });
    await expect(exportOpml()).rejects.toMatchObject({ code: "invalid_response" });
  });
});
