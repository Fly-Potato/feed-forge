import { Button } from "@/components/ui/button";

import type { ArticleSummary } from "../types";

interface ArticleReaderProps {
  article: ArticleSummary | undefined;
  onReadChange: (isRead: boolean) => void;
  onStarChange: (isStarred: boolean) => void;
}

export function ArticleReader({ article, onReadChange, onStarChange }: ArticleReaderProps) {
  if (!article) {
    return (
      <section className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Select an article to read
      </section>
    );
  }

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {article.author ?? "Unknown author"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{article.title}</h2>
          {article.publishedAt ? (
            <time className="mt-2 block text-sm text-muted-foreground" dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleString()}
            </time>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onStarChange(!article.isStarred)}>
            {article.isStarred ? "Unstar" : "Star"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onReadChange(!article.isRead)}>
            {article.isRead ? "Mark unread" : "Mark read"}
          </Button>
        </div>
      </div>
      <div className="mt-6 whitespace-pre-wrap text-sm leading-7">
        {article.content ?? article.summary ?? "No article content available."}
      </div>
    </article>
  );
}
