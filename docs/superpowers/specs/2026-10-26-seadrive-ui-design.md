# seadrive — Seafile 개인용 데스크톱 파일 탐색기 설계

작성일: 2026-10-26
상태: 검토 반영 완료 (사용자 승인 대기)

사용자가 확인해 준 것: 수 GB 파일도 올린다 / 암호화 라이브러리 안 씀 / 2FA 안 씀 / 백엔드 서버는 앱에서 바꿔 붙을 수 있어야 함 / Seafile API는 한 겹 감싼다.

## 1. 의도와 이유

이미 운영 중인 Seafile 서버(`https://seafile.heavybear-lab.net`)를 **내가 만든 UI**로 쓰고 싶다.
기본 웹 UI(Seahub)는 드래그앤드롭 업로드 경험이 부족하다. 서버는 그대로 두고 프론트만 새로 만든다.

사용자는 본인 한 명. 매일 쓰는 화면(탐색, 올리기, 내려받기, 간단한 정리, 공유 링크)만 만든다.

## 2. 목표 / 비목표 / 반목표

**목표**
- 라이브러리 → 폴더 → 파일 탐색
- 드래그앤드롭 업로드 (파일 여러 개, 폴더째 포함), 진행률 표시, 실패 재시도
- 다운로드, 이름 변경, 삭제, 새 폴더
- 이미지 · 텍스트 · PDF 미리보기
- 공유 링크 생성 + 복사
- Windows 데스크톱 앱(Tauri). 같은 코드가 브라우저에서도 동작하도록 유지

**비목표 (v1에서 안 함)**
- 로컬 폴더 자동 동기화(SeaDrive/Seafile 클라이언트 대체 아님)
- 관리자 기능, 다중 사용자 UI, 그룹/팀 공유, 권한 관리
- 검색, 휴지통, 버전 히스토리, 파일 편집
- 이동/복사(필요해지면 추가. API는 rename과 같은 엔드포인트라 추가 비용 낮음)

**반목표 (이러면 실패)**
- Seafile API가 React 컴포넌트에 직접 스며드는 것. 나중에 Seafile을 다른 스토리지로 교체할 때 UI 코드를 손대야 하면 실패.
- 큰 파일(수 GB) 올리다가 진행률 없이 멈춘 것처럼 보이거나, 중간에 끊기면 처음부터 다시 올려야 하는 것.
- 서버 쪽 Seafile 자체를 수정해야 하는 것(리버스 프록시 설정 한 블록 정도는 허용).

## 3. 제약

- 서버: Seafile CE, 라즈베리파이, nginx 리버스 프록시 뒤에 있음(추정). Web API v2 / v2.1 사용.
- 스택(사용자 지정): Tauri 2, React, Vite. TypeScript.
- 인증: 아이디/비밀번호로 토큰 발급(`/api2/auth-token/`), 이후 `Authorization: Token …`.
- CORS: Seafile/seafhttp는 기본적으로 CORS 헤더를 보내지 않는다. Tauri 웹뷰 origin(`http://tauri.localhost`)에서 직접 `fetch`/`XHR`를 쓰려면 nginx에서 CORS 헤더를 붙여야 한다. → 4.5 참고.

## 4. 결정된 것

### 4.1 스토리지 추상화 (사용자 요구)

UI는 Seafile을 모른다. `src/storage/StorageProvider.ts` 인터페이스만 본다.

```ts
export interface Library { id: string; name: string; size: number; mtime: number; encrypted: boolean }
export interface Entry {
  id: string; name: string; type: 'file' | 'dir'; size: number; mtime: number;
  path: string;            // 부모 경로 + 이름, '/'로 시작
}
export interface UploadTask {
  file: File; targetDir: string; relativePath?: string;   // 폴더 드롭 시 하위 경로
}
export interface ShareLink { url: string; expiresAt?: number }

export interface StorageProvider {
  login(username: string, password: string, otp?: string): Promise<void>;
  logout(): Promise<void>;
  isLoggedIn(): boolean;

  listLibraries(): Promise<Library[]>;
  listDir(libId: string, path: string): Promise<Entry[]>;

  upload(libId: string, task: UploadTask, onProgress: (sent: number, total: number) => void,
         signal?: AbortSignal): Promise<void>;
  downloadUrl(libId: string, path: string): Promise<string>;   // 만료 있는 임시 URL
  previewUrl(libId: string, path: string): Promise<string>;    // 이미지/PDF 로드용 (보통 downloadUrl과 같음)
  readText(libId: string, path: string): Promise<string>;

  mkdir(libId: string, path: string): Promise<void>;
  rename(libId: string, path: string, newName: string): Promise<void>;
  remove(libId: string, path: string, type: 'file' | 'dir'): Promise<void>;

  createShareLink(libId: string, path: string, opts?: { password?: string; expireDays?: number }): Promise<ShareLink>;
}
```

