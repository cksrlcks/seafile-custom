# seadrive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영 중인 Seafile 서버를 내 UI로 쓰는 Windows 데스크톱 파일 탐색기. 드래그앤드롭(폴더 포함) 청크 업로드가 핵심.

**Architecture:** React 앱은 `StorageProvider` 인터페이스만 보고, `Connection { kind, baseUrl }`에서 `createProvider()`로 구현체를 만든다. Seafile 구현체는 `src/storage/seafile/`에만 존재한다. 단일 창, 라우터 없음, 위치는 `{ libId, path }` 상태 하나. 업로드는 `uploadQueue`(동시 3, 자동 재시도 2)가 Provider의 `upload()`를 부르고, 청크/이어올리기는 Provider 안에서 처리한다.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, react-dropzone, TanStack Query v5, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-seadrive-ui-design.md`

## Global Constraints

- `seafile`라는 문자열은 `src/storage/seafile/` 안과 로그인 화면의 기본 URL(`https://seafile.heavybear-lab.net`)에만 나온다.
- UI 코드는 `Connection.kind`를 분기하지 않는다. 분기는 `createProvider` 한 곳.
- `src-tauri/tauri.conf.json`: `app.windows[0].dragDropEnabled: false`. CSP는 기본값(`null`) 유지.
- 서버 인증은 `Authorization: Token <token>` 헤더만. 쿠키 없음.
- 업로드: 청크 8MB(`CHUNK_SIZE = 8 * 1024 * 1024`), 동시 3개, 자동 재시도 2회, 서버 호출은 항상 `replace=1`.
- 미리보기 텍스트 상한 1MB. 미리보기 타입: 이미지 / 텍스트·md·코드 / PDF.
- UI 문구는 한국어.
- 디자인 시스템(설계 4.3.1): 색·반경은 `src/index.css`의 shadcn 토큰만. `src/features/` 안에서 `#hex`, `bg-[`/`text-[` 임의값, `-gray-`/`-slate-`/`-zinc-`/`-blue-` 등 팔레트 직접 참조 금지. 기본 요소(`button`, `input`, 모달, 메뉴)는 `src/components/ui/`에서만 가져온다. 스케일: 행 `h-8`, 패널 `p-4`, 간격 `gap-2`, 본문 `text-sm`, 보조 `text-xs`, 반경 `rounded-md`.
- 빈 폴더는 업로드하지 않는다(파일이 있는 경로만 `relative_path`로 올라감). 설계가 비워 둔 부분이라 이 계획의 결정.
- 테스트는 Vitest, `node` 환경. UI 컴포넌트는 테스트하지 않고 순수 로직만 테스트한다.
- Rust 코드 추가 없음. `src-tauri/`는 템플릿 기본값.

## Review Focus

1. 파일·폴더 이름에 `#`, `%`, `&`, 공백, 한글이 들어가도 탐색·업로드·삭제가 된다 → Task 2 `encodes path in query` 테스트.
2. 토큰이 만료된 채로(401) 아무 요청이나 보내면 로그인 화면으로 돌아가고, 저장된 토큰이 지워진다 → Task 2 `maps 401 to unauthorized` + Task 3 `clears session on unauthorized` 테스트.
3. 0바이트 파일과 청크 크기 이하 파일은 `Content-Range` 없이 한 번의 POST로 올라간다 → Task 7 `chunkRanges` 테스트.
4. 이어올리기 시 서버가 이미 전체를 받았으면(uploadedBytes ≥ size) 다시 보내지 않고 완료 처리 → Task 7 `resumes from uploadedBytes` 테스트.
5. 빈 폴더를 드롭하면 아무것도 업로드되지 않고 에러도 없다 → Task 5 Step 4 수동 확인(react-dropzone이 파일만 넘기므로 코드 없음).

---

### Task 0: 스캐폴드 + 서버 CORS

**Files:**
- Create: 프로젝트 루트 전체 (`create-tauri-app` 출력), `vite.config.ts`, `src/index.css`, `vitest.config.ts`, `docs/nginx-cors.conf`
- Modify: `src-tauri/tauri.conf.json`, `package.json`

**Interfaces:**
- Produces: `npm run tauri dev`, `npm test`(vitest), Tailwind 활성, 서버가 Tauri origin에 CORS 허용.

- [ ] **Step 1: 프로젝트 생성**

```bash
cd /d/seadrive && git init && npm create tauri-app@latest . -- --template react-ts --manager npm --yes
```
Expected: `src/`, `src-tauri/`, `package.json` 생성. (현재 폴더에 `docs/`만 있어 비어 있는 것으로 취급되지 않으면 임시 폴더에 만들고 내용을 옮긴다.)

- [ ] **Step 2: 의존성 설치**

```bash
npm i @tanstack/react-query lucide-react react-dropzone tailwindcss @tailwindcss/vite && npm i -D vitest
```

- [ ] **Step 3: Tailwind + Vitest 설정**

