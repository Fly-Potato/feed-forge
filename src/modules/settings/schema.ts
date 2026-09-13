import { z } from "zod";

export const settingsSchema = z.object({
  refreshIntervalMinutes: z.number().int().min(1).max(1440),
  theme: z.enum(["system", "light", "dark"]),
  openLinksInBrowser: z.boolean(),
});
