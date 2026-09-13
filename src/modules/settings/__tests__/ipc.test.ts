import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, test } from "vitest";

import { getSettings, updateSettings } from "../ipc";
import type { Settings } from "../types";

const settings: Settings = {
  refreshIntervalMinutes: 60,
  theme: "system",
  openLinksInBrowser: true,
};

describe("settings IPC facade", () => {
  test("calls settings_get with an object input", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return settings;
    });

    await getSettings();

    expect(calls).toEqual([["settings_get", { input: {} }]]);
  });

  test("wraps settings in the settings_update input argument", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      return settings;
    });

    await updateSettings(settings);

    expect(calls).toEqual([["settings_update", { input: settings }]]);
  });
  test("rejects an unknown theme from settings_get", async () => {
    mockIPC((command) => {
      if (command !== "settings_get") throw new Error(`Unexpected IPC command: ${command}`);
      return { ...settings, theme: "unknown" };
    });
    await expect(getSettings()).rejects.toMatchObject({ code: "invalid_response", retryable: false });
  });
});