`vite.config.ts`의 `plugins`에 `tailwindcss()` 추가, `resolve.alias` `@` → `./src`(shadcn이 요구). `tsconfig.json`에 `baseUrl: "."`, `paths: { "@/*": ["./src/*"] }`. `src/index.css` 첫 줄 `@import "tailwindcss";`. `vitest.config.ts`: `test: { environment: 'node', include: ['src/**/*.test.ts'] }`. `package.json` scripts에 `"test": "vitest run"`.

- [ ] **Step 3-1: shadcn/ui 초기화 + 컴포넌트 7개**

```bash
npx shadcn@latest init -d && npx shadcn@latest add button input dialog context-menu dropdown-menu progress tooltip
```
Expected: `src/components/ui/` 7개 파일, `src/lib/utils.ts`(`cn`), `src/index.css`에 `:root`/`.dark` 토큰 블록과 `@theme inline` 매핑. 기본 색은 shadcn `neutral` 유지(나중에 토큰 값만 바꾸면 전체 테마가 바뀐다).

- [ ] **Step 3-2: `docs/DESIGN.md` 작성**

설계 4.3.1의 규칙 6개를 그대로 옮기고, 토큰 목록과 "새 컴포넌트가 필요할 때: `npx shadcn add <name>` 먼저, 없으면 `components/ui/`에 토큰만 써서 작성"을 적는다. 20줄 이내.

- [ ] **Step 4: 드롭 설정**

`src-tauri/tauri.conf.json`의 `app.windows[0]`에 `"dragDropEnabled": false` 추가. `title`을 `"seadrive"`, 창 크기 `1100x720`.

- [ ] **Step 5: nginx CORS 설정 파일 작성**

`docs/nginx-cors.conf`에 설계 4.5의 `map` 블록과 `add_header` 블록을 그대로 적고, 맨 위 주석에 "`http {}`에 map, `/`와 `/seafhttp` location 양쪽에 add_header 블록 + `client_max_body_size 64m;` + `proxy_read_timeout 300s;`"를 적는다. **이 파일은 사용자가 라즈베리파이 nginx에 직접 적용한다.** 적용 전까지 Task 2 이후의 실서버 검증은 보류하고 모킹 테스트로만 진행한다.

- [ ] **Step 6: 검증**

```bash
npm test && npm run tauri dev
```
Expected: vitest "No test files found" 종료 코드 0(또는 빈 통과), Tauri 창 표시. 사용자가 nginx 적용 후: 웹뷰 콘솔에서 `fetch('https://seafile.heavybear-lab.net/api2/ping/').then(r=>r.text())` → `"pong"`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold tauri+react+vite with tailwind, shadcn, query, dropzone, vitest"
```

---

### Task 1: StorageProvider 인터페이스, Connection, 경로 유틸

**Files:**
- Create: `src/storage/StorageProvider.ts`, `src/storage/createProvider.ts`, `src/storage/path.ts`
- Test: `src/storage/path.test.ts`

**Interfaces:**
- Produces:
  - `StorageProvider`, `Library`, `Entry`, `UploadTask`, `ShareLink` — 설계 4.1 코드 그대로. 단 `rename`은 폴더/파일 엔드포인트가 달라 `rename(libId, path, newName, type: 'file' | 'dir')`로 처음부터 정의한다.
  - `StorageError extends Error { kind: 'unauthorized' | 'notFound' | 'network' | 'server'; status?: number }`
  - `Connection = { kind: 'seafile'; baseUrl: string }`, `createProvider(conn: Connection, token?: string | null): StorageProvider` (Task 2에서 구현체 연결 전까지 `throw new Error('not implemented')`).
  - `joinPath(dir: string, name: string): string` — `('/', 'a') → '/a'`, `('/a', 'b') → '/a/b'`, `('/a/', 'b') → '/a/b'`
  - `parentPath(p: string): string` — `'/a/b' → '/a'`, `'/a' → '/'`, `'/' → '/'`
  - `baseName(p: string): string` — `'/a/b.txt' → 'b.txt'`, `'/' → ''`
  - `splitPath(p: string): string[]` — `'/a/b' → ['a','b']`, `'/' → []` (브레드크럼용)

- [ ] **Step 1: 테스트 작성** `src/storage/path.test.ts` — 위 네 함수의 예시 값을 각각 `expect(...).toBe(...)`로.

- [ ] **Step 2: 실패 확인** `npm test` → "Cannot find module './path'".

- [ ] **Step 3: 구현** `path.ts` 네 함수, `StorageProvider.ts` 타입/인터페이스/`StorageError`, `createProvider.ts` 스텁.

- [ ] **Step 4: 통과 확인** `npm test` → PASS.

- [ ] **Step 5: Commit** `git commit -m "feat: storage provider interface and path utils"`

---

### Task 2: Seafile 저수준 API 래퍼 + login/listLibraries/listDir

**Files:**
- Create: `src/storage/seafile/api.ts`, `src/storage/seafile/SeafileProvider.ts`
- Modify: `src/storage/createProvider.ts`
- Test: `src/storage/seafile/api.test.ts`, `src/storage/seafile/SeafileProvider.test.ts`

**Interfaces:**
- Consumes: Task 1 타입.
- Produces:
  - `class SeafileApi { constructor(baseUrl: string, getToken: () => string | null); get<T>(path: string, query?: Record<string,string>): Promise<T>; postForm<T>(path: string, form: Record<string,string>, query?: Record<string,string>): Promise<T>; delete(path: string, query?: Record<string,string>): Promise<void>; }`
    - `path`는 `/api2/...` 형태. `query` 값은 `URLSearchParams`로 인코딩(그래서 `p=/a b#c`가 안전).
    - 응답 `401` → `StorageError('unauthorized')`, `404` → `notFound`, 그 외 4xx/5xx → `server`(status 포함), fetch 자체 실패 → `network`.
  - `class SeafileProvider implements StorageProvider { constructor(baseUrl: string, initialToken: string | null) }` — 토큰은 인스턴스 필드. `login`은 `POST /api2/auth-token/`(form `username`,`password`; `otp` 있으면 헤더 `X-SEAFILE-OTP`) → `{ token }` 저장. `logout`은 토큰 null. `isLoggedIn`은 토큰 유무. `token` getter 공개(Task 3이 localStorage에 저장).
  - `listLibraries` ← `GET /api2/repos/`를 `Library`로 매핑(`id,name,size,mtime,encrypted`). `listDir(libId, path)` ← `GET /api2/repos/{id}/dir/?p=` 를 `Entry`로 매핑, `path = joinPath(path, name)`, 폴더 먼저·이름순 정렬.
  - `createProvider`: `kind === 'seafile'` → `new SeafileProvider(baseUrl, token ?? null)`.

