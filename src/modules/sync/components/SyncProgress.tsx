import type { SyncEvent } from "../types";

interface SyncProgressProps {
  event: SyncEvent | null;
  error: string | null;
}

export function SyncProgress({ event, error }: SyncProgressProps) {
  if (error) {
    return <p className="text-sm text-destructive" role="alert">{error}</p>;
  }
  if (!event) {
    return null;
  }

  switch (event.event) {
    case "started":
      return <p className="text-sm text-muted-foreground">Syncing {event.data.total} feeds...</p>;
    case "progress":
      return <p className="text-sm text-muted-foreground">Synced {event.data.processed} of {event.data.total}</p>;
    case "completed":
      return <p className="text-sm text-muted-foreground">Sync complete: {event.data.processed} feeds.</p>;
    case "failed":
      return <p className="text-sm text-destructive" role="alert">Sync failed: {event.data.message}</p>;
    case "canceled":
      return <p className="text-sm text-muted-foreground">Sync canceled.</p>;
  }
}
