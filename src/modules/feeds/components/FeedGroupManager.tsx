import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { FeedGroup, FeedSummary } from "../types";

interface FeedGroupManagerProps {
  groups: FeedGroup[];
  feeds: FeedSummary[];
  disabled: boolean;
  onCreate: (title: string) => Promise<unknown>;
  onRename: (groupId: number, title: string) => Promise<unknown>;
  onRemove: (groupId: number) => Promise<unknown>;
  onMoveFeed: (feedId: number, groupId: number | null) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
}

export function FeedGroupManager({
  groups,
  feeds,
  disabled,
  onCreate,
  onRename,
  onRemove,
  onMoveFeed,
  onBusyChange,
}: FeedGroupManagerProps) {
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<number>();
  const [editingTitle, setEditingTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<FeedGroup>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallback);
      return false;
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      setError("分组名称不能为空。");
      return;
    }
    if (await run(() => onCreate(title), "创建分组失败。")) setNewTitle("");
  }

  async function rename() {
    if (editingId === undefined) return;
    const title = editingTitle.trim();
    if (!title) {
      setError("分组名称不能为空。");
      return;
    }
    if (await run(() => onRename(editingId, title), "重命名分组失败。")) {
      setEditingId(undefined);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    const removed = await run(() => onRemove(pendingDelete.id), "删除分组失败。");
    if (removed) setPendingDelete(undefined);
  }

  async function moveFeed(feedId: number, value: string | null) {
    if (!value) return;
    await run(
      () => onMoveFeed(feedId, value === "ungrouped" ? null : Number(value)),
      "移动订阅源失败。",
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="feed-groups-heading">
      <h3 id="feed-groups-heading" className="font-medium">订阅分组</h3>
      <form onSubmit={(event) => void create(event)}>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="new-feed-group">新分组名称</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="new-feed-group"
                value={newTitle}
                onChange={(event) => setNewTitle(event.currentTarget.value)}
                disabled={disabled || busy}
                aria-invalid={Boolean(error)}
              />
              <Button type="submit" size="sm" disabled={disabled || busy}>创建分组</Button>
            </div>
            <FieldError>{error}</FieldError>
          </Field>
        </FieldGroup>
      </form>

      {groups.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="分组管理列表">
          {groups.map((group) => (
            <li key={group.id} className="rounded-lg border border-border p-3">
              {editingId === group.id ? (
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor={`feed-group-title-${group.id}`}>分组名称</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id={`feed-group-title-${group.id}`}
                      aria-label={`分组名称 ${group.title}`}
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.currentTarget.value)}
                      disabled={busy}
                    />
                    <Button size="sm" disabled={busy} onClick={() => void rename()}>保存分组名称</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingId(undefined)}>取消</Button>
                  </div>
                </Field>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{group.title}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`重命名分组 ${group.title}`}
                      title="重命名分组"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(group.id);
                        setEditingTitle(group.title);
                        setError(null);
                      }}
                    >
                      <Pencil aria-hidden="true" data-icon="inline-start" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`删除分组 ${group.title}`}
                      title="删除分组"
                      disabled={busy}
                      onClick={() => setPendingDelete(group)}
                    >
                      <Trash2 aria-hidden="true" data-icon="inline-start" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {feeds.length > 0 ? (
        <FieldGroup>
          {feeds.map((feed) => (
            <Field key={feed.id} orientation="horizontal">
              <FieldLabel htmlFor={`feed-assignment-${feed.id}`} className="min-w-0 flex-1 truncate">
                {feed.title}
              </FieldLabel>
              <Select
                value={feed.groupId === null ? "ungrouped" : String(feed.groupId)}
                onValueChange={(value) => void moveFeed(feed.id, value)}
                disabled={disabled || busy}
              >
                <SelectTrigger
                  id={`feed-assignment-${feed.id}`}
                  aria-label={`${feed.title} 的分组`}
                  className="w-36"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ungrouped">未分组</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>{group.title}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ))}
        </FieldGroup>
      ) : null}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && !busy && setPendingDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分组？</AlertDialogTitle>
            <AlertDialogDescription>
              删除“{pendingDelete?.title}”后，组内订阅源会保留并移动到未分组。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy ? "正在删除..." : "确认删除分组"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
