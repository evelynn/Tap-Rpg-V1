# 콘텐츠 팩 형식과 스키마 (CONTENT_SCHEMA)

버전 0.2(T2 설계 확정, 검토 반영) · 작성일 2026년 9월 22일 · 근거 문서 `docs/design/16_데이터_구조_명세.md`(데이터 형식 소유), 00 §2.2·§2.4, 01, 04, 05, 06, 07, 08, 09, 10, 11, 12

검토에서 받아들이지 않은 지적과 그 이유는 문서 끝 「검토 기각」에 적는다.

이 문서는 16의 데이터 형식을 **확장 가능한 콘텐츠 팩**으로 옮기는 구현 설계다. 목표는 두 가지다.

1. 시나리오·사건·지역·적·장비를 **코어 코드 수정 없이** 데이터 팩으로 더한다.
2. 새 메커니즘은 코어 **등록부**(조건·효과·수정자 target·적 특수능력·변수 선택자)에 한 번 등록하면 이후 데이터로만 쓴다.

읽는 법:

- 규칙 수치의 출처는 계속 01(수치)·담당 문서(절차)다. 이 문서는 **키 이름, 모양, 검증 방식**만 정한다. 예시 값은 01·07·10·08의 값을 옮긴 것이다.
- `신설` 표시는 16에 없던 필드·종류·키다. 16을 고치는 조율자가 16에 반영한다. 게임 규칙 자체를 바꾸는 것은 **8절 결정 후보(DS-번호)**로만 표시하고 여기서 확정하지 않는다(IMPL_DECISIONS.md 머리말 원칙).
- 코드 이름은 `packages/core/src/schema/common.ts`(공통 골격, 작성 완료)와 9절 분담표를 따른다.

---

## 1 팩 구조

### 1.1 디렉터리

```text
content/
  base/                         # 기반 팩(첫 검증판 콘텐츠 전부)
    pack.json
    balance.json                # singleton
    flags.json                  # 플래그 등록표(16 §5.2)
    attitudes/*.json
    regions/*.json
    enemy_families/*.json
    enemies/*.json
    materials/*.json
    traps/*.json
    guild_ranks/*.json
    items/*.json
    item_effects/*.json
    consumables/*.json
    traits/*.json
    npcs/*.json
    names/*.json
    backgrounds/*.json
    achievements/*.json
    epithets/*.json
    retire_roles/*.json
    descendant_reactions/*.json
    props/*.json
    chains/<CHAIN_ID>.json      # 줄기 정의 1개
    events/life/<EVENT_ID>.json # 사건 1개 = 파일 1개
    events/chain/<EVENT_ID>.json
    events/fate/<EVENT_ID>.json
    events/system/<EVENT_ID>.json
    text/*.json                 # 일상 기록 문형(14)
  winter_fest/                  # 예: 확장 팩
    pack.json
    events/life/WF_L01.json
    regions/wf_square.json
    patches/010_town.json
```

### 1.2 pack.json

| 필드 | 형식 | 필수 | 설명 | 예 |
| --- | --- | --- | --- | --- |
| `id` | string `^[a-z][a-z0-9_]*$` | O | 팩 ID. 전체에서 고유 | `"base"` |
| `name` | string | O | 표시 이름 | `"여울과 폐광"` |
| `version` | string | O | 팩 버전. 비교하지 않고 번들·저장 머리에 기록만 한다(2.4) | `"0.1.0"` |
| `requires` | string[] | O | 먼저 로드할 팩 id. 기반 팩은 `[]` | `["base"]` |
| `_note` / `_comment` | string | - | 설명 | |

- 버전 범위·엔진 범위·팩 정책은 두지 않는다. 호환 검사는 번들의 `format` 정수 하나로 한다(2.4). 쓰는 곳이 생기면 그때 더한다.
- `risk: lethal` 선택지는 첫 검증판에서 모든 팩에 금지다(D26, V10).

```json
{ "id": "winter_fest", "name": "겨울 축제", "version": "0.1.0", "requires": ["base"] }
```

### 1.3 종류(kind) 목록과 경로

종류 이름과 위치는 `common.ts`의 `CONTENT_KINDS`가 코드 기준이다(`{dir}` = 폴더, `{file}` = 팩 루트 파일 하나). `ID 관례`는 00 §2.2 접두 규칙을 옮긴 **작성 안내**이며 검사하지 않는다. 확장 팩은 팩 고유 접두(`wf_`, `WF_`)를 권장한다. ID 형식 정규식(3절)과 중복(P06)만 검사한다.

| kind | 경로 | 모양 | ID 관례(안내) | 16 절 | 담당 |
| --- | --- | --- | --- | --- | --- |
| `balance` | `balance.json` | singleton, id `balance` 고정 | — | §2.1 | W2 |
| `attitude` | `attitudes/` | | `stable` 등 snake_case | §2.2 | W2 |
| `region` | `regions/` | kind별 판별 유니온 | `T00`, `H#`, `D#`, `A#` | §2.3 | W2 |
| `enemy_family` 신설 | `enemy_families/` | | snake_case(`wolf`) | §2.4 `family` | W2 |
| `enemy` | `enemies/` | | `EN##`, `EB##` | §2.4 | W2 |
| `material` | `materials/` | | `mat_{출처}` | §2.6.1 | W2 |
| `trap` 신설 | `traps/` | | `trap_*` | 07 §5.3 | W2 |
| `guild_rank` 신설 | `guild_ranks/` | | snake_case(`silver`) | §6.7 | W2 |
| `item` | `items/` | | `W##` `A##` `J##` `R##` | §2.5 | W3 |
| `item_effect` 신설 | `item_effects/` | | `E##`, `X##` | 08 §3.6~3.7 | W3 |
| `consumable` | `consumables/` | | `CP##` | §2.6 | W3 |
| `trait` | `traits/` | | `TI##` `TA##` `TM##` | §2.7 | W3 |
| `npc` | `npcs/` | | `N##` | §2.8 | W3 |
| `name_pool` | `names/` | | snake_case | §2.9 | W3 |
| `background` 신설 | `backgrounds/` | | `bg_*` | 12 §8.1 | W3 |
| `achievement` 신설 | `achievements/` | | `AC##` | 12 §8.4 | W3 |
| `epithet` 신설 | `epithets/` | | `ep_*` | 12 §7.5 | W3 |
| `retire_role` 신설 | `retire_roles/` | | snake_case(`inn`) | 09 §4.1 | W3 |
| `descendant_reaction` 신설 | `descendant_reactions/` | | `dr_*` | 12 §7.6 | W3 |
| `prop` 신설 | `props/` | | snake_case(`book`) | 15 소품 | W3 |
| `flag` | `flags.json` | 등록표 1파일(배열). id는 `def()`가 아니라 플래그 키 패턴(`flagKey`) | 플래그 전체 키 | §5.2 | W4 |
| `chain` 신설 | `chains/` | 줄기 1개 = 파일 1개 | `C##` (형식 `^[A-Z][A-Z0-9_]*$` 강제, 5.9) | 10 §7 | W4 |
| `event` | `events/{category}/` | 사건 1개 = 파일 1개 | `L##` `C##-#` `F##` `S##` | §4 | W4 |
| `text` | `text/` | id는 `def()`가 아니라 문형 id 패턴(5.11) | `journal.*` 점 구분 소문자 | §1.1 text | W4 |

중첩 이름공간(파일로 따로 두지 않지만 참조 대상, `NESTED_REF_KINDS`): `discovery`(region `discoveries[]`), `map_fragment`(region `map_fragments[]`), `facility`(town `facilities[].id`), `dungeon_group`(dungeon_floor `dungeon.group` 값), `check_kind`(`balance.check_kinds` 키), `drop_table`(`balance.economy.drops` 키), `rescuer_table`(`balance.defeat.rescuers` 키), `rescuer`(`balance.defeat.rescuer_lines` 키), `carry_group`(`balance.economy.carry_limits` 키), `thirst_stage`(`trait.mutation.thirst.stages[].id`). 이들도 종류별로 고유해야 하며 V2 참조 검사를 받는다. 사건 안 선택지 id, 줄기의 outcome처럼 한 정의 안에서만 뜻이 있는 이름은 이름공간이 아니라 W1 교차 검사로 본다.

### 1.4 파일 규칙

- UTF-8 JSON. 파일 하나 = 정의 **객체 1개** 또는 **객체 배열**. 빈 배열은 경고.
- `events/`와 `chains/`는 **파일 하나 = 정의 1개**만 허용한다(배열이면 P05 오류). 파일 이름(확장자 제외)이 `id`와 같아야 하고, `events/{category}/`의 폴더와 `category` 필드가 같아야 한다(P05).
- `flags.json`은 배열 하나. 여러 팩이 각자 `flags.json`을 가진다(같은 키 중복은 P06).
- 경로가 1.3 표에 없는 `.json`은 P05 오류. `patches/`는 1.5절.
- 폴더 아래 하위 폴더는 자유롭게 쓴다(`regions/mine/d1.json`). `events/`만 첫 단계가 분류다.
- **에셋**: M2(게임 창) 전까지 팩은 기반 팩의 에셋 id(`background_id`, `sprite_family`, `palette_id`, `prop.asset_id`)만 다시 쓴다. 팩 고유 그림이 필요해지면 팩에 `assets/` 폴더를 두고 W1이 id 존재를 경고 수준으로 검사하는 규칙을 그때 더한다.

### 1.5 패치

`patches/*.json` — 패치 연산 배열. 연산은 `merge` 하나뿐이다.

```json
[
  { "target": { "kind": "region", "id": "T00" }, "op": "merge",
    "value": { "tags": ["festival"] } },
  { "target": { "kind": "event", "id": "L11" }, "op": "merge",
    "value": { "weight": 8 } },
  { "target": { "kind": "balance", "id": "balance" }, "op": "merge",
    "value": { "events": { "trigger_chance": { "town_return": 0.45 } } } },
  { "target": { "kind": "event", "id": "L03" }, "op": "merge",
    "value": { "condition": false } }
]
```

| op | 뜻 | value |
| --- | --- | --- |
| `merge` | RFC 7386 JSON Merge Patch. 객체는 재귀 병합, `null`은 키 삭제, **배열은 통째로 교체** | 부분 객체(필수) |

- 정의 전체 교체는 최상위 키를 모두 적은 `merge`로, 사건 끄기는 `{"condition": false}`로 한다. 정의 삭제 연산은 두지 않는다(남은 참조가 깨지므로).
- 새 정의를 더할 때는 패치가 아니라 **종류 폴더에 파일**을 둔다. 다른 팩이 이미 정의한 `(kind, id)`를 다시 정의하면 P06 오류다(패치를 써야 한다).
- 적용 순서: 팩 로드 순서(2.1) → 팩 안에서 `patches/` 파일 경로 사전순 → 파일 안 배열 순서. 번호 접두(`010_`, `020_`)를 권장한다.
- 대상이 없거나 op가 `merge`가 아니면 P07 오류.
- 패치 결과는 **다시 스키마 검증**한다(S01·V 전부). 패치 파일 자체는 패치 연산 스키마로만 검사한다.
- 배열 필드(예: `encounters`, `choices`)의 일부만 바꾸는 연산은 두지 않는다. 배열은 통째로 바꾼다(DS-24).
- **P09 경고**: 서로 다른 두 팩이 같은 `(kind, id, 최상위 키)`를 `merge`하면 경고한다(나중 팩이 앞 팩 값을 조용히 덮어쓰는 것을 드러낸다).

**작성 규칙 — 기반 정의를 패치하지 않고 잇는다.** 기반 배열을 확장 팩에 복사해 두면 기반이 바뀌어도 옛 값으로 덮어쓰게 된다. 새 콘텐츠는 새 팩 쪽에서 기반을 가리킨다.

| 하고 싶은 것 | 패치 대신 |
| --- | --- |
| 새 지역을 기존 세계에 연결 | 새 지역의 `unlock` 조건(`{"discovery_found": …}`, `{"level_gte": …}`)으로 연결 |
| 새 지역에서도 기반 생활 사건이 나오게 | 기반 사건이 `locations` ID 나열 대신 `location_match {kinds, tags}`를 쓰게 작성한다(여러 장소 공통 생활 사건의 기본 작성법). 새 지역은 맞는 `kind`·`tags`만 가지면 된다 |
| 새 장비를 상점에 진열 | 장비 파일의 `shop`(5.5). 시설 정의는 건드리지 않는다 |
| 기존 사건 가중치를 새 발견·장비로 올림 | 새 정의의 `event_weight_mult`(record) |

---

## 2 로드와 병합

### 2.1 로드 순서

1. 로드 대상 팩의 `pack.json`을 읽고 스키마 검사(P01).
2. `requires`의 팩이 로드 대상에 있는지(P03).
3. `requires` 위상 정렬(깊이 우선). 순환이면 P04. 서로 의존이 없는 팩은 `id` 사전순.
4. 팩 순서대로 정의 파일을 읽어 `(kind, id)` 색인에 넣는다. 중복은 P06.
5. 모든 팩을 읽은 뒤 팩 순서대로 패치를 적용한다(1.5).
6. 스키마 검증(S01) → 참조 무결성(V2) → 의미 검사(V 나머지). 오류가 하나라도 있으면 번들을 만들지 않는다.
7. 번들 출력(2.4).

- 로드 대상 팩은 CLI 위치 인자(`check <팩 경로...>`)로만 정한다. 경로가 팩 폴더가 아니면 바로 아래 팩 폴더들을 읽는다(`check content`). 인자가 없으면 P01 "로드할 팩이 없다" 오류다. 목록 파일은 두지 않는다(I11).
- 결정성: 같은 입력이면 번들 바이트가 같아야 한다. 파일 순회는 경로 사전순, 객체 키 순서는 원본 유지.

### 2.2 이름공간

- ID는 **종류별 이름공간**이다. 장소 `A1`과 방어구 `A01`, 그리고 확장 팩 장소 `A10`과 방어구 `A10`은 서로 다른 정의다(DS-01).
- 같은 종류 안의 중복은 팩이 달라도 오류다(P06).
- 참조 필드는 스키마가 기대 종류를 선언한다(`ref("region")`). 로더는 선언된 종류의 색인에서만 찾는다.
- 저장 파일(16 §5)은 이미 필드마다 종류가 정해져 있으므로(예: `location_id`, `def_id`) 이름공간 변경의 영향이 없다. 단 `family.codex.items`처럼 종류가 섞일 수 있는 곳은 종류별 키로 나뉘어 있다.

### 2.3 알 수 없는 필드

- 정적 데이터는 **strict**: 스키마에 없는 필드는 S01 오류다. `common.ts`의 `obj()`/`def()`가 `z.strictObject`를 쓴다.
- 예외: 모든 객체에 `_note`, `_comment`(string)를 허용한다. 16 예시의 `note` 필드(적 `specials`, NPC `successors`)는 `_note`로 바꾼다(DS-03).
- 패치 `merge` 결과도 같은 규칙을 적용한다.

### 2.4 번들

W1 `validateContent`가 만드는 게임용 단일 파일(번들 파일을 쓰는 CLI 명령은 아직 없다, I11). 게임 창(M2)과 시뮬레이터는 팩을 직접 읽지 않고 번들을 읽는다(코어는 파일 시스템을 모른다).

```json
{
  "format": 1,
  "packs": [ { "id": "base", "version": "0.1.0" }, { "id": "winter_fest", "version": "0.1.0" } ],
  "content_hash": "sha256 16진(defs의 정규 JSON)",
  "defs": {
    "balance": { "balance": { "...": "..." } },
    "region": { "T00": { "...": "..." }, "H1": { "...": "..." } },
    "event": { "L01": { "...": "..." } }
  }
}
```

- `format`은 번들 형식 번호다. 코어가 읽을 수 있는 형식과 다르면 번들을 거부한다. 번들 모양을 호환되지 않게 바꿀 때만 올린다.
- `packs`와 `content_hash`는 저장 파일 머리에 사본으로 남겨(T11 몫) 콘텐츠가 바뀐 저장을 알아본다(13 §8.7 이전 함수와 연결). 신설 저장 필드 `header.content_packs`, `header.content_hash`(6절 C1).

---

## 3 공통 타입 (`schema/common.ts`)

| 코드 이름 | 형식 | 16 대응 | 비고 |
| --- | --- | --- | --- |
| `id` | `^[A-Za-z][A-Za-z0-9_]*(-[A-Za-z0-9_]+)*$` | `id` | 접두 관례는 검사 안 함 |
| `ref(kind)` | id + 기대 종류 표식(`refRegistry`) | ID 참조 | `refKindOf(schema)`로 읽음 |
| `flagKey(scope?)` | `범위.snake_case` + 선택 꼬리 `_ID`(밑줄·하이픈 허용) 또는 `_{변수}`(3.1) + ref(`flag`) | `flag_key` | scope 주면 그 접두만 |
| `int` `nonNegInt` `posInt` | 정수 | `int` | |
| `ratio` | 0~1 | `ratio` | **퍼센트·%p 값은 모두 ratio로 쓴다**(0.10 = 10%, 10%p). 16의 `pct_point`는 폐기 |
| `tier` | `posInt` | `tier` | 상한은 `balance.economy.tier_levels` 길이(W1) |
| `effMin` | ≥0 실수 | `eff_min` | |
| `units` | ≥0 실수 | `units` | |
| `weight` / `weightTable(keys)` | ≥0 / 일부 키만 있는 가중치 표 | | `z.partialRecord` |
| `range` / `numRange` | `[최소, 최대]` 정수 / 실수, 최소 ≤ 최대 | `range` | |
| `dice` | `NdM+K` (`2d6+1`, `1d4`, `3d8-2`) | `damage.dice` | 신설 문법 |
| `template` | 문법·조사 쌍은 렌더러 파서(`text/template.ts`)가 단일 출처, 스키마는 변수 이름 snake_case를 더 본다 | `template` | 문법 오류는 V5. 변수 등록표 V5는 W1 |
| `line` | template + 한 줄 표식(`{line: true}`) | 한 줄 기록 | V6 대상. 최대 길이는 `balance.ui.line_max`를 W1이 읽는다(스키마에 28을 두지 않음) |
| `obj(shape)` / `def(shape)` | strict + `_note`·`_comment` / + 필수 `id` | | flag·text 정의는 `def()` 대신 각자의 id 패턴 |
| `condition` | 4.1 문법, 단말은 `conditions` 등록부 | `condition` | 4.1 |
| `regionFilter` | `{ids?, kinds?, tags?, dungeon_group?, dungeon_depth_gte?}` 하나 이상, 배열은 1개 이상 | 신설 | 키끼리 AND, `tags`는 하나라도 가지면 참. `dungeon_group`은 ref(`dungeon_group`) |
| `modifier` | `{target, op, value, when?}`, target은 `modifierTargets` | `modifier` | 4.3 |
| `effect` / `effectList` | `type` 판별 유니온(이슈는 V4로 감싼다), 모든 효과에 `when?` | `effect` | 4.4 |
| 열거형 | `STATS` `SKILLS` `ACTIVITIES` `ACTIVITY_RISKS` `SLOTS` `GRADES` `LIFE_STAGES` `ACTIVITY_STATES` `SPECIALIZATIONS` `MUTATIONS` `INJURY_GRADES` `END_KINDS` `FAMILY_ROLES` `JOURNAL_TAGS` `JOURNAL_IMPORTANCE` `EVENT_TRIGGERS` `EVENT_CATEGORIES` `HOLD_KINDS` `TIME_OF_DAY` `SEASONS` `WEATHERS` `REGION_KINDS` `ROOM_KINDS` `SCENE_KINDS` `ENEMY_RANKS` `CHOICE_TAGS` `CHOICE_RISKS` `OUTCOME_KEYS` `ANIMATION_ACTIONS` | §6 | |

**열거형에서 데이터 종류로 옮긴 것**(ref로 참조, DS-04): `guild_rank`(16 §6.7), `background`(§6.8), `retire_role`(§6.8), 적 `family`(§2.4 → `enemy_family`), `check.kind`(§6.13 → `check_kind` = balance 키), `attitude`(§6.3 → `attitude` 종류). 코드가 뜻을 직접 아는 열거(능력치, 숙련, 활동, 슬롯, 등급, 행동 상태, 판단 지점, 선택지 태그 등)는 코드 열거로 남긴다. `specialization`·`mutation`은 첫 검증판에서 코드 열거로 두고 확장 후보로 남긴다(DS-30).

**`animation.action`**(DS-09): 01 §18.4의 한국어 이름 대신 영어 키. `idle`(대기) `walk`(걷기) `attack`(공격) `hit`(피격) `discover`(발견) `sit_eat`(앉기와 식사) `sleep`(잠) `interact`(상호작용) `cheer`(환호) `collapse`(쓰러짐).

### 3.1 자리 바인딩 `{변수}` (신설)

키 묶음 플래그(16 §5.2 `life.l01_marked_{place}`)와 장소 자리를 가진 수정자 target·num 키는 **평가 시점의 장소**를 가리켜야 한다. 데이터에는 ID 대신 바인딩을 적고, 엔진이 효과를 적용하거나 조건을 평가할 때 장소 ID로 바꾼다. 문법은 문장 템플릿의 변수 표기와 같다(`BINDING_PATTERN = ^\{[a-z][a-z0-9_]*\}$`).

| 바인딩 | 뜻 |
| --- | --- |
| `{place}` | 평가 문맥의 장소: 출정 중이면 현재 장소, 사건이면 그 사건이 일어난 장소, 사망 기록이면 사망 장소. 16 §1.4.3 템플릿 변수 `{place}`와 같은 값 |
| `{그 밖의 이름}` | 그 사건 `context_vars`(4.5)의 **장소를 채우는 변수**(`{rumor_place}`, `{target_place}`). 사건 정의 안에서만 쓸 수 있다 |

쓸 수 있는 자리(이 밖에는 쓰지 않는다):

| 자리 | 예 | 코드 |
| --- | --- | --- |
| 플래그 키 꼬리 `_{변수}` — `flag` 조건, num `flag.` 키, `set_flag`·`clear_flag`·`set_family_flag`·`set_trip_flag`·`clear_trip_flag` | `life.l01_marked_{place}` | `flagKey`(FLAG_BODY) |
| `{region}` slot — 수정자 target, num 키 | `location_score.{rumor_place}`, `counter.safe_returns.{place}` | `PatternRegistry.match`(region slot만) |
| 장소를 받는 효과 파라미터 — `temp_mod.location`, `dungeon_mod.location`, `counter_add.where` | `"location": "{place}"` | W4 파라미터 스키마 |

- 저장되는 값은 언제나 치환된 키다(`life.l01_marked_H1`). 등록표(5.8)의 키 묶음 자리 이름은 16과 같게 `{place}`·`{kind}`·`{role}`로 쓰고, 등록표 자리는 바인딩과 모양이 같다.
- 검사: 바인딩 변수 이름이 `place`이거나 그 사건의 장소 변수인지(V19, W1). V2 참조 검사는 바인딩 값을 건너뛴다.
- L01 `돌탑을 쌓아 둔다`를 이렇게 적는다.

```text
돌탑 결과     "effects": [ { "type": "set_flag", "key": "life.l01_marked_{place}" } ]
사건 가중     "weight_mods": [ { "when": { "flag": "life.l01_marked_{place}" }, "mult": 3 } ]
채집 판정     "situational": [ { "target": "check.all", "op": "add", "value": 2, "when": { "flag": "life.l01_marked_{place}" } } ]
다른 결과 전부 { "type": "clear_flag", "key": "life.l01_marked_{place}", "when": { "flag": "life.l01_marked_{place}" } }  // 표식을 쓴 L01에서 지움
```

L08 금지 플래그는 `"condition": {"not": {"flag": "life.l08_repaired_{place}"}}`, L05 `{rumor_place}` 다음 방문 발견 ×2는 `temp_mod {modifier: {target: "discovery_chance_mult", op: "mul", value: 2}, scope: "next_visit", location: "{rumor_place}"}`, 활동 가중 +15(1회)는 `temp_mod {modifier: {target: "location_score.{rumor_place}", op: "add", value: 15}, scope: "next_decision"}`로 적는다.

---

## 4 등록부 (코드가 뜻을 아는 이름)

모든 등록부는 **처음 검증에 쓰일 때 잠기고**, 잠긴 뒤 등록·이름 중복·예약어(`all` `any` `not` `num`, `type` `when`)는 즉시 예외다. 확장 코드는 번들 로드 전에 `registerCondition` / `registerEffect` / `registerModifierTarget` / `registerCounter` 등을 호출한다. 잠기는 시점(구현 기준):

| 등록부 | 잠기는 때 |
| --- | --- |
| `conditions` `numKeys` `counterNames` | `condition` 스키마 첫 평가(`z.lazy`). `counterNames`는 `effect` 첫 평가에서도 |
| `effects` | `effect` 스키마 첫 평가(`z.lazy`, 판별 유니온을 이때 만든다) |
| `modifierTargets` | `modifier` 첫 검증(superRefine 첫 줄) |
| W2~W4 새 등록부 | 같은 규칙: 그 등록부를 읽는 스키마의 첫 평가에서 `lock()` |

| 등록부 | 인스턴스 | 등록 함수 | 기본 등록 위치 |
| --- | --- | --- | --- |
| 조건 단말 | `conditions` | `registerCondition(name, paramSchema, doc)` | `schema/event/conditions.ts`(W4) |
| 효과 | `effects` | `registerEffect(name, paramShape, doc, check?)` | `schema/event/effects.ts`(W4) |
| 수정자 target | `modifierTargets` | `registerModifierTarget(pattern, valueKind, doc, {ops?, ref?})` | `common.ts`(완료) |
| num 키 | `numKeys` | `numKeys.register(pattern, {doc})` | `common.ts`(완료) |
| 카운터 이름 | `counterNames`(`NameRegistry`) | `registerCounter(name)` | `common.ts`(완료) |
| 적 특수능력 | `enemySpecials` | `registerEnemySpecial(kind, paramShape, doc)` | `schema/world/specials.ts`(W2) |
| 사건 변수 선택자 | `contextSelectors` | `registerContextSelector(name, {yields, params, doc})` | `schema/event/context.ts`(W4) |
| 템플릿 변수 | `templateVars` | `registerTemplateVar(name, {source})` | `schema/event/template-vars.ts`(W4) |
| 특성 행동 훅 | `traitHooks` | `registerTraitHook(name, paramSchema, doc)` | `schema/entity/trait-hooks.ts`(W3) |

