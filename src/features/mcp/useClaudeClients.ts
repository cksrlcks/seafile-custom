import { useEffect, useState } from "react";
import { isTauri } from "@/features/shell/platform";

/** 지금 U-Drive에 연결된 Claude 종류("Claude Code", "Claude 데스크톱"). 연결이 없으면 빈 배열 */
export function useClaudeClients(): string[] {
  const [clients, setClients] = useState<string[]>([]);
  useEffect(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ listen }, { invoke }] = await Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")]);
      const unlisten = await listen<string[]>("mcp-clients", ({ payload }) => setClients(payload));
      if (cancelled) return unlisten();
      off = unlisten;
      setClients(await invoke<string[]>("mcp_clients")); // 듣기 시작한 뒤에 읽어야 그 사이 바뀐 값을 놓치지 않는다
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);
  return clients;
}
