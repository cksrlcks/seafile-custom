import { IconFiles } from "@tabler/icons-react";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CloudMark } from "@/components/ui/cloud-mark";
import { setPrefs, useAppPrefs } from "@/features/settings/appPrefs";
import { formatSize } from "@/lib/format";
import { logError } from "@/lib/errorLog";
import { answerOffer, listenNearby, nearby, openSendSettings, receiveLabel, useNearby, type Offer } from "./nearby";

/** 받을지 묻는 시간(Rust ASK_TIMEOUT과 같게). 지나면 Rust가 거절하고 팝업을 닫는다 */
const ASK_SECONDS = 60;
/** 드라이브로 받기는 이보다 큰 파일을 PC에 받는다(Rust READ_CAP) */
const UPLOAD_CAP = 200 * 1024 * 1024;

/**
 * 받기 요청 팝업 창의 화면. 화면 오른쪽 아래에 포커스를 뺏지 않고 뜨는 작은 창이라, 일하던 창은 그대로 둔다.
 * 요청이 여러 개면 하나씩 묻는다. 창을 닫는 건 Rust가 남은 요청이 없을 때 한다.
 */
export function OfferPopup() {
  const { offers } = useNearby();

  useEffect(() => {
    const off = listenNearby();
    // 창이 뜨기 전에 온 요청
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<Offer[]>("nearby_offers"))
      .then((list) => list.forEach(nearby.addOffer))
      .catch((e) => logError("nearby", e));
    return () => void off.then((f) => f());
  }, []);

  const offer = offers[0];
  if (!offer) return <div className="h-screen bg-popover" />;
  return <Card key={offer.id} offer={offer} waiting={offers.length - 1} />;
}

function Card({ offer, waiting }: { offer: Offer; waiting: number }) {
  const prefs = useAppPrefs();
  const left = useCountdown();
  const to = prefs.receiveTo;
  // 처음 받을 때(아직 안 정함)나 [바꾸기]를 누르면 고르는 줄을 보인다
  const [choosing, setChoosing] = useState(to === null);
  const first = to === null;
  const files = offer.files.length > 1 ? `${offer.files[0].name} 외 ${offer.files.length - 1}개` : offer.files[0].name;
  const big = to === "drive" && offer.files.some((f) => f.size > UPLOAD_CAP);

  const accept = () => void answerOffer(offer.id, true, to === "drive" ? prefs.receiveDrive : null);

  return (
    <div className="flex h-screen cursor-default flex-col border border-border bg-popover text-sm text-popover-foreground select-none">
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-3 pt-2.5">
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <CloudMark className="size-3.5" />
          <span className="flex-1">바로 보내기{waiting > 0 && ` · ${waiting}개 더 기다리는 중`}</span>
          <span className="tabular-nums">{left}초</span>
        </div>
        <div className="truncate font-medium" title={offer.from.email}>
          {offer.from.name}
          <span className="font-normal text-muted-foreground"> · {offer.from.device}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs" title={offer.files.map((f) => f.name).join("\n")}>
          <IconFiles className="size-3.5 shrink-0 text-muted-foreground" stroke={1.75} />
          <span className="min-w-0 flex-1 truncate">{files}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">{formatSize(offer.total)}</span>
        </div>

        <div className="mt-1 flex h-6 items-center gap-2 text-xs">
          <span className="shrink-0 text-muted-foreground">받을 위치</span>
          {choosing ? (
            <>
              <Choice value={to} canDrive={!!prefs.receiveDrive} onChange={(v) => setPrefs({ receiveTo: v })} />
              {to === "drive" && (
                <button type="button" onClick={() => void openSendSettings()} className="ml-auto shrink-0 text-2xs text-primary hover:underline">
                  폴더 바꾸기…
                </button>
              )}
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate" title={receiveLabel(to!, prefs)}>
                {to === "drive" ? "드라이브" : "내 PC"} · {receiveLabel(to!, prefs)}
              </span>
              <button type="button" onClick={() => setChoosing(true)} className="shrink-0 text-2xs text-primary hover:underline">
                바꾸기
              </button>
            </>
          )}
        </div>
        <div className="truncate text-2xs text-muted-foreground">
          {first ? "고른 곳으로 다음에도 받습니다. 설정에서 바꿀 수 있어요" : choosing && to ? `${receiveLabel(to, prefs)}에 받습니다. 다음에도 이렇게 받아요` : big ? "200MB가 넘는 파일은 PC 다운로드 폴더에 받습니다" : ""}
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-1.5 border-t border-dialog-footer-border bg-dialog-footer px-2.5 py-1.75">
        <Button variant="outline" onClick={() => void answerOffer(offer.id, false)}>
          거절
        </Button>
        <Button onClick={accept} disabled={!to}>
          받기
        </Button>
      </div>
    </div>
  );
}

/** 내 PC · 드라이브 중 하나. 설정의 Segmented와 같은 모양(작게) */
function Choice({ value, canDrive, onChange }: { value: "pc" | "drive" | null; canDrive: boolean; onChange(v: "pc" | "drive"): void }) {
  const opts = [
    { v: "pc" as const, label: "내 PC" },
    { v: "drive" as const, label: "드라이브", disabled: !canDrive },
  ];
  return (
    <div role="radiogroup" aria-label="받을 위치" className="flex shrink-0 rounded-md bg-muted p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          disabled={o.disabled}
          title={o.disabled ? "올릴 수 있는 저장소가 없습니다" : undefined}
          onClick={() => onChange(o.v)}
          className={cn("h-5 rounded-[5px] px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50", value === o.v && "bg-card font-medium text-foreground shadow-button-subtle")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 요청마다(Card를 key로 새로 그린다) ASK_SECONDS부터 센다 */
function useCountdown() {
  const [left, setLeft] = useState(ASK_SECONDS);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setLeft(Math.max(0, ASK_SECONDS - Math.floor((Date.now() - start) / 1000))), 500);
    return () => clearInterval(t);
  }, []);
  return left;
}
