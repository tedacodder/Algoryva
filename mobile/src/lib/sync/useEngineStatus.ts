import { useEffect, useState } from "react";
import { getRuntime } from "./runtime";
import type { EngineStatus } from "./engine";

/** The current sync status, kept up to date as cycles run. */
export function useEngineStatus(): EngineStatus {
  const engine = getRuntime().engine;
  const [status, setStatus] = useState<EngineStatus>(engine.status);
  useEffect(() => engine.subscribe(setStatus), [engine]);
  return status;
}
