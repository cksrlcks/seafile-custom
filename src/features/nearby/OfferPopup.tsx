import { IconDeviceDesktop, IconDeviceLaptop, IconFile } from "@tabler/icons-react";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { setPrefs, useAppPrefs } from "@/features/settings/appPrefs";
import { COVER } from "@/features/shell/cover";
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

  const accept = () => void answerOffer(offer.id, true, to === "drive" ? prefs.receiveDrive : null, prefs.receivePcDir);
  const note = first ? "고른 곳으로 다음에도 받습니다. 설정에서 바꿀 수 있어요" : choosing && to ? "다음에도 이렇게 받습니다" : big ? "200MB가 넘는 파일은 PC 폴더에 받습니다" : "";

  return (
    <div className="flex h-screen cursor-default flex-col border border-border bg-popover text-sm text-popover-foreground select-none">
      <Cover name={offer.files[0].name} count={offer.files.length} left={left} />
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        {/* 누가 무엇을 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="flex-1 leading-5 font-semibold">파일 수신</span>
            {waiting > 0 && <span className="text-2xs text-muted-foreground">{waiting}개 더 기다리는 중</span>}
          </div>
          <div className="truncate text-xs leading-4" title={offer.from.email}>
            {offer.from.name}
            <span className="text-muted-foreground"> · {offer.from.device}</span>
          </div>
          <div className="flex gap-1.5 text-xs leading-4 text-muted-foreground" title={offer.files.map((f) => f.name).join("\n")}>
            <span className="min-w-0 flex-1 truncate">{files}</span>
            <span className="shrink-0 tabular-nums">{formatSize(offer.total)}</span>
          </div>
        </div>

        {/* 어디로 */}
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
          <div className="flex h-6 items-center gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">받을 위치</span>
            {choosing ? (
              <>
                <Choice value={to} canDrive={!!prefs.receiveDrive} onChange={(v) => setPrefs({ receiveTo: v })} />
                <button type="button" onClick={() => void openSendSettings()} className="ml-auto shrink-0 text-2xs text-primary hover:underline">
                  폴더 바꾸기…
                </button>
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
          {choosing && to && <div className="truncate text-2xs text-muted-foreground" title={receiveLabel(to, prefs)}>{receiveLabel(to, prefs)}</div>}
          {note && <div className="truncate text-2xs text-muted-foreground">{note}</div>}
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

/** 맨 위 그림: 보낸 사람 PC → 파일 → 내 PC. 새 버전 알림과 같은 배경. 파일은 OS 셸 아이콘 */
function Cover({ name, count, left }: { name: string; count: number; left: number }) {
  const icon = useFileIcon(name);
  return (
    <div className="relative flex h-20 shrink-0 items-center justify-center gap-3 text-white" style={COVER}>
      <span className="absolute top-2 right-2.5 text-2xs text-white/85 tabular-nums">{left}초</span>
      <IconDeviceLaptop className="size-8 drop-shadow-md" stroke={1.5} />
      <Dots />
      <span className="relative flex size-12 items-center justify-center rounded-lg bg-white/95 shadow-dialog">
        {icon ? <img src={icon} alt="" className="size-8" draggable={false} /> : <IconFile className="size-7 text-muted-foreground" stroke={1.5} />}
        {count > 1 && <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-medium text-primary-foreground tabular-nums">{count}</span>}
      </span>
      <Dots />
      <IconDeviceDesktop className="size-8 drop-shadow-md" stroke={1.5} />
    </div>
  );
}

/** 오가는 중임을 보이는 점 세 개(차례로 깜빡) */
function Dots() {
  return (
    <span className="flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 animate-pulse rounded-full bg-white" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </span>
  );
}

/** 확장자에 맞는 OS 파일 아이콘(48px PNG). 팝업 창에는 쿼리 캐시가 없어 직접 받는다 */
function useFileIcon(name: string): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    let url: string | null = null;
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<ArrayBuffer>("file_icon", { ext, dir: false, size: 48 }))
      .then((png) => setSrc((url = URL.createObjectURL(new Blob([png], { type: "image/png" })))))
      .catch(() => {}); // 못 받으면 기본 아이콘
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [name]);
  return src;
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
