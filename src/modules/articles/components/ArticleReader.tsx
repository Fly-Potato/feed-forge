import { useEffect, useMemo, useState, type MouseEvent } from "react";
import DOMPurify from "dompurify";
import { openUrl } from "@tauri-apps/plugin-opener";

import { Button } from "@/components/ui/button";

import type { ArticleSummary } from "../types";

interface ArticleReaderProps {
  article: ArticleSummary | undefined;
  onReadChange: (isRead: boolean) => void;
  onStarChange: (isStarred: boolean) => void;
  openLinksInBrowser?: boolean;
}

export function ArticleReader({
  article,
  onReadChange,
  onStarChange,
  openLinksInBrowser = false,
}: ArticleReaderProps) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const body = article?.content ?? article?.summary ?? "暂无文章内容";
  const sanitizedBody = useMemo(
    () =>
      DOMPurify.sanitize(body, {
        USE_PROFILES: { html: true },
        FORBID_ATTR: ["style"],
      }),
    [body],
  );

  useEffect(() => setLinkError(null), [article?.id]);

  function handleContentClick(event: MouseEvent<HTMLDivElement>) {
    if (!openLinksInBrowser || !article || event.defaultPrevented || event.button !== 0) return;

    const target = event.target;
    const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor || !event.currentTarget.contains(anchor)) return;

    let url: URL;
    try {
      url = new URL(anchor.getAttribute("href") ?? "", article.url ?? undefined);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    event.preventDefault();
    setLinkError(null);
    void Promise.resolve()
      .then(() => openUrl(url.href))
      .catch(() => setLinkError("无法在外部浏览器打开链接。"));
  }

  if (!article) {
    return (
      <section className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        请选择文章开始阅读
      </section>
    );
  }

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {article.author ?? "未知作者"}
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
            {article.isStarred ? "取消收藏" : "收藏"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onReadChange(!article.isRead)}>
            {article.isRead ? "标为未读" : "标为已读"}
          </Button>
        </div>
      </div>
      <div
        className="article-content mt-6"
        onClick={handleContentClick}
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
      />
      {linkError ? <p className="mt-4 text-sm text-destructive" role="alert">{linkError}</p> : null}
    </article>
  );
}
