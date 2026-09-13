import type { FeedGroup, FeedSummary } from "./types";

export interface FeedTreeGroup {
  id: number | null;
  title: string;
  feeds: FeedSummary[];
  synthetic: boolean;
}

export function buildFeedTree(groups: FeedGroup[], feeds: FeedSummary[]): FeedTreeGroup[] {
  const groupIds = new Set(groups.map((group) => group.id));
  const compareTitles = (left: { title: string }, right: { title: string }) =>
    left.title.localeCompare(right.title, "zh-CN");
  const result: FeedTreeGroup[] = [...groups]
    .sort(compareTitles)
    .map((group) => ({
      ...group,
      feeds: feeds.filter((feed) => feed.groupId === group.id).sort(compareTitles),
      synthetic: false,
    }));
  const ungrouped = feeds
    .filter((feed) => feed.groupId === null || !groupIds.has(feed.groupId))
    .sort(compareTitles);

  if (ungrouped.length > 0) {
    result.push({ id: null, title: "未分组", feeds: ungrouped, synthetic: true });
  }
  return result;
}
