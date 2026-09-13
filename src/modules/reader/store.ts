import { create } from "zustand";

import type { ArticleFilter } from "../articles/types";

interface ReaderState {
  selectedFeedId: number | undefined;
  selectedArticleId: number | undefined;
  filter: ArticleFilter;
  selectFeed: (feedId: number) => void;
  selectArticle: (articleId: number) => void;
  setFilter: (filter: ArticleFilter) => void;
  clearFeedIfSelected: (feedId: number) => void;
  clearMissingFeed: (ids: number[]) => void;
  clearMissingArticle: (ids: number[]) => void;
}

export const useReaderStore = create<ReaderState>()((set) => ({
  selectedFeedId: undefined,
  selectedArticleId: undefined,
  filter: "all",
  selectFeed: (feedId) => set({ selectedFeedId: feedId, selectedArticleId: undefined }),
  selectArticle: (articleId) => set({ selectedArticleId: articleId }),
  setFilter: (filter) => set({ filter, selectedArticleId: undefined }),
  clearFeedIfSelected: (feedId) => set((state) => state.selectedFeedId === feedId
    ? { selectedFeedId: undefined, selectedArticleId: undefined } : state),
  clearMissingFeed: (ids) => set((state) => state.selectedFeedId !== undefined && !ids.includes(state.selectedFeedId)
    ? { selectedFeedId: undefined, selectedArticleId: undefined } : state),
  clearMissingArticle: (ids) => set((state) => state.selectedArticleId !== undefined && !ids.includes(state.selectedArticleId)
    ? { selectedArticleId: undefined } : state),
}));
