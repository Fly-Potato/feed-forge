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
      setError(cause instanceof IpcError ? cause.message : "Could not start sync.");
    }
  }, []);

  const cancel = useCallback(async () => {
    if (jobId === null) {
      return;
    }
    try {
      await cancelSync(jobId);
    } catch (cause) {
      setError(cause instanceof IpcError ? cause.message : "Could not cancel sync.");
    }
  }, [jobId]);

  return { event, jobId, error, start, cancel };
}
