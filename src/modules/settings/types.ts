import type { z } from "zod";

import type { settingsSchema } from "./schema";

export type Settings = z.infer<typeof settingsSchema>;
