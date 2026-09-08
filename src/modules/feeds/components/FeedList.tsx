import type { FeedSummary } from "../types";

interface FeedListProps {
  feeds: FeedSummary[];
  selectedFeedId: number | undefined;
  onSelect: (feedId: number) => void;
}

export function FeedList({ feeds, selectedFeedId, onSelect }: FeedListProps) {
  if (feeds.length === 0) {
    return <p className="text-sm text-muted-foreground">No feeds yet</p>;
  }

  return (
    <ul className="space-y-1" aria-label="Feeds">
      {feeds.map((feed) => (
        <li key={feed.id}>
          <button
            type="button"
            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
              selectedFeedId === feed.id
                ? "border-primary bg-primary/10"
                : "border-transparent hover:border-border hover:bg-muted"
            }`}
            aria-pressed={selectedFeedId === feed.id}
            onClick={() => onSelect(feed.id)}
          >
            <span className="block truncate font-medium">{feed.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {feed.url}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
