# PROMPTS — 이미지 생성 전달용 프롬프트 모음

버전 1.4 · 2026년 9월 24일 · 대상: 이미지 생성 모델을 쓰는 제작 AI
1.4: **규격 고정 절차**(§0.4) — 모든 생성 요청에 배치 틀 이미지(입력 1) + 틀 블록 T + 틀 수치 블록 NUM(§8, `docs/art/templates/<시트>.json`에서 옮김)을 붙이고, 결과를 `pnpm art:gate`에 통과시켜 떨어지면 지적문을 붙여 다시 생성한다(최대 3번). 「약 38블록」「칸의 10% 위」 같은 어림 크기 문장을 NUM으로 바꿨다. v04 검토(§2.4) 반영: REF-A 재생성 문장, 표정은 틀 `chr_face` 12칸 합성(L7), 옷·무기 떼기 요청 중지(도구 `derive`), 모양 가림막 L8. 몬스터는 P2 §2.0 「몬스터 표준」(황금 표본 = 들쥐 r3). 제작 AI에게 넘기는 묶음은 `V05_REQUEST.md`.
1.3: `OPEN_DECISIONS.md` 사용자 결정(2026-09-24) 반영 — 규격은 48만(D64, 32 편집 E·32 칸 폐기), 무기는 셀 밖 허용(D65, S-W 문장·E6 고침), 정규화의 화소 옮기기·자르기(D66), NPC `임시` 외형 승인(§7), 전체 순서(§5.3)·진행표(§6) 갱신.
1.2: 네 문서(이 문서·`prompts/P1_character.md`·`P2_world.md`·`P3_scenes.md`) 정합 — §5 색인과 전체 제작 순서, §6 단일 진행표, §7 NPC 외형 단일 출처 신설. 배경 금지 블록 D-BG와 교체 편집 머리말 S·S-W를 §1로 모음. 편집이 색을 바꾸지 않게(§3.2, E21). 단검은 손에 든 합성에서 떼기(§3.3). 정규화·미리보기 도구 결과(§2.3). 확인 필요는 `OPEN_DECISIONS.md` 한 곳에 모은다.
1.1: v03 검토 반영(§2.2) — 기준 인물 지정, 편집 규칙 강화(보이는 화소만·배경 단색), 배경은 합성 후 분리, 32 규격은 48 편집, 그림자·책·검 보완, P0 진행표(§6)
제작 방식 규칙은 `ASSET_ORDERS.md` 0.0절(D56)이다. **이 문서와 `prompts/` 세 문서의 프롬프트는 카드의 프롬프트보다 우선한다.** 카드의 규격·동작 설명은 프롬프트 문서가 옮기지 않은 세부를 확인할 때 본다. 규칙·수치는 `docs/design/15_아트_스프라이트_사양.md`(이하 15)가, 인물·세계는 02가, 사건 원문은 11이 소유한다(00 §2.4). 프롬프트 문서와 소유 문서가 다르면 소유 문서가 맞다.
출발점은 v02 시안(`assets/_imagegen/v02/`)의 프롬프트다. 외형·일관성이 확인된 문장은 그대로 살렸고, v02에서 나온 문제는 공통 블록에 막는 문장을 넣었다.

---

## 0 쓰는 법

### 0.1 프롬프트 조립

한 번의 생성 요청 = **[A 스타일] + [B 주인공 정체성](캐릭터일 때) + [T 틀] + [NUM 틀 수치] + [C 배치] + [에셋 본문] + [D 금지]**를 순서대로 이어 붙인 하나의 글이다(v1.4: T·NUM 추가, §0.4).
공통 블록은 줄이지 말고 전문을 붙인다. `{...}` 자리는 에셋 본문이 정한 값으로 바꾼다. 크기·위치 수치는 NUM만 가진다 — 본문·C에 「약 N블록」「칸 높이의 몇 분의 몇」 같은 어림 수치를 새로 쓰지 않는다. 틀이 아직 없는 시트(§0.4.3 「틀 필요」)만 T·NUM 없이 옛 조립을 쓴다.
요청 본문이 D가 금지하는 것을 그리게 하면(배경·효과·아이콘·떠 있는 표시) **D 대신 그 요청에 맞는 D 변형을 붙인다**(§1 D 변형 표). 금지 문장과 요청이 부딪히면 모델은 둘 중 하나를 무시한다(v03 배경이 그 예다).
편집 요청(떼기·교체)은 §1 S·§3.2 X 머리말로 시작하고 A·B·C를 붙이지 않는다. 입력 이미지가 정체성과 배치를 가진다.

### 0.2 제작 순서 (레이어 부품은 편집으로 떼어 낸다)

캐릭터는 몸체·얼굴·머리카락·옷·무기가 **따로 겹쳐지는 레이어**다(15 §3). 부품을 따로 생성하면 칸마다 위치가 어긋나 겹치지 않는다. 그래서 순서를 이렇게 한다.

0. **기준 인물(마스터)**: `assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`다. 이후 모든 캐릭터 시트(걷기·가죽옷·표정)는 이 이미지를 **정체성 참고 입력**으로 함께 넣는다. 입력 없이 새로 생성하면 머리 모양·얼굴 비율이 달라진다(v03 걷기 시트가 그랬다).
1. **기준 합성 시트**를 생성한다. 모든 부품을 입은 완성 캐릭터로 동작 시트를 만든다(§3.1). 외형·동작·배치를 여기서 확정한다.
2. 기준 합성 시트가 합격하면, 그 이미지를 **편집 입력**으로 넣고 "이 부품만 남기고 나머지는 투명"으로 편집해 레이어를 얻는다(§3.2). 같은 이미지에서 떼어 내므로 위치가 맞는다. **무기·손 소품도 예외 없이 이 방식이다**(§2.3: 단독 생성한 단검은 밀도가 맞지 않았다).
3. 떼어 낸 부품은 **입력에서 보이던 화소만, 입력의 색 그대로** 남긴다. 가려져 있던 부분을 새로 그려 넣거나, 소매를 늘리거나, 모양을 다듬거나, 색을 밝게·진하게 바꾸면 안 된다. 입력에서 피부가 보이던 자리는 옷 레이어에서 비어 있어야 한다(몸체 레이어가 그 자리를 가진다). 그래야 몸체 + 옷 + 머리를 겹쳤을 때 기준 시트와 똑같아진다.
4. 편집이 부품을 떼어 내지 못하면(아래 v02 사례처럼 결과가 입력과 같으면) **코드로 자르지 말고** 멈추고 검토 기록에 적는다. 게임 쪽이 다른 방법을 정한다.

### 0.3 한 장을 낼 때

- 생성 결과를 **그대로** 저장한다. 코드로 자르기·축소·배경 제거·색 변환을 하지 않는다(D56).
- 저장 위치: `assets/_imagegen/{판}/{접두사}{번호}-{이름}.png` + 같은 이름 `.prompt.txt`(보낸 프롬프트 전문) + 폴더의 `README.md`(포즈 수, 눈으로 본 결과, 남은 차이). 접두사는 §5.2.
- 결과가 기준과 다르면 **프롬프트를 고쳐 다시 생성**한다. 고친 문장을 `.prompt.txt`에 남긴다.
- 합격 판정은 먼저 **문**(`pnpm art:gate`, §0.4 — 캔버스·배경·칸·지면선·중심·키·블록·반투명)이고, 문을 통과한 것만 §4 육안 기준으로 본다. 색 수 검사는 게임 쪽 정규화 뒤에 한다.

### 0.4 규격 고정 절차 (v1.4, 모든 시트 공통)

사용자 요청(2026-09-24): 「제약조건을 빠듯하게 넣어야 된다. 그림은 제대로 나오되 스프라이트의 규격에는 꼭 맞도록.」 v04는 모든 장이 캔버스부터 달랐다(2172 × 724, 1774 × 887, 916 × 1717 …, 투명 배경에 속 반투명 화소 38만~64만 개, §2.4). 어림 문장(「about four fifths of the cell」)은 지켜지지 않으므로 **규격은 틀 이미지 + 수치 + 기계 검사**가 가진다(CLAUDE.md §5: 형식은 코드가 소유한다). 틀·문 도구는 `tools/art-check/README.md` 「배치 틀과 납품 문」이다.

#### 0.4.1 절차 (생성 한 번마다)

1. **틀 고르기**: §0.4.2 표에서 이 시트의 틀 이름 `<시트>`를 찾는다. 「틀 필요」(§0.4.3)면 이 절차를 쓰지 않고 옛 조립으로 요청한 뒤 README에 「틀 없음」이라 적는다.
2. **입력 1 = 틀 이미지**: `docs/art/templates/<시트>.placeholder.png`(없으면 `<시트>.grid.png`, 표의 「붙일 틀」 열이 정한다). 입력 2부터가 정체성·스타일 입력(마스터, 황금 표본 등)이다.
3. **글**: A(+B) + **T**(§1) + **NUM(<시트>)**(§8 그대로 복사) + C + 본문 + D. 생성 도구의 출력 크기는 NUM의 캔버스(1536 × 1024 또는 1024 × 1536)로 **직접 지정**하고, 배경은 투명이 아니라 불투명 `#FF00FF`로 받는다.
4. **문**: `pnpm art:gate <결과.png> --spec <시트>`. 종료 코드 0 = 통과 → §4 육안 기준으로 간다.
5. **떨어지면**: 출력의 `Regeneration feedback:` 문단을 **그대로** GF 블록(§1)으로 같은 글 끝에 붙여 다시 생성한다. 생성은 **최대 3번**(처음 + 다시 2번). 파일 이름은 `-r2`, `-r3`.
6. **세 번째도 떨어지면** 멈추고 보고한다: 세 PNG, 각 `art:gate` 출력, 보낸 글 전문을 폴더 `README.md`에 적는다. 코드로 고치거나 자르지 않는다. 같은 지적이 두 번 되풀이되면 게임 쪽이 구조(틀·수치·블록 문장)를 다시 본다(CLAUDE.md §5).

- **편집 요청(떼기·교체·색 교체·가림막)**: 입력 이미지가 틀이다. T·NUM을 붙이지 않고 「입력 캔버스·칸 그대로」 문장(X·S·SW·SC-E)을 쓴다. 입력이 틀 위에서 만든 것이면 편집 결과도 **같은 `--spec`으로 문을 통과**해야 한다. v03·v04 원본(틀 이전)을 편집한 결과는 캔버스가 틀과 달라 캔버스 모드 문을 쓸 수 없다 — `--no-canvas`(행 구성은 §0.4.2 표)로 참고만 하고, 합격은 겹침 기준(E8·E13·E21)과 `layers` 측정(`tools/art-check/README.md`)으로 한다.
- 틀의 자리표시 인물은 **크기·위치만** 준다(v03 마스터라 바지가 옛 회색이다). 색·자세·정체성은 B·입력 2·본문이 가진다(T 블록 문장).
- 수치의 출처는 `docs/art/templates/<시트>.json`(도구 `pnpm art:template`이 `specs.json`에서 만든다)이고 §8은 그것을 영어로 옮긴 것이다. 규격이 바뀌면 `specs.json` → `pnpm art:template` → §8을 다시 옮긴다(수작업 옮김을 없애는 도구 작업은 `OPEN_DECISIONS.md` T13).

#### 0.4.2 틀 대응표 (프롬프트 시트 → 틀)

「붙일 틀」은 입력 1이다. `P` = `<시트>.placeholder.png`, `G` = `<시트>.grid.png`. 「편집」은 입력이 틀이라 T·NUM이 없다.

| 프롬프트 (문서 §) | 틀 `<시트>` | 붙일 틀 | 문 명령 `pnpm art:gate <png> …` |
| --- | --- | --- | --- |
| REF-A 걷기 12 (§3.1) | **임시** `chr_elder` 격자(= 걷기 12 격자, 바이트까지 같음 확인) | `chr_elder` G | `--spec chr_elder --rows walk:6,walk:6` · NUM(chr_walk12) |
| REF-B·REF-C·REF-D·REF-E 바지 색 교체, 몸체 L1, 가림막 L3·L8 (§3.2, P1 §3.1·§3.4) | 편집(v03·v04 원본) | — | 캔버스 모드 없음. 참고: `--spec chr_actions_a --no-canvas --rows idle,attack,sit_eat,sleep`(REF-B) |
| L7 표정 합성 12 (§3.2) → P1 §3.2 가는 눈·§3.3 홍조·§11.2 주름 | `chr_face` | P | `--spec chr_face` |
| REF-H 머리 자세 3 (P1 §2.3) → P1 §4·§6·§9.3·§10 교체 | `chr_head_poses_ref` | P | `--spec chr_head_poses_ref`(교체 편집도 같은 명령) |
| NPC 전신 기준 `n01` (§7.4, 다시 만들 때) | `npc_ref` | P | `--spec npc_ref` |
| 몬스터 늑대·박쥐·코볼트 (P2 §2.0~§2.3) | `enm_wolf` · `enm_bat` · `enm_kobold` | 늑대 G(자리표시가 v04 불합격 늑대라 쓰지 않는다) · 박쥐 G · 코볼트 G + 황금 표본 `enm_rat` P | `--spec enm_wolf` 등 |
| 적 변형·정예 교체 (P2 §2.4) | 편집(입력 = 틀 위의 계열 시트) | — | 입력과 같은 `--spec` |
| 보스 시트 1 (P2 w35) · 시트 2 + 파동 (P2 w36) | `boss_bellwarden_a` · `boss_bellwarden_b` | G | `--spec boss_bellwarden_a` · `_b` |
| 배경 기본 장면·계절·시간대·먼 층 FILL (P2 §4.1~§4.4) | `bg_far` | G | `--spec bg_far` |
| 배경 중간 층 떼기 · 가까운 층 떼기 (P2 §4.1) | `bg_mid` · `bg_near` | 편집 | `--spec bg_mid` · `--spec bg_near` |
| 안개 띠 (P2 §6 w17b) | `bg_mid`(같은 띠, 하늘 자리 자홍) | G | `--spec bg_mid` |
| UI 아이콘 12 × 12 15개 (P2 §9 w25 + w28b) | `ui_icon_12` | G | `--spec ui_icon_12` |
| UI 아이콘 16 × 16 27개 (P2 §9 w26 + w27 + w28a) | `ui_icon_16` | G | `--spec ui_icon_16` |
| NPC 초상 64 11 (P2 w43 + w44) | `por_npc_64` | G | `--spec por_npc_64` |
| NPC 초상 48 11 (P2 w45) | `por_npc_48` | G | `--spec por_npc_48` |
| 이벤트 장면 열쇠 띠·띠 (P3 §0.4) | `scene_event` | G | `--spec scene_event` |

#### 0.4.3 틀 필요 (수치를 지어내지 않는다)

아래 시트는 `specs.json`에 맞는 틀이 없다. 틀이 생길 때까지 옛 조립(어림 문장)으로 요청하고 문 검사 없이 육안 기준만 본다. 틀을 더하는 일은 `OPEN_DECISIONS.md` T12(도구)다. 「제안」은 `specs.json`에 더할 줄의 뜻이고 수치는 `pnpm art:template`이 정한다.

| 시트 (문서 §) | 왜 기존 틀이 안 맞나 | 제안 |
| --- | --- | --- |
| REF-A 걷기 12 `chr_walk12` (§3.1) | 게임 시트 틀은 걷기 6. 임시로 `chr_elder` 격자 + `--rows`를 쓴다(§0.4.2) | `character`, 행 `walk`,`walk` |
| REF-B 동작 18 (§3.1, 다시 만들 때만) | 대기 4·공격 6·앉기 4·잠 4는 `chr_actions_a`·`_b` 행 묶음과 다르다 | `character`, 행 `idle`,`attack`,`sit_eat`,`sleep` |
| REF-D 11 · REF-E 9 (P1 §2.1·§2.2, 다시 만들 때만) | 피격·발견·상호작용 / 환호·쓰러짐 묶음 | `character`, 행 `hit`,`discover`,`interact` / `cheer`,`collapse` |
| REF-P 봇짐·배낭·등불 6 · REF-Q 착용 7 (P1 §9.1·§7.3) | 대기 자세 + 소품 칸 | `character`, 행 `idle:6` / `idle:4`,`idle:3` |
| 책 2 · 그림자 1 (§3.3) | 책은 `prop_anim_b` 4행(다른 소품 8칸과 한 장), 그림자는 틀 없음 | 생성 묶음별 틀 또는 `prop_anim_b` 한 장 생성(OD-74) |
| 정예 깃발 16 × 16 (P2 §2.5) · 날씨 입자 16 × 16 (P2 §6 w17a) | 16 × 16 소품 계열 없음 | 계열 `prop16` |
| 보스 정체성 1칸 (P2 w34) | 1 × 1 칸 틀 없음 | `boss`, 행 `idle:1` |
| 효과 6종 따로 (P2 §7 w18~w20) | `fx_common`은 32프레임 한 장. P2는 효과마다 따로 생성한다(한 장이면 모양이 닮는다, 1차 S7) | 효과별 시트 6개(OD-74) |
| 소품 w21~w24 (P2 §8) | `prop_anim_a`·`_b`·`prop_misc`는 게임 파일 묶음이라 생성 묶음(손 소품·표시·장면 소품·상태 편집)과 행이 다르다 | OD-74 |
| 아이템 아이콘 24 × 24 (P2 §10) | 24 계열 없음(만들지는 O-02) | 계열 `icon24` |
| 책 UI 3 (P2 §11) | 칸 없는 자유 배치 | 자유 배치 틀(띠) |
| 주인공 초상 마스터 1 · 초상 부품 합성 w40~w42 (P2 §12.1·§12.2) | 1칸, 3 × 2 · 4 × 2 · 3 × 3 합성. `por_parts_*`는 뗀 결과의 배치다 | `portrait64` 1 × 1, 합성 3장 |
| 배경 패널 두 장 · 한 장 (P2 §4.6) | 띠 틀은 이음 띠 하나. 두 장면 + x 768 끊는 선이 없다 | `bg_panel2`·`bg_panel1` |


