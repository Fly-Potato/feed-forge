import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import { parseIpcResult } from "../../lib/ipc/parse";
import { feedListSchema, feedSummarySchema, removedFeedSchema } from "./schema";
import type { FeedSummary } from "./types";

export async function listFeeds(): Promise<FeedSummary[]> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_list", { input: {} });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedListSchema, raw);
}

export async function addFeed(url: string): Promise<FeedSummary> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_add", { input: { url } });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedSummarySchema, raw);
}

export async function updateFeed(feedId: number, title: string): Promise<FeedSummary> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_update", {
      input: { feedId, title },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedSummarySchema, raw);
}

export async function removeFeed(feedId: number): Promise<{ feedId: number }> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_remove", {
      input: { feedId },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(removedFeedSchema, raw);
}
