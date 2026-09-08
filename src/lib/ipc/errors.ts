export interface IpcErrorShape {
  code: string;
  message: string;
  retryable: boolean;
}

export class IpcError extends Error implements IpcErrorShape {
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: IpcErrorShape) {
    super(input.message);
    this.name = "IpcError";
    this.code = input.code;
    this.retryable = input.retryable;
  }
}

export function normalizeIpcError(error: unknown): IpcError {
  if (isIpcErrorPayload(error)) {
    return new IpcError(error);
  }
  return new IpcError({
    code: "internal",
    message: "The desktop operation failed.",
    retryable: false,
  });
}

function isIpcErrorPayload(error: unknown): error is IpcErrorShape {
  if (!error || typeof error !== "object") {
    return false;
  }
  const value = error as Partial<IpcErrorShape>;
  return typeof value.code === "string" && typeof value.message === "string";
}
