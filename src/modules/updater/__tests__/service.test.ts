import { beforeEach, expect, test, vi } from "vitest";

const { checkMock, getVersionMock, relaunchMock } = vi.hoisted(() => ({
  checkMock: vi.fn(),
  getVersionMock: vi.fn(),
  relaunchMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({ check: checkMock }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: getVersionMock }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: relaunchMock }));

import { checkForUpdate, getCurrentVersion } from "../service";

beforeEach(() => {
  checkMock.mockReset();
  getVersionMock.mockReset();
  relaunchMock.mockReset();
});

test("returns null when the release feed has no newer version", async () => {
  checkMock.mockResolvedValue(null);

  await expect(checkForUpdate()).resolves.toBeNull();
});

test("exposes release metadata and reports cumulative download progress", async () => {
  const downloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
    onEvent({ event: "Started", data: { contentLength: 100 } });
    onEvent({ event: "Progress", data: { chunkLength: 25 } });
    onEvent({ event: "Progress", data: { chunkLength: 50 } });
    onEvent({ event: "Finished" });
  });
  checkMock.mockResolvedValue({
    available: true,
    currentVersion: "0.1.0",
    version: "0.1.1",
    date: "2026-09-15T00:00:00Z",
    body: "修复同步问题",
    rawJson: {},
    downloadAndInstall,
  });
  const progress: Array<{ downloaded: number; total?: number }> = [];

  const update = await checkForUpdate();

  expect(update).toMatchObject({ version: "0.1.1", notes: "修复同步问题" });
  await update?.install((value) => progress.push(value));
  expect(progress).toEqual([
    { downloaded: 0, total: 100 },
    { downloaded: 25, total: 100 },
    { downloaded: 75, total: 100 },
    { downloaded: 100, total: 100 },
  ]);
  expect(relaunchMock).toHaveBeenCalledOnce();
});

test("uses an empty note when the release omits its body", async () => {
  checkMock.mockResolvedValue({
    available: true,
    currentVersion: "0.1.0",
    version: "0.1.1",
    rawJson: {},
    downloadAndInstall: vi.fn(),
  });

  await expect(checkForUpdate()).resolves.toMatchObject({ notes: "" });
});

test("reads the current application version through the Tauri app API", async () => {
  getVersionMock.mockResolvedValue("0.1.0");

  await expect(getCurrentVersion()).resolves.toBe("0.1.0");
});
