import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { exportOpml, importOpml } from "../ipc";

interface OpmlToolsProps {
  onImported: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

export function OpmlTools({ onImported, onBusyChange }: OpmlToolsProps) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleImport() {
    if (!content.trim()) {
      setMessage("请先粘贴 OPML 内容。");
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      const result = await importOpml(content);
      await onImported();
      setMessage(`已导入 ${result.imported} 个订阅源，跳过 ${result.skipped} 个。`);
      setContent("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "导入 OPML 失败。");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    onBusyChange?.(true);
    try {
      const opml = await exportOpml();
      const blob = new Blob([opml], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "feed-forge.opml";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("OPML 文件已下载。");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "导出 OPML 失败。");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="opml-content">导入 OPML</FieldLabel>
        <FieldDescription>粘贴 OPML 文件内容，将其中的订阅源添加到本地。</FieldDescription>
        <Textarea
          id="opml-content"
          aria-label="OPML 内容"
          className="min-h-40 font-mono text-xs"
          placeholder="粘贴 OPML 内容以导入"
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          disabled={busy}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void handleImport()} disabled={busy}>导入</Button>
        </div>
      </Field>
      <Field>
        <FieldLabel>导出订阅</FieldLabel>
        <FieldDescription>将当前全部订阅源下载为 Feed Forge OPML 文件。</FieldDescription>
        <Button className="w-fit" size="sm" variant="outline" onClick={() => void handleExport()} disabled={busy}>导出 OPML</Button>
      </Field>
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}
