# 메뉴·대화상자·버튼 데스크톱 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** shadcn 기본 모양인 메뉴·대화상자·버튼·툴팁·알림 패널을 두 OS 공통의 데스크톱 프로그램 모양으로 바꾼다.

**Architecture:** 색·그림자는 `src/index.css` 토큰(`:root`·`.dark`·`@theme`)으로 추가하고, 메뉴 3종(context/dropdown/menubar)이 함께 쓸 클래스 문자열을 `src/components/ui/menu-styles.ts` 한 곳에 모은다. 나머지는 `src/components/ui/`의 기존 컴포넌트 클래스만 바꾼다. 소스 검사 테스트 하나(`desktop-style.test.ts`)가 토큰 존재와 "웹식 확대 애니메이션 없음"을 지킨다.

**Tech Stack:** React 19, Tailwind CSS v4, Base UI(`@base-ui/react`) 기반 shadcn 컴포넌트, Vitest(node 환경), Tauri 2.

**Spec:** `docs/superpowers/specs/2026-10-27-desktop-ui-redesign-design.md`

## Global Constraints

- 두 OS에서 같은 모습. OS별 분기는 기존 `mac:` 변형(`mac:tracking-normal`)만 유지하고 새로 만들지 않는다.
- 색·그림자 값은 `src/index.css` 토큰에만 쓴다. `src/features/`에는 원시 값 금지(`npm run lint`).
- 확대(`zoom-in-*`/`zoom-out-*`)·미끄러짐(`slide-in-from-*`) 애니메이션 금지. 페이드만, 열기 ≤80ms·닫기 100ms.
- 대화상자에 아이콘 장식 금지.
- 파일마다 원래 줄바꿈(CRLF/LF) 유지. 수정 후 `grep -c $'\r$' <file>`가 수정 전과 같은 비율이어야 한다(전부 CRLF 또는 0).
- `ghost`·`link`·`secondary` 버튼, `icon*` 크기, 메뉴 막대의 메뉴 이름 버튼, 체크박스, 진행 막대는 바꾸지 않는다.

## Review Focus

- **긴 대화상자(휴지통 항목 많음)** → 본문만 스크롤되고 하단 버튼 띠는 늘 보여야 한다. Task 3 Step 5에서 창 높이를 줄여 확인.
- **아이콘 있는 메뉴 안의 아이콘 없는 항목**(열기, 보기, 정렬 기준, 모두 선택) → 글자 시작선이 아이콘 항목 글자와 맞아야 한다. Task 2 Step 6에서 확인.
- **메뉴 안 위험 항목(삭제)에 마우스 올림** → 빨강 바탕에 흰 글자. 파랑으로 덮이면 안 된다. Task 2 테스트에 포함.
- **비활성 버튼·메뉴 항목**(선택 없을 때 다운로드 등) → 반투명으로 흐려지고 hover 색이 들지 않아야 한다. 기존 `disabled:`/`data-disabled:` 클래스 유지 확인(Task 2·4 Step).
- **반투명 메뉴가 짙은 파란 선택 줄 위에 열릴 때** → 글자가 읽혀야 한다. Task 2 Step 6에서 선택된 줄 위로 메뉴를 열어 확인.

---

### Task 1: 디자인 토큰과 스타일 검사 테스트

**Files:**
- Modify: `src/index.css` (`@theme inline` 블록, `:root` 블록 75행~, `.dark` 블록 124행~) — CRLF 파일
- Create: `src/components/ui/desktop-style.test.ts`