`ParamRegistry`(이름 → 파라미터 스키마), `PatternRegistry`(점 경로 패턴 + slot), `NameRegistry`(이름만)는 `common.ts`에 있다. W2~W4의 새 등록부는 이 세 클래스를 재사용한다.

**실행 핸들러 계약**(규칙 구현 태스크가 지킨다). 등록부는 스키마(검증)만 가진다. 엔진 동작은 규칙 층의 맵 하나에 **같은 이름을 키로** 둔다: `EFFECT_HANDLERS`(효과), `CONDITION_EVAL`(조건 단말), `ENEMY_SPECIAL_HANDLERS`, `SELECTOR_HANDLERS`, `TRAIT_HOOK_READERS`. switch 문으로 흩지 않는다. 테스트 1개가 `effects.names()`와 `Object.keys(EFFECT_HANDLERS)`가 양쪽으로 같은지(나머지 맵도 같은 방식) 검사해, 핸들러가 빠진 등록을 CI에서 잡는다. 그러면 새 효과는 "스키마 등록 1곳 + 핸들러 맵 1곳"으로 끝난다. 오래 남는 상태를 만드는 효과는 저장 스키마(6절)도 고쳐야 하며, 이는 피할 수 없는 비용이다.

### 4.1 조건

문법은 16 §3.1 그대로다. `{"all":[…]}` `{"any":[…]}` `{"not":c}` `{"num":{key,op,value}}` `true` `false`, 단말은 **키 1개 객체**. 빈 `all` 참, 빈 `any` 거짓. 평가는 난수·부수효과 없음.

구현(완료): `condition`은 키로 갈래를 고르는 한 개의 `superRefine`이다(zod union 오류 대신 해당 갈래 오류만 경로와 함께 낸다). 이슈 `params.rule = "V3"`.

**단말 조건 표** — 16 §3.2의 43종 + 신설. 파라미터는 zod 표기(→ W4가 그대로 등록).

| 키 | 파라미터 | 16 | 비고 |
| --- | --- | --- | --- |
| `age_gte` / `age_lt` | `int` | O | |
| `level_gte` / `level_lt` | `int` | O | |
| `life_stage` | `lifeStage[]` | O | |
| `specific_age` | `int[]` | O | 이번 판단 지점에서 막 도달 |
| `location` | `ref("region")[]` | O | |
| `location_kind` | `regionKind[]` | O | |
| `location_tag` | `string` | O | 장소 `tags` 보유 |
| `location_match` | `regionFilter` | 신설 | 속성으로 장소 묶음 지정(ID 나열 대신) |
| `season` | `season[]` | O | |
| `time_of_day` | `timeOfDay` | O | 현재 출정 |
| `last_trip_time` | `timeOfDay` | O | 가장 최근 끝난 출정 |
| `weather` | `weather[]` | O | |
| `attitude` | `ref("attitude")[]` | O | 열거 → ref |
| `has_trait` | `ref("trait")` | O | |
| `trait_hook` | `string`(traitHooks 이름) | 신설 | 보유 특성 중 하나의 `ai_hooks[이름]`이 참 |
| `has_item` | `ref("item")` | O | 가방·장착·수령 대기함 |
| `has_item_where` | `{slot?, grade_gte?, tier_gte?, unique?}` | O | |
| `equipped` | `ref("item")` | O | |
| `received_relic` | `ref("item") \| true` | 신설 | 이전 인물에게서 유품으로 받음(별칭 1순위). `true` = 어떤 유품이든(S07 유품 편지) |
| `has_consumable` | `{carry_groups: ref("carry_group")[], count: posInt}` | 신설(T9) | 나열한 소지 묶음 중 하나에 소모품 `count`개 이상. `remove_consumable`과 짝(L09 식량 나누기, L15 식량 또는 동전) |
| `flag` | `flagKey()` 또는 `{key: flagKey(), value: bool\|int}` | O | 범위 무관. 키 꼬리 바인딩 `_{place}` 가능(3.1) |
| `chain_stage` | `{chain: ref("chain"), stage: int}` | O | `life.{chain}_stage` 줄임 |
| `lifetime_count_lt` | `{event: ref("event"), count: int}` | O | |
| `family_count_lt` | `{event: ref("event"), count: int}` | O | |
| `skill_rank_gte` | `{skill, rank: int}` | O | |
| `stat_gte` | `{stat, value: int}` | O | |
| `guild_rank_gte` | `ref("guild_rank")` | O | 순서는 `guild_rank.order` |
| `coins_gte` | `int` | O | |
| `injury` | `"none" \| "light" \| "serious" \| "any"` | O | |
| `specialization` | `SPECIALIZATIONS[]` | O | |
| `mutation` | `MUTATIONS` 값 | O | |
| `generation_gte` | `int` | O | |
| `visited` | `ref("region")` | O | 이번 생애 |
| `discovered` | `ref("region")` | O | **가문** 단위 발견. 후손 면제형 해금은 이 단말로만 쓴다(DS-06) |
| `discovery_found` | `ref("discovery")` | 신설 | 이번 생애에 발견 지점 발견 |
| `defeated` | `ref("enemy")` | O | 이번 생애 격파 |
| `family_defeated` | `ref("enemy")` | O | |
| `policy` | `{key, value}` | O | key는 16 §5.9 필드 이름 |
| `hp_ratio_lte` | `ratio` | O | |
| `fatigue_gte` | `int` | O | |
| `npc_relation_gte` | `{npc: ref("npc"), value: int}` | O | |
| `in_town` | `bool` | O | |
| `guild_aid_active` | `bool` | O | |
| `quest_active` | `bool` | O | |
| `first_sortie_of_family` | `bool` | O | 첫 가문 첫 인물의 첫 출정 |
| `first_sortie_of_character` | `bool` | 신설 | 모든 새 인물의 첫 출정(04 §11 H1 고정) |
| `safe_returns_gte` | `{count: int, where?: regionFilter}` | 신설 | 무사 귀환 누계(장소별 카운터 합). TA02·별패·별칭이 씀(DS-23) |
| `codex_count_gte` | `{codex: "items"\|"enemies"\|"events"\|"locations", count: int}` | 신설 | 업적 9 |
| `codex_complete` | `"items"\|"enemies"\|"events"\|"locations"` | 신설 | 그 종류 정의 전부 발견(업적 15) |
| `reaction_active` | `ref("descendant_reaction")` | 신설 | 후손 반응 기간 안(12 §7.6, DS-10) |
| `life_end_kind` | `END_KINDS[]` | 신설 | 생애 종료 판정용(별칭·업적) |
| `died_at` | `regionFilter` | 신설 | 사망 장소(별칭 8) |
| `thirst_stage_gte` | `ref("thirst_stage")` | 신설 | 갈증 단계 비교(`trait.mutation.thirst.stages`). 사건이 경계 숫자(70)를 복사하지 않게 한다 |
| `combat_kind` | `("normal"\|"elite_gate"\|"boss_gate")[]` | 신설 | 지금 치르는 전투 종류. 수호자 `hit +1 when combat_kind [elite_gate, boss_gate]`(05 §8.2) |
| `main_place` | `regionFilter` | 신설 | 주 활동 장소(08 §7.1: 최근 출정 3회 최빈)가 거르개에 맞음. 장비 평가표(5.1 `equip_eval`)가 쓴다 |

개수: 16의 43종에서 `thirst_gte`를 뺀 42종(쌍 키를 각각 셈) + 신설 15종(T9 사건 이식에서 `has_consumable` 추가, DS-54) = 57종. 16 §3.2의 `family_flag`는 이미 `flag`로 통합됐다. `thirst_gte`는 num `thirst`와 겹치고 경계 복사를 부르므로 폐기, 사망 제안용 단말은 두지 않는다(5.1 `defeat.death_suggestions`를 엔진이 계산).

**num 키**(`numKeys`, 구현 완료): `age` `level` `coins` `generation` `fatigue` `hp` `hp_max` `thirst` `stat.{stat}` `skill.{skill}` `counter.{counter}` `counter.{counter}.{region}` 신설 `family_counter.{counter}` 신설 `relation.{npc}` 신설 `activity_weight.{activity}`(04 §5.2 계산값, 08 §7.3 `던전 가중치 25 이상`) 그리고 `flag.{전체 플래그 키}`(범위 무관, 정수 플래그 비교. `flag.fam.c01_unfinished` 가능 — 16의 "life만" 제한 해제, 6절 C11). `{region}` 자리에는 바인딩을 쓸 수 있다(3.1).

**카운터 이름**(`counterNames`, 엔진이 올림): `wins` `defeats` `sorties` `safe_returns` `inn_rests` `serious_injuries` `fear_successes` `discoveries` `map_fragments` `guild_aids` `event_scenes`. 이름이 겹치면 `registerCounter`가 예외를 던진다. 장소별 누계는 `counter.safe_returns.D3`처럼 `.{region}`을 붙인다. 16 §5.4의 `deep_returns`·`d3_returns`는 장소 ID가 이름에 박혀 있어 폐기하고 `safe_returns_gte {where}`로 대신한다(DS-23).

### 4.2 효과

모든 효과는 `{type, when?, ...params}` strict 객체이며 `effects` 등록부의 판별 유니온이다. 효과 안 이슈는 `params.rule = "V4"`로 보고한다(안쪽 조건 V3·템플릿 V5·피해 V9처럼 규칙 번호가 있는 이슈는 그 번호 유지). 아래는 16 §4.3의 50종을 옮기며 누락을 보완한 **확정 파라미터**다(`?` = 선택, `A | B` = 정확히 하나, `exactlyOne` 검사).

**자원·상태**

| type | 파라미터 | 변경점 |
| --- | --- | --- |
| `add_coins` | `amount: nonNegInt \| units: units` | `formula` 폐기(DS-07) |
| `remove_coins` | `amount: nonNegInt \| units: units \| ratio: ratio \| sortie_income_ratio: ratio \| inn_costs: posInt` | `sortie_income_ratio` 신설: 이번 출정 동전 수입의 비율(05 §6.4 대실패 곤란 2). `inn_costs` 신설(T9): 여관비 N회분 = `balance.recovery.inn.cost` × 수정자 `inn_cost_mult`(08 §5.2 여관비 식, L05 `한 잔 산다`) |
| `add_xp` | `amount: nonNegInt \| units: units \| encounters: posInt` | |
| `heal` | `hp: posInt \| hp_ratio: ratio` | |
| `damage` | `hp: posInt \| hp_ratio: ratio \| dice: dice` | `dice` 문법 `NdM+K` 확정. 체력 1 미만 금지는 엔진 규칙(V9) |
| `add_fatigue` | `value: int` | |
| `injury` | `grade: "light"\|"serious"`, `stat?: stat` | |
| `cure_injury` | `grade: "light"\|"serious"\|"all"` | |
| `life_stat_add` | `stat`, `value: int`, `floor?: int = 0` | |

**물건**

| type | 파라미터 | 변경점 |
| --- | --- | --- |
| `add_item` | `item_id: ref("item")`, `grade?: grade`, `to: "bag"\|"pending_box"\|"bag_or_pending"` | |
| `add_random_item` | `tier: "location"\|"character"\|tier`, `grade_table: ref("drop_table") \| grade_weights: weightTable(GRADES)`, `slot?: slot`, `exclude_cursed?: bool = true` | grade_table은 `balance.economy.drops` 키 참조(리터럴 열거가 아니므로 팩이 표를 더할 수 있다) |
| `remove_item` | `item_id: ref("item") \| selector: "chosen_relic"\|"highest_rare_relic"` | |
| `add_consumable` | `consumable_id: ref("consumable") \| tier: "current"`, `count: posInt` | |
| `remove_consumable` 신설 | `carry_groups: ref("carry_group")[]`, `count: posInt` | 나열 순서대로 가진 묶음 하나에서 뺀다. L09 식량 나누기, 05 §6.4 곤란 3(식량 또는 붕대) |
| `add_material` 신설 | `material_id: ref("material")`, `count: posInt` | 사건 결과의 재료(채집물 등) |
| `open_chest` 신설(T9) | 없음 | 보물 방 상자 내용(07 §5.3: 장비 1개 `drops.treasure_chest` + 동전 `dungeon.chest.coin_units` + 재료 `dungeon.chest.material`, 현재 장소 기준)을 받는다. 잠김·함정 판정은 하지 않는다(사건 판정이 대신한다). L17·L20 `보물 상자 1개` |
| `offer_purchase` | `pool: {facilities: ref("facility")[], slots: slot[]}`, `tier: "character"\|tier`, `grade_weights`, `price_mult: number`, `defect?: modifier[]`, `exempt_discount_cap?: bool = true`, `respect_auto_buy?: bool = true` | 후보는 그 시설에 `shop`을 선언한 장비(5.5). 사건에 `{item}`(`offer_item`, 4.5)이 있으면 엔진이 그 물건을 `item_id`로 넘기고 포트는 후보 중 그 물건만 판다(없으면 불발) |

**특성·생애**

| type | 파라미터 |
| --- | --- |
| `add_trait` / `remove_trait` | `trait_id: ref("trait")` |
| `specialize` | `spec: "guardian"\|"pathfinder"\|"defer"` |
| `extend_lifespan` | `years: posInt`, `cap?: int`(없으면 `balance.inheritance.lifespan.extend_cap`) |
| `mutate` | `trait_id: ref("trait")` (그 특성 `kind: mutation`이어야 함, W1 V검사) |
| `register_relic` | `selector: "this_item"\|"uid"`, `priority: 1\|2` |
| `create_child_candidate` | 없음 |
| `create_partner` 신설(T9) | 없음 — 동반자 1명 생성(12 §2.1 이름·직업·선천 특성·외형). S01. 코어가 사건 ID를 몰라도 되게 효과로 둔다 |

**플래그와 연속 사건** (V19 범위 접두를 파라미터 스키마로 강제)

| type | 파라미터 |
| --- | --- |
| `set_flag` / `clear_flag` | `key: flagKey("life")`, `value?: bool\|int = true` |
| `set_family_flag` | `key: flagKey("fam")`, `value?: bool\|int = true` |
| `set_trip_flag` / `clear_trip_flag` | `key: flagKey("trip")`, `value?`, `remaining?: {encounters\|rooms\|scenes: posInt}`(키 하나). 출정 동안의 효과는 등록표 `flag.trip_modifiers`에만 둔다(5.8) |
| `counter_add` | `key: string(counterNames)`, `value: int`, `where?: ref("region") \| 바인딩` | `where`가 있으면 전체 누계와 그 장소 누계(`counter.{c}.{region}`)를 함께 올린다. 07 A3-4 공포 성공 → TA02 무사 귀환 1회 |
| `advance_chain` | `chain_id: ref("chain")`, `stage: posInt` |
| `end_chain` | `chain_id: ref("chain")`, `outcome: string`(그 chain의 `outcomes[]` 중 하나, W1 검사) |

모든 키 파라미터는 꼬리 바인딩 `_{place}`를 받는다(3.1).

**진행·장소**

| type | 파라미터 | 변경점 |
| --- | --- | --- |
| `unlock_location` | `location_id: ref("region")` | |
| `reveal_discovery` 신설(T9) | `prefer?: ref("discovery")[]` | 현재 장소의 미발견 발견 지점 하나를 판정 없이 발견한다(발견 효과·지도 조각 포함). `prefer` 중 미발견인 것이 먼저, 없으면 `condition`이 맞는 미발견 지점 중 `event` 흐름 무작위, 남은 지점이 없으면 아무 일도 없다. L18 일지, L19 언덕(`A2-1` 우선) |
| `set_destination` | `location: ref("region") \| place_var: string(context 변수)`, `activity?: activity`, `scope: "next_sortie"`, `respect_risk_cap?: bool = true` | place_var는 그 사건 `context_vars`에 있어야 함(W1) |
| `accept_quest` | `quest: ref("event")`, `location_var`, `enemy_var`, `goal_wins: posInt`, `deadline: "next_sortie"`, `reward: {coin_units, xp_units}`, `settle: "ratio_floor"`, `cancel_on: "serious_injury"`, `lines: {complete: line, partial: line, cancel: line}` | `lines` 신설(11 L06 달성·부분·취소 기록). 보상 단위는 `location_var` 장소 기준 |
| `sortie_mod` | `remaining_add?: {encounters\|scenes: int}`, `return_travel_sec_add?: int`, `camp?: {hp_mult?: number, fatigue_add?: int}` 하나 이상 | `camp.fatigue_add`는 야영 피로 변화(−40)에 더하는 값(+10이면 −30). 수정자 `camp_fatigue_add`와 같은 규약 |
| `dungeon_mod` | `op: "add_room"\|"skip_rooms"\|"next_room_weight"`, `room_kind?: ROOM_KINDS`, `count?: posInt`, `weight_add?: int`, `scope: "this_sortie"\|"next_visit"`, `location?: ref("region") \| 바인딩 = "{place}"` | next_visit 저장 위치 6절 C7. `skip_rooms`는 관문 앞 마지막 방을 건너뛰지 않고, 건너뛴 방의 보상은 없다(엔진 규칙, 11 L14) |
| `add_time` | `sec: posInt` | |
| `end_sortie` | `reason: "event"\|"injury"\|"command"` | |
| `temp_mod` | `modifier`, `scope: "scene"\|"next_scene"\|"sortie"\|"next_sortie"\|"encounters"\|"next_decision"\|"eff_min"\|"next_check"\|"next_visit"`, `count?: posInt`(encounters면 필수, next_visit이면 그 방문의 조우 수 제한), `duration_min?: effMin`(eff_min이면 필수), `location?: ref("region") \| 바인딩`(next_visit이면 필수) | `next_check`(다음 판정 1회, 05 §6.4 곤란 4)·`next_visit`(그 장소 다음 방문 동안, L05·L16) 신설. next_visit 저장 6절 C7 |
| `shop_discount` | `ratio: ratio`, `uses?: posInt = 1`, `facility?: ref("facility")`, `duration_min?: effMin` | |

**전투와 흐름**

| type | 파라미터 |
| --- | --- |
| `start_combat` | 4.2절 `combat` 필드 전부 + `on_win?` `on_defeat?` `on_stalemate?: effect[]` |
| `roll_check` 신설 | `check: {kind: ref("check_kind"), dc?: int, dc_offset?: int}`(5.10 check 규칙), `success: effect[]`, `partial?: effect[]`, `failure?: effect[]` — 결과 안에서 판정을 한 번 더 굴린다(07 A3-4 발견 뒤 공포 판정) |
| `chance` | `p: ratio`, `then: effect[]`, `else?: effect[]` |
| `if` | `cond: condition`, `then: effect[]`, `else?: effect[]` |
| `on_town_return` | `effects: effect[]`, `line?: line` |
| `schedule_event` | `event_id: ref("event")`, `at: "next_town_return"\|"next_camp"\|"eff_min"`, `after_min?: effMin`(eff_min이면 필수) |
| `reopen_choices` | `exclude: string[]`(같은 사건 선택지 id), `situational?: modifier[]` |

**기록·관계·연출**

| type | 파라미터 | 변경점 |
| --- | --- | --- |
| `npc_relation` | `npc_id: ref("npc")`, `delta: int` | |
| `skill_use` | `skill: skill \| "lowest_rank"`, `count: posInt` | `lowest_rank` 신설(T9): 단계가 가장 낮은 숙련, 같으면 숙련 목록(`SKILLS`) 순서 앞(L24) |
| `family_record` | `kind: "chronicle"\|"bond"\|"codex"`, `key: string`, `text: template` | |
| `unlock_family` | `kind: "background"\|"appearance"`, `id: string` | background면 ref("background") 검사. 연대기 칭호는 가리킬 종류가 없으므로 `achievement.rewards {kind: "title", text}`로만 준다 |
| `journal` | `tag: journalTag`, `line: line`, `detail?: template`, `importance?: JOURNAL_IMPORTANCE` | |
| `animation` | `action: animationAction`, `props?: ref("prop")[]` | 영어 키(DS-09) |

`start_chain`은 폐기 유지. 합계 50 + `add_material` `remove_consumable` `roll_check` + T9 사건 이식의 `reveal_discovery` `open_chest` `create_partner`(DS-54) = 56종.

**비용 표시 필수 효과(V8)**: `mutate`·`extend_lifespan`·`remove_item(chosen_relic)`·`life_stat_add` 목록은 W4 refine에 박지 않고 `schema/event/effects.ts`의 등록 코드 옆 상수 `COST_REQUIRED_EFFECTS`(export `Set`)에 둔다. 새 효과를 더하는 코드는 같은 파일(또는 확장 모듈)에서 이 Set에 더한다.

**`combat` 필드**(선택지 `combat`과 `start_combat` 공통, W4):

| 필드 | 형식 |
| --- | --- |
| `enemies` | `({enemy_id: ref("enemy")} \| {by_location: record(ref("region"), ref("enemy"))} \| {from_region_table: true})[]` — 마지막은 신설: 현재 장소 조우 표에서 뽑음(경보 종줄 함정) |
| `count` | `posInt` 또는 `{when: condition, count: posInt}[]` |
| `sequential` | `bool?` |
| `first_strike` | `"char"\|"enemy"\|"default"` |
| `ambush` 신설 | `bool = false` — 매복 취급: 매복 대응 판정을 하고 실패하면 적 선공 + 1라운드 적 명중 +`combat.ambush.fail_enemy_hit_add`(05 §7.3). 경보 종줄 함정(07 §5.3) |
| `pre_check` | `{kind: ref("check_kind"), dc_offset: int, on_fail: modifier[]}` |
| `reward_mult` | `number?` |

### 4.3 수정자 target

`target`은 점 경로이며 `{slot}` 자리를 가진 패턴과 맞춘다. 여러 패턴이 맞으면 글자 그대로인 조각이 많은 패턴을 쓴다(`check.all` > `check.{check_kind}`). slot 종류: `{stat}` `{skill}` `{activity}`(열거), `{check_kind}` `{enemy_family}` `{region}` `{npc}`(ref, V2 검사. `{region}`은 바인딩도 받는다, 3.1), `{counter}` `{special}` `{param}`(snake_case 이름. `special.{special}.{param}`의 두 값은 W1이 `enemySpecials` 이름과 그 파라미터 키로 교차 검사, V3).

**값 종류**와 허용 op(구현 완료, `modifier`의 superRefine):

| 값 종류 | op | value |
| --- | --- | --- |
| `number` | `add` `mul` `set` (target 등록의 `ops`가 있으면 그것만) | number |
| `bool` | `flag` | bool |
| `string` | `set` | string. target 등록에 `ref`가 있으면 그 종류로 V2 검사(`rescuer_override` → `rescuer`) |
| `charges` | `charges_per_sortie` `charges_per_life` `charges_total` | 정수 ≥ 1 |

합산 순서(16 §3.3): `(set 값 또는 기준값) + Σadd`, 그 뒤 `× Πmul`. 판정 보정은 합산 뒤 −5~+5, 특성 하나의 판정 보정 ±2(06).

**기준값과 작성 op**(작성자가 문서와 다른 결과를 내지 않게):

- 단위: 확률·비율·%p는 모두 ratio(0.05 = 5%p). 판정·명중·방어·피해·초·피로는 정수 가산.
- `*_mult` target의 기준값은 1.0이다. 서로 곱하는 독립 배수(날씨, 여관비 `inn_cost_mult` 08 §5.2, 길잡이 이동·발견 05 §8.2)는 `mul`로 쓴다.
- **합산 target**(퍼센트 보정을 모두 더한 뒤 한 번 곱함): `hp_max_mult`(05 §4.4 `× (1 + 0.10 + 0.15)`), `price_mult`(08 §5.2 할인 합산, 상한 `economy.discount_cap`), `sell_mult`. 등록에 `ops: ["add"]`가 붙어 `mul`은 S01 오류다. 예: 수호자 `{"target":"hp_max_mult","op":"add","value":0.15}`.
- **고정 target**: `recovery_coef`, `defeat_item_loss_chance`는 `ops: ["set"]`.
- `*_add` target은 기준값 0에 `add`로 쓴다.

