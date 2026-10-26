import { IconChevronLeft, IconChevronRight, IconFolderPlus, IconLayoutGrid, IconLayoutSidebar, IconList, IconLogout, IconRefresh, IconSearch, IconSettings, IconUpload, IconUser } from "@tabler/icons-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MenuBar, type MenuActions } from "./MenuBar";
import { isMac, isTauri, modKey, showWindowControls } from "./platform";
import { WindowControls } from "./WindowControls";

export interface Crumb {
  label: string;
  path: string;
}

interface Props {
  menu: MenuActions;
  crumbs: Crumb[];
  onNavigate(path: string): void;
  filter: string;
  onFilter(v: string): void;
  accountLabel: string;
  accountSub?: string;
  disabled?: boolean;
}

/**
 * 창 상단 두 줄: [메뉴바 + 드래그 영역 + 창 버튼] / [툴바].
 * VS Code·Windows Files 앱과 같은 구조. 빈 영역은 창 드래그.
 */
export function TitleBar({ menu: m, crumbs, onNavigate, filter, onFilter, accountLabel, accountSub, disabled }: Props) {
  const drag = isTauri() ? { "data-tauri-drag-region": true } : {};
  return (
    <div className="shrink-0 select-none border-b border-border bg-titlebar">
      {/* 1줄: 메뉴바 */}
      <div {...drag} className={cn("flex h-8 items-center", isMac() && isTauri() ? "pl-20" : "pl-1")}>
        <MenuBar {...m} />
        <div {...drag} className="h-full flex-1" />
        {showWindowControls() && <WindowControls />}
      </div>

      {/* 2줄: 툴바 */}
      <div {...drag} className="flex h-9 items-center gap-1 px-1.5 pb-1">
        <IconBtn label="사이드바" onClick={m.toggleSidebar} active={m.sidebarOpen}>
          <IconLayoutSidebar className="size-4" stroke={1.75} />
        </IconBtn>
        <IconBtn label="뒤로" shortcut="Alt+←" onClick={m.back} disabled={!m.canBack}>
          <IconChevronLeft className="size-4" stroke={1.75} />
        </IconBtn>
        <IconBtn label="앞으로" shortcut="Alt+→" onClick={m.forward} disabled={!m.canForward}>
          <IconChevronRight className="size-4" stroke={1.75} />
        </IconBtn>

        <div {...drag} className="mx-1 flex h-7 min-w-0 flex-1 items-center gap-0.5 overflow-hidden rounded-md border border-border bg-background px-1.5 text-sm">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={c.path} className="flex min-w-0 items-center">
                {i > 0 && <IconChevronRight className="mx-0.5 size-3.5 shrink-0 text-muted-foreground" stroke={1.75} />}
                {last ? (
                  <span className="truncate font-medium">{c.label}</span>
                ) : (
                  <button type="button" onClick={() => onNavigate(c.path)} className="truncate rounded px-1 text-foreground/80 hover:bg-accent">
                    {c.label}
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <div className="relative mx-1 w-52 shrink-0">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" stroke={1.75} />
          <Input value={filter} onChange={(e) => onFilter(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onFilter("")} placeholder="이 폴더와 하위 폴더 검색" disabled={disabled} className="h-7 rounded-md pl-7 text-sm md:text-sm" />
        </div>

        <div className="mx-1 flex h-7 shrink-0 items-center rounded-md border border-border bg-background p-0.5">
          <IconBtn label="목록" onClick={() => m.setView("list")} active={m.view === "list"} size="xs">
            <IconList className="size-3.5" stroke={1.75} />
          </IconBtn>
          <IconBtn label="아이콘" onClick={() => m.setView("grid")} active={m.view === "grid"} size="xs">
            <IconLayoutGrid className="size-3.5" stroke={1.75} />
          </IconBtn>
        </div>

        <IconBtn label="새로고침" shortcut="F5" onClick={m.refresh} disabled={disabled}>
          <IconRefresh className="size-4" stroke={1.75} />
        </IconBtn>
        <IconBtn label="새 폴더" shortcut={`${modKey()}+Shift+N`} onClick={m.newFolder} disabled={disabled}>
          <IconFolderPlus className="size-4" stroke={1.75} />
        </IconBtn>
        <Button size="sm" onClick={m.upload} disabled={disabled} className="mx-1 h-7 rounded-md px-2.5">
          <IconUpload className="size-3.5" stroke={2} /> 업로드
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="mr-1 size-7 rounded-md text-muted-foreground" />}>
            <IconUser className="size-4" stroke={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="font-medium">{accountLabel}</div>
                {accountSub && <div className="text-2xs font-normal text-muted-foreground">{accountSub}</div>}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={m.settings}>
              <IconSettings className="size-4" stroke={1.75} /> 설정…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={m.logout}>
              <IconLogout className="size-4" stroke={1.75} /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
