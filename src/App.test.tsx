import { mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import App from "./App";

describe("App", () => {
  test("显示中文的本地 RSS 阅读器空状态", async () => {
    const calls: string[] = [];
    mockIPC((command) => {
      calls.push(command);
      if (command === "feeds_list") {
        return [];
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Feed Forge" }),
    ).toBeInTheDocument();
    expect(screen.getByText("本地 RSS 阅读器")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "订阅源地址" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加订阅" })).toBeInTheDocument();
    expect(await screen.findByText("暂无订阅源")).toBeInTheDocument();
    expect(screen.getByText("请选择订阅源以查看文章")).toBeInTheDocument();
    await waitFor(() => expect(calls).toEqual(["feeds_list"]));
  });
});