| target | 값 | 16 | 쓰는 곳(예) |
| --- | --- | --- | --- |
| `stat.{stat}` | number | O | J02 행운 +1 |
| `check.{check_kind}` | number | O | W07 `check.fear` +2 |
| `check.stat.{stat}` | number | O | TI05 |
| `check.skill.{skill}` 신설 | number | | 날씨 탐색 −1(`check.skill.search`), J03 |
| `check.all` | number | O | 피로, `trip.fear` |
| `hit` / `hit_vs.{enemy_family}` | number | O | W06 |
| `first_round_hit_add` 신설 | number | | X07 |
| `first_strike_hit_add` 신설 | number | | W03 |
| `damage` / `damage_vs.{enemy_family}` / `damage_mult` | number | O | W05·W08 |
| `pair_damage_taken_mult` 신설 | number | | X08 |
| `ac` | number | O | 수호자 +1 |
| `hp_max_add` / `hp_max_mult` | number / number(`add`만) | O | TI01, E03, 수호자 +0.15 |
| `rest_recovery_mult` | number | O | TI01 |
| `breather_mult` 신설 | number | | 흡혈귀 밤 ×2 |
| `recovery_coef` 신설 | number(`set`만) | | 흡혈귀 밤 1.0·낮 0.7·마을 0.9 |
| `camp_hp_mult` 신설 | number | | 비 ×0.75, E05 |
| `camp_fatigue_add` 신설 | number(`add`) | | **야영 피로 변화(−40)에 더함**: 눈 +10(→ −30), X05 −15(→ −55) |
| `fatigue_gain_mult` | number | O | A04, TI05 |
| `travel_time_mult` | number | O | TI03, R02, 날씨, 길잡이 ×0.8 |
| `travel_sec_add.{region}` 신설 | number(초) | | 07 A2-3: `travel_sec_add.A2` −10 등 그 장소까지 이동 |
| `descend_sec_add.{region}` 신설 | number(초) | | 07 A3-5: `descend_sec_add.D2`·`.D3`·`.A4` −10(A4는 D3 하강을 거친다) |
| `return_travel_time_mult` 신설 | number | | X03 |
| `return_travel_sec_add` 신설 | number(초) | | 사건 `sortie_mod.return_travel_sec_add`가 출정 수정자로 건다(L19 −30, 무너지는 발판 +20). 등록이 빠져 이 수정자가 걸린 출정을 저장하면 K4로 읽지 못했다(I70) |
| `travel_fatigue_add` 신설 | number | | 눈 +1 |
| `discovery_chance_add` / `discovery_chance_mult` | number | O | R02, 안개 |
| `trap_encounter_add` | number | O | TI06 +0.10. **상대 가산**: 함정 방 가중치 × (1 + 합)(00 D53) |
| `treasure_room_chance_add` | number | O | `trip.propped_ceiling` |
| `ambush_chance_add` 신설 | number(ratio) | | 안개 +0.05 |
| `encounter_weight_mult.{enemy_family}` 신설 | number | | 눈 늑대 ×1.5 |
| `drop_chance_add` | number(ratio) | O | `trip.rat_luck` +0.02 |
| `xp_mult` / `coin_mult` | number | O | |
| `retreat_hp_add` | number(ratio) | O | TI07 0.10(퇴각 기준은 ai_hooks와 더한다, DS-29) |
| `activity_weight.{activity}` | number | O | |
| `location_score.{region}` | number | O | L05 `location_score.{rumor_place}` +15 |
| `price_mult` `sell_mult` / `inn_cost_mult` `food_cost_mult` `maintenance_mult` | number(`add`만) / number | O | TA01 −0.10, E12 −0.03 / TI08 ×1.5, TA04 ×0.7 |
| `shop_surcharge` | number(ratio) | O | 흡혈귀 낮 귀환 +0.2(5.6 TM01 예) |
| `reserve_add` | number(ratio) | O | TA06 +0.10 |
| `defeat_loss_mult` | number | O | J01 |
| `defeat_item_loss_chance` 신설 | number(`set`만) | | J01 0.2 |
| `equip_eval_mult` 신설 | number | | 08 §7 장비 평가 점수 배수. W08 `{mul 0.9, when {mutation: vampire}}`(09 §7.7) |
| `mining_reward_mult` | number | O | W05 |
| `forage_reward_mult` 신설 | number | | 비 +20%, X04, 발견 A2-6 |
| `luck_drop_add` | number | O | |
| `thirst_gain_mult` | number | O | |
| `enemy_hit_first_round_add` | number | O | W10 |
| `night_damage_mult` / `day_fatigue_mult` | number | O | R04 |
| `final_check_add` 신설 | number | | R03 +5 |
| `second_wind_ratio` 신설 | number | | X01 0.10 |
| `special.{special}.{param}` 신설 | number | | TI02 → `special.screech.fatigue` +1 (EN06 +2 → +3) |
| `fear_immunity` / `dark_penalty_ignore` | bool | O | W10·TA08 / J04·TA02 |
| `camp_raid_immunity` 신설 | bool | | X05, 발견 A2-4. 켜져 있으면 `camp` 판단 지점에서 사건 `tags`에 `raid`가 있는 사건을 후보에서 뺀다(5.10) |
| `rescuer_override` 신설 | string(ref `rescuer`) | | J01 → `"whistle_family"` |
| `ambush_negate` / `escape_on_defeat` / `serious_heal` / `second_wind` | charges | O(second_wind 신설) | W07·X02 / R01 / R03 / X01 |

### 4.4 적 특수능력 (`enemySpecials`, W2)

`enemy.specials[]`는 `{kind, ...params}` 판별 유니온. `kind`는 코드 등록부. 특정 장비·특성 ID를 파라미터에 넣지 않는다 — 무효화 조건은 수정자 flag(`fear_immunity`, `dark_penalty_ignore`)나 `special.{kind}.{param}` 가산으로 표현한다.

| kind | 파라미터 | 07 원본 |
| --- | --- | --- |
| `cowardly_flee` | `hp_ratio_lte: ratio`, `chance: ratio`, `xp_ratio: ratio` | EN01 |
| `gnaw` | `chance: ratio`, `ac_add: int`, `max_times: posInt` | EN02 |
| `pack_hunt` | `min_count: posInt`, `hit_add: int` | EN03 |
| `howl` | `check: ref("check_kind")`, `on_fail: modifier[]` | EN04 |
| `erratic_flight` | `first_attack_hit_add: int` | EN05 |
| `screech` | `fatigue: int` | EN06 (TI02는 `special.screech.fatigue` +1) |
| `dark_defense` | `ac_add: int`, `when: condition` | EN07 (J04·TA02는 `dark_penalty_ignore`) |
| `stone_throw` | `damage: range`, `hit_check: bool` | EN08 |
| `heavy_swing` | `rounds: posInt[]`, `damage_mult: number` | EN09 |
| `damage_reduction` | `value: int`, `min: int` | EN10 (계열 추가 피해는 감소 뒤에 더함 = 엔진 순서 규칙) |
| `summon` | `hp_ratio_lte: ratio`, `enemy_id: ref("enemy")`, `level?: int`, `skip_attack: bool`, `max_times: posInt` | EB01 |
| `cave_shake` | `hp_thresholds: ratio[]`, `check: ref("check_kind")`, `dc_offset: int`, `fail: effect[]`, `partial: effect[]` | EB02 |
| `phases` | `phases: {hp_above: ratio, name: string, fear_check?: {every_rounds: posInt, dc_offset: int, fail: modifier[], partial: modifier[], duration_rounds: posInt}, attacks_per_round?: posInt, damage_mult?: number, ac_add?: int, fx?: string}[]` | EB03 (W10·TA08 공포 면역은 `fear_immunity`) |

### 4.5 사건 변수 선택자 (`contextSelectors`, W4)

`event.context_vars: {var, selector, params?}[]` — **배열이고 선언 순서대로 평가한다**. 뒤 항목의 `params`는 앞 항목이 채운 변수를 이름으로 가리킬 수 있다. 선택자 이름은 코드 등록부다(엔진이 계산). 수치·기준은 이름에 박지 않고 `params`로 준다. `var`는 16 §1.4.3에서 `값 = 사건`인 것만 쓸 수 있다. **예외 2개**: `item`(`offer_item`)과 `coins`(`coin_amount`)는 16 §1.4.3에서 `값 = 문맥`이지만, 도입이 결과보다 먼저 그 값을 보여 줘야 하는 사건(L02·L10·L12)에 한해 선택자로 채운다(IMPL_DECISIONS I68). 그 사건 안에서는 선택자 값이 문맥 값보다 먼저다.

| 선택자 | params | 고르는 것 | 채우는 변수 | 쓰는 사건 |
| --- | --- | --- | --- | --- |
| `rumor_place` | `{chain_next_chance: ratio}` | 11 L05 원문: 해금됐고 미발견 요소가 남은 장소 중 무작위. 진행 중인 연속 사건이 있으면 `chain_next_chance`(0.5) 확률로 그 다음 단계 장소 | `{rumor_place}` | L05 |
| `best_hunting_ground` | `{max_risk: activityRisk}` | 해금 사냥터 중 인물의 위험 등급이 `max_risk`(`normal`) 이하인 곳 가운데 권장 중앙값이 가장 높은 곳 | `{target_place}` | L06 |
| `main_enemy_of` | `{place_var: string}` | 앞서 채운 장소 변수의 조우 표에서 가중치가 가장 큰 적 | `{enemy}` | L06 |
| `random_friend_name` | 없음 | 02 이름 풀에서 가문 인물과 겹치지 않는 이름(`life` 난수 흐름) | `{friend}` | L22 |
| `offered_relic` | 없음 | F02 헌납 후보(희귀 이상 유물 중 선택 창에서 고름) | `{relic_name}` `{relic_note}` | F02 |
| `offer_item` | `{facilities: ref("facility")[], slots: slot[]}` | 특가 구매 도입에 보이는 물건: 인물 레벨 기준 단계의 그 시설·슬롯 판매 장비(저주 제외) 중 무작위(`event` 흐름). `offer_purchase` 효과가 이 값을 `item_id`로 포트에 넘기고, 포트는 **그 물건만** 판다(효과의 `pool`에 없으면 팔지 않는다, I70) | `{item}` | L02, L10 |
| `coin_amount` | `{units: number}` | 그 장소 동전 단위 × `units`(10 §6.1, 반올림). `add_coins`의 `units`와 같은 식이라 도입에 보인 금액과 받는 금액이 같다 | `{coins}` | L12 |

```json
{ "context_vars": [
    { "var": "target_place", "selector": "best_hunting_ground", "params": { "max_risk": "normal" } },
    { "var": "enemy", "selector": "main_enemy_of", "params": { "place_var": "target_place" } } ] }
```

변수를 둘 이상 채우는 선택자(`offered_relic`)는 변수마다 항목을 하나씩 적는다(`{var: "relic_name", selector: "offered_relic"}`, `{var: "relic_note", selector: "offered_relic"}`). 엔진은 한 사건 안에서 같은 `selector`·`params` 항목을 한 번만 계산해 그 값을 나눠 쓴다(두 변수가 서로 다른 유물을 가리키지 않게).

선택자 정의는 W4 `registerContextSelector(name, {yields: 변수[], params: zod 스키마, doc})`다. 스키마는 이름 존재, `params` 모양, `yields`가 변수 등록표에 있는지, `place_var`가 앞 항목의 변수인지(W1)를 본다. 계산은 핸들러 맵 `SELECTOR_HANDLERS`(4절 계약)가 한다. 장소를 채우는 선택자의 변수는 바인딩(3.1)에 쓸 수 있다.

### 4.6 템플릿 변수 등록표 (`templateVars`, W4)

16 §1.4.3의 83개 변수(D77로 `hp`·`fatigue`·`use`·`xp`·`places` 추가)를 코드 등록부로 옮긴다(엔진이 값을 채우므로 코드 소유. 16 요약표의 76은 틀린 수다). 항목: `{name, source: "context"\|"event"}`. V5는 템플릿의 모든 변수가 등록돼 있는지, 조사 쌍이 16 §1.4.2 9종인지(렌더러 파서 `text/template.ts`가 단일 출처), `source: event` 변수는 그 사건의 `context_vars`에 있는지 본다. 16 §1.4.4의 옛 표기 10개는 등록하지 않는다 — 새로 쓰는 콘텐츠에 옛 표기를 받을 이유가 없으므로 V5 오류다(기반 팩을 옮길 때 정식 이름으로 바꾼다).

### 4.7 `effect_path` 문법 (16 §5.7 `pre_chance`의 키)

사건 안 `chance` 효과의 위치를 가리키는 결정적 경로. 선택 창 저장(T11)과 결과 적용(T-사건)이 같은 문자열을 만든다.

```text
effect_path = choice_id "/" outcome_key "/" step ("/" step)*
step        = 정수 인덱스 | 정수 인덱스 "." branch
branch      = 그 효과의 파라미터 키 가운데 값이 효과 배열인 것(then, else, effects, on_win, success, …)
예: "treasure/success/1"            → choices[treasure].outcomes.success.effects[1]
    "decline/always/2.then/0"       → …effects[2].then[0]
```

branch 이름은 고정 목록이 아니다. `listChancePaths(event)`는 효과 객체의 파라미터 중 **값이 `{type}` 객체의 배열인 키**를 모두 branch로 보고 데이터만 따라 걷는다. 그래서 효과 배열을 품은 새 효과(`roll_check`, 확장 효과)를 등록해도 경로 코드를 고치지 않는다. W4가 `effectPath(choiceId, outcomeKey, indices)` 헬퍼와 `listChancePaths(event)`(사건의 모든 `chance` 경로 나열)를 제공한다.

### 4.8 특성 행동 훅 (`traitHooks`, W3)

`trait.ai_hooks`의 키는 등록부다(16 §2.7 표 + 신설). `trait_hook` 조건 단말이 이 이름을 쓴다.

| 훅 | 형식 | 16 | 뜻(소유) |
| --- | --- | --- | --- |
| `activity_weight_add` | `partial {hunt, adventure, dungeon}: int` | O | 04 식의 특성 항 |
| `retreat_hp_add` | `ratio` (16의 pct_point 10 → 0.10) | O | TI07 |
| `location_score_add` | `{when: condition, value: int}[]` | O | 04 §6.1 |
| `choice_tag_bonus` | `partial {tag: int}` | O | 10 §5.3 |
| `event_weight_mult` | `record(ref("event"), number)` | O | 10 §4.2 |
| `prefer_shortcut` 신설 | `bool` | | TI03: 길 선택 지름길(07 §6.2, 태도의 `shortcut.force_when`이 읽음) |
| `attempt_disarm` 신설 | `bool` | | TI04: 함정 해제 시도(07 §5.3, 태도의 `disarm_when`이 읽음) |
| `camp_extra` 신설 | `nonNegInt` | | TI01: 출정 중 야영 허용 +1회(06 §7) |
| `rest_preference` 신설 | `"inn"\|"camp"` | | TI08·TA04 여관, TI01 야영(06 §7) |
| `winter_retreat_hp_add` 신설 | `ratio` | | TA03 겨울 출정 +0.05(06 §7). 수정자 `{target: retreat_hp_add, when: {season: [winter]}}`로 통일하면 뺀다(DS-29) |

---

## 5 종류별 필드

표기: `필드: 형식` — `?`는 선택, `= 값`은 기본값. 모든 객체는 strict + `_note`/`_comment`.

### 5.1 balance (singleton, W2)

모든 섹션과 키를 확정한다. 값은 01(및 표시한 담당 문서)의 현재 값이다. **숫자는 코드에 두지 않고 여기서 읽는다.** 섹션 이름 옆 괄호는 출처.

