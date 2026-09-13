import { z } from "zod";

const positiveId = z.number().int().safe().positive();

export const feedSummarySchema = z.object({
  id: positiveId,
  title: z.string(),
  url: z.string(),
  siteUrl: z.string().nullable(),
  description: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  syncError: z.string().nullable(),
  groupId: positiveId.nullable(),
});

export const feedListSchema = z.array(feedSummarySchema);
export const feedGroupSchema = z.object({ id: positiveId, title: z.string() });
export const feedGroupListSchema = z.array(feedGroupSchema);
export const removedFeedSchema = z.object({ feedId: positiveId });
export const removedFeedGroupSchema = z.object({ groupId: positiveId });
