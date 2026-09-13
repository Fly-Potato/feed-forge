import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { IpcError } from "../../../lib/ipc/errors";
import { listArticles, markArticleRead, toggleArticleStar } from "../ipc";
import { articleKeys } from "../keys";
import type { ArticleFilter, ArticlePage, ArticleSummary } from "../types";

export function useArticles(feedId: number | undefined, filter: ArticleFilter) {
  const queryClient = useQueryClient();
  const key = articleKeys.list(feedId, filter);
  const list = useQuery({
    queryKey: key,
    queryFn: () => listArticles({ feedId, filter, limit: 100, offset: 0 }),
    enabled: feedId !== undefined,
  });
  const invalidate = (originFeedId: number | undefined) => {
    if (originFeedId !== undefined) void queryClient.invalidateQueries({ queryKey: articleKeys.feed(originFeedId) });
  };
  const updateCachedArticle = (originFeedId: number | undefined, article: ArticleSummary) => {
    if (originFeedId === undefined) return;
    queryClient.setQueriesData<ArticlePage>(
      { queryKey: articleKeys.feed(originFeedId) },
      (page) => page && ({
        ...page,
        items: page.items.map((item) => item.id === article.id ? article : item),
      }),
    );
  };
  const read = useMutation({
    mutationFn: ({ articleId, isRead }: { feedId: number | undefined; articleId: number; isRead: boolean }) => markArticleRead(articleId, isRead),
    onSuccess: (article, variables) => updateCachedArticle(variables.feedId, article),
    onSettled: (_data, _error, variables) => invalidate(variables.feedId),
  });
  const star = useMutation({
    mutationFn: ({ articleId, isStarred }: { feedId: number | undefined; articleId: number; isStarred: boolean }) => toggleArticleStar(articleId, isStarred),
    onSuccess: (article, variables) => updateCachedArticle(variables.feedId, article),
    onSettled: (_data, _error, variables) => invalidate(variables.feedId),
  });
  return {
    items: list.data?.items ?? [], total: list.data?.total ?? 0,
    loading: feedId !== undefined && list.isPending,
    error: readError(list.error), status: list.status,
    refresh: () => queryClient.invalidateQueries({ queryKey: key }),
    setRead: (articleId: number, isRead: boolean) => read.mutateAsync({ feedId, articleId, isRead }),
    setStarred: (articleId: number, isStarred: boolean) => star.mutateAsync({ feedId, articleId, isStarred }),
  };
}

function readError(cause: unknown): string | null {
  if (!cause) return null;
  if (cause instanceof IpcError) {
    return cause.message;
  }
  return "无法加载本地文章。";
}
