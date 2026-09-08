import { Channel, invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import type { SyncAccepted, SyncEvent } from "./types";

export async function startSync(
  feedId: number | undefined,
  onEvent: (event: SyncEvent) => void,
): Promise<SyncAccepted> {
  const channel = new Channel<SyncEvent>(onEvent);
  try {
    return await invoke<SyncAccepted>("sync_start", {
      input: { feedId },
      onEvent: channel,
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}

export async function cancelSync(jobId: number): Promise<SyncAccepted> {
  try {
    return await invoke<SyncAccepted>("sync_cancel", { input: { jobId } });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}