- [ ] **Step 1: api 테스트** `api.test.ts` — `vi.stubGlobal('fetch', vi.fn())`로:
  - `encodes path in query`: `get('/api2/repos/x/dir/', { p: '/a b#c&d' })` 호출 후 fetch URL이 `/api2/repos/x/dir/?p=%2Fa+b%23c%26d` 포함.
  - `sends token header`: 헤더 `Authorization: Token abc`.
  - `maps 401 to unauthorized`: `new Response('', {status: 401})` → `StorageError.kind === 'unauthorized'`.
  - `maps fetch failure to network`: fetch reject → `kind === 'network'`.

- [ ] **Step 2: provider 테스트** `SeafileProvider.test.ts` —
  - `login stores token`: `/api2/auth-token/` 응답 `{token:'t1'}` → `isLoggedIn() === true`, `token === 't1'`.
  - `listDir maps and sorts entries`: 응답 `[{name:'b.txt',type:'file',size:1,mtime:1,id:'1'},{name:'a',type:'dir',size:0,mtime:1,id:'2'}]`, `listDir('r','/x')` → `[{name:'a',type:'dir',path:'/x/a',…},{name:'b.txt',path:'/x/b.txt',…}]`.

- [ ] **Step 3: 실패 확인** `npm test` → 모듈 없음 실패.

- [ ] **Step 4: 구현** 위 시그니처대로. 실서버 필드명은 구현 중 `curl -H "Authorization: Token …" https://seafile.heavybear-lab.net/api2/repos/`로 한 번 확인한다(토큰은 `curl -d username=… -d password=… …/api2/auth-token/`로 발급; 값은 채팅에 적지 않는다).

- [ ] **Step 5: 통과 확인** `npm test` → PASS.

- [ ] **Step 6: Commit** `git commit -m "feat: seafile provider — auth, libraries, dir listing"`

---

### Task 3: 세션 저장, StorageContext, 로그인 화면, App 셸

