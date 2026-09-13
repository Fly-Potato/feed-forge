import type { z } from "zod";

import type { articlePageSchema, articleSchema } from "./schema";

export type ArticleFilter = "all" | "unread" | "starred";

export type ArticleSummary = z.infer<typeof articleSchema>;
export type ArticlePage = z.infer<typeof articlePageSchema>;