구현체는 `src/storage/seafile/SeafileProvider.ts` 하나. 앱 전역에 `StorageContext`로 주입한다.
컴포넌트와 훅은 `useStorage()`로만 접근한다. `seafile`이라는 단어가 `src/storage/seafile/` 바깥에 나오면 안 된다(서버 URL 기본값 제외).

교체 시: 새 폴더에 `XxxProvider.ts` 하나 만들고 `createProvider`의 `switch`에 한 줄 추가한다.

**연결 설정 (사용자 요구: 앱에서 백엔드 서버를 바꿔 붙일 수 있어야 함)**

```ts
export interface Connection { kind: 'seafile'; baseUrl: string }   // kind는 나중에 union으로 늘어남
export function createProvider(conn: Connection): StorageProvider  // kind별 switch
```

- `Connection`과 토큰은 `localStorage`에 함께 저장한다. 앱 시작 시 저장된 연결로 Provider를 만든다.
- 로그인 화면(S1)에서 서버 종류 + 서버 URL을 고른다. 종류가 하나뿐인 동안은 종류 선택 UI를 숨기고 URL만 보여준다.
- 로그아웃하면 연결 설정은 남기고 토큰만 지운다. "다른 서버로 연결"은 로그인 화면에서 URL을 바꾸는 것으로 충분하다(v1에서는 동시 다중 연결 없음).
- UI 코드는 `Connection.kind`를 분기하지 않는다. 분기는 `createProvider` 한 곳.

### 4.2 화면 구성

단일 창, 라우터 없음. 상태는 `{ libId, path }` 하나로 현재 위치를 표현한다.

```
+----------------------------------------------------------------+
| [앱명]   내 라이브러리 / 사진 / 2026 / 여행        [새로고침] [계정] |  <- 헤더: 브레드크럼
+---------------+------------------------------------------------+
| 라이브러리     |  [새 폴더] [업로드]                              |
|  * 문서        |  +------------------------------------------+  |
|  * 사진        |  | 이름            크기      수정일          |  |
|  * 백업        |  | [D] 2025                  10/01          |  |
|               |  | [D] 2026                  10/20          |  |
|               |  | [I] IMG_001.jpg  3.2 MB   10/21          |  |
|               |  | [T] 메모.txt     1 KB     10/22          |  |
|               |  +------------------------------------------+  |
|               |                                                |
|               |   (드래그 오버 시 본문 전체에 오버레이:          |
|               |    "여기에 놓으면 /사진/2026/여행 에 업로드")     |
+---------------+------------------------------------------------+
| 업로드 3/5 [=======   ] 72%  IMG_004.jpg 1.1/3.0MB  [펼치기] [x] |  <- 업로드 패널 (업로드 중일 때만)
+----------------------------------------------------------------+
```

**화면 목록**

