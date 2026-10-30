import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatSize } from "@/lib/format";
import { logError } from "@/lib/errorLog";
import { answerOffer, listenNearby, nearby, useNearby, type Offer } from "./nearby";

/** 받을지 묻는 시간(Rust ASK_TIMEOUT과 같게). 지나면 Rust가 거절하고 팝업을 닫는다 */
const ASK_SECONDS = 60;

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
  return <Card offer={offer} waiting={offers.length - 1} />;
}

function Card({ offer, waiting }: { offer: Offer; waiting: number }) {
  const left = useCountdown(offer.id);
  const files = offer.files.length > 1 ? `${offer.files[0].name} 외 ${offer.files.length - 1}개` : offer.files[0].name;
  return (
    <div className="flex h-screen flex-col gap-2 border border-border bg-popover p-3 text-sm text-popover-foreground select-none">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">{offer.from.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{offer.from.name}님이 파일을 보냅니다</div>
          <div className="truncate text-2xs text-muted-foreground">
            {offer.from.device} · {offer.from.email}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 text-xs" title={offer.files.map((f) => f.name).join("\n")}>
        <span className="min-w-0 flex-1 truncate">{files}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{formatSize(offer.total)}</span>
      </div>
      <div className="mt-auto flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground tabular-nums">
          {left}초 뒤 거절{waiting > 0 && ` · ${waiting}개 더 대기`}
        </span>
        <Button variant="outline" size="sm" onClick={() => void answerOffer(offer.id, false)}>
          거절
        </Button>
        <Button size="sm" onClick={() => void answerOffer(offer.id, true)}>
          받기
        </Button>
      </div>
    </div>
  );
}

/** key가 바뀔 때마다 ASK_SECONDS부터 다시 센다 */
function useCountdown(key: string) {
  const [left, setLeft] = useState(ASK_SECONDS);
  useEffect(() => {
    const start = Date.now();
    setLeft(ASK_SECONDS);
    const t = setInterval(() => setLeft(Math.max(0, ASK_SECONDS - Math.floor((Date.now() - start) / 1000))), 500);
    return () => clearInterval(t);
  }, [key]);
  return left;
}