**Files:**
- Create: `src/storage/session.ts`, `src/storage/StorageContext.tsx`, `src/features/auth/LoginScreen.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `src/storage/session.test.ts`

**Interfaces:**
- Consumes: `createProvider`, `SeafileProvider.token`, `StorageError`.
- Produces:
  - `session.ts`: `type Session = { connection: Connection; token: string | null }`; `loadSession(storage: Storage = localStorage): Session` (없으면 `{ connection: { kind:'seafile', baseUrl:'https://seafile.heavybear-lab.net' }, token: null }`); `saveSession(s: Session, storage?)`; `clearToken(storage?)` — 연결은 남기고 토큰만 null. 키 `seadrive.session`.
  - `StorageContext.tsx`: `<StorageProvider>` 컴포넌트가 아니라 이름 충돌을 피해 `<StorageRoot>`: 세션을 state로 들고 `createProvider`로 provider 생성, `useStorage(): StorageProvider`, `useSession(): { session, login(conn, user, pw, otp?), logout(), onUnauthorized() }`. `onUnauthorized`는 `clearToken` + state 갱신(→ 로그인 화면).
  - `LoginScreen`: 서버 URL(기본값 세션의 baseUrl), 아이디, 비밀번호. OTP 입력칸은 `otpRequired` state가 true일 때만 렌더. 로그인 실패 시 `StorageError`면 kind별 문구(`unauthorized` → "아이디 또는 비밀번호가 틀렸습니다", `network` → "서버에 연결할 수 없습니다. 서버 주소와 CORS 설정을 확인하세요", `server` 응답 헤더 `X-Seafile-OTP: required` 또는 status 400 + 본문에 `otp` 포함 → `otpRequired = true`).
  - `App.tsx`: `QueryClientProvider` > `StorageRoot` > (`session.token ? <MainScreen/> : <LoginScreen/>`). `MainScreen`은 Task 4에서 만들고 지금은 "로그인됨 + 로그아웃 버튼" 플레이스홀더.

- [ ] **Step 1: 테스트** `session.test.ts` — 메모리 `Storage` 모의 객체(`Map` 기반)로: `loadSession returns default when empty`, `saveSession then loadSession round-trips`, `clearToken keeps connection` (`clears session on unauthorized`의 로직 부분).

- [ ] **Step 2: 실패 확인** `npm test`.

- [ ] **Step 3: 구현** session.ts, StorageContext.tsx, LoginScreen.tsx, App.tsx. TanStack Query의 전역 `QueryCache.onError`에서 `StorageError.kind === 'unauthorized'`면 `onUnauthorized()` 호출.

- [ ] **Step 4: 통과 확인** `npm test` → PASS. `npm run tauri dev`로 실제 로그인 → 플레이스홀더 표시, 앱 재시작 시 로그인 유지, 로그아웃 후 URL이 남아 있음.

- [ ] **Step 5: Commit** `git commit -m "feat: session persistence, storage context, login screen"`

---

### Task 4: 탐색 화면 — 사이드바, 브레드크럼, 파일 테이블

**Files:**
- Create: `src/features/browse/MainScreen.tsx`, `Sidebar.tsx`, `Breadcrumb.tsx`, `FileTable.tsx`, `useCurrentDir.ts`, `src/lib/format.ts`
- Modify: `src/App.tsx` (플레이스홀더 교체)
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `useStorage()`, `splitPath`, `parentPath`.
- Produces:
  - `type Location = { libId: string | null; path: string }` — `MainScreen`의 `useState`. 라이브러리 선택 시 `{ libId, path: '/' }`.
  - `useLibraries()` → `useQuery(['libraries'])`; `useCurrentDir(loc)` → `useQuery(['dir', libId, path], enabled: !!libId)`.
  - `formatSize(bytes: number): string` — `0 → '0 B'`, `1536 → '1.5 KB'`, `3_355_443 → '3.2 MB'`, `2_147_483_648 → '2.0 GB'`. `formatDate(unixSec: number): string` — `YYYY-MM-DD HH:mm` 로컬.
  - `FileTable` props: `{ entries: Entry[]; onOpenDir(path): void; onOpenFile(entry): void; selected?: string }` — 행 더블클릭 분기. Task 9에서 우클릭 메뉴 추가.
  - `Sidebar`: 암호화 라이브러리는 회색 + `Lock` 아이콘, 클릭 무시.
  - 상태: `isLoading` → 스켈레톤 5행; `error` → 상단 빨간 배너 + [다시 시도](`refetch`); 빈 배열 → 본문 중앙 "파일을 끌어다 놓으세요"; `libId === null` → "라이브러리를 선택하세요".
  - 헤더 [새로고침] → `queryClient.invalidateQueries(['dir'])`; [계정] 드롭다운 → 로그아웃.

- [ ] **Step 1: 테스트** `format.test.ts` — 위 값들.
- [ ] **Step 2: 실패 확인** `npm test`.
- [ ] **Step 3: 구현** 설계 4.2 레이아웃대로. 토큰 클래스만 사용(`bg-background`, `bg-muted`, `text-muted-foreground`, `border-border`, `hover:bg-accent`). 행 `h-8 text-sm`, 사이드바 `w-56 p-4`, 헤더 `h-12 px-4`. 버튼은 `components/ui/button`.
- [ ] **Step 4: 확인** `npm test` PASS. 앱에서 모든 라이브러리·폴더 이동, 브레드크럼 클릭 상위 이동, 빈 폴더 문구, 새로고침 동작.
- [ ] **Step 5: Commit** `git commit -m "feat: browse screen — sidebar, breadcrumb, file table"`

---

### Task 5: DropZone(react-dropzone) + 덮어쓰기 확인

**Files:**
- Create: `src/features/upload/DropZone.tsx`, `OverwriteDialog.tsx`, `planUploads.ts`
- Test: `src/features/upload/planUploads.test.ts`

**Interfaces:**
- Consumes: `UploadTask`, `Entry`, `react-dropzone`의 `useDropzone`, shadcn `Dialog`/`Button`.
- Produces:
  - `toUploadTasks(files: File[], targetDir: string): UploadTask[]` (`planUploads.ts` 안) — react-dropzone이 폴더 드롭 시 각 `File`에 붙이는 `path`(예 `/a/b/c.txt` 또는 `./a/b/c.txt`)에서 파일명을 뺀 디렉터리 부분을 `relativePath: 'a/b'`로. 최상위 파일(`path`가 파일명뿐)은 `relativePath` 없음.
  - `planUploads(tasks: UploadTask[], existing: Entry[]): { conflicts: UploadTask[]; fresh: UploadTask[] }` — `relativePath`가 없고 `file.name`이 `existing` 이름과 정확히 같은 것이 `conflicts`. (하위 경로 미검사: `// ponytail: 상위 폴더만 검사`)
  - `DropZone` props `{ targetDir: string; children; onFiles(tasks: UploadTask[]): void }` — `useDropzone({ noClick: true, noKeyboard: true, useFsAccessApi: false, onDrop })`. `isDragActive`일 때 반투명 오버레이 "여기에 놓으면 {targetDir} 에 업로드". `useFsAccessApi: false`는 Tauri 웹뷰에서 폴더 드롭을 `webkitGetAsEntry` 경로로 타게 하기 위함. 헤더 [업로드] 버튼은 `open()`(dropzone의 파일 선택)으로 연결.
  - `OverwriteDialog` props `{ count: number; onChoice(c: 'overwrite' | 'skip' | 'cancel'): void }` — shadcn `Dialog`, 문구 "N개 파일이 이미 있습니다".

