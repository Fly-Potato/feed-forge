import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";

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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionManager } from "@/modules/feeds/components/SubscriptionManager";
import type { FeedSummary } from "@/modules/feeds/types";
import { OpmlTools } from "@/modules/opml/components/OpmlTools";

import type { Settings } from "../types";

interface SettingsDialogProps {
  feeds: FeedSummary[];
  feedsLoading: boolean;
  feedsError: string | null;
  onAddFeed: (url: string) => Promise<unknown>;
  onRenameFeed: (feedId: number, title: string) => Promise<unknown>;
  onRemoveFeed: (feedId: number) => Promise<unknown>;
  settings: Settings | undefined;
  settingsLoading: boolean;
  settingsError: string | null;
  onSaveSettings: (settings: Settings) => Promise<Settings>;
}

const refreshIntervals = [15, 30, 60, 120, 360, 1440];
type SettingsTab = "general" | "subscriptions" | "data";

export function SettingsDialog({
  feeds,
  feedsLoading,
  feedsError,
  onAddFeed,
  onRenameFeed,
  onRemoveFeed,
  settings,
  settingsLoading,
  settingsError,
  onSaveSettings,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Settings>();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [saving, setSaving] = useState(false);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [opmlBusy, setOpmlBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const operationBusy = subscriptionBusy || opmlBusy;
  const pending = saving || operationBusy;

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return;
    setOpen(nextOpen);
    if (!nextOpen) return;

    setDraft(settings);
    setActiveTab("general");
    setSaveError(null);
    setMessage(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    setMessage(null);
    try {
      setDraft(await onSaveSettings(draft));
      setMessage("设置已保存。");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "保存设置失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="icon" aria-label="设置" title="设置" />
        }
      >
        <SettingsIcon aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        aria-busy={pending}
        className="h-[min(520px,calc(100vh-3rem))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-5"
        style={{ maxWidth: "min(720px, calc(100vw - 2rem))" }}
      >
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>管理阅读偏好、订阅源和数据。</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsTab)}
          className="min-h-0"
        >
          <TabsList className="w-full">
            <TabsTrigger value="general">常规</TabsTrigger>
            <TabsTrigger value="subscriptions">订阅管理</TabsTrigger>
            <TabsTrigger value="data">导入与导出</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="min-h-0 overflow-y-auto py-4">
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="font-medium">阅读偏好</h3>
                <p className="text-sm text-muted-foreground">调整同步、外观和文章链接行为。</p>
              </div>
              {settingsLoading ? <p className="text-sm text-muted-foreground">正在加载设置...</p> : null}
              {draft ? (
                <FieldGroup>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>自动刷新间隔</FieldTitle>
                      <FieldDescription>控制后台检查订阅源更新的频率。</FieldDescription>
                    </FieldContent>
                    <Select
                      value={String(draft.refreshIntervalMinutes)}
                      onValueChange={(value) => value && setDraft({ ...draft, refreshIntervalMinutes: Number(value) })}
                    >
                      <SelectTrigger aria-label="自动刷新间隔" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {refreshIntervals.map((minutes) => (
                            <SelectItem key={minutes} value={String(minutes)}>
                              {minutes === 1440 ? "每天" : `${minutes} 分钟`}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>主题</FieldTitle>
                      <FieldDescription>选择界面的明暗外观。</FieldDescription>
                    </FieldContent>
                    <Select
                      value={draft.theme}
                      onValueChange={(value) => value && setDraft({ ...draft, theme: value as Settings["theme"] })}
                    >
                      <SelectTrigger aria-label="主题" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="system">跟随系统</SelectItem>
                          <SelectItem value="light">浅色</SelectItem>
                          <SelectItem value="dark">深色</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>在外部浏览器打开链接</FieldTitle>
                      <FieldDescription>阅读文章时使用系统默认浏览器打开网页。</FieldDescription>
                    </FieldContent>
                    <Switch
                      aria-label="在外部浏览器打开链接"
                      checked={draft.openLinksInBrowser}
                      onCheckedChange={(checked) => setDraft({ ...draft, openLinksInBrowser: checked })}
                    />
                  </Field>
                </FieldGroup>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="subscriptions" className="min-h-0 overflow-y-auto py-4">
            <SubscriptionManager
              feeds={feeds}
              loading={feedsLoading}
              error={feedsError}
              onAdd={onAddFeed}
              onRename={onRenameFeed}
              onRemove={onRemoveFeed}
              onBusyChange={setSubscriptionBusy}
            />
          </TabsContent>

          <TabsContent value="data" className="min-h-0 overflow-y-auto py-4">
            <OpmlTools onBusyChange={setOpmlBusy} />
          </TabsContent>
        </Tabs>

        <div>
          {saveError || settingsError ? (
            <p className="mb-2 text-sm text-destructive" role="alert">{saveError ?? settingsError}</p>
          ) : null}
          {message ? <p className="mb-2 text-sm text-muted-foreground" role="status">{message}</p> : null}
          <DialogFooter className="-mx-5 -mb-5">
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              关闭
            </DialogClose>
            {activeTab === "general" ? (
              <Button onClick={() => void save()} disabled={!draft || settingsLoading || pending}>
                {saving ? "正在保存..." : "保存设置"}
              </Button>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
