import { PanelRightClose, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ArticleFilter, ArticleSummary } from "../types";

interface ArticleListProps {
  articles: ArticleSummary[];
  filter: ArticleFilter;
  selectedArticleId: number | undefined;
  feedSelected: boolean;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refreshDisabled?: boolean;
  onFilterChange: (filter: ArticleFilter) => void;
  onSelect: (articleId: number) => void;
  onRefresh: () => void;
  onCollapse: () => void;
}

const filters: Array<{ value: ArticleFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "unread", label: "未读" },
  { value: "starred", label: "收藏" },
];

export function ArticleList({
  articles,
  filter,
  selectedArticleId,
  feedSelected,
  loading,
  error,
  refreshing,
  refreshDisabled = false,
  onFilterChange,
  onSelect,
  onRefresh,
  onCollapse,
}: ArticleListProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="articles-title">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <h2 id="articles-title" className="mr-auto font-semibold">文章</h2>
        <div className="flex gap-1" aria-label="文章筛选">
          {filters.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={filter === item.value ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={filter === item.value}
              onClick={() => onFilterChange(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="同步当前订阅源"
          title="同步当前订阅源"
          aria-busy={refreshing}
          disabled={!feedSelected || refreshDisabled || refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            aria-hidden="true"
            data-icon="inline-start"
            className={cn(refreshing && "animate-spin motion-reduce:animate-none")}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="折叠文章列表栏"
          title="折叠文章列表栏"
          aria-expanded="true"
          onClick={onCollapse}
        >
          <PanelRightClose aria-hidden="true" data-icon="inline-start" />
        </Button>
      </div>
      {!feedSelected ? (
        <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          请选择订阅源以查看文章
        </p>
      ) : loading ? (
        <p className="p-4 text-sm text-muted-foreground">正在加载文章...</p>
      ) : error ? (
        <p className="p-4 text-sm text-destructive" role="alert">{error}</p>
      ) : articles.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">暂无文章</p>
      ) : (
        <ul className="min-h-0 overflow-auto">
          {articles.map((article) => (
            <li key={article.id} className="border-b border-border">
              <button
                type="button"
                className={cn(
                  "w-full px-4 py-3 text-left",
                  selectedArticleId === article.id ? "bg-muted" : "hover:bg-muted/60",
                )}
                onClick={() => onSelect(article.id)}
              >
                <span className={cn("block", article.isRead ? "font-normal" : "font-semibold")}>
                  {article.title}
                </span>
                <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                  {article.summary ?? "暂无摘要"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