- [ ] **Step 1: 테스트** `planUploads.test.ts`:
  - `toUploadTasks derives relativePath from file.path`: `path '/a/b/c.txt'` → `relativePath 'a/b'`; `path './a/b/c.txt'` → `'a/b'`; `path 'c.txt'` → `relativePath` undefined.
  - `flags same-name top-level files as conflicts`, `nested files never conflict`.
  - `ignores empty directories`는 react-dropzone이 파일만 넘기므로 별도 코드가 없다. 대신 Step 4의 수동 확인 항목으로 둔다.
- [ ] **Step 2: 실패 확인** `npm test`.
- [ ] **Step 3: 구현**.
- [ ] **Step 4: 확인** `npm test` PASS. 앱에서 드래그 오버 시 오버레이가 뜨고, 폴더(빈 하위 폴더 포함) drop 시 `console.log(tasks)`에 파일만 상대 경로와 함께 찍히고 에러 없음(큐는 Task 6).
- [ ] **Step 5: Commit** `git commit -m "feat: drop zone with react-dropzone, overwrite planning"`

---

### Task 6: uploadQueue

**Files:**
- Create: `src/features/upload/uploadQueue.ts`
- Test: `src/features/upload/uploadQueue.test.ts`

**Interfaces:**
- Consumes: `StorageProvider.upload(libId, task, onProgress, signal)`.
- Produces:
  ```ts
  type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'cancelled'
  type UploadItem = { id: string; task: UploadTask; libId: string; status: UploadStatus; sent: number; total: number; error?: string; attempts: number }
  class UploadQueue {
    constructor(provider: StorageProvider, opts?: { concurrency?: number /*3*/; retries?: number /*2*/ })
    add(libId: string, tasks: UploadTask[]): void
    retry(id: string): void          // failed → queued, attempts 0
    cancel(id: string): void         // AbortController.abort(), status cancelled
    cancelAll(): void
    clearFinished(): void
    subscribe(fn: (items: UploadItem[]) => void): () => void   // useSyncExternalStore용
    getSnapshot(): UploadItem[]
    onAllDone?: (libId: string, dirs: Set<string>) => void       // 완료 시 폴더 무효화용
  }
  ```
  실패 시 `attempts < retries`면 자동으로 `queued`로 되돌려 재시도, 초과하면 `failed`. `signal`이 abort된 실패는 재시도하지 않고 `cancelled`.

- [ ] **Step 1: 테스트** 가짜 provider(`upload`를 `vi.fn()`이 반환하는 deferred promise로):
  - `runs at most 3 concurrently`: 5개 add → `upload` 호출 수 3, 하나 resolve → 4.
  - `retries then fails`: upload가 항상 reject → 최종 `attempts === 3`(1+2), `status 'failed'`.
  - `cancel aborts signal`: cancel 후 전달된 `signal.aborted === true`, status `cancelled`, 재시도 안 함.
  - `reports progress`: onProgress(5,10) → item.sent 5.
  - `calls onAllDone with target dirs`.
- [ ] **Step 2: 실패 확인** `npm test`.
- [ ] **Step 3: 구현**. 상태 변경마다 새 배열을 만들어 `subscribe` 구독자에게 알린다.
- [ ] **Step 4: 통과 확인** `npm test` PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: upload queue with concurrency, retry, cancel"`

---

