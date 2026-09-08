import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ArticleReader } from "../components/ArticleReader";
import type { ArticleSummary } from "../types";

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
});