---

## 1 공통 블록

### A 스타일

```
Asset type: Tap RPG small 2D pixel-art game sprite sheet. This is a real sprite art request, not a UI, diagram, poster or pixel-art-themed illustration.
PIXEL LANGUAGE: every figure must look designed on a genuine logical {48x48} pixel canvas and then shown with large, uniform, perfectly square pixel blocks. Crisp hard square pixel clusters and deliberate one-block stair-steps. Strong readable silhouette with very restrained internal detail. Outer contour exactly one pixel-block thick in dark plum #2B2233 (characters, enemies, weapons and props only; backgrounds follow their own rule in §3.5). Flat color fills in large coherent clusters.
Absolutely no blur, anti-aliasing, smooth vector curves, gradients, soft lighting, glow, painterly strokes, noisy dithering, fur or hair texture, glossy or 3D rendering, photographic detail.
```

- 아이콘·초상·이벤트 장면은 첫 줄만 바꾼 변형을 쓴다(A-UI·A-POR는 P2 §1.1, SC-A는 P3 §3).

### B 주인공 정체성 (캐릭터 시트마다 붙인다)

```
SUBJECT AND IDENTITY: one and the same youthful androgynous human adventurer in every cell, chibi proportions about 2.2 heads tall (the head is close to half of the body height). Facing RIGHT in a slight three-quarter side view, never front-facing. Short chestnut hair (HR01) with two flat browns, medium warm skin, round dark eyes, tiny mouth. Cream quilted short tunic with elbow-length sleeves, thin brown waist cord, two or three small square repair patches, muted teal canvas work trousers, brown boots. Keep every hair lock, facial feature, garment detail, body proportion and limb thickness identical across all cells. Expressive and charming, not a stiff stick figure.
FAR-SIDE LIMBS: the arm and leg farther from the viewer are always one shade darker than the near-side limbs, so left and right steps are distinguishable.
PALETTE ONLY: outline #2B2233; skin #E3B48E #C88E68 #A0664A; hair #7A4E30 #553420; cloth #F0E6CC #C8C2B8; cord and boots #8E5E38; trousers #27978D #00766D.
```

- NPC의 정체성 문장은 §7.3이다.

### C 배치

```
LAYOUT: exactly {N} sprites in exactly {COLS} equal columns and {ROWS} equal rows of identical square cells, evenly spaced, reading order left to right then next row. {EMPTY_CELLS}
One pose per cell. Every sprite is entirely inside its own cell with clear empty margins; nothing crosses into a neighbouring cell. Same drawing scale in every cell. Every figure's lowest point (feet, or hips when seated, or body when lying) sits on the SAME local ground line in its cell, exactly where the NUMBERS block puts it; no ground line is drawn. The body's horizontal center is on the centre column the NUMBERS block gives, in every cell, unless the pose itself moves it.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the sprites, the exact same value in every pixel (preferred over transparency: transparent outputs came back with halos and dark fringes). Never a brown, dark or coloured backdrop, never a vignette, spotlight, halo, glow ring, gradient or drawn checkerboard.
```

- 정사각이 아닌 적 칸·효과·소품·아이콘·초상·배경 띠는 P2 §1.2의 C 변형을 쓴다.
- v1.3까지의 `about 10% above the cell bottom`은 뺐다(v1.4). 지면선·중심 수치는 NUM만 가진다. 틀 필요 시트(§0.4.3)는 NUMBERS block 대신 `about 10% above the cell bottom`을 넣는다.

### T 틀 (v1.4 — 틀 위에서 생성하는 모든 요청, C 앞에)

입력 1이 배치 틀일 때 붙인다(§0.4). `{SHEET}`·`{FILE}`·`{W}`·`{H}`·`{S}`는 NUM에서 옮긴다.

```
TEMPLATE (input image 1 = {FILE}, the layout template of sheet {SHEET}): input image 1 is NOT art to copy; it fixes the canvas, the cells and the size of every drawing.
- Output exactly one image of exactly {W} x {H} pixels, the same canvas as input image 1. Keep every cell exactly where it is in input image 1.
- Draw on a hard art-pixel grid: every art pixel is exactly {S} x {S} image pixels, every block the same size, straight square steps, no half blocks, no anti-aliasing, no blur.
- If input image 1 shows placeholder figures: repaint each placeholder figure in place with the pose asked for below, at the same height, with its lowest pixel exactly on the placeholder's lowest pixel row (the ground line) and on the same horizontal centre. The placeholder gives size and position only: do not copy its colours, clothes, pose or identity.
- If input image 1 is an empty grid: the cyan ticks in the margins mark the cell borders, each column's centre and, on the left and right, the row just below each row's lowest pixel (the ground line). Use them only to place the drawings.
- Nothing outside the cells. Remove every cyan #00FFFF tick: the output has no cyan pixel at all.
- Everything that is not a drawing is one flat #FF00FF, the exact same value in every pixel, including the margins and the empty cells. The image is fully opaque: no transparency, no semi-transparent pixels.
- No text, letters, numbers, labels, grid lines, cell borders or tick marks in the output.
```

### NUM 틀 수치 (v1.4 — T 바로 뒤)

§8의 `NUM(<시트>)` 코드 블록 전문을 그대로 붙인다. 캔버스·S·격자 원점·칸 크기·쓰는 칸과 빈 칸·행마다 최하단 화소 줄과 지면선·열마다 가로 중심·기준 키(논리 화소와 이미지 화소)·여백이 든다. 본문은 NUM과 다른 수치를 쓰지 않는다.

### GF 문 지적 (v1.4 — 문에서 떨어진 뒤 다시 생성할 때, 글 맨 끝에)

```
PREVIOUS ATTEMPT FAILED THE SIZE CHECK. Keep everything that was right and fix exactly these problems:
{art:gate 출력의 "Regeneration feedback:" 아래 문단 전문}
```

### D 금지 — 캐릭터·적·무기·소품·초상 시트

```
Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.
```

**D 변형** — 요청이 D의 금지 낱말(`landscape or scenery`, `magic effects`, `speech bubbles`)을 그리게 할 때 D 대신 쓴다.

| 블록 | 쓰는 곳 | 정의한 곳 |
| --- | --- | --- |
| D-BG | 배경 합성·배경 편집(§3.5, P2 §4·§5) | 아래 |
| D-FX | 효과·날씨 | P2 §1.3 |
| D-UI | UI·아이템 아이콘·책 UI | P2 §1.3 |
| D-MARK | 떠 있는 표시(느낌표 말풍선·잠 표시) | P2 §1.3 |
| SC-D | 이벤트 장면 | P3 §3 |

**D-BG 배경 금지** (P2에서 옮김, v1.2)

```
Do NOT draw: text, letters, numbers, signs with writing, arrows, grid lines, borders, frames, watermark, characters, people, animals, enemies, blood, sun disc, light sources, lit windows, flames, glow, light rays, gradients, vignette, fog. Output only the finished strip.
```

### E 32 규격 (폐기 — O02 = 48, D64)

**쓰지 않는다.** O02는 48로 정했고 32 규격은 만들지 않는다. 아래는 기록이다.
32 규격은 새로 생성하지 않고 **합격한 48 규격 시트를 편집 입력으로 넣어** 만든다. 같은 인물·같은 포즈·같은 칸 배치를 지키고 화소 밀도만 낮춘다. v03의 32 동작·들쥐 시트는 48과 세부 밀도가 거의 같아 비교가 되지 않았다.
블록 E는 합격 기준 E1~E21(§4)과 다른 것이다.

```
Use case: precise edit of the provided 48-pixel sprite sheet. Redraw the SAME sheet at a much coarser pixel density, as if designed on a 32x32 logical canvas per cell: every pixel block is one and a half times larger than in the input, the standing figure is about 26 blocks tall and the head about 12 blocks wide. Simplify: no interior outline lines, eyes one block wide and two blocks tall, no eyebrows, hair as two or three flat masses, clothing folds removed. Keep the same character, the same pose in every cell, the same cell layout, the same flat #FF00FF background.
```

- 들쥐는 `the standing figure is about 26 blocks tall and the head about 12 blocks wide`를 `the rat body is about 10 blocks tall`로 바꾼다.
- 레이어는 떼어 낸 48 레이어에 E를 적용하지 않고, **32 합성**을 만든 뒤 같은 떼기 문장으로 다시 뗀다(P1 §13).

### S 교체 편집 머리말 (P1에서 옮김, v1.2)

합격한 합성 시트를 입력으로 넣고 **부품 하나만 바꾸는** 편집(머리 모양·옷 계열·투구·무기·망토·방패). 조립: S + 교체 문장 + D. A·B·C는 붙이지 않는다.

```
Use case: precise edit of the provided sprite sheet. Keep the exact canvas, the exact cell layout, the flat #FF00FF background and the exact position, size and pose of every figure. Change ONLY the part named below, in the cells named below. Every other pixel (face, hair, skin, arms, hands, clothing, trousers, boots, held items) stays exactly as in the input, with its exact colour, except where the new part now covers it; never recolour, relight, brighten, darken or saturate anything that is kept. The new part follows each cell's existing pose: the same head angle, body lean and hand positions. Never move an arm, a hand or the head to fit the part. Empty cells stay empty. Same pixel-block size and outline style as the input. No gradient, no halo, no glow, no extra objects.
```

- 교체 편집 결과를 입력과 겹쳐 봤을 때 **차이가 바꾼 부품 자리에만** 있어야 한다(E13). 세계 에셋용 일반판은 P2 §1.4 SW다.

**S-W 무기 교체 공통 문장** (P1 §7.2에서 옮김) — 무기 교체 문장 앞에 붙인다.

```
SWAP (weapon): in every cell where the character holds the short sword, replace the sword with the weapon described below; all other cells stay exactly unchanged. The grip sits in the same front hand at the same place in every cell; the rear hand and both arms do not move. Identical length and shape in every cell; never shorten the weapon to fit. The blade or head may reach past the edge of its own cell into the empty margin, but it never touches the neighbouring figure or its weapon. Weapon:
```

- 마지막 두 문장은 OD-03 결정(무기 레이어만 셀 밖 허용, 15 §12.2, D65)을 옮긴 것이다. 정규화가 무기를 hand_f 기준으로 넓힌 무기 셀 80 × 64에 담는다. 칼끝이 옆 칸 인물·무기에 닿으면 불합격이고 다시 생성한다(v1.2의 `the whole weapon stays inside its cell`은 뺐다).

---

## 2 검토 결과와 반영

### 2.1 v02

육안 검토: 2026-09-23, 대상 `assets/_imagegen/v02/`의 세 장.

| 시트 | 좋은 점 (유지) | 문제 | 반영 |
| --- | --- | --- | --- |
| `01-walk12` | 12칸 모두 같은 인물. 머리·옷·비율이 흔들리지 않는다. v01보다 픽셀 덩어리가 깔끔하다 | ① 갈색 배경과 인물 주변 후광이 그림에 들어갔다(반투명 화소 약 65만 개). ② 2행이 1행과 거의 같아 보인다(왼발·오른발이 구분되지 않음). ③ 배경 제거 편집본(`cutout-attempt`)이 원본과 바이트까지 같다 — 편집이 적용되지 않았다 | ① C의 BACKGROUND 문장. 배경은 처음 생성할 때부터 깨끗해야 하고, 나중에 편집으로 지우는 방식에 기대지 않는다. ② B의 FAR-SIDE LIMBS 문장. ③ 0.2절 3번 |
| `03-actions18` | 대기·공격·앉아 읽기·잠의 실루엣 차이가 작은 크기에서도 읽힌다. 칼 길이가 6칸 내내 같다 | ① 갈색 배경·후광, 오른쪽 절반은 검은 배경. ② 잠 포즈가 엎드려 기는 모습처럼 보인다. ③ 칼·책이 몸에 붙어 있어 레이어로 쓸 수 없다(합성 시안으로는 정상) | ① C. ② §3.1-B 잠 행 문장 교체. ③ 0.2절 순서대로 편집으로 뗀다 |
| `02-rat18` | 18칸 모두 같은 쥐. 볼주머니·둥근 귀·긴 꼬리가 분명하다. 도망 행의 도토리 연출이 좋다. 마지막 칸이 작아지는 것은 카드(AO-31, 2/3 크기)대로다 | 윤곽 바깥에 붉은 반투명 테두리가 남았다 | C의 BACKGROUND 문장, A의 hard edge 문장 |

### 2.2 v03

육안 검토 + 게임 쪽 겹침 측정(2026-09-23). 겹침 측정은 부품 레이어의 화소가 기준 시트의 인물 윤곽 안에 드는 비율과 최적 이동량이다(이미지 화소 기준, 논리 화소 1개 ≈ 5~7 이미지 화소). 옷 레이어는 기준 시트에서 **피부색이던 자리**에 옷 화소가 있는 비율도 쟀다.

| 대상 | 판정 | 근거 | 반영 |
| --- | --- | --- | --- |
| 동작 48 `02-…-48-r4` | **합격 — 기준 인물로 지정** | 18칸 배치·빈 칸 정확, 단색 자홍 배경, 공격 6단계와 칼 길이 일정, 옆으로 누운 잠 | §0.2의 0번 |
| 걷기 48 `01-…-48-r3` | 불합격 | ① 동작 시트와 다른 인물(머리 부피·눈 크기·얼굴 비율). ② 등 뒤에 요청하지 않은 회색 끈·주머니. ③ 가장자리 반투명 화소 | §3.1 REF-A에 기준 인물 입력·끈 금지. 걷기 부품(12~15)은 새 REF-A에서 다시 뗀다 |
| 몸체 동작 `16-…-r3` | 합격 | 윤곽 안 98.3~99.6%, 이동 ≤ 2px(1블록 미만) | — |
| 머리 동작 `18-…-r3` | 합격(위치) → §2.3에서 색 불합격 | 97.9~99.1%, 이동 ≤ 2px | §2.3 |
| 검 `20-…-r2` | 합격(6프레임) → §2.3에서 셀 넘침 | 94.5~96.8%, 이동 ≤ 2px. 카드 AO-16의 나머지 4프레임(앞으로 든 3 + 칼집 1)이 없다 | §3.3 AO-16 나머지 |
| 천옷 동작 `19-…-r2` | 불합격 | ① 배경이 보라·갈색 그라데이션 + 후광. ② 옷 화소의 8.3%가 기준 시트의 피부 자리(식사 행 12.4%) — 소매를 팔까지 늘렸다 | §3.2 머리말(보이는 화소만·배경 단색) |
| 천옷 걷기 `14` | 불합격 | 옷 화소의 12.4%가 피부 자리. 걷기 시트 자체도 불합격 | 새 REF-A에서 다시 뗀다 |
| 가죽 동작 `21` | 불합격 | 옷 화소의 12.7%가 피부 자리(식사 행 22.1%) | §3.2 머리말 |
| 얼굴 `17-…-r2` | 불합격 | 그라데이션 배경·후광, 눈 모양이 바뀌었다. 또 카드(AO-13)가 요구하는 것은 동작별 얼굴이 아니라 **표정 5종** 시트다 | §3.2 L2 수정, L7 추가 |
| 32 걷기 `01-…-32-r2` | 보류 | 48보다 굵지만 불합격 걷기 인물을 따랐다 | §1 E(48 합격본을 편집) |
| 32 동작·들쥐 | 불합격 | 48과 세부 밀도가 거의 같아 O02 비교가 안 된다 | §1 E |
| 들쥐 48 `08-…-48-r3` | **합격** | 18칸·빈 칸·도토리·마지막 축소가 카드대로, 단색 배경, 붉은 테두리 없어짐 | — |
| 단검 48 `05-…-48-r2` | 합격(육안) → §2.3에서 불합격 | 10칸, 길이·모양 일정, 녹색 손잡이·놋쇠 가드, 칼집 칸 | §2.3 |
| 책 `06` | 불합격(크기) | 책이 칸 폭의 3분의 1을 넘는다. 손에 들면 몸통을 가린다 | §3.3 책 크기를 인물 기준으로 |
| 그림자 `07` | 불합격 | 회색 불투명 막대. 생성 모델은 35% 반투명을 만들지 못한다 | §3.3 불투명 `#2B2233`으로 받고 투명도는 게임이 준다 |
| 배경 3층 `09~11` | 불합격(구조) | ① 세 장의 띠 높이·위치가 달라 겹치면 맞지 않는다(먼 층 띠 y 320~704, 가까운 층 지면 y 595). ② 중간 층에 검은 외곽선 — 배경 명도 규칙(L\* 30 미만 금지) 위반. 원인은 이 문서 1.0의 공통 블록 A가 배경에도 외곽선을 요구한 것 | §1 A 외곽선을 캐릭터·소품 전용으로. §3.5를 합성 후 분리로 교체 |

