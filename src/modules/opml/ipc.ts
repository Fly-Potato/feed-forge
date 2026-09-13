import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import { parseIpcResult } from "../../lib/ipc/parse";
import { opmlExportSchema, opmlImportResultSchema } from "./schema";
import type { OpmlImportResult } from "./types";

export async function importOpml(content: string): Promise<OpmlImportResult> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("opml_import", {
      input: { content },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(opmlImportResultSchema, raw);
}

export async function exportOpml(): Promise<string> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("opml_export", { input: {} });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(opmlExportSchema, raw);
}
