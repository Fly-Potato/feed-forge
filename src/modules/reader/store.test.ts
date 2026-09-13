import { afterEach, expect, test } from "vitest";

import { useReaderStore } from "./store";

afterEach(() => useReaderStore.setState({ selectedFeedId: undefined, selectedArticleId: undefined, filter: "all" }));

test("changing filters or feeds clears the selected article", () => {
  useReaderStore.getState().selectFeed(7);
  useReaderStore.getState().selectArticle(11);
  useReaderStore.getState().setFilter("unread");
  expect(useReaderStore.getState()).toMatchObject({ selectedFeedId: 7, selectedArticleId: undefined, filter: "unread" });
  useReaderStore.getState().selectArticle(12);
  useReaderStore.getState().selectFeed(8);
  expect(useReaderStore.getState()).toMatchObject({ selectedFeedId: 8, selectedArticleId: undefined });
});

test("removing another feed preserves selection, removing the active feed clears both IDs", () => {
  useReaderStore.getState().selectFeed(7);
  useReaderStore.getState().selectArticle(11);
  useReaderStore.getState().clearFeedIfSelected(8);
  expect(useReaderStore.getState()).toMatchObject({ selectedFeedId: 7, selectedArticleId: 11 });
  useReaderStore.getState().clearFeedIfSelected(7);
  expect(useReaderStore.getState()).toMatchObject({ selectedFeedId: undefined, selectedArticleId: undefined });
});
