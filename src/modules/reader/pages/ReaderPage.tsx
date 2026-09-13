import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppTitleBar } from "@/components/common/AppTitleBar";
import { FeedList } from "@/modules/feeds/components/FeedList";
import { useFeeds } from "@/modules/feeds/hooks/useFeeds";
import { ArticleList } from "@/modules/articles/components/ArticleList";
import { ArticleReader } from "@/modules/articles/components/ArticleReader";
import { useArticles } from "@/modules/articles/hooks/useArticles";
import { SyncProgress } from "@/modules/sync/components/SyncProgress";
import { useSync } from "@/modules/sync/hooks/useSync";
import { SettingsDialog } from "@/modules/settings/components/SettingsDialog";
import { useSettings } from "@/modules/settings/hooks/useSettings";
import { useReaderStore } from "../store";

const FEEDS_COLLAPSE_BREAKPOINT = 900;
const ARTICLES_COLLAPSE_BREAKPOINT = 700;

function useNarrowViewport(maxWidth: number) {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth <= maxWidth);
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth <= maxWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [maxWidth]);
  return isNarrow;
}

export function ReaderPage() {
  const selectedFeedId = useReaderStore((state) => state.selectedFeedId);
  const selectedArticleId = useReaderStore((state) => state.selectedArticleId);
  const filter = useReaderStore((state) => state.filter);
  const selectFeed = useReaderStore((state) => state.selectFeed);
  const selectArticle = useReaderStore((state) => state.selectArticle);
  const setFilter = useReaderStore((state) => state.setFilter);
  const clearFeedIfSelected = useReaderStore((state) => state.clearFeedIfSelected);
  const clearMissingFeed = useReaderStore((state) => state.clearMissingFeed);
  const clearMissingArticle = useReaderStore((state) => state.clearMissingArticle);
  const { feeds, loading: feedsLoading, error: feedsError, status: feedsStatus, create, rename, remove } = useFeeds();
  const { items, loading: articlesLoading, error: articlesError, status: articlesStatus, setRead, setStarred } = useArticles(selectedFeedId, filter);
  const selectedArticle = items.find((article) => article.id === selectedArticleId);
  const [articleActionError, setArticleActionError] = useState<string | null>(null);
  const sync = useSync();
  const settingsState = useSettings();
  const feedsAutoCollapsed = useNarrowViewport(FEEDS_COLLAPSE_BREAKPOINT);
  const articlesAutoCollapsed = useNarrowViewport(ARTICLES_COLLAPSE_BREAKPOINT);
  const [feedsCollapsed, setFeedsCollapsed] = useState(feedsAutoCollapsed);
  const [articlesCollapsed, setArticlesCollapsed] = useState(articlesAutoCollapsed);

  useEffect(() => setFeedsCollapsed(feedsAutoCollapsed), [feedsAutoCollapsed]);
  useEffect(() => setArticlesCollapsed(articlesAutoCollapsed), [articlesAutoCollapsed]);

  useEffect(() => {
    if (feedsStatus === "success") clearMissingFeed(feeds.map((feed) => feed.id));
  }, [feedsStatus, feeds, clearMissingFeed]);

  useEffect(() => {
    if (selectedFeedId !== undefined && articlesStatus === "success")
      clearMissingArticle(items.map((article) => article.id));
  }, [articlesStatus, selectedFeedId, items, clearMissingArticle]);

  useEffect(() => { setArticleActionError(null); }, [selectedFeedId, selectedArticleId, filter]);

  useEffect(() => {
    if (!settingsState.settings) return;
    const timer = window.setInterval(
      () => void sync.start(),
      settingsState.settings.refreshIntervalMinutes * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [settingsState.settings?.refreshIntervalMinutes, sync.start]);

  async function removeSelected(feedId: number) {
    await remove(feedId);
    clearFeedIfSelected(feedId);
  }

  async function changeArticle(action: () => Promise<unknown>) {
    setArticleActionError(null);
    try { await action(); }
    catch (cause) { setArticleActionError(cause instanceof Error ? cause.message : "无法更新文章。"); }
  }

  const showCustomTitleBar =
    !import.meta.env.TAURI_ENV_PLATFORM || import.meta.env.TAURI_ENV_PLATFORM === "windows";

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {showCustomTitleBar ? <AppTitleBar /> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-auto" role="region" aria-label="应用内容">
        <header className="border-b border-border bg-card">
          <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Feed Forge</h1>
              <p className="text-sm text-muted-foreground">本地 RSS 阅读器</p>
            </div>
            <div className="flex items-center gap-3">
              <SyncProgress event={sync.event} error={sync.error} />
              <Button variant="outline" onClick={() => void sync.start(selectedFeedId)}>刷新</Button>
              <SettingsDialog
                feeds={feeds}
                feedsLoading={feedsLoading}
                feedsError={feedsError}
                onAddFeed={create}
                onRenameFeed={rename}
                onRemoveFeed={removeSelected}
                settings={settingsState.settings}
                settingsLoading={settingsState.loading}
                settingsError={settingsState.error}
                onSaveSettings={settingsState.save}
              />
            </div>
          </div>
        </header>

        <div
          className="grid min-w-0 w-full flex-1 gap-0"
          role="group"
          aria-label="主布局"
          style={{
            gridTemplateColumns: `${feedsCollapsed ? "48px" : "280px"} ${articlesCollapsed ? "48px" : "minmax(280px, 380px)"} minmax(0, 1fr)`,
          }}
        >
          <aside className={`border-border bg-card ${feedsCollapsed ? "flex items-start justify-center border-r p-2" : "border-r p-4"}`} aria-label="订阅源面板">
            <div className={feedsCollapsed ? undefined : "mb-2 flex items-center justify-between gap-2"}>
              {!feedsCollapsed ? <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">订阅源</h2> : null}
              <Button
                variant="ghost" size="icon-sm"
                aria-label={feedsCollapsed ? "展开订阅源栏" : "折叠订阅源栏"}
                title={feedsCollapsed ? "展开订阅源栏" : "折叠订阅源栏"}
                aria-expanded={!feedsCollapsed}
                onClick={() => setFeedsCollapsed((collapsed) => !collapsed)}
              >
                {feedsCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
              </Button>
            </div>
            {!feedsCollapsed ? (
              <div>
                {feedsLoading ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
                {feedsError ? <p className="mb-2 text-sm text-destructive" role="alert">{feedsError}</p> : null}
                <FeedList feeds={feeds} selectedFeedId={selectedFeedId} onSelect={selectFeed} />
              </div>
            ) : null}
          </aside>

          <section className={`flex min-h-0 flex-col border-border bg-background ${articlesCollapsed ? "items-center border-r p-2" : "border-r"}`} aria-label="文章列表面板">
            <div className={articlesCollapsed ? undefined : "flex shrink-0 justify-end border-b border-border px-2 py-1"}>
              <Button
                variant="ghost" size="icon-sm"
                aria-label={articlesCollapsed ? "展开文章列表栏" : "折叠文章列表栏"}
                title={articlesCollapsed ? "展开文章列表栏" : "折叠文章列表栏"}
                aria-expanded={!articlesCollapsed}
                onClick={() => setArticlesCollapsed((collapsed) => !collapsed)}
              >
                {articlesCollapsed ? <PanelRightOpen aria-hidden="true" /> : <PanelRightClose aria-hidden="true" />}
              </Button>
            </div>
            {!articlesCollapsed ? (
              <>
                {selectedFeedId === undefined ? (
                  <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">请选择订阅源以查看文章</p>
                ) : articlesLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">正在加载文章...</p>
                ) : articlesError ? (
                  <p className="p-4 text-sm text-destructive" role="alert">{articlesError}</p>
                ) : (
                  <ArticleList
                    articles={items} filter={filter} selectedArticleId={selectedArticleId}
                    onFilterChange={setFilter} onSelect={selectArticle}
                  />
                )}
              </>
            ) : null}
          </section>

          <section className="flex min-h-[320px] flex-col bg-card">
            <ArticleReader
              article={selectedArticle}
              onReadChange={(isRead) => selectedArticle && void changeArticle(() => setRead(selectedArticle.id, isRead))}
              onStarChange={(isStarred) => selectedArticle && void changeArticle(() => setStarred(selectedArticle.id, isStarred))}
              openLinksInBrowser={settingsState.settings?.openLinksInBrowser}
            />
            {articleActionError ? <p className="p-4 text-sm text-destructive" role="alert">{articleActionError}</p> : null}
          </section>
        </div>
      </div>
    </main>
  );
}
