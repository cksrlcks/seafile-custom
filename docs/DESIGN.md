# seadrive 디자인 시스템

## 규칙
1. **토큰이 유일한 소스.** 색·반경은 `src/index.css`의 shadcn CSS 변수에만 정의한다 (`--background --foreground --card --primary --primary-foreground --secondary --muted --muted-foreground --accent --destructive --border --input --ring --radius`). 다른 파일에 색을 적지 않는다.
2. **토큰 클래스만 쓴다.** `bg-background`, `text-muted-foreground`, `border-border`, `hover:bg-accent`. 금지: `#hex`, `bg-[…]`/`text-[…]` 임의값, `text-gray-500` 같은 팔레트 직접 참조.
3. **스케일 고정.** 테이블 행 `h-14`(56px) · 사이드바 행 `h-10`(40px) · 패널 안쪽 `p-7`(28px) · 카드 간격 `gap-5`(20px) · 목록·카드 본문 `text-md`(15px, `--text-md` 토큰) · UI 본문 `text-sm`(14px) · 보조 `text-xs`(12px) · 패널 `rounded-2xl`, 카드 `rounded-2xl`, 버튼 `rounded-lg`.
4. **기본 요소는 `src/components/ui/`를 거친다.** `src/features/`에서 `<button>`, `<input>`, 직접 만든 모달·메뉴를 쓰지 않는다.
5. **다크 모드 대비.** 토큰은 `.dark`에서 재정의된다. 토글은 v1에 없지만 `<html class="dark">` 하나로 켜져야 한다.
6. **검사.** `npm run lint`가 `src/features`의 원시 값과 Seafile 누수를 잡는다. 빌드 전에 돌린다.

## 비주얼 방향
연한 회색 캔버스(`bg-background`) 위에 흰 둥근 패널(`bg-card rounded-2xl border shadow-sm`). 사이드바는 캔버스 색 그대로, 선택 항목만 `bg-card shadow-sm`. 포인트색은 `primary`(파랑) 하나. 폴더는 카드(회색 안쪽 영역 + `FolderGlyph` + 이름/메타), 파일은 체크박스·정렬 헤더가 있는 테이블(행 `h-14`) 또는 그리드 카드. 폰트 Inter.

## 새 컴포넌트가 필요할 때
1. `npx shadcn@latest add <name>` 먼저.
2. shadcn에 없으면 `src/components/ui/<name>.tsx`에 토큰 클래스만으로 작성한다.

## 아이콘
`lucide-react`, 크기 `size-4`(16px). 폴더 `Folder`, 파일 `File`, 이미지 `Image`, 텍스트 `FileText`, 암호화 `Lock`.