```json
{
  "id": "balance",
  "time": {                                             "_comment": "01 §1",
    "min_per_year": 12, "season_min": 3, "start_age": 18, "base_retire_age": 68,
    "day_night_ratio": [0.7, 0.3],
    "season_order": ["spring", "summer", "autumn", "winter"]
  },
  "weather": {                                          "_comment": "01 §1.3. 효과는 수정자로",
    "season_weights": {
      "spring": { "clear": 55, "rain": 30, "fog": 15, "snow": 0 },
      "summer": { "clear": 65, "rain": 30, "fog": 5,  "snow": 0 },
      "autumn": { "clear": 50, "rain": 15, "fog": 35, "snow": 0 },
      "winter": { "clear": 40, "rain": 10, "fog": 15, "snow": 35 }
    },
    "effects": {
      "clear": [],
      "rain": [ { "target": "travel_time_mult", "op": "mul", "value": 1.10 },
                { "target": "check.skill.search", "op": "add", "value": -1 },
                { "target": "check.trap_evade", "op": "add", "value": -1 },
                { "target": "camp_hp_mult", "op": "mul", "value": 0.75 },
                { "target": "forage_reward_mult", "op": "mul", "value": 1.20 } ],
      "fog":  [ { "target": "travel_time_mult", "op": "mul", "value": 1.05 },
                { "target": "check.skill.search", "op": "add", "value": -1 },
                { "target": "ambush_chance_add", "op": "add", "value": 0.05 },
                { "target": "discovery_chance_mult", "op": "mul", "value": 1.10 } ],
      "snow": [ { "target": "travel_time_mult", "op": "mul", "value": 1.20 },
                { "target": "travel_fatigue_add", "op": "add", "value": 1 },
                { "target": "check.skill.mobility", "op": "add", "value": -1 },
                { "target": "encounter_weight_mult.wolf", "op": "mul", "value": 1.5 },
                { "target": "camp_fatigue_add", "op": "add", "value": 10 } ]
    }
  },
  "actions": {                                          "_comment": "01 §1.2. sec = 화면 시간 범위. 야영은 recovery.camp, 입원·무료 치료는 injury.serious가 단일 출처",
    "hunt_encounter":   { "sec": [30, 50],   "fatigue": 4 },
    "pair_encounter":   { "sec": [45, 65],   "fatigue": 4 },
    "adventure_scene":  { "sec": [40, 70],   "fatigue": 5 },
    "dungeon_room":     { "sec": [40, 70],   "fatigue": 6 },
    "gate":             { "sec": [90, 150],  "fatigue": 12 },
    "breather":         { "sec": [5, 5],     "fatigue": 0 },
    "travel_leg":       { "sec": [20, 70],   "fatigue": 2 },
    "inn":              { "sec": [90, 90],   "fatigue_reset": true },
    "guild_lodging":    { "sec": [150, 150], "fatigue_reset": true },
    "town_prep":        { "sec": [20, 60],   "fatigue": 0 },
    "potion_sec": 3, "light_treatment_sec": 10, "dungeon_retreat_sec_per_room": 5
  },
  "stats": {                                            "_comment": "01 §2.1, §2.5, §11. 최후 판정 행운 나눗수는 check_kinds.final.luck_div",
    "birth_base": 1, "birth_points": 5, "birth_cap": 4, "natural_cap": 8,
    "growth_levels": [4, 7, 10, 13, 16, 19, 22, 25, 28],
    "luck": { "rare_drop_per_point": 0.02, "rare_drop_cap": 0.16, "fortune_per_point": 0.05 },
    "derived": { "hp_base": 20, "hp_per_level": 4, "hp_per_str": 3, "ac_base": 10, "ac_dex_div": 2, "damage_stat_div": 2 },
    "fatigue": { "max": 100, "penalty_at": 80, "penalty_check_all": -1, "exhaust_at": 100 },
    "bag_slots": 20,
    "trait_caps": { "innate": 3, "acquired": 6 },  "_note": "후천 6 초과 시 가장 오래된 누적형 후천 특성을 기록으로 옮김(01 §11, 06 §1.1)"
  },
  "growth": {                                           "_comment": "05 §2.2, §4",
    "birth_weights": { "base": 10, "luk": 6 }, "trait_birth_add": 5, "parent_best_add": 3,
    "use_points": { "combat": 1, "miss_streak": { "count": 4, "points": 1 }, "check": 1, "event_check": 2,
                    "injury_or_final": 1, "trade_return": 0.5, "natural_20_luck": 1 },
    "decay": 0.5,
    "alloc": { "use_w": 0.6, "spec_w": 0.4, "primary": 0.7, "secondary": 0.3,
               "luck": { "base": 0.05, "per_point": 0.02, "cap": 0.25 }, "floor": 0.03 }
  },
  "reference_character": {                              "_comment": "01 §2.4 표준 진행 가정. 07 §5.2 방 생성 검증의 기준 인물",
    "main_stat_start": 3, "stat_up_levels": [4, 10, 16, 22, 28], "melee_rank_levels": [3, 7, 13, 19, 26],
    "check_bonus": {
      "trap_detect": [ { "from_level": 1, "value": 2 }, { "from_level": 5, "value": 3 }, { "from_level": 9, "value": 4 },
                       { "from_level": 15, "value": 5 }, { "from_level": 24, "value": 6 } ],
      "trap_evade":  [ { "from_level": 1, "value": 2 }, { "from_level": 6, "value": 3 }, { "from_level": 11, "value": 4 },
                       { "from_level": 19, "value": 5 }, { "from_level": 28, "value": 6 } ]
    }
  },
  "aging": {                                            "_comment": "01 §2.2, 16 §6.5",
    "life_stages": [ { "id": "novice", "from_age": 18 }, { "id": "prime", "from_age": 30 },
                     { "id": "veteran", "from_age": 50 }, { "id": "elder", "from_age": 65 } ],
    "milestones": [ { "age": 50, "stat_add": { "kno": 1, "wil": 1 } },
                    { "age": 60, "stat_add": { "str": -1, "dex": -1 } },
                    { "age": 70, "every_years": 10, "stat_add": { "str": -1, "dex": -1 }, "floor": 1 } ],
    "recovery_coef": [ { "from_age": 18, "value": 1.0 }, { "from_age": 50, "value": 0.9 },
                       { "from_age": 60, "value": 0.8 }, { "from_age": 70, "value": 0.7 },
                       { "from_age": 80, "value": 0.6 } ]
  },
  "skills": { "rank_thresholds": [15, 50, 120, 250, 450], "max_rank": 5,
              "use_counts": {                           "_comment": "05 §5.1",
                "combat": 1, "elite_gate_combat": 3, "boss_combat": 5, "natural_20": 1, "attack_event_check": 1,
                "mobility_check": 1, "miss_streak": { "count": 4, "uses": 1 }, "search_check": 1,
                "scene_or_chest": 1, "camp": 2, "survival_check": 1, "safe_return": 1,
                "negotiation_check": 2, "trade_return": 1 } },
  "xp": {                                               "_comment": "01 §2.4, 05 §3.1",
    "target_min": { "base": 4, "amp": 20, "tau": 6, "linear": 0.3 },
    "prod_rate": 0.75, "req_round": 5, "req_min": 25, "max_level": 30,
    "encounter_base": { "flat": 6, "per_level": 3 },
    "rank_mult": { "normal": 1, "elite": 2.5, "boss": 10 },
    "activity_mult": { "hunt": 1.0, "adventure": 0.8, "dungeon_room": 1.3 },
    "dungeon_noncombat_mult": 0.5,                      "_note": "던전 비전투 방 = XP(방 레벨) × dungeon_room × 이 값, 휴식 지점 0",
    "overlevel_decay": { "free_gap": 2, "per_level": 0.15, "floor": 0.2 }
  },
  "check": {                                            "_comment": "01 §3. fumble_table = 05 §6.4 가벼운 곤란(사건이 따로 정하면 그것을 따름)",
    "mod_cap": [-5, 5], "trait_mod_cap": 2,
    "dc_fixed": { "easy": 8, "normal": 12, "hard": 16, "very_hard": 20, "legend": 24 },
    "dc_step": { "easy": -4, "normal": 0, "hard": 4, "very_hard": 8, "legend": 12 },
    "region_dc_base": 11, "region_dc_div": 2.5,
    "partial_margin": 2, "crit": 20, "fumble": 1, "opposed_base": 10,
    "success_p_clamp": [0.05, 0.95], "partial_p_bonus": 0.10,
    "fumble_table": [
      { "weight": 1, "effects": [ { "type": "add_fatigue", "value": 5 } ], "line": "발을 헛디뎌 한참을 주저앉았다." },
      { "weight": 1, "effects": [ { "type": "remove_coins", "sortie_income_ratio": 0.05 } ], "line": "주머니 구멍으로 동전이 샜다." },
      { "weight": 1, "effects": [ { "type": "remove_consumable", "carry_groups": ["ration", "bandage"], "count": 1 } ], "line": "빵이 물웅덩이에 빠졌다." },
      { "weight": 1, "effects": [ { "type": "temp_mod", "modifier": { "target": "check.all", "op": "add", "value": -1 }, "scope": "next_check" } ], "line": "괜히 마음이 어수선하다." },
      { "weight": 1, "effects": [], "line": "모자가 바람에 날아갔다. 주워 왔다." }
    ]
  },
  "check_kinds": {                                      "_comment": "05 §6.1 → 16 §6.13. dc 구조화(DS-22). partial_effects·partial_mult·fail_effects = 05 §6.1 부분 성공 비용·실패 기본 결과(사건이 결과를 정의하면 그쪽을 씀)",
    "trap_detect":  { "name": "함정 감지", "stat": "kno", "skill": "search", "partial": false, "dc": { "kind": "region" } },
    "trap_disarm":  { "name": "함정 해제", "stat": "dex", "skill": "search", "partial": true,  "dc": { "kind": "region" },
                      "partial_effects": [ { "type": "add_time", "sec": 10 }, { "type": "add_fatigue", "value": 2 } ] },
    "trap_evade":   { "name": "함정 회피", "stat": "dex", "skill": "mobility", "partial": true, "dc": { "kind": "region" }, "partial_mult": 0.5 },
    "terrain":      { "name": "험로 건너기", "stat": "dex", "skill": "mobility", "partial": true, "dc": { "kind": "region" },
                      "partial_effects": [ { "type": "add_fatigue", "value": 5 } ] },
    "pathfinding":  { "name": "길찾기", "stat": "kno", "skill": "search", "partial": false, "dc": { "kind": "region" },
                      "fail_effects": [ { "type": "sortie_mod", "remaining_add": { "scenes": 1 } } ] },
    "forage":       { "name": "채집", "stat": "kno", "skill": "search", "partial": true, "dc": { "kind": "region" }, "partial_mult": 0.5 },
    "mining":       { "name": "채취(광맥)", "stat": "str", "skill": "search", "partial": true, "dc": { "kind": "region" }, "partial_mult": 0.5,
                      "fail_effects": [ { "type": "add_fatigue", "value": 6 } ] },
    "ambush":       { "name": "매복 대응", "stat": "dex", "skill": "mobility", "partial": false, "dc": { "kind": "region" } },
    "stealth":      { "name": "은밀", "stat": "dex", "skill": "mobility", "partial": true, "dc": { "kind": "region" } },
    "flee":         { "name": "도주", "stat": "dex", "skill": "mobility", "partial": false, "dc": { "kind": "level_formula", "base": 10, "div": 2, "source": "max_enemy_level" } },
    "fear":         { "name": "공포", "stat": "wil", "skill": null, "partial": true, "dc": { "kind": "region" }, "gate_add": 4,
                      "partial_effects": [ { "type": "temp_mod", "modifier": { "target": "hit", "op": "add", "value": -1 }, "scope": "encounters", "count": 1 } ],
                      "fail_effects": [ { "type": "temp_mod", "modifier": { "target": "retreat_hp_add", "op": "add", "value": 0.10 }, "scope": "sortie" } ] },
    "haggle":       { "name": "흥정", "stat": "soc", "skill": "negotiation", "partial": true, "dc": { "kind": "fixed", "value": 12 }, "partial_mult": 0.5 },
    "persuade":     { "name": "설득", "stat": "soc", "skill": "negotiation", "partial": true, "dc": { "kind": "event" } },
    "bond":         { "name": "인연", "stat": "soc", "skill": "negotiation", "partial": true, "dc": { "kind": "event" } },
    "ruin_lore":    { "name": "유적 해석", "stat": "kno", "skill": "search", "partial": true, "dc": { "kind": "region", "offset": 4 } },
    "lore":         { "name": "전승 기억", "stat": "kno", "skill": null, "partial": true, "dc": { "kind": "event" } },
    "force":        { "name": "힘쓰기", "stat": "str", "skill": null, "partial": true, "dc": { "kind": "region" },
                      "partial_effects": [ { "type": "add_fatigue", "value": 5 } ] },
    "weather":      { "name": "날씨 견디기", "stat": "wil", "skill": "survival", "partial": true, "dc": { "kind": "region", "offset": -4 },
                      "fail_effects": [ { "type": "add_fatigue", "value": 10 } ] },
    "curse":        { "name": "저주 저항", "stat": "wil", "skill": null, "partial": false, "dc": { "kind": "event" } },
    "injury":       { "name": "부상 판정", "stat": "wil", "skill": "survival", "partial": false, "dc": { "kind": "level_formula", "base": 12, "div": 3, "source": "region_level" } },
    "final":        { "name": "최후 판정", "stat": "wil", "skill": null, "partial": false, "dc": { "kind": "fixed", "value": 15 }, "luck_div": 2 },
    "attack":       { "name": "명중", "stat": "weapon", "skill": "melee", "partial": false, "dc": { "kind": "enemy_ac" } },
    "attack_event": { "name": "명중(사건)", "stat": "weapon", "skill": "melee", "partial": false, "partial_event_defined": true, "dc": { "kind": "event" } }
  },
  "combat": {                                           "_comment": "01 §4, 05 §7, 07 §2",
    "max_rounds": { "normal": 12, "elite_gate": 20, "boss_gate": 36 },
    "stalemate_xp_ratio": 0.3, "crit_mult": 2, "fumble_enemy_bonus": 2,
    "ambush": { "chance": 0.10, "night_add": 0.05, "fail_enemy_hit_add": 2 },
    "flee": { "hp_ratio_mult": 0.5, "fail_enemy_hit_add": 2 },  "_note": "도주 조건 HP ≤ 최대 HP × 퇴각 기준 × 0.5(05 §7.5)",
    "night": { "enemy_level_add": 1, "risk_add": 1,
               "modifiers": [ { "target": "check.stealth", "op": "add", "value": 2 },
                              { "target": "check.ambush", "op": "add", "value": 2 } ],
               "sight_checks": ["pathfinding", "forage", "trap_detect"], "sight_penalty": -1 },
    "gate_potion": { "hp_ratio_lte": 0.30, "uses": 1 },
    "dungeon_room_level_div": 2
  },
  "enemy_formula": {                                    "_comment": "01 §5.1. 런타임 적 수치의 출처 + V17 경고 기준(아래 필드 규칙)",
    "normal": { "hp": { "base": 8, "per_level": 2.3 }, "ac": { "base": 10, "div": 3 }, "hit": { "base": 2, "div": 3 },
                "dmg_min": { "base": 1, "div": 6 }, "dmg_max": { "base": 2, "div": 2.5 },
                "xp": { "base": 6, "per_level": 3 }, "coins": { "base": 3, "per_level": 1.5, "growth": 1.08 } },
    "elite": { "hp_mult": 2.5, "ac_add": 0, "hit_add": 2, "dmg_mult": 1.3, "xp_mult": 2.5, "coins_mult": 2.5 },
    "boss":  { "hp_mult": 5,   "ac_add": 2, "hit_add": 3, "dmg_mult": 1.5, "xp_mult": 10,  "coins_mult": 10 },
    "rounding": { "base": "round", "hp_mult": "round", "dmg_mult": "ceil", "xp_coins_mult": "floor" }
  },
  "recovery": {                                         "_comment": "01 §6.1, 04 §8, 07 §5.3",
    "breather_hp_ratio": 0.04,
    "camp": { "sec": 60, "hp_ratio": 0.30, "fatigue": -40, "no_ration_mult": 0.5 },
    "inn": { "hp_ratio": 1.0, "cost": { "base": 5, "per_level": 2 }, "max_times": 2 },
    "lodging": { "hp_ratio": 1.0, "max_times": 2 },
    "town_rest_when": { "hp_ratio_lt": 0.90, "fatigue_gt": 20 },
    "rest_point": { "sec": 60, "hp_ratio": 0.15, "fatigue": -15 }
  },
  "injury": {                                           "_comment": "01 §6.2",
    "light_cap": 2,
    "light":   { "stat_add": -1, "heal_min": 3, "cost": { "base": 10, "per_level": 3 } },
    "serious": { "stat_add": -2, "cost": { "base": 40, "per_level": 12 }, "clinic_min": 6, "free_min": 12 }
  },
  "defeat": {                                           "_comment": "01 §6.3, 07 §8",
    "coin_loss_ratio": 0.5, "material_loss_ratio": 0.5, "item_loss_count": 1,
    "return_travel_mult": 1.5, "arrive_hp_ratio": 0.10,
    "rescuers": {
      "field":   [ { "id": "patrol", "weight": 50, "line": "순찰대가 업어 왔다." },
                   { "id": "herbalist", "weight": 30, "line": "지나가던 약초꾼이 부축했다." },
                   { "id": "river_kids", "weight": 20, "line": "여울 아이들이 어른을 불러왔다." } ],
      "dungeon": [ { "id": "mine_rescue", "weight": 70, "line": "광부 구조대가 끌어냈다." },
                   { "id": "kobold_drag", "weight": 30, "line": "코볼트가 입구에 끌어다 놓았다." } ]
    },
    "rescuer_lines": { "whistle_family": "호각 소리를 듣고 토리의 가족이 달려왔다." },
    "death_suggestions": {                              "_comment": "07 §8.3. 위에서부터 맞는 것 max개. ctx는 코드 열거(DEATH_CTX), 기준값은 value",
      "max": 2,
      "rules": [
        { "ctx": "armor_tier_below_level_tier", "text": "방어구가 이 깊이에 비해 가벼웠다." },
        { "ctx": "effective_level_below_gate", "value": 1, "text": "조금 더 준비한 뒤 도전할 수 있었다." },
        { "ctx": "potions_at_start_lte", "value": 1, "text": "회복약을 더 챙길 수 있었다." },
        { "ctx": "serious_injuries_gte", "value": 2, "text": "오래된 상처가 발목을 잡았다." }
      ]
    }
  },
  "risk": {                                             "_comment": "01 §7.2. 순찰 구역은 region.patrol_zone",
    "bands": [ { "max": -4, "grade": "very_low" }, { "max": -1, "grade": "low" },
               { "max": 2, "grade": "normal" }, { "max": 5, "grade": "high" }, { "grade": "reckless" } ],
    "gear_level_per_tier": 2
  },
  "economy": {                                          "_comment": "01 §9, 08",
    "tier_levels": [[1, 5], [6, 11], [12, 17], [18, 23], [24, 30]],
    "tier_price": [120, 380, 1100, 3000, 7500],
    "slot_price_mult": { "weapon": 1.0, "armor": 0.9, "accessory": 0.8, "relic": 1.5 },
    "grade_price_mult": { "common": 1.0, "good": 2.2, "rare": 5.0 },
    "tier_base": [ { "weapon_dmg": [2, 5],   "armor_ac": 1, "armor_hp": 0 },
                   { "weapon_dmg": [5, 10],  "armor_ac": 3, "armor_hp": 5 },
                   { "weapon_dmg": [8, 16],  "armor_ac": 5, "armor_hp": 10 },
                   { "weapon_dmg": [12, 22], "armor_ac": 7, "armor_hp": 15 },
                   { "weapon_dmg": [17, 29], "armor_ac": 9, "armor_hp": 20 } ],
    "grade_stats": { "common": { "dmg_mult": 1.0, "hit": 0, "ac": 0 }, "good": { "dmg_mult": 1.15, "hit": 1, "ac": 1 },
                     "rare": { "dmg_mult": 1.3, "hit": 1, "ac": 2 }, "legendary": { "dmg_mult": 1.45, "hit": 2, "ac": 3 } },
    "good_effect_chance": 0.6, "rare_effect_count": 1, "named_rare_effect_count": 2,
    "sell_ratio": 0.25, "maintenance_ratio": 0.005, "discount_cap": 0.20, "auto_buy_min_improvement": 0.08,
    "drops": {
      "hunt":           { "chance": 0.06, "grades": { "common": 90, "good": 9,  "rare": 1,  "legendary": 0 } },
      "dungeon_combat": { "chance": 0.08, "grades": { "common": 80, "good": 17, "rare": 3,  "legendary": 0 } },
      "treasure_chest": { "chance": 1.0,  "grades": { "common": 65, "good": 28, "rare": 7,  "legendary": 0 } },
      "elite_gate":     { "chance": 1.0,  "grades": { "common": 0,  "good": 60, "rare": 38, "legendary": 2 }, "legendary_as": "named_rare" },
      "boss_gate":      { "chance": 1.0,  "grades": { "common": 0,  "good": 0,  "rare": 70, "legendary": 30 } }
    },
    "material_drop": { "normal": 0.35, "elite": 1.0, "boss": 1.0 },
    "carry_limits": { "potion": 4, "ration": 3, "bandage": 2, "moon_wine": 3 },
    "bankruptcy": { "coins_lt": 20, "weapon_tier_gap_gte": 2, "or_potions_eq": 0 },
    "aid": { "end_coins": { "min": 100, "inn_mult": 3, "potion_mult": 2 }, "hunt_coin_mult": 1.2,
             "issue_items": { "weapon": "W01", "armor": "A01" } },
    "starting_kit": { "coins": 30, "consumables": { "CP01": 2, "CP06": 2 }, "items": ["W01", "A01"] },
    "shop_restock": "season",
    "bag": { "auto_sell_rare_bag_gte": 16, "rare_sell_tier_gap": 2, "field_sell_ratio": 0.8, "pending_box_cap": 10 },
    "drop_pick": { "local": 2, "local_off_tier": 1, "shop": 1 },  "_note": "08 §6.1 장비 정의 후보 가중치, 08 §9.2~§9.4 판매·가방"
  },
  "equip_eval": {                                       "_comment": "08 §7. 효과 가치 V = value × (수정자 크기 ÷ unit) × Π(맞는 mults). 수정자 크기 = add면 value, mul이면 value − 1, charges면 충전 수",
    "v_cap": 0.30, "main_activity_window": 3, "max_swaps": 3,
    "value_table": [
      { "target": "check.skill.search", "unit": 1, "value": 0.03,
        "mults": [ { "when": { "specialization": ["pathfinder"] }, "mult": 2 }, { "when": { "attitude": ["adventurous"] }, "mult": 1.5 } ] },
      { "target": "check.fear", "unit": 1, "value": 0.01,
        "mults": [ { "when": { "main_place": { "ids": ["D2", "D3", "H4", "H5"] } }, "mult": 3 } ] },
      { "target": "fatigue_gain_mult", "unit": -0.3, "value": 0.03,
        "mults": [ { "when": { "has_trait": "TI05" }, "mult": 2 }, { "when": { "not": { "main_place": { "tags": ["mine"] } } }, "mult": 0.3 } ] },
      { "target": "escape_on_defeat", "unit": 1, "value": 0.08,
        "mults": [ { "when": { "attitude": ["challenging"] }, "mult": 1.5 }, { "when": { "policy": { "key": "lethal_allowed", "value": true } }, "mult": 2 } ] },
      { "target": "check.trap_detect", "unit": 1, "value": 0.015,
        "mults": [ { "when": { "num": { "key": "activity_weight.dungeon", "op": ">=", "value": 25 } }, "mult": 2 } ] },
      { "_note": "나머지 행(기동·행운·이동·발견·광맥·선제 명중·패배 손실·부상 판정·밤 은밀)도 08 §7.3 표를 같은 모양으로 옮긴다. item_effect는 value_pct를 쓴다" }
    ]
  },
  "inheritance": {                                      "_comment": "01 §14, 12, 06 §6. 자녀 후보 최대 수는 S02 사건의 max_per_life가 단일 출처",
    "relic_designations_max": 2, "relics_passed": { "retired": 2, "died": 1, "long_sleep": 2 },
    "coin_ratio": { "retired": 0.2, "died": 0.1, "long_sleep": 0.2 }, "coin_cap": 360,
    "trait_inherit": { "max": 2, "from_parent_max": 1, "chance_positive": 0.35, "chance_negative": 0.18 },
    "retiree_visible_until_heir_age": 30,
    "lifespan": { "extend_cap": 98 },
    "early_retire": { "min_age": 25, "confirm_below": 30 },
    "household_age": [28, 34],
    "family_forms": { "spouse": 50, "partner": 30, "co_parenting": 20 },
    "partner_trait_count": { "1": 70, "2": 30 },
    "collateral": { "count_weights": { "1": 60, "2": 40 }, "no_sibling_chance": 0.10 },
    "adoption": { "count_weights": { "1": 55, "2": 45 }, "disciple_ratio": 0.33 },
    "sibling_trait_share": 0.5,
    "appearance": { "direct":     { "hair": { "parent": 50, "partner": 35, "random": 15 }, "eyes": { "parent": 50, "random": 50 } },
                    "collateral": { "hair": { "parent": 25, "random": 75 } } },
    "parent_call": { "options": [ { "text": "어머니", "weight": 45, "collateral": "이모" },
                                  { "text": "아버지", "weight": 45, "collateral": "삼촌" },
                                  { "text": "부모님", "weight": 10, "collateral": "큰 어른" } ],
                     "adopted": { "text": "스승님", "chance": 0.5 } },
    "time_jump_min": 216, "fallback_guardian_npc": "N04",
    "relic_notice_age": 65,
    "relic_score": { "grade": { "common": 1, "good": 3, "rare": 6, "legendary": 10 }, "unique_add": 4, "tier_mult": 1,
                     "story": { "worn_min_div": 60, "worn_cap": 5, "record_cap": 3 },
                     "tie_slot_order": ["weapon", "relic", "accessory", "armor"] },
    "chronicle_major": { "clamp": [4, 6], "score_gte": 5 },
    "new_innate_count": { "0": { "1": 55, "2": 35, "3": 10 }, "1": { "0": 35, "1": 50, "2": 15 }, "2": { "0": 60, "1": 40 } },
    "innate_reroll_max": 10,
    "childhood": { "chance": 0.05, "max_per_life": 4, "text_id": "journal.family.childhood" }
  },
  "events": {                                           "_comment": "10 §3~§4, §6, §8.2",
    "trigger_chance": { "adventure_event_scene": 1.0, "dungeon_event_room": 1.0, "dungeon_after_room": 0.05,
                        "town_return": 0.40, "camp": 0.25 },
    "chain_priority_chance": 0.5, "chain_town_stage_chance": 1.0,
    "min_gap_sec": 90, "max_life_per_sortie": 3,
    "diversity": { "recent_window": 5, "same_place_threshold": 3, "same_place_mult": 0.5 },
    "fortune_cap": 0.9,
    "reward": { "check_success_xp_units": 0.5, "crit_bonus_mult": 1.5, "fumble_fatigue": 5 },
    "default_hold_line": "{name:이/가} 결정을 기다린다",
    "default_hold_animation": { "action": "sit_eat", "props": ["book"] },
    "quiet_room": { "fatigue": -3, "line": "갱도 저편에서 종소리가 작게 울렸다." },  "_note": "quiet_room.line은 dungeon_floor.quiet_line이 없을 때의 기본값"
  },
  "choice_ai": {                                        "_comment": "10 §5.3~§5.4",
    "low_success_p": 0.40,
    "risk_map": { "none": "very_low", "low": "low", "medium": "normal", "high": "high" },
    "reason_lines": {
      "attitude": "{attitude} 방침에 따라 {choice_short}.",
      "trait_changed": "{attitude} 방침이었지만, {trait_reason} {choice_short}.",
      "trait_confirmed": "{trait_name} 덕분에 망설이지 않고 {choice_short}.",
      "risk_blocked": "위험을 피하라는 방침대로 {choice_short}.",
      "no_option": "달리 길이 없어 {choice_short}."
    },
    "trait_confirm_min_bonus": 2
  },
  "activity_ai": {                                      "_comment": "04 §4~§8, §10",
    "filters": { "dungeon_block_light_injuries": 2, "no_potion_max_risk": "low" },  "_note": "F4 경상 2개 → 던전 제외, F6 회복약 0 → low 초과 제외",
    "dungeon_fit_max_risk_diff": 2,
    "town_routine_sec": { "arrive": 3, "light_treat_each": 10, "sell": [10, 20], "supplies": [5, 10], "gear": [10, 30],
                          "maintenance": 3, "family": [0, 40], "depart": 3 },
    "town_idle_sec": [3, 5],
    "repeat": { "free": 1, "step": 0.15, "floor": 0.5 },
    "trait_sum_cap": [-15, 15],
    "mission": { "base": 15, "overdue_min": 60, "overdue_add": 15, "elder_mult": 2, "cap": 60, "priority_sorties": 3 },
    "explore": { "unvisited": 10, "discovery_left": 5 },
    "life_stage_weight": { "elder": { "dungeon": -10, "hunt": 5 } },
    "location_score": { "base": 10, "risk_diff_mult": 3, "chain_stage": 10, "unvisited": 5, "discovery_left": 3,
                        "travel_div": 10, "trait_cap": [-15, 15], "pick_weights": [70, 30] },
    "deficit": { "window": 3, "exclude_decisions": 5, "min_sorties": 3,
                 "line": "{place:은/는} 요즘 벌이가 시원찮다." },
    "camp": { "max_per_sortie": 1, "max_elapsed_min": 10 },
    "potion_margin": 0.10,
    "hunt": { "target_jitter": 2, "safety_cap_encounters": 18, "safety_cap_min": 15 },
    "adaptation_returns": 3,
    "low_cap_notice_streak": 10,
    "lines": { "low_cap": "방침대로 익숙한 길만 걸었다.", "forced_nearby": "몸을 추스르려 가까운 길을 골랐다.",
               "lost_destination": "익숙한 길이 사라졌다." },
    "travel_time_floor": 0.6
  },
  "first_sortie": {                                     "_comment": "01 §9.5, 04 §7.2, 10 §3.4 (D21)",
    "when": { "first_sortie_of_character": true },
    "location": "H1", "activity": "hunt", "encounters": 8,
    "guaranteed_drop":  { "when": { "first_sortie_of_family": true }, "encounter": 3, "item": "A02", "grade": "common" },
    "guaranteed_event": { "when": { "first_sortie_of_family": true }, "after_encounter": 2, "event": "L01", "choice": "careful",
                          "reason": "처음 보는 약초라 하나씩 살폈다." }
  },
  "dungeon": {                                          "_comment": "07 §5. loss_model의 보물·휴식 항은 region.treasure_table·chest.trapped·trap_loss·recovery.rest_point를 읽는다",
    "first_room_kinds": ["combat", "treasure"], "no_repeat": ["rest"], "max_run": { "trap": 2 },
    "treasure_guarantee_min_rooms": 4, "validate_loss_cap": 0.75, "retries": 5,
    "room_coin_mult": 1.2,                              "_note": "01 §9.4 던전 전투 방 동전 ×1.2",
    "loss_model": { "combat_base": 0.11, "pair_mult": 1.1, "level_coef": 0.08, "level_clamp": [0.5, 2.0],
                    "trap_loss": 0.10, "event": 0.03 },
    "gate_prep": { "hp_below": 0.70, "max_potions": 2 },
    "chest": { "locked": 0.5, "trapped": 0.15, "lock_tries": 2, "coin_units": 3, "material": 1,
               "trap_fail": [ { "type": "chance", "p": 0.5, "then": [ { "type": "damage", "hp_ratio": 0.10 } ],
                                "else": [ { "type": "add_fatigue", "value": 10 } ] } ],
               "break": { "check": "force", "dc_offset": 2, "downgrade_chance": 0.3 } },
    "vein": { "check": "mining", "coin_units": 4, "fail_units": 1 },
    "trap_flow": { "disarm_fail_evade_bonus": 2, "disarm_parts_units": 1 },
    "remnant": { "rank": "elite", "level_div": 2 }
  },
  "adventure": {                                        "_comment": "07 §6",
    "scene_coin_units": 0.5, "discovery_xp_units": 3,
    "discovery": { "fail_bonus_step": 1, "fail_bonus_cap": 3, "notebook_dc_add": -4, "shifted_per_route": 2 },
    "path": { "check": "terrain", "fail": [ { "type": "damage", "hp_ratio": 0.06 }, { "type": "add_fatigue", "value": 5 } ],
              "detour_fatigue": 3, "success_next_scene": "discovery" },
    "forage": { "check": "forage", "coin_units": 1.5, "crit_potion": 1 },
    "map": { "complete_modifiers": [ { "target": "travel_time_mult", "op": "mul", "value": 0.85 },
                                     { "target": "check.pathfinding", "op": "add", "value": 2 } ] }
  },
  "ui": {                                               "_comment": "01 §16, 14, 13 §9",
    "window": [520, 64], "compact_window": [320, 48], "detail_window": [480, 560],
    "line_target": [15, 25], "line_max": 28, "line_min_sec": 4, "important_line_sec": 8, "line_queue_max": 5,
    "name_len": [1, 6], "family_name_len": [2, 8],
    "journal_keep": 300, "last_chapter_keep": 50
  },
  "offline": { "cap_sec": 28800, "min_sec": 60, "autosave_sec": 30, "backups": 3 },  "_note": "생애 단계 경계 정지의 경계는 aging.life_stages",
  "specializations": {                                  "_comment": "05 §5.2, §8.2, 04 §5.2, 08 §7.4. 키는 코드 열거 SPECIALIZATIONS(DS-30)",
    "guardian": {
      "modifiers": [ { "target": "hp_max_mult", "op": "add", "value": 0.15 }, { "target": "ac", "op": "add", "value": 1 },
                     { "target": "hit", "op": "add", "value": 1, "when": { "combat_kind": ["elite_gate", "boss_gate"] } },
                     { "target": "check.injury", "op": "add", "value": 1 } ],
      "activity_weight_add": { "dungeon": 5, "adventure": -5 },
      "skill_use_mult": { "melee": 1.25, "survival": 1.25 },
      "growth": { "primary": "str", "secondary": "wil" },
      "eval_armor_add": 0.2
    },
    "pathfinder": {
      "modifiers": [ { "target": "check.trap_detect", "op": "add", "value": 2 }, { "target": "check.trap_disarm", "op": "add", "value": 2 },
                     { "target": "check.forage", "op": "add", "value": 2 }, { "target": "check.pathfinding", "op": "add", "value": 2 },
                     { "target": "check.ruin_lore", "op": "add", "value": 2 }, { "target": "check.trap_evade", "op": "add", "value": 1 },
                     { "target": "travel_time_mult", "op": "mul", "value": 0.8 },
                     { "target": "discovery_chance_mult", "op": "mul", "value": 1.25 } ],
      "activity_weight_add": { "adventure": 10, "hunt": -5 },
      "skill_use_mult": { "search": 1.25, "mobility": 1.25 },
      "growth": { "primary": "dex", "secondary": "kno" },
      "eval_armor_add": 0
    }
  },
  "policy_defaults": {                                  "_comment": "01 §18.2, 16 §5.9. 콘텐츠 ID·수치만. 코드 열거 기본값은 저장 스키마에",
    "attitude": "adventurous", "reserve_custom_range": [0.1, 0.6], "reserve_custom_default": 0.3
  },
  "life_stage_rules": {                                 "_comment": "09 §1.2",
    "elder": { "chain_start": false, "event_journal_tag_mult": { "family": 2, "bond": 2 } }
  }
}
```

필드 규칙(W2가 스키마로 강제):

