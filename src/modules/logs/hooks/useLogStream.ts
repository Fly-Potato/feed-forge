import { useEffect } from "react";
import { attachLogger, LogLevel as TauriLogLevel } from "@tauri-apps/plugin-log";

import { appLogger } from "../logger";
import { useLogStore } from "../store";
import type { LogLevel } from "../types";

const levels = new Map<number, LogLevel>([
  [TauriLogLevel.Trace, "trace"],
  [TauriLogLevel.Debug, "debug"],
  [TauriLogLevel.Info, "info"],
  [TauriLogLevel.Warn, "warn"],
  [TauriLogLevel.Error, "error"],
]);

export function useLogStream() {
  const append = useLogStore((state) => state.append);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void attachLogger(({ level, message }) => {
      if (disposed) return;
      const mappedLevel = levels.get(level);
      if (mappedLevel) append({ level: mappedLevel, message });
    }).then((detach) => {
      if (disposed) detach();
      else {
        unlisten = detach;
        void appLogger.info("app", "frontend log listener attached");
      }
    }).catch(() => {
      if (!disposed) console.error("Failed to attach the application log listener.");
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [append]);
}