### 2.3 정규화·미리보기 도구 결과 (2026-09-24)

게임 쪽 도구(`tools/art-check` normalize·preview, 커밋 378f191)로 v03 합격본을 게임 규격으로 옮기고 겹쳐 본 결과다. 미리보기: `assets/game/_preview/`(저장소 밖). 육안 합격이 정규화·합성에서 뒤집힌 경우다.

| 대상 | 판정 | 근거 | 반영 |
| --- | --- | --- | --- |
| 머리카락 `18-…-r3` | 불합격(색) | 몸체 + 머리카락 + 검 합성에서 머리가 기준 시트보다 밝고 주황빛이다. 떼기 편집이 색을 바꿨다. 겹침 측정은 위치만 봐서 통과했다 | §3.2 머리말에 색 유지 문장, 같은 문장을 S(§1)·P2 SW·P3 SC-E에. 합격 기준 E21 |
| 단검 `05-…-48-r2` | 불합격(밀도) | 단독 생성이라 세부 밀도가 사양의 약 3배다. 사양 길이(48 규격 10)로 맞추면 읽을 수 없는 덩어리가 된다. 한손검은 손에 든 합성에서 떼어 기준 인물과 밀도가 같았기 때문에 통과했다 | §3.3 AO-17을 REF-B 교체 → 떼기로 교체. 모든 무기는 손에 든 합성에서 뗀다(§0.2 2번) |
| 검 `20-…-r2` | 합격(셀 넘침 허용) | 공격 2·3·4칸의 칼끝이 48 셀 밖으로 나간다(25~29px 잘림). P1의 V3·V4(22)는 더 길다 | OD-03 결정(2026-09-24): 무기 레이어만 셀 밖 허용, 무기 셀 80 × 64에 hand_f 기준으로 담는다(15 §12.2, D65). 도구 T5로 다시 정규화 |
| 전체 | 도구 과제 | 팔레트 스냅 뒤 반점 잡음, 칸별 색 수가 카드 상한을 넘는다 | 프롬프트 문제가 아니라 정규화 과제다. `OPEN_DECISIONS.md` 도구 작업 T1 |

### 2.4 v04 (2026-09-24)

육안 검토(`assets/_imagegen/v04/README.md`·`REVIEW.md`) + 사용자 검토 + 문 `--no-canvas` 측정(`tools/art-check/README.md` 「옛 납품 검사 결과」) + 파생 시험(같은 README 「파생 레이어」).

| 대상 | 판정 | 근거 | 반영 |
| --- | --- | --- | --- |
| 23장 공통 | **규격 불합격** | 캔버스가 장마다 다르다(2172 × 724, 1774 × 887, 1448 × 1086, 916 × 1717 …). 투명 배경으로 받아 그림 속 반투명 화소가 장마다 38만~64만 개(`alpha` 실패 전부). 칸 여백·키도 어긋난다(늑대 키 21.6블록, 박쥐 15~20) | §0.4 규격 고정 절차, §1 T(불투명 `#FF00FF`, 캔버스 지정), NUM |
| 걷기 12 `00-ref-a-walk12-48` | 불합격(동작) | 인물은 마스터와 같다(E9 통과, 지면선·중심·키도 통과). 그러나 2행이 1행과 거의 같다(좌우 교대가 없다). 팔을 가슴 앞에 주먹 쥐고 들어 권투하는 모습이다 | §3.1 REF-A: 팔은 손을 편 채 허리 옆에서 앞뒤로 흔든다, 2행 = 1행의 좌우 바꿈. 틀 위에서 다시 생성 |
| 표정 5 `00-expression-round5-48` | 불합격(1칸) | 「눈감음」 칸이 웃는 `^^` 눈이다. 출력 비율도 요청과 다르다 | §3.2 L7: 눈감음 = 가로 한 줄의 평평한 눈, 틀 `chr_face` 12칸 합성 |
| REF-D `c01` · REF-E `c02-r2` | **합격**(기준 D·E) | 칸 배치·인물 유지 | 바지 색 교체(P1 §3.1) → 몸체 L1 다시 떼기, 가림막(P1 §3.4) |
| 몸체 D·E `c03-body-ref-d/e` | 모양 합격 · 색 불합격 | 크림 속옷·회색 바지(D73 이전) | 새 L1로 다시 뗀다 |
| 천옷 D·E `c03-cloth` · 피격 검 `c13` | 불합격 → **요청 중지** | 생성기의 옷·무기 떼기가 두 번 연달아 실패(피부 위 소매 5~16%, 1~3px 밀림, 칼을 다시 그림) | 옷·무기 레이어는 도구가 기준 시트에서 골라 낸다(`derive`, D66). §3.2 L4·L5·L6 요청 중지 |
| 머리카락만·얼굴만 편집 | **없음** | 파생 시험에서 v04 D·E는 머리카락·얼굴 가림막이 없어 분류 못 한 화소가 32.9%·30.9%, 7칸·6칸 실패(몸체가 머리카락·눈을 흡수) | P1 §3.4 가림막: v04 D·E 머리카락만(L3)·얼굴만(L8), v03 REF-B 얼굴만(L8) |
| 머리 자세 `c04` · HR01 `c05` | 보류 | 숙임 손·피부색·얼굴 비율, 머리카락 색·겹침 검증 전 | 틀 `chr_head_poses_ref`로 다시 만들지는 검증 뒤 |
| 늑대 `w01` | 불합격(외형) | 여우·코기로 읽힌다(짧은 주둥이, 큰 귀) | P2 §2.1: 주둥이를 길게, 귀를 작게. 몬스터 표준 |
| 박쥐 `w02-r2` | 불합격 | 땅에 서 있다(부양 없음) | P2 §2.2: 몸 최하단 = NUM 부양 줄, 그 아래는 비움 |
| 코볼트 `w03-r4` | 불합격 | 화풍이 다르다(평면 채색, 두꺼운 외곽선). 대기·이동 프레임이 움직이지 않는다. r3는 배경 얼룩 | P2 §2.3: 몬스터 표준으로 처음부터 |
| NPC 기준 `n01` 첫 판 | **합격**(`nref`) | r2는 요청하지 않은 세부까지 바뀌었다 | `nref` = `v04/n01-npc-ref-48.png` |
| 배경 `bg-four-regions-quality-r2` | **합격**(품질 기준, D71) | — | P2 §4 품질 입력 |

---

## 3 P0 에셋별 프롬프트

P0 범위는 `ASSET_ORDERS.md` §1.2다. **48 규격만 만든다**(O02 = 48, D64). §1 E(32 편집)는 쓰지 않는다.

### 3.1 기준 합성 시트 (가장 먼저)

#### REF-A · 걷기 12 (AO-03 연구본, v05 재생성)

조립: A + B + T + NUM(chr_walk12) + C(`N=12, COLS=6, ROWS=2, EMPTY_CELLS=없음`) + 입력 역할 + 본문 + D. 입력 1 = `docs/art/templates/chr_elder.grid.png`(임시 틀, §0.4.2), 입력 2 = 기준 인물(§0.2의 0번). 문: `pnpm art:gate <png> --spec chr_elder --rows walk:6,walk:6`.

```
Input image 2 role: this is the exact character to draw. Copy its head shape, hair silhouette, eye size, face proportions, clothing and pixel density exactly; its trousers are drawn teal #27978D #00766D as stated above, not grey. Do not copy its poses or its layout. No strap, no pouch, no bag, nothing on the back.
```

```
ANIMATION, one 660 ms walk cycle, twelve DISTINCT poses at 55 ms each, the whole body walking in place, a relaxed easy stroll.
ARMS: both hands are OPEN and relaxed, hanging at hip height; the arms swing gently forward and back from the shoulder, opposite to the legs, the forward hand reaching at most the front of the belly. Never raise a hand to the chest, never make a fist, never hold the arms bent in front of the body: this is not a boxing or running pose.
1 right foot forward contact, left foot behind, LEFT arm forward.
2 weight settles onto the right knee, upper body one block lower; the planted right foot does not move.
3 left foot lifts and swings under the body, both arms passing beside the hips.
4 narrow passing pose, feet close beneath the hips, upper body one block higher.
5 left leg extends forward, right arm comes forward.
6 left heel just above the ground before contact, trailing leg pushes off.
7 LEFT foot forward contact, right foot behind, RIGHT arm forward: pose 1 with left and right swapped; the darker far-side leg is now in front and the darker far-side arm is now behind.
8 weight settles onto the left knee, upper body one block lower.
9 right foot lifts and swings under the body.
10 narrow passing pose, upper body one block higher.
11 right leg extends forward, left arm comes forward.
12 right heel just before contact, approaching pose 1 but NOT a copy of it.
Poses 1 and 7 have the widest stance, 4 and 10 the narrowest. ROW 2 IS ROW 1 WITH LEFT AND RIGHT SWAPPED: in every row-2 cell the leg that is in front in the row-1 cell above it is behind, and the arm that is forward is back. Seen side by side, cell (1,1) and cell (1,2) must clearly differ by which leg and which arm lead. No weapon, helmet, cape, bag or props.
```

- 게임에 쓰는 걷기 6프레임은 따로 생성하지 않는다. 이 12칸 중 1·2·4·7·8·10번을 게임 쪽이 고른다(AO-03 표).
- v04 `00-ref-a-walk12-48`은 인물이 맞았지만 2행이 1행과 같고 팔이 권투 자세였다(§2.4). ARMS 줄과 ROW 2 문장이 그 두 가지를 막는다. 합격: 문 통과(E22) + E1~E7, E9 + 1행과 2행을 나란히 놓아 이끄는 다리가 칸마다 다르다.
- 바지는 B의 청록이다(D73). 이 시트는 바지 색 교체 편집(P1 §3.1)이 필요 없다.

#### REF-B · 대기·공격·앉기와 식사·잠 (AO-02·04·07·08) — v03 r4 합격, 기준 인물

다시 만들지 않는다. v05에서 하는 일은 바지 색 교체(P1 §3.1) → 몸체 L1 다시 떼기, 얼굴 가림막 L8(P1 §3.4)이다. 아래는 v03 기록이다(다시 만들게 되면 틀 필요 — §0.4.3).

조립: A + B + C(`N=18, COLS=6, ROWS=4, EMPTY_CELLS=Row 1, row 3 and row 4 hold four sprites each; their last two cells stay completely empty.`) + 본문 + D

v02 `03-actions18.png`를 **정체성 참고 이미지**로 함께 넣는다(포즈·배경은 따르지 않게 한다).

```
Input image role: identity and pixel-style reference only. Do not copy its layout or its brown backdrop.
ROW 1 IDLE, 4 frames, 220 ms each: 1 relaxed stand, hands down; 2 breathe in, only chest and shoulders one block higher, head and feet fixed; 3 exactly the same pose as 1; 4 same body, head turned slightly to look ahead. No held objects.
ROW 2 ATTACK, 6 frames, 100/80/60/60/120/160 ms, one short sword slash, the grip always inside the front hand: 1 sword at the front hip angled down-right, knees bent; 2 sword straight overhead, torso leans back one block; 3 sword ahead above the forehead pointing up-right; 4 impact, sword forward horizontal to the right, arm extended, torso leans forward, rear leg braced; 5 follow-through, sword points down-right; 6 back to hip guard. The same short straight sword in every cell: about one third of the body height, small cross guard, brown grip, silver blade #E8E6E0 #B4B2B0. Focused eyebrows.
ROW 3 SIT AND EAT, 4 frames, 300 ms: compact seated crouch, hips on the ground line, seated height about two thirds of standing height, front hand at chest height holding a small round bread roll #C08A58 #8E5E38; 1 hold; 2 bread to mouth; 3 chew with cheek one block rounder; 4 hand lowers.
ROW 4 SLEEP, 4 frames, 450 ms: lying ON ITS SIDE, back gently curved, knees drawn up, head to the right resting on the lower arm, eyes closed, calm face; it must read as peaceful sleep, not crawling or lying face-down. Body length about two thirds of the cell width. 1 asleep; 2 only the chest rises one block; 3 same as 1; 4 same as 1. No bedroll, blanket, pillow or zZ.
```

#### REF-C · 가죽 옷 합성 (AO-21 부품을 뗄 기준)

합격한 REF-A·REF-B를 각각 **편집 입력**으로 넣고 옷만 바꾼다(v03 동작 시트는 이 방식으로 인물이 유지됐다). 조립: S + 본문 + D.

```
Clothing replacement: instead of the cream tunic, a sleeveless tan leather vest #C08A58 #8E5E38 with two vertical shoulder straps and a 2-block belt, the plain grey-blue linen undershirt #7EA6B8 #546E7A visible at the shoulders. Everything else (face, hair, trousers, boots, poses) identical to the reference sheet.
```

- 합격한 동작판은 v03 `04-ref-c-leather-actions18-48-r2`다. 어깨 속옷이 옛 크림이고 바지가 옛 회색이라 P1 §3.1의 색 교체 편집(REF-C판: 바지 + 어깨 속옷)을 한 번 한다.

### 3.2 레이어 부품 — 기준 합성 시트를 편집해 떼어 낸다

부품 프롬프트는 **편집**이다(L7 표정 합성만 틀 위 생성). 입력 이미지 = 합격한 REF 시트(v1.4: 바지 색 교체한 판, P1 §3.1). 옷·무기(L4~L6)는 요청하지 않는다. 공통 머리말(이하 **X**, 네 문서가 같은 이름으로 부른다):

```
Use case: precise edit of the provided sprite sheet. Keep the exact canvas, the exact cell layout, and the exact position, size and pose of everything that remains. Do not redraw, move or restyle anything that is kept. Keep every kept pixel's exact colour: never recolour, relight, brighten, darken or saturate anything. Keep ONLY the pixels of the kept part that are VISIBLE in the input: never draw hidden portions, never extend sleeves or garments over skin that was visible, never smooth or complete a shape. Everything removed becomes the same single flat #FF00FF magenta as the input background, one exact value everywhere: no gradient, no shading, no vignette, no glow, no halo, no dark fringe. No new content.
```

| 번호 | 카드 | 입력 | 머리말 뒤에 붙일 문장 |
| --- | --- | --- | --- |
| L1 | AO-02·03·04·07·08 몸체 | REF-A, REF-B | `Remove the hair, the face (eyes, eyebrows, mouth), the tunic, the belt, the sword and the bread. Where clothing is removed, show the bare base body: skin #E3B48E #C88E68 #A0664A with a plain grey-blue linen sleeveless undershirt #7EA6B8 #546E7A (never cream, never the tunic colours), teal canvas trousers #27978D #00766D (never grey) and the same brown boots. The head stays as a smooth bald skin-coloured head of the same size and outline.` |
| L2 | AO-13 얼굴 | L7 결과(+ 볼 홍조 표지, P1 §3.3) | `Keep ONLY the eyes, eyebrows and mouth of each figure in rows 1 and 2, and the single #B04A42 cheek block, pixel for pixel as they are. In row 3 keep ONLY the #A0664A wrinkle lines. Do not redraw or enlarge them. Remove everything else, including skin, hair and outline.` 문: `--spec chr_face` |
| L3 | AO-14 머리카락 HR01 | REF-A, REF-B | `Keep ONLY the hair. Remove face, skin, body, clothing, weapon and all other parts.` |
| L4 | AO-20 천옷 | REF-A, REF-B | **요청 중지(v1.4)** — 도구 `derive`가 뗀다. 기록: `Keep ONLY the cream quilted tunic and its brown waist cord with the repair patches. Remove the body, skin, head, hair, trousers, boots, sword and bread.` |
| L5 | AO-21 가죽옷 | REF-C | **요청 중지(v1.4)** — `derive`. 기록: `Keep ONLY the leather vest, its straps and belt, and the grey-blue undershirt visible at the shoulders. Remove everything else.` |
| L6 | AO-16·17 무기 | REF-B 2행(V1), §3.3 교체 결과(V2) | **요청 중지(v1.4)** — `derive`(v03 V1 공격 6은 합격본을 그대로 쓴다). 기록: `Keep ONLY the {sword / dagger} in each cell (blade, guard, grip). Remove the character entirely, including the hand holding it.` |
| L7 | AO-13 표정 합성 12(둥근 눈 5 · 가는 눈 5 · 주름 2) | 생성(틀 `chr_face`) | 아래 L7 절. 결과에 P1 §3.3 홍조 편집 → L2로 얼굴만 뗀다 |
| L8 | 얼굴 가림막(파생의 빼는 레이어) | v04 REF-D·REF-E, v03 REF-B | `Keep ONLY the eyes, eyebrows and mouth of each figure, pixel for pixel, with their exact colours. Remove everything else, including skin, hair, outline, body, clothing and held items. A cell whose face is not visible stays completely empty.` |