| # | 화면 | 내용 |
|---|------|------|
| S1 | 로그인 | 서버 종류(현재 Seafile 하나뿐이라 숨김), 서버 URL(기본값 `https://seafile.heavybear-lab.net`, 수정 가능), 아이디, 비밀번호. OTP 칸은 평소 숨기고 서버가 OTP를 요구하는 응답(400 + `X-Seafile-OTP: required`)을 보냈을 때만 나타난다(사용자는 2FA 안 씀. 코드 몇 줄이라 넣어 둠). 연결 설정 + 토큰은 `localStorage`에 저장. 앱 시작 시 토큰 있으면 S2로 바로. |
| S2 | 메인 | 위 레이아웃. 사이드바 = 라이브러리 목록(클릭 시 루트로). 암호화 라이브러리는 회색 + 자물쇠 아이콘으로 표시만 하고 클릭 불가(사용자는 안 씀. v1 제외). 본문 = 현재 폴더 엔트리 테이블. 폴더 더블클릭 → 진입, 파일 더블클릭 → 미리보기(가능한 타입) 또는 다운로드. 브레드크럼 클릭으로 상위 이동. |
| S2-a | 컨텍스트 메뉴 (우클릭 / … 버튼) | 다운로드(파일만. 폴더 다운로드는 v1 제외, zip-task API 필요), 이름 변경(인라인 편집), 공유 링크, 삭제(확인 다이얼로그). |
| S2-b | 드롭 오버레이 | 본문 위로 드래그 중일 때 반투명 오버레이 + 대상 경로 안내. 놓으면 업로드 큐에 추가. 폴더를 놓으면 하위 구조 그대로(`relativePath`). 헤더의 [업로드] 버튼은 `<input type="file" multiple>` 폴백. |
| S2-b' | 덮어쓰기 확인 | 드롭한 파일 이름이 현재 폴더 목록(이미 받아둔 `listDir` 결과)과 겹치면 큐에 넣기 전에 한 번만 묻는다: "N개 파일이 이미 있습니다" → [덮어쓰기] [건너뛰기] [취소]. 겹치는 게 없으면 바로 업로드. 폴더 드롭의 하위 경로까지는 검사하지 않는다(`ponytail:` 상위 폴더만 검사, 필요해지면 하위 listDir 추가). 서버 호출은 항상 `replace=1`. (내 결정) |
| S2-c | 업로드 패널 | 하단 고정. 접힌 상태: 전체 진행률 + 현재 파일. 펼친 상태: 파일별 행(이름, 진행률, 상태: 대기/진행/완료/실패). 실패 행에 [재시도](Provider가 서버에 이미 올라간 바이트를 물어 그 다음부터 이어올림. UI는 그냥 `upload()`를 다시 부를 뿐). 전체 [취소]. 동시 업로드 3개. 완료 후 현재 폴더 자동 새로고침. 모두 완료되면 몇 초 뒤 자동으로 접힘. |
| S3 | 미리보기 모달 | 이미지(`img`), 텍스트·md·코드(`pre`, 1MB 이하), PDF(`iframe`). 그 외 타입은 "미리보기 없음 + 다운로드" 버튼. 좌우 키로 같은 폴더 내 이전/다음 미리보기 가능 파일 이동. `Esc` 닫기. |
| S4 | 공유 링크 다이얼로그 | 생성 버튼 → URL 표시 + [복사]. 옵션: 비밀번호, 만료일(일 단위). |

**상태 표현**: 빈 폴더("파일을 끌어다 놓으세요"), 로딩(스켈레톤 행), 오류(상단 배너 + 재시도), 토큰 만료(401 → S1로).

### 4.3 기술 스택 (사용자 지정 + 내 결정)

| 영역 | 선택 | 비고 |
|------|------|------|
| 셸 | Tauri 2 | Windows 우선. `create-tauri-app` 템플릿(react-ts). |
| UI | React 19 + TypeScript + Vite | |
| 서버 상태 | TanStack Query | 폴더 목록 캐시, 업로드 후 invalidate. (내 결정) |
| 스타일 | Tailwind CSS v4 + shadcn/ui | shadcn은 패키지가 아니라 `src/components/ui/`에 복사되는 컴포넌트. `button, input, dialog, context-menu, dropdown-menu, progress, tooltip`만 가져온다. 아이콘은 `lucide-react`. (내 결정) |
| 드롭 처리 | `react-dropzone` | 드래그 상태, 폴더 재귀 탐색, 상대 경로(`file.path`) 제공. 직접 짜지 않는다. (내 결정) |
| 라우팅 | 없음 | `{libId, path}` 상태 하나. (내 결정) |
| HTTP | 브라우저 `fetch` + 업로드는 `XMLHttpRequest`(진행률 때문) | Tauri 플러그인 안 씀. 4.5 참고. |
| 드롭(웹뷰 설정) | HTML5 DnD | `tauri.conf.json`의 `app.windows[].dragDropEnabled: false` 필수. 켜져 있으면 웹뷰가 `File` 객체를 못 받는다. |
| 토큰 저장 | `localStorage` | 개인용 PC. (내 결정; 보안 강화 필요하면 `tauri-plugin-store`로 교체) |

### 4.3.1 디자인 시스템 (사용자 요구: 유지보수·확장을 위해 일관성)

- **토큰이 유일한 소스.** shadcn/ui의 CSS 변수(`--background --foreground --card --primary --primary-foreground --secondary --muted --muted-foreground --accent --destructive --border --input --ring --radius`)를 `src/index.css`에 정의하고 Tailwind v4 `@theme`에 매핑한다. 색·반경은 여기 말고 어디에도 적지 않는다.
- **컴포넌트는 토큰 클래스만 쓴다.** `bg-background`, `text-muted-foreground`, `border-border` 같은 토큰 클래스만 허용. `#hex`, `bg-[…]` 임의값, `text-gray-500` 같은 팔레트 직접 참조는 금지.
- **스케일 고정.** 행 높이 `h-8`(32px), 패널 패딩 `p-4`(16px), 요소 간격 `gap-2`(8px), 본문 `text-sm`(14px), 보조 `text-xs`(12px), 반경은 `rounded-md` 하나.
- **기본 요소는 `src/components/ui/`를 거친다.** 기능 폴더(`src/features/`)에서 `<button>`, `<input>`, 직접 만든 모달·메뉴를 쓰지 않는다. 새 종류가 필요하면 shadcn에서 추가로 가져오거나 `components/ui/`에 만든다.
- **다크 모드 대비.** 토큰이 `.dark` 선택자에서 재정의되는 shadcn 구조를 유지한다. v1에서 토글은 안 만들지만 클래스 하나로 켤 수 있어야 한다.
- 위 규칙을 `docs/DESIGN.md` 한 장에 적고, 빌드 단계의 검사 스크립트가 `src/features` 안의 원시 값 사용을 잡는다.

