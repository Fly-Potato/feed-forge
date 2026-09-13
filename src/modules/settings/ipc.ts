import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import { parseIpcResult } from "../../lib/ipc/parse";
import { settingsSchema } from "./schema";
import type { Settings } from "./types";

export async function getSettings(): Promise<Settings> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("settings_get", { input: {} });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(settingsSchema, raw);
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("settings_update", { input: settings });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(settingsSchema, raw);
}
