import { ChevronLeft, ChevronRight, FolderPlus, LayoutGrid, List, LogOut, PanelLeft, RefreshCw, Search, Upload, User } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ViewMode } from "@/features/browse/FileList";
import { isMac, isTauri, modKey, showWindowControls } from "./platform";
import { WindowControls } from "./WindowControls";

export interface Crumb {
  label: string;
  path: string;
}

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar(): void;
  canBack: boolean;
  canForward: boolean;
  onBack(): void;
  onForward(): void;
  crumbs: Crumb[];
  onNavigate(path: string): void;
  filter: string;
  onFilter(v: string): void;
  view: ViewMode;
  onView(v: ViewMode): void;
  onRefresh(): void;
  onNewFolder(): void;
  onUpload(): void;
  accountLabel: string;
  accountSub?: string;
  onLogout(): void;
  disabled?: boolean;
}

/** 통합 툴바(제목 표시줄 겸용). 36px. 빈 영역은 창 드래그. */
export function TitleBar(p: Props) {
  const drag = isTauri() ? { "data-tauri-drag-region": true } : {};
  return (
    <div {...drag} className={cn("flex h-9 shrink-0 select-none items-center gap-1 border-b border-border bg-titlebar pr-0", isMac() && isTauri() ? "pl-20" : "pl-1.5")}>
      <IconBtn label="사이드바" onClick={p.onToggleSidebar} active={p.sidebarOpen}>
        <PanelLeft className="size-4" />
      </IconBtn>
      <IconBtn label="뒤로" shortcut="Alt+←" onClick={p.onBack} disabled={!p.canBack}>
        <ChevronLeft className="size-4" />
      </IconBtn>
      <IconBtn label="앞으로" shortcut="Alt+→" onClick={p.onForward} disabled={!p.canForward}>
        <ChevronRight className="size-4" />
      </IconBtn>

      {/* 경로 표시줄 */}
      <div {...drag} className="mx-1 flex h-7 min-w-0 flex-1 items-center gap-0.5 overflow-hidden rounded-md border border-border bg-background px-1.5 text-ui">
        {p.crumbs.map((c, i) => {
          const last = i === p.crumbs.length - 1;
          return (
            <span key={c.path} className="flex min-w-0 items-center">
              {i > 0 && <ChevronRight className="mx-0.5 size-3.5 shrink-0 text-muted-foreground" />}
              {last ? (
                <span className="truncate font-medium">{c.label}</span>
              ) : (
                <button type="button" onClick={() => p.onNavigate(c.path)} className="truncate rounded px-1 text-foreground/80 hover:bg-accent">
                  {c.label}
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div className="relative mx-1 w-44 shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={p.filter} onChange={(e) => p.onFilter(e.target.value)} placeholder="현재 폴더 검색" disabled={p.disabled} className="h-7 rounded-md pl-7 text-ui md:text-ui" />
      </div>

      <div className="mx-1 flex h-7 shrink-0 items-center rounded-md border border-border bg-background p-0.5">
        <IconBtn label="목록" onClick={() => p.onView("list")} active={p.view === "list"} size="xs">
          <List className="size-3.5" />
        </IconBtn>
        <IconBtn label="아이콘" onClick={() => p.onView("grid")} active={p.view === "grid"} size="xs">
          <LayoutGrid className="size-3.5" />
        </IconBtn>
      </div>

      <IconBtn label="새로고침" shortcut="F5" onClick={p.onRefresh} disabled={p.disabled}>
        <RefreshCw className="size-4" />
      </IconBtn>
      <IconBtn label="새 폴더" shortcut={`${modKey()}+Shift+N`} onClick={p.onNewFolder} disabled={p.disabled}>
        <FolderPlus className="size-4" />
      </IconBtn>
      <Button size="sm" onClick={p.onUpload} disabled={p.disabled} className="mx-1 h-7 rounded-md px-2.5 text-ui">
        <Upload className="size-3.5" /> 업로드
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="mr-1 size-7 rounded-md text-muted-foreground" />}>
          <User className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="text-ui">
            <div className="font-medium">{p.accountLabel}</div>
            {p.accountSub && <div className="text-ui-xs font-normal text-muted-foreground">{p.accountSub}</div>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={p.onLogout} className="text-ui">
            <LogOut className="size-4" /> 로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showWindowControls() && <WindowControls />}
    </div>
  );
}

function IconBtn({ label, shortcut, onClick, disabled, active, size = "sm", children }: { label: string; shortcut?: string; onClick(): void; disabled?: boolean; active?: boolean; size?: "sm" | "xs"; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size={size === "xs" ? "icon-xs" : "icon-sm"}
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn("rounded-md text-foreground/80", size === "xs" ? "size-6" : "size-7", active && "bg-accent text-foreground")}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="text-ui-xs">
        {label}
        {shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
