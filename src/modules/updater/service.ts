import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";

import { appLogger } from "@/modules/logs/logger";

import type { AvailableUpdate, UpdateProgress } from "./types";

export function getCurrentVersion() {
  return getVersion();
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  void appLogger.info("updater", "update check started");
  let update;
  try {
    update = await check();
  } catch (cause) {
    void appLogger.warn("updater", "update check failed");
    throw cause;
  }
  if (!update) {
    void appLogger.info("updater", "no update available");
    return null;
  }

  void appLogger.info("updater", `update ${update.version} available`);

  return {
    version: update.version,
    notes: update.body ?? "",
    install: async (onProgress) => {
      let downloaded = 0;
      let total: number | undefined;

      const report = (event: DownloadEvent) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength;
            downloaded = 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            break;
          case "Finished":
            if (total !== undefined) downloaded = total;
            break;
        }
        const progress: UpdateProgress = { downloaded };
        if (total !== undefined) progress.total = total;
        onProgress(progress);
      };

      try {
        await update.downloadAndInstall(report);
      } catch (cause) {
        void appLogger.error("updater", `update ${update.version} install failed`);
        throw cause;
      }
      void appLogger.info("updater", `update ${update.version} installed; restarting`);
      await relaunch();
    },
  };
}
