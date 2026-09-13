import type { z } from "zod";

import type { feedSummarySchema } from "./schema";

export type FeedSummary = z.infer<typeof feedSummarySchema>;
