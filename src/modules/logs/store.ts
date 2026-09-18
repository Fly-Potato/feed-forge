import { create } from "zustand";

import type { LogEntry, LogRecord } from "./types";

const MAX_LOG_ENTRIES = 1000;

interface LogStore {
  entries: LogEntry[];
  nextId: number;
  append: (record: LogRecord) => void;
  clear: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  entries: [],
  nextId: 1,
  append: (record) => set((state) => ({
    entries: [...state.entries, { ...record, id: state.nextId }].slice(-MAX_LOG_ENTRIES),
    nextId: state.nextId + 1,
  })),
  clear: () => set({ entries: [] }),
}));
