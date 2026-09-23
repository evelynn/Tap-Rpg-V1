# 콘텐츠 팩 만들기 (CONTENT_GUIDE)

작성일 2026년 9월 23일 · 대상 독자: 코어 코드를 고치지 않고 지역·적·사건·장비를 더하는 사람

형식의 단일 출처는 `docs/dev/CONTENT_SCHEMA.md`다. 이 문서는 **그 형식으로 실제 팩을 만드는 절차**만 적는다.
살아 있는 예시는 `content/examples/mist-forest`(안개 이끼숲)다 — 사냥터·모험 경로·새 적·생활 사건 2개·3단계 줄기·고유 장비가 들어 있고, 기반 팩과 코어를 한 줄도 고치지 않는다.

---

## 1 팩 하나 만들기 (10분)

```bash
mkdir -p content/my-pack/events/life
```

`content/my-pack/pack.json`:

```json
{ "id": "my_pack", "name": "내 팩", "version": "0.1.0", "requires": ["base"] }
```

- `id`는 소문자 snake_case이며 전체에서 고유하다. **폴더 이름은 자유**다(`mist-forest` 폴더의 팩 id는 `mist_forest`).
- `requires: ["base"]`를 쓰면 기반 팩이 먼저 로드된다. 기반 팩 ID를 가리키려면 반드시 넣는다.

검사:

```bash
pnpm content:check                                     # 기반 팩만
npx tsx packages/content-kit/src/cli.ts check content/base content/my-pack
npx tsx packages/content-kit/src/cli.ts check content/base content/my-pack --strict   # 경고도 실패로
```

종료 코드 0이면 통과다. `--json`을 붙이면 이슈를 기계가 읽는 형태로 낸다.

## 2 파일을 어디에 두나

| 넣을 것 | 경로 | 파일 모양 |
| --- | --- | --- |
| 장소 | `regions/*.json` | 객체 1개 또는 배열 |
| 적 | `enemies/*.json` | 객체 1개 또는 배열 |
| 장비 | `items/*.json` | 객체 1개 또는 배열 |
| 줄기(연속 사건) | `chains/<ID>.json` | **파일 1개 = 정의 1개**, 파일 이름 = id |
| 사건 | `events/{life,chain,fate,system}/<ID>.json` | **파일 1개 = 정의 1개**, 파일 이름 = id, 폴더 = `category` |
| 플래그 등록 | `flags.json` | 배열 1개 |
| 기존 정의 수정 | `patches/010_*.json` | 패치 연산 배열 |

- 종류 목록 전체는 CONTENT_SCHEMA §1.3이다. 표에 없는 경로의 `.json`은 **P05 오류**다.
- 종류 폴더 아래 하위 폴더는 자유다(`regions/forest/h1.json`). `events/`만 첫 단계가 분류 폴더다.
- 모든 객체에 `_note`·`_comment`(문자열)를 넣을 수 있다. 그 밖의 모르는 필드는 **S01 오류**다(strict).
- 에셋(`background_id`·`sprite_family`·`palette_id`)은 M2 전까지 **기반 팩 것을 다시 쓴다**.

### ID 관례

검사하지는 않지만 팩 고유 접두를 붙인다(`MF_H1`, `MF_EN01`, `MF_C01`). ID는 종류별 이름공간이라 장소 `MF_A1`과 장비 `MF_A1`은 서로 다른 정의지만, 사람이 헷갈린다.
줄기 id만 형식이 강제된다: `^[A-Z][A-Z0-9_]*$` (대문자·밑줄, 하이픈 금지).

## 3 기반 팩을 고치지 않고 잇는 법

**기반 정의를 patches로 덮어쓰지 않는다.** 기반이 바뀌면 옛 값으로 되돌려 버린다. 새 팩 쪽에서 기반을 가리킨다.

