# 인수인계 — 텝 (2026-09-25 20:05, 세션 4 종료)

이 문서만 읽으면 이어서 작업할 수 있다. 상세는 `docs/design/00_문서지도.md`와 `docs/dev/*`에 있다.

## 0 다음 세션 첫 순서 (그대로 따라 하면 된다)

1. `git status` — **`tools/art-check` 미커밋 변경**(blocks.ts 새 파일, normalize·strip·pipeline·imagegen-map, normalize.test)은 세션 4 끝에 돌던 "선명 정규화" 에이전트 작업이다. §2-2를 보고 마무리·검증 후 커밋하거나 되돌린다.
2. **기본 창 배치 수정 (사용자 결정 2026-09-25): 풍경 496 + 글자 칸 272, 창은 768×64 그대로.** §2-1.
3. 그다음 §2 순서대로.

`assets/_imagegen/v06/README.md`의 큰 변경과 v06 prompt·gate 파일들은 **codex(다른 터미널)가 만드는 것**이라 그쪽 작업이 끝나면 판정·보관한다(§1 아트).

## 1 지금까지

### 설계
- `docs/design/00~18` 19개 문서. 수치·ID 단일 출처는 `01`, 규칙 소유표는 `00 §2.4`, 설계 결정은 `00 §3`(D01~D75).
- 문서 검사기 `docs/design/tools/lint_docs.py` — 오류 0.
- 세션 3·4 결정: D63(이벤트 장면 20개), D64(48 규격), D65(무기 셀 80×64), D66(도구는 옮기기·자르기·고르기만), D71(배경 품질 기준 v04), D72(장소 × 계절 4 × 시간대 4, 456장), D73(속옷 회청·바지 청록), D74(수치는 합격 그림 실측), **D75(기본 창 768×64, Windows 100% 기준, 그림 1:1·정수배만, 시스템 글꼴 DOM 글자)**.
- **D76 예정(아직 문서에 없음)** — Taskbar Hero 채택 사항(사용자 선택). `docs/research/TBH_분석.md` 참고:
  창 복구 경로(03 §10, 17) · 드롭 순간 보이기(15 §9.2, 03) · 세대 교대 장면(12 §1.3, 14, 18) · 가벼움·무통신 게이트(03, 13, 17) · 판정 주사위 기호 · 상세 창(03 §5: 일지/인물 능력치·장비·가방 20칸/방침/가문).
  하지 말 것: 포커스 뺏는 팝업, 상자 대기열·타이머, 켜 둬야 받는 보상, 현금화 장터, 전투 파티.

### 개발
| 단계 | 상태 | 위치 |
| --- | --- | --- |
| M1 코어·콘텐츠·도구(T1~T14) | 구현 완료, 독립 재검증만 남음 | `packages/core`, `packages/content-kit`, `content/base`, `tools/{sim,demo}` |
| M2 브라우저 시제품 | 진행 중 | `apps/desktop/ui` — `pnpm ui:dev` → http://127.0.0.1:5173 |

M2 시제품이 하는 것: 코어 실행 → 걷기·전투(들쥐·늑대·박쥐·코볼트)·기록 대기열(4초/8초, 최대 5)·동작 연출·이벤트 장면 ES01·ES15·ES18·속도 조절. 콘텐츠 묶음 JSON + esbuild + node:http.
- 배치(cb3f59d): 창 768×64, 풍경 x 0~575, 글자 칸 x 576~767, 주인공 x 72, 적 x 168, 장면 판 x 48~175(판 밖 밝기 50%).
- 표시: 캔버스는 장치 픽셀, 배율 k = max(1, floor(dpr×확대)), 가장 가까운 이웃, 남는 높이는 하늘로. `?scale=`(개발용, 기본 1), `?grid=1`(격자·바둑판 점검).
- 글자: 시스템 UI 글꼴 11px DOM(`src/panel.ts`, `src/layout.ts`). 지금은 이름·상태 / 아이콘 줄 / 기록 최대 2줄 = 최대 4줄 → **§2-1에서 2줄로 바꾼다**.
- 개발용 전역 `tapApp` (예: `tapApp.lines.push({id:1e9,text:'…',grade:'B',eventId:'L09'})`).
- 확인 스크린숏: `reports/ui-768x64/`(gitignore).

### 아트
- **그림은 이미지 생성 모델이 그린다(D56). 코드로 그리거나 고치지 않는다.** 도구는 옮기기·자르기·고르기만(D66).
- 제작은 **다른 터미널 "Tap_rpg"의 codex**가 한다. SendMessage로 닿지 않으므로 **사용자에게 붙여 넣을 지시문**을 준다. codex는 `tools/`·저장소 파일을 고치지 않는다.
- 요청서: `docs/art/V06_REQUEST.md`(467장, 34배치, **연속 진행 모드** — 배치마다 멈추지 않음, 막힌 항목은 건너뜀). 사용자는 배치별 판정 반복을 싫어한다.
- 도구 `tools/art-check`: gate(정규화로 못 고치는 것만 FAIL) · normalize(블록 대표색, scale_to_spec, 띠 fit crop|stretch, tile) · derive(색은 기준 시트에서) · template(29종) · preview · layers.
- 기준: 몬스터 황금 샘플 v03 `08-rat18-48-r3`, 캐릭터 기준 v03 `02-ref-b r4`(v05 청록 계열). 팔레트 기본 52색.
- 개발용 묶음 `assets/ready/`: 캐릭터 시트 5종(동작18·가죽18·11·9·걷기12), 적 4종, 장면 ES01·ES15·ES18, 배경 bg_h1_summer_day. 맵 `docs/art/imagegen.ready.map.json`.
- 합격 원본은 `.gitignore`의 `!` 줄로만 보관(v03 7, v04 6, v05 12, v06 11).

