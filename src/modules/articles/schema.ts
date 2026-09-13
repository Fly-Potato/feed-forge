import { z } from "zod";

const positiveId = z.number().int().safe().positive();

export const articleSchema = z.object({
  id: positiveId,
  feedId: positiveId,
  guid: z.string(),
  url: z.string().nullable(),
  title: z.string(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  content: z.string().nullable(),
  publishedAt: z.string().nullable(),
  isRead: z.boolean(),
  isStarred: z.boolean(),
});

export const articlePageSchema = z.object({ items: z.array(articleSchema), total: z.number().int().safe().nonnegative() });
