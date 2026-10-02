# 텝 (가칭)

작업 화면 한쪽에서 작은 SD 모험가가 스스로 살아가고, 그 삶과 유품이 다음 세대로 이어지는 방치형 판타지 RPG.

## 문서

- 기획: `docs/텝_게임기획_설정문서_v0.1.md`
- 세부 설계: `docs/design/00_문서지도.md`부터 읽는다. 수치·ID는 `01_핵심규칙_수치기준.md`가 단일 출처다.
- 구현 결정: `docs/dev/IMPL_DECISIONS.md`

## 구조

| 경로 | 내용 |
| --- | --- |
| `packages/core` | 시뮬레이션 코어. 순수 TypeScript이며 DOM·Node API를 쓰지 않는다 |
| `packages/content-kit` | 콘텐츠 팩 로더·검증기(Node 도구) |
| `tools/sim` | 헤드리스 밸런스 시뮬레이터 |
| `tools/demo` | 터미널 데모 실행기(화면 전까지 한 생애를 한 줄 기록으로 지켜본다) |
| `tools/art-check` | 픽셀 에셋 검사기(`docs/art/assets.manifest.json` 규격 대조) |
| `content/` | 콘텐츠 팩(데이터). 새 지역·사건·시나리오는 코드가 아니라 팩으로 추가한다 |
| `apps/desktop` | (M2) Tauri 2 데스크톱 창 |

## 개발 환경 준비

필수 도구: Git, Node.js 22 이상, pnpm 10.33.0, Python 3.11 이상(`python` 명령).
Windows 데스크톱 앱을 빌드하려면 Rust stable MSVC, Visual Studio Build Tools의
**C++를 사용한 데스크톱 개발**(MSVC·Windows SDK), Microsoft Edge WebView2 Runtime도 필요하다.
데스크톱 창·트레이는 Windows용이며, 브라우저 시제품은 아래 `ui:dev`로 실행한다.

```sh
npm install --global pnpm@10.33.0
git clone https://github.com/evelynn/Tap-Rpg-V1.git
cd Tap-Rpg-V1
pnpm install --frozen-lockfile
pnpm check
```

처음 설치할 때는 npm·Cargo 패키지를 내려받을 네트워크가 필요하다.
`--offline`은 필요한 패키지가 로컬 캐시에 모두 있을 때만 사용한다.

## 빌드·실행

```sh
pnpm ui:dev              # 브라우저 시제품: http://localhost:5173 (종료: Ctrl+C)
pnpm desktop:build       # Windows 실행 파일 빌드
```

Windows PowerShell에서 빌드 결과를 실행한다.

```powershell
.\apps\desktop\src-tauri\target\release\tap.exe
```

`desktop:build`는 UI·콘텐츠·그림을 먼저 묶고 실행 파일에 포함한다.
개발 중 UI를 수정하면 `ui:dev`를 다시 실행하고 브라우저를 새로 고친다.
게임 저장은 `%APPDATA%\Tap\save`, 설정은 `%APPDATA%\Tap\settings.json`에 남는다.

## 검증·도구

```sh
pnpm check               # 타입·테스트·코어 ID·설계 문서·콘텐츠 검사
pnpm ui:build            # UI 빌드만 실행
pnpm sim --attitude all --seeds 1-100 --out reports/   # 태도별 100생애 밸런스 보고
pnpm demo --speed 60     # 한 생애를 60배속으로 지켜보기(--fast·--plain·--auto·--help)
pnpm art:check           # 납품된 픽셀 에셋 검사
```

실행에 필요한 PNG·메타데이터는 `assets/ready/`에 포함되어 있어 아트 재생성 없이 빌드할 수 있다.
아트 도구가 참조하는 생성 원본과 대응표도 포함한다. 아트 수정 방법은
`tools/art-check/README.md`, 처리 이력은 `assets/ready/README.md`를 따른다.
미채택 이미지·이전 시도 원본, 의존성(`node_modules`), 빌드 결과(`dist`, Rust `target`),
검사 보고서는 Git에서 제외한다.

추가 개발 전 `docs/dev/ARCHITECTURE.md`와 `docs/dev/IMPL_DECISIONS.md`를 읽고,
미구현 항목은 `docs/dev/UNDEVELOPED.md`에서 확인한다.
변경 후 `pnpm check`와 해당 빌드를 실행한다. 의존성을 바꾸면
`pnpm-lock.yaml` 또는 `apps/desktop/src-tauri/Cargo.lock`도 함께 커밋한다.

밸런스 목표를 벗어난 지표는 `docs/dev/BALANCE_BACKLOG.md`에 모은다. 조정은 코드가 아니라 `content/base` 수치로 한다.
확장 팩 예시는 `content/examples/mist-forest`, 작성법은 `docs/dev/CONTENT_GUIDE.md`.
