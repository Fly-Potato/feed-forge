import { Channel, invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import { invalidResponseError, parseIpcResult } from "../../lib/ipc/parse";
import type { IpcError } from "../../lib/ipc/errors";
import { syncAcceptedSchema, syncEventSchema } from "./schema";
import type { SyncAccepted, SyncEvent } from "./types";

export async function startSync(
  feedId: number | undefined,
  onEvent: (event: SyncEvent) => void,
  onInvalidEvent: (error: IpcError) => void = () => {},
): Promise<SyncAccepted> {
  const pending: SyncEvent[] = [];
  let acceptedJobId: number | undefined;
  let active = true;
  const channel = new Channel<unknown>((raw) => {
    if (!active) return;
    const parsed = syncEventSchema.safeParse(raw);
    if (!parsed.success) { onInvalidEvent(invalidResponseError()); return; }
    const event = parsed.data;
    if (acceptedJobId === undefined) { pending.push(event); return; }
    if (event.data.jobId !== acceptedJobId) { onInvalidEvent(invalidResponseError()); return; }
    onEvent(event);
  });
  let raw: unknown;
  try {
    raw = await invoke<unknown>("sync_start", {
      input: { feedId },
      onEvent: channel,
    });
  } catch (error) {
    active = false;
    throw normalizeIpcError(error);
  }
  let accepted: SyncAccepted;
  try { accepted = parseIpcResult(syncAcceptedSchema, raw); }
  catch (error) { active = false; throw error; }
  acceptedJobId = accepted.jobId;
  for (const event of pending) {
    if (event.data.jobId === accepted.jobId) onEvent(event);
    else onInvalidEvent(invalidResponseError());
  }
  return accepted;
}

export async function cancelSync(jobId: number): Promise<SyncAccepted> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("sync_cancel", { input: { jobId } });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(syncAcceptedSchema, raw);
}