| 하고 싶은 것 | 이렇게 한다 |
| --- | --- |
| 새 지역을 세계에 연결 | 새 지역의 `unlock` 조건(`{"level_gte": 10}`, `{"discovered": "MF_H1"}`) |
| 새 지역을 발견으로 열기 | 새 모험 경로의 `discoveries[]`에 `{"type":"unlock_location","location_id":"MF_H1"}` (가문 발견이 되어 후손은 레벨 조건 없이 안다) |
| 기반 생활 사건이 새 지역에서도 나오게 | 사건 쪽에서 `locations` 대신 `location_match {kinds, tags}`를 쓴다. 새 지역이 그 `tags`만 가지면 된다 |
| 새 장비를 상점에 진열 | 장비 파일의 `shop`. 마을(T00) 시설 정의는 건드리지 않는다 |
| 새 적을 기존 사냥터에 | 그 장소의 `encounters`는 기반 소유다. 새 적은 **새 장소**에 넣는다(기존 장소에 넣으려면 patch뿐) |

예시 팩 `mist-forest`는 patch를 하나도 쓰지 않는다.

## 4 자주 쓰는 조건·효과

조건(CONTENT_SCHEMA §4.1, 57종) — `{"all":[…]}` `{"any":[…]}` `{"not":c}` `{"num":{key,op,value}}` `true` `false`, 단말은 키 1개 객체.

```json
{ "level_gte": 10 }                                  // 레벨
{ "visited": "H1" }                                  // 이번 생애 방문
{ "discovered": "MF_H1" }                            // 가문 단위 발견(후손도 안다)
{ "discovery_found": "MF_A1-1" }                     // 이번 생애 발견 지점
{ "flag": "life.mf_spirit_met" }                     // 플래그
{ "not": { "flag": "fam.mf_c01_done" } }
{ "chain_stage": { "chain": "MF_C01", "stage": 1 } } // 줄기 단계
{ "num": { "key": "counter.wins.MF_H1", "op": ">=", "value": 3 } }
{ "location_match": { "tags": ["foggy"] } }
```

효과(§4.2, 56종) — `{type, when?, …}`. `when`은 그 효과 하나에만 걸리는 조건이다.

```json
{ "type": "add_coins", "units": 2 }                 // units = 장소 단위 보상
{ "type": "add_xp", "units": 1 }
{ "type": "heal", "hp_ratio": 0.15 }
{ "type": "add_fatigue", "value": -8 }
{ "type": "add_item", "item_id": "MF_W01", "to": "bag_or_pending" }
{ "type": "set_flag", "key": "life.mf_firefly_marked_{place}" }
{ "type": "advance_chain", "chain_id": "MF_C01", "stage": 1 }
{ "type": "end_chain", "chain_id": "MF_C01", "outcome": "bond" }
{ "type": "temp_mod", "modifier": { "target": "discovery_chance_mult", "op": "mul", "value": 1.3 }, "scope": "sortie" }
{ "type": "skill_use", "skill": "search", "count": 1 }
{ "type": "journal", "tag": "trait", "line": "…", "when": { "has_trait": "TI03" } }
```

**수치는 직접 쓰지 않는다.** 보상은 `units`(장소 단위)로, 경계값은 `balance`의 키를 가리키는 조건으로 쓴다. `add_coins {amount: 350}`처럼 적으면 밸런스가 바뀔 때 팩이 따라가지 못한다.

**`{place}` 바인딩**(§3.1): 플래그 키 꼬리와 수정자의 `{region}` 자리에 쓰면 평가 시점의 장소로 바뀐다. 같은 사건을 여러 장소에서 쓸 때 장소별 기록을 남기는 방법이다.

```json
"weight_mods": [ { "when": { "flag": "life.mf_firefly_marked_{place}" }, "mult": 3 } ]
```

플래그는 `flags.json`에 **먼저 등록**해야 한다(V19). 범위 접두(`life.` `fam.` `trip.`)가 효과 종류와 맞아야 한다(`set_flag`는 `life.`, `set_family_flag`는 `fam.`).
줄기 파생 키(`life.{줄기소문자}_stage`, `fam.{줄기소문자}_done`, `fam.{줄기소문자}_{outcome}`, `fam.{줄기소문자}_unfinished`)는 로더가 자동 등록하므로 적지 않는다.

## 5 사건 하나를 처음부터 쓰기

