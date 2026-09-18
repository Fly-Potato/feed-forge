import { debug, error, info, warn } from "@tauri-apps/plugin-log";

function scopedMessage(scope: string, message: string) {
  return `[${scope}] ${message}`;
}

async function write(
  target: (message: string) => Promise<void>,
  scope: string,
  message: string,
) {
  try {
    await target(scopedMessage(scope, message));
  } catch {
    // Logging must never change the outcome of the operation being observed.
  }
}

export const appLogger = {
  debug: (scope: string, message: string) => write(debug, scope, message),
  info: (scope: string, message: string) => write(info, scope, message),
  warn: (scope: string, message: string) => write(warn, scope, message),
  error: (scope: string, message: string) => write(error, scope, message),
};