- 모든 섹션 필수, 섹션 안 키도 전부 필수(기본값 없음). 확장 팩은 패치로만 바꾼다. `reference_character.check_bonus`는 01 §2.4 기준 인물 판정 보정 표(D46)다.
- **같은 수치는 한 곳에만 둔다**(00 §2.4). 이 판에서 겹침을 없앴다: 최후 판정 행운 나눗수 → `check_kinds.final.luck_div`, 야영 → `recovery.camp`(시간 포함), 입원·무료 치료 시간 → `injury.serious.clinic_min/free_min`, 생애 단계 경계 → `aging.life_stages`, 던전 손실 모델의 보물·휴식 항 → `region.treasure_table`·`dungeon.chest.trapped`·`loss_model.trap_loss`·`recovery.rest_point`, 자녀 후보 최대 → S02 `max_per_life`, 한 줄 최대 길이 → `ui.line_max`(스키마의 `line`은 표식만), 장비 단계 수 → `economy.tier_levels` 길이, 수명 연장 상한 → `inheritance.lifespan.extend_cap`, 흡혈귀 수치 → TM01 `trait.mutation`(5.6).
- `balance` 안의 ID 참조(`first_sortie.location` → region, `first_sortie.guaranteed_drop.item` → item, `guaranteed_event.event` → event, `economy.aid.issue_items` → item, `starting_kit` → consumable·item(record 키도 ref), `inheritance.fallback_guardian_npc` → npc, `policy_defaults.attitude` → attitude, `equip_eval.value_table[].mults[].when` 안의 ID)는 ref로 선언해 V2 대상이 된다. **코어 코드는 이 값을 읽을 뿐 ID를 쓰지 않는다**(I04). 저장 스키마의 방침 기본값 `attitude`도 여기서 읽는다(코드에 `adventurous`를 두지 않음).
- `defeat.death_suggestions.rules[].ctx`는 코드 열거 `DEATH_CTX`(`armor_tier_below_level_tier` `effective_level_below_gate` `potions_at_start_lte` `serious_injuries_gte`)이며, 엔진이 사망 기록(07 §8.3)에서 계산한다. 기준 수치는 `value`. 치명 허용 문장과 기본 문장은 관문별로 `region.gate.lines`에 둔다(아래).
- `defeat.rescuers`의 키는 `rescuer_table`, `rescuer_lines`의 키는 `rescuer`, `economy.drops`의 키는 `drop_table`, `economy.carry_limits`의 키는 `carry_group` 이름공간이다(1.3). 팩이 merge로 표를 더하면 region·효과가 새 키를 가리킬 수 있다.
- `check_kinds.*.dc.kind`: `region`(지역 기준 + `offset`) / `fixed`(`value`) / `event`(사건이 정함) / `enemy_ac` / `level_formula`(`base + ⌊source/div⌋`). 사건이 덮어쓰는 규칙은 5.10 `check`. `stat: "weapon"`은 무기 능력치. `partial_event_defined: true`는 사건이 `partial_allowed: true`로 켤 수 있는 종류(05 §6.1 명중(사건)).
- `check_kinds.*`의 `partial_effects?: effect[]`(부분 성공 비용), `partial_mult?: ratio`(부분 성공 시 보상·피해·할인 배수: 수확·광석 절반, 함정 피해 절반, 흥정 할인 절반), `fail_effects?: effect[]`(실패 기본 결과)는 05 §6.1 표를 옮긴 것이다. 사건이 그 결과를 정의하면 사건 쪽을 쓴다. 흐름 결과(함정 발동 → 회피, 발각 → 정상 전투, 중상, 사망)는 엔진 절차라 적지 않는다. 광맥 실패 피로는 `mining.fail_effects`가 단일 출처이고 `dungeon.vein`은 광석 단위만 가진다. `dungeon.trap_flow`(해제 실패 뒤 회피 +2, 부품 단위)는 05 §6.1에 없는 07 절차 값이다.
- `check.fumble_table`은 05 §6.4 가벼운 곤란 표(무작위 1개, `weight` 가중). 대실패 결과를 따로 정한 사건은 그것을 쓴다.
- **`enemy_formula`는 런타임 적 수치의 출처다.** 레벨이 바뀐 적(던전 방 `+⌊순번/2⌋`, 밤 `+1`, 관문 잔당 `+⌊방 수/2⌋` 정예화, 08 §7.1 기준 적)은 이 공식으로 다시 계산한다. 규칙: 레벨 오프셋이 0이면 enemy 정의값, 아니면 공식(rank 배수 포함). 반올림은 `rounding`(기본식 반올림, 체력 배수 반올림, 정예·보스 피해 배수 올림, 경험치·동전 배수 뒤 내림 — 01 §5.2 소수 처리, 05 §3.2). 관문 적의 밤 +1 적용 여부는 DS-37.
- `specializations`는 05 §8.2 표다. `modifiers`는 전문화 인물에게 항상 붙는 수정자, `activity_weight_add`는 04 §5.2 활동 가중, `skill_use_mult`는 05 §5.2, `growth`는 05 §4.2 주·부 능력치, `eval_armor_add`는 08 §7.4 방어구 배수 가산. 이동 감소 하한은 `activity_ai.travel_time_floor`.
- `equip_eval.value_table`의 장소 조건은 장소 ID 대신 `main_place` 거르개로 쓴다(데이터 안의 ID는 허용, 코드는 모름). 저주 효과는 계산하지 않는다(08 §7.3).
- `choice_ai.risk_map`은 선택지 위험(10 §5.4)을 활동 위험 등급으로 옮겨 위험 허용 상한과 비교하는 표다. `lethal`은 첫 검증판에서 금지(V10)라 표에 없다.
- `life_stage_rules.elder`: 노년기에는 새 연속 사건을 시작하지 않고, `intro.tag`가 `family`·`bond`인 사건의 가중치를 곱한다(09 §1.2, DS-41).
- **01 §17 밸런스 검증 목표 범위는 balance 밖**이다. 게임 규칙이 읽지 않고 시뮬레이터가 검사하므로 `tools/sim`의 기대값 파일에 둔다.
- `activity_ai.hunt.target_jitter`의 기준값은 `attitude.hunt_target_encounters`다.

### 5.2 attitude (W2)

16 §2.2 필드 + 신설. `id`는 ref("attitude") 대상.

| 필드 | 형식 | 16 | 값(안정 / 모험 / 도전) | 출처 |
| --- | --- | --- | --- | --- |
| `id` `name` `reason_label` | string | O | `stable` / `adventurous` / `challenging` | 01 §7.1 |
| `order` 신설 | int | | 0 / 1 / 2 (UI 순서) | |
| `activity_weights` | `{hunt, adventure, dungeon}` | O | 60/30/10 · 30/45/25 · 20/25/55 | 01 §7.1 |
| `retreat_hp` | ratio | O | 0.60 / 0.40 / 0.25 | 01 §7.1 |
| `return_fatigue` | int | O | 60 / 70 / 80 | 01 §7.1 |
| `max_risk` | activityRisk | O | normal / normal / high | 01 §7.1 |
| `max_risk_adventure` | activityRisk? | O | null / high / null | 01 §7.1 |
| `dungeon_depth_offset` | int | O | −1 / 0 / 0 | 04 §6.2 |
| `gate_risk_limit` | int | O | −1 / +2 / +5 | 01 §7.1 |
| `lethal_gate_risk_limit` | int | O | −1 / −1 / +2 | 01 §7.1 |
| `gate_hp_ratio` 신설 | ratio | | 0.80 / 0.70 / 0.55 | 07 §5.6 |
| `potion_reserve_n` 신설 | int | | 0 / 1 / 2 (가용 체력률에 넣는 회복약 수, 관문 조건 공통) | 07 §5.5·§5.6 |
| `dungeon_safety_k` 신설 | number | | 2.0 / 1.3 / 1.0 | 07 §5.5 |
| `buy_targets` 신설 | `record(carry_group, int)` | `potion_target` 대체(DS-11) | potion 4/3/2, ration 2/2/2, bandage 1/1/2, moon_wine 2/2/2 | 08 §4.1 |
| `bandage_use_at` 신설 | int | | 1 / 2 / 2 (경상 개수) | 08 §4 |
| `eval_mult` 신설 | `{weapon: number, armor: number}` | | 0.8/1.2 · 1.0/1.0 · 1.2/0.8 (개선률 태도 배수) | 08 §7.4 |
| `light_treat` 신설 | `{min_injuries: posInt, if_dungeon_candidate: bool}` | | `{1, false}` / `{2, true}` / `{2, false}` — 경상 개수가 min 이상이거나(if 켜짐) 다음 활동 후보에 던전이 있으면 치료 | 08 §8 |
| `reserve_ratio` | ratio | O | 0.40 / 0.30 / 0.20 | 01 §7.1 |
| `hunt_target_encounters` | int | O | 8 / 10 / 12 | 04 §7.2 |
| `adventure_scenes` 신설 | range | | [3,4] / [4,5] / [5,6] | 04 §7.3 |
| `location_target_risk` 신설 | int | | −2 / 0 / +2 | 04 §6.1 |
| `fit_coef` 신설 | `{very_low, low, normal, high}: ratio` + `high_adventure?` | | 안정 0.6/1.0/1.0/0.8(DS-16) · 모험 0.6/0.9/1.0/0.8, high_adventure 0.8 · 도전 0.6/0.9/1.0/1.0 | 04 §5.2 |
| `retreat_camp` 신설 | bool | | false / false / true (퇴각 기준에서 식량 있으면 야영) | 04 §7.5 |
| `shortcut` 신설 | `{chance: ratio, force_when?: condition}` | | 0 / 0.5 + `{"any":[{"trait_hook":"prefer_shortcut"},{"skill_rank_gte":{"skill":"mobility","rank":2}}]}` / 1.0 | 07 §6.2 |
| `disarm_when` 신설 | condition | | `{"any":[{"skill_rank_gte":{"skill":"search","rank":2}},{"trait_hook":"attempt_disarm"}]}` / 같음 / `true` | 07 §5.3 |
| `chest_break` 신설 | bool | | false / false / true | 07 §5.3 |
| `tag_scores` | `record(choiceTag, int)` 전부 | O | 10 §5.2 표 | 10 §5.2 |
| `medium_risk_penalty` | int | O | −1 / 0 / 0 | 10 §5.3 |
| `low_success_penalty` | int | O | −2 / −1 / 0 | 10 §5.3 |
| `event_pref_line` 신설 | string | | 손해·부상 회피 / 정보·새 길 / 높은 보상·정면 해결 | 01 §7.1 |

### 5.3 region (W2)

`kind` 판별 유니온(`z.discriminatedUnion("kind", …)`). 공통 필드 + 종류별 필드.

**공통**

| 필드 | 형식 | 필수 | 16 | 설명 |
| --- | --- | --- | --- | --- |
| `id` `name` | id, string | O | O | |
| `kind` | regionKind | O | O | |
| `level_range` / `level_mid` | range / int | 마을 외 O | O | |
| `travel_sec` | int | 마을 외 O | O | 마을 → 장소(던전·A4는 입구까지) |
| `descend_sec` | int? | - | O | 입구에서 층까지 하강(D2 20·D3 40·A4 40). 16 그대로 |
| `unlock` | condition | O | O | F1 해금. 후손 면제형은 `discovered` 단말(DS-06). 시작 장소는 `true` |
| `guild_rank_req` | ref("guild_rank")? | - | O | F2 |
| `patrol_zone` 신설 | bool = false | - | `guild_patrol` 대체 | F6·F7·F8 항상 통과 |
| `fallback` 신설 | bool = false | - | | 모든 후보 탈락 시 목적지(04 §3.2) |
| `aid_allowed` 신설 | bool = false | - | | 길드 지원 기간 후보(F3). 사냥터면 `aid.hunt_coin_mult` 적용 |
| `deficit_exempt` 신설 | `"always" \| "during_aid" \| "never"` = never | - | | 적자 판단 제외(04 §4.3) |
| `closes_on_succession` 신설 | bool = false | - | | 계승 때 가문 발견에서 뺌(A4) |
| `weather_exempt` | bool = false | - | O | |
| `tags` | string[] | - | O | `noisy` `dusty` `dark` `mine` 등 |
| `rescuers` 신설 | `ref("rescuer_table")`(balance.defeat.rescuers 키) | 마을 외 O | | 패배 구조자 표. 기본값을 두지 않는다(코드가 표 키 이름을 모르게). 기반 팩은 사냥터·모험 경로 `field`, 폐광 층 `dungeon`. 새 던전은 팩이 `defeat.rescuers`에 표를 merge로 더하고 이 필드로 가리킨다 |
| `background_id` | string | O | O | 15 에셋 |
| `feature_words` 신설 | string[] | - | | `{feature}` 후보(02 §6) |

**`kind: "town"`**: `facilities: {id: id(이름공간 facility), name, npc_id: ref("npc"), good_stock?: int, services?: ("inn"|"lodging"|"light_treatment"|"clinic"|"free_treatment"|"special_shop")[]}[]`. 시설 `id`는 `smithy` `general_store` `guild` `inn` `clinic`(16 §2.3.1) — 효과·장비의 `facility`가 `ref("facility")`로 가리킨다. **판매 목록(`stock`)은 시설에 두지 않는다.** 진열은 엔진이 장비의 `shop`·소모품의 `shop`을 시설별로 거꾸로 색인해 만든다(5.5). 그래서 새 장비 팩은 `items/*.json`만 넣으면 되고 T00을 패치하지 않는다.

**`kind: "hunting_ground"`**: `encounters: {enemy_id: ref("enemy"), weight}[]`(1개 이상), `pair_chance: ratio` 신설, `event_check: ratio`.

**`kind: "dungeon_floor"`**:

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `dungeon` 신설 | `{group: id, depth: posInt}` | group 값이 `dungeon_group` 이름공간을 정의한다. 같은 group 안 depth 순서. 층 순서·"더 깊은 층"을 ID 대신 이것으로 계산(DS-20). W1: group마다 depth가 1..n으로 빈틈·중복 없이 이어져야 한다(오타 group은 depth 1이 빠지거나 겹쳐 드러난다) |
| `quiet_line` 신설 | line? | 조용한 갱도(07 §5) 문장. 없으면 `balance.events.quiet_room.line` |
| `encounters` / `pair_chance` | 위와 같음 | 07 §5.1 (0.25/0.30/0.35) |
| `rooms` | range | 관문 전 방 수 |
| `room_weights` | `weightTable(ROOM_KINDS)` | 01 §8.2 |
| `trap_table` 신설 | `{trap_id: ref("trap"), weight}[]` | 07 §5.3 층별 가중치 |
| `treasure_table` 신설 | `{chest: weight, vein: weight}` | 07 §5.3 (70/30) |
| `gate` 신설 | 아래 | `gate_enemy_id`·`gate_lethal` 대체 |

`gate`:

```json
{ "enemy_id": "EB03", "lethal": true,
  "remnant": { "enemy_id": "EN10" },
  "first_clear": [ { "type": "add_item", "item_id": "W10", "to": "bag_or_pending" },
                   { "type": "add_trait", "trait_id": "TA08" },
                   { "type": "set_family_flag", "key": "fam.eb03_slain" } ],
  "lines": {
    "turn_back": "관문 앞에서 발길을 돌렸다.",
    "lethal_blocked": { "line": "부서진 종 앞에서 돌아섰다.",
                        "detail": "종이 울릴 때마다 발밑이 흔들렸다. 이곳에서 쓰러지면 돌아오지 못한다. (방침에서 치명 위험을 허용하면 도전한다)" },
    "lethal_auto_entry": "방침에 따라 부서진 종 앞에 섰다.",
    "death_line": "부서진 종 아래에서 눈을 감았다.",
    "suggest_lethal_off": "치명 위험 허용을 끄면 부서진 종 앞에서 돌아선다.",
    "suggest_default": "종은 준비된 자에게도 무겁게 울렸다."
  } }
```

- `remnant.enemy_id`는 잔당의 바탕 일반 적(정예화, 레벨 + ⌊방 수/2⌋는 `balance.dungeon.remnant`). 첫 격파 고정 보상 중 동전·재료는 적 정의에서 나온다. 가문에 W10이 이미 있으면 `add_item`이 그 장비의 `reacquire`(5.5, 08 §9.5)로 대신 준다.
- `lines.*`가 없으면 `turn_back`만 필수, 나머지는 `lethal: true`일 때 필수(W2 refine).

**`kind: "adventure_route"`**:

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `scenes` | range | 경로 장면 범위(태도 `adventure_scenes`를 이 범위로 자름) |
| `scene_weights` 신설 | `weightTable(SCENE_KINDS)` | 07 §6.1 |
| `encounters` / `pair_chance` 신설 | 위와 같음 | pair 0.10 |
| `discoveries` 신설 | 아래 | 07 §6.3 |
| `map_fragments` 신설 | `{id: id, name: string}[]` | 경로당 2개. id 예 `A1-M1` (DS-28) |
| `descend_sec` | (공통) | A4 |

`discoveries[]`:

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `id` | id(중첩 이름공간 `discovery`) | `A1-1` |
| `name` | string | |
| `condition` | condition = true | 07 표 `조건` (`{"discovery_found":"A2-1"}`) |
| `dc` | `{grade: "easy"\|"normal"\|"hard"\|"very_hard"\|"legend"}` | 경로 지역 기준 DC + `check.dc_step`(07 §6.3) |
| `check` | ref("check_kind") = `pathfinding` | 신설, A4 유적 해석 확장용 |
| `effects` | effect[] | 한 번 받는 보상(동전·장소 해금·아이템·수첩 기록) |
| `modifiers` | modifier[] | 발견 뒤 생애 동안 켜지는 보정(야영지·이동 단축). 장소 제한은 `when: {location: […]}`. 절대 초 단축은 `travel_sec_add.{region}`·`descend_sec_add.{region}`(A2-3, A3-5). 발견 직후 판정은 `effects`의 `roll_check`(A3-4) |
| `event_weight_mult` | `record(ref("event"), number)` | C02-1 ×2 등 |
| `map_fragment` | ref("map_fragment")? | 지도 조각 |
| `notebook_line` | template? | 가문 수첩 기록 |
| `shift_line` | template? | 길바뀜으로 바뀐 경우의 보상 문장(07 §6.5) |

```json
{ "id": "A1", "name": "여울 들길", "kind": "adventure_route",
  "level_range": [1, 8], "level_mid": 4, "travel_sec": 25,
  "unlock": true, "patrol_zone": true, "fallback": false, "aid_allowed": true, "deficit_exempt": "always",
  "scenes": [3, 5], "scene_weights": { "discovery": 25, "path": 15, "forage": 20, "encounter": 20, "event": 20 },
  "encounters": [ { "enemy_id": "EN01", "weight": 50 }, { "enemy_id": "EN02", "weight": 50 } ], "pair_chance": 0.10,
  "map_fragments": [ { "id": "A1-M1", "name": "오래된 이정표 조각" }, { "id": "A1-M2", "name": "무덤가 지도 조각" } ],
  "discoveries": [
    { "id": "A1-2", "name": "버드나무 둑 가는 길", "condition": true, "dc": { "grade": "normal" },
      "effects": [ { "type": "unlock_location", "location_id": "H2" } ] },
    { "id": "A1-6", "name": "도토리 숲 샘터", "condition": { "level_gte": 3 }, "dc": { "grade": "hard" },
      "modifiers": [ { "target": "camp_hp_mult", "op": "mul", "value": 1.10, "when": { "location": ["H1", "H2", "A1"] } } ] },
    { "id": "A1-5", "name": "여울 다리 아래", "condition": true, "dc": { "grade": "easy" },
      "event_weight_mult": { "C02-1": 2 } }
  ],
  "tags": [], "rescuers": "field", "background_id": "bg_river_path" }
```

H2의 해금은 `{"any":[{"level_gte":3},{"discovered":"H2"}]}`이다. A1-2의 `unlock_location`이 H2를 가문 발견 목록에 넣으므로 후손은 레벨 조건 없이 H2를 안다(12 §7.4). D2처럼 격파·등급 조건은 `discovered`를 쓰지 않으므로 면제되지 않는다.

### 5.4 enemy_family, enemy, material, trap, guild_rank (W2)

**enemy_family**: `id`(`rat` `wolf` `bat` `kobold` `unique`), `name`(`{enemy_kind}` 표시), `sprite_family`.

**enemy** (16 §2.4 + 신설)

| 필드 | 형식 | 16 | 비고 |
| --- | --- | --- | --- |
| `id` `name` | | O | |
| `family` | ref("enemy_family") | 열거 → ref | |
| `level` `rank` | int, ENEMY_RANKS | O | |
| `hp` `ac` `hit` | int | O | V17 경고 |
| `damage` | range | O | |
| `xp` `coins` | int | O | |
| `material_id` | ref("material")? | O | |
| `specials` | `enemySpecial[]` | O | 4.4 |
| `lethal` | bool = false | O | |

`level` `hp` `ac` `hit` `damage` `xp` `coins`는 **레벨 오프셋 0일 때의 값**이다. 레벨을 올려 쓰는 경우는 `balance.enemy_formula`로 다시 계산한다(5.1 필드 규칙).
| `sprite_family` `palette_id` | string | O | |
| `lines` | line[] 3개 이상 | O | 적 행동 문장 |
| `victory_lines` 신설 | line[] 2개 이상 | | 07 §4.2 승리 문장 |
| `exit_line` 신설 | line | | 07 §4.1 퇴장 연출 |

**material**: 16 §2.6.1 그대로. `source`는 `ref("enemy")` 또는 `"trap"`·`"forage"`·`"vein"`(유니온). `line: line`.

**trap** 신설(07 §5.3):

| 필드 | 형식 | 예(가시 발판) |
| --- | --- | --- |
| `id` `name` | | `trap_spike`, `가시 발판` |
| `detect_dc_offset` | int | 0 |
| `evade` | `{check: ref("check_kind"), dc_offset: int} \| null` | `{"check":"trap_evade","dc_offset":0}`. 먼지 구멍은 `weather`, 경보 종줄은 null |
| `disarm_dc_offset` | int \| null | 4 (null = 해제 불가) |
| `fail` | effect[] | `[{"type":"damage","hp_ratio":0.10},{"type":"chance","p":0.2,"then":[{"type":"injury","grade":"light","stat":"dex"}]}]` |
| `lines` | `{detect, disarm, evade, fail}: line` | |

경보 종줄 `fail`: `[{"type":"start_combat","enemies":[{"from_region_table":true}],"count":1,"first_strike":"default","ambush":true}]`(매복 취급, 05 §7.3). 무너지는 발판: `sortie_mod.return_travel_sec_add 20`.

**guild_rank** 신설(01 §8.3):

| 필드 | 형식 | 예(은패) |
| --- | --- | --- |
| `id` `name` | | `silver`, `은패` |
| `order` | int(견습 0 … 별패 4) | 2 |
| `condition` | condition | `{"all":[{"level_gte":12},{"defeated":"EB01"}]}` |
| `grants_text` | string | `D2 입장, 길드 특별 상점 1단계` |
| `line` | line? | 등급 상승 기록 |

별패: `{"all":[{"level_gte":24},{"safe_returns_gte":{"count":3,"where":{"dungeon_group":"bell_mine","dungeon_depth_gte":3}}}]}`.

### 5.5 item, item_effect, consumable (W3)

**item**: 16 §2.5 그대로 + 아래.

- `stat`: `"str" \| "dex" \| "best_of_str_dex"` (무기 필수, 그 밖 금지 — refine).
- `base?`: `{damage?: range, hit?: int, ac?: int, hp?: int}`(W01 `{"damage":[1,4]}`, A01 `{"ac":0}`).
- `modifiers`: modifier[] — **등급별**이 필요하면 `grade_modifiers?: partial record(grade, modifier[])` 신설(J02 행운 +1/+1/+2, J03, J04, R02 희귀 상향). 둘 다 있으면 합친다.
- `allowed_effects?` 신설: `ref("item_effect")[]` — 없으면 효과 정의의 `slots`로 결정.
- `sources`: `{kind: "shop"\|"drop"\|"event"\|"gate"\|"guild_special"\|"start"\|"aid"\|"discovery", id?: string, detail?: string}[]`. `kind: event`면 id는 ref("event"), `drop`·`discovery`면 region·discovery ref(W3 refine로 유니온). **`kind: drop` 항목은 드롭 규칙의 입력이다**(08 §6.1 장소 전용 장비): `{kind: "drop", id: ref("region"), room?: ROOM_KINDS, grade_is?: grade, chance?: ratio, once_per_life?: bool}`. `room`·`grade_is`·`chance`가 없으면 그 장소의 일반 드롭 후보(가중치 `economy.drop_pick`)이고, 있으면 그 조건에서만 나온다. J05: `{"kind":"drop","id":"D3","room":"treasure","grade_is":"rare","chance":0.5,"once_per_life":true}`.
- `shop?`: `{facility: ref("facility"), guild_rank_req?: ref("guild_rank"), grades?: grade[], pick_group?: string}[]` — **판매 선언의 단일 출처**(시설에는 `stock`이 없다). 한 장비가 여러 시설에서 팔리면 항목을 여럿 둔다(W08: 대장간 금패 + 길드 특별 상점). 같은 시설·같은 `pick_group`의 항목은 재고 갱신마다 그 가운데 1개만 진열한다(08 §5.1 길드 2단계: W08·A06 희귀 `{"facility":"guild","guild_rank_req":"gold","grades":["rare"],"pick_group":"guild_t2"}`). 레벨 기준 단계 이하 진열·좋은 등급 무작위 재고는 엔진 규칙(08 §5.1)과 `facility.good_stock`.
- `reacquire?` 신설(08 §9.5 고유 장비 재획득 대체): `{pool: ref("item")[], grade: grade}`(풀에서 균등 1개) 또는 `{reroll: true}`(그 출처의 일반 굴림을 이 장비를 빼고 다시). W07 `{"pool":["W06"],"grade":"rare"}`, W10 `{"pool":["W09","A07"],"grade":"rare"}`, J01 `{"pool":["J02"],"grade":"rare"}`, J05 `{"reroll":true}`, R03·R04 `{"pool":["W08","A06"],"grade":"rare"}`. R03 빈 병 기념품은 R03이 아니므로 가문에 없는 것으로 본다(엔진 규칙).
- `price_override?` `sellable` `sell_price_override?` 신설(W01·A01 판매가 5) `appraisal_override?` 신설(평가가 5,500 등 드롭 전용·고유).
- `visual_group` `story_template: template` `description: string` 신설(인물 탭 원문).
- J01 구조자 고정: `modifiers: [{"target":"rescuer_override","op":"set","value":"whistle_family"}, {"target":"defeat_loss_mult","op":"mul","value":0.4}, {"target":"defeat_item_loss_chance","op":"set","value":0.2}]`.

- W08 흡혈귀 규칙(09 §7.7)은 장비 데이터로: `modifiers`에 `{"target":"check.stat.soc","op":"add","value":-1,"when":{"mutation":"vampire"}}`, `{"target":"equip_eval_mult","op":"mul","value":0.9,"when":{"mutation":"vampire"}}`.

refine(V15): `unique: true` → `grade_mode: "fixed"`, `sources` ≥ 1, 그리고 `reacquire` 필수(단 `sources`가 `shop`·`guild_special`뿐이면 금지 — 가문에 있으면 진열에서 빠진다, 08 §9.5 R01).

**item_effect** 신설(08 §3.6·§3.7): `id`, `name`, `grade: "good" \| "rare"`, `slots: slot[]`, `modifiers: modifier[]`, `value_pct: number`(08 §7.3 평가 가치, `전투식`이면 null), `description`.

**consumable** (16 §2.6 + 가격 구조화, DS-08):

| 필드 | 형식 |
| --- | --- |
| `effect` | `"heal_hp" \| "camp_ration" \| "cure_minor_injury" \| "thirst_down"` (코드 열거, 확장은 등록부 후보) |
| `amount` | int |
| `tier` | tier? |
| `price` | `{kind: "fixed", value: int}` \| `{kind: "potion_of_level_tier", mult: number}` |
| `price_mods?` 신설 | modifier[] (CP06 TI08 7동전 → `food_cost_mult`로 처리하므로 보통 비움) |
| `carry_group` | `ref("carry_group")`(`balance.economy.carry_limits` 키) |
| `shop` | `ref("facility")[]` — 판매 선언의 단일 출처 |
| `requires` | condition? — 구매·진열 추가 조건(CP08 `{"all":[{"has_trait":"TM01"},{"last_trip_time":"night"}]}`). 회복약의 "레벨 기준 단계 이하" 진열은 엔진이 `tier`로 판단하므로 조건을 적지 않는다(08 §4) |
| `sellable` | `false` 고정 |

