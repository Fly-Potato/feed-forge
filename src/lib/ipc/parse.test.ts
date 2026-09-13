import { expect, test } from "vitest";
import { z } from "zod";

import { IpcError, normalizeIpcError } from "./errors";
import { parseIpcResult } from "./parse";

test("rejects malformed success data without exposing the payload", () => {
  expect(() => parseIpcResult(z.object({ id: z.number() }), { id: "private-value" }))
    .toThrowError(IpcError);
  try {
    parseIpcResult(z.object({ id: z.number() }), { id: "private-value" });
    throw new Error("Expected invalid response");
  } catch (error) {
    expect(error).toMatchObject({ code: "invalid_response", retryable: false, message: "桌面返回的数据格式无效。" });
    expect(String(error)).not.toContain("private-value");
  }
});

test("does not trust malformed command rejection fields", () => {
  expect(normalizeIpcError({ code: "offline", message: "unsafe", retryable: "yes" }))
    .toMatchObject({ code: "internal", retryable: false, message: "桌面操作失败。" });
});