## 2 이어서 할 일 (순서)

1. **글자 칸 272로 넓히기 (D75 개정)** — 풍경 576→496, 글자 칸 x 496~767(272). 목표는 **작은 글자 2줄**: 1줄 = 이름·나이·상태 + 아이콘(12×12) + 표식, 2줄 = 기록 한 줄(28자 ≈ 257px, 칸 안쪽 폭 ≥ 258 필요 — 여백 5px씩이면 262). 28자를 넘는 기록은 없어야 하며 자르지 않는다(넘으면 테스트 실패로 잡을 것). 주인공 x 72·적 x 168·장면 판 x 48~175는 그대로. 고칠 곳: `apps/desktop/ui/src/{layout,panel,render}.ts`, `test/layout.test.ts`, 문서 03 §2·15(§8.1 띠 반복 수, §13 표)·00 D75 행 갱신. 확인: `pnpm ui:build` 후 배율 1 스크린숏에서 2줄·가림 없음 육안 확인.
   - 함께 정리할 남은 520×64 표기: `docs/design/01` §16(화면 수치 소유 문서 — 03과 어긋나 있음), `docs/design/17` §2, `tools/art-check/src/preview.ts`의 `WINDOW`, `docs/art`의 UI 아이콘 16×16 표기(ASSET_ORDERS AO-51~54, PROMPTS `ui_icon_16` → 12×12, 41개).
2. **선명 정규화 마무리** — 목표: 띠·스프라이트를 블록 대표색 뽑기로(면적 평균 금지), 작은 얼룩 섬 제거, 배경색 번짐 제거, `assets/ready` 전부 다시 정규화. 확인: `pnpm check` 통과 + 배율 1에서 번짐 없음(육안). 미커밋 변경이 이 작업이다.
3. **D76 설계 반영** — 위 TBH 채택 항목을 소유 문서에 쓰고 00 §3에 D76.
4. **상세 창 구현**(03 §5) — 브라우저 시제품에 일지/인물(능력치·장비·가방)/방침/가문 탭.
5. **codex 추가 요청** — 전리품 묶음, 반짝임 효과, 판정 주사위 프레임, 부모 손 흔드는 장면(세대 교대), UI 아이콘 12×12 41개. V06_REQUEST에 덧붙이고 사용자에게 붙여 넣을 지시문을 준다.
6. **v06 결과 흡수** — codex 납품분을 gate → normalize → `assets/ready` + 맵 갱신. 장소별 배경·레이어 합성을 UI에 연결.
7. **코어 결함**: 약 330시간 시뮬레이션에서 시드 4개가 `packages/core/src/succession/partner.ts:49` `쓸 수 있는 이름이 없다(name_pool)` 예외로 멈춤 — 이름 목록 고갈로 보임. 재현 테스트 작성 후 수정.
8. **M1 독립 재검증**, **밸런스 조정 루프**(`docs/dev/BALANCE_BACKLOG.md`, 데이터 `content/base/balance.json`).
9. **Tauri 창** — 네트워크 허용이 필요하다(아직 없음).

## 3 제약과 주의

- **npm 레지스트리 403**: `pnpm install --offline`만 된다. 테스트는 `node:test`. esbuild 0.25.9는 오프라인에 있다. Tauri·Rust 크레이트는 사용자 네트워크 허용이 먼저다.
- **샌드박스 우회 금지**.
- **화면**: Windows 100% 기준, 논리 1px = 장치 1px, 모든 픽셀(배경·캐릭터·장면) 1:1 또는 정수배, nearest, `image-rendering: pixelated`. 글자는 픽셀 글꼴이 아닌 일반 시스템 글꼴. 확인 스크린숏은 배율 1.
- **코어 규칙**: `packages/core/src`는 DOM·Node API·`Math.random`·`Date`·콘텐츠 ID 문자열 금지(`pnpm lint:ids`).
- **문서가 단일 출처**: 규칙이 바뀌면 소유 문서를 먼저 고치고 `00 §3`에 D 결정. 구현 세부는 `docs/dev/IMPL_DECISIONS.md`(I 번호, 마지막 약 I79).
- **렌더러는 엄격하다**: 템플릿 변수가 비면 예외(I67).
- **480분 정산 ≤ 2초 테스트**는 CPU 시간으로 잰다.
- **보고 방식**: 진행 중은 한국어 1~2줄, 끝나면 종합 보고 1회.

## 4 검사 명령

```sh
pnpm install --offline
pnpm check         # typecheck + node:test + lint:ids + 문서 검사 + content:check
pnpm ui:dev        # 브라우저 시제품 (127.0.0.1:5173, ?scale=1 ?grid=1)
pnpm sim --help    # 헤드리스 밸런스 시뮬레이터
pnpm demo --help
pnpm art:gate      # 납품 문, art:normalize / art:preview / art:template
```

마지막 확인: 2026-09-25, 커밋 `cb3f59d` — UI 테스트 33개 통과, 문서 검사 오류 0. 전체 `pnpm check`는 레이아웃 에이전트 기준 1165개 통과(tools/art-check 미커밋 변경 제외 상태에서).
