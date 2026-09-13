import { z } from "zod";

const jobId = z.number().int().safe().positive();
const count = z.number().int().safe().nonnegative();

export const syncAcceptedSchema = z.object({ jobId });
export const syncEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("started"), data: z.object({ jobId, total: count }) }),
  z.object({ event: z.literal("progress"), data: z.object({ jobId, processed: count, total: count }) }),
  z.object({ event: z.literal("completed"), data: z.object({ jobId, processed: count }) }),
  z.object({ event: z.literal("failed"), data: z.object({ jobId, message: z.string() }) }),
  z.object({ event: z.literal("canceled"), data: z.object({ jobId, processed: count }) }),
]);
