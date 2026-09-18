import { expect, test } from "vitest";

import { useLogStore } from "../store";

test("keeps only the newest 1000 records and preserves monotonic IDs after clearing", () => {
  for (let index = 1; index <= 1002; index += 1) {
    useLogStore.getState().append({ level: "info", message: `record ${index}` });
  }

  const retained = useLogStore.getState().entries;
  expect(retained).toHaveLength(1000);
  expect(retained[0]).toEqual({ id: 3, level: "info", message: "record 3" });
  expect(retained[retained.length - 1]).toEqual({
    id: 1002,
    level: "info",
    message: "record 1002",
  });

  useLogStore.getState().clear();
  expect(useLogStore.getState().entries).toEqual([]);

  useLogStore.getState().append({ level: "warn", message: "after clear" });
  expect(useLogStore.getState().entries).toEqual([
    { id: 1003, level: "warn", message: "after clear" },
  ]);
});
