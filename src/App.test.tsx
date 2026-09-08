import { mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import App from "./App";

describe("App", () => {
  test("renders the local RSS reader empty state", async () => {
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
    expect(screen.getByRole("textbox", { name: "Feed URL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add feed" })).toBeInTheDocument();
    expect(await screen.findByText("No feeds yet")).toBeInTheDocument();
    expect(screen.getByText("Select a feed to read articles")).toBeInTheDocument();
    await waitFor(() => expect(calls).toEqual(["feeds_list"]));
  });
});
