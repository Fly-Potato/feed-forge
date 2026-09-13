import type { z } from "zod";

import type { syncAcceptedSchema, syncEventSchema } from "./schema";

export type SyncAccepted = z.infer<typeof syncAcceptedSchema>;
export type SyncEvent = z.infer<typeof syncEventSchema>;
