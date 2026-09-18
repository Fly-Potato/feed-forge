import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { useLogStore } from "../store";
import { useLogStream } from "../hooks/useLogStream";

const plugin = vi.hoisted(() => ({
  attachLogger: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-log", () => ({
  attachLogger: plugin.attachLogger,
  info: plugin.info,
  LogLevel: {
    Trace: 1,
    Debug: 2,
    Info: 3,
    Warn: 4,
    Error: 5,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  plugin.info.mockResolvedValue(undefined);
  useLogStore.setState({ entries: [], nextId: 1 });
});

test("maps official log levels and ignores unknown records", async () => {
  plugin.attachLogger.mockResolvedValue(vi.fn());
  renderHook(() => useLogStream());

  await waitFor(() => expect(plugin.attachLogger).toHaveBeenCalledOnce());
  await waitFor(() => {
    expect(plugin.info).toHaveBeenCalledWith("[app] frontend log listener attached");
  });
  const listener = plugin.attachLogger.mock.calls[0][0] as (record: {
    level: number;
    message: string;
  }) => void;

  act(() => {
    listener({ level: 3, message: "sync completed" });
    listener({ level: 99, message: "unknown" });
  });

  expect(useLogStore.getState().entries).toEqual([
    { id: 1, level: "info", message: "sync completed" },
  ]);
});

test("unsubscribes an attached listener when the component unmounts", async () => {
  const unlisten = vi.fn();
  plugin.attachLogger.mockResolvedValue(unlisten);
  const hook = renderHook(() => useLogStream());

  await waitFor(() => expect(plugin.attachLogger).toHaveBeenCalledOnce());
  hook.unmount();

  await waitFor(() => expect(unlisten).toHaveBeenCalledOnce());
});

test("unsubscribes when registration resolves after unmount", async () => {
  const unlisten = vi.fn();
  let resolveAttach!: (unlisten: () => void) => void;
  plugin.attachLogger.mockReturnValue(new Promise((resolve) => {
    resolveAttach = resolve;
  }));
  const hook = renderHook(() => useLogStream());

  await waitFor(() => expect(plugin.attachLogger).toHaveBeenCalledOnce());
  hook.unmount();
  await act(async () => resolveAttach(unlisten));

  expect(unlisten).toHaveBeenCalledOnce();
});

test("contains listener registration failures", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  plugin.attachLogger.mockRejectedValue(new Error("runtime unavailable"));

  renderHook(() => useLogStream());

  await waitFor(() => {
    expect(consoleError).toHaveBeenCalledWith("Failed to attach the application log listener.");
  });
  expect(useLogStore.getState().entries).toEqual([]);
  consoleError.mockRestore();
});
