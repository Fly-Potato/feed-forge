import { Button } from "@/components/ui/button";

import type { UpdaterController } from "../hooks/useUpdater";

interface UpdatePanelProps {
  updater: UpdaterController;
}

export function UpdatePanel({ updater }: UpdatePanelProps) {
  const checking = updater.status === "checking";
  const installing = updater.status === "installing";
  const available = updater.update && updater.status === "available";

  return (
    <section className="flex flex-col gap-4" aria-labelledby="about-feed-forge">
      <div>
        <h3 id="about-feed-forge" className="font-medium">关于 Feed Forge</h3>
        <p className="text-sm text-muted-foreground">
          {updater.currentVersion ? `当前版本 ${updater.currentVersion}` : "正在读取当前版本..."}
        </p>
      </div>

      {updater.status === "up-to-date" ? (
        <p className="text-sm text-muted-foreground" role="status">当前已是最新版本。</p>
      ) : null}
      {available ? <p className="text-sm text-muted-foreground">发现新版本 {updater.update?.version}</p> : null}
      {updater.error ? <p className="text-sm text-destructive" role="alert">{updater.error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={checking || installing} onClick={() => void updater.check()}>
          {checking ? "正在检查..." : "检查更新"}
        </Button>
        {available ? (
          <Button onClick={() => void updater.install()}>
            下载并安装 {updater.update?.version}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
