import { useCallback, useEffect, useRef, useState } from "react";

import { checkForUpdate, getCurrentVersion } from "../service";
import type { AvailableUpdate, UpdateProgress } from "../types";

export type UpdaterStatus = "idle" | "checking" | "up-to-date" | "available" | "installing" | "error";

export interface UpdaterController {
  currentVersion: string | null;
  status: UpdaterStatus;
  update: AvailableUpdate | null;
  progress: UpdateProgress | undefined;
  error: string | null;
  promptOpen: boolean;
  check: () => Promise<void>;
  install: () => Promise<void>;
  dismissPrompt: () => void;
}

interface UseUpdaterOptions {
  autoCheck?: boolean;
}

export function useUpdater({ autoCheck = true }: UseUpdaterOptions = {}): UpdaterController {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdaterStatus>("idle");
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>();
  const [error, setError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const autoCheckStarted = useRef(false);

  useEffect(() => {
    let active = true;
    void getCurrentVersion()
      .then((version) => {
        if (active) setCurrentVersion(version);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const runCheck = useCallback(async () => {
    setStatus("checking");
    setError(null);
    setProgress(undefined);
    try {
      const available = await checkForUpdate();
      setUpdate(available);
      if (available) {
        setStatus("available");
        setPromptOpen(true);
      } else {
        setStatus("up-to-date");
        setPromptOpen(false);
      }
    } catch {
      setStatus("error");
      setError("无法检查更新，请稍后重试。");
    }
  }, []);

  useEffect(() => {
    if (!autoCheck || autoCheckStarted.current) return;
    autoCheckStarted.current = true;
    void runCheck();
  }, [autoCheck, runCheck]);

  const install = useCallback(async () => {
    if (!update) return;
    setStatus("installing");
    setError(null);
    setProgress(undefined);
    try {
      await update.install(setProgress);
    } catch {
      setStatus("error");
      setError("无法安装更新，请稍后重试。");
    }
  }, [update]);

  return {
    currentVersion,
    status,
    update,
    progress,
    error,
    promptOpen,
    check: runCheck,
    install,
    dismissPrompt: () => setPromptOpen(false),
  };
}
