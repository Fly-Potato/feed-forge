export interface FeedSummary {
  id: number;
  title: string;
  url: string;
  siteUrl: string | null;
  description: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
}