`content/my-pack/events/life/MY_L01.json` — 파일 이름 = id = `MY_L01`, 폴더 = `category: "life"`.

```json
{
  "id": "MY_L01",
  "name": "거대한 버섯 그늘",
  "category": "life",
  "location_match": { "tags": ["foggy"] },
  "triggers": ["after_encounter", "adventure_event_scene"],
  "condition": true,
  "weight": 7,
  "cooldown_min": 30,
  "max_per_life": 4,
  "allow_serious_injury": false,
  "hold": "none",
  "intro": {
    "lines": [ "사람 키만 한 버섯이 그늘을 드리웠다", "{name:이/가} 갓 아래에서 숨을 골랐다" ],
    "detail": "우산처럼 벌어진 갓 아래는 안개가 얕고 바람이 없다.",
    "tag": "rest",
    "animation": [ { "action": "discover" }, { "action": "sit_eat" } ]
  },
  "choices": [
    { "id": "rest", "label": "갓 아래에서 쉰다", "short": "버섯 그늘에서 쉬었다",
      "tags": ["rest", "safe"], "risk": "none",
      "outcomes": { "always": { "effects": [ { "type": "heal", "hp_ratio": 0.15 } ], "line": "한숨 돌렸다" } } },
    { "id": "harvest", "label": "갓을 베어 담는다", "short": "버섯 갓을 베어 담았다",
      "tags": ["reward"], "risk": "low",
      "check": { "kind": "forage", "dc_offset": 0 },
      "outcomes": {
        "success": { "effects": [ { "type": "add_coins", "units": 2 } ], "line": "흰 갓만 골라 담았다" },
        "partial": { "effects": [ { "type": "add_coins", "units": 1 } ], "line": "무른 갓이 섞였다" },
        "failure": { "effects": [ { "type": "add_fatigue", "value": 4 } ], "line": "포자가 날렸다" }
      } }
  ]
}
```

한 줄씩 왜 그런가:

1. `triggers` — 언제 후보가 되는가. 사냥터는 `after_encounter`, 모험 경로 장면은 `adventure_event_scene`, 던전은 `dungeon_event_room`·`dungeon_after_room`, 그 밖에 `town_return`·`camp`.
2. `locations` / `location_match` — 둘 중 하나. 둘 다 없으면 모든 장소다. 여러 장소 공통 사건은 `location_match`를 쓴다.
3. `weight` — **1~10 정수**(V13). 그 밖의 값은 오류다. 세부 조절은 `weight_mods`로 한다.
4. `hold` — `none`이면 AI가 바로 고른다. `branch`·`fate`면 사람에게 선택 창을 띄우고, 그때는 `preview.body`·`hold_line`·선택지별 `preview{benefit,cost,reversible}`가 **필수**다(V8).
5. `hold: "none"` 사건은 모든 선택지에 `tags`(1~2개)·`risk`·`short`가 필수다(V7).
6. **어떤 사건이든 `risk`가 `none` 또는 `low`인 선택지가 최소 1개** 있어야 한다(V7). `risk: "lethal"`은 금지다(V10).
7. `check`가 있으면 `outcomes`에 `success`·`failure`가 필수다. `partial`을 쓰려면 그 판정 종류가 `balance.check_kinds.<종류>.partial: true`여야 한다(V11).
8. `check.dc` / `dc_offset` — 판정 종류의 `dc.kind`가 `region`이면 `dc_offset`, `fixed`면 생략하거나 `dc`, `event`면 `dc` 또는 `dc_offset` 중 하나가 필수다. `level_formula`·`enemy_ac` 종류는 사건에서 못 쓴다(V20).
9. `intro.lines`는 **2줄 이상**, 한 줄 길이는 `balance.ui.line_max` 이하(V6), `detail`은 줄마다 80자 이하다.
10. 템플릿 변수(`{name:이/가}`)는 코어 등록부에 있는 이름만 쓴다(V5). 조사 쌍은 `이/가` `은/는` `을/를` `과/와` `으로/로` 등 9종이다.

## 6 검증 오류 코드 읽는 법

메시지는 `{심각도} {코드} {팩}/{파일}#{JSON 포인터}: {설명}` 한 줄이다.

