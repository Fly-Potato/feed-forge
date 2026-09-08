import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { listFeeds } from "../ipc";

describe("feeds IPC facade", () => {
  test("calls feeds_list with an object input", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return [];
    });

    await expect(listFeeds()).resolves.toEqual([]);
    expect(calls).toEqual([["feeds_list", {}]]);
  });

  test("normalizes unknown command failures", async () => {
    mockIPC(() => {
      throw new Error("private failure");
    });

    await expect(listFeeds()).rejects.toMatchObject({
      code: "internal",
      message: "The desktop operation failed.",
    });
  });
});
