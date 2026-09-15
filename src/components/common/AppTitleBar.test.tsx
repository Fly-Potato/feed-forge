import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    close: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
  }),
}));

import { AppTitleBar } from "./AppTitleBar";

test("开发构建显示明确的 DEV 标识", () => {
  render(<AppTitleBar />);

  expect(screen.getByText("Feed Forge DEV")).toBeInTheDocument();
});