### Task 7: SeafileProvider.upload — 청크 + 이어올리기

**Files:**
- Create: `src/storage/seafile/chunk.ts`, `src/storage/seafile/xhrUpload.ts`
- Modify: `src/storage/seafile/SeafileProvider.ts`
- Test: `src/storage/seafile/chunk.test.ts`, `src/storage/seafile/upload.test.ts`

**Interfaces:**
- Consumes: `SeafileApi.get`.
- Produces:
  - `CHUNK_SIZE = 8 * 1024 * 1024`
  - `chunkRanges(total: number, offset: number, chunkSize = CHUNK_SIZE): Array<{ start: number; end: number }>` — `end`는 inclusive(Content-Range 형식). `total ≤ chunkSize && offset === 0` → `[]`(= 단일 POST 신호). `offset ≥ total` → `[]`. `(20, 0, 8) → [{0,7},{8,15},{16,19}]`, `(20, 8, 8) → [{8,15},{16,19}]`.
  - `xhrUpload(url: string, form: FormData, headers: Record<string,string>, onProgress: (sent: number) => void, signal?: AbortSignal): Promise<string>` — XHR POST, `upload.onprogress`, abort 연동, 2xx 아니면 `StorageError('server')`. 테스트하지 않고 Step 5의 수동 검증으로 대신한다.
  - `SeafileProvider.upload(libId, task, onProgress, signal)`:
    1. `dir = task.relativePath ? joinPath(task.targetDir, task.relativePath) : task.targetDir`
    2. `uploaded = (await api.get('/api/v2.1/repos/{id}/file-uploaded-bytes/', { parent_dir: dir, file_name: name })).uploadedBytes` (실패하면 0)
    3. `uploaded ≥ size` → `onProgress(size,size)` 후 return.
    4. `link = await api.get<string>('/api2/repos/{id}/upload-link/', { p: task.targetDir })` + `?ret-json=1`
    5. `ranges = chunkRanges(size, uploaded)`. 빈 배열이면 FormData(`file`, `parent_dir=task.targetDir`, `relative_path`, `replace=1`) 한 번 POST. 아니면 각 range마다 `file.slice(start, end+1)`을 `file` 필드로, 헤더 `Content-Range: bytes {start}-{end}/{size}`, `Content-Disposition: attachment; filename="{name}"`, 순서대로 POST. `onProgress(start + chunkSent, size)`.
    6. 업로드 링크 만료 응답(403/500)이 오면 링크를 한 번 다시 받아 그 청크부터 재시도. 그래도 실패하면 throw.
  - `upload.test.ts`는 `xhrUpload`를 `vi.mock`으로 대체해 호출 인자만 검사한다.

- [ ] **Step 1: 테스트**
  - `chunk.test.ts`: 위 예시 값 4개.
  - `upload.test.ts`: `single post for small file`(5바이트 파일 → xhrUpload 1회, 헤더에 Content-Range 없음), `resumes from uploadedBytes`(size 20, uploadedBytes 8, chunk 8 → xhrUpload 2회, 첫 Content-Range `bytes 8-15/20`), `skips when already complete`(uploadedBytes 20 → xhrUpload 0회).
- [ ] **Step 2: 실패 확인** `npm test`.
- [ ] **Step 3: 구현**.
- [ ] **Step 4: 통과 확인** `npm test` PASS.
- [ ] **Step 5: 실서버 확인** 임시로 MainScreen에서 `queue.add` 연결(Task 8에서 정리) 후: (a) 1KB 파일, (b) 50MB 파일, (c) 2GB 파일 올리다 Wi‑Fi 끊고 재시도 → `file-uploaded-bytes`가 0보다 크고 끊긴 지점부터 이어짐. Seahub에서 파일 크기·내용 확인.
- [ ] **Step 6: Commit** `git commit -m "feat: chunked resumable upload in seafile provider"`

---

### Task 8: UploadPanel + 업로드 배선

**Files:**
- Create: `src/features/upload/UploadPanel.tsx`, `src/features/upload/useUploadQueue.ts`
- Modify: `src/features/browse/MainScreen.tsx`

**Interfaces:**
- Consumes: `UploadQueue`, `DropZone`, `toUploadTasks`, `planUploads`, `OverwriteDialog`, `useCurrentDir`, shadcn `Progress`/`Button`.
- Produces:
  - `useUploadQueue()` — 앱 수명 동안 하나인 `UploadQueue`를 Context로 제공, `useSyncExternalStore`로 `items` 반환.
  - `MainScreen` 흐름: `DropZone.onFiles(tasks)` → `planUploads(tasks, entries)` → conflicts 있으면 `OverwriteDialog` → `overwrite`: 전부 add / `skip`: fresh만 add / `cancel`: 없음.
  - `queue.onAllDone = (libId, dirs) => dirs.forEach(d => invalidateQueries(['dir', libId, d]))`. 또 `relativePath`가 있던 업로드는 `targetDir`도 무효화.
  - `UploadPanel`: 하단 고정. `items.length === 0`이면 렌더 안 함. 접힌 상태 한 줄: `업로드 {done}/{total}` + 전체 진행바(`Σsent/Σtotal`) + 현재 파일명 + `[펼치기] [×]`(`cancelAll` + `clearFinished`). 펼친 상태: 항목별 행(이름, 진행바, 상태 텍스트 `대기/진행 중/완료/실패/취소됨`, 실패 행 `[재시도]`, 진행 행 `[취소]`). 전부 `done`이 되면 3초 후 자동 접힘 + `clearFinished`.

