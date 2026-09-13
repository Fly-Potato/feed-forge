import { useMutation, useQueryClient } from "@tanstack/react-query";

import { feedKeys } from "../../feeds/keys";
import { exportOpml, importOpml } from "../ipc";

export function useOpml() {
  const client = useQueryClient();
  const imported = useMutation({
    mutationFn: importOpml,
    onSettled: () => { void client.invalidateQueries({ queryKey: feedKeys.all }); },
  });
  const exported = useMutation({ mutationFn: exportOpml });
  return {
    importContent: (content: string) => imported.mutateAsync(content),
    exportContent: () => exported.mutateAsync(),
  };
}
