import { useState } from "react";

import { Button } from "@/components/ui/button";
import { exportOpml, importOpml } from "../ipc";

interface OpmlToolsProps {
  onImported: () => Promise<void>;
}

export function OpmlTools({ onImported }: OpmlToolsProps) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleImport() {
    if (!content.trim()) {
      setMessage("Paste OPML content first.");
      return;
    }
    setBusy(true);
    try {
      const result = await importOpml(content);
      await onImported();
      setMessage(`Imported ${result.imported} feeds; skipped ${result.skipped}.`);
      setContent("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not import OPML.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      const opml = await exportOpml();
      const blob = new Blob([opml], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "feed-forge.opml";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("OPML export downloaded.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not export OPML.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mt-6 border-t border-border pt-4">
      <summary className="cursor-pointer text-sm font-semibold">OPML</summary>
      <div className="mt-3 space-y-2">
        <textarea
          aria-label="OPML content"
          className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-xs"
          placeholder="Paste OPML to import"
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          disabled={busy}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void handleImport()} disabled={busy}>Import</Button>
          <Button size="sm" variant="outline" onClick={() => void handleExport()} disabled={busy}>Export</Button>
        </div>
        {message ? <p className="text-xs text-muted-foreground" role="status">{message}</p> : null}
      </div>
    </details>
  );
}
