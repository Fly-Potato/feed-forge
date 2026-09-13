import type { z } from "zod";

import type { feedGroupSchema, feedSummarySchema } from "./schema";

export type FeedSummary = z.infer<typeof feedSummarySchema>;
export type FeedGroup = z.infer<typeof feedGroupSchema>;
