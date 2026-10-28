import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconSettings, IconUserCircle, IconX } from "@tabler/icons-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { isTauri, openExternal } from "@/features/shell/platform";
import { openLogDir } from "@/lib/errorLog";
import { formatSize } from "@/lib/format";
import { useSession, useStorage } from "@/storage/StorageContext";
import { setPrefs, useAppPrefs, type Theme } from "./appPrefs";
import { useThumbnailPref } from "./useThumbnailPref";

interface Props {
  open: boolean;
  onClose(): void;
}

type Page = "account" | "general";
const PAGES: { id: Page; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "일반", icon: IconSettings },
  { id: "account", label: "내 계정", icon: IconUserCircle },
];
const TITLE: Record<Page, string> = { account: "내 계정", general: "일반" };

/** 설정: 왼쪽 탐색 + 오른쪽 항목 목록. 서버 변경은 로그아웃 후 로그인 화면에서 한다 */
export function SettingsDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(732px,calc(100vh-4rem))] w-[880px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[calc(100%-2rem)]">
        {open && <Body />}
      </DialogContent>
    </Dialog>
  );
}

function Body() {
  const [page, setPage] = useState<Page>("general");
  return (
    <>
      <nav className="flex w-[200px] shrink-0 flex-col border-r border-border bg-surface-header">
        <DialogPrimitive.Title className="px-5 pt-5 text-base font-semibold">설정</DialogPrimitive.Title>
        <div className="flex flex-col gap-0.5 px-3 pt-5">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              className={cn("flex h-9 items-center gap-2 rounded-lg px-2.5 text-left text-base outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary/40", page === id && "bg-accent font-medium hover:bg-accent")}
            >
              <Icon className="size-[18px] text-foreground/80" />
              {label}
            </button>
          ))}
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-8">
          <span className="text-sm text-muted-foreground">
            설정<span className="mx-2 text-foreground/25">/</span>
            <span className="text-foreground">{TITLE[page]}</span>
          </span>
          <DialogPrimitive.Close className="-mr-1.5 rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
            <IconX className="size-[18px]" />
            <span className="sr-only">닫기</span>
          </DialogPrimitive.Close>
        </header>
        <div className="flex-1 overflow-y-auto px-8 pt-6 pb-8">{page === "account" ? <AccountPage /> : <GeneralPage />}</div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7 last:mb-0">
      <h3 className="mb-1 text-xs text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ title, desc, children }: { title: string; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[69px] items-center gap-6 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-semibold">{title}</span>
        {desc && <span className="text-sm text-muted-foreground">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

const Pill = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn("max-w-[60%] truncate rounded-full bg-muted px-2 py-1 text-xs font-semibold", className)}>{children}</span>;
const btn = "h-8 shrink-0 rounded-[10px] border bg-card px-3 text-sm outline-none focus-visible:ring-2";
const btnOutline = cn(btn, "border-border hover:bg-muted focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50");

/** 몇 개 중 하나 고르기(테마·배율) */
function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex shrink-0 rounded-[10px] bg-muted p-0.5", disabled && "pointer-events-none opacity-50")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-[8px] px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40", value === o.value && "bg-card font-medium text-foreground shadow-button-subtle")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AccountPage() {
  const storage = useStorage();
  const { session, logout } = useSession();
  const acc = useQuery({ queryKey: ["account"], queryFn: () => storage.getAccount(), staleTime: 30_000 }).data;
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => storage.listGroups() });
  const { connection } = session;
  return (
    <>
      <Section title="내 계정">
        <Row title="이름" desc="다른 사람에게 표시되는 이름입니다">
          {/* 소속 그룹을 이름 앞에 다른 색으로 */}
          <span className="flex max-w-[60%] flex-wrap justify-end gap-1.5">
            {groups.data?.map((g) => (
              <Pill key={g} className="max-w-full bg-primary/10 text-primary">
                {g}
              </Pill>
            ))}
            <Pill className="max-w-full">{acc?.name ?? "…"}</Pill>
          </span>
        </Row>
        <Row title="이메일" desc="로그인할 때 쓰는 이메일입니다">
          <Pill>{acc?.email ?? "…"}</Pill>
        </Row>
        <Row title="사용량" desc={acc && !acc.quota ? "할당량 제한이 없습니다" : "내 저장소에서 쓰고 있는 용량입니다"}>
          {acc && (
            <span className="flex w-40 flex-col items-end gap-1.5">
              {acc.quota && <Progress value={Math.max(1.5, Math.min(100, (acc.usage / acc.quota) * 100))} className="w-full **:data-[slot=progress-track]:h-1.5 **:data-[slot=progress-track]:bg-foreground/15" />}
              <span className="text-xs text-muted-foreground">
                {formatSize(acc.usage)}
                {acc.quota && ` / ${formatSize(acc.quota)}`} 사용
              </span>
            </span>
          )}
        </Row>
        {/* 일반 사용자용 비밀번호 변경 API가 없어서 서버 웹 설정 페이지를 브라우저로 연다 */}
        <Row title="비밀번호" desc="웹 설정 페이지에서 바꿉니다">
          <button type="button" disabled={connection.kind === "mock"} onClick={() => openExternal(`${connection.baseUrl}/profile/`)} className={btnOutline}>
            비밀번호 변경
          </button>
        </Row>
      </Section>
      <Section title="접속">
        <Row title="서버" desc="다른 서버에 접속하려면 로그아웃한 뒤 로그인 화면에서 바꿉니다">
          <Pill>{connection.baseUrl}</Pill>
        </Row>
        <Row title="로그아웃" desc="로그아웃하면 다시 들어올 때 비밀번호가 필요합니다">
          <button type="button" onClick={logout} className={cn(btn, "border-destructive text-destructive hover:bg-destructive/5 focus-visible:ring-destructive/40")}>
            로그아웃
          </button>
        </Row>
      </Section>
    </>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];
