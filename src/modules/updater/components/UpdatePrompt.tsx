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

import type { UpdaterController } from "../hooks/useUpdater";

interface UpdatePromptProps {
  updater: UpdaterController;
}

function progressLabel(updater: UpdaterController) {
  const { progress } = updater;
  if (!progress?.total) return "正在下载安装包...";
  return `正在下载 ${Math.min(100, Math.round((progress.downloaded / progress.total) * 100))}%`;
}

export function UpdatePrompt({ updater }: UpdatePromptProps) {
  const installing = updater.status === "installing";
  const update = updater.update;

  return (
    <AlertDialog
      open={Boolean(update) && updater.promptOpen}
      onOpenChange={(open) => {
        if (!open && !installing) updater.dismissPrompt();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>发现新版本 {update?.version}</AlertDialogTitle>
          <AlertDialogDescription>
            {update?.notes || "此版本包含功能改进和问题修复。"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {installing ? <p className="text-sm text-muted-foreground" role="status">{progressLabel(updater)}</p> : null}
        {updater.error ? <p className="text-sm text-destructive" role="alert">{updater.error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={installing}>稍后</AlertDialogCancel>
          <AlertDialogAction disabled={installing} onClick={() => void updater.install()}>
            {installing ? "正在安装..." : "下载并安装"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
