# 인수인계 — 텝 (2026-09-23)

이 문서만 읽으면 이어서 작업할 수 있다. 상세는 `docs/design/00_문서지도.md`와 `docs/dev/*`에 있다.

## 1 지금까지

### 설계 (완료)
- `docs/텝_게임기획_설정문서_v0.1.md`(사용자 원본)를 `docs/design/00~18`의 19개 문서로 세분화했다. 수치·ID의 단일 출처는 `01`, 규칙별 소유 문서 표는 `00 §2.4`, 설계 결정은 `00 §3`(D01~).
- 독립 검증 2회로 결함 약 80건을 고쳤다. 대부분 두 문서가 같은 규칙을 따로 정의한 곳이었고, 그래서 소유 문서 구조(D18)를 도입했다.
- 사용자 요청으로 `18_생애의_책.md`를 추가했다(생애 종료 시 삶을 한 권으로 엮어 서가에 보존).
- 문서 검사기 `docs/design/tools/lint_docs.py`(폐기 ID·끊긴 참조·기록 길이·미확정 표현) — 현재 오류 0.

### 개발 (마일스톤 1, 거의 완료)
스택은 **Tauri 2 + TypeScript**(사용자 선택). M1은 UI 없이 코어·콘텐츠·도구까지다.

| 작업 | 상태 | 위치 |
| --- | --- | --- |
| T1 저장소 골격 | 완료 | 루트, `pnpm check` |
| T2 콘텐츠 스키마·팩 로더·검증기 | 완료 | `packages/content-kit`, `packages/core/src/schema`, `docs/dev/CONTENT_SCHEMA.md` |
| T3 기반 콘텐츠 | 완료 | `content/base` (장소 13·적 13·장비 26·소모품 8·특성 17·NPC 9) |
| T4 코어 기초 | 완료 | `rng time text content state rules journal sim` |
| T5 전투·부상·회복 | 완료 | `packages/core/src/{combat,recovery}` |
| T6 아이템·경제 | 완료 | `packages/core/src/{items,economy}` |
| T7 사건 엔진 | 완료 | `packages/core/src/events` (조건 56·효과 53) |
| T8 행동 결정·활동 | 완료 | `packages/core/src/{ai,activity}` |
| T9 사건 콘텐츠 41개 | 완료 | `content/base/events`, `chains` |
| T10 생애·계승 | 완료 | `packages/core/src/{life,succession}` |
| T11 저장·오프라인 | **진행 중** | `packages/core/src/{save,offline}`, `packages/content-kit/src/save` |
| T12 헤드리스 시뮬레이터 | **진행 중** | `tools/sim` |
| T13 확장 팩 증명 | **진행 중** | `content/examples`, `docs/dev/CONTENT_GUIDE.md` |
| 데모 실행기 | **진행 중** | `tools/demo` |

### 아트
- 사용자가 `output/pixel-art-v01/`에 1차 픽셀 아트 패키지를 넣었다(다른 AI 제작, 이미지 8장 + 프롬프트 + 자체 검수 리포트).
- 육안 확인 결과 프레임 간 동일성 흔들림, 반투명 붉은 테두리, 비정수 격자(1254/8), 칸 넘침, 네이티브 픽셀 아님 등이 있다.
- **진행 중**: `docs/art/ASSET_REVIEW_v01.md`(평가), `docs/art/ASSET_ORDERS.md`(다른 AI가 그대로 수행할 작업 카드), `tools/art-check` + `docs/art/assets.manifest.json`(납품물 자동 검사).

## 2 지금 돌고 있는 것

백그라운드 워크플로 2개가 이 세션에 결과를 알려 온다. 완료 알림이 오면 결과를 확인하고 커밋한다.

| 워크플로 | 내용 | 완료 후 할 일 |
| --- | --- | --- |
| `m1-wave5-finish` | T11·T12·T13·데모 + 통합 + 17 §4 단계 2~6 검증 + 수정 | `pnpm check` 확인 → 작업별 커밋 → M1 완료 선언 |
| `art-review-orders` | 스프라이트 검토 → 지시서 → 검사기 → 검증 → 수정 | 지시서 확인 → 커밋 → 사용자에게 전달 |

알림이 오지 않으면 `/workflows`로 진행 상황을 본다.

## 3 이어서 할 일 (순서)

1. **두 워크플로 결과 반영·커밋.** 커밋 메시지는 한국어, 접두사 `karin:`.
2. **데모 확인**: `pnpm demo --fast --minutes 60 --seed 3 --plain`이 예외 없이 돌고 일지가 읽히는지 본다. 사용자가 데모로 테스트할 예정이다.
3. **밸런스 조정 루프**: `pnpm sim --attitude all --seeds 1-100 --out reports/` → `docs/dev/BALANCE_BACKLOG.md`의 범위 밖 지표를 `content/base/balance.json` 수치로 조정(코드가 아니라 데이터). 01 §17 목표 범위가 기준.
4. **M2 화면**: Tauri 2 창(520×64·320×48·480×560), 스프라이트 재생기, 03 문서 구현. **네트워크가 필요하다**(아래 제약).
5. 아트 지시서를 다른 AI에게 넘기고, 납품물은 `pnpm art:check`(tools/art-check)로 받는다.

## 4 제약과 주의

- **npm 레지스트리 403**: 새 패키지를 설치할 수 없다. `pnpm install --offline`으로 로컬 저장소에서만 설치한다. 그래서 테스트는 vitest가 아니라 Node 내장 `node:test`를 쓴다(`docs/dev/IMPL_DECISIONS.md` I01·I02). M2의 Tauri·Rust 크레이트는 네트워크 허용이 필요하다 — 사용자에게 확인받아야 한다.
- **샌드박스 우회 금지**: 이전에 `dangerouslyDisableSandbox` 시도가 거부됐다. 우회하지 말고 대안을 쓰거나 사용자에게 보고한다.
- **코어 규칙**: `packages/core/src`는 DOM·Node API·`Math.random`·`Date`·콘텐츠 ID 문자열 금지(`pnpm lint:ids`가 검사). 수치는 콘텐츠 데이터에서 읽는다.
- **문서가 단일 출처**: 규칙이 바뀌면 소유 문서를 먼저 고치고 `00 §3`에 D 결정으로 남긴다. 구현 세부는 `docs/dev/IMPL_DECISIONS.md`(I 번호).
- **작업 방식**: 큰 작업은 워크플로로 병렬 구현 → 독립 검증 → 수정 순서로 했다. 검증자는 구현에 참여하지 않은 에이전트로 둔다.

## 5 검사 명령

```sh
pnpm install --offline
pnpm check         # typecheck + node:test + lint:ids + content:check + 문서 검사
pnpm sim --help    # 헤드리스 밸런스 시뮬레이터
pnpm demo --help   # 데모 실행기(터미널에서 생애 재생)
```

마지막 확인: 2026-09-23, 커밋 `3f8f533`, 테스트 960개 통과, 콘텐츠·문서 검사 오류 0.
