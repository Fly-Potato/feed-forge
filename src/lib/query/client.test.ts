import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { createElement, type ReactNode } from "react";

import { IpcError } from "../ipc/errors";
import { createAppQueryClient } from "./client";

test("does not retry non-retryable IPC errors", async () => {
  const queryClient = createAppQueryClient();
  const queryFn = vi.fn().mockRejectedValue(new IpcError({ code: "invalid_response", message: "无效", retryable: false }));
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  const { result } = renderHook(() => useQuery({ queryKey: ["no-retry"], queryFn }), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryFn).toHaveBeenCalledOnce();
  queryClient.clear();
});

test("retries a retryable IPC read once", async () => {
  const queryClient = createAppQueryClient();
  const queryFn = vi.fn().mockRejectedValue(new IpcError({ code: "network", message: "离线", retryable: true }));
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  const { result } = renderHook(() => useQuery({ queryKey: ["one-retry"], queryFn }), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3500 });
  expect(queryFn).toHaveBeenCalledTimes(2);
  queryClient.clear();
});
