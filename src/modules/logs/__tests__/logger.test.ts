import { beforeEach, expect, test, vi } from "vitest";

import { appLogger } from "../logger";

const plugin = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-log", () => plugin);

beforeEach(() => {
  vi.clearAllMocks();
  plugin.debug.mockResolvedValue(undefined);
  plugin.info.mockResolvedValue(undefined);
  plugin.warn.mockResolvedValue(undefined);
  plugin.error.mockResolvedValue(undefined);
});

test("prefixes frontend messages with a stable business scope", async () => {
  await appLogger.debug("updater", "checking");
  await appLogger.info("updater", "version 0.2.0 available");
  await appLogger.warn("updater", "check unavailable");
  await appLogger.error("updater", "install failed");

  expect(plugin.debug).toHaveBeenCalledWith("[updater] checking");
  expect(plugin.info).toHaveBeenCalledWith("[updater] version 0.2.0 available");
  expect(plugin.warn).toHaveBeenCalledWith("[updater] check unavailable");
  expect(plugin.error).toHaveBeenCalledWith("[updater] install failed");
});

test("contains official plugin write failures", async () => {
  plugin.info.mockRejectedValue(new Error("runtime unavailable"));

  await expect(appLogger.info("updater", "checking")).resolves.toBeUndefined();
});
