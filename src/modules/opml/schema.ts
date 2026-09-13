import { z } from "zod";

export const opmlImportResultSchema = z.object({
  imported: z.number().int().safe().nonnegative(),
  skipped: z.number().int().safe().nonnegative(),
});

export const opmlExportSchema = z.string();
