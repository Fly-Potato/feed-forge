import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import { parseIpcResult } from "../../lib/ipc/parse";
import {
  feedGroupListSchema,
  feedGroupSchema,
  feedListSchema,
  feedSummarySchema,
  removedFeedGroupSchema,
  removedFeedSchema,
} from "./schema";
import type { FeedGroup, FeedSummary } from "./types";

export async function listFeeds(): Promise<FeedSummary[]> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_list", { input: {} });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedListSchema, raw);
}

export async function addFeed(url: string, groupId: number | null): Promise<FeedSummary> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_add", { input: { url, groupId } });
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

export async function updateFeedSource(
  feedId: number,
  url: string,
  groupId: number | null,
): Promise<FeedSummary> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_update_source", {
      input: { feedId, url, groupId },
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

export async function listFeedGroups(): Promise<FeedGroup[]> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_groups_list", { input: {} });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedGroupListSchema, raw);
}

export async function createFeedGroup(title: string): Promise<FeedGroup> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_group_create", { input: { title } });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedGroupSchema, raw);
}

export async function updateFeedGroup(groupId: number, title: string): Promise<FeedGroup> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_group_update", { input: { groupId, title } });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedGroupSchema, raw);
}

export async function removeFeedGroup(groupId: number): Promise<{ groupId: number }> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_group_remove", { input: { groupId } });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(removedFeedGroupSchema, raw);
}

export async function moveFeed(feedId: number, groupId: number | null): Promise<FeedSummary> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("feeds_move", { input: { feedId, groupId } });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(feedSummarySchema, raw);
}