```text
error V2 mist_forest/regions/MF_H1.json#/encounters/0/enemy_id: enemy 'MF_EN09'가 없다
```

| 코드 | 뜻 | 대개의 원인 |
| --- | --- | --- |
| P01 | `pack.json` 스키마 위반 / 로드할 팩 없음 | `id`가 snake_case가 아니다, 경로를 잘못 줬다 |
| P03 | `requires` 팩이 로드 대상에 없다 | `check` 인자에 기반 팩을 빠뜨렸다 |
| P04 | `requires` 순환 | |
| P05 | 경로·파일 모양 | `events/`에 배열, 파일 이름 ≠ `id`, 폴더 ≠ `category`, 표에 없는 경로 |
| P06 | `(kind, id)` 중복 | 기반 팩이 이미 정의한 ID를 다시 정의했다 → 패치를 쓰거나 ID를 바꾼다 |
| P07 | 패치 대상 없음 / `merge`가 아닌 op | |
| P08 | JSON 해석 실패 | 쉼표·따옴표 |
| P09 (경고) | 두 팩이 같은 `(kind, id, 최상위 키)`를 merge | 뒤 팩이 앞 팩을 조용히 덮어쓴다 |
| S01 | 스키마 위반 | **모르는 필드**(오타), 필수 필드 누락, 형식 불일치 |
| V2 | 참조 무결성 | 없는 ID를 가리킨다(적·장소·특성·문형·판정 종류) |
| V3 | 조건·수정자 문법 | 모르는 조건 키, 모르는 수정자 target, op가 그 target에 허용되지 않음 |
| V4 | 효과 문법 | 모르는 `type`, 파라미터 누락, "정확히 하나" 위반(`amount`와 `units`를 같이 씀) |
| V5 | 템플릿 | 등록되지 않은 변수, 조사 쌍 오류 |
| V6 | 한 줄·상세 기록 길이 | `line`이 `balance.ui.line_max` 초과, `detail` 줄이 80자 초과 |
| V7 | 자동 선택 정보 | `hold: none`인데 `tags`·`risk`·`short` 없음, 또는 none/low 선택지가 0개 |
| V8 | 선택 창 정보 | `hold ≠ none`인데 `preview.body`·`hold_line`·선택지 `preview` 없음 |
| V10 | `risk: lethal` 선택지 | 첫 검증판에서 금지 |
| V11 | 부분 성공 | `partial`을 썼는데 그 판정 종류가 부분 성공을 지원하지 않음 |
| V12 | 줄기 단계 | `stage`가 1..stages에 빈틈·중복, 또는 n단계 사건 조건의 `all` 최상위에 `chain_stage {stage: n−1}`이 없음 |
| V13 | 가중치 | `weight`가 1~10 정수가 아님 |
| V15 | 고유 장비 | `unique: true`인데 `grade_mode`가 `fixed`가 아니거나 `reacquire`가 없음 |
| V17 (경고) | 적 수치 | `balance.enemy_formula`로 계산한 값과 다름. 의도한 값이면 `_note`를 달면 억제된다 |
| V19 | 플래그 키·바인딩 | `flags.json`에 등록되지 않은 키, 범위 접두 불일치, 장소가 아닌 자리에 `{place}` |

전체 표는 CONTENT_SCHEMA §7.1~§7.2.

## 7 체크리스트

### 새 지역을 더할 때

- [ ] `kind`에 맞는 필드를 다 채웠나 — 사냥터는 `encounters`·`pair_chance`·`event_check`, 모험 경로는 `scenes`·`scene_weights`·`encounters`·`pair_chance`(+`discoveries`·`map_fragments`), 던전 층은 `dungeon{group,depth}`·`rooms`·`room_weights`·`trap_table`·`treasure_table`·`gate`
- [ ] `level_range`·`level_mid`·`travel_sec`·`unlock`·`rescuers`·`background_id`
- [ ] `unlock`으로 세계에 이었나(레벨, 또는 다른 장소의 `unlock_location` 발견)
- [ ] `encounters`의 적이 그 레벨대인가(적 `level` vs `level_range`)
- [ ] 기반 생활 사건이 따라오게 하려면 `tags`·`kind`가 그 사건들의 `location_match`에 맞나
- [ ] 던전 층이면 같은 `group`의 `depth`가 1부터 빈틈 없이 이어지나
- [ ] `pnpm content:check` 대신 **기반 + 새 팩**을 함께 검사했나

