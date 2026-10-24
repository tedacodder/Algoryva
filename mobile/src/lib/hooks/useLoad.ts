import { useCallback, useEffect, useState } from "react";

/**
 * Loads data for a screen. A request is identified by `key` plus a reload counter. The screen is "loading" until the result for the
 * current request arrives, so the effect never sets state synchronously (only inside the async callbacks).
 */
type Result<T> = { id: string; data: T | null; error: string | null };

export function useLoad<T>(load: () => Promise<T>, key: string): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T>>({ id: "", data: null, error: null });
  const id = `${key}#${tick}`;

  useEffect(() => {
    let alive = true;
    load()
      .then((data) => {
        if (alive) setResult({ id, data, error: null });
      })
      .catch((e: unknown) => {
        if (alive) setResult({ id, data: null, error: e instanceof Error ? e.message : "Could not load." });
      });
    return () => {
      alive = false;
    };
    // `load` is recreated on every render by design. The request is identified by `id` (key and reload counter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return {
    data: result.id === id ? result.data : null,
    error: result.id === id ? result.error : null,
    loading: result.id !== id,
    reload,
  };
}
