import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { AppTitleBar } from "@/components/common/AppTitleBar";
import { AddFeedForm } from "@/modules/feeds/components/AddFeedForm";
import { FeedList } from "@/modules/feeds/components/FeedList";
import { useFeeds } from "@/modules/feeds/hooks/useFeeds";
import { ArticleList } from "@/modules/articles/components/ArticleList";
import { ArticleReader } from "@/modules/articles/components/ArticleReader";
import type { ArticleFilter, ArticleSummary } from "@/modules/articles/types";
import { useArticles } from "@/modules/articles/hooks/useArticles";
import { SyncProgress } from "@/modules/sync/components/SyncProgress";
import { useSync } from "@/modules/sync/hooks/useSync";
import { OpmlTools } from "@/modules/opml/components/OpmlTools";

function App() {
  const { feeds, loading: feedsLoading, error: feedsError, refresh, create } = useFeeds();
  const [selectedFeedId, setSelectedFeedId] = useState<number>();
  const [selectedArticle, setSelectedArticle] = useState<ArticleSummary>();
  const [filter, setFilter] = useState<ArticleFilter>("all");
  const { items, loading: articlesLoading, error: articlesError, refresh: refreshArticles, setRead, setStarred } = useArticles(selectedFeedId, filter);
  const sync = useSync();

  useEffect(() => {
    if (selectedFeedId !== undefined && !feeds.some((feed) => feed.id === selectedFeedId)) {
      setSelectedFeedId(undefined);
      setSelectedArticle(undefined);
    }
  }, [feeds, selectedFeedId]);

  useEffect(() => {
    if (selectedArticle) {
      const updatedArticle = items.find((article) => article.id === selectedArticle.id);
      if (updatedArticle) setSelectedArticle(updatedArticle);
    }
  }, [items, selectedArticle]);

  useEffect(() => {
    if (sync.event?.event === "completed") {
      void refresh();
      void refreshArticles();
    }
  }, [refresh, refreshArticles, sync.event]);

  function selectFeed(feedId: number) {
    setSelectedFeedId(feedId);
    setSelectedArticle(undefined);
  }

  async function handleSync() {
    await sync.start(selectedFeedId);
  }

  const showCustomTitleBar =
    !import.meta.env.TAURI_ENV_PLATFORM ||
    import.meta.env.TAURI_ENV_PLATFORM === "windows";

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {showCustomTitleBar ? <AppTitleBar /> : null}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Feed Forge</h1>
            <p className="text-sm text-muted-foreground">本地 RSS 阅读器</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncProgress event={sync.event} error={sync.error} />
            <Button variant="outline" onClick={handleSync}>刷新</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full flex-1 max-w-[1600px] gap-0 lg:grid-cols-[280px_minmax(280px,380px)_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card p-4 lg:border-r lg:border-b-0">
          <AddFeedForm onAdd={create} />
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">订阅源</h2>
              {feedsLoading ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
            </div>
            {feedsError ? <p className="mb-2 text-sm text-destructive" role="alert">{feedsError}</p> : null}
            <FeedList feeds={feeds} selectedFeedId={selectedFeedId} onSelect={selectFeed} />
            <OpmlTools onImported={refresh} />
          </div>
        </aside>

        <section className="flex min-h-[280px] flex-col border-b border-border bg-background lg:border-r lg:border-b-0">
          {selectedFeedId === undefined ? (
            <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">请选择订阅源以查看文章</p>
          ) : articlesLoading ? (
            <p className="p-4 text-sm text-muted-foreground">正在加载文章...</p>
          ) : articlesError ? (
            <p className="p-4 text-sm text-destructive" role="alert">{articlesError}</p>
          ) : (
            <ArticleList
              articles={items}
              filter={filter}
              selectedArticleId={selectedArticle?.id}
              onFilterChange={(nextFilter) => { setFilter(nextFilter); setSelectedArticle(undefined); }}
              onSelect={setSelectedArticle}
            />
          )}
        </section>

        <section className="flex min-h-[320px] bg-card">
          <ArticleReader
            article={selectedArticle}
            onReadChange={(isRead) => selectedArticle && void setRead(selectedArticle.id, isRead)}
            onStarChange={(isStarred) => selectedArticle && void setStarred(selectedArticle.id, isStarred)}
          />
        </section>
      </div>
    </main>
  );
}

export default App;
