import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SubscriptionManager } from "../components/SubscriptionManager";
import type { FeedGroup, FeedSummary } from "../types";

const groups: FeedGroup[] = [{ id: 3, title: "技术" }];
const feeds: FeedSummary[] = [{
  id: 7,
  title: "OpenAI",
  url: "https://example.com/feed.xml",
  siteUrl: null,
  description: null,
  lastSyncedAt: null,
  syncError: null,
  groupId: 3,
}];

function props() {
  return {
    groups,
    feeds,
    loading: false,
    error: null,
    onAdd: vi.fn().mockResolvedValue(undefined),
    onRename: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    onCreateGroup: vi.fn().mockResolvedValue(undefined),
    onRenameGroup: vi.fn().mockResolvedValue(undefined),
    onRemoveGroup: vi.fn().mockResolvedValue(undefined),
    onMoveFeed: vi.fn().mockResolvedValue(undefined),
    onBusyChange: vi.fn(),
  };
}

describe("SubscriptionManager", () => {
  test("adds a feed to the selected group", async () => {
    const callbacks = props();
    render(<SubscriptionManager {...callbacks} />);

    await userEvent.click(screen.getByRole("combobox", { name: "添加到分组" }));
    await userEvent.click(await screen.findByRole("option", { name: "技术" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "订阅源地址" }),
      "https://example.com/new.xml",
    );
    await userEvent.click(screen.getByRole("button", { name: "添加订阅" }));

    expect(callbacks.onAdd).toHaveBeenCalledWith("https://example.com/new.xml", 3);
    await waitFor(() => expect(callbacks.onBusyChange).toHaveBeenLastCalledWith(false));
    expect(callbacks.onBusyChange).toHaveBeenCalledWith(true);
  });

  test("creates and renames trimmed groups and confirms safe group removal", async () => {
    const callbacks = props();
    render(<SubscriptionManager {...callbacks} />);

    await userEvent.type(screen.getByRole("textbox", { name: "新分组名称" }), "  设计  ");
    await userEvent.click(screen.getByRole("button", { name: "创建分组" }));
    expect(callbacks.onCreateGroup).toHaveBeenCalledWith("设计");

    await userEvent.click(screen.getByRole("button", { name: "重命名分组 技术" }));
    const title = screen.getByRole("textbox", { name: "分组名称 技术" });
    await userEvent.clear(title);
    await userEvent.type(title, "  工程  ");
    await userEvent.click(screen.getByRole("button", { name: "保存分组名称" }));
    expect(callbacks.onRenameGroup).toHaveBeenCalledWith(3, "工程");

    await userEvent.click(screen.getByRole("button", { name: "删除分组 技术" }));
    expect(screen.getByRole("alertdialog", { name: "删除分组？" })).toHaveTextContent(
      "组内订阅源会保留并移动到未分组",
    );
    await userEvent.click(screen.getByRole("button", { name: "确认删除分组" }));
    expect(callbacks.onRemoveGroup).toHaveBeenCalledWith(3);
    await waitFor(() => expect(callbacks.onBusyChange).toHaveBeenLastCalledWith(false));
  });

  test("moves an existing feed to the ungrouped node", async () => {
    const callbacks = props();
    render(<SubscriptionManager {...callbacks} />);

    await userEvent.click(screen.getByRole("combobox", { name: "OpenAI 的分组" }));
    await userEvent.click(await screen.findByRole("option", { name: "未分组" }));

    expect(callbacks.onMoveFeed).toHaveBeenCalledWith(7, null);
    await waitFor(() => expect(callbacks.onBusyChange).toHaveBeenLastCalledWith(false));
    expect(callbacks.onBusyChange).toHaveBeenCalledWith(true);
  });
});
