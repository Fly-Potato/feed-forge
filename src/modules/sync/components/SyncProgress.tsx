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
      return <p className="text-sm text-muted-foreground" role="status" aria-live="polite">正在同步 {event.data.total} 个订阅源...</p>;
    case "progress":
      return <p className="text-sm text-muted-foreground" role="status" aria-live="polite">已同步 {event.data.processed}/{event.data.total} 个订阅源</p>;
    case "completed":
      return <p className="text-sm text-muted-foreground" role="status" aria-live="polite">同步完成，共 {event.data.processed} 个订阅源。</p>;
    case "failed":
      return <p className="text-sm text-destructive" role="alert">同步失败：{event.data.message}</p>;
    case "canceled":
      return <p className="text-sm text-muted-foreground" role="status" aria-live="polite">同步已取消。</p>;
  }
}
