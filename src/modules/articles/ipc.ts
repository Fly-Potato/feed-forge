import { invoke } from "@tauri-apps/api/core";

import { normalizeIpcError } from "../../lib/ipc/errors";
import type { ArticleFilter, ArticlePage, ArticleSummary } from "./types";

export async function listArticles(input: {
  feedId?: number;
  filter: ArticleFilter;
  limit: number;
  offset: number;
}): Promise<ArticlePage> {
  try {
    return await invoke<ArticlePage>("articles_list", { input });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}

export async function markArticleRead(
  articleId: number,
  isRead: boolean,
): Promise<ArticleSummary> {
  try {
    return await invoke<ArticleSummary>("articles_mark_read", {
      input: { articleId, isRead },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}

export async function toggleArticleStar(
  articleId: number,
  isStarred: boolean,
): Promise<ArticleSummary> {
  try {
    return await invoke<ArticleSummary>("articles_toggle_star", {
      input: { articleId, isStarred },
    });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}