### 5.6 trait, npc, name_pool (W3)

**trait**: 16 §2.7 + `acquire` 판별 유니온 + `ai_hooks` 등록부.

```text
"acquire": { "type": "condition", "condition": { "all": [ { "has_trait": "TI07" }, { "num": { "key": "counter.fear_successes", "op": ">=", "value": 5 } } ] } }
"acquire": { "type": "counter", "counter": "wins", "threshold": 150 }
"acquire": { "type": "event", "event_id": "C01-3", "choice": "rescue" }
```

- `type: counter`는 `counter`가 `counterNames`에 있어야 하고 `where?: regionFilter`로 장소별 합산을 한다(TA02: `{"type":"counter","counter":"safe_returns","where":{"dungeon_group":"bell_mine","dungeon_depth_gte":2},"threshold":10}`).
- `type: event`의 `choice`는 그 사건 선택지 id(W1 교차 검사). **`type: event`는 표시 전용**(도감·획득 경로 안내)이고 실제 부여는 그 사건의 `add_trait` 효과가 한다. W1은 그 선택지 결과에 `add_trait`가 있는지 본다(두 경로로 두 번 얻지 않음). TA01은 11의 획득 시점(귀환 시)대로 C01-3 구조 결과의 `on_town_return` 안에서 준다.
- `kind: innate`면 `acquire` 금지, `acquired`·`mutation`이면 필수(refine).
- `effect_text` 신설(D77): string, 필수 — 인물 탭 특성 줄 아래와 `[특성]` 획득 상세 둘째 줄에 보이는 효과 글. 01 §11 `핵심 효과` 열을 옮긴다(80자 이내, 검사 W3).
- `birth_weight` 신설: nonNegInt, `kind: innate` 필수 — 06 §6.3 신규 선천 특성 추첨 가중치(TI01 14, TI05 8 …).
- `birth_stat_weights` 신설: stat[]? — 05 §2.2 출생 분배에서 이 특성이 가중하는 능력치(TI01 `["str","wil"]`). 가산값은 `balance.growth.trait_birth_add`.
- `mutation?` 신설: `kind: mutation` 전용. **변이 수치의 단일 출처**(balance에 변이 섹션을 두지 않는다). 코어는 DS-30대로 변이 종류를 코드 열거로 알지만 수치는 이 키에서만 읽는다.

| 필드 | 형식 | TM01 값(09 §7) |
| --- | --- | --- |
| `stat_add` | `partial record(stat, int)`, `stat_floor: int` | `{str:1, dex:1, wil:1, soc:-1}`, floor 1 |
| `natural_cap_add` | `partial record(stat, int)` | `{str:1, dex:1}`(힘·민첩 상한 9) |
| `no_aging_loss` | bool | true(변이 뒤 60·70·80세 감소 없음) |
| `blocks_lifespan_extension` | bool | true |
| `time_ratio` | `{day: ratio, night: ratio}` | 0.2 / 0.8 |
| `time_modifiers` | `{day: modifier[], night: modifier[]}` | **출정 중 그 시간대에만** 적용. 밤: 명중 +1, 피해 +10%, 숨 고르기 ×2, `recovery_coef` 1.0 / 낮: `check.all` −2, 피로 획득 ×1.5, `recovery_coef` 0.7 |
| `modifiers` | modifier[] | 시간대와 무관하게 붙는 것. 마을 규칙은 `in_town` 조건으로 쓴다: `recovery_coef` 0.9 `when {in_town: true}`, 상점 할증(아래) |
| `thirst` | `{per_min, day_sortie, night_win, elite_boss, auto_drink: {sortie_gte, town_gte}, stages: {id, from, modifiers?: modifier[], night_ratio?: ratio, line?: line}[]}` | 2, 5, −3, −15, `{60, 40}`, 평온 0 / 목마름 40(`check.stat.soc` −1) / 굶주림 70(`check.all` −1, `night_ratio` 1.0) / 한계 직전 90 / 한계 100 |
| `blood_rest` | `{min: effMin, thirst_add: int, cures: "serious"}` | 6분, +20 — 치료소 대신(무료) |
| `cellar_rest_sec` | int | 120(여관비 같음, 효과는 여관 휴식) |
| `blocked_triggers` | `{trigger: EVENT_TRIGGERS, when: condition}[]` | `[{"trigger":"camp","when":{"time_of_day":"day"}}]` — 조건이 참이면 그 판단 지점의 사건을 모두 뺀다(10 §4.1 흡혈귀 낮 야영 사건 제외). 사건마다 조건을 복사하지 않는다 |
| `sleep` | `{add_years, cap}` | 30, 118(09 §7.6) |

TM01 낮 귀환 상점 할증(09 §7.4)과 F03 단서 면제(11 F03, 16 §4.5)는 가격 계산이 플래그를 읽지 않고 **수정자 조건**으로 쓴다(DS-38):

```json
{ "target": "shop_surcharge", "op": "add", "value": 0.2,
  "when": { "all": [ { "in_town": true }, { "last_trip_time": "day" }, { "not": { "flag": "life.f03_clue" } } ] } }
```

- `lines: line[]`(2개 이상), `reason_phrase?`, `name_adj?` 신설(`{trait_adj}`, 14 §7.2).

**npc**: 16 §2.8에서 `descendant_reactions` 필드를 뺀다(5.7 종류로 이동, DS-10). `home: ref("region")`, `facility?: string`, `events: ref("event")[]`, `successors[{from_generation, name, _note}]`.

**name_pool**: `{id, given_names: string[], family_names: string[], partner_jobs?: string[]}`. 엔진은 모든 풀을 합친다(배열 패치 없이 팩이 풀을 더함). 이름 규칙은 `balance.ui.name_len`.

### 5.7 background, achievement, epithet, retire_role, descendant_reaction, prop (W3)

**background** (12 §8.1): `id`, `name`, `start_skill: skill | null`, `fixed_stat: stat | null`, `unlock: {achievement: ref("achievement")} | null`(null = 처음부터), `intro_line: template`.

**achievement** (12 §8.4): `id`(`AC01`~`AC17`, DS-12), `name`, `condition`, `rewards: ({kind:"background", id: ref("background")} | {kind:"appearance", id: string} | {kind:"title", text: string} | {kind:"start_option", id: "birth_season"} | {kind:"family_tab", id: string})[]`, `line?: line`.

| # | 조건(데이터) |
| --- | --- |
| AC01 | `{"all":[{"discovered":"H1"},{"discovered":"H2"},{"discovered":"H3"},{"discovered":"A1"}]}` |
| AC02 | `{"all":[{"visited":"D1"},{"visited":"D2"},{"visited":"D3"}]}` |
| AC09 | `{"codex_count_gte":{"codex":"items","count":13}}` |
| AC10 | `{"num":{"key":"family_counter.inn_rests","op":">=","value":100}}` |
| AC13 | `{"age_gte":78}` |
| AC15 | `{"codex_complete":"enemies"}` |
| AC16 | `{"discovery_found":"A4-6"}` |
| AC17 | `{"num":{"key":"counter.map_fragments","op":">=","value":8}}` |

업적 판정 시점: 판단 지점마다(가문 1회, 이미 달성은 건너뜀). 엔진 규칙이며 데이터는 조건만 둔다.

**epithet** (12 §7.5): `id`, `priority: int`(작을수록 먼저), `condition`, `template`. 생애 종료 2단계에서 priority 순 첫 참. 예: 1순위 `{"all":[{"mutation":"vampire"},{"received_relic":"R04"}]}` → `"{parent_call}의 잔을 비운 {name}"`, 8순위 `{"all":[{"life_end_kind":["died"]},{"died_at":{"ids":["D3"]}}]}`, 15순위 `true`.

**retire_role** (09 §4.1):

| 필드 | 형식 | 예(길드 교관) |
| --- | --- | --- |
| `id` `name` | | `instructor`, `길드 교관` |
| `base_points` | int | 0 (편지 가족 1) |
| `score` | `{when: condition, points: int}[]` | `[{"when":{"skill_rank_gte":{"skill":"melee","rank":4}},"points":1},{"when":{"has_trait":"TA05"},"points":2},…]` |
| `tie_winner` | bool | 편지 가족만 true |
| `heir_modifiers` | modifier[] | 여관 주인 `inn_cost_mult ×0.5` |
| `heir_events` | ref("event")[] | 교관 교육 사건 2개 |
| `letter_gift` | effect[] | 편지 가족 선물 |
| `until_heir_age` | int | 30 |
| `family_flag` | flagKey("fam") | `fam.retired_instructor` |
| `fallback_name?` | string | `길드에 이름을 남긴 선배` |

**descendant_reaction** 신설(12 §7.6):

| 필드 | 형식 | 예 |
| --- | --- | --- |
| `id` | id | `dr_c01_rescue` |
| `flag` | flagKey("fam") | `fam.c01_rescue` |
| `window_generations` | posInt \| `"permanent"` | 3 |
| `events` | ref("event")[] | `["C01-FAM-THANKS"]` |
| `npc?` | ref("npc") | `N05` |
| `summary` | string | `감사의 식탁` |

반응 사건은 조건 `{"reaction_active":"dr_c01_rescue"}`로 기간을 검사한다. 기간 계산(플래그를 남긴 인물의 다음 세대 = 1)은 엔진이 `family.flag_meta`(6절 C12)로 한다.

**prop** 신설: `id`(`book` `map` `cup` `moon_fx` …), `name`, `asset_id`.

### 5.8 flag (W4)

`flags.json` = 16 §5.2 등록표를 옮긴 배열.

| 필드 | 형식 | 예 |
| --- | --- | --- |
| `id` | 전체 키(`flagKey()` 패턴, `def()`를 쓰지 않음). 키 묶음은 16과 같은 자리 이름 `{place}`·`{kind}`·`{role}` | `"life.l01_marked_{place}"`, `"fam.retired_{role}"` |
| `scope` | `life` \| `fam` \| `trip` (id 접두와 일치) | |
| `value` | `"bool"` \| `{int: [min, max]}` | `{"int":[0,3]}` |
| `family?` | `{slot: RefKind \| "specialization"}` | `{"place":"region"}`, `{"role":"retire_role"}`, `{"kind":"specialization"}` — 키 묶음의 자리 종류 |
| `set_by` / `read_by` | string | 문서 참조(설명) |
| `trip_modifiers?` | modifier[] | trip 플래그의 출정 동안 효과의 **단일 출처**(`trip.fear` → `check.all −1`). `set_trip_flag`에는 수정자를 두지 않는다 — 여러 사건이 같은 플래그를 세워도 효과가 하나다 |

후손 반응 기간은 `descendant_reaction.window_generations`만 가진다(등록표에 사본을 두지 않음).

V19: 모든 `flag`·`set_*_flag`·`chain_stage`·`num flag.` 키가 등록표의 고정 키 또는 키 묶음 패턴(자리에 그 종류 ID, 또는 바인딩 `{변수}` 3.1)에 맞아야 한다. 바인딩은 `place`이거나 그 사건의 장소 변수여야 하고, 장소 자리(`family` 값 `region`)에만 쓸 수 있다. 연속 사건 자동 키(`life.{chain}_stage`, `fam.{chain}_done`, `fam.{chain}_{outcome}`, `fam.{chain}_unfinished`)는 chain 정의에서 **로더가 파생 등록**한다(등록표에 적지 않아도 됨, 적으면 중복 경고).

### 5.9 chain (W4, 신설)

`chains/C01.json` (10 §7):

| 필드 | 형식 | C01 / C02 |
| --- | --- | --- |
| `id` `name` | id는 `^[A-Z][A-Z0-9_]*$`(대문자, 하이픈 없음) | `C01`, `광부의 지도` |
| `stages` | posInt | 3 |
| `outcomes` | snake_case string[] (`^[a-z][a-z0-9_]*$`) | `["rescue","treasure","guild"]` / `["done"]` |
| `family_once` | bool | true / true |
| `inheritable` | bool | true / false |
| `resume_at` | `{stage: posInt, when: condition, line: line}[]` | `[{"stage":1,"when":{"location":["D1"]},"line":"수첩에 끼워진 찢어진 지도"},{"stage":2,"when":{"in_town":true},…}]` / `[]` |
| `unfinished_line` | template | `끝나지 않은 이야기 — {chain_name}: {last_step_summary}` |
| `stage_summaries` | template[] (단계 수만큼) | `{last_step_summary}` 원문 |
| `mission_bonus` | bool = true | 04 §5.4 임무 보너스 대상 |
| `major_branch_stage?` | posInt | 3 (C01-3 중대 분기) |

파생 플래그(id를 소문자로 바꿔 쓴다. id 형식 제약 덕분에 `C01`과 `c01`이 겹치거나 하이픈이 키에 들어가는 일이 없고, 파생 키는 언제나 FLAG_BODY에 맞는다): `life.{id소문자}_stage`(int 0~stages), `fam.{id소문자}_done`, `fam.{id소문자}_{outcome}`(outcomes 각각), `fam.{id소문자}_unfinished`(int). `end_chain.outcome`은 `outcomes` 중 하나여야 한다(C02는 outcome `done` 하나 — 16의 `end_chain` outcome 키 공백을 채움, 6절 C9. outcome 이름이 `done`이면 파생 키 `fam.c02_done`이 완료 플래그와 같은 키가 되며 하나로 친다).

### 5.10 event (W4)

16 §4.1~§4.2 + 신설. 사건 파일은 `events/{category}/{id}.json`.

| 필드 | 형식 | 16 | 설명 |
| --- | --- | --- | --- |
| `id` `name` `category` | | O | |
| `chain` | `{id: ref("chain"), stage: posInt}` | O | category chain이면 필수 |
| `locations` | ref("region")[]? | O(필수 → 선택) | 없으면 `location_match`, 둘 다 없으면 모든 장소(야영·시스템 사건, DS-18). 여러 장소 공통 생활 사건은 `location_match`로 쓴다(1.5 작성 규칙) |
| `location_match` 신설 | regionFilter? | | 속성 기반 장소 |
| `tags` 신설 | string[]? | | 사건 분류 표식. 엔진이 읽는 값은 `raid`(습격 계열 — `camp_raid_immunity`가 거름, 4.3) 하나. 조건 단말로 쓰지 않는다 |
| `triggers` | EVENT_TRIGGERS[] | O | |
| `life_stages` `seasons` `time_of_day` | | O | |
| `condition` | condition | O | 흡혈귀 제외 등은 여기(아래 예) |
| `weight` | int 1~10 | O | V13 |
| `weight_mods` | `{when, mult}[]` | O | |
| `luck_scaled` | bool | O | 기연 가중(상한 `balance.events.fortune_cap`) |
| `appear_chance` 신설 | ratio? | | 후보가 된 뒤 등장 확률(F02·F03 0.5) |
| `pity_after` 신설 | posInt? | | 조건 충족 상태의 판단 지점 N회째 확정(F02·F03 3) |
| `check_override` 신설 | ratio? | | 판단 지점 검사 확률 대신 이 값(F01 첫 귀환 1.0, L23 확정 1.0). 연속 사건 마을 단계(C01-2·C02-3)의 100%는 사건에 적지 않고 `balance.events.chain_town_stage_chance`가 맡는다(10 §3.1) |
| `exclusive_group` 신설 | string? | | 같은 그룹 사건은 한 판단 지점에 하나만 후보(1:1 추첨), 같은 출정에 하나만(F02·F03 `lifespan_offer`) |
| `cooldown_min` | effMin? | O | |
| `cooldown_per_season` 신설 | bool = false | 16 설명만 | 계절당 1회(L11) |
| `max_per_life` / `max_per_family` | int? | O | |
| `allow_serious_injury` | bool | O | |
| `blocked_during_aid` | bool = false | O | |
| `guaranteed` | — | O → 폐기 | `balance.first_sortie.guaranteed_event`로 이동(DS-34) |
| `hold` | HOLD_KINDS | O | |
| `policy_hooks` | `{decline_choice?: string, auto_specialization_map?: record(policy값, choice id), max_presentations?: posInt, represent_after?: {level_gain: posInt, skill_rank_up: skill[]}}` | O | `represent_after` 신설: 거절 뒤 재제시 조건(05 §8.3 F01: 레벨 +3 또는 근접·탐색 새 단계, 먼저 오는 쪽) |
| `context_vars` | `{var, selector, params?}[]`(선언 순서대로 평가) | O(record → 배열) | 4.5 |
| `system` 신설 | `{order: int, phase: "judgment"\|"town_routine_family"\|"life_end"\|"succession"}`? | | category system 필수. S01·S02·S07은 J1에서 판정·루틴 8단계 발화(DS-19) |
| `preview` `hold_line` | | O | hold≠none 필수(V8). `preview.variants?: {when: condition, text: template, after_paragraph?: nonNegInt}[]` 신설 — 조건이 참이면 선택 창 본문(빈 줄로 나눈 문단)의 `after_paragraph`번째 문단 뒤(없으면 끝)에 넣는다. F03 가문 변형 "첫 대사 뒤"(11 F03), A4-1·A4-2 배경 묘사(`when {discovery_found: …}`) |
| `hold_animation` 신설 | `{action, props?}`? | | 선택 대기 연출. 없으면 `balance.events.default_hold_animation`(10 §8.2 앉기와 식사 + 책). F02 `sit_eat` 등 |
| `intro` | `{lines: line[] ≥2, detail?: template, tag: journalTag, animation?: {action, props?, sec?}[], family_variants?: {when, detail_append}[]}` | O | `animation`은 **순서 있는 배열**(16의 단일 객체 → 배열): L01 `발견` → `상호작용`, 시스템 사건 연출 시간은 `sec`(09 §5.2 S04 3·2·4초) |
| `choices` | choice[] ≥1 | O | |

흡혈귀 제외(16·10 §4.1의 ID 목록을 사건 조건으로, 코어는 모름):

```text
"condition": { "not": { "thirst_stage_gte": "starving" } }                            // L02·L09·L22 (굶주림)
"condition": { "any": [ { "mutation": "none" }, { "last_trip_time": "night" } ] }           // L21
"condition": { "all": [ { "mutation": "none" }, { "lifetime_count_lt": { "event": "F03", "count": 1 } } ] } // F02·F03
```

굶주림 경계(70)는 TM01 `mutation.thirst.stages`에만 두고 사건은 단계 id로 비교한다(`thirst_stage_gte`, 4.1). 16의 `thirst_gte`는 폐기했다. 흡혈귀 낮 출정 야영 사건 제외는 사건마다 조건을 적지 않고 TM01 `mutation.blocked_triggers`가 트리거 단위로 한 번에 거른다(5.6). 새 야영 사건을 더하는 팩이 조건을 빠뜨릴 일이 없다.

**choice / check / combat / outcome**: 16 §4.2 그대로. 변경:

- `check`: `kind: ref("check_kind") | any_of: [ref, ref]`(정확히 하나), `dc?: int`, `dc_offset?: int`(둘 중 하나만), `partial_allowed?`, `situational?: modifier[]`. 종류의 `dc.kind`에 따라:

| `dc.kind` | 사건이 쓸 수 있는 것 | 예 |
| --- | --- | --- |
| `region` | `dc_offset`(지역 기준 + 종류 offset + 값, 없으면 0) 또는 `dc`(고정값으로 덮어씀) | L01 채집 `dc_offset 0`, L09 날씨 견디기 `dc 12` |
| `fixed` | 없으면 종류의 `value`, `dc`로 덮어씀. `dc_offset` 금지 | L02·L10·L12 흥정 12(생략), L06 흥정 `dc 16` |
| `event` | `dc` 또는 `dc_offset` 중 하나 필수 | L05 설득 `dc 12` |
| `level_formula` `enemy_ac` | 사건에서 쓸 수 없음(V20). 사건의 무기 겨루기는 `attack_event` | 도주·부상·최후·명중 |

- `outcomes`: `partialRecord(OUTCOME_KEYS, outcome)`. `check` 있으면 `success`·`failure` 필수, `combat` 있으면 `win`·`defeat`, 둘 다 없으면 `always`만(refine).
- outcome: `effects: effect[]`, `line?: line`, `detail?: template`, `tag?: journalTag`, `line_variants?: line[]` 신설(10 §10.1 자주 나오는 사건 결과 3변형).
- 특성 반응(11 각 사건의 `특성 반응`)은 새 필드 없이 쓴다: 판정 보정은 `check.situational`의 `when {has_trait}`, 선택지 숨김은 `choice.requires`, 결과 추가는 효과의 `when {has_trait}`(「검토 기각」 참고).

**확률·횟수 규칙**(시스템·예약 사건):

- `schedule_event`로 예약된 사건은 발화할 때 `condition`만 검사한다. `appear_chance`·`cooldown_*`·`check_override`·판단 지점 확률은 무시한다(12 §2.2 첫 S02 확정).
- 시스템 사건의 확률(S02 추가 8%)은 `check_override`로 쓴다. `appear_chance`는 운명 사건처럼 후보가 된 뒤의 등장 확률에만 쓴다.
- **시스템 사건의 선택지 = 서술 변형**(T9). AI가 고르지 않으므로 `tags`·`short`를 쓰지 않는다(V7 면제). 엔진은 `requires`가 참인 선택지 중에서 고른다. 둘 이상 열려 있으면 그 사건 규칙이 정한 값과 **id가 같은 선택지**를 적용한다: S01 = `balance.inheritance.family_forms` 키, S03 = 정해진 `retire_role` id(서술 변형 `letters_fallback`은 09 §4.1 조건), S07 = 편지 종류(`apple`·`relic`·`story`·`lesson`·`final_{역할}`), S08 = 긴 잠 원인(`age`·`thirst`·`voluntary`). 하나만 열려 있으면 그것을 적용한다(S02·S04·감사의 식탁).
- 사건 횟수(`lifetime_count_lt`·`family_count_lt`가 읽는 값, 6절 C2)는 그 사건의 결과 효과를 모두 적용한 **뒤에** 올린다. 결과 안에서 `lifetime_count_lt {S02, 1}`은 "이번이 첫째"다.
- 발견·장비의 `event_weight_mult`가 `appear_chance`를 가진 운명 사건을 가리키면 `appear_chance`에 곱하고 `balance.events.fortune_cap`으로 자른다(07 A4-1·A4-2 F02·F03 ×2).

**V14 일반화**: `hold: fate` 사건은 `decline: true` 선택지가 정확히 1개이고 `policy_hooks.decline_choice`가 그 id다. `specialize` 효과를 가진 선택지가 있으면 `auto_specialization_map`과 `max_presentations`가 필수다. F01·F02·F03 ID를 코드가 알 필요가 없다.

### 5.11 text (W4)

`text/*.json`: `{id: "journal.hunt.win_generic", tag?: journalTag, variants: line[] | template[], max_len?: int}`. id는 `def()`의 ID 패턴이 아니라 문형 id 패턴 `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`(W4 `textSchema`)을 쓴다. 14의 문형(귀환·휴식·이동·묶음 기록 등)을 id로 부른다. 코어는 **문형 id 이름**만 알고(코드 등록부 `textSlots`, W4) 문장은 데이터다. 없는 id를 코어가 부르면 V2(텍스트 슬롯 누락) 오류.

---

## 6 저장 상태 필드 목록 (T4·T11 몫, 목록화만)

이 설계가 새로 요구하거나 16 §5에 빠진 동적 상태다. 스키마 확정은 저장 태스크가 한다.