- [ ] **Step 1: 구현** (UI만, 테스트 없음). 진행바는 shadcn `Progress`, 버튼은 `Button variant="ghost" size="sm"`.
- [ ] **Step 2: 확인** 폴더째 드롭 → 하위 구조 그대로 올라감 → 완료 후 목록 자동 갱신. 같은 이름 드롭 → 다이얼로그 3가지 동작. 진행 중 [취소] → 취소됨. 실패 유도(서버 URL을 잠시 틀리게) → 실패 표시 + [재시도]. 3초 후 자동 접힘.
- [ ] **Step 3: Commit** `git commit -m "feat: upload panel and drop-to-upload wiring"`

---

### Task 9: 파일 조작 — 새 폴더, 이름 변경, 삭제, 다운로드

**Files:**
- Create: `src/features/browse/ContextMenu.tsx`, `src/features/browse/NewFolderButton.tsx`, `src/features/browse/useEntryActions.ts`
- Modify: `src/storage/seafile/SeafileProvider.ts`, `src/features/browse/FileTable.tsx`, `MainScreen.tsx`
- Test: `src/storage/seafile/SeafileProvider.test.ts` (추가)

**Interfaces:**
- Consumes: Task 1의 `rename(libId, path, newName, type)` 시그니처.
- Produces (provider):
  - `mkdir(libId, path)` → `POST /api2/repos/{id}/dir/?p={path}` form `operation=mkdir`
  - `rename(libId, path, newName, type)` → 파일 `POST …/file/?p=` / 폴더 `POST …/dir/?p=`, form `operation=rename`, `newname`.
  - `remove(libId, path, type)` → `DELETE …/file/?p=` 또는 `…/dir/?p=`
  - `downloadUrl(libId, path)` → `GET …/file/?p={path}&reuse=1` 응답 문자열. `previewUrl`은 같은 값.
- Produces (UI):
  - `useEntryActions(loc)` → `useMutation` 4개, 성공 시 `invalidateQueries(['dir', libId, path])`.
  - `ContextMenu`: shadcn `ContextMenu`(우클릭) + 행 끝 `…` 버튼은 shadcn `DropdownMenu`로 같은 항목. 항목: 다운로드(파일만), 이름 변경, 공유 링크(Task 11에서 연결, 지금은 비활성), 삭제. 삭제 확인은 shadcn `Dialog` "'{name}'을(를) 삭제할까요?" [삭제](destructive) [취소].
  - 이름 변경: `FileTable`에 `renamingPath` state → 해당 행 이름 칸이 `<input autoFocus>`, Enter 확정 / Esc 취소.
  - 다운로드: `const url = await downloadUrl(); window.open(url)`. Tauri WebView2에서 다운로드 UI가 안 뜨면 `@tauri-apps/plugin-opener`의 `openUrl`로 외부 브라우저에서 열기로 교체(설계 6장이 허용).
  - `NewFolderButton`: 클릭 → 테이블 맨 위에 입력 행 → Enter → `mkdir(joinPath(path, name))`.

- [ ] **Step 1: 테스트** `SeafileProvider.test.ts`에 `rename dir uses dir endpoint`(fetch URL `/dir/` 포함, body `operation=rename&newname=x`), `remove file uses DELETE`.
- [ ] **Step 2: 실패 확인** `npm test`.
- [ ] **Step 3: 구현**.
- [ ] **Step 4: 확인** `npm test` PASS. 앱에서 새 폴더 → 이름 변경 → 파일 다운로드(파일이 열리거나 저장됨) → 삭제. 한글·공백 이름으로 반복.
- [ ] **Step 5: Commit** `git commit -m "feat: mkdir, rename, delete, download"`

---

### Task 10: 미리보기 모달

**Files:**
- Create: `src/features/preview/PreviewModal.tsx`, `src/features/preview/previewKind.ts`
- Modify: `src/storage/seafile/SeafileProvider.ts` (`readText`), `MainScreen.tsx`, `FileTable.tsx`(`onOpenFile`)
- Test: `src/features/preview/previewKind.test.ts`

