import { useEffect, useRef, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  RefreshCw,
} from "lucide-react";

import { AppTitleBar } from "@/components/common/AppTitleBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArticleList } from "@/modules/articles/components/ArticleList";
import { ArticleReader } from "@/modules/articles/components/ArticleReader";
import { useArticles } from "@/modules/articles/hooks/useArticles";
import type { ArticleFilter, ArticleSummary } from "@/modules/articles/types";
import { AddFeedDialog } from "@/modules/feeds/components/AddFeedDialog";
import { FeedList } from "@/modules/feeds/components/FeedList";
import { useFeeds } from "@/modules/feeds/hooks/useFeeds";
import { SettingsDialog } from "@/modules/settings/components/SettingsDialog";
import { useSettings } from "@/modules/settings/hooks/useSettings";
import { SyncProgress } from "@/modules/sync/components/SyncProgress";
import { useSync } from "@/modules/sync/hooks/useSync";
import { UpdatePrompt } from "@/modules/updater/components/UpdatePrompt";
import { useUpdater } from "@/modules/updater/hooks/useUpdater";

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
  const {
    feeds,
    groups,
    loading: feedsLoading,
    error: feedsError,
    status: feedsStatus,
    create,
    rename,
    remove,
    move,
    createGroup,
    renameGroup,
    removeGroup,
  } = useFeeds();
  const {
    items,
    loading: articlesLoading,
    error: articlesError,
    status: articlesStatus,
    setRead,
    setStarred,
  } = useArticles(selectedFeedId, filter);
  const [retainedArticle, setRetainedArticle] = useState<ArticleSummary | undefined>();
  const selectionGeneration = useRef(0);
  const pendingReads = useRef(new Map<number, {
    desired: boolean;
    result: Promise<ArticleSummary>;
    settled: Promise<void>;
  }>());
  const selectedArticle = items.find((article) => article.id === selectedArticleId)
    ?? (retainedArticle?.id === selectedArticleId ? retainedArticle : undefined);
  const [articleActionError, setArticleActionError] = useState<string | null>(null);
  const sync = useSync();
  const settingsState = useSettings();
  const updater = useUpdater({ autoCheck: import.meta.env.PROD });
  const feedsAutoCollapsed = useNarrowViewport(FEEDS_COLLAPSE_BREAKPOINT);
  const articlesAutoCollapsed = useNarrowViewport(ARTICLES_COLLAPSE_BREAKPOINT);
  const [feedsCollapsed, setFeedsCollapsed] = useState(feedsAutoCollapsed);
  const [articlesCollapsed, setArticlesCollapsed] = useState(articlesAutoCollapsed);

  useEffect(() => setFeedsCollapsed(feedsAutoCollapsed), [feedsAutoCollapsed]);
  useEffect(() => setArticlesCollapsed(articlesAutoCollapsed), [articlesAutoCollapsed]);

  useEffect(() => {
    if (feedsStatus !== "success") return;
    const feedIds = feeds.map((feed) => feed.id);
    if (selectedFeedId !== undefined && !feedIds.includes(selectedFeedId)) {
      selectionGeneration.current++;
      setRetainedArticle(undefined);
    }
    clearMissingFeed(feedIds);
  }, [feedsStatus, feeds, selectedFeedId, clearMissingFeed]);

  useEffect(() => {
    const retainsFilteredArticle = filter !== "all" && retainedArticle?.id === selectedArticleId;
    if (selectedFeedId === undefined || articlesStatus !== "success" || retainsFilteredArticle) return;
    const articleIds = items.map((article) => article.id);
    if (selectedArticleId !== undefined && !articleIds.includes(selectedArticleId)) {
      selectionGeneration.current++;
      setRetainedArticle(undefined);
    }
    clearMissingArticle(articleIds);
  }, [articlesStatus, selectedFeedId, selectedArticleId, filter, items, retainedArticle, clearMissingArticle]);

  useEffect(() => {
    if (selectedArticleId === undefined) setRetainedArticle(undefined);
  }, [selectedArticleId]);

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
    if (selectedFeedId === feedId) {
      selectionGeneration.current++;
      setRetainedArticle(undefined);
    }
    clearFeedIfSelected(feedId);
  }

  async function changeArticle(
    articleId: number,
    action: () => Promise<ArticleSummary>,
    generation = selectionGeneration.current,
  ) {
    if (generation === selectionGeneration.current) setArticleActionError(null);
    try {
      const updatedArticle = await action();
      if (
        generation !== selectionGeneration.current
        || useReaderStore.getState().selectedArticleId !== articleId
      ) return;
      setRetainedArticle((current) => current?.id === articleId ? updatedArticle : current);
    }
    catch (cause) {
      if (
        generation === selectionGeneration.current
        && useReaderStore.getState().selectedArticleId === articleId
      ) setArticleActionError(cause instanceof Error ? cause.message : "无法更新文章。");
    }
  }

  function queueReadChange(articleId: number, isRead: boolean) {
    const previous = pendingReads.current.get(articleId)?.settled ?? Promise.resolve();
    const result = previous.then(() => setRead(articleId, isRead));
    const settled = result.then(() => undefined, () => undefined);
    const pending = { desired: isRead, result, settled };
    pendingReads.current.set(articleId, pending);
    void settled.then(() => {
      if (pendingReads.current.get(articleId) === pending) pendingReads.current.delete(articleId);
    });
    return result;
  }

  function openArticle(articleId: number) {
    const article = items.find((item) => item.id === articleId);
    if (!article) return;
    const isNewSelection = selectedArticleId !== articleId;
    if (isNewSelection) selectionGeneration.current++;
    const generation = selectionGeneration.current;
    selectArticle(articleId);
    setRetainedArticle(article);
    if (!isNewSelection) return;

    const pending = pendingReads.current.get(articleId);
    if (pending?.desired === true) {
      void changeArticle(articleId, () => pending.result, generation);
    } else if (!(pending?.desired ?? article.isRead)) {
      void changeArticle(articleId, () => queueReadChange(articleId, true), generation);
    }
  }

  function selectReaderFeed(feedId: number) {
    selectionGeneration.current++;
    setRetainedArticle(undefined);
    selectFeed(feedId);
  }

  function changeFilter(nextFilter: ArticleFilter) {
    selectionGeneration.current++;
    setRetainedArticle(undefined);
    setFilter(nextFilter);
  }

  const showCustomTitleBar =
    !import.meta.env.TAURI_ENV_PLATFORM || import.meta.env.TAURI_ENV_PLATFORM === "windows";
  const groupsForDisplay = groups ?? [];
  const syncingAll = sync.isRunning && sync.targetFeedId === undefined;
  const syncingCurrent = sync.isRunning && sync.targetFeedId === selectedFeedId && selectedFeedId !== undefined;

  const syncAllButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="同步全部订阅源"
      title="同步全部订阅源"
      aria-busy={syncingAll}
      disabled={sync.isRunning}
      onClick={() => void sync.start()}
    >
      <RefreshCw
        aria-hidden="true"
        data-icon="inline-start"
        className={cn(syncingAll && "animate-spin motion-reduce:animate-none")}
      />
    </Button>
  );

  const settingsDialog = (
    <SettingsDialog
      feeds={feeds}
      feedGroups={groupsForDisplay}
      feedsLoading={feedsLoading}
      feedsError={feedsError}
      onAddFeed={create}
      onRenameFeed={rename}
      onRemoveFeed={removeSelected}
      onCreateFeedGroup={createGroup}
      onRenameFeedGroup={renameGroup}
      onRemoveFeedGroup={removeGroup}
      onMoveFeed={move}
      settings={settingsState.settings}
      settingsLoading={settingsState.loading}
      settingsError={settingsState.error}
      onSaveSettings={settingsState.save}
      updater={updater}
    />
  );

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <UpdatePrompt updater={updater} />
      {showCustomTitleBar ? <AppTitleBar /> : null}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden" role="region" aria-label="应用内容">
        <div
          className="grid min-h-0 min-w-0 w-full flex-1 gap-0"
          role="group"
          aria-label="主布局"
          style={{
            gridTemplateColumns: `${feedsCollapsed ? "48px" : "280px"} ${articlesCollapsed ? "48px" : "minmax(280px, 380px)"} minmax(0, 1fr)`,
          }}
        >
          <aside
            className={cn(
              "flex min-h-0 flex-col border-r border-border bg-card",
              feedsCollapsed ? "items-center p-2" : "p-3",
            )}
            aria-label="订阅源面板"
          >
            <div className={cn("flex shrink-0 gap-1", feedsCollapsed ? "flex-col items-center" : "items-center") }>
              <h2 className={feedsCollapsed ? "sr-only" : "mr-auto text-sm font-semibold text-muted-foreground"}>订阅源</h2>
              <AddFeedDialog groups={groupsForDisplay} onAdd={create} />
              {syncAllButton}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={feedsCollapsed ? "展开订阅源栏" : "折叠订阅源栏"}
                title={feedsCollapsed ? "展开订阅源栏" : "折叠订阅源栏"}
                aria-expanded={!feedsCollapsed}
                onClick={() => setFeedsCollapsed((collapsed) => !collapsed)}
              >
                {feedsCollapsed
                  ? <PanelLeftOpen aria-hidden="true" data-icon="inline-start" />
                  : <PanelLeftClose aria-hidden="true" data-icon="inline-start" />}
              </Button>
            </div>

            <div className={feedsCollapsed ? "sr-only" : "shrink-0 py-1"}>
              <SyncProgress event={sync.event} error={sync.error} />
            </div>

            {!feedsCollapsed ? (
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {feedsLoading ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
                {feedsError ? <p className="mb-2 text-sm text-destructive" role="alert">{feedsError}</p> : null}
                {!feedsLoading ? (
                  <FeedList
                    groups={groupsForDisplay}
                    feeds={feeds}
                    selectedFeedId={selectedFeedId}
                    onSelect={selectReaderFeed}
                    onCreateGroup={createGroup}
                    onRenameGroup={renameGroup}
                    onRemoveFeed={removeSelected}
                  />
                ) : null}
              </div>
            ) : null}

            <div className={cn("mt-auto shrink-0", !feedsCollapsed && "pt-2")}>
              {settingsDialog}
            </div>
          </aside>

          <section
            className={cn(
              "flex min-h-0 flex-col border-r border-border bg-background",
              articlesCollapsed && "items-center p-2",
            )}
            aria-label="文章列表面板"
          >
            {articlesCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="同步当前订阅源"
                  title="同步当前订阅源"
                  aria-busy={syncingCurrent}
                  disabled={selectedFeedId === undefined || sync.isRunning}
                  onClick={() => selectedFeedId !== undefined && void sync.start(selectedFeedId)}
                >
                  <RefreshCw
                    aria-hidden="true"
                    data-icon="inline-start"
                    className={cn(syncingCurrent && "animate-spin motion-reduce:animate-none")}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="展开文章列表栏"
                  title="展开文章列表栏"
                  aria-expanded="false"
                  onClick={() => setArticlesCollapsed(false)}
                >
                  <PanelRightOpen aria-hidden="true" data-icon="inline-start" />
                </Button>
              </div>
            ) : (
              <ArticleList
                articles={items}
                filter={filter}
                selectedArticleId={selectedArticleId}
                feedSelected={selectedFeedId !== undefined}
                loading={articlesLoading}
                error={articlesError}
                refreshing={syncingCurrent}
                refreshDisabled={sync.isRunning}
                onFilterChange={changeFilter}
                onSelect={openArticle}
                onRefresh={() => selectedFeedId !== undefined && void sync.start(selectedFeedId)}
                onCollapse={() => setArticlesCollapsed(true)}
              />
            )}
          </section>

          <section className="flex min-h-[320px] flex-col bg-card">
            <ArticleReader
              article={selectedArticle}
              onReadChange={(isRead) => selectedArticle && void changeArticle(selectedArticle.id, () => queueReadChange(selectedArticle.id, isRead))}
              onStarChange={(isStarred) => selectedArticle && void changeArticle(selectedArticle.id, () => setStarred(selectedArticle.id, isStarred))}
              openLinksInBrowser={settingsState.settings?.openLinksInBrowser}
            />
            {articleActionError ? <p className="p-4 text-sm text-destructive" role="alert">{articleActionError}</p> : null}
          </section>
        </div>
      </div>
    </main>
  );
}
