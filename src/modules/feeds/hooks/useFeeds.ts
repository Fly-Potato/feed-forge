import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { IpcError } from "../../../lib/ipc/errors";
import { articleKeys } from "../../articles/keys";
import {
  addFeed,
  createFeedGroup,
  listFeedGroups,
  listFeeds,
  moveFeed,
  removeFeed,
  removeFeedGroup,
  updateFeed,
  updateFeedGroup,
} from "../ipc";
import { feedKeys } from "../keys";
import type { FeedSummary } from "../types";

export function useFeeds() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: feedKeys.list, queryFn: listFeeds });
  const groups = useQuery({ queryKey: feedKeys.groups, queryFn: listFeedGroups });
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: feedKeys.all }); };

  const add = useMutation({
    mutationFn: ({ url, groupId }: { url: string; groupId: number | null }) => addFeed(url, groupId),
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
  const move = useMutation({
    mutationFn: ({ feedId, groupId }: { feedId: number; groupId: number | null }) => moveFeed(feedId, groupId),
    onSuccess: (feed) => queryClient.setQueryData<FeedSummary[]>(feedKeys.list, (current) =>
      current?.map((item) => item.id === feed.id ? feed : item)),
    onSettled: invalidate,
  });
  const groupCreation = useMutation({ mutationFn: createFeedGroup, onSettled: invalidate });
  const groupUpdate = useMutation({
    mutationFn: ({ groupId, title }: { groupId: number; title: string }) => updateFeedGroup(groupId, title),
    onSettled: invalidate,
  });
  const groupDeletion = useMutation({ mutationFn: removeFeedGroup, onSettled: invalidate });

  return {
    feeds: list.data ?? [],
    groups: groups.data,
    loading: list.isPending || groups.isPending,
    error: readError(list.error ?? groups.error),
    status: list.status,
    refresh: () => queryClient.invalidateQueries({ queryKey: feedKeys.list }),
    create: (url: string, groupId: number | null) => add.mutateAsync({ url, groupId }),
    rename: (feedId: number, title: string) => update.mutateAsync({ feedId, title }),
    remove: (feedId: number) => deletion.mutateAsync(feedId).then(() => {}),
    move: (feedId: number, groupId: number | null) => move.mutateAsync({ feedId, groupId }),
    createGroup: (title: string) => groupCreation.mutateAsync(title),
    renameGroup: (groupId: number, title: string) => groupUpdate.mutateAsync({ groupId, title }),
    removeGroup: (groupId: number) => groupDeletion.mutateAsync(groupId).then(() => {}),
  };
}

function readError(cause: unknown): string | null {
  if (!cause) return null;
  if (cause instanceof IpcError) {
    return cause.message;
  }
  return "无法加载本地订阅源。";
}