| # | 필드(제안 위치) | 이유 |
| --- | --- | --- |
| C1 | `header.content_packs[{id,version}]`, `header.content_hash` | 콘텐츠 변경 감지·이전 함수(2.4) |
| C2 | `family.event_counts {event_id: n}` | `family_count_lt`, `max_per_family` |
| C3 | `character.last_trip_time` | `last_trip_time` 조건(CP08 진열) |
| C4 | `character.guild_aid {active, started_eff_min, recovered: bool}` + `counter.guild_aids` | S06 진행, TA06 획득 |
| C5 | `character.scheduled_events[{event_id, at, due_eff_min?}]` | `schedule_event` |
| C6 | `character.shop_discounts[{ratio, uses_left, facility?, expires_eff_min?}]` | `shop_discount` 잔여 |
| C7 | `character.next_visit_mods {region_id: (dungeon_mod \| temp_mod)[]}` — 장소별 대기 수정자. 그 장소에 들어서면 적용하고 방문이 끝나면 지운다 | `dungeon_mod`·`temp_mod`의 `scope: next_visit`(L05·L16. 16은 life 플래그로 보관이라 했으나 모양이 안 맞음) |
| C8 | `character.line_variant_last {event_id: 인덱스}` | 한 줄 기록 직전 변형 반복 금지(10 §10.1) |
| C9 | `end_chain outcome` → `fam.{chain}_{outcome}` 파생 키 등록(5.9) | C02 outcome 키 공백 |
| C10 | 자녀 후보 저장 위치 확정: `family.heir_candidates`(계승 대기) vs `character.children` uid의 실체 → `family.candidates {uid: candidate}` 단일 저장 | 16 §5.3·§5.4 이중 표기 |
| C11 | num `flag.fam.*` 정수 플래그 비교 | 4.1 |
| C12 | `family.flag_meta {key: {set_gen}}` | 후손 반응 기간 계산(`reaction_active`) |
| C13 | `sortie.trip_flags {key: {value, remaining}}` 모양을 `set_trip_flag` 파라미터와 일치(수정자는 저장하지 않고 등록표 `trip_modifiers`에서 읽음) | 16 §5.7과 §4.3 차이 |
| C14 | `family.codex`에 `codex` 종류별 키(`items`·`enemies`·`events`·`locations`) + `family_record kind codex`의 key 규칙 | `codex_count_gte`·`codex_complete` |
| C15 | `character.counters_at {counter: {region_id: n}}` | `counter.{c}.{region}`, `safe_returns_gte where` |
| C16 | `character.event_pity {event_id: 연속 미등장 횟수}` | `pity_after` |
| C17 | `character.discoveries[]`, `character.map_fragments[]`, `character.discovery_fail_bonus {id: n}` | 발견 지점·지도 조각·실패 누적(생애 단위) |
| C18 | `family.discovered_locations`에서 `closes_on_succession` 장소 제거 규칙 | A4 |
| C19 | `character.chain_mission {chain_id: {priority_sorties, pending_since_eff_min}}` | 임무 우선 3회·보류 60분 |
| C20 | `character.deficit {region_id: {recent_net[], excluded_until_decision}}` + `decision_seq` | 적자 제외 |
| C21 | `character.stat_use_points {stat: number}` | 05 §4.1 사용 점수 U(16 §5.4에 없음). 배분 때 ×`growth.decay` |
| C22 | `character.miss_streak int` | 05 §4.1·§5.1 빗나감 4회 누적(민첩 사용 점수·기동 숙련) |
| C23 | `character.activity_streak {activity, k}` | 04 §5.2 연속 활동 반복 계수 |
| C24 | `character.low_cap_streak int` | 04 `low_cap_notice_streak`(H1·A1만 남은 연속 10회 알림) |
| C25 | `family.notices_shown {key: generation}` | 생애·가문 1회 알림: 첫 치명 관문 자동 진입 [중요], `lethal_blocked` 첫 [중요], 유품 안내(65세·첫 치명 허용) |
| C26 | `sortie.camps int` | 출정당 야영 상한(`activity_ai.camp.max_per_sortie`, TI01 `camp_extra`) |
| C27 | `sortie.discovery_attempts[discovery_id]` | 한 출정에 발견 지점당 시도 1회 |
| C28 | `sortie.exclusive_used[group]`, `sortie.fate_offered bool` | 출정당 `exclusive_group`·운명 사건 1회 |
| C29 | `temp_mod`의 새 scope `next_check`는 16 §5.4 `character.temp_mods`(출정을 넘을 수 있음)에, `next_visit`은 C7에 둔다. 16 §5.7 `sortie.temp_mods` 설명의 `set_trip_flag.modifiers`는 지운다(C13) | 05 §6.4 곤란 4, 4.2 |
| C30 | `family.discovery_points[discovery_id]` — 가문 수첩에 적힌 발견 지점. 첫 발견 때 `discovery.reveal`이 더한다. 없던 저장은 `[]`(zod default) | 07 §6.5 가문 수첩, 00 D59 다시 찾음 문형. 인물 발견(C17)은 생애 단위라 후손이 지우고 시작한다 |
| C31 | `current_activity.life_loop {age_ticks[{from, to, changes[{age, stat, delta}], boundary, stage}], pending_end {kind, death}\|null, succession}` — `sim/life-loop`이 판단 지점까지 미룬 상태. `pending_end.death`는 09 §5.4 사망 기록(`combat/defeat` DeathRecord, 저장 검사는 `final_check`만 본다), `succession`은 `succession/succeed` SuccessionPlan 그대로(`record`·`candidates`·`defaultHeirUid`·`relicUids`·`settlement{…, keepsakes[]}`·`journal`·`timeJump`·`firstPage`, 코어 타입 키 이름을 그대로 쓴다). 없던 저장은 빈 값(zod default) | 행동 도중 저장(13 §8.1) 뒤 불러오면 나이 알림(09 §2.1)이 사라졌고, 계승 대기로 저장하면 3~5단계를 잇지 못했다(IMPL_DECISIONS I66) |
| C32 | `sortie.journal_bundle? {tag: hunt\|dungeon, count, coins, depth, rows[], single}` — 아직 닫히지 않은 일지 묶음(14 §4). `single`은 1개로 닫힐 때 남길 개별 기록(journal_draft), `rows`는 펼침 내역(최대 10줄). 닫히면 칸을 지운다(`journal/bundle`). 없던 저장은 칸 없음(optional) | 묶는 동안 저장해도 묶음 내역을 잃지 않는다(00 D61, IMPL_DECISIONS I76) |
| C33 | `current_activity.life_loop.growth_seen? {char_uid, level, ranks{skill: int}}\|null` — 마지막으로 `[성장]` 기록을 남긴 레벨·숙련 단계. 판단 지점 훅이 지금 값과 비교해 레벨업·숙련 상승 기록을 남기고(05 §3.4·§5.1), 인물이 바뀌었거나 칸이 없으면 기록 없이 지금 값으로 맞춘다. `character.recent_summaries[{kind: sortie\|town, eff_min, age, season, lines[]}]`(최근 10개, 14 §1.1), `sortie.start? {level, xp, coins, jr}`, 카운터 `stay_coins`·`stay_rests`·`stay_from_jr`, `balance.ui.recent_summary_keep`(10). 없던 저장은 빈 값(zod default·optional) | 레벨업·숙련 상승 `[성장]` 기록을 코어가 남기지 않았다(14 §5.1 문형은 있었다). 최근 요약(03 §5.2)은 저장 칸이 없었다(D77) |
| C34 | D79 직업·기술: balance `specializations.*.technique?`, `second_jobs{id: {name, parent, modifiers, activity_weight_add, growth, technique, effect_text}}`, `techniques{id: {name, effect_text, modifiers}}`, `job_rules`. 조건 `second_job_ready: true`, 효과 `set_job2 {job}`(defer 포함)·`learn_technique {technique}`. 저장 `character.job2`·`character.techniques[]`·`family.technique_note`·`life_record.job2`·`life_record.techniques[]` | 05 §8·§10, 12 §7.7(I90) |
| C35 | D80 장비 주석 칸: 장비 필수 `lore {tale, owner?, found?, npc?, secret? {text, reveal: owned\|inherited}}`. `story_template`이 `{npc}`를 쓰면 `lore.npc` 필수, 각 글 120자 이내(item 스키마 검증). 인물 탭 장비 펼침·가문 탭 유품(`{npc}`에 `lore.npc`)·도감 장비 칸이 보인다 | 16 §2.5, 03 §5.3·§5.5. 상세 글이 설명 한 줄뿐이었다 |
| C36 | 저장 `character.techniques[].charges? {target: int}` — 기술 출정 충전 남은 수(장비 `item_instance.charges`와 같은 뜻, 출정 시작에 비움). 기술 `shield_hold` 수정자에 `second_wind_ratio` 0.1. 없던 저장은 칸 없음(optional) | 독립 검증 D79-5(I91) |

---

## 7 검증 파이프라인

### 7.1 단계와 오류 코드

| 단계 | 코드 | 검사 | 구현 |
| --- | --- | --- | --- |
| 팩 | P01 | `pack.json` 스키마 | W1 `manifestSchema` |
| | P02 | (결번 — 엔진 범위 검사 폐기) | |
| | P03 | `requires` 팩이 로드 대상에 없음 | W1 |
| | P04 | `requires` 순환 | W1 위상 정렬 |
| | P05 | 경로·파일 모양 오류(모르는 경로, events 배열, 파일명≠id, 분류 폴더≠category) | W1 |
| | P06 | `(kind, id)` 중복 정의 | W1 색인 |
| | P07 | 패치 대상 없음·`merge`가 아닌 op | W1 |
| | P08 | JSON 해석 실패 | W1 |
| | P09 | (경고) 서로 다른 두 팩이 같은 `(kind, id, 최상위 키)`를 merge | W1 |
| 스키마 | S01 | zod 스키마 위반(strict, 형식, 필수) | 종류 스키마 `safeParse`. 이슈 `params.rule`이 있으면 그 번호로 보고 |
| 참조 | V2 | 참조 무결성 | 7.3 |
| 의미 | V1, V3~V21 | 7.2 표 | 스키마 refine 또는 W1 교차 검사 |

심각도: `error`(번들 거부) / `warn`(번들 생성, CI는 `--strict`에서 실패). 기본 경고 항목: P09, V17, 빈 배열 파일, 파생 플래그의 중복 등록. 확장 팩이 관례만으로 경고를 받는 항목은 두지 않는다(`--strict` CI가 확장 팩을 막지 않게).

**메시지 형식**(한 줄, 사람이 읽음):

```text
{severity} {code} {pack}/{file}#{json_pointer}: {message}
error V2 base/regions/mine.json#/2/gate/enemy_id: enemy 'EB09'가 없다
warn  P09 winter_fest/patches/010_town.json#/0/value/tags: base와 tune_town이 region T00의 tags를 둘 다 merge한다
error V3 base/events/life/L08.json#/condition/all/1/foo: 알 수 없는 조건: foo
```

`--json`이면 `{"severity","code","pack","file","pointer","message"}` 배열. 종료 코드: 오류 있으면 1, 경고만이면 0(`--strict`면 1).

### 7.2 V 규칙 구현 방식 (V18은 T12 시뮬레이터, V22는 T10 — IMPL_DECISIONS I18)

| V | 검사 | 방식 | 위치 |
| --- | --- | --- | --- |
| V1 | ID 형식·중복 | `id` 정규식(S01) + P06. 접두 관례는 검사하지 않는다(1.3) | common + W1 |
| V2 | 참조 무결성 | 7.3 워커 | W1 |
| V3 | 조건·수정자 문법 | `condition` 스키마(키 1개, 등록 단말, num 키·카운터, `policy` key는 16 §5.9 필드) + `modifier` 스키마(target 패턴, op·value). W1 교차: `special.{special}.{param}`의 두 값이 `enemySpecials` 이름과 그 파라미터 키 | common(완료)·W4 등록·W1 |
| V4 | 효과 문법 | `effect` 판별 유니온(미등록 type, 필수 파라미터, 형식) + `exactlyOne` 검사 + `chance.p` ratio. 효과 안 이슈는 모두 V4(안쪽 규칙 번호는 유지) | common(완료)·W4 등록 |
| V5 | 템플릿 | 문법·조사 쌍 9종·변수 이름 형식은 스키마(`template`이 렌더러 파서 `extractTemplateVars`를 부름). W1은 `templateRegistry` 표식 필드를 모아 변수가 `templateVars`에 있음, `source: event` 변수는 그 사건 `context_vars`에 있음. 옛 표기는 등록돼 있지 않으므로 오류 | W1(+W4 등록표) |
| V6 | 한 줄·상세 기록 길이 | `line` 표식 필드에 가장 긴 대입(이름 6자, 장소·장비·적·NPC 이름은 번들에서 가장 긴 값, 숫자 변수는 5자리)을 넣은 길이 ≤ `balance.ui.line_max`. 상세 기록 템플릿(필드 이름 `detail`·`detail_append`: 결과·도입·`journal` 효과·치명 관문)은 같은 대입으로 `\n`으로 나눈 줄마다 ≤ 80(14 §1, 편지 형식은 줄 단위). 80은 `balance.ui`에 자리가 없어 검증기 상수 `DETAIL_MAX`다 | W1 |
| V7 | 자동 선택 정보 | 사건 refine: hold none이면 모든 선택지 `tags`(1~2)·`risk`·`short`. **면제**(tags·short만): `category: system` 사건 전부(선택지는 서술 변형이고 AI가 고르지 않는다, 5.10. DS-53을 T9에서 넓힘 → DS-55). `none`/`low` 선택지 ≥ 1은 hold·분류와 관계없이 모든 사건(10 §5.4, 16 §4.2) | W4 |
| V8 | 선택 창 정보 | 사건 refine: hold≠none이면 `preview.body`·`hold_line`·선택지 `preview.{benefit,cost,reversible}`. 선택지 효과(중첩 포함)에 `COST_REQUIRED_EFFECTS`(4.2) 효과가 있으면 `cost`가 비어 있지 않음(문장 내용은 사람이 검수) | W4 |
| V9 | 사망 안전 | `damage.hp_ratio < 1`, `damage.hp`는 경고. 사망을 일으키는 효과가 없다는 것은 스키마로 판별하지 않고 **핸들러 계약**으로 둔다: 일반 활동의 효과 핸들러는 HP를 1 미만으로 내리지 않는다(규칙 구현 테스트가 `EFFECT_HANDLERS` 전부를 HP 1 인물에 적용해 확인) | W4·W1·규칙 테스트 |
| V10 | 치명 선택지 금지 | `risk: lethal` 선택지는 오류(D26). 확장에서 허용이 필요해지면 그때 규칙을 더한다 | W4 |
| V11 | 부분 성공 | outcome `partial`이 있으면: `check.kind`(any_of면 둘 다)의 `balance.check_kinds.partial`이 true 또는 `partial_event_defined`이고 사건이 켬, `partial_allowed ≠ false` | W1 교차 |
| V12 | 연속 사건 단계 | chain별 `stage` 1..stages 빈틈·중복 없음, 단계 n>1 사건 조건에 `chain_stage {stage: n−1}`가 `all` 최상위에 있음 | W1 교차 |
| V13 | 가중치 | `weight` 1~10 정수. **면제**: `category: system`(확률은 `check_override`) | W4 스키마 |
| V14 | 거절 경로 | 5.10 일반화 규칙 | W4 refine |
| V15 | 고유 장비 | `unique` → `grade_mode: fixed`, `sources ≥ 1`, `reacquire` 필수(상점 전용이면 금지, 5.5) | W3 refine |
| V16 | 저주 장비 | `cursed` 장비에 `shop` 없음, `offer_purchase` 풀(시설·슬롯)에 걸리지 않음 | W3 refine·W1 교차 |
| V17 | 적 수치 | `balance.enemy_formula`(반올림 포함)로 계산한 값과 다르면 경고(`_note`가 있으면 억제). 01 §5.2처럼 등록부 값이 기준이다 | W1 교차 |
| V19 | 플래그 키·바인딩 | 5.8 등록표·파생 키와 대조. 범위 접두는 파라미터 스키마(`flagKey(scope)`)가 강제. 바인딩 `{변수}`(플래그 키, 수정자·num 키의 `{region}` 자리, 장소 파라미터)는 `place`이거나 그 사건의 장소 변수여야 하고, 사건 밖(장비·특성·balance)에서는 `{place}`만 | W1 교차·W4 |
| V20 | 판정 종류 | `ref("check_kind")` → V2로 검사. 사건이 능력치·숙련을 따로 적으면 strict S01. 사건의 `dc`·`dc_offset`은 5.10 표를 따른다(`level_formula`·`enemy_ac` 종류는 사건 사용 금지) | common·W4·W1 |
| V21 | 소모품 | `carry_group` 참조(V2), `sellable: false`, `effect` 열거. 08 값과의 일치는 기반 팩 골든 테스트(T-콘텐츠)로 옮긴다(DS-26) | W3·W1 |

**그 밖의 W1 교차 검사**(V 번호 없이 해당 V에 붙여 보고): 던전 group마다 depth 1..n 연속(V2), `tier` 값 ≤ `economy.tier_levels` 길이(S01), `context_vars`의 `place_var`가 앞 항목 변수(V5), `trait.acquire.type: event`의 선택지에 `add_trait`(변이 특성이면 `mutate`)가 있음(V15와 같은 W3·W1 묶음. TM01 ← F03 `accept`의 `mutate`).

### 7.3 참조 워커 (W1)

스키마와 데이터를 함께 따라가며 참조를 모은다. zod 4의 공개 정의(`schema.def` / `_zod.def`)를 쓴다.

- `refKindOf(schema)`가 있으면 `{kind, id, path}` 수집.
- `object`·`array`·`tuple`·`record`·`optional`·`nullable`·`default`·`lazy`·`pipe`: 안으로. **`record`는 키 스키마의 refKind도 수집한다**(`starting_kit.consumables`의 키 `CP01`, `event_weight_mult`의 키 사건 ID).
- `discriminatedUnion`: 판별 키 값으로 갈래 선택(지역, 특수능력, acquire).
- 효과(`schema === effect`): `type`으로 `effects.get(type).params`를 찾아 들어간다(조건과 같은 방식).
- `union`: 첫 `safeParse` 성공 갈래.
- 조건 스키마(`schema === condition`): 키로 갈래를 고른다 — `all`/`any` 배열, `not`, `num`(키의 `numKeys.match` slot 중 ref 종류: `region`·`npc`), 단말은 `conditions.get(key).params`.
- 수정자(`schema === modifier`): `modifierTargets.match(target).slots` 중 ref slot(`check_kind` `enemy_family` `region`) 수집, target 등록에 `ref`가 있으면 string 값도 그 종류로 수집(`rescuer_override` → `rescuer`), `when`은 조건으로.
- 키 묶음 플래그(`life.l01_marked_H1`): 등록표 패턴의 자리 값을 그 종류 ref로 수집.
- **바인딩 값**(`{place}`, `{rumor_place}`)은 ref로 수집하지 않고 V19가 따로 본다.
- 중첩 이름공간(1.3)은 정의가 있는 곳(region, balance 표, trait)을 색인할 때 함께 색인한다.

---

## 8 결정 후보 (DS) — 조율자가 설계 문서에 반영

`규칙` 열이 예이면 게임 규칙을 바꾸거나 고르는 것이다(00 §3 D-번호 후보). 아니오면 데이터 형식만 바꾸는 것(16 개정).

| DS | 내용 | 규칙 | 반영 문서 |
| --- | --- | --- | --- |
| DS-01 | ID는 종류별 이름공간. V1 "전체 고유" → "종류 안 고유". 자릿수 규칙(00 §2.2)은 관례로 남김 | 아니오 | 16 §1.3·§7.2, 00 §2.2 |
| DS-02 | 파일 구성 16 §1.1 → 팩 구조(1절), 사건 1파일 1사건 | 아니오 | 16 §1.1 |
| DS-03 | 설명 필드는 `_note`·`_comment`만. 16 예시의 `note` 개명 | 아니오 | 16 §2.4·§2.8 |
| DS-04 | 길드 등급·출신 배경·은퇴 역할·적 계열·판정 종류·태도를 열거형에서 데이터 종류로 | 아니오 | 16 §6 |
| DS-05 | `guild_patrol` → `patrol_zone`, `balance.risk`의 순찰 구역 목록 삭제, `fallback` 신설 | 아니오 | 16 §2.1·§2.3 |
| DS-06 | `discovered_kind` 표시 폐기. 후손 면제형 해금은 `discovered` 단말로만 쓴다(가문 발견 목록) | 아니오(12 §7.4 규칙 유지) | 16 §2.3 |
| DS-07 | `add_coins.formula` 폐기 | 아니오 | 16 §4.3 |
| DS-08 | 소모품 가격 구조화 `{kind: fixed}` / `{kind: potion_of_level_tier, mult}` | 아니오 | 16 §2.6 |
| DS-09 | `animation.action` 영어 키 10종 | 아니오 | 16 §4.1, 01 §18.4 |
| DS-10 | `npc.descendant_reactions` → `descendant_reaction` 종류 + 조건 `reaction_active` | 아니오 | 16 §2.8 |
| DS-11 | `attitude.potion_target` → `buy_targets`(08 §4.1 표 전체) | 아니오 | 16 §2.2 |
| DS-12 | 가문 업적 키 `"1"`~`"17"` → `AC01`~`AC17`(저장 `family.achievements` 키도) | 아니오 | 16 §5.3, 12 §8.4 |
| DS-13 | **J4 던전 전투·보물 방 뒤 사건 검사 5%**(10 §3.1을 따름). 04 §2.3 J4의 "없음"을 "10 §3.1 방 뒤 5%(사건 방은 07 §5.3이 100%)"로 고침 | 예(정합) | 04 §2.3 |
| DS-14 | **빈 후보 처리는 04 §4.4가 기준**(중상 → 치료, 고정 장소 F4 탈락 → 이번만 고정 무시 재필터). 04 §3.2 의사코드 주석은 이미 일치, X8과도 일치 확인 | 아니오 | — |
| DS-15 | **판단 지점 안 순서**: 숨 고르기 → 사건 검사·적용 → 현장 판단(회복약 → 퇴각·피로 → 명령 → 목표 → 다음 방). 07 §3.2의 "숨 고르기 → 회복약 → 사건 검사"를 고친다(사건 피해 뒤 회복약을 한 번에 판단) | 예 | 07 §3.2, 04 §2.3 |
| DS-16 | **적정도 계수 공백**: 사용자가 상한을 올려 안정적·모험적이 `high` 활동을 고를 때 계수 0.8(모험적 모험 활동과 같게). 도전적 1.0 유지 | 예 | 04 §5.2 |
| DS-17 | 연속 사건 우선 검사(50%)가 실패한 판단 지점의 일반 검사에서는 **같은 연속 사건을 후보에서 뺀다** | 예 | 10 §3.1 |
| DS-18 | 던전 휴식 지점은 `camp` 판단 지점이며 장소는 그 층. 사건 `locations` 생략 = 모든 장소. L09(야영 전체)가 폐광 휴식 지점에서 나오는 것을 막으려면 L09에 `location_match: {kinds: [hunting_ground, adventure_route]}`를 준다 — **권장: 막음** | 예 | 07 §5.3, 10 §4.1, 11 L09 |
| DS-19 | 시스템 사건 S01·S02·S07: **J1에서 조건 판정, 마을 루틴 8단계에서 발화**(`system.phase: town_routine_family`). 10 §3.3 순서 표는 판정 순서로 유지 | 예(정합) | 10 §3.3, 04 §8 |
| DS-20 | 던전 층은 `dungeon {group, depth}`로 순서를 정한다. 04 §6.2 목표 층 규칙은 **group마다** 적용하고, group 사이 선택은 장소 점수(04 §6.1 식)로 한다. 첫 검증판 콘텐츠는 group 1개지만 **구현은 group 하나를 가정하지 않는다** — 규칙 구현 태스크의 검증 기준에 group 2개(각 depth 1..n) 픽스처로 목표 층이 group마다 도는 테스트를 넣는다 | 예(확장) | 04 §6.2, 07 §5 |
| DS-21 | 길드 등급 순서는 `guild_rank.order`, 등급 조건은 데이터 조건식 | 아니오 | 01 §8.3, 16 §6.7 |
| DS-22 | `check_kinds.dc` 구조화(region/fixed/event/enemy_ac/level_formula) | 아니오 | 16 §2.1 |
| DS-23 | 카운터 `d3_returns`·`deep_returns` 폐기 → 장소별 카운터 + `safe_returns_gte {where}`. TA02는 `where: {dungeon_depth_gte: 2}` | 아니오 | 16 §5.4, 06 TA02 |
| DS-24 | 패치 연산은 `merge` 하나. 배열은 통째로 바꾼다(부분 배열 연산 없음). 두 팩이 같은 최상위 키를 merge하면 P09 경고. 새 콘텐츠는 패치 대신 새 팩 쪽에서 잇는다(1.5 작성 규칙) | 아니오 | — |
| DS-25 | F02·F03: `exclusive_group`(한 판단 지점·한 출정에 하나), `appear_chance 0.5`, `pity_after 3`, 기연 가중 상한 0.9 | 아니오(10 §4.3을 옮김) | 16 §4.1 |
| DS-26 | V21의 "08 값 일치"는 린터가 아니라 기반 팩 골든 테스트로 | 아니오 | 16 §7.2 |
| DS-27 | 효과 `add_material` 신설, `start_combat.enemies`에 `from_region_table` 신설 | 아니오 | 16 §4.2·§4.3 |
| DS-28 | 지도 조각 ID `A1-M1`형(07 §6.3의 `A1-①` 표기 대체) | 아니오 | 07 §6.3·§6.4 |
| DS-29 | 퇴각 기준 가산은 `ai_hooks.retreat_hp_add`(특성)와 수정자 `retreat_hp_add`(장비·출정 플래그)로 나뉜다. 둘 다 더하며 **둘 다 ratio**(0.10)다(16의 pct_point 10 폐기). TA03 겨울 +0.05는 `winter_retreat_hp_add` 대신 수정자 `{target: retreat_hp_add, when: {season: [winter]}}`로 통일 권장 | 아니오 | 16 §1.2·§2.7·§3.3 |
| DS-30 | 전문화·변이는 첫 검증판에서 코드 열거 유지. 확장 후보: `specialization`·`mutation` 데이터 종류 | 아니오 | 05 §8.5, 09 §8 |
| DS-31 | 이벤트 `guaranteed` 필드 폐기, 첫 출정 보장은 `balance.first_sortie`(D21 값 불변) | 아니오 | 16 §4.1 |
| DS-32 | `events.locations` 필수 → 선택(`location_match`와 함께), 없으면 모든 장소 | 아니오 | 16 §4.1 |
| DS-33 | 적 문장 `victory_lines`·`exit_line`, 관문 문장 `region.gate.lines`, 사망 제안 `balance.defeat.death_suggestions {max, rules[{ctx, value?, text}]}`(07 §8.3 기준 수치를 데이터로) | 아니오 | 16 §2.3·§2.4, 07 §8.3 |
| DS-34 | 날씨 효과를 `balance.weather.effects` 수정자 목록으로(01 §1.3 값 불변). 수정자 `camp_fatigue_recovery_add` → `camp_fatigue_add`(야영 피로 변화에 더하는 값, 눈 +10) | 아니오 | 16 §2.1·§3.3 |
| DS-35 | num 키 `flag.`에 `fam.`·`trip.` 정수 플래그 허용, `family_counter.*`·`activity_weight.*` 신설 | 아니오 | 16 §3.2 |
| DS-36 | 자리 바인딩 `{변수}`(3.1): 키 묶음 플래그·장소 자리 수정자 target·장소 파라미터에 `{place}` 또는 사건 장소 변수. `temp_mod`·`dungeon_mod`의 `scope: next_visit` + `location`, 저장 C7 일반화. 16 §5.2 키 묶음 설명에 "데이터에는 `_{place}`를 적고 엔진이 치환"을 더한다 | 아니오 | 16 §3·§4.3·§5.2 |
| DS-37 | **밤 출정의 적 레벨 +1(07 §7.1)을 관문 적(EB01~EB03, 잔당)에도 적용하는가.** 07 §7.1 "던전: 밤 출정의 적 레벨 +1만 적용"은 조우 적 기준이라 관문이 모호하다. 권장: 적용(관문도 조우), 치명 관문 위험 차 계산(01 §7.2)에도 반영 | 예 | 07 §5.6·§7.1 |
| DS-38 | 16 §4.5 F03 주석 "가격 계산(08)이 `life.f03_clue`를 읽는다"를 "TM01의 `shop_surcharge` 수정자 `when`이 플래그를 읽는다"로 고친다(코어가 콘텐츠 플래그 키를 모르게, I04). 흡혈귀 `time_modifiers`는 출정 중 시간대 기준이고 마을 규칙은 `in_town` 조건 수정자 | 아니오 | 16 §4.5·§5.2 |
| DS-39 | **07 §5.2 방 생성 검증의 기준 인물 판정 보정**(함정 감지·회피 확률 계산용 지식+탐색, 민첩+기동)이 정해져 있지 않다. 01 §2.4는 주능력치·근접 단계만 가정한다. 01 §2.4에 보조 능력치·탐색·기동 단계 가정을 더해 정하고, 값은 `reference_character.check_bonus`(레벨별 판정 종류 보정 표)에 둔다. → **D46으로 결정됨**(01 §2.4 `방 생성 기준 인물의 판정 보정` 표. 기반 팩 `check_bonus`에 넣었다) | 예 | 01 §2.4, 07 §5.2 |
| DS-40 | **공포 판정 실패 효과 불일치**: 05 §6.1은 "이번 출정 퇴각 기준 +10%p", 16 §5.2 `trip.fear`는 "공포 판정 실패로도 설정 → 모든 판정 −1 + 퇴각 +10%p". 05가 판정 종류의 단일 출처(00 §2.4)이므로 권장: 05를 따르고 16 `trip.fear`의 설정처에서 "공포 판정 실패"를 뺀다(L17 실패만). `check_kinds.fear.fail_effects`는 05 값으로 적었다 | 예(정합) | 05 §6.1, 16 §5.2 |
| DS-41 | 09 §1.2 노년기 "`[가족]`·`[인연]` 기록 가중 ×2"를 **사건 가중**(`intro.tag`가 family·bond인 사건 ×2)으로 해석한다(`life_stage_rules.elder`) | 예(해석) | 09 §1.2, 10 §4.2 |
| DS-42 | 판매 선언은 장비·소모품의 `shop`에만 둔다(시설 `stock` 폐기). 장비 `shop`은 배열 + `pick_group`(08 §5.1 길드 2단계). 고유 장비 대체는 장비의 `reacquire`, 장소 전용 드롭은 `sources` drop 항목(`room`·`grade_is`·`chance`·`once_per_life`) | 아니오 | 16 §2.3.1·§2.5 |
| DS-43 | 팩 형식 축소: `pack.json {id, name, version, requires: string[]}`, 버전·엔진 범위와 팩 정책 폐기, 패치 op는 `merge`만, 로드 목록은 CLI 인자만 | 아니오 | — |
| DS-44 | 조건 `thirst_gte` 폐기 → `thirst_stage_gte`(단계 id 비교, 4.1). 16 §3.2 43종 중 42종 + 신설 14종(`location_match` `trait_hook` `received_relic` `discovery_found` `first_sortie_of_character` `safe_returns_gte` `codex_count_gte` `codex_complete` `reaction_active` `life_end_kind` `died_at` `thirst_stage_gte` `combat_kind` `main_place`) = 56종 | 아니오 | 16 §3.2 |
| DS-45 | 효과 `remove_consumable`·`roll_check` 신설(DS-27 `add_material`과 함께 16 §4.3 50종 + 3 = 53종) | 아니오 | 16 §4.3 |
| DS-46 | `set_trip_flag.modifiers` 폐기. 출정 동안 효과는 플래그 등록표 `trip_modifiers`가 단일 출처(5.8, 6절 C13·C29) | 아니오 | 16 §4.3·§5.2·§5.7, §4.6 L03 예시 |
| DS-47 | `unlock_family`의 kind `title` 폐기. 칭호는 `achievement.rewards {kind: "title", text}`로만 준다 | 아니오 | 16 §4.3 |
| DS-48 | `sortie_mod.camp.fatigue_recovery` → `camp.fatigue_add`(야영 피로 변화에 더하는 값, DS-34 수정자와 같은 규약) | 아니오 | 16 §4.3 |
| DS-49 | `accept_quest.lines {complete, partial, cancel}` 필수 신설(11 L06 달성·부분·취소 기록) | 아니오 | 16 §4.3, §4.6 L06 예시 |
| DS-50 | `end_sortie.reason` 열거화: `event` / `injury` / `command` | 아니오 | 16 §4.3 |
| DS-51 | `event.context_vars` record `{변수: 규칙}` → 배열 `{var, selector, params?}[]`(선언 순서대로 평가, 4.5) | 아니오 | 16 §4.1 |
| DS-52 | `intro.animation` 단일 객체 → 순서 있는 배열 `{action, props?, sec?}[]`(DS-09 영어 키와 함께) | 아니오 | 16 §4.1, §4.4·§4.5 예시 |
| DS-53 | V7 면제: `category: system`이고 선택지가 1개인 자동 사건은 `tags`·`short`를 생략한다. `none`/`low` 선택지 ≥ 1은 모든 사건에 그대로 적용(10 §5.4) | 아니오 | 16 §7.2 V7 |
| DS-54 | T9 사건 이식 등록부 신설: 조건 `has_consumable`, `received_relic: true`(어떤 유품이든), 효과 `reveal_discovery`·`open_chest`·`create_partner`, 파라미터 `remove_coins.inn_costs`·`skill_use.skill: "lowest_rank"`(4.1·4.2). 11 원문 규칙을 그대로 옮기기 위한 것이고 값은 바꾸지 않는다 | 아니오 | 16 §3.2·§4.3 |
| DS-55 | V7 면제를 `category: system` 사건 전부로 넓힌다(DS-53 대체). 시스템 사건의 선택지는 서술 변형이며, 둘 이상 열리면 엔진이 정한 값과 id가 같은 선택지를 적용한다(5.10) | 아니오 | 16 §4.1·§7.2 V7 |
| DS-56 | **길찾기 부분 성공 불일치**: 11 L17 `소리를 따라간다`·L19 `발자국을 따른다`는 부분 결과를 적었지만 05 §6.1 길찾기는 부분 성공이 없다. 지금 데이터는 05를 따라 부분 결과를 뺐다(V11, 그 구간은 실패). 11에서 부분 결과를 지우거나 05에서 길찾기 부분 성공을 허용한다 | 예(정합) | 05 §6.1, 11 L17·L19 |
| DS-57 | **11 가문 변형과 12 §7.6(후손 반응의 유일한 정의) 불일치**: (1) 11 L02·L18(`fam.c01_rescue`)·L24(은퇴 생존, 20%) 문장 변형이 12 표에 없다. (2) 11 L18 `일지를 읽는다` 자동 성공은 12 원칙 1(판정 보정 금지, D29) 위반이라 데이터에서 뺐다. (3) 12의 `fam.c01_treasure` → L18 `사과한다`(교섭, 반응 종료)는 11에 문장·DC가 없고 반응을 끝내는 효과도 없어 옮기지 않았다. 권장: 12 표에 문장 변형 3건을 더하고, 11 L18 자동 성공을 지우고, `사과한다` 원문을 11에 쓰거나 12에서 뺀다 | 예(정합) | 11 L02·L18·L24, 12 §7.6 |
| DS-58 | **L22 부고 변형**(숙련기 이후 30%, 생애 1회, 이후 L22 중지)은 한 사건 안의 확률 변형이라 스키마로 적을 수 없다. 권장: 부고를 별도 사건 ID로 두고(`appear_chance 0.3`, `life_stages [veteran, elder]`, `max_per_life 1`), L22 조건에 `lifetime_count_lt {부고, 1}`을 건다. 01 §12 사건 등록부에 ID 추가가 필요하다 | 예(등록부) | 01 §12, 11 L22 |
| DS-59 | 11 문장 정리 후보: S04 편지 서명 `하델` 고정은 02 §8.10 출장소장 교대(3대부터)와 맞지 않는다(`{npc}` 후보). L20 TI02 반응 `귀가 먹먹하다`와 C01-1 `맞춰 본다` 성공 한 줄 `찢긴 선이 중층을 가리킨다`(18 §6.3)는 현재형이다(14 한 줄 기록 과거형). 데이터는 과거형 `귀가 먹먹했다`·`찢긴 선이 중층을 가리켰다`로 적었다 | 아니오 | 11 S04·L20·C01-1 |

