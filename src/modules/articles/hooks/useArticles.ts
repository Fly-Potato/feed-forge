import { useCallback, useEffect, useState } from "react";

import { IpcError } from "../../../lib/ipc/errors";
import { listArticles, markArticleRead, toggleArticleStar } from "../ipc";
import type { ArticleFilter, ArticlePage, ArticleSummary } from "../types";

export function useArticles(feedId: number | undefined, filter: ArticleFilter) {
  const [page, setPage] = useState<ArticlePage>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (feedId === undefined) {
      setPage({ items: [], total: 0 });
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setPage(await listArticles({ feedId, filter, limit: 100, offset: 0 }));
      setError(null);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setLoading(false);
    }
  }, [feedId, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateArticle = useCallback((article: ArticleSummary) => {
    setPage((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === article.id ? article : item)),
    }));
  }, []);

  const setRead = useCallback(async (articleId: number, isRead: boolean) => {
    updateArticle(await markArticleRead(articleId, isRead));
  }, [updateArticle]);

  const setStarred = useCallback(async (articleId: number, isStarred: boolean) => {
    updateArticle(await toggleArticleStar(articleId, isStarred));
  }, [updateArticle]);

  return { ...page, loading, error, refresh, setRead, setStarred };
}

function readError(cause: unknown): string {
  if (cause instanceof IpcError) {
    return cause.message;
  }
  return "无法加载本地文章。";
}
