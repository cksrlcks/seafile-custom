import { IconBuildingBroadcastTower, IconChevronDown, IconCloud, IconDeviceDesktop } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  if (!offer) return null;
  return <Card key={offer.id} offer={offer} waiting={offers.length - 1} />;
}

function Card({ offer, waiting }: { offer: Offer; waiting: number }) {
  const prefs = useAppPrefs();
  const left = useCountdown();
  const to = prefs.receiveTo;
  const files = offer.files.length > 1 ? `${offer.files[0].name} 외 ${offer.files.length - 1}개` : offer.files[0].name;
  const big = to === "drive" && offer.files.some((f) => f.size > UPLOAD_CAP);
  // 처음 받을 때(아직 안 정함)는 고른 곳이 다음에도 쓰인다고 알려 준다
  const note = to === null ? "고른 곳으로 다음에도 받습니다. 설정에서 바꿀 수 있어요" : big ? "200MB가 넘는 파일은 PC 폴더에 받습니다" : "";

  const accept = () => void answerOffer(offer.id, true, to === "drive" ? prefs.receiveDrive : null, prefs.receivePcDir);

  return (
    // 맥은 투명한 창 위에 둥근 상자로(창 그림자는 OS가 이 모양을 따라 그린다)
    <div className="flex h-screen cursor-default flex-col overflow-hidden border border-border bg-popover text-sm text-popover-foreground select-none mac:rounded-[12px]">
      <Cover left={left} />
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
          <div className="flex items-center gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">받을 위치</span>
            <Destination />
          </div>
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

/** 받을 위치 고르기: 지금 정해진 곳을 보여 주는 버튼 하나. 누르면 내 PC · 드라이브 · 폴더 바꾸기 */
function Destination() {
  const prefs = useAppPrefs();
  const to = prefs.receiveTo;
  const Icon = to === "drive" ? IconCloud : IconDeviceDesktop;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-6.5 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-left outline-none hover:bg-accent focus-visible:border-primary">
        {to && <Icon className="size-3.5 shrink-0 text-muted-foreground" stroke={1.75} />}
        <span className="min-w-0 flex-1 truncate">{to ? `${to === "drive" ? "드라이브" : "내 PC"} · ${receiveLabel(to, prefs)}` : <span className="text-muted-foreground">어디로 받을지 고르세요</span>}</span>
        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" stroke={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top">
        <DropdownMenuRadioGroup value={to ?? ""} onValueChange={(v) => setPrefs({ receiveTo: v as "pc" | "drive" })}>
          {/* 메뉴 항목은 한 줄 높이라 경로는 넣지 않는다(고르면 버튼에 보인다). 고르면 바로 닫는다 */}
          <DropdownMenuRadioItem value="pc" closeOnClick title={receiveLabel("pc", prefs)} className="text-sm">
            <IconDeviceDesktop stroke={1.75} /> 내 PC
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="drive" closeOnClick disabled={!prefs.receiveDrive} title={receiveLabel("drive", prefs)} className="text-sm">
            <IconCloud stroke={1.75} /> 드라이브
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void openSendSettings()} className="text-sm">
          폴더 바꾸기…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 맨 위 그림: 모니터 ··· 송수신탑 ··· 모니터. 새 버전 알림과 같은 배경. 팝업 테두리에서 2px 안쪽, 모서리는 살짝 둥글게(맥은 바깥 12px와 맞춰 10px) */
function Cover({ left }: { left: number }) {
  return (
    <div className="shrink-0 p-0.5">
      <div className="relative flex h-28 items-center justify-center gap-3.5 rounded-[6px] text-white mac:rounded-[10px]" style={COVER}>
        <span className="absolute top-2 right-2.5 text-2xs text-white/85 tabular-nums">{left}초</span>
        <IconDeviceDesktop className="size-9 drop-shadow-md" stroke={1.5} />
        <Dots />
        <IconBuildingBroadcastTower className="size-12 drop-shadow-md" stroke={1.4} />
        <Dots />
        <IconDeviceDesktop className="size-9 drop-shadow-md" stroke={1.5} />
      </div>
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