- **옷·무기 떼기를 요청하지 않는다(v1.4, §2.4).** 생성기의 옷·무기 떼기가 두 번 연달아 실패해, 옷·무기 레이어는 도구가 기준 시트의 생성 화소에서 골라 낸다(`derive`, D66 — 화소를 고르고 옮길 뿐 새로 그리지 않는다). 도구에 필요한 것은 기준 시트와 **빼는 레이어**(몸체 L1, 머리카락 L3, 얼굴 L8/L2)다. 빼는 레이어는 모양만 쓰고 색은 기준 시트에서 가져온다(`tools/art-check/README.md` 「색 출처 reference」).
- 걷기 부품(v03 `12`~`15`)은 불합격 걷기 시트에서 뗐으므로, 새 REF-A가 합격하면 몸체(L1)·머리카락(L3)·얼굴(L8)만 다시 뗀다.
- 잠·앉기 행에서 머리카락·얼굴을 뗄 때도 같은 문장을 쓴다. 칸이 비어 버리면(부품이 없는 포즈) 그 칸은 빈 채로 둔다.
- 편집 결과를 입력과 겹쳐 봤을 때 남긴 부품의 위치가 1블록이라도 움직였으면 불합격이다(E8). **색이 달라졌어도 불합격이다**(E21, §2.3 머리카락).
- L5의 어깨 속옷(기록): 15 §6.4 A02 「밝은 가죽 + 회청 속옷 소매」가 가죽 팔레트에 속옷을 넣고, 몸체 속옷은 민소매(L1)이므로 어깨의 속옷 화소는 가죽 레이어가 가진다(OD-48). v1.4부터는 파생 도구가 가죽 부류로 가져간다.
- L1의 속옷은 회청 `#7EA6B8` `#546E7A`(속옷 묶음, D73)이다. 크림이던 속옷이 천옷 `#F0E6CC` `#C8C2B8`와 같은 색이어서 파생 도구가 천옷과 속옷을 가르지 못했다(천옷을 벗기면 구멍 난 천옷이 남았다). 이미 합격한 몸체 레이어(v03 `16-body-actions18-48-r3`, v04 `c03-body-ref-d-48`·`c03-body-ref-e-48`)는 모양만 쓰고, 다음 아트 차례(`V05_REQUEST.md`)에 이 L1로 다시 뗀다.
- L1의 바지는 청록 캔버스 `#27978D` `#00766D`(바지 묶음, D73)다. 회색이던 바지 `#C8C2B8` `#9A948C`는 천옷 그늘·잿빛 머리와 같은 색이라 천옷 밑단·머리카락과 갈리지 않았다. 바지는 기준 시트에서도 **보이는** 자리라 파생 도구가 기준 시트의 색을 쓴다 — 그래서 몸체만이 아니라 기준 시트(REF-B~E)의 바지도 색 교체 편집(`prompts/P1_character.md` §3.1)으로 청록으로 바꾼 뒤 L1을 다시 적용하고 파생을 다시 돌린다. 새 REF-A는 처음부터 청록이다.

#### L7 · 표정 합성 12 (틀 `chr_face`, v1.4)

v1.3의 「5칸 한 줄 편집」은 v04에서 눈감음 칸을 웃는 `^^`로 그렸고 출력 비율도 바뀌었다(§2.4). 틀 `chr_face`(얼굴 레이어의 게임 배치: 둥근 눈 5 · 가는 눈 5 · 주름 2)의 자리표시가 온몸 인물이므로, **합성 인물을 그 자리에 바로 그린다.** P1 §3.2(가는 눈 편집)와 P1 §11.2(주름 2칸)가 이 한 장의 2행·3행이 되었다.

조립: A + B + T + NUM(chr_face) + C(`N=12, COLS=5, ROWS=3, EMPTY_CELLS=Row 3 holds two sprites; its last three cells stay completely empty.`) + 입력 역할 + 본문 + D. 입력 1 = `docs/art/templates/chr_face.placeholder.png`, 입력 2 = 기준 인물. 문: `pnpm art:gate <png> --spec chr_face`.

```
Input image 2 role: this is the exact character; copy its head, hair, face proportions, eye size, clothing and pixel density exactly (trousers teal as stated above). Do not copy its layout.
TWELVE CELLS of the same frame: the relaxed idle stance of input image 2 (row 1, frame 1), facing right, identical in every cell. ONLY the eyes, eyebrows and mouth change (in row 3 also two small wrinkle marks). Hair, head outline, skin, body, clothing and pose are pixel-identical in all twelve cells.
ROW 1, the round eyes of input image 2, five expressions: 1 neutral. 2 smile: the mouth curves up, the eyes stay round. 3 grimace: a focused frown, eyebrows angled down toward the nose, mouth a short flat line. 4 EYES CLOSED, NEUTRAL: each eye is one straight flat horizontal line, one block tall and as wide as the open eye; eyebrows and mouth exactly as in cell 1, a calm sleeping face. Never curved happy arcs, never a smile. 5 surprise: eyes one block taller, eyebrows raised, a small round open mouth.
ROW 2, NARROW eyes, the same five expressions in the same order: each open eye is a short horizontal slit two blocks wide and one block tall, in the same place and spacing as the round eyes. Smile: the slits curve slightly upward. Surprise: the slits open to two blocks tall. Closed: the same straight flat line as row 1 cell 4.
ROW 3, round eyes, neutral face, age marks in #A0664A: 1 MATURE: one short wrinkle line one block long at the outer corner of the near eye. 2 ELDER: two wrinkle lines at the outer eye corner and one short line under the eye. Cells 3, 4 and 5 of row 3 stay empty.
```

- 합격: 문 통과(E22) + E1, E2, E4, E9, E11. 12칸의 머리·몸이 같다(겹쳐 보면 차이가 눈·눈썹·입·주름에만 있다). 1행 4칸·2행 4칸은 평평한 한 줄이다. 둥근 눈과 가는 눈을 나란히 놓아 실크기에서 다른 얼굴형으로 읽힌다(P1 §3.2).
- 2행 또는 3행이 1행과 다른 인물로 나오면(머리·몸 차이) 1행만 합격으로 두고 옛 방식(P1 §3.2 가는 눈 편집, P1 §11.2 주름 편집)으로 그 행을 만든다. 그때는 입력 = 합격한 이 장, 결과도 같은 `--spec chr_face`로 문을 통과해야 한다.

### 3.3 새로 만드는 부품

#### AO-17 · 무기 V2 단검 — 손에 든 합성에서 떼기 (v1.2 교체)

v03 단독 생성본(`05-dagger10-48-r2`)은 정규화에서 불합격이다(§2.3: 밀도가 사양의 약 3배). **단독 생성하지 않는다.** 기준 인물의 공격 행에서 칼만 단검으로 바꾸고 떼어 낸다. 한손검이 통과한 방식과 같다.

① 교체 — 입력 = 기준 인물(REF-B, v03 r4). 조립: S + S-W + 본문 + D. 칼이 있는 2행(공격 6)만 바뀐다.

```
a DAGGER clearly shorter than the input sword, about 0.6 times its length: a straight silver blade #E8E6E0 #B4B2B0, a small brass guard #B07A3A and a grip wrapped with green cloth #6D8F5A. The blade points in the same direction as the input sword in each cell; only the length, guard and grip change.
```

② 떼기 — v1.4부터 요청하지 않는다. 도구 `derive`가 합격한 ①에서 단검 부류를 골라 낸다(§3.2 L6).

- 피격 3칸은 P1 c14(REF-D에 같은 교체), 착용 1칸은 P1 c17(REF-Q)에서 만든다. 15 §6.3·§12.2의 무기 시트 = 공격 6 + 피격 3 + 착용 1이다.
- 합격: E1 E4 E8 E10 E11 E13 E21 + P1 E14. 단검 길이가 한손검의 약 0.6(15 §6.3: 10 / 16)이고, 정규화 뒤 16px 실크기에서 단검으로 읽힌다.

#### AO-49 · 책 소품 2프레임 (P0 분)

조립: A + C(`N=2, COLS=2, ROWS=1, EMPTY_CELLS=없음`) + 본문 + D

```
Prop-only sprites, no hand and no body. A SMALL open book as held by a chibi character at chest height. Its width is about one fifth of the character's standing height (about 8 blocks of a 48-block cell) so it fits in two small hands without hiding the torso. Most of each cell stays empty: brown cover #8E5E38, cream pages #F0E6CC, outline #2B2233, three colors only. Cell 1: book open flat. Cell 2: the same book with one page lifted mid-turn. No letters, lines of text or symbols on the pages.
```

- 책도 손 소품이라 §2.3 단검과 같은 밀도 문제가 날 수 있다. 정규화 뒤 8블록 폭에서 뭉개지면 REF-B 3행(앉기)에서 빵을 책으로 바꾸는 교체 → 떼기로 바꾼다.
- **틀 필요**(§0.4.3): 책의 게임 칸은 `prop_anim_b` 4행이지만 그 틀은 소품 8칸과 한 장이다. 틀이 생길 때까지 위 어림 문장(`about 8 blocks`)을 쓰고 문 검사 없이 본다.

#### AO-01 · 발밑 그림자

생성 모델은 35% 반투명을 만들지 못한다(v03은 회색 불투명). **불투명한 한 색 타원으로 받고, 투명도 35%는 게임이 그릴 때 준다.**
조립: A + 본문 + C의 BACKGROUND 문장

```
One single flat horizontal ellipse, about 40% of the cell width and one twelfth of the cell height, centred horizontally near the bottom of a square cell. One fully opaque color only: dark plum #2B2233. Hard stepped pixel edges, no gradient, no blur, no grey, nothing else in the image.
```

- **틀 필요**(§0.4.3). 그림자 규격(15 §3.1 레이어 0)을 담은 틀이 없다.

#### AO-16 · 무기 V1 한손검 나머지 4프레임 (v1.2 교체)

공격 6칸은 v03 합격본(`20-sword-actions18-48-r2`, REF-B에서 뗌)이다. 나머지 4칸은 단독 편집으로 만들지 않고 **합성에서 뗀다**(§2.3 단검과 같은 이유).

- 피격 3 = P1 c13(REF-D 피격 행, v1.4부터 `derive`가 뗀다. v04 생성기 떼기 `c13`은 칼을 다시 그려 불합격). 카드의 「앞으로 든 3」은 15 §6.3의 「피격 3」이다.
- 착용 1 = P1 c17(REF-Q, 허리 뒤 칼집). 15 §3.1은 「허리나 등에 찬 모습 1프레임」이다.
- 공격 2·3·4칸의 칼끝이 48 셀을 넘는다(§2.3). 무기 레이어만 셀 밖으로 나갈 수 있으므로(OD-03 결정, D65) 정규화가 잘라 내지 않고 무기 셀 80 × 64에 담는다.

### 3.4 적

#### AO-31 · 여울 들쥐 EN01 — 합격(v03 r3), **몬스터 황금 표본**

v03 `08-rat18-48-r3`은 합격했고 다시 만들지 않는다. 정규화본(`assets/game/rat18_48.png`)을 틀 `enm_rat` 위에 그대로 놓은 `docs/art/templates/enm_rat.placeholder.png`가 **몬스터 표준의 황금 표본**이다(P2 §2.0). 늑대·박쥐·코볼트·보스 이후 모든 적 시트는 이 표본을 입력으로 넣는다.

- 기록(v02 → v03 r3 프롬프트): v02 `02-rat18.prompt.txt` 본문 + A(`{32x24}`) + C의 BACKGROUND 문장 + D + `Every outline pixel is fully opaque dark plum #2B2233; there is no reddish or semi-transparent fringe around any silhouette.`
- 32 규격은 만들지 않는다(D64).

### 3.5 배경

#### AO-39 · 들판 3층 — P2 §4로 옮김 (v1.4, D71)

배경 네 장면(마을·들판·폐광·틈)은 v04 품질 기준 합성 `assets/_imagegen/v04/bg-four-regions-quality-r2.png`에서 출발한다. 띠 자르기 → 이음 판 → 불 끈 판 → 층 떼기 순서와 문장은 `prompts/P2_world.md` §4가 가진다. v1.3까지 여기 있던 "부드럽고 저대비·왼쪽 4분의 1은 평탄·오른쪽 절반 비움" 들판 프롬프트는 배경을 지나치게 단순하게 만들어(v04 `00-field-composite`) 폐기했다.

---

## 4 육안 합격 기준 (생성할 때마다 본다)

| 번호 | 기준 |
| --- | --- |
| E1 | 요구한 열·행·칸 수와 빈 칸 위치가 정확하다 |
| E2 | 모든 칸이 같은 인물·같은 크기·같은 옷이다(부품 시트는 같은 부품) |
| E3 | 발(또는 엉덩이·누운 몸)의 아래 끝이 모든 칸에서 같은 높이다 |
| E4 | 배경이 투명하거나 `#FF00FF` 한 색이다. 후광·비네트·그라데이션이 없다 |
| E5 | 프레임마다 포즈가 다르다(같은 포즈를 지정한 칸만 같다). 걷기 1행과 2행은 앞뒤 다리가 다르다 |
| E6 | 칸 밖으로 넘치거나 옆 칸에 닿는 부분이 없다. 예외: 무기(칼끝·창끝·곡괭이 머리)는 칸 가장자리를 넘어 빈 여백까지 나가도 되지만 옆 칸의 인물·무기에 닿지 않는다(D65) |
| E7 | 글자·숫자·테두리·그림자·피가 없다 |
| E8 | 편집으로 뗀 부품은 입력 이미지와 겹쳤을 때 위치가 그대로다 |
| E9 | 모든 캐릭터 시트가 기준 인물(§0.2의 0번)과 같은 인물이다: 머리 부피·눈 크기·얼굴 비율·옷 |
| E10 | 뗀 부품에는 입력에서 보이던 화소만 있다. 소매가 팔로 늘거나 가려진 부분이 새로 그려지지 않았다 |
| E11 | 배경 전체가 같은 자홍색 한 값이다. 그라데이션·후광·어두운 테두리가 없다 |
| E12 | (폐기 — 32 규격을 만들지 않는다, D64) |
| E21 | **편집 색 유지**: 편집(떼기·교체·상태)으로 남긴 화소의 색이 입력과 같다. 레이어를 겹친 합성이 기준 시트와 같은 색으로 보이고, 더 밝거나 주황빛이거나 채도가 달라진 곳이 없다. E8·E13(P1)·W3(P2)을 보는 모든 편집에서 함께 본다 |
| E22 | **문 통과**(v1.4): 틀 위에서 만든 시트(생성과 그 편집)는 `pnpm art:gate <png> --spec <시트>`가 종료 코드 0이다(§0.4). 육안 기준보다 먼저 본다. 틀 필요 시트(§0.4.3)는 해당 없음 |

- 번호는 네 문서에서 겹치지 않는다: E1~E12·E21·E22(이 문서), E13~E20(P1 §14), W1~W14(P2 §13.2), SE1~SE13·V-S1~V-S7(P3 §5·§6). 새 공통 기준은 E23부터 붙인다.

---

## 5 문서 색인 (v1.2)

### 5.1 무엇이 어디에 있나

| 문서 | 다루는 것 | 카드 | 파일 접두사 | 합격 기준 | 여기서 정의하는 블록 |
| --- | --- | --- | --- | --- | --- |
| `PROMPTS.md`(이 문서) | 제작 방법(§0), **규격 고정 절차·틀 대응표·틀 필요(§0.4)**, 공통 블록(§1), P0(§3), NPC 외형 단일 출처와 NPC 전신 기준 시트(§7), **전체 진행표(§6)**, **틀 수치 블록(§8)** | AO-01~04·07·08·13·14·16·17·20·21·31·39·49의 P0 분 | P0는 번호만 `{2자리}-{이름}`(v02·v03 관례), NPC 기준 `n{번호}` | E1~E12, E21, E22 | A B C D D-BG E S S-W X L1~L8 T NUM GF, `[ID-…]` |
| `prompts/P1_character.md` | 캐릭터의 나머지: 동작 5종(REF-D·E), 머리 자세(REF-H), 머리 6종, 방어구 3계열, 투구, 무기 V1·V2 나머지·V3~V6, 망토, 전문화, 장신구, 나이, 흡혈귀 확인 | AO-05~10, 13·14·15, 16·17 나머지, 18, 20~23, 25~29 | `c{번호}` | E13~E20 | F G |
| `prompts/P2_world.md` | 적(**몬스터 표준 §2.0**)·보스·배경·장소 소품·날씨·효과·소품·UI 아이콘·아이템 아이콘·책 UI·초상 | AO-31~62의 P0 밖 | `w{번호}` | W1~W14 | A-UI A-POR C-E C-FX C-PROP C-ICON C-POR C-BG C-BGP C-FREE D-FX D-UI D-MARK D-B36 SW E-POR E-POR-T MS I-WOLF I-BAT I-KOBOLD I-BOSS I-HERO-POR |
| `prompts/P3_scenes.md` | 이벤트 장면 ES01~ES20(15 §9.3, D63) | (카드 없음) | `es{번호}-{이름}-48[-k]` | SE1~SE13, V-S1~V-S7 | SC-A SC-K SC-E SC-C SC-D, HERO SLOT |
| `OPEN_DECISIONS.md` | 네 문서의 「확인 필요」 통합표와 결정 결과(2026-09-24 사용자 결정 반영), 소유 문서·카드 변경 기록, 도구 작업 | — | — | — | — |
| `V05_REQUEST.md` | 제작 AI에게 넘기는 v05 요청 묶음(순서·입력·틀·합격). 프롬프트 문장은 여기 네 문서를 가리킨다 | — | `assets/_imagegen/v05/` | — | — |
| `templates/`(`specs.json`, `<시트>.json`·`.grid/.placeholder/.silhouette.png`) | 배치 틀과 수치(도구 `art:template` 산출). §8 NUM의 출처 | — | — | E22(`art:gate`) | — |

