import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { TwoSiderProgress } from "@/types";

// Two-Sider progress is a lightweight, per-device record of how far up the
// three-stage ladder a student has climbed for each essay — stored in
// localStorage rather than recall_progress (which is keyed to chapter rows).
const KEY = "recall:two-siders";

export function useTwoSiderProgress() {
  const [map, setMap] = useLocalStorage<TwoSiderProgress>(KEY, {});

  const completed = useCallback((id: string) => map[id] ?? 0, [map]);

  // Record that `stage` (1..3) is done; never moves a student backwards.
  const complete = useCallback(
    (id: string, stage: number) =>
      setMap((prev) => ({ ...prev, [id]: Math.max(prev[id] ?? 0, stage) })),
    [setMap],
  );

  return { map, completed, complete };
}