**Interfaces:**
- Produces (Tailwind 클래스로 쓸 수 있게 `@theme`에 매핑):
  - 색: `bg-menu`, `bg-dialog-footer`, `border-dialog-footer-border`, `bg-primary-hover`, `bg-primary-active`, `bg-destructive-hover`, `bg-outline-hover`, `border-primary-edge`, `border-b-primary-edge-bottom`, `border-outline-edge`, `border-b-outline-edge-bottom`, `border-destructive-edge`, `border-b-destructive-edge-bottom`, `bg-menu-separator`
  - 그림자: `shadow-menu`, `shadow-dialog`, `shadow-button`, `shadow-button-subtle`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/components/ui/desktop-style.test.ts`

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../../index.css");
const block = (sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf("\n}", css.indexOf(`${sel} {`)));

const TOKENS = ["--menu", "--menu-separator", "--dialog-footer", "--dialog-footer-border", "--primary-hover", "--primary-active",
  "--destructive-hover", "--outline-hover", "--primary-edge", "--primary-edge-bottom", "--outline-edge", "--outline-edge-bottom",
  "--destructive-edge", "--destructive-edge-bottom"];

describe("desktop design tokens", () => {
  it.each(TOKENS)("%s is defined for light and dark", (t) => {
    expect(block(":root")).toContain(`${t}:`);
    expect(block(".dark")).toContain(`${t}:`);
  });
  it.each(["--shadow-menu", "--shadow-dialog", "--shadow-button", "--shadow-button-subtle"])("%s is a theme shadow", (t) => {
    expect(block("@theme inline")).toContain(`${t}:`);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/components/ui/desktop-style.test.ts` / Expected: 토큰 테스트 18개 FAIL

- [ ] **Step 3: `src/index.css`에 토큰 추가**

`:root` 값(스펙 4.1~4.3): `--menu: rgb(246 246 246 / .72)`, `--menu-separator: rgb(0 0 0 / .1)`, `--dialog-footer: #f5f5f5`, `--dialog-footer-border: #e6e6e6`, `--primary-edge: #0a5bb8`, `--primary-edge-bottom: #074a96`, `--outline-edge: #d6d6d6`, `--outline-edge-bottom: #bdbdbd`, `--destructive-edge: #b52617`, `--destructive-edge-bottom: #921e12`, `--primary-hover: #1c6fcf`, `--primary-active: #0857b3`, `--destructive-hover: #cf3526`, `--outline-hover: #f7f7f7`.
`.dark` 값: `--menu: rgb(40 40 42 / .72)`, `--menu-separator: rgb(255 255 255 / .1)`, 나머지는 `.dark`의 기존 `--card`·`--primary`·`--destructive`에 맞춰 같은 관계(테두리는 바탕보다 진하게, hover는 밝게)로 정한다.
`@theme inline`: 위 색마다 `--color-<이름>: var(--<이름>)`, 그리고
`--shadow-menu: 0 0 0 .5px rgb(0 0 0 / .18), inset 0 0 0 .5px rgb(255 255 255 / .7), 0 12px 32px rgb(0 0 0 / .18), 0 2px 8px rgb(0 0 0 / .08)`,
`--shadow-dialog: 0 0 0 .5px rgb(0 0 0 / .2), 0 24px 60px rgb(0 0 0 / .25), 0 4px 12px rgb(0 0 0 / .08)`,
`--shadow-button: 0 1px 1px rgb(0 0 0 / .1)`, `--shadow-button-subtle: 0 1px 1px rgb(0 0 0 / .05)`.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/components/ui/desktop-style.test.ts` / Expected: PASS. `grep -c $'\r$' src/index.css`가 `wc -l`과 같음.

- [ ] **Step 5: 커밋**

```bash
git add src/index.css src/components/ui/desktop-style.test.ts
git commit -m "feat(ui): 데스크톱 리디자인 토큰 추가"
```

---

### Task 2: 메뉴 3종을 유리 스타일로

**Files:**
- Create: `src/components/ui/menu-styles.ts` (LF)
- Modify: `src/components/ui/context-menu.tsx` (CRLF), `src/components/ui/dropdown-menu.tsx` (LF), `src/components/ui/menubar.tsx` (LF)
- Modify: `src/features/browse/ContextMenu.tsx`(열기), `src/features/browse/BackgroundContextMenu.tsx`(보기·정렬 기준·모두 선택) — 아이콘 없는 항목에 `inset`
- Test: `src/components/ui/desktop-style.test.ts`

**Interfaces:**
- Consumes: Task 1 토큰 클래스 (`bg-menu`, `shadow-menu`, `bg-menu-separator`)
- Produces: `menu-styles.ts`에서 `export const menuPopup: string`, `menuItem: string`, `menuCheckItem: string`, `menuSubTrigger: string`, `menuSeparator: string`, `menuShortcut: string`, `menuLabel: string`. 세 메뉴 파일이 이것만 쓰고 자기 클래스 문자열을 따로 두지 않는다(`className` 덮어쓰기용 `cn(..., className)`은 유지).

- [ ] **Step 1: 실패하는 테스트 추가** — `desktop-style.test.ts`에 덧붙임

```ts
const MENU_FILES = ["./context-menu.tsx", "./dropdown-menu.tsx", "./menubar.tsx"];
const ANIMATED = ["./context-menu.tsx", "./dropdown-menu.tsx", "./menubar.tsx", "./dialog.tsx", "./tooltip.tsx"];

describe("menus", () => {
  const styles = read("./menu-styles.ts");
  it.each(MENU_FILES)("%s uses shared menu styles", (f) => expect(read(f)).toContain('from "./menu-styles"'));
  it("popup is translucent glass", () => {
    expect(styles).toMatch(/menuPopup = "[^"]*bg-menu/);
    expect(styles).toMatch(/menuPopup = "[^"]*backdrop-blur/);
    expect(styles).toMatch(/menuPopup = "[^"]*shadow-menu/);
  });
  it("highlight is primary, destructive highlight is destructive", () => {
    expect(styles).toMatch(/menuItem = "[^"]*data-highlighted:bg-primary/);
    expect(styles).toMatch(/menuItem = "[^"]*data-\[variant=destructive\]:data-highlighted:bg-destructive/);
  });
});