- 블록은 표의 마지막 열 문서에서만 정의하고, 다른 문서는 이름으로만 부른다. 블록 문장을 고칠 때는 정의한 곳만 고친다.
- 편집 머리말은 세 가지다: X(떼기, §3.2), S(캐릭터 교체, §1), SW(세계 에셋 교체·상태, P2 §1.4). 장면 띠 편집은 SC-E(P3 §3). 넷 모두 색 유지 문장을 가진다(E21).
- 15 수량 대조: 캐릭터 388 = P0 + P1(P1 §17), 세계 = P2 §16, 장면 80 = P3.

### 5.2 파일 이름

`assets/_imagegen/{판}/{접두사}{번호}-{이름}-{규격}.png` + 같은 이름 `.prompt.txt`. 떼어 낸 결과는 폴더 `README.md`에 **어느 합성에서 뗐는지** 적는다. 번호는 각 문서 제작 순서표의 번호다(P1 §15 `c`, P2 §14 `w`, P3 §7 `es`, 이 문서 §7.4 `n`). 게임 규격 파일 이름(15 §12.1)은 정규화가 붙인다(`docs/art/imagegen.map.json`).

### 5.3 전체 제작 순서

「선행」이 합격해야 시작한다. 한 줄 안의 순서는 각 문서의 순서표를 따른다.

| 단계 | 무엇 (문서·번호) | 선행 | 막는 결정 (`OPEN_DECISIONS.md`) |
| --- | --- | --- | --- |
| 0 P0 마무리 (v05 = `V05_REQUEST.md`) | 기준 시트 바지 색 교체(REF-B~E) → 몸체 L1·가림막 L3·L8 → 도구 `derive`(옷·무기), REF-A 재생성 → 걷기 몸체·머리카락·얼굴 떼기, L7 표정 합성 12(+ 볼 홍조 표지, P1 §3.3), V2 단검(REF-B 교체 → `derive`), 책, 그림자, 검 다시 정규화(무기 셀 80 × 64, 도구 T5) | 마스터(있음) | — |
| 1 O02 | **결정: 48 × 48(D64, 2026-09-24).** 참가자 비교 테스트는 플레이 검증(17 §6 S1)으로 미뤘다. 32 쌍은 만들지 않는다 | — | — |
| 2 NPC·배경·UI·초상 | ① `n01` NPC 전신 기준 시트(§7.4, v04 첫 판 합격 = `nref`) → P3 시범 ES15·ES18(인물 없음)·ES01. ② P2 배경 w10~w16(시범: H1 한 곳 16변형 먼저, D72), UI 아이콘 두 장(`ui_icon_12`·`ui_icon_16`), 책 UI w33. ③ P2 초상 w39~w42 → NPC 초상 w43(+ w44, `por_npc_64` 11칸) → w45 | 마스터, 품질 기준 | — |
| 2′ 효과·소품 | P2 효과 w17~w20, 소품 w22~w24 | — | — |
| 3 캐릭터 | P1 c01~c23, c25. 걷기 행이 든 c08·c09·c15·c16·c21과 P2 w21 전리품 자루는 **새 REF-A 합격 뒤** | REF-A(걷기 행만) | — |
| 4 적·보스 | P2 w01~w09, w34~w38 — 몬스터 표준(P2 §2.0) | 황금 표본(들쥐 r3 정규화본, 있음) | OD-12의 EB01 색값만(w08a 색, 소품 떼기는 진행) |
| 5 장면 본 제작 | P3 §7.2 차례 3~6 | `n01` | — |
| 6 아이템 아이콘 | P2 w29~w32 | P1 c14(무기 레이어, 권장) | `ASSET_BACKLOG.md` O-02(만들지 여부). 규격은 24 × 24로 정했다 |
| 7 (폐기) 32 규격 | — | O02 = 48(D64) | — |

문서 사이 입력(먼저 합격하면 뒤 작업에 입력으로 넣는다. 없으면 뒤 작업이 문장만으로 진행한다):

| 먼저 | 뒤 | 무엇을 맞추나 |
| --- | --- | --- |
| `n01` NPC 기준(§7.4) | P3 NPC 장면 14개, P2 w43·w44 | NPC 정체성(단일 기준) |
| P0 REF-A | P1 c08·c09·c15·c16·c21, P2 w21 | 걷기 행 |
| P1 c18 등불(J04) | P2 w08(EB02 등불), w14(폐광 등불), w24(세움 등불) | 등불 모양 |
| P1 c14 무기 레이어 | P2 w29 무기 아이콘, P3 ES17 녹슨 검 | 무기 모양 |
| P2 w22·w23·w24 소품 | P3 ES01·03·10·11·15·18 | 소품 모양(P3 §2 표) |
| P2 w01 늑대, w34 보스, w13 폐광, 들판 합성 | P3 ES07, ES20, ES03·05·20, ES06·07·12·13 | 적·종·장소 모양 |
| P2 w39 주인공 초상 | P2 w40~w45 | 초상 스타일 |

### 5.4 진행과 결정

- 진행 상태는 **§6 한 곳에만** 적는다. P1·P2·P3의 진행표 절은 §6을 가리킨다.
- 「확인 필요」는 **`OPEN_DECISIONS.md` 한 곳에만** 적는다. P1 §18·P2 §17·P3 §9의 옛 번호는 그 표의 `옛 번호` 열로 찾는다.

---

## 6 진행표 (전체, 이 표 하나만 고친다)

✅ 합격 · 🔶 일부 · ❌ 다시 · ⬜ 아직

### 6.1 P0 (2026-09-24, v03·v04 + 도구 결과 + 사용자 결정 기준)

32 열은 없앴다(O02 = 48, D64). 「V05-nn」은 `V05_REQUEST.md`, 「V06-nn」은 `V06_REQUEST.md`의 항목 번호다(2026-09-25: v05 판정 반영, 다음 할 일을 V06으로).

| 항목 | 카드 | 48 | 다음 할 일 |
| --- | --- | --- | --- |
| 기준 인물 동작 | AO-02·04·07·08 | ✅ v05 `02-ref-b-actions18-48-teal`(청록판, 새 원본) | 몸체 L1·얼굴 L8(V06-02·04), 단검 교체(V06-22) |
| 걷기 12 | AO-03 | ✅ v05 `01-ref-a-walk12-48-r3` | 몸체·머리카락·얼굴 떼기(V06-02~04), 가죽·금속 교체(V06-23·24) |
| 가죽옷 합성 | AO-21 | 🔶 동작 ✅ v05 `04-ref-c-leather-actions18-48-teal-r2` / 걷기 ⬜ | 걷기·D·E 가죽 교체(V06-23) |
| 몸체 레이어 | AO-02~08 | 🔶 동작 모양 ✅, 속옷·바지 색 ❌(D73) / 걷기 재추출 | 청록판에서 새 L1(V06-02) |
| 머리카락 HR01 | AO-14 | 🔶 동작: 위치 ✅, 색 ❌(§2.3) — 파생이 모양만 쓰고 색은 기준에서 가져와 해결 / 걷기 재추출 | 가림막 L3 A·D·E(V06-03), 게임 머리 3칸 REF-H → HR01(V06-20·21) |
| 얼굴 | AO-13 | ❌ v04 표정: 눈감음이 `^^` / v05 미착수 | L7 표정 합성 12(V06-01) → 볼 홍조 표지 → L2(V06-07) |
| 얼굴 가림막(파생용) | — | ⬜ REF-A·B·D·E(청록판) | L8(V06-04) |
| 천옷 레이어 | AO-20 | 🔶 도구 `derive`: v03 18칸 통과(재합성 최저 98.9%) | 몸체 새 L1 뒤 `derive` 다시(도구) |
| 가죽옷 레이어 | AO-21 | ⬜ 생성기 떼기 중지 | REF-C 색 교체 뒤 `derive`(도구) |
| 한손검 | AO-16 | 🔶 공격 6 ✅(셀 넘침 허용, OD-03 결정) / 피격·착용은 P1 c13·c17 | 무기 셀 80 × 64로 다시 정규화(도구 T5) |
| 단검 | AO-17 | ❌ 밀도(§2.3) | REF-B 청록판 교체(V06-22) → `derive` |
| 책 | AO-49 | ❌ 크기 | 재생성(틀 필요, §0.4.3) |
| 그림자 | AO-01 | ❌ 반투명 | 불투명 한 색으로 재생성(틀 필요) |
| 들쥐 | AO-31 | ✅ **몬스터 황금 표본** | 틀 `enm_rat` 자리표시 = 표본 18프레임 |
| 들판 3층 | AO-39 | ❌ 층 정합 → D72로 대체. H1 기본 장면 ✅ v05 `w10-h1-river-meadow-summer-day-r3`(1983 × 793) | 이음 판(V06-06) → 층(V06-08) → 16변형(V06-09~11) |

### 6.2 P1 캐릭터 (P1 번호 `c`)

| 항목 | 카드 | 합성 | 레이어 | 다음 할 일 |
| --- | --- | --- | --- | --- |
| 피격·발견·상호작용 | AO-05·06·09 | ✅ v05 `c01-…-teal`(청록판) | 🔶 몸체 모양 ✅·색 ❌, 천옷·검 생성기 떼기 ❌ | L1·L3·L8(V06-02~04) → `derive` |
| 환호·쓰러짐 | AO-10 | ✅ v05 `c02-…-teal`(청록판) | 🔶 몸체 모양 ✅·색 ❌, 천옷 ❌ | L1·L3·L8(V06-02~04) → `derive` |
| 머리 자세 3 | AO-14·15·23 | 🔶 v04 `c04` 보류(검증 전) | — | 틀 `chr_head_poses_ref`로 c04(V06-20) |
| 머리카락 HR01 6칸 | AO-14 | — | 🔶 v04 `c05` 기본 3 보류, 가림 3 ⬜ | c05(V06-21) |
| 머리카락 HR02~06 | AO-15 | ⬜ | ⬜ | c06(V06-28) |
| 얼굴 가는 눈 5 | AO-13 | ⬜ | ⬜ | L7 표정 합성 12의 2행(V05-06)에 합쳤다 |
| 천옷 나머지 28 | AO-20 | ✅(기본 복장) | ⬜ | c03, c10 |
| 가죽 44 | AO-21 | 🔶 B ✅(P0 청록판) | ⬜ | c08 A·D·E(V06-23) |
| 금속 44 | AO-22 | ⬜ | ⬜ | c09(V06-24) |
| 선택 부품 겹침 3(목도리·짝짝이 어깨받이·연결 고리) | AO-20~22 | ⬜ | ⬜ | c11(V06-29, 규약 OD-04 결정, D67) |
| 투구 15 | AO-23 | ⬜ | ⬜ | c12(V06-27) |
| V1 피격 3·착용 1·표지 | AO-16 | ⬜ | ⬜ | c13 표지(V06-25), 착용 c17(틀 필요) |
| V2 피격 3·착용 1 | AO-17 | ⬜ | ⬜ | c14(V06-26), c17(틀 필요) |
| V3~V6 40 | AO-18 | ⬜ | ⬜ | c14(V06-26), c17(틀 필요, 한 손, D68) |
| 망토 44 | AO-25 | ⬜ | ⬜ | c15 |
| 봇짐·배낭 4 | AO-26 | ⬜ | ⬜ | c18 |
| 두건·스카프 6 | AO-26 | ⬜ | ⬜ | c19(두건 = 가림 `일부`) |
| 방패 20 | AO-27 | ⬜ | ⬜ | c16, c17 |
| 깃 3·등불 2·빛 원 | AO-28 | ⬜ | ⬜ | c18~c20 |
| 노년 몸체 10 | AO-29 | ⬜ | ⬜ | c21 |
| 주름 2 | AO-13·29 | ⬜ | ⬜ | L7 표정 합성 12의 3행(V05-06)에 합쳤다 |
| 흰머리 보조판 6장 | AO-29 | — | ⬜ | c25(OD-16) |
| 흡혈귀 확인 | AO-30 | ⬜ | — | c23(선택) |

### 6.3 P2 세계 (P2 번호 `w`)

| 항목 | 카드 | 번호 | 결과물 | 상태 | 다음 할 일 |
| --- | --- | --- | --- | --- | --- |
| 들쥐 EN01 48 | AO-31 | (P0) | 18 | ✅ v03 r3 | 입력으로 사용 |
| 늑대 | AO-32 | w01 | 18 | ✅ v05 `w01-wolf18-48-r3` | 색 목표 EN04(V06-42) |
| 박쥐 | AO-33 | w02 | 18 | ✅(조건부) v05 `w02-bat18-48-r3` | 색 목표 EN06·EN07(V06-42) |
| 코볼트 몸체 | AO-34 | w03·w04 | 18 | 🔶 합성 ✅ v05 `w03-kobold-composite18-48-r2` | 몸체 떼기(V06-40) |
| 코볼트 곡괭이 | AO-35 | w04 | 5(18에서) | ⬜ | `derive`(도구, w03 합성에서) |
| 들쥐 귀 EN02 | AO-35 | w05 | 2(18에서) | ⬜ | V06-41 |
| 모자·녹슨 투구 | AO-35 | w07 | 2 + 2 | ⬜ | V06-43 |
| 뿔 투구·큰 곡괭이·수염·등불 | AO-35 | w08 | 2 + 5 + 2 + 2 | ⬜ | V06-44(피부 색 문장 빼고). EB01 색값(OD-12)만 대기 |
| 정예 깃발 | AO-35 | w09 | 2 | ⬜ | 16 × 16 셀(OD-30 결정) |
| 변형 색 목표 EN04·06·07 | AO-36 | w06 | 검토용 3 | ⬜ | V06-42 |
| 보스 본체 | AO-37 | w34~w36 | 31 | ⬜ | V06-45~47(w34는 틀 필요 예외) |
| 보스 균열·파동 | AO-38 | w37·w38 | 1 + 4(파동 셀 64 × 56) | ⬜ | 균열 V06-48, 파동 = V06-47 4행 |
| 배경: 야외 기본 장면 8(T00·H1~H4·A1~A3) + 층 떼기 | AO-39·40 | w10 | 기본 8, 층 마스크 8 | 🔶 H1 기본 ✅ v05 `w10-…-r3`(이음 판 필요) · 품질 기준 ✅(v04 r2) | H1 이음 판·층·16변형(V06-06~11) 뒤 나머지 7곳(V06-50~57) |
| 배경: 야외 계절·시간대 변형 | — | w11 | 120(장소 8 × 15) | ⬜ | H1 V06-09·10, 나머지 V06-90 |
| 배경: 야외 먼 층 채움 · 마을 점등 | AO-40 | w12 | 층 타일 384 · 겹침 3 | ⬜ | H1 V06-11, 나머지 V06-91, 점등 V06-92 |
| 배경: 폐광 띠 H5·D1~D3 | AO-41 | w13 | 기본 4 + 변형 12(H5 시간대 3, 세대 특징 9) · 층 타일 48 | ⬜ | 기본 V06-54·58~60, 변형 V06-93·94, FILL V06-96 |
| 배경: 폐광 등불 겹침 | AO-41 | w14 | 4 × 2칸 | ⬜ | V06-97 |
| 배경: 틈 A4 + 색조 · 운명 장소 | AO-42 | w15 | A4 3(층 타일 9) + 한 장 띠 2 | ⬜ | V06-61~63, 색조 V06-95(임시) |
| 배경: 발견 지점 패널 | — | w16 | 기본 25 → 295(야외 18 × 16 + 지하 7) | ⬜ | 짝 13장(야외 9 · 지하 4, 그중 Q10은 한쪽만) |
| 배경: 던전 특수 방 패널 | — | w16 | 12(층 3 × 보물·함정·휴식·관문) | ⬜ | 짝 6장 |
| 배경 합계 | — | w10~w16 | 그림 456 · 층 타일 441 · 패널 307 · 겹침 7 · 호출 487 | ⬜ | 장소 소품 20은 없앴다(D72) |
| 날씨 입자·안개 | AO-45 | w17 | 입자 4(+낙엽 2) + 안개 1 | ⬜ | 입자 스프라이트 방식 승인(OD-25) |
| 효과 6종 | AO-46~48 | w18~w20 | 32 | ⬜ | 틀 필요(OD-74). 한 장 방식 V06-98 보류 |
| 소품 A | AO-49 | w21·w22 | 18(책 제외) | ⬜ | 자루는 REF-A 뒤 |
| 소품 B | AO-50 | w23·w24 | 23 | ⬜ | — |
| UI 아이콘 | AO-51~54 | w25~w28 | 42 | ⬜ | 틀 두 장: `ui_icon_12`(w25 + w28b) 먼저, `ui_icon_16`(w26~w28a) |
| 아이템 아이콘 | AO-55~58 | w29~w32 | 34 | ⬜ | 규격 24 승인. 만들지는 `ASSET_BACKLOG.md` O-02 |
| 책 UI | AO-59 | w33 | 3 | ⬜ | — |
| 초상 부품 64 | AO-60 | w39~w42 | 25 | ⬜ | — |
| NPC 초상 64 | AO-61 | w43·w44 | 11 | ⬜ | 틀 `por_npc_64` 11칸 한 장(V06-13). 선행 w39(V06-12), `nref` ✅ |
| 초상 48 판 | AO-62 | w45 | 36 | ⬜ | 64 합격 뒤 |

