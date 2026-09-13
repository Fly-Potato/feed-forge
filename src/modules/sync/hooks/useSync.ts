import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { IpcError } from "../../../lib/ipc/errors";
import { articleKeys } from "../../articles/keys";
import { feedKeys } from "../../feeds/keys";
import { cancelSync, startSync } from "../ipc";
import type { SyncEvent } from "../types";

export function useSync() {
  const queryClient = useQueryClient();
  const generationRef = useRef(0);
  const terminalGenerationRef = useRef(0);
  const [event, setEvent] = useState<SyncEvent | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { generationRef.current++; }, []);

  const start = useCallback(async (feedId?: number) => {
    const generation = ++generationRef.current;
    setEvent(null);
    setJobId(null);
    setError(null);
    const onInvalidEvent = (failure: IpcError) => {
      if (generationRef.current === generation && terminalGenerationRef.current !== generation)
        setError(failure.message);
    };
    const onEvent = (next: SyncEvent) => {
      if (generationRef.current !== generation || terminalGenerationRef.current === generation) return;
      const terminal = next.event === "completed" || next.event === "failed" || next.event === "canceled";
      if (terminal) {
        terminalGenerationRef.current = generation;
        setError(null);
      }
      setEvent(next);
      if (terminal) {
        void queryClient.invalidateQueries({ queryKey: feedKeys.all });
        void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      }
    };
    try {
      const accepted = await startSync(feedId, onEvent, onInvalidEvent);
      if (generationRef.current === generation) setJobId(accepted.jobId);
    } catch (cause) {
      if (generationRef.current === generation) setError(cause instanceof IpcError ? cause.message : "无法开始同步。");
    }
  }, [queryClient]);

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
