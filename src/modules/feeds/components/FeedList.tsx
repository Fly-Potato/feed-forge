import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { buildFeedTree, type FeedTreeGroup } from "../tree";
import type { FeedGroup, FeedSummary } from "../types";

interface FeedListProps {
  groups: FeedGroup[];
  feeds: FeedSummary[];
  selectedFeedId: number | undefined;
  onSelect: (feedId: number) => void;
}

export function FeedList({ groups, feeds, selectedFeedId, onSelect }: FeedListProps) {
  const tree = buildFeedTree(groups, feeds);

  if (tree.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无订阅源</p>;
  }

  return (
    <div className="flex flex-col gap-1" role="tree" aria-label="订阅源">
      {tree.map((group) => (
        <FeedGroupNode
          key={group.id ?? "ungrouped"}
          group={group}
          selectedFeedId={selectedFeedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface FeedGroupNodeProps {
  group: FeedTreeGroup;
  selectedFeedId: number | undefined;
  onSelect: (feedId: number) => void;
}

function FeedGroupNode({ group, selectedFeedId, onSelect }: FeedGroupNodeProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            role="treeitem"
            aria-label={`${group.title}，${group.feeds.length} 个订阅源`}
          />
        }
      >
        <ChevronRight
          aria-hidden="true"
          data-icon="inline-start"
          className={cn("transition-transform motion-reduce:transition-none", open && "rotate-90")}
        />
        <span className="truncate">{group.title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{group.feeds.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-1 pl-4" role="group">
        {group.feeds.map((feed) => (
          <Button
            key={feed.id}
            type="button"
            variant={selectedFeedId === feed.id ? "secondary" : "ghost"}
            className="h-auto w-full min-w-0 flex-col items-start gap-0.5 px-3 py-2"
            role="treeitem"
            aria-selected={selectedFeedId === feed.id}
            onClick={() => onSelect(feed.id)}
          >
            <span className="w-full truncate text-left font-medium">{feed.title}</span>
            <span className="w-full truncate text-left text-xs text-muted-foreground">
              {feed.url}
            </span>
          </Button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
