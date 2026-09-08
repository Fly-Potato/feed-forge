import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { cancelSync } from "../ipc";

describe("sync IPC facade", () => {
  test("wraps the job ID in the sync_cancel input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return { jobId: 9 };
    });

    await expect(cancelSync(9)).resolves.toEqual({ jobId: 9 });
    expect(calls).toEqual([["sync_cancel", { input: { jobId: 9 } }]]);
  });
});