### 새 시나리오(줄기)를 더할 때

- [ ] `chains/<ID>.json` 하나 — `stages`, `outcomes`(snake_case), `stage_summaries`(단계 수만큼), `unfinished_line`
- [ ] 단계마다 `events/chain/<ID>-n.json` 하나, `chain: {id, stage: n}`
- [ ] 1단계 조건에 `chain_stage {stage: 0}` + `{"not": {"flag": "fam.<소문자>_done"}}`
- [ ] n단계(n>1) 조건의 `all` **최상위**에 `chain_stage {stage: n−1}` (V12)
- [ ] 단계마다 `max_per_life: 1`을 두면 **모든 결과가 단계를 올리는지** 확인한다(실패가 단계를 안 올리면 줄기가 막힌다)
- [ ] 마지막 단계의 모든 결과에 `end_chain`, `outcome`은 줄기의 `outcomes` 중 하나
- [ ] 보상이 고유 장비면 `unique: true` + `grade_mode: "fixed"` + `fixed_grade` + `sources` + `reacquire`(V15)
- [ ] 새 플래그는 `flags.json`에 등록(파생 키는 적지 않는다)
- [ ] 실제로 끝까지 가는지 — 세계를 돌려서 확인한다(§8)

## 8 돌려 보고 증명하기

검증 통과는 "형식이 맞다"까지다. **실제로 나오는지**는 세계를 돌려서 본다.
`packages/content-kit/test/expansion.test.ts`가 그 틀이다:

```ts
const result = validateContent([BASE, MY_PACK])          // 1. 검사 → 번들
const content = Content.fromBundle(result.bundle!)        // 2. 코어가 읽는다
const world = createGameWorld(content, { … })             // 3. 세계
world.state.policies.destination = 'MY_H1'                // 4. 목적지 고정
for (…) world.advance(60)                                 // 5. 1분씩 흘린다
assert.ok(world.state.character!.visited.includes('MY_H1'))
assert.ok((world.state.character!.event_counts['MY_L01'] ?? 0) > 0)
```

- 새 지역이 **후보로 오르는지**는 `decideCandidates(world, false)`로 바로 볼 수 있다. 후보에 없으면 `unlock`(F1)·길드 등급(F2)·위험 상한(F7)을 차례로 의심한다. 위험 등급은 인물 레벨뿐 아니라 **장비 단계**가 유효 레벨에 들어가므로, 레벨만 올린 시험 인물은 새 지역이 `high`로 잡혀 걸러진다.
- 사건이 안 나면 `weight`·`condition`·`triggers`·`cooldown_min`·`max_per_life`와 장소의 `event_check`를 본다.

## 9 팩이 할 수 없는 것 (코어 몫)

데이터로 안 되는 것은 코어 등록부에 이름을 더해야 한다(CONTENT_SCHEMA §4). 확장 팩만으로는 다음을 못 한다.

- **새 조건 단말·새 효과 `type`·새 수정자 target·새 적 특수능력·새 사건 변수 선택자** — 코어 등록부(+핸들러 맵 1곳)에 더한다.
- **새 문형 id(`text/`)** — 문형 id는 코어 등록부 `textSlots` 소유다. 코어가 부르지 않는 id를 팩이 더해도 아무도 읽지 않는다. 사건 안 문장은 `line`·`detail`로 직접 쓰면 되므로 보통 문제가 되지 않는다.
- **기존 장소의 조우 표·기존 사건 수정** — 그 정의의 소유자는 기반 팩이다. 꼭 필요하면 `patches/`를 쓰되, 배열은 통째로 교체되므로 기반이 바뀌면 따라가지 못한다는 점을 안다.
- **새 에셋** — M2 전까지 기반 팩의 에셋 id만 다시 쓴다.