### 4.4 Seafile 구현체가 쓰는 API (SeafileProvider 내부에서만)

| 메서드 | 호출 |
|--------|------|
| login | `POST /api2/auth-token/` (username, password; OTP는 `X-SEAFILE-OTP` 헤더) |
| listLibraries | `GET /api2/repos/` |
| listDir | `GET /api2/repos/{id}/dir/?p={path}` |
| upload | 수 GB 파일을 다루므로 **청크 업로드**. (1) `GET /api/v2.1/repos/{id}/file-uploaded-bytes/?parent_dir=&file_name=` → 이미 받은 바이트 수(이어올리기). (2) `GET /api2/repos/{id}/upload-link/?p={dir}` → 업로드 URL(약 1시간 유효, 만료되면 다시 받는다). (3) 파일을 8MB 청크로 잘라 순서대로 `POST multipart` (`file`, `parent_dir`, `relative_path`, `replace=1`) + 헤더 `Content-Range: bytes {start}-{end}/{total}`, `Content-Disposition: attachment; filename="{name}"`. URL에 `?ret-json=1`. 진행률 = 완료 청크 + 현재 청크 XHR 진행. 청크 크기는 Provider 내부 상수(빌더 조정). |
| downloadUrl / previewUrl | `GET /api2/repos/{id}/file/?p={path}` → 임시 URL 문자열 |
| readText | previewUrl → `fetch` → text |
| mkdir | `POST /api2/repos/{id}/dir/?p={path}` (`operation=mkdir`) |
| rename | `POST /api2/repos/{id}/file/?p={path}` (`operation=rename`, `newname`) / dir은 `/dir/` |
| remove | `DELETE /api2/repos/{id}/file/?p=` / `/dir/?p=` |
| createShareLink | `POST /api/v2.1/share-links/` (`repo_id`, `path`, `password`, `expire_days`) |

빌더는 구현 전에 실제 서버 응답을 한 번 확인하고 필드명을 맞춘다(버전에 따라 미세하게 다름).

### 4.5 CORS — 서버 쪽 유일한 변경

웹뷰에서 직접 `fetch`하려면 nginx `server` 블록에 CORS 허용이 필요하다. `/`(Seahub API)와 `/seafhttp`(업로드/다운로드) 둘 다.

```nginx
# http 블록: 허용 origin 목록 (Tauri 웹뷰 + 로컬 vite dev)
map $http_origin $cors_origin {
    default "";
    "http://tauri.localhost"  $http_origin;   # Windows WebView2
    "tauri://localhost"       $http_origin;   # macOS/Linux
    "http://localhost:1420"   $http_origin;   # vite dev
}

# 두 location 블록 안에 모두. 쿠키 안 쓰므로 Allow-Credentials는 넣지 않는다.
add_header Access-Control-Allow-Origin $cors_origin always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-SEAFILE-OTP" always;
if ($request_method = OPTIONS) { return 204; }
```

- 인증은 `Authorization: Token` 헤더만 쓰고 쿠키를 쓰지 않으므로 `Allow-Credentials`는 빼고, origin도 위 세 개로 고정한다. `$http_origin` 전체 허용은 금지. (내 결정)
- Tauri CSP는 `create-tauri-app` 기본값(`null`)을 유지한다. 임의 서버 URL로 붙어야 하므로 `connect-src`를 고정하지 않는다. (내 결정)
- "다른 서버로 연결"은 그 서버도 같은 CORS 설정을 해 뒀다는 전제다. 안 돼 있으면 로그인 화면 오류 메시지에 그렇게 안내한다.
- 브라우저 모드는 v1에서 **개발 편의용**(`vite dev`, `localhost:1420`)으로만 유지한다. 서버에 호스팅하지 않는다. 호스팅하게 되면 그 도메인을 위 map에 추가하면 된다. (내 결정)