describe("no web-style motion", () => {
  it.each(ANIMATED)("%s has no zoom or slide animation", (f) => {
    expect(read(f)).not.toMatch(/zoom-(in|out)-|slide-in-from-/);
  });
});
```

(`dialog.tsx`·`tooltip.tsx`의 애니메이션 테스트는 Task 3·5가 끝나야 통과한다. 이 Task에서는 메뉴 3개 파일만 통과하면 된다.)

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/components/ui/desktop-style.test.ts -t "menus|context-menu|dropdown-menu|menubar"` / Expected: FAIL

- [ ] **Step 3: `menu-styles.ts` 작성** — 스펙 4.1 표 값 그대로:
  - `menuPopup`: `bg-menu backdrop-blur-[24px] backdrop-saturate-[1.8] rounded-[10px] p-[5px] shadow-menu text-popover-foreground` + 기존 위치·크기 클래스(`z-50 max-h-(--available-height) min-w-36 overflow-x-hidden overflow-y-auto outline-none origin-(--transform-origin)`) + `data-open:animate-in data-open:fade-in-0 data-open:duration-75 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-100`
  - `menuItem`: `h-6 pl-2 pr-2.5 rounded-[5px] gap-2 text-sm` + 강조 `data-highlighted:bg-primary data-highlighted:text-primary-foreground data-highlighted:**:text-primary-foreground/85` + 위험 `data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive data-[variant=destructive]:data-highlighted:text-white` + `data-inset:pl-8` + 기존 `data-disabled:pointer-events-none data-disabled:opacity-50`, svg 크기 규칙
  - `menuCheckItem`: `menuItem`과 같은 높이·강조에 `pr-8`(체크는 오른쪽 `right-2`, 이미 그렇게 되어 있음)
  - `menuSeparator`: `h-px bg-menu-separator my-[5px] mx-2.5`
  - `menuShortcut`: `ml-auto text-xs tracking-widest mac:tracking-normal text-muted-foreground` (강조 시 흰색은 `menuItem`의 `**:` 규칙이 처리)
  - `menuSubTrigger`: `menuItem`과 같고 `data-popup-open:bg-primary data-popup-open:text-primary-foreground`
  - 강조 속성은 Base UI의 `data-highlighted`, 하위 메뉴 열림은 `data-popup-open`(확인함). 지금 코드의 `focus:` 강조 규칙은 지운다.

