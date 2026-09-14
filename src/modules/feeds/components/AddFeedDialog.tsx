import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { FeedGroup } from "../types";
import { AddFeedForm } from "./AddFeedForm";

interface AddFeedDialogProps {
  groups: FeedGroup[];
  onAdd: (url: string, groupId: number | null) => Promise<unknown>;
}

export function AddFeedDialog({ groups, onAdd }: AddFeedDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && busy) return;
    setOpen(nextOpen);
  }

  async function add(url: string, groupId: number | null) {
    await onAdd(url, groupId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="添加订阅源" title="添加订阅源" />
        }
      >
        <Plus aria-hidden="true" data-icon="inline-start" />
      </DialogTrigger>
      <DialogContent showCloseButton={false} aria-busy={busy}>
        <DialogHeader>
          <DialogTitle>添加订阅源</DialogTitle>
          <DialogDescription>输入订阅源地址，并选择要添加到的分组。</DialogDescription>
        </DialogHeader>
        <AddFeedForm groups={groups} onAdd={add} onBusyChange={setBusy} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            取消
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
