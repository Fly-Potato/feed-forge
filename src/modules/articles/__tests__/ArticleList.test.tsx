import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ArticleList } from "../components/ArticleList";
import type { ArticleSummary } from "../types";

const article: ArticleSummary = {
  id: 11,
  feedId: 7,
  guid: "11",
  url: null,
  title: "文章",
  author: null,
  summary: null,
  content: null,
  publishedAt: null,
  isRead: false,
  isStarred: false,
};

function props() {
  return {
    articles: [] as ArticleSummary[],
    filter: "all" as const,
    selectedArticleId: undefined,
    feedSelected: false,
    loading: false,
    error: null,
    refreshing: false,
    onFilterChange: vi.fn(),
    onSelect: vi.fn(),
    onRefresh: vi.fn(),
    onCollapse: vi.fn(),
  };
}

describe("ArticleList", () => {
  test("renders HTML summaries as clamped plain text with an empty fallback", () => {
    const htmlSummaryArticle = {
      ...article,
      summary: "<p>第一段 <strong>重点</strong></p><script>不应显示</script><p>第二段</p>",
    };
    const emptySummaryArticle = {
      ...article,
      id: 12,
      title: "空摘要文章",
      summary: "<style>.hidden { display: none; }</style><script>不应显示</script>",
    };

    render(
      <ArticleList
        {...props()}
        feedSelected
        articles={[htmlSummaryArticle, emptySummaryArticle]}
      />,
    );

    const summary = screen.getByText("第一段 重点 第二段");
    expect(summary).not.toHaveTextContent(/<p>|<strong>/);
    expect(summary).not.toHaveTextContent("不应显示");
    expect(summary).toHaveClass("line-clamp-2");
    expect(summary).toHaveClass("break-words");
    expect(summary).not.toHaveClass("block");
    expect(screen.getByRole("button", { name: "空摘要文章暂无摘要" })).toBeInTheDocument();
  });

  test("keeps one toolbar visible for every article-list state", () => {
    const initial = props();
    const view = render(<ArticleList {...initial} />);
    expect(screen.getByRole("heading", { name: "文章" })).toBeInTheDocument();
    const refresh = screen.getByRole("button", { name: "同步当前订阅源" });
    expect(refresh).toBeDisabled();
    expect(refresh).toHaveTextContent("");
    expect(screen.getByText("请选择订阅源以查看文章")).toBeInTheDocument();

    view.rerender(<ArticleList {...props()} feedSelected loading />);
    expect(screen.getByText("正在加载文章...")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "文章" })).toBeInTheDocument();

    view.rerender(<ArticleList {...props()} feedSelected refreshing />);
    expect(screen.getByRole("button", { name: "同步当前订阅源" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "同步当前订阅源" })).toHaveAttribute("aria-busy", "true");

    view.rerender(<ArticleList {...props()} feedSelected error="读取文章失败。" />);
    expect(screen.getByRole("alert")).toHaveTextContent("读取文章失败。");

    view.rerender(<ArticleList {...props()} feedSelected />);
    expect(screen.getByText("暂无文章")).toBeInTheDocument();

    view.rerender(<ArticleList {...props()} feedSelected articles={[article]} />);
    expect(screen.getByRole("button", { name: /^文章暂无摘要$/ })).toBeInTheDocument();
  });

  test("exposes filters, compact refresh, and collapse actions", async () => {
    const callbacks = props();
    render(<ArticleList {...callbacks} feedSelected articles={[article]} />);

    await userEvent.click(screen.getByRole("button", { name: "未读" }));
    await userEvent.click(screen.getByRole("button", { name: "同步当前订阅源" }));
    await userEvent.click(screen.getByRole("button", { name: "折叠文章列表栏" }));

    expect(callbacks.onFilterChange).toHaveBeenCalledWith("unread");
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onCollapse).toHaveBeenCalledOnce();
  });
});
