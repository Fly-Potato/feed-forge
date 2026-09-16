import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import type { UpdaterController } from "@/modules/updater/hooks/useUpdater";

import { SettingsDialog } from "./SettingsDialog";

test("shows application version and manual update controls on the about tab", async () => {
  const updater: UpdaterController = {
    currentVersion: "0.1.0",
    status: "up-to-date",
    update: null,
    progress: undefined,
    error: null,
    promptOpen: false,
    check: vi.fn(),
    install: vi.fn(),
    dismissPrompt: vi.fn(),
  };
  render(
    <SettingsDialog
      feeds={[]}
      feedGroups={[]}
      feedsLoading={false}
      feedsError={null}
      onAddFeed={vi.fn()}
      onRenameFeed={vi.fn()}
      onRemoveFeed={vi.fn()}
      onCreateFeedGroup={vi.fn()}
      onRenameFeedGroup={vi.fn()}
      onRemoveFeedGroup={vi.fn()}
      onMoveFeed={vi.fn()}
      settings={{ refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true }}
      settingsLoading={false}
      settingsError={null}
      onSaveSettings={vi.fn()}
      updater={updater}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "设置" }));
  await userEvent.click(screen.getByRole("tab", { name: "关于" }));

  expect(screen.getByText("当前版本 0.1.0")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "检查更新" })).toBeInTheDocument();
});
