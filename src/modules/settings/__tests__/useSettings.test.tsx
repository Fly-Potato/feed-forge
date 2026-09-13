import { act, renderHook, waitFor } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, test } from "vitest";

import { createAppQueryClient } from "../../../lib/query/client";
import { useSettings } from "../hooks/useSettings";

const settings = { refreshIntervalMinutes: 60, theme: "system" as const, openLinksInBrowser: true };

test("saved settings are visible to all consumers from the shared cache", async () => {
  const client = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  let reads = 0;
  mockIPC((command, payload) => {
    if (command === "settings_get") { reads++; return settings; }
    if (command === "settings_update") { expect(payload).toEqual({ input: { ...settings, theme: "dark" } }); return { ...settings, theme: "dark" }; }
    throw new Error(`Unexpected IPC command: ${command}`);
  });
  const first = renderHook(() => useSettings(), { wrapper });
  const second = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(first.result.current.settings?.theme).toBe("system"));
  expect(reads).toBe(1);
  await act(async () => { await first.result.current.save({ ...settings, theme: "dark" }); });
  await waitFor(() => expect(second.result.current.settings?.theme).toBe("dark"));
  expect(reads).toBe(1);
  client.clear();
});
