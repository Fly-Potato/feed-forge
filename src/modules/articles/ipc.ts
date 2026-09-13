import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import { parseIpcResult } from "../../lib/ipc/parse";
import { articlePageSchema, articleSchema } from "./schema";
import type { ArticleFilter, ArticlePage, ArticleSummary } from "./types";

export async function listArticles(input: {
  feedId?: number;
  filter: ArticleFilter;
  limit: number;
  offset: number;
}): Promise<ArticlePage> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("articles_list", { input });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(articlePageSchema, raw);
}

export async function markArticleRead(
  articleId: number,
  isRead: boolean,
): Promise<ArticleSummary> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("articles_mark_read", {
      input: { articleId, isRead },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(articleSchema, raw);
}

export async function toggleArticleStar(
  articleId: number,
  isStarred: boolean,
): Promise<ArticleSummary> {
  let raw: unknown;
  try {
    raw = await invoke<unknown>("articles_toggle_star", {
      input: { articleId, isStarred },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
  return parseIpcResult(articleSchema, raw);
}
