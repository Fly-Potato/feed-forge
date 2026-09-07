import { mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import App from "./App";

describe("App", () => {
  test("renders the greeting form with accessible controls", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Welcome to Feed Forge" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send greeting" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enter a name to verify the desktop bridge.",
    );
  });

  test("sends the greet command with the entered name", async () => {
    const calls: Array<[string, unknown]> = [];
    mockIPC((command, payload) => {
      calls.push([command, payload]);
      if (command === "greet") {
        return "Hello, Ada! Welcome to Feed Forge.";
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");
    await user.click(screen.getByRole("button", { name: "Send greeting" }));

    await waitFor(() => {
      expect(calls).toEqual([["greet", { name: "Ada" }]]);
    });
  });

  test("shows the greeting returned by the desktop command", async () => {
    mockIPC((command) => {
      if (command === "greet") {
        return "Hello, Ada! Welcome to Feed Forge.";
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");
    await user.click(screen.getByRole("button", { name: "Send greeting" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Hello, Ada! Welcome to Feed Forge.",
      );
    });
  });

  test("shows a fixed error without leaking the IPC failure", async () => {
    mockIPC((command) => {
      if (command === "greet") {
        throw new Error("sensitive desktop failure");
      }
      throw new Error(`Unexpected IPC command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Send greeting" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Could not reach the Feed Forge desktop runtime.",
      );
    });
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "sensitive desktop failure",
    );
  });
});
