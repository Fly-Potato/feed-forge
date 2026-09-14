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
  test("offers group creation when the subscription tree is empty", async () => {
    const user = userEvent.setup();
    render(
      <FeedList
        groups={[]}
        feeds={[]}
        selectedFeedId={undefined}
        onSelect={vi.fn()}
        onCreateGroup={vi.fn()}
        onRenameGroup={vi.fn()}
        onRemoveFeed={vi.fn()}
      />,
    );

    expect(screen.getByText("暂无订阅源")).toBeInTheDocument();
    const tree = screen.getByRole("tree", { name: "订阅源" });
    await user.pointer([{ target: tree }, "[MouseRight]"]);
    expect(screen.getByRole("menuitem", { name: "新建分组" })).toBeInTheDocument();
  });

  test("renders an accessible two-level tree and separates group toggles from feed selection", async () => {
    const onSelect = vi.fn();
    render(
      <FeedList
        groups={groups}
        feeds={feeds}
        selectedFeedId={11}
        onSelect={onSelect}
        onCreateGroup={vi.fn()}
        onRenameGroup={vi.fn()}
        onRemoveFeed={vi.fn()}
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

  test("shows context actions that match the right-clicked tree target", async () => {
    const user = userEvent.setup();
    render(
      <FeedList
        groups={groups}
        feeds={feeds}
        selectedFeedId={undefined}
        onSelect={vi.fn()}
        onCreateGroup={vi.fn()}
        onRenameGroup={vi.fn()}
        onRemoveFeed={vi.fn()}
      />,
    );

    const tree = screen.getByRole("tree", { name: "订阅源" });
    const technology = within(tree).getByRole("treeitem", { name: /技术/ });
    await user.pointer([{ target: technology }, "[MouseRight]"]);
    expect(screen.getByRole("menuitem", { name: "重命名分组" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "新建分组" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "删除订阅" })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    const feed = within(tree).getByRole("treeitem", { name: /Rust 周刊/ });
    await user.pointer([{ target: feed }, "[MouseRight]"]);
    expect(screen.getByRole("menuitem", { name: "删除订阅" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "重命名分组" })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    const ungrouped = within(tree).getByRole("treeitem", { name: /未分组/ });
    await user.pointer([{ target: ungrouped }, "[MouseRight]"]);
    expect(screen.getByRole("menuitem", { name: "新建分组" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "重命名分组" })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.pointer([{ target: tree }, "[MouseRight]"]);
    expect(screen.getByRole("menuitem", { name: "新建分组" })).toBeInTheDocument();
  });

  test("creates and renames groups from the context menu dialogs", async () => {
    const user = userEvent.setup();
    const onCreateGroup = vi.fn().mockResolvedValue(undefined);
    const onRenameGroup = vi.fn().mockResolvedValue(undefined);
    render(
      <FeedList
        groups={groups}
        feeds={feeds}
        selectedFeedId={undefined}
        onSelect={vi.fn()}
        onCreateGroup={onCreateGroup}
        onRenameGroup={onRenameGroup}
        onRemoveFeed={vi.fn()}
      />,
    );

    const tree = screen.getByRole("tree", { name: "订阅源" });
    await user.pointer([
      { target: within(tree).getByRole("treeitem", { name: /技术/ }) },
      "[MouseRight]",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "重命名分组" }));

    const renameDialog = screen.getByRole("dialog", { name: "重命名分组" });
    const renameInput = within(renameDialog).getByRole("textbox", { name: "分组名称" });
    expect(renameInput).toHaveValue("技术");
    await user.clear(renameInput);
    await user.type(renameInput, "  新技术  ");
    await user.click(within(renameDialog).getByRole("button", { name: "保存" }));
    expect(onRenameGroup).toHaveBeenCalledWith(1, "新技术");
    expect(screen.queryByRole("dialog", { name: "重命名分组" })).not.toBeInTheDocument();

    await user.pointer([{ target: tree }, "[MouseRight]"]);
    await user.click(screen.getByRole("menuitem", { name: "新建分组" }));
    const createDialog = screen.getByRole("dialog", { name: "新建分组" });
    await user.click(within(createDialog).getByRole("button", { name: "创建" }));
    expect(within(createDialog).getByRole("alert")).toHaveTextContent("请输入分组名称。");
    expect(onCreateGroup).not.toHaveBeenCalled();

    await user.type(within(createDialog).getByRole("textbox", { name: "分组名称" }), "  阅读  ");
    await user.click(within(createDialog).getByRole("button", { name: "创建" }));
    expect(onCreateGroup).toHaveBeenCalledWith("阅读");
    expect(screen.queryByRole("dialog", { name: "新建分组" })).not.toBeInTheDocument();
  });

  test("keeps delete confirmation open and reports a failed removal", async () => {
    const user = userEvent.setup();
    const onRemoveFeed = vi.fn()
      .mockRejectedValueOnce(new Error("无法删除该订阅。"))
      .mockResolvedValueOnce(undefined);
    render(
      <FeedList
        groups={groups}
        feeds={feeds}
        selectedFeedId={11}
        onSelect={vi.fn()}
        onCreateGroup={vi.fn()}
        onRenameGroup={vi.fn()}
        onRemoveFeed={onRemoveFeed}
      />,
    );

    const tree = screen.getByRole("tree", { name: "订阅源" });
    await user.pointer([
      { target: within(tree).getByRole("treeitem", { name: /Rust 周刊/ }) },
      "[MouseRight]",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "删除订阅" }));

    const confirmation = screen.getByRole("alertdialog", { name: "删除订阅源？" });
    expect(confirmation).toHaveTextContent("Rust 周刊");
    await user.click(within(confirmation).getByRole("button", { name: "确认删除" }));
    expect(onRemoveFeed).toHaveBeenCalledWith(11);
    expect(within(confirmation).getByRole("alert")).toHaveTextContent("无法删除该订阅。");
    expect(screen.getByRole("alertdialog", { name: "删除订阅源？" })).toBeInTheDocument();

    await user.click(within(confirmation).getByRole("button", { name: "确认删除" }));
    expect(onRemoveFeed).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alertdialog", { name: "删除订阅源？" })).not.toBeInTheDocument();
  });
});
