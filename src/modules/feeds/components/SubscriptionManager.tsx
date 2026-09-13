import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { FeedGroup, FeedSummary } from "../types";
import { AddFeedForm } from "./AddFeedForm";
import { FeedGroupManager } from "./FeedGroupManager";

interface SubscriptionManagerProps {
  feeds: FeedSummary[];
  groups: FeedGroup[];
  loading: boolean;
  error: string | null;
  onAdd: (url: string, groupId: number | null) => Promise<unknown>;
  onRename: (feedId: number, title: string) => Promise<unknown>;
  onRemove: (feedId: number) => Promise<unknown>;
  onCreateGroup: (title: string) => Promise<unknown>;
  onRenameGroup: (groupId: number, title: string) => Promise<unknown>;
  onRemoveGroup: (groupId: number) => Promise<unknown>;
  onMoveFeed: (feedId: number, groupId: number | null) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
}

export function SubscriptionManager({
  feeds,
  groups,
  loading,
  error,
  onAdd,
  onRename,
  onRemove,
  onCreateGroup,
  onRenameGroup,
  onRemoveGroup,
  onMoveFeed,
  onBusyChange,
}: SubscriptionManagerProps) {
  const [editingId, setEditingId] = useState<number>();
  const [title, setTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<FeedSummary>();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameButtonsRef = useRef(new Map<number, HTMLButtonElement>());
  const restoreFocusIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onBusyChange?.(busy || addBusy || groupBusy);
  }, [addBusy, busy, groupBusy, onBusyChange]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  useEffect(() => {
    if (editingId !== undefined) {
      renameInputRef.current?.focus();
      return;
    }

    const restoreFocusId = restoreFocusIdRef.current;
    if (restoreFocusId !== undefined) {
      renameButtonsRef.current.get(restoreFocusId)?.focus();
      restoreFocusIdRef.current = undefined;
    }
  }, [editingId]);

  function beginRename(feed: FeedSummary) {
    setEditingId(feed.id);
    setTitle(feed.title);
    setActionError(null);
  }

  async function saveRename() {
    const nextTitle = title.trim();
    if (editingId === undefined || !nextTitle) {
      setActionError("订阅名称不能为空。");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await onRename(editingId, nextTitle);
      restoreFocusIdRef.current = editingId;
      setEditingId(undefined);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "重命名订阅失败。");
    } finally {
      setBusy(false);
    }
  }

  function cancelRename() {
    if (editingId !== undefined) restoreFocusIdRef.current = editingId;
    setEditingId(undefined);
    setActionError(null);
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await onRemove(pendingDelete.id);
      setPendingDelete(undefined);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "删除订阅失败。");
      setPendingDelete(undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <AddFeedForm groups={groups} onAdd={onAdd} onBusyChange={setAddBusy} />

      <FeedGroupManager
        groups={groups}
        feeds={feeds}
        disabled={loading || busy || addBusy}
        onCreate={onCreateGroup}
        onRename={onRenameGroup}
        onRemove={onRemoveGroup}
        onMoveFeed={onMoveFeed}
        onBusyChange={setGroupBusy}
      />

      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">已订阅</h3>
          {loading ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
        </div>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {actionError && editingId === undefined ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
        {feeds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            暂无订阅源
          </p>
        ) : (
          <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto" aria-label="订阅管理列表">
            {feeds.map((feed) => (
              <li key={feed.id} className="rounded-lg border border-border p-3">
                {editingId === feed.id ? (
                  <Field data-invalid={Boolean(actionError)}>
                    <FieldLabel htmlFor={`feed-title-${feed.id}`}>订阅名称</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        ref={renameInputRef}
                        id={`feed-title-${feed.id}`}
                        aria-label={`订阅名称 ${feed.title}`}
                        aria-invalid={Boolean(actionError)}
                        aria-describedby={actionError ? `feed-title-${feed.id}-error` : undefined}
                        value={title}
                        onChange={(event) => setTitle(event.currentTarget.value)}
                        disabled={busy}
                      />
                      <Button size="sm" onClick={() => void saveRename()} disabled={busy}>保存订阅名称</Button>
                      <Button size="sm" variant="outline" onClick={cancelRename} disabled={busy}>取消</Button>
                    </div>
                    <FieldError id={`feed-title-${feed.id}-error`}>{actionError}</FieldError>
                  </Field>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{feed.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{feed.url}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        ref={(node) => {
                          if (node) renameButtonsRef.current.set(feed.id, node);
                          else renameButtonsRef.current.delete(feed.id);
                        }}
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`重命名 ${feed.title}`}
                        title="重命名"
                        onClick={() => beginRename(feed)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`删除 ${feed.title}`} title="删除" onClick={() => setPendingDelete(feed)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && !busy && setPendingDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除订阅源？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除“{pendingDelete?.title}”及其本地文章和阅读状态，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={() => void confirmRemove()}>
              {busy ? "正在删除..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
