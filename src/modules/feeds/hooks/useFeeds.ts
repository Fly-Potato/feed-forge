import { useCallback, useEffect, useState } from "react";

import { IpcError } from "../../../lib/ipc/errors";
import { addFeed, listFeeds, removeFeed, updateFeed } from "../ipc";
import type { FeedSummary } from "../types";

export function useFeeds() {
  const [feeds, setFeeds] = useState<FeedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setFeeds(await listFeeds());
      setError(null);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (url: string) => {
    const feed = await addFeed(url);
    setFeeds((current) => [...current, feed].sort((a, b) => a.title.localeCompare(b.title)));
    return feed;
  }, []);

  const remove = useCallback(async (feedId: number) => {
    await removeFeed(feedId);
    setFeeds((current) => current.filter((feed) => feed.id !== feedId));
  }, []);

  const rename = useCallback(async (feedId: number, title: string) => {
    const feed = await updateFeed(feedId, title);
    setFeeds((current) =>
      current
        .map((item) => (item.id === feedId ? feed : item))
        .sort((a, b) => a.title.localeCompare(b.title)),
    );
    return feed;
  }, []);

  return { feeds, loading, error, refresh, create, rename, remove };
}

function readError(cause: unknown): string {
  if (cause instanceof IpcError) {
    return cause.message;
  }
  return "无法加载本地订阅源。";
}
