import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { FeedList } from "../components/FeedList";
import { buildFeedTree } from "../tree";
import type { FeedGroup, FeedSummary } from "../types";

const groups: FeedGroup[] = [
  { id: 2, title: "工程" },
  { id: 1, title: "技术" },
];

const feeds: FeedSummary[] = [
  {
    id: 12,
    title: "未归类博客",
    url: "https://example.com/misc.xml",
    siteUrl: null,
    description: null,
    lastSyncedAt: null,
    syncError: null,
    groupId: null,
  },
  {
    id: 11,
    title: "Rust 周刊",
    url: "https://example.com/rust.xml",
    siteUrl: null,
    description: null,
    lastSyncedAt: null,
    syncError: null,
    groupId: 1,
  },
];

describe("buildFeedTree", () => {
  test("keeps empty real groups and appends only one synthetic ungrouped node", () => {
    const tree = buildFeedTree(groups, feeds);

    expect(tree.map((node) => node.title)).toEqual(["工程", "技术", "未分组"]);
    expect(tree[0]).toMatchObject({ id: 2, feeds: [], synthetic: false });
    expect(tree[tree.length - 1]).toMatchObject({ id: null, synthetic: true });
    expect(tree[1].feeds.map((feed) => feed.title)).toEqual(["Rust 周刊"]);
  });
});

describe("FeedList", () => {
  test("renders an accessible two-level tree and separates group toggles from feed selection", async () => {
    const onSelect = vi.fn();
    render(
      <FeedList
        groups={groups}
        feeds={feeds}
        selectedFeedId={11}
        onSelect={onSelect}
      />,
    );

    const tree = screen.getByRole("tree", { name: "订阅源" });
    const technology = within(tree).getByRole("treeitem", { name: /技术/ });
    expect(technology).toHaveAttribute("aria-expanded", "true");
    const selectedFeed = within(tree).getByRole("treeitem", { name: /Rust 周刊/ });
    expect(selectedFeed).toHaveAttribute("aria-selected", "true");
    expect(within(tree).getAllByRole("group")).toHaveLength(3);

    await userEvent.click(technology);
    expect(onSelect).not.toHaveBeenCalled();
    expect(technology).toHaveAttribute("aria-expanded", "false");
    expect(within(tree).queryByRole("treeitem", { name: /Rust 周刊/ })).not.toBeInTheDocument();

    await userEvent.click(technology);
    await userEvent.click(within(tree).getByRole("treeitem", { name: /Rust 周刊/ }));
    expect(onSelect).toHaveBeenCalledWith(11);
  });
});
