import { mockIPC } from "@tauri-apps/api/mocks";
import type { Channel } from "@tauri-apps/api/core";
import { describe, expect, test } from "vitest";

import { cancelSync, startSync } from "../ipc";
import type { SyncEvent } from "../types";

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

  test("accepts only validated events belonging to the accepted job", async () => {
    let channel!: Channel<unknown>;
    mockIPC((command, payload) => {
      if (command !== "sync_start") throw new Error(`Unexpected IPC command: ${command}`);
      const args = payload as { input: unknown; onEvent: Channel<unknown> };
      expect(args.input).toEqual({ feedId: 7 });
      channel = args.onEvent;
      return { jobId: 9 };
    });
    const events: SyncEvent[] = [];
    const errors: unknown[] = [];
    await startSync(7, (event) => events.push(event), (error) => errors.push(error));
    channel.onmessage({ event: "progress", data: { jobId: 9, processed: "1", total: 2 } });
    channel.onmessage({ event: "completed", data: { jobId: 10, processed: 1 } });
    channel.onmessage({ event: "completed", data: { jobId: 9, processed: 1 } });
    expect(events).toEqual([{ event: "completed", data: { jobId: 9, processed: 1 } }]);
    expect(errors).toEqual([
      expect.objectContaining({ code: "invalid_response", retryable: false }),
      expect.objectContaining({ code: "invalid_response", retryable: false }),
    ]);
  });

  test("buffers valid events delivered before start confirmation", async () => {
    mockIPC((command, payload) => {
      if (command !== "sync_start") throw new Error(`Unexpected IPC command: ${command}`);
      (payload as { onEvent: Channel<unknown> }).onEvent.onmessage({ event: "completed", data: { jobId: 9, processed: 1 } });
      return { jobId: 9 };
    });
    const events: SyncEvent[] = [];
    const errors: unknown[] = [];
    await startSync(undefined, (event) => events.push(event), (error) => errors.push(error));
    expect(events).toEqual([{ event: "completed", data: { jobId: 9, processed: 1 } }]);
    expect(errors).toEqual([]);
  });

  test("rejects malformed start confirmations", async () => {
    mockIPC((command) => {
      if (command !== "sync_start") throw new Error(`Unexpected IPC command: ${command}`);
      return { jobId: "bad" };
    });
    await expect(startSync(undefined, () => {}, () => {}))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});
