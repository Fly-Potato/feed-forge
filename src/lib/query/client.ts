import { QueryClient } from "@tanstack/react-query";

import { IpcError } from "../ipc/errors";

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: (failureCount, error) => failureCount < 1 && error instanceof IpcError && error.retryable,
      },
      mutations: { retry: false },
    },
  });
}