### 6.4 NPC 기준과 이벤트 장면 (P3 번호 `es`)

`nref` 칸 번호는 §7.4 순서다(1 하델 · 4 도담 · 5 세나 · 7 유안 · 8 비엘 · 9 토리 · 10 동반자 · 11 여행자).

32 열은 없앴다(O02 = 48, D64). 정지 부분 떨림은 두 번 재생성 실패 뒤 정규화가 1칸에서 복사한다(D66, 도구 T10).

| 장면 | 사건 | 입력 | 열쇠 띠 K | 띠 48 | 정규화 | 합성 검수(P3 §6) |
| --- | --- | --- | --- | --- | --- | --- |
| `n01` NPC 기준 | — | 마스터 | — | ✅ v04 첫 판(`nref`) | — | — |
| ES01 | L09 | nref 11 | ✅ v05 `-k-r3` | ⬜ V06-05 | ⬜ | ⬜ |
| ES02 | L23 | nref 4 | ⬜ V06-74 | ⬜ | ⬜ | ⬜ |
| ES03 | C01-1 | — | ⬜ V06-81 | ⬜ | ⬜ | ⬜ |
| ES04 | C01-2 | nref 5 | ⬜ V06-75 | ⬜ | ⬜ | ⬜ |
| ES05 | C01-3 | — | ⬜ V06-82 | ⬜ | ⬜ | ⬜ |
| ES06 | C02-1 | nref 9 | ⬜ V06-70 | ⬜ | ⬜ | ⬜ |
| ES07 | C02-2 | nref 9, EN03 | ⬜ V06-71 | ⬜ | ⬜ | ⬜ |
| ES08 | C02-3 | nref 9 | ⬜ V06-76 | ⬜ | ⬜ | ⬜ |
| ES09 | F01 | nref 1 | ⬜ V06-77 | ⬜ | ⬜ | ⬜ |
| ES10 | F02 | nref 7, (P2 w15 틈) | ⬜ V06-84 | ⬜ | ⬜ | ⬜ |
| ES11 | F03 | nref 8 | ⬜ V06-85 | ⬜ | ⬜ | ⬜ |
| ES12 | S01 | nref 10 | ⬜ V06-72 | ⬜ | ⬜ | ⬜ |
| ES13 | S02 | nref 10, ES12 | ⬜ V06-73 | ⬜ | ⬜ | ⬜ |
| ES14 | S03 | nref 1·4 | ⬜ V06-78 | ⬜ | ⬜ | ⬜ |
| ES15 | S04 | — | ✅ v05 | ✅(조건부) v05, 바닥 보강 V06-14 | ⬜ | ⬜ |
| ES16 | S05 | — | ⬜ V06-79 | ⬜ | ⬜ | ⬜ |
| ES17 | S06 | nref 1 | ⬜ V06-80 | ⬜ | ⬜ | ⬜ |
| ES18 | S07 | — | ✅ v05 | ✅ v05 `es18-parent-letter-48` | ⬜ | ⬜ |
| ES19 | S08 | nref 8, ES11 | ⬜ V06-86 | ⬜ | ⬜ | ⬜ |
| ES20 | EB03 | EB03 시트 | ⬜ V06-83 | ⬜ | ⬜ | ⬜ |

합계 목표: 장면 20 × 4칸 = 80프레임(15 §13.1).

---

## 7 NPC 외형 (단일 출처, v1.2)

P2 초상(옛 NB-01~NB-09)과 P3 장면(옛 등장인물 외형표·`[ID-…]`·NPC-REF)이 따로 적던 NPC 외형을 여기 하나로 합쳤다. **NPC 외형은 이 절만 고친다.** P2·P3은 이 절을 부른다.

### 7.1 출처와 순서

- 출처 우선순위: **02 §8 외형 키워드**(인물·세계 소유, 00 §2.4) → 15 §10(초상: 투구 없음, 세나·비엘 표정 추가)·15 §9.3(장면 속 역할 설명) → `ASSET_ORDERS.md` AO-61 외형 단서. 앞 출처와 부딪히는 뒤 출처는 쓰지 않는다.
- AO-61에서 쓰지 않은 것(02와 부딪힘): 하델 「가죽 목깃」(02: 녹색 길드 조끼), 미루 「안경 없는 가는 눈」(02: 동그란 안경), 세나 「두 갈래 땋은 머리」(02: 짧게 묶은 머리), 유안 「이마 붕대」(02: 붕대 감은 다리). AO-61의 유안 「길잡이 두건 목 스카프」는 02의 길잡이 망토와 부딪히지 않아 「두건을 내려 목에 두름」으로 합쳤다. AO-61에 없던 도담 머릿수건·토리 모자는 02에서 더했다.
- 세 출처 어디에도 없는 세부(색·옷 모양·키 수치)는 **`임시`**다. **사용자가 승인했다**(2026-09-24, `OPEN_DECISIONS.md` OD-02). 생성 결과를 보고 고칠 수 있고, 고칠 때는 이 절만 고친다.
- 색은 기본 52색 안에서 고른다(15 §2.2). 속옷 묶음 `#7EA6B8` `#546E7A`와 바지 묶음 `#27978D` `#00766D`는 주인공 몸체 전용이라 NPC 옷에 쓰지 않는다(D73). NPC의 회베이지 바지 `#C8C2B8` `#9A948C`는 그대로다 — NPC는 한 장 그림이라 레이어를 가르지 않는다. 비엘만 흡혈귀 확장 묶음을 쓴다(15 §5.2).
- **제작 순서: NPC 전신 기준 시트(`n01`, §7.4) → 초상(P2 w43).** 초상은 `n01`을 정체성 입력으로 넣어 만든다. 주인공 초상(P2 w39)이 스프라이트 마스터에서 나오는 것과 같은 방향이다. 이유: ① `n01`은 마스터만 있으면 지금 만들 수 있다(초상은 w39가 먼저 필요하다). ② 전신 특징(다리 보조대·짝짝이 장화·붕대 감은 다리)은 흉상에 보이지 않으므로, 흉상에서 전신을 만들면 아랫몸을 새로 지어내야 한다. ③ 장면 14개가 `n01`을 직접 입력으로 쓰므로 기준이 하나가 된다. 초상이 합격하면 `n01`과 나란히 놓고 본다(P2 W12). 둘이 다르면 `n01`이 기준이고 초상을 다시 만든다.

### 7.2 외형표

| ID | 인물 | 나오는 곳 | 확정 외형 (출처) | `임시` 세부 | 키(48) |
| --- | --- | --- | --- | --- | --- |
| N01 | 하델 길드 출장소장 | ES09 ES14 ES17, 초상 | 회색 짧은 수염, 한쪽 다리의 나무 보조대, 짧은 지팡이, 녹색 길드 조끼, 허리의 별패(02 §8.1). 한쪽 다리를 저는 은퇴 모험가(15 §9.3). 짧은 잿빛 머리(AO-61) | 머리·수염 `#9A948C` `#6E6862`, 피부 중간 `#E3B48E` `#C88E68` `#A0664A`, 조끼 `#6D8F5A` `#4D6A3E` 안에 크림 셔츠 `#F0E6CC`, 갈색 바지 `#8E5E38`, 별패 `#FFE38A`, 보조대는 오른쪽 정강이 `#C08A58`, 지팡이 `#8E5E38`, 지팡이 쪽으로 조금 기움 | 38 |
| N02 | 보름 대장장이 | 초상 | 넓은 어깨, 그을린 가죽 앞치마, 이마의 두건, 큰 망치(02 §8.2). 굵은 목, 이마 땀(AO-61) | 흑갈 머리 `#4A3A32` `#2F2420`, 청 두건 `#5A7FA8` `#3E5A7E`, 피부 짙음 `#B97F5A` `#93603F` `#6E442C`, 앞치마 `#8E5E38` `#5E3C24`, 크림 셔츠, 망치 머리 `#7D7B80` `#4C4A52` 어깨에 걸침, 땀 한 방울 `#B9C8FF`, 무릎까지 오는 앞치마 아래 짙은 바지 `#5E3C24` | 38 |
| N03 | 미루 잡화점·약초 | 초상 | 동그란 안경, 귀에 꽂은 깃펜, 두꺼운 장부, 약초 바구니(02 §8.3). 어깨에 약초 다발(AO-61) | 밀빛 머리 `#D8B868` `#A8883E` 작은 쪽머리, 피부 밝음 `#F6D9C2` `#E8B89A` `#C98E72`, 안경 `#4C4A52`, 깃펜 `#F0E6CC`, 장부 `#8E5E38`, 약초 `#6D8F5A` `#4D6A3E`, 청 가게 외투 `#5A7FA8` `#3E5A7E`, 팔에 건 바구니 `#C08A58` `#8E5E38` | 38 |
| N04 | 도담 여관 '도토리 모자' | ES02 ES14, 초상 | 둥근 얼굴, 도토리색 머릿수건, 국자, 앞치마 주머니의 쪽지(02 §8.4). 웃는 눈(AO-61) | 통통한 몸, 발그레한 볼, 피부 밝음 `#F6D9C2` `#E8B89A`, 머릿수건 `#8E5E38` + 띠 `#C08A58`, 밤색 머리 `#7A4E30` 조금, 붉은 옷 `#B04A42`, 크림 앞치마 `#F0E6CC`, 국자 `#B4B2B0`는 앞치마 끈에 꽂음 | 38 |
| N05 | 세나 광부의 딸 | ES04, 초상(+걱정) | 짧게 묶은 머리, 아버지의 큰 광부 목도리, 작은 종 목걸이(02 §8.5). 광부 차림 소녀(15 §9.3) | 흑갈 머리 `#4A3A32` `#2F2420`, 피부 중간, 목도리 `#B04A42`(P1 A04 광부 목도리 색) 두 번 감고 한쪽 끝이 길다, 종 `#E0B06A` `#B07A3A`, 갈색 작업 윗도리 `#8E5E38` `#5E3C24`, 회베이지 바지 `#C8C2B8` `#9A948C`, 갈색 장화 | 약 34 |
| N06 | 도한 돌아오지 않은 광부 | 초상만(02 §8.6: 직접 등장하지 않는다) | 수염, 잿빛 머리, 광부 차림 목깃(AO-61). 투구 없음(15 §10) | 잿빛 짧은 머리와 턱을 덮는 덥수룩한 수염 `#9A948C` `#6E6862`(하델의 짧은 수염과 구별), 풍상 겪은 중간 피부, 갈색 작업 외투 `#8E5E38` `#C08A58`, 세나와 **같은** 붉은 광부 목도리를 목에 맴 | 38 |
| N07 | 유안 다친 길잡이 | ES10, 초상 | 붕대 감은 다리, 낡은 길잡이 망토, 나침반 목걸이, 지친 눈(02 §8.7). 두건 목 스카프(AO-61 → 내린 두건) | 헝클어진 청흑 머리 `#3A4458` `#262E3E`, 피부 짙음 `#B97F5A` `#93603F`, 반쯤 감긴 눈, 녹색 망토 `#6D8F5A` `#4D6A3E`(P1 길잡이 두건 색) 기운 자국 1개, 나침반 `#B4B2B0` + 바늘 `#B04A42`, 흰 붕대 `#F0E6CC` `#C8C2B8` | 38(앉음 약 26) |
| N08 | 비엘 달그늘 성주 | ES11 ES19, 초상(+결연) | 창백한 피부, 붉은 눈, 긴 검은 망토, 검은 장미 단추, 낡은 은잔(02 §8.8). 피부 `#EDE6EE` `#CFC3D6` `#A596B0`, 눈 `#C2263A`, 망토 `#2E2438` + 안감 `#7A1F33`(15 §5.2, AO-61) | 긴 은백 머리 `#E8E4DC` `#C8C2B8`를 목뒤로 묶음(검은 망토 위에서 윤곽이 읽히게), 높은 깃, 권태로운 옅은 미소. 은잔은 인물이 아니라 장면 소품으로 따로 그린다(ES11) | 38 |
| N09 | 토리 길 잃은 아이 | ES06 ES07 ES08, 초상 | 도토리 모자처럼 생긴 털모자, 큰 호각, 작은 키, 짝짝이 장화(02 §8.9). 가장 작은 얼굴, 목에 호각 줄(AO-61). **나무** 호각(11 C02-1, 08 J01, 15 §9.3 ES06) | 모자 `#C08A58` + 윗부분 `#7A4E24` + 작은 꼭지, 적갈 머리 `#A4523A` 조금, 피부 밝음, 큰 둥근 눈, 노랑·파랑 조각을 기운 광대 윗도리 `#FFE38A` `#5A7FA8`, 장화 왼쪽 `#B04A42` 오른쪽 `#3E5A7E`, 호각 `#C08A58` `#8E5E38` | 약 30(02 「작은 키」, 수치는 `임시`) |
| — | 동반자 | ES12 ES13 | 성별이 드러나지 않는 평상복(15 §9.3), 성별 표현 금지(11 S01), 외형은 머리색 1종(12 §2.1) | 턱선 길이 머리를 귀 뒤로 넘김, 머리는 교체용 두 색 `#4A3A32` `#2F2420`(OD-19), 피부 중간, 차분한 눈, 수염·화장·장신구 없음, 무릎 길이 헐렁한 파란 작업 윗도리 `#5A7FA8` `#3E5A7E` + 크림 소매, 갈색 허리띠, 회베이지 바지, 갈색 장화. 치마·갑옷 아님 | 38 |
| — | 낯선 여행자 | ES01 | 망토를 쓴 여행자, 닳은 신발 밑창(11 L09, 15 §9.3) | 두건 달린 긴 회색 여행 망토 `#9A948C` `#6E6862`, 얼굴은 두건 그늘에 가려 작은 눈 2개만, 성별 드러내지 않음, 갈색 장화 밑창에 닳은 자국 `#C8C2B8` | 38(앉음 약 26) |

- 표의 `임시` 칸 전부가 승인되었다(OD-02, 2026-09-24). 키 수치 가운데 38은 15 §9.3, 토리가 어른보다 작은 것은 02 §8.9·15 §9.3이고, 30·34라는 수치는 `임시`다.
- 후손 세대 NPC(온새·불티·바림·도란·도윤·어른 토리·호루)는 만들지 않고 1대 인물의 그림을 쓴다(15 §10, OD-20).

### 7.3 영어 정체성 문장

`[ID-…]` 자리에 그대로 넣는다. 괄호 `(Full body: …)`는 **전신(§7.4 기준 시트·P3 장면)에서만** 괄호와 `Full body:` 표지를 빼고 내용을 넣고, **초상(P2 w43)에서는 괄호째 뺀다.**

