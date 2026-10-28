import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isTauri } from "@/features/shell/platform";
import { useThumbnailPref } from "./useThumbnailPref";

interface Props {
  open: boolean;
  onClose(): void;
}

/** 설정: 앱 동작 옵션. 서버·계정 변경은 로그아웃 후 로그인 화면에서 한다 */
export function SettingsDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton className="text-sm sm:max-w-sm">{open && <Body />}</DialogContent>
    </Dialog>
  );
}

function Body() {
  // null = 아직 모름(확인 중이거나 설치된 앱이 아님)
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useThumbnailPref();
  useEffect(() => {
    if (!isTauri()) return;
    void import("@tauri-apps/plugin-autostart").then((a) => a.isEnabled()).then(setAutostart, () => setAutostart(false));
  }, []);

  async function toggle(on: boolean) {
    setError(null);
    try {
      const a = await import("@tauri-apps/plugin-autostart");
      await (on ? a.enable() : a.disable());
      setAutostart(await a.isEnabled());
    } catch (e) {
      setError(`바꾸지 못했습니다 (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle>설정</DialogTitle>
      </DialogHeader>
      <label className="flex items-start gap-2.5">
        <Checkbox checked={!!autostart} disabled={autostart === null} onCheckedChange={(v) => void toggle(!!v)} className="mt-0.5" />
        <span className="flex flex-col gap-0.5">
          <span>컴퓨터를 켜면 Drive 자동 실행</span>
          <span className="text-xs text-muted-foreground">창 없이 트레이(메뉴 막대)에서 시작합니다</span>
        </span>
      </label>
      {!isTauri() && <p className="text-xs text-muted-foreground">설치된 앱에서만 바꿀 수 있습니다</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <label className="flex items-start gap-2.5">
        <Checkbox checked={thumbs} onCheckedChange={(v) => setThumbs(!!v)} className="mt-0.5" />
        <span className="flex flex-col gap-0.5">
          <span>이미지 썸네일 표시</span>
          <span className="text-xs text-muted-foreground">아이콘 보기와 세부 정보 창에 적용됩니다. 끄면 파일 아이콘으로 보입니다</span>
        </span>
      </label>
    </div>
  );
}
