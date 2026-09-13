import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { IpcError } from "../../../lib/ipc/errors";
import { getSettings, updateSettings } from "../ipc";
import { settingsKeys } from "../keys";
import type { Settings } from "../types";

function getErrorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function useSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: settingsKeys.all, queryFn: getSettings });
  const settings = query.data;

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
  }, [settings?.theme]);

  const update = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => { queryClient.setQueryData(settingsKeys.all, saved); },
    onSettled: (_data, error) => {
      if (error instanceof IpcError && error.code === "invalid_response")
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });

  return {
    settings, loading: query.isPending, error: query.error ? getErrorMessage(query.error, "无法加载设置。") : null,
    save: (draft: Settings) => update.mutateAsync(draft),
  };
}
