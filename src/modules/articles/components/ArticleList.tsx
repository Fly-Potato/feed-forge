import type { ArticleFilter, ArticleSummary } from "../types";

interface ArticleListProps {
  articles: ArticleSummary[];
  filter: ArticleFilter;
  selectedArticleId: number | undefined;
  onFilterChange: (filter: ArticleFilter) => void;
  onSelect: (articleId: number) => void;
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
  onFilterChange,
  onSelect,
}: ArticleListProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="articles-title">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 id="articles-title" className="font-semibold">
          文章
        </h2>
        <div className="flex gap-1" aria-label="文章筛选">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`rounded px-2 py-1 text-xs ${
                filter === item.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              aria-pressed={filter === item.value}
              onClick={() => onFilterChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {articles.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">暂无文章</p>
      ) : (
        <ul className="min-h-0 overflow-auto">
          {articles.map((article) => (
            <li key={article.id} className="border-b border-border">
              <button
                type="button"
                className={`w-full px-4 py-3 text-left ${
                  selectedArticleId === article.id
                    ? "bg-muted"
                    : "hover:bg-muted/60"
                }`}
                onClick={() => onSelect(article.id)}
              >
                <span className={`block ${article.isRead ? "font-normal" : "font-semibold"}`}>
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
