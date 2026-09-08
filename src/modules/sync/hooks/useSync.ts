import { useCallback, useState } from "react";

import { IpcError } from "../../../lib/ipc/errors";
import { cancelSync, startSync } from "../ipc";
import type { SyncEvent } from "../types";

export function useSync() {
  const [event, setEvent] = useState<SyncEvent | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (feedId?: number) => {
    setError(null);
    try {
      const accepted = await startSync(feedId, setEvent);
      setJobId(accepted.jobId);
    } catch (cause) {
      setError(cause instanceof IpcError ? cause.message : "无法开始同步。");
    }
  }, []);

  const cancel = useCallback(async () => {
    if (jobId === null) {
      return;
    }
    try {
      await cancelSync(jobId);
    } catch (cause) {
      setError(cause instanceof IpcError ? cause.message : "无法取消同步。");
    }
  }, [jobId]);

  return { event, jobId, error, start, cancel };
}
