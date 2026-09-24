import { useState, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronRight, FolderPlus, Pencil, Trash2 } from "lucide-react";

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

import { buildFeedTree, type FeedTreeGroup } from "../tree";
import type { FeedGroup, FeedSummary } from "../types";

interface FeedListProps {
  groups: FeedGroup[];
  feeds: FeedSummary[];
  selectedFeedId: number | undefined;
  editDisabled?: boolean;
  onSelect: (feedId: number) => void;
  onEditFeed: (feedId: number, url: string, groupId: number | null) => Promise<unknown>;
  onCreateGroup: (title: string) => Promise<unknown>;
  onRenameGroup: (groupId: number, title: string) => Promise<unknown>;
  onRemoveFeed: (feedId: number) => Promise<unknown>;
}

type ContextTarget =
  | { kind: "list" }
  | { kind: "group"; group: FeedTreeGroup }
  | { kind: "feed"; feed: FeedSummary };

type GroupDialogState =
  | { mode: "create" }
  | { mode: "rename"; group: FeedGroup };

export function FeedList({
  groups,
  feeds,
  selectedFeedId,
  editDisabled = false,
  onSelect,
  onEditFeed,
  onCreateGroup,
  onRenameGroup,
  onRemoveFeed,
}: FeedListProps) {
  const tree = buildFeedTree(groups, feeds);
  const [contextTarget, setContextTarget] = useState<ContextTarget>({ kind: "list" });
  const [groupDialog, setGroupDialog] = useState<GroupDialogState | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [editingFeed, setEditingFeed] = useState<FeedSummary | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editGroupId, setEditGroupId] = useState("ungrouped");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FeedSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function captureContextTarget(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const feedId = target?.closest<HTMLElement>("[data-context-feed-id]")
      ?.dataset.contextFeedId;
    if (feedId) {
      const feed = feeds.find((item) => item.id === Number(feedId));
      if (feed) {
        setContextTarget({ kind: "feed", feed });
        return;
      }
    }

    const groupId = target?.closest<HTMLElement>("[data-context-group-id]")
      ?.dataset.contextGroupId;
    if (groupId) {
      const group = groupId === "ungrouped"
        ? tree.find((item) => item.synthetic)
        : tree.find((item) => item.id === Number(groupId));
      if (group) {
        setContextTarget({ kind: "group", group });
        return;
      }
    }

    setContextTarget({ kind: "list" });
  }

  function openCreateGroup() {
    setGroupName("");
    setGroupError(null);
    setGroupDialog({ mode: "create" });
  }

  function openRenameGroup() {
    if (contextTarget.kind !== "group" || contextTarget.group.id === null) return;
    setGroupName(contextTarget.group.title);
    setGroupError(null);
    setGroupDialog({
      mode: "rename",
      group: { id: contextTarget.group.id, title: contextTarget.group.title },
    });
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupDialog) return;

    const title = groupName.trim();
    if (!title) {
      setGroupError("请输入分组名称。");
      return;
    }

    setGroupBusy(true);
    setGroupError(null);
    try {
      if (groupDialog.mode === "create") {
        await onCreateGroup(title);
      } else {
        await onRenameGroup(groupDialog.group.id, title);
      }
      setGroupDialog(null);
    } catch (cause) {
      setGroupError(cause instanceof Error
        ? cause.message
        : groupDialog.mode === "create" ? "创建分组失败。" : "重命名分组失败。");
    } finally {
      setGroupBusy(false);
    }
  }

  function openEditFeed() {
    if (contextTarget.kind !== "feed") return;
    setEditUrl(contextTarget.feed.url);
    setEditGroupId(contextTarget.feed.groupId === null ? "ungrouped" : String(contextTarget.feed.groupId));
    setEditError(null);
    setEditingFeed(contextTarget.feed);
  }

  async function submitFeedEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFeed) return;
    const url = editUrl.trim();
    if (!url) {
      setEditError("请输入订阅源地址。");
      return;
    }

    setEditBusy(true);
    setEditError(null);
    try {
      await onEditFeed(
        editingFeed.id,
        url,
        editGroupId === "ungrouped" ? null : Number(editGroupId),
      );
      setEditingFeed(null);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : "更新订阅失败。");
    } finally {
      setEditBusy(false);
    }
  }

  function openDeleteFeed() {
    if (contextTarget.kind !== "feed") return;
    setDeleteError(null);
    setPendingDelete(contextTarget.feed);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onRemoveFeed(pendingDelete.id);
      setPendingDelete(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "删除订阅失败。");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className="flex min-h-full flex-col gap-1"
              role="tree"
              aria-label="订阅源"
              onContextMenuCapture={captureContextTarget}
            />
          }
        >
          {tree.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无订阅源</p>
          ) : tree.map((group) => (
            <FeedGroupNode
              key={group.id ?? "ungrouped"}
              group={group}
              selectedFeedId={selectedFeedId}
              onSelect={onSelect}
            />
          ))}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            {contextTarget.kind === "feed" ? (
              <>
                <ContextMenuItem disabled={editDisabled} onClick={openEditFeed}>
                  <Pencil aria-hidden="true" data-icon="inline-start" />
                  编辑订阅
                </ContextMenuItem>
                <ContextMenuItem variant="destructive" onClick={openDeleteFeed}>
                  <Trash2 aria-hidden="true" data-icon="inline-start" />
                  删除订阅
                </ContextMenuItem>
              </>
            ) : (
              <>
                {contextTarget.kind === "group" && !contextTarget.group.synthetic ? (
                  <ContextMenuItem onClick={openRenameGroup}>
                    <Pencil aria-hidden="true" data-icon="inline-start" />
                    重命名分组
                  </ContextMenuItem>
                ) : null}
                <ContextMenuItem onClick={openCreateGroup}>
                  <FolderPlus aria-hidden="true" data-icon="inline-start" />
                  新建分组
                </ContextMenuItem>
              </>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog
        open={Boolean(editingFeed)}
        onOpenChange={(open) => !open && !editBusy && setEditingFeed(null)}
      >
        <DialogContent showCloseButton={false} aria-busy={editBusy}>
          <form className="flex flex-col gap-4" onSubmit={submitFeedEdit}>
            <DialogHeader>
              <DialogTitle>编辑订阅</DialogTitle>
              <DialogDescription>
                修改“{editingFeed?.title}”的订阅地址和所属分组。
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-3">
              <Field data-invalid={Boolean(editError)}>
                <FieldLabel htmlFor="edit-feed-url">订阅源地址</FieldLabel>
                <Input
                  id="edit-feed-url"
                  type="url"
                  value={editUrl}
                  autoFocus
                  disabled={editBusy || editDisabled}
                  aria-invalid={Boolean(editError)}
                  onChange={(event) => {
                    setEditUrl(event.target.value);
                    setEditError(null);
                  }}
                />
                <FieldError>{editError}</FieldError>
              </Field>
              <Field data-disabled={editBusy || editDisabled}>
                <FieldLabel htmlFor="edit-feed-group">所属分组</FieldLabel>
                <Select
                  items={[
                    { value: "ungrouped", label: "未分组" },
                    ...groups.map((group) => ({ value: String(group.id), label: group.title })),
                  ]}
                  value={editGroupId}
                  onValueChange={(value) => {
                    if (value) setEditGroupId(value);
                    setEditError(null);
                  }}
                  disabled={editBusy || editDisabled}
                >
                  <SelectTrigger id="edit-feed-group" aria-label="所属分组" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ungrouped">未分组</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={editBusy} />}>
                取消
              </DialogClose>
              <Button type="submit" disabled={editBusy || editDisabled}>
                {editBusy ? "正在保存..." : "保存并刷新"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(groupDialog)}
        onOpenChange={(open) => !open && !groupBusy && setGroupDialog(null)}
      >
        <DialogContent showCloseButton={false} aria-busy={groupBusy}>
          <form className="flex flex-col gap-4" onSubmit={submitGroup}>
            <DialogHeader>
              <DialogTitle>
                {groupDialog?.mode === "rename" ? "重命名分组" : "新建分组"}
              </DialogTitle>
              <DialogDescription>
                {groupDialog?.mode === "rename"
                  ? "修改该订阅分组的名称。"
                  : "创建一个用于整理订阅源的新分组。"}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-3">
              <Field data-invalid={Boolean(groupError)}>
                <FieldLabel htmlFor="feed-group-name">分组名称</FieldLabel>
                <Input
                  id="feed-group-name"
                  value={groupName}
                  autoFocus
                  disabled={groupBusy}
                  aria-invalid={Boolean(groupError)}
                  onChange={(event) => {
                    setGroupName(event.target.value);
                    setGroupError(null);
                  }}
                />
                <FieldError>{groupError}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={groupBusy} />}>
                取消
              </DialogClose>
              <Button type="submit" disabled={groupBusy}>
                {groupBusy
                  ? groupDialog?.mode === "rename" ? "正在保存..." : "正在创建..."
                  : groupDialog?.mode === "rename" ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && !deleteBusy && setPendingDelete(null)}
      >
        <AlertDialogContent aria-busy={deleteBusy}>
          <AlertDialogHeader>
            <AlertDialogTitle>删除订阅源？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除“{pendingDelete?.title}”及其本地文章和阅读状态，此操作无法撤销。
            </AlertDialogDescription>
            <FieldError>{deleteError}</FieldError>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? "正在删除..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface FeedGroupNodeProps {
  group: FeedTreeGroup;
  selectedFeedId: number | undefined;
  onSelect: (feedId: number) => void;
}

function FeedGroupNode({ group, selectedFeedId, onSelect }: FeedGroupNodeProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            role="treeitem"
            aria-label={`${group.title}，${group.feeds.length} 个订阅源`}
            data-context-group-id={group.id ?? "ungrouped"}
          />
        }
      >
        <ChevronRight
          aria-hidden="true"
          data-icon="inline-start"
          className={cn("transition-transform motion-reduce:transition-none", open && "rotate-90")}
        />
        <span className="truncate">{group.title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{group.feeds.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-1 pl-4" role="group">
        {group.feeds.map((feed) => (
          <Button
            key={feed.id}
            type="button"
            variant={selectedFeedId === feed.id ? "secondary" : "ghost"}
            className="h-auto w-full min-w-0 flex-col items-start gap-0.5 px-3 py-2"
            role="treeitem"
            aria-selected={selectedFeedId === feed.id}
            data-context-feed-id={feed.id}
            onClick={() => onSelect(feed.id)}
          >
            <span className="w-full truncate text-left font-medium">{feed.title}</span>
            <span className="w-full truncate text-left text-xs text-muted-foreground">
              {feed.url}
            </span>
          </Button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
