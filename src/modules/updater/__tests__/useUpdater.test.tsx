import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const { checkForUpdateMock, getCurrentVersionMock } = vi.hoisted(() => ({
  checkForUpdateMock: vi.fn(),
  getCurrentVersionMock: vi.fn(),
}));

vi.mock("../service", () => ({
  checkForUpdate: checkForUpdateMock,
  getCurrentVersion: getCurrentVersionMock,
}));

import { useUpdater } from "../hooks/useUpdater";

beforeEach(() => {
  checkForUpdateMock.mockReset();
  getCurrentVersionMock.mockReset();
  getCurrentVersionMock.mockResolvedValue("0.1.0");
});

test("automatically opens the prompt when a newer release is available", async () => {
  checkForUpdateMock.mockResolvedValue({ version: "0.1.1", notes: "修复问题", install: vi.fn() });

  const { result } = renderHook(() => useUpdater({ autoCheck: true }));

  await waitFor(() => expect(result.current.status).toBe("available"));
  expect(result.current.currentVersion).toBe("0.1.0");
  expect(result.current.update?.version).toBe("0.1.1");
  expect(result.current.promptOpen).toBe(true);
});

test("reports that a manual check found no update", async () => {
  checkForUpdateMock.mockResolvedValue(null);
  const { result } = renderHook(() => useUpdater({ autoCheck: false }));

  await act(() => result.current.check());

  expect(result.current.status).toBe("up-to-date");
  expect(result.current.promptOpen).toBe(false);
});

test("keeps a failed check non-blocking and exposes a safe message", async () => {
  checkForUpdateMock.mockRejectedValue(new Error("network details"));
  const { result } = renderHook(() => useUpdater({ autoCheck: false }));

  await act(() => result.current.check());

  expect(result.current.status).toBe("error");
  expect(result.current.error).toBe("无法检查更新，请稍后重试。");
});

test("tracks installation progress and reports installation failure", async () => {
  const install = vi.fn(async (onProgress: (value: { downloaded: number; total?: number }) => void) => {
    onProgress({ downloaded: 25, total: 100 });
    throw new Error("installer details");
  });
  checkForUpdateMock.mockResolvedValue({ version: "0.1.1", notes: "", install });
  const { result } = renderHook(() => useUpdater({ autoCheck: false }));
  await act(() => result.current.check());

  await act(() => result.current.install());

  expect(result.current.progress).toEqual({ downloaded: 25, total: 100 });
  expect(result.current.status).toBe("error");
  expect(result.current.error).toBe("无法安装更新，请稍后重试。");
});
