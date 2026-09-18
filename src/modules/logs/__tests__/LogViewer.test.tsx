import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";

import { LogViewer } from "../components/LogViewer";
import { useLogStore } from "../store";

beforeEach(() => {
  useLogStore.setState({ entries: [], nextId: 1 });
  useLogStore.getState().append({ level: "info", message: "sync completed" });
  useLogStore.getState().append({ level: "error", message: "update failed" });
});

test("filters the live log by level and keyword", async () => {
  render(<LogViewer />);

  expect(screen.getByText("sync completed")).toBeInTheDocument();
  expect(screen.getByText("update failed")).toBeInTheDocument();

  const search = screen.getByRole("searchbox", { name: "搜索日志" });
  await userEvent.type(search, "SYNC");
  expect(screen.getByText("sync completed")).toBeInTheDocument();
  expect(screen.queryByText("update failed")).not.toBeInTheDocument();

  await userEvent.clear(search);
  await userEvent.click(screen.getByRole("combobox", { name: "日志级别" }));
  await userEvent.click(await screen.findByRole("option", { name: "错误" }));
  expect(screen.queryByText("sync completed")).not.toBeInTheDocument();
  expect(screen.getByText("update failed")).toBeInTheDocument();
});

test("clears only the in-memory log view", async () => {
  render(<LogViewer />);

  await userEvent.click(screen.getByRole("button", { name: "清空视图" }));

  expect(useLogStore.getState().entries).toEqual([]);
  expect(screen.getByText("当前运行期间还没有日志。")).toBeInTheDocument();
});