```
[ID-N01] Hadel, the guild post chief, an older retired veteran, gruff but caring: short grey hair and a short trimmed grey beard #9A948C #6E6862, stern kind eyes, a lined medium-skinned face #E3B48E #C88E68 #A0664A, a green guild vest #6D8F5A #4D6A3E over a cream shirt #F0E6CC. (Full body: brown trousers #8E5E38, a small gold star badge #FFE38A on the belt, a wooden brace #C08A58 strapped on the right shin, a short wooden cane #8E5E38, leaning slightly toward the cane.)
[ID-N02] Boreum, the blacksmith, broad-shouldered and silent: a thick neck, dark hair #4A3A32 #2F2420 under a blue cloth band tied across the forehead #5A7FA8 #3E5A7E, one small sweat drop #B9C8FF on the brow, deep skin #B97F5A #93603F #6E442C, a scorched leather apron #8E5E38 #5E3C24 over a cream shirt #F0E6CC, a big hammer with an iron head #7D7B80 #4C4A52 resting on one shoulder, a closed quiet mouth. (Full body: the apron reaches the knees, dark trousers #5E3C24, brown boots.)
[ID-N03] Miru, the shopkeeper who writes everything down: round thin glasses #4C4A52, a quill pen #F0E6CC tucked behind one ear, wheat-blond hair #D8B868 #A8883E in a small bun, light skin #F6D9C2 #E8B89A #C98E72, a blue shop coat #5A7FA8 #3E5A7E, a thick ledger #8E5E38 held at the chest, a bundle of green herbs #6D8F5A #4D6A3E peeking over the shoulder. (Full body: a small wicker herb basket #C08A58 #8E5E38 on one arm, grey-beige trousers #C8C2B8 #9A948C, brown shoes.)
[ID-N04] Dodam, the warm innkeeper of the Acorn Cap: plump, a round face with smiling eyes and rosy cheeks, light skin #F6D9C2 #E8B89A, an acorn-brown headscarf #8E5E38 with a band #C08A58, a little chestnut hair #7A4E30 showing, a red dress #B04A42, a cream apron #F0E6CC with a folded note in its pocket, a small ladle #B4B2B0 tucked into the apron string.
[ID-N05] Sena, a young girl, the missing miner's daughter, wary eyes: dark brown hair #4A3A32 #2F2420 in a short tied tail at the back, medium skin #E3B48E #C88E68, an oversized red miner's muffler #B04A42 that was her father's, wrapped twice with one long end, a tiny bronze bell pendant #E0B06A #B07A3A. (Full body: about 34 blocks tall, a brown work jacket #8E5E38 #5E3C24, grey-beige trousers #C8C2B8 #9A948C, brown boots.)
[ID-N06] Dohan, a careful middle-aged miner who never came back: ash-grey short hair and a full bushy beard covering the jaw #9A948C #6E6862, weathered medium skin #E3B48E #C88E68 #A0664A, a brown work coat #8E5E38 #C08A58, the SAME big red miner's muffler #B04A42 knotted at the neck, a calm neutral face, no helmet. (Full body: grey-beige work trousers #C8C2B8 #9A948C, brown boots.)
[ID-N07] Yuan, a weary adult pathfinder: tired half-closed eyes, messy blue-black hair #3A4458 #262E3E, deep skin #B97F5A #93603F, a worn green pathfinder's cloak #6D8F5A #4D6A3E with one patch, its hood down around the neck like a scarf, a small round compass pendant #B4B2B0 with a red needle #B04A42. (Full body: one leg wrapped in a white bandage #F0E6CC #C8C2B8.)
[ID-N08] Biel Moonshadow, an ageless, elegant, bored vampire lord: pale skin #EDE6EE #CFC3D6 #A596B0, crimson eyes #C2263A, long silver-white hair #E8E4DC #C8C2B8 tied at the nape, a long black high-collared cloak #2E2438 with crimson lining #7A1F33, small black-rose buttons, a bored gentle half-smile.
[ID-N09] Tori, a small lost child from a family of clowns, big round eyes, the smallest face of all: a knitted hat shaped like an acorn cap #C08A58 with a darker top #7A4E24 and a tiny stem, a little reddish hair #A4523A, light skin #F6D9C2 #E8B89A, a big flat WOODEN whistle #C08A58 #8E5E38 on a cord around the neck: a flat tube with a round sound hole near the far end, a short mouthpiece and a small loop on top. (Full body: about 30 blocks tall, a yellow-and-blue patchwork clown tunic #FFE38A #5A7FA8, mismatched boots, the left red #B04A42 and the right blue #3E5A7E.)
[ID-PARTNER] The partner: an adult of deliberately unreadable gender, chin-length hair #4A3A32 #2F2420 tucked behind the ears, medium skin #E3B48E, calm eyes, no beard, no makeup, no jewellery, a plain loose blue knee-length work tunic #5A7FA8 #3E5A7E over cream sleeves #F0E6CC, brown belt #8E5E38, grey-beige trousers #C8C2B8 #9A948C, brown boots.
[ID-TRAVELER] A hooded traveler: a long grey hooded travel cloak #9A948C #6E6862, the face shaded by the hood with only two small eyes visible, gender not shown, worn-out boot soles #8E5E38 with a pale worn patch #C8C2B8.
```

- 옛 이름 대응: P3 `[ID-HADEL]`·`[ID-DODAM]`·`[ID-SENA]`·`[ID-YUAN]`·`[ID-BIEL]`·`[ID-TORI]` = `[ID-N01]`·`[ID-N04]`·`[ID-N05]`·`[ID-N07]`·`[ID-N08]`·`[ID-N09]`. P2 NB-01~NB-09 = `[ID-N01]`~`[ID-N09]`.
- 영어 성 표기는 `Moonshadow` 하나로 쓴다(P2의 `Moonshade`는 버렸다).

### 7.4 `n01` NPC 전신 기준 시트 (NPC 장면·초상보다 먼저)

하델·도담·토리·비엘·동반자는 두세 장면에 나오고, 아홉 명 모두 초상이 있다. 장면·초상마다 새로 생성하면 v03 걷기 시트처럼 인물이 바뀐다(§2.2). 그래서 **주인공 마스터와 같은 역할을 하는 NPC 시트를 먼저 만들고**, 모든 NPC 장면과 NPC 초상에 정체성 입력으로 넣는다.

- 조립: A(`{48x48}`) + C(`N=11, COLS=4, ROWS=3, EMPTY_CELLS=Row 3 holds three sprites; its last cell stays completely empty.`) + 본문 + D. 입력 = 마스터 `assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`(크기·화소 밀도 기준).
- 파일: `assets/_imagegen/{판}/n01-npc-ref-48.png`. 합격본을 `nref`라 부른다. **`nref` = `assets/_imagegen/v04/n01-npc-ref-48.png`(첫 판, §2.4).** r2는 쓰지 않는다.
- 다시 만들게 되면 틀 위에서: A + T + NUM(npc_ref) + C + 본문 + D, 입력 1 = `docs/art/templates/npc_ref.placeholder.png`, 문 `--spec npc_ref`. 본문의 `about 90%`·`about 80%`는 §7.2 키(38 · 34 · 30, 논리 화소)로 바꿔 쓴다: `cell 5 is exactly 34 art px tall and cell 9 exactly 30 art px; every other adult exactly 38 art px`.

```
Input image role: the provided sheet fixes the pixel style, the block size and the body scale only. Copy its pixel density, outline weight, head-to-body proportion and adult height exactly. Do NOT draw that character anywhere.
Eleven different people, one per cell in reading order, each standing in a relaxed pose, full body, facing LEFT in a slight three-quarter side view, chibi about 2.2 heads tall. Adults are exactly as tall as the reference character; cell 5 is a little shorter (about 90%) and cell 9 is clearly smaller (about 80%). Every person must be recognisable by silhouette alone: hair and headwear shapes all differ.
1 [ID-N01]
2 [ID-N02]
3 [ID-N03]
4 [ID-N04]
5 [ID-N05]
6 [ID-N06]
7 [ID-N07] standing, leaning slightly on the bandaged leg.
8 [ID-N08]
9 [ID-N09] holding the whistle on its cord in one hand.
10 [ID-PARTNER]
11 [ID-TRAVELER]
```

- 합격: E1~E7, E11 + 열한 명이 서로 구별된다 + 어른 키가 마스터와 같다 + 모두 왼쪽을 본다 + §7.2 「확정 외형」 칸의 특징이 모두 보인다(하델 보조대·지팡이·별패, 토리 짝짝이 장화, 유안 붕대 등).

### 7.5 쓰는 곳

| 쓰는 곳 | 입력 | 붙이는 문장 |
| --- | --- | --- |
| P3 장면 열쇠 띠 K | `nref` | 장면 인물의 `[ID-…]`(괄호 풀어서) + P3 §1의 입력 역할 문장 |
| P2 NPC 초상 w43 | w39(스타일) + `nref`(정체성) | `[ID-N01]`~`[ID-N09]`(괄호째 뺀 판) + P2 §12.4의 입력 역할 문장 |
| 검수 | `nref` | P3 SE9, P2 W12: 같은 인물끼리 나란히 놓고 본다 |

---

## 8 틀 수치 블록 NUM (v1.4)

`docs/art/templates/<시트>.json`(도구 `pnpm art:template` 산출, 2026-09-24 판)을 영어로 옮긴 것이다. 생성 요청에서 T 바로 뒤에 **코드 블록 전문을 그대로** 붙인다(§0.4). 수치를 고치지 않는다 — 규격이 바뀌면 `specs.json` → `pnpm art:template` → 이 절을 다시 옮긴다(도구가 직접 찍게 하는 일은 `OPEN_DECISIONS.md` T13).

- 이미지 좌표는 캔버스 왼쪽 위가 (0, 0)이고 범위 `a-b`는 양 끝을 포함한다. 「lowest figure pixels on image rows y a-b」는 그림 최하단 논리 행이 차지하는 이미지 줄이고, 그 바로 아래 줄이 지면선이다(ASSET_ORDERS 0.4). 「centre column」은 몸 가로 중심 논리 열(그림 화소 x 중앙값을 문이 잰다, 허용 ±2 논리 화소).
- 문 허용치: 지면선 ±1, 중심 ±2, 키 ±8%, 블록 크기 ±15%, 그림 밖 배경 99% 이상, 속 반투명 1% 이하, 안내 색 0(`specs.json` `gate`).
- `enm_rat` 자리표시는 황금 표본 18프레임이다(P2 §2.0). 그 표본도 9칸에서 칸 여백 2를 1~2블록 넘는다 — 새 적은 표본의 몸 길이가 아니라 이 수치를 따른다.
- `NUM(chr_walk12)`는 임시다(§0.4.2). 나머지 틀 필요 시트는 §0.4.3.

#### NUM(chr_actions_a)

```
NUMBERS - template chr_actions_a (docs/art/templates/chr_actions_a.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 4. One art pixel = one 4 x 4 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 5 rows of cells, each 48 x 48 art px = 192 x 192 px. Grid top-left x 192, y 32; grid 1152 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 23. Empty cells (stay flat #FF00FF): (5,1), (6,1), (4,4), (5,4), (6,4), (5,5), (6,5).
- Row 1 idle (4 frames): lowest figure pixels on image rows y 204-207 (ground line y 208); height 40 art px = 160 px.
- Row 2 walk (6 frames): lowest figure pixels on image rows y 396-399 (ground line y 400); height 40 art px = 160 px.
- Row 3 attack (6 frames): lowest figure pixels on image rows y 588-591 (ground line y 592); height free.
- Row 4 hit (3 frames): lowest figure pixels on image rows y 780-783 (ground line y 784); height 40 art px = 160 px.
- Row 5 discover (4 frames): lowest figure pixels on image rows y 972-975 (ground line y 976); height 40 art px = 160 px.
- Horizontal centre (the figure's middle column): column 1 x 284-287, column 2 x 476-479, column 3 x 668-671, column 4 x 860-863, column 5 x 1052-1055, column 6 x 1244-1247.
```

#### NUM(chr_actions_b)

```
NUMBERS - template chr_actions_b (docs/art/templates/chr_actions_b.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 4. One art pixel = one 4 x 4 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 5 rows of cells, each 48 x 48 art px = 192 x 192 px. Grid top-left x 192, y 32; grid 1152 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 21. Empty cells (stay flat #FF00FF): (5,1), (6,1), (5,2), (6,2), (5,3), (6,3), (5,4), (6,4), (6,5).
- Row 1 sit_eat (4 frames): lowest figure pixels on image rows y 204-207 (ground line y 208); height 35 art px = 140 px.
- Row 2 sleep (4 frames): lowest figure pixels on image rows y 396-399 (ground line y 400); height free; no centre rule for frame 1, 2, 3, 4.
- Row 3 interact (4 frames): lowest figure pixels on image rows y 588-591 (ground line y 592); height 40 art px = 160 px.
- Row 4 cheer (4 frames): lowest figure pixels: frame 1 y 780-783; frame 2 y 772-775; frame 3 y 764-767; frame 4 y 780-783; height frame 1 free, frame 2 40 art px = 160 px, frame 3 40 art px = 160 px, frame 4 40 art px = 160 px.
- Row 5 collapse (5 frames): lowest figure pixels on image rows y 972-975 (ground line y 976); height frame 1 40 art px = 160 px, frame 2 free, frame 3 free, frame 4 free, frame 5 free; no centre rule for frame 4, 5.
- Horizontal centre (the figure's middle column): column 1 x 284-287, column 2 x 476-479, column 3 x 668-671, column 4 x 860-863.
- Cheer frames 2 and 3 are lifted 2 and 4 art px (numbers above). Sleep and collapse 4-5 lie down: the lowest pixel sits on the ground line, no centre rule.
```

#### NUM(chr_elder)

```
NUMBERS - template chr_elder (docs/art/templates/chr_elder.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 2 rows of cells, each 48 x 48 art px = 240 x 240 px. Grid top-left x 48, y 272; grid 1440 x 480 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 272 + (row-1) x 240. Nothing outside the grid.
- Cells used: 10. Empty cells (stay flat #FF00FF): (5,1), (6,1).
- Row 1 idle (4 frames): lowest figure pixels on image rows y 487-491 (ground line y 492); height 40 art px = 200 px.
- Row 2 walk (6 frames): lowest figure pixels on image rows y 727-731 (ground line y 732); height 40 art px = 200 px.
- Horizontal centre (the figure's middle column): column 1 x 163-167, column 2 x 403-407, column 3 x 643-647, column 4 x 883-887, column 5 x 1123-1127, column 6 x 1363-1367.
```

#### NUM(chr_head_poses_ref)

```
NUMBERS - template chr_head_poses_ref (docs/art/templates/chr_head_poses_ref.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 10. One art pixel = one 10 x 10 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 3 columns x 1 rows of cells, each 48 x 48 art px = 480 x 480 px. Grid top-left x 48, y 272; grid 1440 x 480 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 480, y = 272 + (row-1) x 480. Nothing outside the grid.
- Cells used: 3, no empty cell.
- Row 1 head_poses (3 frames): lowest figure pixels on image rows y 702-711 (ground line y 712); height frame 1 40 art px = 400 px, frame 2 free, frame 3 free; no centre rule for frame 3.
- Horizontal centre (the figure's middle column): column 1 x 278-287, column 2 x 758-767.
```

#### NUM(chr_hair)

```
NUMBERS - template chr_hair (docs/art/templates/chr_hair.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 1 rows of cells, each 48 x 48 art px = 240 x 240 px. Grid top-left x 48, y 392; grid 1440 x 240 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 392 + (row-1) x 240. Nothing outside the grid.
- Cells used: 6, no empty cell.
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
- The placeholder figure marks the base-body position (height 40 art px = 200 px).
```

#### NUM(chr_face)

```
NUMBERS - template chr_face (docs/art/templates/chr_face.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 5 columns x 3 rows of cells, each 48 x 48 art px = 288 x 288 px. Grid top-left x 48, y 80; grid 1440 x 864 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 288, y = 80 + (row-1) x 288. Nothing outside the grid.
- Cells used: 12. Empty cells (stay flat #FF00FF): (3,3), (4,3), (5,3).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
- The placeholder figure marks the base-body position (height 40 art px = 240 px).
```

#### NUM(chr_helm)

```
NUMBERS - template chr_helm (docs/art/templates/chr_helm.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1024 x 1536 px (portrait).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 3 columns x 5 rows of cells, each 48 x 48 art px = 288 x 288 px. Grid top-left x 80, y 48; grid 864 x 1440 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 80 + (column-1) x 288, y = 48 + (row-1) x 288. Nothing outside the grid.
- Cells used: 15, no empty cell.
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
- The placeholder figure marks the base-body position (height 40 art px = 240 px).
```

#### NUM(chr_weapon)

```
NUMBERS - template chr_weapon (docs/art/templates/chr_weapon.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 3. One art pixel = one 3 x 3 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 3 rows of cells, each 80 x 64 art px = 240 x 192 px. Grid top-left x 48, y 224; grid 1440 x 576 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 224 + (row-1) x 192. Nothing outside the grid.
- Cells used: 10. Empty cells (stay flat #FF00FF): (4,2), (5,2), (6,2), (2,3), (3,3), (4,3), (5,3), (6,3).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
- The placeholder figure marks the base-body position (height 39 art px = 117 px).
- The placeholder body only marks where the hand is (body cell origin = (16,16) art px inside the 80 x 64 cell). Do NOT draw the body; draw only the weapon, gripped where the placeholder's front hand is.
```

#### NUM(npc_ref)

```
NUMBERS - template npc_ref (docs/art/templates/npc_ref.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 4 columns x 3 rows of cells, each 48 x 48 art px = 288 x 288 px. Grid top-left x 192, y 80; grid 1152 x 864 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 288, y = 80 + (row-1) x 288. Nothing outside the grid.
- Cells used: 11. Empty cells (stay flat #FF00FF): (4,3).
- Row 1 npc (4 frames): lowest figure pixels on image rows y 338-343 (ground line y 344); height free.
- Row 2 npc (4 frames): lowest figure pixels on image rows y 626-631 (ground line y 632); height free.
- Row 3 npc (3 frames): lowest figure pixels on image rows y 914-919 (ground line y 920); height free.
- Horizontal centre (the figure's middle column): column 1 x 330-335, column 2 x 618-623, column 3 x 906-911, column 4 x 1194-1199.
```

#### NUM(enm_rat)