**이 선택의 이유**: Tauri HTTP 플러그인으로 우회하면 서버는 안 건드려도 되지만, (1) 업로드 진행률을 위해 Rust 쪽 multipart 스트리밍 코드를 따로 써야 하고 (2) 브라우저에서는 전혀 안 돌아간다. nginx 다섯 줄이 더 싸다.
서버를 건드리기 싫으면 이 결정만 뒤집으면 된다(Provider 내부만 바뀌고 UI는 그대로).

### 4.6 폴더 구조

```
src/
  storage/
    StorageProvider.ts        # 인터페이스 + 타입
    createProvider.ts         # Connection → StorageProvider (kind별 switch)
    StorageContext.tsx        # Provider 주입, useStorage()
    seafile/
      SeafileProvider.ts      # 유일한 구현체
      api.ts                  # 저수준 fetch 래퍼 (baseUrl, token)
  features/
    auth/      LoginScreen.tsx
    browse/    Sidebar.tsx, Breadcrumb.tsx, FileTable.tsx, ContextMenu.tsx, useCurrentDir.ts
    upload/    DropZone.tsx (react-dropzone 래핑), UploadPanel.tsx, uploadQueue.ts (큐·동시성·재시도), planUploads.ts (덮어쓰기 판단)
  components/ui/   # shadcn 복사본. 기능 코드는 기본 요소를 여기서만 가져온다.
    preview/   PreviewModal.tsx
    share/     ShareDialog.tsx
  App.tsx
src-tauri/                     # create-tauri-app 기본값. Rust 코드 추가 없음.
```

## 5. 작업 목록 (순서대로)

| 단계 | 할 일 | 완료 기준 |
|------|------|----------|
| 0 | 스캐폴드: `create-tauri-app`(react-ts), Tailwind, shadcn/ui(토큰 + 컴포넌트 7개), TanStack Query, lucide, react-dropzone, `docs/DESIGN.md`. `dragDropEnabled: false`. nginx CORS 적용 + `/seafhttp`에 `client_max_body_size`가 청크(8MB)보다 크고 `proxy_read_timeout`이 넉넉한지 확인. | `npm run tauri dev`로 빈 창이 뜨고, 웹뷰 콘솔에서 `fetch(서버/api2/ping/)`가 CORS 없이 성공 |
| 1 | `StorageProvider` 인터페이스 + `Connection`/`createProvider` + `SeafileProvider.login/listLibraries/listDir` + 로그인 화면 | 로그인 후 라이브러리 목록이 보임. 로그인 화면에서 URL을 바꾸면 그 서버로 붙음 |
| 2 | 사이드바, 브레드크럼, 파일 테이블, 폴더 진입/상위 이동, 상태(빈/로딩/오류/401) | 모든 폴더를 돌아다닐 수 있음 |
| 3 | **DnD 업로드**: DropZone, 폴더 재귀 수집, 덮어쓰기 확인, 업로드 큐(동시 3, 재시도, 취소), 청크 업로드 + 이어올리기, 진행 패널, 완료 후 새로고침 | 폴더째 끌어다 놓으면 하위 구조 그대로 올라가고 진행률이 보임. 2GB 파일을 올리다 네트워크를 끊고 재시도하면 끊긴 지점부터 이어서 올라감 |
| 4 | 새 폴더, 이름 변경, 삭제, 다운로드(브라우저 다운로드 → Tauri에서는 시스템 다운로드 동작 확인) | 컨텍스트 메뉴 4개 동작 |
| 5 | 미리보기 모달 (이미지/텍스트/PDF, 좌우 이동) | 더블클릭으로 열리고 Esc로 닫힘 |
| 6 | 공유 링크 다이얼로그 | 링크 생성·복사 |
| 7 | Windows 빌드 (`tauri build` → `.msi`/`.exe`) | 설치해서 실행. `vite dev`에서도 로그인·탐색·업로드가 되는지만 확인 |

각 단계는 그 단계의 핵심 로직에 대해 최소 하나의 실행 가능한 검사를 남긴다(uploadQueue, collectDroppedFiles, 경로 조합 정도. UI 컴포넌트는 제외).

## 6. 빌더에게 맡기는 것

- 테이블 정렬, 열 너비, 아이콘 매핑, 날짜 포맷
- 업로드 동시성 숫자·재시도 횟수(기본 3/2)
- 미리보기 가능 확장자 목록
- 다운로드가 Tauri 웹뷰에서 자연스럽지 않으면 `tauri-plugin-opener`로 외부 브라우저에서 열기 등 대안 선택
- 다크 모드 토글(토큰 구조상 켜기 쉬움. 있으면 좋고 없어도 됨)
