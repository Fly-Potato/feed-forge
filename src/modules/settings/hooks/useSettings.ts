import { useCallback, useEffect, useState } from "react";

import { getSettings, updateSettings } from "../ipc";
import type { Settings } from "../types";

function getErrorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setSettings(undefined);
      setLoading(true);
      setError(null);
      try {
        const loaded = await getSettings();
        if (active) setSettings(loaded);
      } catch (cause) {
        if (active) setError(getErrorMessage(cause, "无法加载设置。"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;

    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : undefined;
    const applyTheme = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && Boolean(media?.matches));
      document.documentElement.classList.toggle("dark", dark);
    };

    applyTheme();
    if (settings.theme !== "system" || !media) return;

    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings]);

  const save = useCallback(async (draft: Settings) => {
    const saved = await updateSettings(draft);
    setSettings(saved);
    setError(null);
    return saved;
  }, []);

  return { settings, loading, error, save };
}
