# 구조와 확장 지점 (ARCHITECTURE)

코드가 어디에 있고, 새 콘텐츠·새 메커니즘을 어디에 더하는지 한 장으로 정리한다. 필드와 검증 규칙의 상세는 [CONTENT_SCHEMA.md](CONTENT_SCHEMA.md), 구현 결정은 [IMPL_DECISIONS.md](IMPL_DECISIONS.md)가 기준이다.

## 1 패키지

| 경로 | 역할 | 제약 |
| --- | --- | --- |
| `packages/core` (`@tap/core`) | 스키마·등록부, 결정적 난수, 생애 시계, 문장 템플릿, 콘텐츠 조회, 저장 상태, 규칙, 일지, 시뮬레이션 세계 | 순수 TS. DOM·Node API 금지(`types: []`, I03). `Math.random`·`Date` 금지(I19). 문자열에 콘텐츠 ID 금지(I04). 둘 다 `pnpm lint:ids`가 검사 |
| `packages/content-kit` (`@tap/content-kit`) | 팩 찾기·읽기·패치·검증·번들, CLI | Node 도구. 코어는 `src/core.ts`를 거쳐 가져온다 |
| `tools/sim` | 헤드리스 시뮬레이터(T12) | 팩이 아니라 번들을 읽는다 |
| `content/<팩>` | 데이터 팩. 기반 팩은 `content/base` | 코드가 없다 |

코어 안:

| 경로 | 내용 |
| --- | --- |
| `src/schema/common.ts` | 공통 타입, 조건·수정자·효과 골격, 등록부 클래스(`ParamRegistry`·`PatternRegistry`·`NameRegistry`) |
| `src/schema/world` · `entity` · `event` | 종류별 스키마(W2·W3·W4)와 기본 등록. `event`를 불러오면 조건·효과 기본 등록이 실행된다 |
| `src/rng` | PCG32, 흐름 5개(`combat` `loot` `event` `life` `world`), SHA-256(I05~I07) |
| `src/time` | 나이·계절·생애 단계(I10) |
| `src/text` | `renderTemplate`, `extractTemplateVars`, 조사 판정(I09) |
| `src/content` | `Content` 조회기(번들 defs → 종류·ID, 스키마 기본값 채움). `CONTENT_BUNDLE_FORMAT`은 content-kit `BUNDLE_FORMAT`의 단일 출처 |
| `src/state` | 저장 상태 스키마(16 §5, CONTENT_SCHEMA §6 C1~C29), uid 발급기 |
| `src/rules` | 규칙 층: 수정자 집계(`collectModSources`), 유도 수치, 판정, 성장·노화, 출생, 적 수치(`enemyStats`, V17과 같은 구현) |
| `src/journal` | 일지 기록 생성과 보존(14 §1~§2, 13 §9) |
| `src/sim` | `World`(콘텐츠 + 저장 + 난수 흐름 5개), 행동 골격(13 §8.1·§8.3), 새 가문 생성 |
| `src/index.ts` | 공개 진입점. 위 전부를 내보낸다(이름 충돌 처리는 I08) |

## 2 데이터 흐름

```text
content/<팩>/*.json
  └─ content-kit: 찾기 → 순서(requires) → 읽기 → 색인 → 패치 → 스키마(S01) → 참조·의미(V)
       └─ 번들 {format, packs, content_hash, defs}
            └─ 시뮬레이터(T12)·게임 창(M2)이 읽어 코어 규칙 엔진에 넘긴다
```

- 코어는 파일 시스템을 모른다. 게임과 시뮬레이터는 번들만 읽는다(CONTENT_SCHEMA §2.4).
- 규칙 수치는 코드가 아니라 `balance`에서 읽는다. 규칙은 콘텐츠 ID가 아니라 데이터 속성(`tags`, `patrol_zone`, `dungeon.group` …)을 본다.
- 결정성: 같은 저장과 같은 번들이면 같은 결과다. 난수는 용도별 흐름에서만 뽑는다(13 §8.3, I07).

## 3 확장 지점

| 하고 싶은 것 | 어디에 | 코어 수정 |
| --- | --- | --- |
| 지역·적·장비·사건·연속 사건·문형 추가 | 새 팩 폴더(`pack.json` + 종류 폴더). 기반 정의는 ID로 가리키고, 새 지역은 `unlock` 조건으로 세계에 잇는다(CONTENT_SCHEMA §1.5 작성 규칙) | 없음 |
| 기존 정의의 값 바꾸기 | 팩의 `patches/*.json` — `merge`(RFC 7386) 하나. 객체는 재귀 병합, `null`은 키 삭제, 배열은 통째 교체. 사건 끄기는 `{"condition": false}` | 없음 |
| 새 조건·효과·수정자 target 등 새 메커니즘 | 아래 등록부에 **한 번** 등록 + 규칙 층 핸들러 맵에 같은 이름으로 1개. 이후는 데이터로만 쓴다 | 등록 1곳 + 핸들러 1곳 |
| 새 행동 종류의 결과(사냥 조우·던전 방·마을 대기 …) | `registerActionResolver(kind, {resolve, apply})`(`sim/world.ts`). `resolve`는 난수만 굴려 결과를 확정하고 `apply`가 상태를 바꾼다. 다음 행동은 `WorldOptions.decide`, 나이 변화는 `WorldOptions.onAge` | 해석기 1곳 |
| 새 수정자 출처 | `rules/modifiers.ts`의 `collectModSources` 한 곳(+ `ModSourceKind`) | 1곳 |

