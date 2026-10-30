import { IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { checkForUpdate, installUpdate, useAvailableVersion, useUpdater } from "./updater";
import pkg from "../../../package.json";

/** 버전 표시 + 업데이트 확인. 새 버전이 있으면 지금 버전에 취소선을 긋고 새 버전과 업데이트 버튼을 보인다 */
export function VersionCheck() {
  const s = useUpdater();
  const latest = useAvailableVersion();
  const checking = s.kind === "checking";
  const downloading = s.kind === "downloading";

  return (
    <div className="flex h-6 items-center gap-1.5 text-xs text-muted-foreground">
      {latest ? (
        <>
          <s>v{pkg.version}</s>
          <span className="font-medium text-foreground">v{latest}</span>
          <Button size="xs" disabled={downloading} onClick={() => void installUpdate()}>
            {downloading ? "업데이트 중…" : "업데이트"}
          </Button>
        </>
      ) : (
        <span>v{pkg.version}</span>
      )}
      <Button variant="ghost" size="icon-xs" disabled={checking || downloading} onClick={() => void checkForUpdate(true)} title="업데이트 확인" aria-label="업데이트 확인">
        <IconRefresh className={checking ? "animate-spin" : undefined} />
      </Button>
    </div>
  );
}
