import type { ArticleFilter } from "./types";

export const articleKeys = {
  all: ["articles"] as const,
  feed: (id: number) => ["articles", id] as const,
  list: (id: number | undefined, filter: ArticleFilter) => ["articles", id, filter, 100, 0] as const,
};
