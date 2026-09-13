import type { z } from "zod";

import type { opmlImportResultSchema } from "./schema";

export type OpmlImportResult = z.infer<typeof opmlImportResultSchema>;
