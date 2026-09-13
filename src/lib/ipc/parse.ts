import { z } from "zod";

import { IpcError } from "./errors";

export function invalidResponseError(): IpcError {
  return new IpcError({
    code: "invalid_response",
    message: "桌面返回的数据格式无效。",
    retryable: false,
  });
}

export function parseIpcResult<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw invalidResponseError();
  return result.data;
}