```
NUMBERS - template enm_rat (docs/art/templates/enm_rat.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 8. One art pixel = one 8 x 8 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 4 columns x 5 rows of cells, each 32 x 24 art px = 256 x 192 px. Grid top-left x 256, y 32; grid 1024 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 256 + (column-1) x 256, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 18. Empty cells (stay flat #FF00FF): (3,4), (4,4).
- Row 1 idle (4 frames): lowest figure pixels on image rows y 184-191 (ground line y 192); height 14 art px = 112 px.
- Row 2 move (4 frames): lowest figure pixels on image rows y 376-383 (ground line y 384); height 14 art px = 112 px.
- Row 3 attack (4 frames): lowest figure pixels on image rows y 568-575 (ground line y 576); height free.
- Row 4 hit (2 frames): lowest figure pixels on image rows y 760-767 (ground line y 768); height 14 art px = 112 px.
- Row 5 exit (4 frames): lowest figure pixels on image rows y 952-959 (ground line y 960); height free.
- Horizontal centre (the figure's middle column): column 1 x 376-383, column 2 x 632-639, column 3 x 888-895, column 4 x 1144-1151.
- Keep 2 art px = 16 px empty inside every cell edge.
```

#### NUM(enm_wolf)

```
NUMBERS - template enm_wolf (docs/art/templates/enm_wolf.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 4 columns x 5 rows of cells, each 48 x 32 art px = 288 x 192 px. Grid top-left x 192, y 32; grid 1152 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 288, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 18. Empty cells (stay flat #FF00FF): (3,4), (4,4).
- Row 1 idle (4 frames): lowest figure pixels on image rows y 194-199 (ground line y 200); height 25 art px = 150 px.
- Row 2 move (4 frames): lowest figure pixels on image rows y 386-391 (ground line y 392); height 25 art px = 150 px.
- Row 3 attack (4 frames): lowest figure pixels: frame 1 y 578-583; frame 2 y 560-565; frame 3 y 578-583; frame 4 y 578-583; height free.
- Row 4 hit (2 frames): lowest figure pixels on image rows y 770-775 (ground line y 776); height 25 art px = 150 px.
- Row 5 exit (4 frames): lowest figure pixels on image rows y 962-967 (ground line y 968); height free.
- Horizontal centre (the figure's middle column): column 1 x 330-335, column 2 x 618-623, column 3 x 906-911, column 4 x 1194-1199.
- Keep 2 art px = 12 px empty inside every cell edge.
- Attack frame 2 is a leap: its lowest pixel is 3 art px higher than in the other frames (numbers above).
```

#### NUM(enm_bat)

```
NUMBERS - template enm_bat (docs/art/templates/enm_bat.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1024 x 1536 px (portrait).
- Block: S = 7. One art pixel = one 7 x 7 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 4 columns x 5 rows of cells, each 32 x 32 art px = 224 x 224 px. Grid top-left x 64, y 208; grid 896 x 1120 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 64 + (column-1) x 224, y = 208 + (row-1) x 224. Nothing outside the grid.
- Cells used: 18. Empty cells (stay flat #FF00FF): (3,4), (4,4).
- Row 1 idle (4 frames): lowest figure pixels on image rows y 320-326 (hovering: nothing below y 326; the ground line y 404 stays empty); height 14 art px = 98 px.
- Row 2 move (4 frames): lowest figure pixels on image rows y 544-550 (hovering: nothing below y 550; the ground line y 628 stays empty); height 14 art px = 98 px.
- Row 3 attack (4 frames): lowest figure pixels on image rows y 768-774 (hovering: nothing below y 774; the ground line y 852 stays empty); height free.
- Row 4 hit (2 frames): lowest figure pixels on image rows y 992-998 (hovering: nothing below y 998; the ground line y 1076 stays empty); height 14 art px = 98 px.
- Row 5 exit (4 frames): no ground rule (the row text says where the figure goes); height free.
- Horizontal centre (the figure's middle column): column 1 x 169-175, column 2 x 393-399, column 3 x 617-623, column 4 x 841-847.
- Keep 2 art px = 14 px empty inside every cell edge.
- HOVER: the bat never touches the ground. Its lowest pixel is on the lowest-pixel rows given above (art row 16 of 32), 12 art px above the ground line (art row 28). The flee row rises and has no ground rule.
```

#### NUM(enm_kobold)

```
NUMBERS - template enm_kobold (docs/art/templates/enm_kobold.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1024 x 1536 px (portrait).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 4 columns x 5 rows of cells, each 32 x 48 art px = 192 x 288 px. Grid top-left x 128, y 48; grid 768 x 1440 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 128 + (column-1) x 192, y = 48 + (row-1) x 288. Nothing outside the grid.
- Cells used: 18. Empty cells (stay flat #FF00FF): (3,4), (4,4).
- Row 1 idle (4 frames): lowest figure pixels on image rows y 306-311 (ground line y 312); height 30 art px = 180 px.
- Row 2 move (4 frames): lowest figure pixels on image rows y 594-599 (ground line y 600); height 30 art px = 180 px.
- Row 3 attack (4 frames): lowest figure pixels on image rows y 882-887 (ground line y 888); height free.
- Row 4 hit (2 frames): lowest figure pixels on image rows y 1170-1175 (ground line y 1176); height 30 art px = 180 px.
- Row 5 exit (4 frames): lowest figure pixels on image rows y 1458-1463 (ground line y 1464); height free.
- Horizontal centre (the figure's middle column): column 1 x 218-223, column 2 x 410-415, column 3 x 602-607, column 4 x 794-799.
- Keep 2 art px = 12 px empty inside every cell edge.
```

#### NUM(boss_bellwarden_a)

```
NUMBERS - template boss_bellwarden_a (docs/art/templates/boss_bellwarden_a.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 3. One art pixel = one 3 x 3 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 3 rows of cells, each 64 x 56 art px = 192 x 168 px. Grid top-left x 192, y 260; grid 1152 x 504 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 260 + (row-1) x 168. Nothing outside the grid.
- Cells used: 18, no empty cell.
- Row 1 idle (6 frames): lowest figure pixels on image rows y 422-424 (ground line y 425); height 54 art px = 162 px.
- Row 2 attack_a (6 frames): lowest figure pixels on image rows y 590-592 (ground line y 593); height free.
- Row 3 attack_b (6 frames): lowest figure pixels on image rows y 758-760 (ground line y 761); height free.
- Horizontal centre (the figure's middle column): column 1 x 285-287, column 2 x 477-479, column 3 x 669-671, column 4 x 861-863, column 5 x 1053-1055, column 6 x 1245-1247.
```

#### NUM(boss_bellwarden_b)

```
NUMBERS - template boss_bellwarden_b (docs/art/templates/boss_bellwarden_b.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 3. One art pixel = one 3 x 3 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 4 rows of cells, each 64 x 56 art px = 192 x 168 px. Grid top-left x 192, y 176; grid 1152 x 672 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 176 + (row-1) x 168. Nothing outside the grid.
- Cells used: 17. Empty cells (stay flat #FF00FF): (4,1), (5,1), (6,1), (5,2), (6,2), (5,4), (6,4).
- Row 1 hit (3 frames): lowest figure pixels on image rows y 338-340 (ground line y 341); height 54 art px = 162 px.
- Row 2 phase (4 frames): lowest figure pixels on image rows y 506-508 (ground line y 509); height 54 art px = 162 px.
- Row 3 exit (6 frames): lowest figure pixels on image rows y 674-676 (ground line y 677); height free.
- Row 4 wave_fx (4 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2, 3, 4.
- Horizontal centre (the figure's middle column): column 1 x 285-287, column 2 x 477-479, column 3 x 669-671, column 4 x 861-863, column 5 x 1053-1055, column 6 x 1245-1247.
```

#### NUM(fx_common)

```
NUMBERS - template fx_common (docs/art/templates/fx_common.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 3. One art pixel = one 3 x 3 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 8 columns x 6 rows of cells, each 48 x 48 art px = 144 x 144 px. Grid top-left x 192, y 80; grid 1152 x 864 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 144, y = 80 + (row-1) x 144. Nothing outside the grid.
- Cells used: 32. Empty cells (stay flat #FF00FF): (5,1), (6,1), (7,1), (8,1), (7,2), (8,2), (5,3), (6,3), (7,3), (8,3), (5,5), (6,5), (7,5), (8,5), (7,6), (8,6).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
```

#### NUM(prop_anim_a)

```
NUMBERS - template prop_anim_a (docs/art/templates/prop_anim_a.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 4. One art pixel = one 4 x 4 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 5 rows of cells, each 48 x 48 art px = 192 x 192 px. Grid top-left x 192, y 32; grid 1152 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 18. Empty cells (stay flat #FF00FF): (5,1), (6,1), (5,3), (6,3), (3,4), (4,4), (5,4), (6,4), (3,5), (4,5), (5,5), (6,5).
- Row 1 campfire (4 frames): lowest figure pixels on image rows y 204-207 (ground line y 208); height free.
- Row 2 loot_sack (6 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2, 3, 4, 5, 6.
- Row 3 star_spring (4 frames): lowest figure pixels on image rows y 588-591 (ground line y 592); height free.
- Row 4 chest (2 frames): lowest figure pixels on image rows y 780-783 (ground line y 784); height free.
- Row 5 door (2 frames): lowest figure pixels on image rows y 972-975 (ground line y 976); height free.
- Horizontal centre (the figure's middle column): column 1 x 284-287, column 2 x 476-479, column 3 x 668-671, column 4 x 860-863.
```

#### NUM(prop_anim_b)

```
NUMBERS - template prop_anim_b (docs/art/templates/prop_anim_b.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 4. One art pixel = one 4 x 4 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 5 rows of cells, each 48 x 48 art px = 192 x 192 px. Grid top-left x 192, y 32; grid 1152 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 10. Empty cells (stay flat #FF00FF): (3,1), (4,1), (5,1), (6,1), (3,2), (4,2), (5,2), (6,2), (3,3), (4,3), (5,3), (6,3), (3,4), (4,4), (5,4), (6,4), (3,5), (4,5), (5,5), (6,5).
- Row 1 spike_trap (2 frames): lowest figure pixels on image rows y 204-207 (ground line y 208); height free.
- Row 2 minecart (2 frames): lowest figure pixels on image rows y 396-399 (ground line y 400); height free.
- Row 3 lantern (2 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2.
- Row 4 book (2 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2.
- Row 5 exclaim_bubble (2 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2.
- Horizontal centre (the figure's middle column): column 1 x 284-287, column 2 x 476-479.
```

#### NUM(prop_misc)

```
NUMBERS - template prop_misc (docs/art/templates/prop_misc.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 4 rows of cells, each 48 x 48 art px = 240 x 240 px. Grid top-left x 48, y 32; grid 1440 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 32 + (row-1) x 240. Nothing outside the grid.
- Cells used: 15. Empty cells (stay flat #FF00FF): (3,1), (4,1), (5,1), (6,1), (5,2), (6,2), (4,4), (5,4), (6,4).
- Row 1 zz (2 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2.
- Row 2 ground_singles (4 frames): lowest figure pixels on image rows y 487-491 (ground line y 492); height free.
- Row 3 held_singles_a (6 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2, 3, 4, 5, 6.
- Row 4 held_singles_b (3 frames): no ground rule (the row text says where the figure goes); height free; no centre rule for frame 1, 2, 3.
- Horizontal centre (the figure's middle column): column 1 x 163-167, column 2 x 403-407, column 3 x 643-647, column 4 x 883-887.
```

#### NUM(ui_icon_12)

```
NUMBERS - template ui_icon_12 (docs/art/templates/ui_icon_12.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 20. One art pixel = one 20 x 20 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 3 rows of cells, each 12 x 12 art px = 240 x 240 px. Grid top-left x 48, y 152; grid 1440 x 720 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 152 + (row-1) x 240. Nothing outside the grid.
- Cells used: 15. Empty cells (stay flat #FF00FF): (4,3), (5,3), (6,3).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
```

#### NUM(ui_icon_16)

```
NUMBERS - template ui_icon_16 (docs/art/templates/ui_icon_16.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 11. One art pixel = one 11 x 11 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 8 columns x 4 rows of cells, each 16 x 16 art px = 176 x 176 px. Grid top-left x 64, y 160; grid 1408 x 704 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 64 + (column-1) x 176, y = 160 + (row-1) x 176. Nothing outside the grid.
- Cells used: 27. Empty cells (stay flat #FF00FF): (8,2), (7,3), (8,3), (7,4), (8,4).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
```

#### NUM(por_npc_64)

```
NUMBERS - template por_npc_64 (docs/art/templates/por_npc_64.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 4 columns x 3 rows of cells, each 64 x 64 art px = 320 x 320 px. Grid top-left x 128, y 32; grid 1280 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 128 + (column-1) x 320, y = 32 + (row-1) x 320. Nothing outside the grid.
- Cells used: 11. Empty cells (stay flat #FF00FF): (4,3).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
```

#### NUM(por_npc_48)

```
NUMBERS - template por_npc_48 (docs/art/templates/por_npc_48.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 4 columns x 3 rows of cells, each 48 x 48 art px = 288 x 288 px. Grid top-left x 192, y 80; grid 1152 x 864 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 288, y = 80 + (row-1) x 288. Nothing outside the grid.
- Cells used: 11. Empty cells (stay flat #FF00FF): (4,3).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
```

#### NUM(por_parts_64)

```
NUMBERS - template por_parts_64 (docs/art/templates/por_parts_64.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 3. One art pixel = one 3 x 3 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 5 rows of cells, each 64 x 64 art px = 192 x 192 px. Grid top-left x 192, y 32; grid 1152 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 25. Empty cells (stay flat #FF00FF): (6,2), (5,3), (6,3), (5,4), (6,4).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
```

#### NUM(por_parts_48)

```
NUMBERS - template por_parts_48 (docs/art/templates/por_parts_48.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 4. One art pixel = one 4 x 4 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 5 rows of cells, each 48 x 48 art px = 192 x 192 px. Grid top-left x 192, y 32; grid 1152 x 960 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 192 + (column-1) x 192, y = 32 + (row-1) x 192. Nothing outside the grid.
- Cells used: 25. Empty cells (stay flat #FF00FF): (6,2), (5,3), (6,3), (5,4), (6,4).
- No ground-line or centre numbers: keep each drawing where the row text or the placeholder puts it, fully inside its cell.
```

#### NUM(bg_far)

```
NUMBERS - template bg_far (docs/art/templates/bg_far.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Strip: 1 panel(s) of 256 x 64 art px = 1536 x 384 px each, filling x 0-1535, y 320-703. Outside the strip everything is flat #FF00FF.
- Ground line: art row 56 of 64 = image y 656; one straight horizontal line.
- Fill the whole strip: every pixel inside it is painted (opaque).
```

#### NUM(bg_mid)

```
NUMBERS - template bg_mid (docs/art/templates/bg_mid.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Strip: 1 panel(s) of 256 x 64 art px = 1536 x 384 px each, filling x 0-1535, y 320-703. Outside the strip everything is flat #FF00FF.
- Ground line: art row 56 of 64 = image y 656; one straight horizontal line.
- Only middle-layer objects inside the strip; the sky and far areas inside the strip stay flat #FF00FF.
```

#### NUM(bg_near)

```
NUMBERS - template bg_near (docs/art/templates/bg_near.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 6. One art pixel = one 6 x 6 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Strip: 1 panel(s) of 256 x 64 art px = 1536 x 384 px each, filling x 0-1535, y 320-703. Outside the strip everything is flat #FF00FF.
- Ground line: art row 56 of 64 = image y 656; one straight horizontal line.
- Only the near layer; every pixel from the ground line down to the strip bottom is painted.
```

#### NUM(scene_event)

```
NUMBERS - template scene_event (docs/art/templates/scene_event.json). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 3. One art pixel = one 3 x 3 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Strip: 4 panel(s) of 128 x 64 art px = 384 x 192 px each, filling x 0-1535, y 416-607. Outside the strip everything is flat #FF00FF.
- Panel left edges at x 0, 384, 768, 1152.
- Ground line: art row 56 of 64 = image y 584; one straight horizontal line.
- Each panel is one opaque scene edge to edge; panels touch with no gap or divider line.
```

#### NUM(chr_walk12) — 임시

```
NUMBERS - template chr_walk12 (computed by art:template for rows walk,walk; same geometry as chr_elder). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 2 rows of cells, each 48 x 48 art px = 240 x 240 px. Grid top-left x 48, y 272; grid 1440 x 480 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 272 + (row-1) x 240. Nothing outside the grid.
- Cells used: 12, no empty cell.
- Row 1 walk (6 frames): lowest figure pixels on image rows y 487-491 (ground line y 492); height 40 art px = 200 px.
- Row 2 walk (6 frames): lowest figure pixels on image rows y 727-731 (ground line y 732); height 40 art px = 200 px.
- Horizontal centre (the figure's middle column): column 1 x 163-167, column 2 x 403-407, column 3 x 643-647, column 4 x 883-887, column 5 x 1123-1127, column 6 x 1363-1367.
- INTERIM: chr_walk12 is not in specs.json yet. Attach docs/art/templates/chr_elder.grid.png (the same grid, byte for byte) and gate with --spec chr_elder --rows walk:6,walk:6.
```