등록부(첫 검증에 쓰일 때 잠긴다. 확장 코드는 번들을 읽기 전에 등록한다):

| 등록부 | 등록 함수 | 기본 등록 위치 | 핸들러 맵(규칙 층) |
| --- | --- | --- | --- |
| 조건 단말 `conditions` | `registerCondition` | `schema/event/conditions.ts` | `CONDITION_EVAL` |
| 효과 `effects` | `registerEffect` | `schema/event/effects.ts` | `EFFECT_HANDLERS` |
| 수정자 target `modifierTargets` | `registerModifierTarget` | `schema/common.ts` | (수정자 합산) |
| num 키 `numKeys`, 카운터 `counterNames` | `numKeys.register`, `registerCounter` | `schema/common.ts` | |
| 적 특수능력 `enemySpecials` | `registerEnemySpecial` | `schema/world/specials.ts` | `ENEMY_SPECIAL_HANDLERS` |
| 사건 변수 선택자 `contextSelectors` | `registerContextSelector` | `schema/event/context.ts` | `SELECTOR_HANDLERS` |
| 템플릿 변수 `templateVars` | `registerTemplateVar` | `schema/event/template-vars.ts` | (엔진이 값을 채움) |
| 특성 행동 훅 `traitHooks` | `registerTraitHook` | `schema/entity/trait-hooks.ts` | `TRAIT_HOOK_READERS` |
| 코어 문형 슬롯 `textSlots` | `registerTextSlot` | (규칙 층이 필요할 때) | 번들 `text`에 없으면 V2 |

- 규칙 층을 만들 때 핸들러 맵과 등록부 이름이 양쪽으로 같은지 테스트 1개로 검사한다(CONTENT_SCHEMA §4 실행 핸들러 계약). 빠진 핸들러는 CI에서 잡힌다.
- 오래 남는 상태를 만드는 효과는 저장 스키마(CONTENT_SCHEMA §6)도 함께 고친다.

규칙 층 규약(여러 태스크가 같은 방식을 쓴다):

- **아직 모으지 않는 수정자 출처 3종**. 담당 태스크가 `collectModSources`에 더한다. 그 전까지 데이터에 적어도 효과가 없다.
  - region `discoveries[].modifiers`: `character.discoveries`의 발견 지점, 생애 동안(장소 제한은 `when`). T7
  - `retire_role.heir_modifiers`: `family.retirees`의 역할, 후계자 나이 `visible_until_heir_age` 전까지. T10
  - `balance.adventure.map.complete_modifiers`: 한 경로의 `map_fragments`를 모두 모은 경우, 그 경로에만(07 §6.4). T7
- **일시 수정자 scope**: `next_sortie`·`next_scene`·`next_visit`는 대기라 집계에서 빠진다. 그 출정·장면·방문을 시작하는 규칙이 scope를 `sortie`·`scene`으로 바꿔 켠다. `eff_min`은 `expires_eff_min`이 지나면 빠진다. `next_check`·`next_decision`·`encounters`는 켜진 채로 두고 쓰는 쪽이 `remaining`을 줄이거나 지운다.
- **조건 평가 범위**(전투 종류 `combat_kind`, `{place}` 바인딩): `RuleContext.test`는 `(cond) => boolean` 하나다. 범위가 필요한 계산은 평가기를 만드는 쪽이 범위를 클로저로 묶은 test를 만들고 `{ content, state, test }`로 넘긴다. RuleContext에 범위 필드를 두지 않는다.
- **저장 record 순회 순서**: 키 삽입 순서에 기대지 않는다(장착은 `SLOTS` 순서, 출정 플래그는 키 정렬). 불러온 저장의 키 순서가 달라도 set 수정자의 마지막 값과 판정 기록 항 순서가 같아야 한다.
- **행동**: 결정기는 행동과 행동 사이에만 불린다. 할 일이 없을 때의 대기도 길이가 정해진 행동이다. 0초 행동은 허용하지만 한 `advance`에서 1000번 넘게 이어지면 예외다. 행동 시작·적용 직후 `state.rng_state`가 난수 상태와 맞는다.

## 4 검증

| 단계 | 코드 | 위치 |
| --- | --- | --- |
| 팩 | P01·P03~P09 | `content-kit/src/pack/*` |
| 스키마 | S01. 스키마 refine이 규칙 번호를 붙인 이슈(V3·V4·V7·V8·V10·V13·V14 등)는 그 번호로 보고한다 | `content-kit/src/validate/kind-schemas.ts` → 코어 스키마 |
| 참조·의미 | V1·V2·V3·V4·V5·V6·V9·V11·V12·V15·V17·V19·V20, tier 상한 | `content-kit/src/validate/refs.ts`(워커), `rules.ts` (I13~I16) |

오류가 하나라도 있으면 번들을 만들지 않는다. 경고(P09·V9·V17·파생 플래그 중복·빈 배열 파일)는 `--strict`에서만 실패한다.

## 5 명령

```sh
pnpm check           # 타입 검사 + 테스트 + 코어 ID 검사 + 설계 문서 검사 + 기반 팩 검사
pnpm content:check   # content/base 검사(오류 0이면 종료 코드 0)
pnpm content:schema  # 종류별 JSON Schema를 content/schemas에 쓴다(편집기 보조, I11)
pnpm exec tsx packages/content-kit/src/cli.ts check content --strict --json   # content/ 아래 팩 전부, 경고도 실패, JSON 출력
```
