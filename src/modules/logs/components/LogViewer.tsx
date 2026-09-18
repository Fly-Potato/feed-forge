import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useLogStore } from "../store";
import type { LogLevel } from "../types";

type LevelFilter = "all" | LogLevel;

const levelItems: Array<{ value: LevelFilter; label: string }> = [
  { value: "all", label: "全部级别" },
  { value: "trace", label: "跟踪" },
  { value: "debug", label: "调试" },
  { value: "info", label: "信息" },
  { value: "warn", label: "警告" },
  { value: "error", label: "错误" },
];

export function LogViewer() {
  const entries = useLogStore((state) => state.entries);
  const clear = useLogStore((state) => state.clear);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEntries = entries.filter((entry) => (
    (level === "all" || entry.level === level)
    && (!normalizedQuery || entry.message.toLocaleLowerCase().includes(normalizedQuery))
  ));

  useEffect(() => {
    if (autoScroll && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [autoScroll, entries.length, level, normalizedQuery]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3" aria-labelledby="runtime-logs-heading">
      <div className="flex shrink-0 items-center gap-2">
        <h3 id="runtime-logs-heading" className="font-medium">运行日志</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {visibleEntries.length}/{entries.length}
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="搜索日志"
          placeholder="搜索日志"
          className="min-w-48 flex-1"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Select
          items={levelItems}
          value={level}
          onValueChange={(value) => value && setLevel(value as LevelFilter)}
        >
          <SelectTrigger aria-label="日志级别" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {levelItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="logs-auto-scroll">自动滚动</Label>
          <Switch
            id="logs-auto-scroll"
            aria-label="自动滚动"
            checked={autoScroll}
            onCheckedChange={setAutoScroll}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="清空视图"
            title="清空视图"
            onClick={clear}
          >
            <Trash2 aria-hidden="true" data-icon="inline-start" />
          </Button>
        </div>
      </div>

      <div
        ref={scroller}
        role="log"
        aria-label="实时日志"
        className="min-h-64 flex-1 overflow-auto rounded-lg border border-border bg-muted/30"
      >
        {visibleEntries.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {entries.length === 0 ? "当前运行期间还没有日志。" : "没有符合筛选条件的日志。"}
          </p>
        ) : (
          <ol className="divide-y divide-border/70 font-mono text-xs">
            {visibleEntries.map((entry) => (
              <li key={entry.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2 px-3 py-2">
                <span className={cn(
                  "font-semibold uppercase text-muted-foreground",
                  entry.level === "error" && "text-destructive",
                )}>
                  {entry.level}
                </span>
                <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.message}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
