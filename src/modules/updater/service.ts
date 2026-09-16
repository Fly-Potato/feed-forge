import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";

import type { AvailableUpdate, UpdateProgress } from "./types";

export function getCurrentVersion() {
  return getVersion();
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const update = await check();
  if (!update) return null;

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

      await update.downloadAndInstall(report);
      await relaunch();
    },
  };
}