const ZOOMS = [0.9, 1, 1.1, 1.25].map((v) => ({ value: v, label: `${Math.round(v * 100)}%` }));

function GeneralPage() {
  // null = 아직 모름(확인 중이거나 설치된 앱이 아님)
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useThumbnailPref();
  const prefs = useAppPrefs();
  const app = isTauri();
  useEffect(() => {
    if (!app) return;
    void import("@tauri-apps/plugin-autostart").then((a) => a.isEnabled()).then(setAutostart, () => setAutostart(false));
  }, [app]);

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

  async function pickDownloadDir() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ title: "다운로드 폴더", directory: true, defaultPath: prefs.downloadDir ?? undefined });
    if (typeof dir === "string") setPrefs({ downloadDir: dir });
  }

  return (
    <>
      <Section title="모양">
        <Row title="테마" desc="시스템을 고르면 OS의 라이트·다크 설정을 따릅니다">
          <Segmented label="테마" value={prefs.theme} options={THEMES} onChange={(theme) => setPrefs({ theme })} />
        </Row>
        <Row title="화면 크기" desc={app ? "글자와 화면 요소를 함께 키우거나 줄입니다" : "설치된 앱에서만 바꿀 수 있습니다"}>
          <Segmented label="화면 크기" value={prefs.zoom} options={ZOOMS} onChange={(zoom) => setPrefs({ zoom })} disabled={!app} />
        </Row>
      </Section>
      <Section title="시작 및 종료">
        <Row
          title="컴퓨터를 켜면 Drive 자동 실행"
          desc={error ? <span className="text-destructive">{error}</span> : app ? "창 없이 트레이(메뉴 막대)에서 시작합니다" : "설치된 앱에서만 바꿀 수 있습니다"}
        >
          <Checkbox aria-label="자동 실행" checked={!!autostart} disabled={autostart === null} onCheckedChange={(v) => void toggle(!!v)} />
        </Row>
        <Row title="창을 닫아도 트레이에서 계속 실행" desc={app ? "끄면 창을 닫을 때 Drive가 종료되고 진행 중인 전송도 멈춥니다" : "설치된 앱에서만 바꿀 수 있습니다"}>
          <Checkbox aria-label="창을 닫아도 트레이에서 계속 실행" checked={prefs.closeToTray} disabled={!app} onCheckedChange={(v) => setPrefs({ closeToTray: !!v })} />
        </Row>
      </Section>
      <Section title="다운로드">
        <Row title="다운로드 위치" desc={!app ? "브라우저의 다운로드 설정을 따릅니다" : prefs.downloadDir ? <span className="break-all">{prefs.downloadDir}</span> : "받을 때마다 저장할 위치를 묻습니다"}>
          <span className="flex shrink-0 gap-2">
            {prefs.downloadDir && (
              <button type="button" onClick={() => setPrefs({ downloadDir: null })} className={btnOutline}>
                매번 묻기
              </button>
            )}
            <button type="button" disabled={!app} onClick={() => void pickDownloadDir()} className={btnOutline}>
              폴더 선택
            </button>
          </span>
        </Row>
      </Section>
      <Section title="보기">
        <Row title="이미지 썸네일 표시" desc="아이콘 보기와 세부 정보 창에 적용됩니다. 끄면 파일 아이콘으로 보입니다">
          <Checkbox aria-label="이미지 썸네일 표시" checked={thumbs} onCheckedChange={(v) => setThumbs(!!v)} />
        </Row>
      </Section>
      <Section title="문제 해결">
        <LogRow />
      </Section>
    </>
  );
}

function LogRow() {
  const [error, setError] = useState<string | null>(null);
  const app = isTauri();
  const open = () => openLogDir().then(() => setError(null), (e: unknown) => setError(`열지 못했습니다 (${e instanceof Error ? e.message : String(e)})`));
  return (
    <Row title="로그" desc={error ? <span className="text-destructive">{error}</span> : app ? "문제가 생기면 이 폴더의 파일을 담당자에게 보내 주세요" : "설치된 앱에서만 볼 수 있습니다"}>
      <button type="button" disabled={!app} onClick={() => void open()} className={btnOutline}>
        폴더 열기
      </button>
    </Row>
  );
}
