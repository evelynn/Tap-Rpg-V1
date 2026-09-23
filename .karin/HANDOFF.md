# 인수인계 — 텝 (2026-09-23, 세션 2 종료)

이 문서만 읽으면 이어서 작업할 수 있다. 상세는 `docs/design/00_문서지도.md`와 `docs/dev/*`에 있다.

## 1 지금까지

### 설계
- `docs/design/00~18` 19개 문서. 수치·ID 단일 출처는 `01`, 규칙 소유표는 `00 §2.4`, 설계 결정은 `00 §3`(D01~D62).
- 문서 검사기 `docs/design/tools/lint_docs.py` — 오류 0.

### 개발 (마일스톤 1 — 구현 완료, 확인용 재검증만 남음)
스택은 **Tauri 2 + TypeScript**. M1은 UI 없이 코어·콘텐츠·도구까지다.

| 작업 | 상태 | 위치 |
| --- | --- | --- |
| T1~T10 | 완료 | `packages/core`, `packages/content-kit`, `content/base` |
| T11 저장·오프라인 | 완료 | `packages/core/src/{save,offline}`, `packages/content-kit/src/save` |
| T12 헤드리스 시뮬레이터 | 완료 | `tools/sim` (300생애 약 2분) |
| T13 확장 팩 증명 | 완료 | `content/examples/mist-forest`, `docs/dev/CONTENT_GUIDE.md` |
| 데모 실행기 | 완료 | `tools/demo` |

세션 2에서 한 일: 웨이브 5 통합(시뮬레이터 측정, 도구 연결), 독립 검증 3회와 그 반례 수정.
- 데모 기록 결함: 빈 변수는 이제 예외(I67, 가드 테스트 `journal-text.test.ts`), 날 템플릿, 조사, 요약 카운터, 가문 수첩 발견(D59), 14 §4 묶음, 주요 기록 선별(`journal/select.ts`).
- 저장: 나이 알림·계승 대기 저장(I66), 흡혈귀 갈증 소수(I73), 고유 장비 정의 통일(I75), 저장→불러오기 동등성 테스트.
- 현장 드롭이 가방에 들어가지 않던 결함(I79) — 수정 뒤 수입이 늘어 밸런스 재측정.

### 아트 (제작 방식 전환, D56)
- 그림은 **이미지 생성 모델로 만들고 그대로 낸다**. 코드로 그리거나 고치지 않는다. 규격 맞춤(셀·팔레트·알파)은 M2 에셋 로더가 한다.
- 전달용 프롬프트: `docs/art/PROMPTS.md` 1.1 — 공통 블록, 기준 인물(v03 동작 48 r4), 편집으로 레이어 떼기, P0 진행표 §6.
- 제작물: `assets/_imagegen/v02`, `v03`(저장소 미추적 — 다른 AI 작업 폴더). v03 검토 결과는 PROMPTS §2.2.

## 2 이어서 할 일 (순서)

1. **M1 확인용 재검증**: 구현에 참여하지 않은 검증자가 17 §4 헤드리스 항목·데모·저장 동등성을 다시 보고 반례 0을 확인하면 M1 완료.
2. **아트 v04 검토**: 다른 AI가 PROMPTS 1.1로 만든 결과를 육안 + 겹침 측정으로 본다(측정 스크립트는 아직 도구화 안 됨 — 사용자에게 `art-check` 명령으로 추가할지 물어 둠).
3. **밸런스 조정 루프**: `pnpm sim --attitude all --seeds 1-100 --out reports/` → `docs/dev/BALANCE_BACKLOG.md` 범위 밖 지표를 `content/base/balance.json` 수치로 조정(코드가 아니라 데이터). 드롭 수납 수정 뒤 수입 대비 지출이 세 태도 모두 60% 미만(B03). 레벨 곡선(B04~B06), 태도 역할 구분(B12, R1)이 가장 크다. B14~B20은 설계 확정이 먼저다.
4. **M2 화면**: Tauri 2 창(520×64·320×48·480×560), 스프라이트 재생기, 에셋 로더 정규화(D56). **네트워크 허용이 필요하다.**
5. ASSET_ORDERS 내부 불일치 약 10건(P0/P1 우선순위, 프레임 합계, 팔레트 JSON 정의) — 사용자 결정 대기.

## 3 제약과 주의

- **npm 레지스트리 403**: `pnpm install --offline`만 된다. 테스트는 `node:test`(I01·I02). M2의 Tauri·Rust 크레이트는 사용자 확인이 필요하다.
- **샌드박스 우회 금지**.
- **코어 규칙**: `packages/core/src`는 DOM·Node API·`Math.random`·`Date`·콘텐츠 ID 문자열 금지(`pnpm lint:ids`).
- **문서가 단일 출처**: 규칙이 바뀌면 소유 문서를 먼저 고치고 `00 §3`에 D 결정. 구현 세부는 `docs/dev/IMPL_DECISIONS.md`(I 번호, 마지막 I79).
- **렌더러는 엄격하다**: 템플릿 변수가 비면 예외(I67). 새 문장은 자리별 변수 표(`EVENT_TEXT_VARS`, CONTENT_GUIDE §10)를 따른다.
- **480분 정산 ≤ 2초 테스트**는 기계가 바쁠 때 실패할 수 있다(단독 139~506ms).
- **작업 방식**: 큰 작업은 병렬 구현 → 독립 검증 → 수정. 검증자는 구현에 참여하지 않은 에이전트로 둔다.

## 4 검사 명령

```sh
pnpm install --offline
pnpm check         # typecheck + node:test + lint:ids + 문서 검사 + content:check
pnpm sim --help    # 헤드리스 밸런스 시뮬레이터
pnpm demo --help   # 데모(--fast --plain --auto --gen N --content ...)
pnpm art:check     # 게임 규격 에셋 검사(제작 원본은 inspect)
```

마지막 확인: 2026-09-23, 커밋 `1250727`, 테스트 1051개 통과, 콘텐츠·문서 검사 오류 0.
