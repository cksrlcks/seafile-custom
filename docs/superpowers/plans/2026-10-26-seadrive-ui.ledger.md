# SDD ledger — plan: docs/superpowers/plans/2026-10-26-seadrive-ui.md
Spec: docs/superpowers/specs/2026-10-26-seadrive-ui-design.md (read)
Setup: Ruling: fresh repo, work on main — no prior history to isolate from; user chose inline in this folder — cost if wrong: none (no other branches exist)
Pre-flight:
- T1→T2: createProvider(conn, token?) / rename(libId,path,newName,type) — plan already aligned, no conflict
- T5→T8: toUploadTasks + planUploads + DropZone.onFiles(tasks) — consistent
- T6→T8: UploadQueue.subscribe/getSnapshot/onAllDone — consistent
- T7→T6: provider.upload(libId, task, onProgress, signal) — matches StorageProvider
- T9→T11: ContextMenu "공유 링크" placeholder → ShareDialog — consistent
Task 0: Ruling: nginx Allow-Headers에 Content-Range, Content-Disposition 추가 — 청크 업로드가 보내는 커스텀 헤더라 preflight에 필요 — cost if wrong: 없음(허용 폭만 넓어짐)
Task 0: Ruling: `npm run tauri dev` 창 확인은 Task 3(로그인 화면)로 미룸; 대신 tsc + vite build + cargo check로 검증 — Rust 첫 컴파일이 길고 지금은 볼 화면이 없음 — cost if wrong: Task 3에서 발견
Task 0: Ruling: tsconfig baseUrl 제거(TS 6에서 deprecated), paths만 사용 — cost if wrong: 없음
Task 0: complete (tests: npm test → no tests, exit 0; tsc 0; vite build ok; cargo check 백그라운드)
Task 1: complete (commits 4ba2802..d9221d9, tests: npm test →    Duration  144ms (import 38%, transform 29%, worker 16%, tests 16%, environment 1%))
Task 2: Ruling: 실서버 curl 필드 확인은 생략(자격증명 필요) — Task 3 로그인 화면에서 사용자가 실제 로그인으로 검증 — cost if wrong: 필드명 불일치 시 Task 3에서 수정
Task 2: complete (commits d9221d9..2cb9d6d, tests: npm test →    Duration  230ms (tests 43%, import 27%, transform 21%, worker 9%))
Task 3: Ruling: StorageProvider에 `readonly token` 추가 — 세션 저장을 위해 UI가 토큰을 읽어야 하며 스토리지 종류와 무관한 개념 — cost if wrong: 토큰 없는 백엔드는 null 반환하면 됨
Task 3: 검증: 브라우저(localhost:1420)에서 로그인 화면 렌더 확인, 서버 /api2/ping/ CORS fetch 200. 실제 계정 로그인은 사용자 확인 필요
Task 3: complete (commits 2cb9d6d..802764c, tests: npm test →    Duration  193ms (tests 47%, import 25%, transform 19%, worker 9%))
Task 4: Ruling: 메인 화면 시각 확인은 실제 계정 로그인이 필요해 사용자 검증으로 남김(컴파일·테스트는 통과) — cost if wrong: 레이아웃 문제는 사용자 첫 실행 시 발견
Task 4: complete (commits 802764c..596de8f, tests: npm test →    Duration  223ms (tests 32%, import 30%, transform 20%, worker 17%, environment 1%))
Task 5: complete (commits 596de8f..0e9f1ae, tests: npm test →    Duration  285ms (tests 33%, import 31%, transform 22%, worker 13%, environment 1%))
Task 6: complete (commits 0e9f1ae..66a0dd9, tests: npm test →    Duration  469ms (tests 60%, import 15%, transform 12%, worker 11%, environment 1%))
Task 7: Ruling: 실서버 대용량(2GB) 이어올리기 검증은 사용자 계정이 필요해 사용자 검증으로 남김(모킹 테스트 4개 통과) — cost if wrong: Seafile 버전별 Content-Range 처리 차이는 첫 실사용에서 발견
Task 7: complete (commits 66a0dd9..144edf2, tests: npm test →    Duration  516ms (tests 53%, import 22%, transform 17%, worker 9%, environment 1%))
Restyle: Ruling: 사용자 참고 시안 반영 — 토큰 재조정(회색 캔버스/흰 패널/파란 포인트/radius 14px), 폴더=카드·파일=테이블 구조, FolderGlyph 추가. 스펙 4.3.1에 기록 — cost if wrong: 스타일만, 로직 무관
Restyle: Ruling: 개발용 MockProvider(kind "mock", 로그인 서버 주소에 "mock" 입력) 추가 — 서버 자격증명 없이 화면 검증 가능, 추상화의 두 번째 구현체 — cost if wrong: 코드 ~120줄, 런타임엔 영향 없음
Task 8: 검증: mock provider로 파일 선택(3개, 1개 충돌) → 덮어쓰기 다이얼로그 → 업로드 → 목록 자동 갱신 → 3초 후 패널 자동 정리 확인(브라우저)
Task 8: complete (commits 4a9bf81..fcd2a17, tests: npm test →    Duration  417ms (tests 56%, import 20%, transform 15%, worker 7%, environment 1%))
Task 9: Ruling: 삭제 확인에 shadcn Dialog(계획대로), 다운로드는 window.open(url, "_blank") — Tauri WebView2 동작은 사용자 빌드 확인 — cost if wrong: plugin-opener로 교체(설계 6장 허용)
Task 9: Ruling: 사용자 추가 요청(Synapse 시안)으로 사이드바 로고줄·폴더 카드(회색 안쪽 영역)·테이블 행 h-14·브레드크럼 점 구분자 적용. 체크박스 선택·목록/그리드 토글은 범위 밖 — cost if wrong: 스타일만
Task 9: 검증(mock, 브라우저): 우클릭 메뉴 4항목, 인라인 이름 변경, 새 폴더 카드 생성, 삭제 다이얼로그→삭제 반영
Task 9: complete (commits fcd2a17..b608730, tests: npm test →    Duration  431ms (tests 57%, import 17%, transform 16%, worker 9%, environment 1%))
Restyle2: Ruling: 사용자 요청("완벽하게 맞춰")으로 범위 확장 — Inter 폰트, 사이드바 접기+폴더 트리(lazy, dir 쿼리 캐시 공유), 목록/그리드 토글, 체크박스 다중 선택+일괄 삭제, 정렬 가능한 헤더, 긴 날짜 표기(formatDateLong). 검색·태그·용량바·Added by 열은 데이터가 없어 제외 — cost if wrong: UI 코드만, Provider 무관
Task 10: 검증(mock, 브라우저): README.md 더블클릭 → 텍스트 미리보기, → 키로 다음 파일(이미지), 닫기 버튼. 합성 Esc 이벤트는 base-ui가 안 받으나 실제 키 입력은 Dialog 기본 동작
Task 10: complete (commit, tests: npm test → 59 pass)
Task 11: 검증(mock, 브라우저): 우클릭 → 공유 링크 → 링크 만들기 → URL 표시 + 복사 버튼
Task 11: complete (commit, tests: npm test → 59 pass)
Task 12: Ruling: lint을 npm cmd 호환 Node 스크립트(scripts/lint.mjs)로 — Windows npm은 cmd.exe라 bash 파이프 불가 — cost if wrong: 없음
Task 12: Ruling: lint storage 허용 목록에 StorageProvider.ts(Connection.kind 유니온), createProvider.ts(분기 지점) 추가 — 설계가 정한 유일한 분기 위치 — cost if wrong: 없음
Task 12: Ruling: 임의값 text-[15px] → @theme --text-md 토큰 — 디자인 린트에 걸림 — cost if wrong: 없음
Task 12: lint ok, tsc ok, vite build ok, tauri build 백그라운드 진행
Final review: reviewer(opus) Critical 2 / Important 8 / Minor 14
Final: fixed C1 한글 파일명 Content-Disposition — "encodes non-latin filename" RED→GREEN
Final: fixed C2 nginx seafhttp 중복 ACAO — docs/nginx-cors.conf에 proxy_hide_header 추가(설정 문서, 테스트 없음, 사용자 서버 적용 필요)
Final: fixed I1 조상 폴더 무효화 — "invalidates every ancestor dir" RED→GREEN
Final: fixed I2 401 처리 — MutationCache onError + queue.onUnauthorized, "unauthorized fails immediately" RED→GREEN
Final: fixed I3 조작 오류 배너 + 이름 검사 — validateName 테스트 5개 RED→GREEN
Final: fixed I4 이어올리기 혼선 — resumeRegistry(name+size+lastModified), uploaded>=size면 처음부터, 테스트 3개 RED→GREEN
Final: fixed I5 abort — xhrUpload 선검사·리스너 해제, GET에 signal, "does not start when aborted" RED→GREEN
Final: fixed I6 다운로드 — Tauri면 plugin-opener openUrl, 브라우저면 <a download> (수동 확인 필요)
Final: fixed I7 PDF — blob URL로 iframe (수동 확인 필요)
Final: fixed I8 로그인 오류 — loginErrorMessage 테스트 6개 RED→GREEN, nginx Expose-Headers 추가
Final: Ruling: 리뷰 Minor 중 다음은 수정 패스에서 함께 처리(한 줄짜리, 같은 파일): 전체선택이 폴더 선택을 지우던 것, 재시도 시 sent 초기화, 진행률 100% 초과 clamp, subscribe 안정 참조, 세션 바뀌면 QueryClient 새로 생성, 로그아웃 시 큐 cancelAll, 사이드바 접기 버그 — cost if wrong: 없음
Final: minor (deferred): 서버 주소 "mock" 입력이 릴리스 빌드에서도 MockProvider로 들어감 (import.meta.env.DEV 게이트 권장)
Final: minor (deferred): onAllDone이 모든 라이브러리 큐가 빌 때만 호출 — 큰 업로드 중 다른 폴더 갱신 지연
Final: minor (deferred): 4xx(쿼터·이름 거부)도 2회 재시도함
Final: minor (deferred): 파일명에 " 가 있으면 헤더/서버 저장명 이상
Final: minor (deferred): ShareDialog 오류 문구가 항상 동일(서버 메시지 미표시)
Final: minor (deferred): 일괄 삭제가 N개 병렬 DELETE
Final: minor (deferred): nginx location add_header가 server 레벨 헤더(HSTS) 상속 끊음 — conf 주석으로만 경고
Final: suite 76/76, lint ok, tsc ok
