import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { IpcError } from "../../../lib/ipc/errors";
import { articleKeys } from "../../articles/keys";
import { addFeed, listFeeds, removeFeed, updateFeed } from "../ipc";
import { feedKeys } from "../keys";
import type { FeedSummary } from "../types";

export function useFeeds() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: feedKeys.list, queryFn: listFeeds });
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: feedKeys.all }); };

  const add = useMutation({
    mutationFn: addFeed,
    onSuccess: (feed) => queryClient.setQueryData<FeedSummary[]>(feedKeys.list, (current) =>
      current ? [...current, feed].sort((a, b) => a.title.localeCompare(b.title)) : current),
    onSettled: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ feedId, title }: { feedId: number; title: string }) => updateFeed(feedId, title),
    onSuccess: (feed) => queryClient.setQueryData<FeedSummary[]>(feedKeys.list, (current) =>
      current?.map((item) => item.id === feed.id ? feed : item)
        .sort((a, b) => a.title.localeCompare(b.title))),
    onSettled: invalidate,
  });
  const deletion = useMutation({
    mutationFn: removeFeed,
    onSuccess: (_, feedId) => {
      queryClient.setQueryData<FeedSummary[]>(feedKeys.list, (current) => current?.filter((feed) => feed.id !== feedId));
      queryClient.removeQueries({ queryKey: articleKeys.feed(feedId) });
    },
    onSettled: invalidate,
  });

  return {
    feeds: list.data ?? [], loading: list.isPending, error: readError(list.error), status: list.status,
    refresh: () => queryClient.invalidateQueries({ queryKey: feedKeys.list }),
    create: (url: string) => add.mutateAsync(url),
    rename: (feedId: number, title: string) => update.mutateAsync({ feedId, title }),
    remove: (feedId: number) => deletion.mutateAsync(feedId).then(() => {}),
  };
}

function readError(cause: unknown): string | null {
  if (!cause) return null;
  if (cause instanceof IpcError) {
    return cause.message;
  }
  return "无法加载本地订阅源。";
}
