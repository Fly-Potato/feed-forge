import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import appIcon from "../../../src-tauri/icons/32x32.png";

const appWindow = getCurrentWindow();

export function AppTitleBar() {
  return (
    <div className="flex h-9 shrink-0 border-b border-border bg-card select-none">
      <div
        className="flex min-w-0 flex-1 items-center gap-2 px-3"
        data-tauri-drag-region
        aria-label="窗口标题栏"
      >
        <img
          className="size-4 shrink-0"
          src={appIcon}
          alt=""
          draggable={false}
        />
        <span className="truncate text-xs font-medium text-muted-foreground">
          Feed Forge
        </span>
      </div>
      <div className="flex h-full shrink-0" aria-label="窗口控制">
        <button
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          type="button"
          aria-label="最小化"
          title="最小化"
          onClick={() => void appWindow.minimize()}
        >
          <Minus aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </button>
        <button
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          type="button"
          aria-label="最大化或还原"
          title="最大化或还原"
          onClick={() => void appWindow.toggleMaximize()}
        >
          <Square aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        </button>
        <button
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          type="button"
          aria-label="关闭到托盘"
          title="关闭到托盘"
          onClick={() => void appWindow.close()}
        >
          <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
