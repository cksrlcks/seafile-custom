# macOS 배포

`v*` 태그를 푸시하면 [release.yml](../.github/workflows/release.yml)이 Windows와 macOS(universal: Apple Silicon + Intel)를 함께 빌드해 같은 GitHub Release에 올린다.
두 빌드가 모두 끝나야 릴리스가 공개되고, `latest.json`에 `windows-x86_64`·`darwin-aarch64`·`darwin-x86_64`가 모두 들어간다.

## 결과물

| 파일 | 용도 |
| --- | --- |
| `Drive_<버전>_universal.dmg` | 처음 설치용 |
| `Drive.app.tar.gz` (+ `.sig`) | 자동 업데이트용 (앱이 `latest.json`을 보고 받는다) |

## 서명

### 기본: ad-hoc 서명 (Apple 계정 없음)

`tauri.macos.conf.json`의 `signingIdentity: "-"`로 ad-hoc 서명만 한다. 앱은 정상 동작하지만 Gatekeeper가 처음 실행을 막는다.

처음 한 번만 사용자가 직접 허용해야 한다.

1. `.dmg`를 열어 `Drive.app`을 `응용 프로그램`으로 끌어 넣는다.
2. 실행하면 "확인할 수 없음" 경고가 뜬다. **완료**를 누른다.
3. **시스템 설정 → 개인정보 보호 및 보안** 아래쪽 "Drive이(가) 차단되었습니다"에서 **그래도 열기**를 누른다.

자동 업데이트로 받은 새 버전은 이 과정 없이 그대로 열린다.

### 정식 서명·공증 (Apple Developer Program, 연 $99)

아래 GitHub 시크릿을 넣으면 CI가 자동으로 Developer ID 서명과 공증을 한다. 없으면 위의 ad-hoc 서명으로 빌드한다.

| 시크릿 | 값 |
| --- | --- |
| `APPLE_CERTIFICATE` | Developer ID Application 인증서 `.p12`를 base64로 (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` 내보낼 때 정한 비밀번호 |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: 이름 (TEAMID)` |
| `APPLE_ID` | Apple 계정 이메일 |
| `APPLE_PASSWORD` | appleid.apple.com에서 만든 앱 암호 |
| `APPLE_TEAM_ID` | 팀 ID (10자리) |

## 로컬 빌드

업데이트 서명 키(`TAURI_SIGNING_PRIVATE_KEY`) 없이 내 맥에서 확인용으로 빌드할 때:

```bash
npm run tauri build -- --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

결과물은 `src-tauri/target/release/bundle/macos/`, `src-tauri/target/release/bundle/dmg/`에 생긴다.

## macOS 동작 차이

- 창을 닫으면 숨겨지고, Dock 아이콘이나 메뉴 막대 아이콘을 누르면 다시 열린다. 완전히 끄려면 `⌘Q` 또는 메뉴 막대 아이콘 → 종료.
- 메뉴 막대 아이콘은 흑백 템플릿으로 그려져 다크/라이트 모드를 따라간다.
- 파일 아이콘은 Windows 탐색기 아이콘을 쓰는 기능이라 macOS에서는 기본 아이콘으로 나온다.