- [ ] **Step 4: 세 메뉴 파일이 `menu-styles`를 쓰게 교체** — `*Content`/`*SubContent` → `menuPopup`, `*Item` → `menuItem`, `*CheckboxItem`/`*RadioItem` → `menuCheckItem`, `*SubTrigger` → `menuSubTrigger`, `*Separator` → `menuSeparator`, `*Shortcut` → `menuShortcut`, `*Label` → `menuLabel`(`px-2 py-1 text-xs text-muted-foreground`). `ring-1`·`shadow-md`·`zoom-*`·`slide-in-from-*` 제거. 메뉴 막대는 `DropdownMenu*`를 감싸므로 거기서 덧붙이던 클래스 중 색·여백 관련은 지우고 구조 관련만 남긴다.

- [ ] **Step 5: 아이콘 칸 맞추기** — `ContextMenu.tsx`의 "열기", `BackgroundContextMenu.tsx`의 "보기"·"정렬 기준"(SubTrigger)·"모두 선택"에 `inset` 추가.

- [ ] **Step 6: 확인** — Run: `npx vitest run src/components/ui/desktop-style.test.ts -t "menus|context-menu|dropdown-menu|menubar"`, `npx tsc --noEmit`, `npm run lint` / Expected: PASS. `tauri dev`에서: 빈 곳 우클릭, 파일 우클릭(선택된 파란 줄 위에서도), 상단 메뉴 보기→정렬 기준 하위 메뉴, 삭제 항목 강조가 빨강인지, 비활성 항목에 강조가 안 드는지, 아이콘 없는 항목 글자가 아이콘 항목 글자와 같은 선인지.

- [ ] **Step 7: 커밋**

```bash
git add src/components/ui/menu-styles.ts src/components/ui/context-menu.tsx src/components/ui/dropdown-menu.tsx src/components/ui/menubar.tsx src/components/ui/desktop-style.test.ts src/features/browse/ContextMenu.tsx src/features/browse/BackgroundContextMenu.tsx
git commit -m "feat(ui): 메뉴를 반투명 데스크톱 스타일로"
```

---

### Task 3: 대화상자 (경고창 + 하단 띠)

**Files:**
- Modify: `src/components/ui/dialog.tsx` (LF)
- Modify: `src/features/shell/MenuBar.tsx` — 하단 띠 없는 두 대화상자(키보드 단축키, Drive 정보)에 `showCloseButton`
- Modify: `src/features/preview/PreviewModal.tsx` — 필요하면 `rounded`만 맞춤(구조 변경 없음)
- Test: `src/components/ui/desktop-style.test.ts`

**Interfaces:**
- Consumes: Task 1 `bg-dialog-footer`, `border-dialog-footer-border`, `shadow-dialog`
- Produces: `DialogContent`의 `showCloseButton` 기본값이 `false`로 바뀐다(✕가 필요한 곳은 명시적으로 `showCloseButton`).

- [ ] **Step 1: 실패하는 테스트 추가**

```ts
describe("dialog", () => {
  const d = read("./dialog.tsx");
  it("close button is opt-in", () => expect(d).toMatch(/showCloseButton = false/));
  it("box uses dialog shadow, no ring", () => {
    expect(d).toContain("shadow-dialog");
    expect(d).not.toMatch(/data-slot="dialog-content"[\s\S]*?ring-1/);
  });
  it("footer is a tight gray band, always a row", () => {
    expect(d).toMatch(/dialog-footer[\s\S]*bg-dialog-footer/);
    expect(d).not.toContain("flex-col-reverse");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/components/ui/desktop-style.test.ts -t "dialog"` / Expected: FAIL

