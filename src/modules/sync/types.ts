export interface SyncAccepted {
  jobId: number;
}

export type SyncEvent =
  | { event: "started"; data: { jobId: number; total: number } }
  | { event: "progress"; data: { jobId: number; processed: number; total: number } }
  | { event: "completed"; data: { jobId: number; processed: number } }
  | { event: "failed"; data: { jobId: number; message: string } }
  | { event: "canceled"; data: { jobId: number; processed: number } };
