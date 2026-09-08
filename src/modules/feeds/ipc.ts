import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import type { FeedSummary } from "./types";

export async function listFeeds(): Promise<FeedSummary[]> {
  try {
    return await invoke<FeedSummary[]>("feeds_list", {});
  } catch (error) {
    throw normalizeIpcError(error);
  }
}

export async function addFeed(url: string): Promise<FeedSummary> {
  try {
    return await invoke<FeedSummary>("feeds_add", { url });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}

export async function removeFeed(feedId: number): Promise<{ feedId: number }> {
  try {
    return await invoke<{ feedId: number }>("feeds_remove", { feedId });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}