- [ ] **Step 3: `dialog.tsx` 수정** — 스펙 4.2 값:
  - Overlay: `bg-black/18`, `backdrop-blur` 제거, 페이드만
  - Content: `rounded-xl bg-card shadow-dialog`, `ring-1` 제거, `gap-4 px-4.5 pt-4.5 pb-4.5 has-data-[slot=dialog-footer]:pb-0`, `max-h-[85vh] overflow-y-auto`, 확대 애니메이션 제거(페이드 `duration-100`), `showCloseButton = false`
  - Header: `gap-1.5` / Title: `text-base font-semibold leading-snug` / Description: `text-sm leading-[1.45] text-muted-foreground`
  - Footer: `sticky bottom-0 -mx-4.5 flex flex-row justify-end gap-1.5 border-t border-dialog-footer-border bg-dialog-footer px-2.5 py-1.75`, `rounded-b-xl` 유지, `flex-col-reverse`·`sm:` 분기 제거

- [ ] **Step 4: ✕ 버튼 지정** — `MenuBar.tsx`의 두 `<DialogContent>`(키보드 단축키 194행, Drive 정보 226행)에 `showCloseButton` 추가. `PreviewModal`은 이미 `showCloseButton={false}`.

- [ ] **Step 5: 확인** — Run: 테스트 `-t "dialog"`, `npx tsc --noEmit`, `npm run lint` / Expected: PASS. `tauri dev`에서 8개 대화상자를 열어 본다: 삭제 확인(파일 우클릭→삭제), 덮어쓰기(같은 이름 파일 업로드), 공유 링크, 링크 삭제 확인(공유 링크 페이지), 설정, 휴지통, 키보드 단축키·Drive 정보(상단 메뉴). 휴지통은 창 높이를 줄였을 때 본문만 스크롤되고 하단 띠가 보이는지. Esc로 닫히는지.

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/dialog.tsx src/components/ui/desktop-style.test.ts src/features/shell/MenuBar.tsx src/features/preview/PreviewModal.tsx
git commit -m "feat(ui): 대화상자를 경고창 + 하단 띠 스타일로"
```

---

### Task 4: 버튼과 입력칸

**Files:**
- Modify: `src/components/ui/button.tsx` (LF), `src/components/ui/input.tsx`
- Test: `src/components/ui/desktop-style.test.ts`

**Interfaces:**
- Consumes: Task 1 `*-edge`, `*-edge-bottom`, `*-hover`, `primary-active`, `shadow-button`, `shadow-button-subtle`
- Produces: `buttonVariants`의 이름·변형·크기 목록은 그대로(기능 코드 수정 없음).

- [ ] **Step 1: 실패하는 테스트 추가**

```ts
describe("button", () => {
  const b = read("./button.tsx");
  it("no web press nudge", () => expect(b).not.toContain("translate-y-px"));
  it("default/outline/destructive have edge borders", () => {
    expect(b).toMatch(/default: "[^"]*border-primary-edge[^"]*border-b-primary-edge-bottom/);
    expect(b).toMatch(/outline:\s*"[^"]*border-outline-edge[^"]*border-b-outline-edge-bottom/);
    expect(b).toMatch(/destructive:\s*"[^"]*bg-destructive [^"]*text-white/);
  });
  it("default size is 26px", () => expect(b).toMatch(/default:\s*"h-6\.5/));
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/components/ui/desktop-style.test.ts -t "button"` / Expected: FAIL

- [ ] **Step 3: `button.tsx` 수정** — 스펙 4.3 표:
  - 공통: `rounded-md font-normal`, `focus-visible:ring-2 focus-visible:ring-primary/40`, `active:not-aria-[haspopup]:translate-y-px` 제거, `transition-all` → `transition-colors`
  - `default`: `border-primary-edge border-b-primary-edge-bottom bg-primary text-primary-foreground shadow-button hover:bg-primary-hover active:bg-primary-active`
  - `outline`: `border-outline-edge border-b-outline-edge-bottom bg-card text-foreground shadow-button-subtle hover:bg-outline-hover`
  - `destructive`: `border-destructive-edge border-b-destructive-edge-bottom bg-destructive text-white shadow-button hover:bg-destructive-hover`
  - 크기: `default` `h-6.5 px-3`, `sm` `h-6 px-2.5 text-xs`, `lg` `h-7 px-3.5`. `xs`·`icon*` 유지.
  - 비활성: 기존 `disabled:pointer-events-none disabled:opacity-50` 유지.

- [ ] **Step 4: `input.tsx` 수정** — `h-6.5 rounded-md border-input bg-card px-2`, `focus-visible:ring-2 focus-visible:ring-primary/40`(aria-invalid 링도 2px). 나머지 유지.

- [ ] **Step 5: 확인** — 테스트 `-t "button"`, `npx tsc --noEmit`, `npm run lint`, 브라우저 창에서 로그인 화면(로그인 버튼·입력칸 — 클래스로 크기를 직접 준 곳은 유지되는지), `tauri dev`에서 선택 막대 버튼, 대화상자 버튼(취소·확인·삭제), 비활성 버튼.

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/desktop-style.test.ts
git commit -m "feat(ui): 버튼·입력칸을 데스크톱 스타일로"
```

---

### Task 5: 툴팁·알림 패널, 마무리

**Files:**
- Modify: `src/components/ui/tooltip.tsx`, `src/features/shell/UpdateNotice.tsx`, `src/features/transfer/TransferPanel.tsx`
- Modify: `docs/DESIGN.md` — "떠오르는 요소" 절 추가
- Test: `src/components/ui/desktop-style.test.ts`

**Interfaces:**
- Consumes: Task 1 `shadow-dialog`

- [ ] **Step 1: 실패 확인** — Run: `npx vitest run src/components/ui/desktop-style.test.ts` / Expected: `tooltip.tsx has no zoom or slide animation` FAIL (나머지 PASS)

- [ ] **Step 2: `tooltip.tsx`** — `TooltipPrimitive.Arrow` 제거, `rounded-[5px] px-2 py-1`, `zoom-*`·`slide-in-from-*` 제거하고 페이드만(`duration-75`).

- [ ] **Step 3: 알림 패널** — `UpdateNotice.tsx`·`TransferPanel.tsx`의 바깥 상자: `shadow-float` → `shadow-dialog`, `border border-border` 제거(그림자에 외곽선 포함), `slide-in-from-bottom-3 duration-200` → `fade-in-0 duration-100`. `TransferPanel`의 펼침 목록 `slide-in-from-top-1`도 페이드로.

- [ ] **Step 4: `docs/DESIGN.md`에 절 추가** — 메뉴는 `menu-styles.ts`, 대화상자는 경고창 + 하단 띠·아이콘 없음, 버튼 3변형 규칙, "확대·미끄러짐 애니메이션 금지"를 4~6줄로.

- [ ] **Step 5: 전체 확인** — Run: `npm test`, `npx tsc --noEmit`, `npm run lint` / Expected: 전부 PASS. `tauri dev`에서 툴팁(타이틀바 버튼에 마우스), 업로드 진행 패널, 업데이트 알림(가능하면). 수정한 모든 파일의 줄바꿈이 원래와 같은지 `git diff --stat`이 실제 변경 줄 수만 보이는지.

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/tooltip.tsx src/features/shell/UpdateNotice.tsx src/features/transfer/TransferPanel.tsx docs/DESIGN.md src/components/ui/desktop-style.test.ts
git commit -m "feat(ui): 툴팁·알림 패널 정리, 디자인 규칙 문서화"
```
