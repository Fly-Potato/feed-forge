import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import type { Settings } from "./types";

export async function getSettings(): Promise<Settings> {
  try {
    return await invoke<Settings>("settings_get", { input: {} });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  try {
    return await invoke<Settings>("settings_update", { input: settings });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}
