import { useEffect, useState } from "react";
import { isTauri } from "@/features/shell/platform";

/** 지금 Drive에 연결된 Claude(대화 세션·데스크톱 앱) 수 */
export function useClaudeConnections(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ listen }, { invoke }] = await Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")]);
      const unlisten = await listen<number>("mcp-connections", ({ payload }) => setCount(payload));
      if (cancelled) return unlisten();
      off = unlisten;
      setCount(await invoke<number>("mcp_connections")); // 듣기 시작한 뒤에 읽어야 그 사이 바뀐 값을 놓치지 않는다
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);
  return count;
}
