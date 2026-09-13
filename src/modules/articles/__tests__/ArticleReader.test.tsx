import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ArticleReader } from "../components/ArticleReader";
import type { ArticleSummary } from "../types";

const openUrl = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

beforeEach(() => {
  openUrl.mockReset();
});

function articleWithContent(content: string): ArticleSummary {
  return {
    id: 1,
    feedId: 1,
    guid: "article-1",
    url: "https://example.com/article-1",
    title: "Example article",
    author: "Example author",
    summary: "Fallback summary",
    content,
    publishedAt: "2026-09-08T12:00:00Z",
    isRead: false,
    isStarred: false,
  };
}

describe("ArticleReader", () => {
  test("renders article HTML as formatted content", () => {
    render(
      <ArticleReader
        article={articleWithContent(
          "<p>First <strong>release</strong></p><ul><li>Feature one</li></ul>",
        )}
        onReadChange={vi.fn()}
        onStarChange={vi.fn()}
      />,
    );

    expect(screen.getByText("release").tagName).toBe("STRONG");
    expect(screen.getByRole("list")).toContainElement(screen.getByText("Feature one"));
  });

  test("removes executable markup from article HTML", () => {
    render(
      <ArticleReader
        article={articleWithContent(
          '<p>Safe content</p><img src="https://example.com/preview.png" alt="Preview" onerror="alert(1)"><a href="javascript:alert(1)">Unsafe link</a><script>alert(1)</script>',
        )}
        onReadChange={vi.fn()}
        onStarChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Preview" })).not.toHaveAttribute("onerror");
    expect(screen.getByText("Unsafe link").closest("a")).not.toHaveAttribute("href");
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });

  test("opens http article links in the system browser when enabled", async () => {
    render(
      <ArticleReader
        article={articleWithContent('<p><a href="https://example.com/read">Read more</a></p>')}
        onReadChange={vi.fn()}
        onStarChange={vi.fn()}
        openLinksInBrowser
      />,
    );

    await userEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(openUrl).toHaveBeenCalledWith("https://example.com/read");
  });

  test("resolves relative links against the article URL", async () => {
    render(
      <ArticleReader
        article={articleWithContent('<p><a href="../read">Read more</a></p>')}
        onReadChange={vi.fn()}
        onStarChange={vi.fn()}
        openLinksInBrowser
      />,
    );

    await userEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(openUrl).toHaveBeenCalledWith("https://example.com/read");
  });

  test("does not send non-http links to the system opener", async () => {
    render(
      <ArticleReader
        article={articleWithContent('<p><a href="mailto:reader@example.com">Email</a></p>')}
        onReadChange={vi.fn()}
        onStarChange={vi.fn()}
        openLinksInBrowser
      />,
    );

    const link = screen.getByRole("link", { name: "Email" });
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);

    expect(openUrl).not.toHaveBeenCalled();
  });

  test("shows an error when the system opener rejects the link", async () => {
    openUrl.mockRejectedValueOnce(new Error("opener unavailable"));
    render(
      <ArticleReader
        article={articleWithContent('<p><a href="https://example.com/read">Read more</a></p>')}
        onReadChange={vi.fn()}
        onStarChange={vi.fn()}
        openLinksInBrowser
      />,
    );

    await userEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法在外部浏览器打开链接");
  });
});