16 §4.4·§4.5·§4.6 예시는 DS-09·DS-46·DS-49·DS-51·DS-52를 반영해야 지금 스키마를 통과한다(W4 테스트 fixture는 바꿔서 통과시켰다). 합치기 순서 4에서 예시도 함께 고친다.

---

## 9 병렬 구현 분담표

모든 묶음은 `packages/core/src/schema/common.ts`(완료)를 가져다 쓰고 **수정하지 않는다**. 공통 골격에 필요한 변경이 생기면 작업을 멈추고 조율자에게 알린다. 테스트는 각자 `test/` 아래 자기 폴더에만 둔다.

**조율자 선행 작업**(분담 전 1회): `packages/core/src/index.ts`에 `export * from './schema/common'` 한 줄을 넣는다. 각 묶음의 `index.ts`는 합칠 때 조율자가 `packages/core/src/schema/index.ts`에서 다시 내보낸다(`export * from './world/index'` 등). 묶음끼리는 서로의 파일을 import하지 않는다 — 다른 종류는 `ref(kind)`로만 가리킨다.

### W1 팩 로더·패치·검증·CLI

경로: `packages/content-kit/src/` 아래 `pack/`, `validate/`, `cli.ts`, `index.ts`(기존 `findCoreContentIds` 내보내기 유지) · 테스트 `packages/content-kit/test/pack/**`, `packages/content-kit/test/validate/**` · 픽스처 `packages/content-kit/test/fixtures/**`

| 파일 | 공개 export |
| --- | --- |
| `pack/manifest.ts` | `manifestSchema`, `PackManifest` |
| `pack/discover.ts` | `discoverPacks(paths)`(팩 폴더 또는 팩 폴더들을 담은 폴더), `orderPacks(manifests)` (P01, P03, P04) |
| `pack/read.ts` | `readPackFiles(packDir, pack) → PackFiles{defs, patches, issues}` (P05, P08) — `CONTENT_KINDS`의 `dir`/`file`로 위치를 가림 |
| `pack/index-defs.ts` | `DefIndex`, `buildIndex(rawDefs)` (P06, 중첩 이름공간) |
| `pack/patch.ts` | `patchOpSchema`, `mergePatch(target, patch)`(RFC 7386), `applyPatches(index, patches)` (P07, P09) |
| `pack/bundle.ts` | `ContentBundle`, `BUNDLE_FORMAT`, `buildBundle(index, packs)`, `contentHash(defs)` |
| `validate/kind-schemas.ts` | `KIND_SCHEMAS: Record<ContentKind, ZodType>` (W2~W4 export를 모음 — 합칠 때까지 빈 스키마 자리) |
| `validate/issues.ts` | `ContentIssue`, `IssueCode`, `formatIssue`, `zodToIssues` |
| `validate/refs.ts` | `collectRefs(schema, value) → Facts` (7.3 워커. V2 판정은 `runSemanticChecks`가 한다) |
| `validate/rules.ts` | `runSemanticChecks(index)` (V3 교차, V5, V6, V10~V12, V16, V17, V19, V20, V21, 7.2 그 밖의 교차 검사) |
| `validate/index.ts` | `validateContent(paths, opts) → {bundle?, issues}` |
| `cli.ts` | `check <팩 경로...> [--json] [--strict]`, `schema <출력 폴더>` (I11. 루트 스크립트 `content:check`·`content:schema`) |

JSON Schema 내보내기는 편집기 보조로 둔다(`pnpm content:schema`, I11). 조건·효과가 `z.unknown().superRefine`이라 그 필드는 `{}`로 나온다. 조건·효과 표가 필요해지면 등록부의 `doc`으로 만든다.

검증 기준: 픽스처 팩 3개 — base 축소판, 확장 팩(검토 시나리오 1의 `moss_forest`: 새 사냥터·모험 경로·적·연속 사건, 기반 연결은 `unlock` 조건, 밑줄 든 ID `MF_H1`의 키 묶음 플래그), 패치 팩(`tune_l05`: L05 `weight` merge) — 로 P01·P03~P09 각 1개 이상 실패(또는 경고) 테스트, merge(`null` 키 삭제·배열 교체), 순환, 결정적 번들 해시 2회 동일, 바인딩 V19(정상 `{place}`·없는 변수 오류), group 2개 depth 연속 검사.

### W2 세계 종류 스키마

경로: `packages/core/src/schema/world/` · 테스트 `packages/core/test/schema/world/**`

| 파일 | 공개 export |
| --- | --- |
| `balance.ts` | `balanceSchema`, `Balance`, `checkKindSchema`, `DEATH_CTX`(사망 제안 ctx 열거) |
| `attitude.ts` | `attitudeSchema`, `Attitude` |
| `region.ts` | `regionSchema`(판별 유니온), `Region`, `townSchema`, `huntingGroundSchema`, `dungeonFloorSchema`, `adventureRouteSchema`, `discoverySchema`, `gateSchema`, `facilitySchema` |
| `enemy.ts` | `enemyFamilySchema`, `enemySchema`, `Enemy` |
| `specials.ts` | `enemySpecials`(ParamRegistry), `registerEnemySpecial`, `enemySpecialSchema` + 4.4 기본 13종 등록 |
| `material.ts` | `materialSchema` |
| `trap.ts` | `trapSchema` |
| `guild-rank.ts` | `guildRankSchema` |
| `index.ts` | 위 전부 |

검증 기준: 5.1 balance 예시 JSON 전체(`"결정 대기"` 값은 스키마 자리에 맞는 임시값으로), 5.3 A1 예시, D3(치명 관문) 예시가 통과. 모르는 필드·잘못된 판별자·lethal 관문 lines 누락이 실패.

**W2·W3 테스트의 조건·효과 등록**: 예시에는 W4가 등록하는 조건(`first_sortie_of_character` `first_sortie_of_family` `trait_hook` `skill_rank_gte` `combat_kind` `main_place` …)과 효과(`damage` `add_fatigue` `chance` `temp_mod` …)가 들어 있다. 묶음끼리 import 금지를 유지하고, W2·W3 테스트 파일은 **첫 파싱 전에** 필요한 단말·효과를 4.1·4.2 표의 파라미터대로 테스트 안에서 `registerCondition`·`registerEffect`로 등록한다(`node --test`는 파일마다 프로세스가 따로라 등록부 잠금이 테스트 파일끼리 섞이지 않는다). 첫 파싱 뒤에는 등록부가 잠기므로 등록을 늦추면 예외다. 실제 W4 등록부로 같은 예시를 다시 검증하는 것은 합치기 순서 3단계가 한다.

### W3 물건·인물 종류 스키마

경로: `packages/core/src/schema/entity/` · 테스트 `packages/core/test/schema/entity/**`

| 파일 | 공개 export |
| --- | --- |
| `item.ts` | `itemSchema`, `Item`, `itemSourceSchema` |
| `item-effect.ts` | `itemEffectSchema` |
| `consumable.ts` | `consumableSchema`, `consumablePriceSchema` |
| `trait.ts` | `traitSchema`, `Trait`, `traitAcquireSchema` |
| `trait-hooks.ts` | `traitHooks`(ParamRegistry), `registerTraitHook`, `aiHooksSchema` + 4.8 기본 10종 등록 |
| `npc.ts` | `npcSchema`, `namePoolSchema` |
| `family.ts` | `backgroundSchema`, `achievementSchema`, `epithetSchema`, `retireRoleSchema`, `descendantReactionSchema` |
| `prop.ts` | `propSchema` |
| `index.ts` | 위 전부 |

검증 기준: 16 §2.5 W07, J01(구조자 수정자), R03, CP08(구조화 가격), TI06·TA02·TA07(acquire 3형), TM01(5.6 `mutation` 전체), W08(`shop` 2항목·흡혈귀 수정자), J05(`sources` drop 항목·`reacquire.reroll`) 예시 통과. unique인데 rolled, unique인데 `reacquire` 없음, innate인데 acquire 있음, innate인데 `birth_weight` 없음이 실패. 조건·효과 등록은 W2와 같은 방식.

### W4 사건 스키마와 조건·효과 등록

경로: `packages/core/src/schema/event/` · 테스트 `packages/core/test/schema/event/**`

| 파일 | 공개 export |
| --- | --- |
| `conditions.ts` | `registerBaseConditions()`(4.1의 57종, 모듈 로드 시 1회 실행) |
| `effects.ts` | `registerBaseEffects()`(4.2의 56종), `combatSchema`, `COST_REQUIRED_EFFECTS`(V8) |
| `context.ts` | `contextSelectors`, `registerContextSelector` + 4.5 기본 5종(params 스키마 포함) |
| `template-vars.ts` | `templateVars`, `registerTemplateVar` + 16 §1.4.3 전부(옛 표기 §1.4.4는 등록하지 않음). 조사 9쌍은 `text/template.ts`가 단일 출처 |
| `text.ts` | `textSchema`, `textSlots`, `registerTextSlot` |
| `flag.ts` | `flagDefSchema`, `derivedChainFlags(chain)` |
| `chain.ts` | `chainSchema`, `Chain` |
| `event.ts` | `eventSchema`, `Event`, `choiceSchema`, `checkSchema`, `outcomeSchema`, `effectPath`, `listChancePaths` |
| `index.ts` | 위 전부. **import 시 기본 등록을 실행**한다(조건·효과 등록부가 첫 검증 전에 채워지도록) |

검증 기준: 16 §4.4 C01-3, §4.5 F03, §4.6 조각 전부 통과(animation은 영어 키 배열로, `context_vars`는 배열로 바꿔서). 3.1의 L01 돌탑 조각(바인딩), L06(`context_vars` 2항목·흥정 `dc 16`·`accept_quest.lines`), `roll_check` 안의 `chance` 경로가 `listChancePaths`에 나옴이 통과. 단말 키 2개, 미등록 효과, `set_flag`에 `fam.` 키, hold none인데 `short` 없음, fate인데 decline 없음, `fixed` 판정에 `dc_offset`, `risk: lethal`이 실패.

### 합치기 순서(조율자)

1. W2·W3·W4 병합 → `schema/index.ts`에서 내보내기 → `pnpm typecheck`.
2. W1의 `KIND_SCHEMAS`를 실제 스키마로 연결 → W1 테스트 재실행.
3. 5.1 balance 예시 전체와 W2·W3 검증 기준 예시를 **실제 W4 등록부로** 다시 검증하는 테스트 1개를 더한다(W2·W3 테스트의 임시 등록이 W4 파라미터와 어긋나지 않았는지).
4. `pnpm check` 통과 후 이 문서의 DS 목록을 16·04·05·07·10에 반영하고 `lint_docs` 실행.

---

## 검토 기각

0.1 설계 검토(지적 41건)는 설계 문서(01·04·05·06·07·08·09·10·11·12·16)와 `common.ts` 실측으로 사실 여부를 확인했다. 사실인 지적은 모두 반영했다. 아래는 **받아들이지 않았거나 제안과 다르게 반영한 것**과 그 이유다. 시나리오 판정 4건(이끼숲·두 번째 던전·L05 가중치·새 효과)은 결함이 아니라 조치가 없고, 제안대로 W1 픽스처로 옮겼다(9절 W1).

| 지적 | 제안 | 결정 | 이유 |
| --- | --- | --- | --- |
| 키 묶음 바인딩(Critical) | `{here}`와 `{var:NAME}` 두 표기 | **표기만 기각**, 기능은 반영(3.1) | 16 §5.2 등록표 자리와 템플릿 변수가 이미 `{place}` 문법을 쓴다. 같은 모양 하나(`{place}`, `{rumor_place}`)면 작성자가 배울 문법이 늘지 않고, 등록표 자리 이름과 바인딩이 같은 정규식(FLAG_BODY)으로 검사된다 |
| 키 묶음 바인딩 | `fam.specialist_{kind}`·`fam.retired_{role}`도 바인딩 | 기각 | 값이 선택지마다 정해져 있다(F01 두 선택지, retire_role 정의의 `family_flag`). 리터럴 키로 충분하고, 바인딩은 장소 자리에만 둔다 |
| 사건 `trait_reactions` 필드 | 특성 반응을 사건 필드 하나로 | 기각 | 지금 문법으로 표현된다: 판정 보정 `check.situational {when has_trait}`, 선택지 숨김 `choice.requires`, 결과 추가 효과 `when`. 새 필드는 선택지 밖의 두 번째 효과 뿌리라 `effect_path`·적용 순서 규칙을 새로 정해야 한다. 복사는 한 사건 파일 안에 그치고 확장 팩 사이로 번지지 않는다. 사건 사이로 번지는 규칙(흡혈귀 낮 야영 제외)은 `mutation.blocked_triggers`로 반영했다 |
| `trigger_filters` 위치 | `balance.events` 또는 mutation | mutation에만 | 제외 규칙의 주인이 변이(09 §7, 10 §4.1)다. balance에 두면 두 번째 변이 팩이 balance를 패치해야 한다 |
| 조건 단말 `modifier_flag` | 습격 면제를 사건 조건으로 | 기각, 사건 `tags` + 엔진 거르기로 | 조건 방식은 습격 사건마다 `{not: {modifier_flag}}`를 복사해야 해 새 팩이 빠뜨리기 쉽다. `tags: ["raid"]`만 달면 된다 |
| `{special}` slot을 `{ref: 'enemy_special'}`로 | 등록부 검사 | W1 교차 검사(V3)로 | `enemySpecials`는 콘텐츠 이름공간이 아니라 W2 코드 등록부다. `common.ts`가 W2 파일을 import하면 분담 경계가 깨진다 |
| RefKind에 선택지 id·chain outcome | 이름공간 추가 | 기각 | 한 정의 안에서만 뜻이 있는 이름이라 전역 색인 대상이 아니다. W1 교차 검사(V14·`end_chain`)가 본다 |
| 잠금 불일치 | 문서를 "effects·conditions만 잠김"으로 고치기(가장 단순한 쪽) | 기각, 코드를 문서에 맞춤 | 다른 지적(등록부 잠금·카운터 중복)이 같은 결함을 코드 쪽에서 고치라고 했다. `modifierTargets.lock()` 한 줄과 `NameRegistry`로 끝나고, 검증 뒤 등록이 결과를 바꾸는 구멍이 닫힌다 |
| `pctPoint`를 ratio 별칭으로 | 별칭 유지 | 삭제 | 쓰는 곳이 없고, 별칭이 남으면 정수 %p를 다시 쓰게 된다 |
| check_kinds `partial_effect?: effect[] \| {mult}`, `fail_effect?: effect[] \| modifier[]` | 유니온 필드 | 필드를 나눔(`partial_effects`·`partial_mult`·`fail_effects`) | 유니온은 union 오류 메시지가 흐려지고 작성자가 모양을 고르게 된다. 수정자는 `temp_mod` 효과로 감싸면 되므로 효과 배열 하나로 충분하다 |
| check_kinds 도주 실패(적 명중 +2) | check_kinds에 | `combat.flee`에 | 전투 라운드 안 절차 값이라 효과로 표현할 대상(인물 상태)이 없다 |
| `dungeon.trap_flow`를 check_kinds 참조로 | 중복 제거 | vein 피로만 옮김 | `trap_flow`의 값(해제 실패 뒤 회피 +2, 부품 1단위)은 05 §6.1에 없는 07 절차 값이라 중복이 아니다 |
| 흡혈귀 `rest{kind: blood_rest}`·`inn{kind: cellar}`·`aging_stop_age`·`time_ratio.overrides` | 판별 객체·나이 필드 | 단순한 모양으로 | 변이 종류는 코드 열거(DS-30)라 판별자가 필요 없다. 09 §7.2는 나이가 아니라 "변이 이후 감소 없음"이므로 bool. 굶주림 밤 100%는 단계 속성(`stages[].night_ratio`)이 조건식보다 짧다 |
| 장비 평가 장소 조건을 `location_match`로 | 현재 장소 거르개 | 새 단말 `main_place` | 08 §7.3의 조건은 현재 장소가 아니라 **주 활동 장소**(최근 3회 최빈)다. `location_match`로 적으면 마을에서 평가할 때 항상 거짓이 된다 |
| `balance.reference_character.check_bonus_by_level` | 값 채우기 | 이 문서는 자리만 두고 DS-39로 올림 → D46으로 결정됨 | 검토 당시 설계 문서 어디에도 기준 인물의 탐색·기동 가정이 없어, 이 문서가 값을 지어내면 규칙 결정이 됐다. 이후 00 D46이 01 §2.4에 표를 정했고 기반 팩 `check_bonus`에 넣었다 |
| 관문 보스 밤 +1 | 적용 여부 적기 | DS-37로 | 07 §7.1이 조우 적만 말한다. 규칙 선택이라 여기서 확정하지 않는다 |
| 노년기 걷기 ×0.9(09 §1.2) | balance에 | 기각 | 스프라이트 재생 속도라 15(아트) 소유 연출 값이다. 규칙이 읽지 않는다 |
| S04 연출 3+2+4초 | balance에 | 사건 `intro.animation[].sec` | 사건 하나의 연출이라 그 사건 데이터에 둔다 |
| 선택 창 변형 `body_insert_after` + `body_append` | 두 필드 | `{when, text, after_paragraph?}` 하나 | 끝에 붙이기는 `after_paragraph` 생략으로 같다 |
| 파생 플래그에 chain id를 소문자로 바꾸지 않고 그대로 | 대안 | 기각, id 형식 제약으로 | 플래그 키는 소문자로 시작해야 한다(FLAG_BODY). 대문자 id를 그대로 넣으면 모든 파생 키가 형식 오류가 된다 |
| `regionFilter.tags_all` | 추가 | 기각 | 쓰는 곳이 없다. `tags`는 하나라도(any)로 정의만 했다 |
| `region.rescuers` 기본값(층 → dungeon, 그 밖 → field) | 유지 | 기본값 삭제, 마을 외 필수 | 기본값을 두면 코드가 balance 표 키 이름(`field`·`dungeon`)을 알아야 한다(I04 취지) |
| check 규칙 "`region` 종류는 `dc_offset`만" | (지적은 fixed만 다룸) | 넓혀 반영 | 11 L09 `날씨 견디기 vs 12`처럼 지역 기준 종류도 사건이 고정 DC로 덮어쓴다. `region`에도 `dc`를 허용했다 |