**Interfaces:**
- Produces:
  - `previewKind(name: string): 'image' | 'text' | 'pdf' | null` — image: `png jpg jpeg gif webp svg bmp`; text: `txt md markdown json js ts tsx jsx css html xml yml yaml toml ini log sh py rs go java c cpp h`; pdf: `pdf`. 대소문자 무시.
  - `readText(libId, path)` → `fetch(previewUrl)` → `.text()`. 호출 전 `entry.size > 1MB`면 UI가 "1MB 이상 텍스트는 미리보기하지 않습니다 + [다운로드]".
  - `PreviewModal` props `{ entries: Entry[]; index: number; onClose(); onNavigate(i) }` — `entries`는 현재 폴더에서 `previewKind !== null`인 파일만. 좌우 방향키로 이동, `Esc` 닫기, 배경 클릭 닫기. image → `<img>`, text → `<pre>`, pdf → `<iframe>`. 상단에 파일명 + [다운로드].
  - `FileTable.onOpenFile(entry)`: `previewKind(entry.name)`이 null이면 다운로드, 아니면 모달 열기.

- [ ] **Step 1: 테스트** `previewKind.test.ts` — `'A.PNG' → 'image'`, `'readme.md' → 'text'`, `'x.pdf' → 'pdf'`, `'x.zip' → null`, `'noext' → null`.
- [ ] **Step 2: 실패 확인** `npm test`.
- [ ] **Step 3: 구현**.
- [ ] **Step 4: 확인** `npm test` PASS. 이미지·텍스트·PDF 각각 열림, 좌우 이동, Esc, 1MB 초과 텍스트 안내, zip 더블클릭은 다운로드.
- [ ] **Step 5: Commit** `git commit -m "feat: preview modal for image, text, pdf"`

---

### Task 11: 공유 링크

**Files:**
- Create: `src/features/share/ShareDialog.tsx`
- Modify: `src/storage/seafile/SeafileProvider.ts`, `ContextMenu.tsx`
- Test: `src/storage/seafile/SeafileProvider.test.ts` (추가)

**Interfaces:**
- Produces:
  - `createShareLink(libId, path, opts?)` → `POST /api/v2.1/share-links/` form `repo_id`, `path`, `password?`, `expire_days?` → `{ url: res.link, expiresAt: res.expire_date ? Date.parse(res.expire_date)/1000 : undefined }`.
  - `ShareDialog` props `{ libId; entry: Entry; onClose() }` — 비밀번호(선택), 만료일 수(선택, `<input type="number" min=1>`), [링크 만들기] → URL 표시 + [복사](`navigator.clipboard.writeText`) + "복사됨" 피드백. 만료가 있으면 `YYYY-MM-DD까지` 표시.
  - ContextMenu의 "공유 링크" 활성화.

- [ ] **Step 1: 테스트** `createShareLink posts form and maps link` — fetch URL `/api/v2.1/share-links/`, body에 `repo_id=r&path=%2Fa.txt&expire_days=7`, 응답 `{link:'https://x/d/abc/', expire_date:'2026-11-02T00:00:00+09:00'}` → `url === 'https://x/d/abc/'`, `expiresAt` 숫자.
- [ ] **Step 2: 실패 확인** `npm test`.
- [ ] **Step 3: 구현**.
- [ ] **Step 4: 확인** `npm test` PASS. 앱에서 링크 생성 → 복사 → 시크릿 창에서 열림. 비밀번호·만료 옵션 동작.
- [ ] **Step 5: Commit** `git commit -m "feat: share link dialog"`

---

### Task 12: Windows 빌드 + 추상화 검사

**Files:**
- Modify: `src-tauri/tauri.conf.json` (`identifier`, `productName`), `package.json` (`"lint:storage"` 스크립트)

- [ ] **Step 1: 누수 검사 스크립트 두 개** `package.json`에 (Git Bash 기준):
  - `"lint:storage": "grep -rli seafile src --include=*.ts --include=*.tsx | grep -v '^src/storage/seafile/' | grep -v 'LoginScreen.tsx' ; test $? -eq 1"` — 추상화 누수.
  - `"lint:design": "grep -rnE '#[0-9a-fA-F]{3,6}\\b|\\b(bg|text|border)-\\[|-(gray|slate|zinc|neutral|stone|blue|red|green)-[0-9]' src/features src/App.tsx ; test $? -eq 1"` — 원시 색·임의값 사용.
  - `"lint": "npm run lint:storage && npm run lint:design"`. 실행 → 종료 코드 0. 걸리면 토큰 클래스로 고친다.
- [ ] **Step 2: 전체 테스트** `npm test` → 전부 PASS.
- [ ] **Step 3: 빌드** `npm run tauri build` → `src-tauri/target/release/bundle/` 아래 `.msi`/`.exe`. 설치 후 실행: 로그인 → 탐색 → 폴더 드롭 업로드 → 미리보기 → 공유 링크.
- [ ] **Step 4: 브라우저 모드 확인** `npm run dev` → `http://localhost:1420` 에서 로그인·탐색·단일 파일 업로드 동작(nginx map의 세 번째 origin).
- [ ] **Step 5: Commit** `git commit -m "chore: windows build config, storage and design lint"`
