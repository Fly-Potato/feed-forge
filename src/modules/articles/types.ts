export type ArticleFilter = "all" | "unread" | "starred";

export interface ArticleSummary {
  id: number;
  feedId: number;
  guid: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  publishedAt: string | null;
  isRead: boolean;
  isStarred: boolean;
}

export interface ArticlePage {
  items: ArticleSummary[];
  total: number;
}
