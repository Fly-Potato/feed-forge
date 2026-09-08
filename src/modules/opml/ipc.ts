import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import type { OpmlImportResult } from "./types";

export async function importOpml(content: string): Promise<OpmlImportResult> {
  try {
    return await invoke<OpmlImportResult>("opml_import", {
      input: { content },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}

export async function exportOpml(): Promise<string> {
  try {
    return await invoke<string>("opml_export", { input: {} });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}
