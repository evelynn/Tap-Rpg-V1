# P2_world — 세계 쪽 에셋 프롬프트 (적·보스·배경·장소 소품·날씨·효과·소품·아이콘·책 UI·초상)

버전 1.1 · 2026년 9월 24일 · 대상: 이미지 생성 모델을 쓰는 제작 AI
1.1: PROMPTS v1.2 정합 — D-BG를 PROMPTS §1로 옮김, 표시용 D-MARK 추가, SW에 색 유지 문장, NPC 정체성 블록(NB)을 PROMPTS §7로 합치고 NPC 초상은 NPC 전신 기준 시트 `n01`에서 만듦, 호각은 나무, 같은 소품의 색을 카드(AO-19·49·50)에 맞춤, 진행표·확인 필요를 PROMPTS §6.3·`OPEN_DECISIONS.md`로 옮김.
상위 문서: `docs/art/PROMPTS.md` v1.2(이하 **PROMPTS**). 공통 블록 A~E·D-BG·S, 떼기 머리말 X(§3.2), 육안 기준 E1~E12·E21, NPC 외형(§7)은 PROMPTS에 있고 여기서 다시 적지 않는다. 색인·전체 제작 순서는 PROMPTS §5, 진행표는 PROMPTS §6.3이다. 캐릭터 쪽은 `P1_character.md`(이하 **P1**), 이벤트 장면 20개는 `P3_scenes.md`(이하 **P3**)가 가진다.
제작 방식은 `ASSET_ORDERS.md` §0.0(D56): 이미지 생성·편집만 쓰고, 코드로 그리기·자르기·축소·배경 제거·복제를 하지 않는다. 규칙·수치는 `docs/design/15_아트_스프라이트_사양.md`(이하 **15**)가 소유한다. 카드 안 프롬프트보다 이 문서가 우선한다. 카드(AO-xx)와 15가 다른 곳은 `docs/art/OPEN_DECISIONS.md`(옛 번호 `P2-17-n`)에 있고, 적어 둔 처리안으로 진행한다.

---

## 0 범위와 쓰는 법

### 0.1 범위

15 §13.1에서 **캐릭터 소계(388)와 이벤트 장면(80, P3)을 뺀 나머지 전부**다. P0에서 이미 PROMPTS가 가진 것(들쥐 EN01 48 `08-rat18-48-r3` 합격, 들판 3층 AO-39 §3.5, 책 AO-49 2칸, 그림자 AO-01)은 다시 쓰지 않고 입력으로만 쓴다.

| 묶음 | 15 §13.1 | 카드 | 이 문서 절 |
| --- | --- | --- | --- |
| 적 4계열 · 적 소품 · 변형·정예 | 72 · 22 | AO-31~36 | §2 |
| 보스 EB03 | 35 | AO-37·38 | §3 |
| 배경 타일 · 점등 겹침 | 10장 | AO-39~42 | §4 |
| 배경 장소 소품 | 약 20 → **20 확정안** | AO-43 | §5 |
| 날씨 | (8.3 날씨 입자) | AO-45 | §6 |
| 공용 효과 6종 | 32 | AO-46~48 | §7 |
| 소품 24종 | 43 | AO-49·50 | §8 |
| UI 아이콘 | 42 | AO-51~54 | §9 |
| 아이템 아이콘(15에 없음, 카드 신규) | — | AO-55~58 | §10 |
| 책 UI 부품 | 3 | AO-59 | §11 |
| 초상(부품 25 + NPC 11) × 2크기 | 72 | AO-60~62 | §12 |

- 팔레트·변환표(AO-36·44 등)와 `fx_lantern_glow`(P1 c20)는 여기서 그리지 않는다. 계절·낮밤은 **변환표(LUT)로 처리하므로 기본 팔레트 그림 한 벌만** 만든다(15 §8.3).

### 0.2 이 문서의 다섯 가지 요청

| 종류 | 무엇 | 조립 |
| --- | --- | --- |
| **생성** | 계열 기준 시트, 합성 장면, 새 소품·효과·아이콘 | A(또는 A-UI·A-POR) + 정체성 블록 + C 계열 + 본문 + D 계열 |
| **교체 편집** | 합격한 시트를 입력으로 넣고 **색을 바꾸거나 부품을 더한다**(변형·정예·상태·장소 소품·점등) | SW + 문장 + D 계열 |
| **떼기** | 합성 결과에서 **그 부품·층만 남긴다**. 보이는 화소만 | X(= PROMPTS §3.2 머리말) + 떼기 문장 |
| **밀도 편집** | 32 규격(PROMPTS E) 또는 초상 48 판(E-POR) | E 또는 E-POR |
| **상태 편집** | 닫힘 → 열림처럼 **바뀌는 부분만** 다시 그린다 | SW + 문장 + D 계열 |

원칙은 PROMPTS §0.2와 같다. **같은 이미지에서 나온 것끼리만 위치가 맞는다.** 그래서
- 적 변형·정예 소품은 계열 기준 시트를 **편집**해 입히고, 입힌 결과에서 **뗀다**(계열 시트와 칸이 맞는다).
- 배경 층·점등 겹침·장소 겹침(폐허·폐광 D2·D3)은 **한 장의 합성 장면**에서 뗀다.
- 장소 소품은 기본 장면에 **더하는 편집**으로 그려 크기·색·접지를 장면에 맞춘 뒤 뗀다.
- 두 상태 소품(상자·문·함정 등)은 첫 상태를 생성하고 **상태 편집**으로 둘째 상태를 만든다.

### 0.3 저장

PROMPTS §0.3 그대로. 파일 이름은 `assets/_imagegen/{판}/w{번호}-{이름}-{규격}.png`(w = world)와 같은 이름 `.prompt.txt`. 번호는 §14 제작 순서표의 번호다. 떼어 낸 결과는 `README.md`에 **어느 합성에서 뗐는지** 적는다.

### 0.4 규격

P1 이후는 O02가 채택한 한 규격만 만든다(`ASSET_ORDERS.md` §1.1). 이 문서의 프롬프트는 **48 규격 기준**이다. 32가 채택되면 합격한 48 시트에 PROMPTS §1 E를 적용하고, 들쥐 문장 자리를 다음으로 바꾼다: 늑대 `the wolf body is about 18 blocks tall`, 박쥐 `the bat torso is 8 by 8 blocks`, 코볼트 `the kobold is about 21 blocks tall`, 보스 `the warden is about 38 blocks tall`. 배경·아이콘·초상은 규격 구분이 없다(초상은 64와 48을 둘 다 만든다, §12).

### 0.5 게임 쪽 정규화가 맡는 것 (D56)

제작 AI는 하지 않는다. 프롬프트가 이것을 대신하려고 억지 수치를 요구하지 않는다.

| 정규화 | 내용 |
| --- | --- |
| 자홍 키 | `#FF00FF`를 투명으로(`imagegen.map.json` key·tolerance) |
| 격자·정렬 | 칸 나누기, 지면선·가로 중심 맞춤(`align`), 장소 소품·효과의 bbox 자르기 |
| 색 | 등록 팔레트로 양자화, 인덱스 배정(표지 색 → 전용 인덱스, P1 §1.5와 같은 방식) |
| 알파 | 2값화. 반투명이 허용된 파일(그림자·빛 원·안개)은 **불투명으로 받은 뒤** 알파를 준다 |
| 팔레트·변환표 | 변형 팔레트 12, 계절·낮밤 LUT 16, 장소 팔레트(§17-15), 책등 3 |
| 가로 이음 | A17 검사. 어긋나면 §17-17 처리 |

---

## 1 세계 공통 블록 (PROMPTS §1에 더함)

PROMPTS의 A·C·D는 캐릭터 시트용 문장이 섞여 있다(C는 정사각 칸·발바닥, D는 `landscape or scenery`·`magic effects`·`speech bubbles` 금지, A 첫 줄은 `not a UI`). 배경·효과·아이콘·초상·표시에서 그대로 쓰면 요청과 금지가 부딪힌다(`OPEN_DECISIONS.md` OD-63). 아래 변형은 **해당 문장만 바꾼 판**이다. 표에 없는 경우는 PROMPTS 블록을 그대로 쓴다. 블록 이름 등록은 PROMPTS §5.1.

### 1.1 A 변형 — 첫 줄만 바꾼다 (둘째·셋째 줄 PIXEL LANGUAGE·금지 문장은 A 그대로)

| 블록 | 쓰는 곳 | 첫 줄 |
| --- | --- | --- |
| A | 적·보스·효과·소품·배경 | PROMPTS A 그대로. `{48x48}` 자리에 논리 캔버스(적은 계열 셀, 배경 `256x64`) |
| A-UI | UI·아이템 아이콘·책 UI | `Asset type: Tap RPG pixel-art icon sheet for a tiny game HUD. These are real in-game pixel icons, not a UI mockup, screenshot, diagram or poster. Icons also use the one-block dark plum #2B2233 outline.` |
| A-POR | 초상 | `Asset type: Tap RPG pixel-art portrait sheet of front-facing head-and-shoulders busts. These are real in-game portrait assets, not an illustration, poster or painting.` |

### 1.2 C 변형

**C-E 적 칸(정사각이 아닌 셀)**

```
LAYOUT: exactly {N} sprites in exactly {COLS} equal columns and {ROWS} equal rows of identical cells, each cell {W}:{H} (width to height), evenly spaced, reading order left to right then next row. {EMPTY_CELLS}
One pose per cell. Every sprite is entirely inside its own cell with clear empty margins; nothing crosses into a neighbouring cell. Same drawing scale in every cell, except where a pose line says the creature gets smaller while escaping. Every sprite's lowest paw or foot sits on the SAME local ground line in its cell, {G} of the cell height above the cell bottom, except where a pose line lifts it; no ground line is drawn.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the sprites, the exact same value in every pixel. Never a brown, dark or coloured backdrop, never a vignette, spotlight, halo, glow ring, gradient or drawn checkerboard.
```

**C-FX 효과 칸**

```
LAYOUT: exactly {N} frames of one effect in {COLS} equal columns and {ROWS} equal rows of identical square cells, reading order left to right then next row. {EMPTY_CELLS} The effect's anchor point is at the SAME position in every cell: {ANCHOR}. Everything stays inside its own cell with a clear empty margin. Same pixel-block size in every cell.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the effect, the exact same value in every pixel. No vignette, halo, glow ring or gradient.
```

**C-PROP 소품 칸** — 입력 이미지로 마스터(`02-ref-b-actions18-48-r4.png`)를 **크기 기준**으로 넣는다.

```
LAYOUT: exactly {N} props in {COLS} equal columns and {ROWS} equal rows of identical square cells, one prop per cell, reading order left to right then next row. {EMPTY_CELLS} Each prop is drawn at the true size it would have next to the character in the input image, whose standing height is about four fifths of a cell. Each prop is centred horizontally and its lowest pixel rests on the same local ground line about 10% above the cell bottom, unless its line says it floats. Nothing touches the cell edge.
Input image role: size and pixel-style reference only. Do not draw the character.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the props, the exact same value in every pixel. No vignette, halo, glow ring, gradient or ground shadow.
```

**C-ICON 아이콘 칸**

```
LAYOUT: exactly {N} icons in {COLS} equal columns and {ROWS} equal rows of identical square cells; each cell is one {S}x{S} logical pixel canvas. {EMPTY_CELLS} Each icon is centred in its cell, fills most of it and leaves a one-block empty margin on every side. Same block size in every cell.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the icons, the exact same value in every pixel. No backing plate, badge, vignette, halo or gradient.
```

**C-POR 초상 칸**

```
LAYOUT: exactly {N} portraits in {COLS} equal columns and {ROWS} equal rows of identical square cells; each cell is one {S}x{S} logical pixel canvas. {EMPTY_CELLS} Each portrait is a front-facing head-and-shoulders bust. The shoulders end on one flat horizontal line one block above the cell bottom, the same line in every cell; the head is centred horizontally; the eyes sit at the same height in every cell, a little above the middle of the cell. Same scale in every cell.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the busts, the exact same value in every pixel. No backdrop, vignette, halo or gradient.
```

**C-BG 배경 띠** (PROMPTS §3.5의 띠 문장 + 배경 외곽선 규칙을 한 블록으로)

```
LAYOUT: a single wide horizontal pixel-art strip with an exact 4:1 aspect ratio, filling the full canvas width and placed in the vertical middle of the canvas; the area above and below the strip is one flat #FF00FF color. The strip is one side-view scene, logically 256 blocks wide and 64 blocks high. The walkable ground surface is one perfectly straight horizontal line at 7/8 of the strip height. The top quarter holds only flat sky or plain wall. Landmarks stand in the left 47% of the strip; the right half is quiet and low in detail. The leftmost and rightmost columns continue into each other so the strip tiles: no object touches or crosses the left or right edge, and the horizon and the ground meet both edges at the same height and colour.
BACKGROUND OUTLINES: no dark outlines at all. Edges of each shape use a slightly darker shade of the same hue; nothing darker than {DARKEST}. Flat, soft, low contrast; the scene is evenly lit.
```

**C-FREE 자유 배치** (크기가 서로 다른 물체 몇 개를 한 장에)

```
LAYOUT: {N} separate objects placed left to right with wide empty gaps between them, all drawn with the SAME pixel-block size, their bottoms on one common baseline. No cells, no borders.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the objects, the exact same value in every pixel. No vignette, halo or gradient.
```

### 1.3 D 변형

| 블록 | 쓰는 곳 | 문장 |
| --- | --- | --- |
| D | 적·보스·소품·초상 | PROMPTS D 그대로 |
| D-BG | 배경 합성·장소 편집 | PROMPTS §1 D-BG(v1.2에서 옮겼다. PROMPTS §3.5 들판도 이것을 쓴다) |
| D-FX | 효과·날씨 | `Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, scenery, characters, creatures, blood, wounds, soft glow, bloom, blur, gradients, semi-transparent pixels. Output only the finished effect sheet.` |
| D-UI | 아이콘·책 UI | `Do NOT draw: text, letters, numbers, labels, arrows unless an icon line asks for one, grid lines, cell borders, panel frames, backing plates, drop shadows, glow, gradients, watermark. Output only the finished icon sheet.` |
| D-MARK | 떠 있는 표시(w22b 느낌표 말풍선·잠 표시) — D의 `speech bubbles`가 말풍선 요청과 부딪혀서 뺀 판 | `Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, magic effects, motion trails, characters, bodies, hands. The exclamation mark is a plain drawn symbol, not a letter. Output only the finished sprite sheet.` |

### 1.4 편집 머리말

**SW 교체·상태 편집 머리말** (P1의 S를 세계 에셋용으로 일반화)

```
Use case: precise edit of the provided image. Keep the exact canvas, the exact cell layout or strip, the flat #FF00FF background and the exact position, size, pose and outline of everything that already exists. Change ONLY what is listed below, in every cell unless cells are named. Every other pixel stays exactly as in the input, with its exact colour, except where a new part now covers it; never recolour, relight, brighten, darken or saturate anything that is not listed. Same pixel-block size, palette mood and outline style as the input. No gradient, no halo, no glow, no extra objects, no new poses. Empty cells stay empty.
```

**X 떼기 머리말** = PROMPTS §3.2 공통 머리말 그대로(P1과 같은 이름). 떼기·교체 합격 기준에는 늘 E21(색 유지)을 함께 본다.

**E-POR 초상 48 판 밀도 편집**

```
Use case: edit of the provided portrait sheet. Redraw the SAME sheet at a coarser pixel density, as if every cell were a 48x48 logical canvas instead of 64x64: every pixel block is one third larger than in the input. Same person in every cell, same expression, same colours, same cell layout and framing, same flat #FF00FF background. Keep every eye and mouth the same number of blocks as in the input (round eyes two blocks wide and three tall, narrow eyes two wide and one tall, mouth two wide); turn thin details (wrinkles, cords, small jewellery) into single blocks or leave them out. Re-place every block on the coarser grid; never blur or smooth.
```

**R-EN 적 배치 참고 입력** (적 기준 시트를 생성할 때, 들쥐 합격본 `v03/08-rat18-48-r3.png`를 입력으로 넣고 본문 앞에)

```
Input image role: layout and pixel-style reference only. Copy its grid (four columns, five rows, row 4 holding two sprites and two empty cells), its even cell spacing, its flat magenta background, its outline weight and its pixel-block size. Do NOT draw a rat and do not copy its poses.
```

---

## 2 적 (AO-31~36, 15 §7.1·7.2)

### 2.0 공통

| 계열 | 셀 48 (W:H) | 몸 높이 / 셀 | C-E `{G}` | 참고 |
| --- | --- | --- | --- | --- |
| 들쥐 EN01·02 | 32 × 24 (4:3) | 15 / 24 | 1/6 | **P0 합격**(`08-rat18-48-r3`). 기준 시트로 쓴다 |
| 늑대 EN03·04 | 48 × 32 (3:2) | 26 / 32 | 1/8 | §2.1 |
| 박쥐 EN05~07 | 32 × 32 (1:1) | 몸통 12 × 12, 지면 위 12 부양 | 1/8(지면선) | §2.2 |
| 코볼트 EN08~10·EB01·02 | 32 × 48 (2:3) | 30 / 48 (주인공 38의 0.8) | 1/12 | §2.3 |

- 시트는 모두 **4열 × 5행, 4행은 2칸 + 빈 칸 2**(들쥐와 같다). C-E의 `{N}=18, {COLS}=4, {ROWS}=5, {EMPTY_CELLS}=Row 4 holds two sprites in its first two cells; its last two cells stay completely empty.`
- 행과 시간(15 §7.1): 1 대기 200 × 4 반복 / 2 이동 120 × 4 반복 / 3 공격 100·80·100·160 / 4 피격 70·150 / 5 퇴장 120 × 4.
- 적은 **왼쪽**을 본다. 퇴장은 **달아남**이다(쓰러짐·죽음 금지, 02 §7). 달아날 때만 오른쪽으로 돌아선다.
- 조립(생성): A(`{계열 셀}`) + R-EN + 정체성 블록(I-…) + C-E + 본문 + D. 입력 = 들쥐 합격본(배치 참고).
- 적 1스프라이트 12색 이내(15 §2.2). 각 정체성 블록의 PALETTE ONLY가 그 목록이다.
- 32 규격이 채택되면 §0.4.

### 2.1 늑대 기준 시트 (AO-32, EN03 팔레트) — w01

**I-WOLF**

```
SUBJECT AND IDENTITY: the same chibi river wolf in every cell, a four-legged canine seen from the side, FACING LEFT. Big round head about two fifths of the body length, two tall pointed ears, short muzzle, small amber eyes, a fluffy cream chest ruff, a thick bushy tail, sturdy short legs. A cute storybook game enemy, never realistic, never a fox or a standing figure. Standing height about four fifths of the cell height. Keep ear size, ruff, tail and proportions identical in every cell.
PALETTE ONLY: outline #2B2233; fur #8A96A6 #6C6A70; chest ruff #F0E6CC; inner ear #A0664A; eyes #FFE38A; teeth #F0E6CC; at most three blocks of #B04A42 inside an open mouth. The chest ruff is one clearly separate flat cream shape.
```

본문:

```
ROW 1 IDLE, 4 frames, 200 ms each: 1 standing; 2 breathe in, chest one block higher; 3 exactly the same as 1; 4 one ear twitches back.
ROW 2 MOVE, 4 frames, 120 ms each, trotting in place: 1 near forepaw forward, far hind paw back; 2 body one block lower, legs gathering; 3 opposite legs forward; 4 body one block higher, legs passing. Planted paws never slide.
ROW 3 ATTACK, 4 frames, 100/80/100/160 ms, a lunging bite to the left: 1 crouch, head low; 2 leap, all paws three blocks above the ground line; 3 bite, jaws open forward; 4 land back on the ground line.
ROW 4 HIT, 2 frames, 70/150 ms: 1 flinch, eyes squeezed shut; 2 recoil one block to the right. Then two empty cells.
ROW 5 FLEE, 4 frames, 120 ms each, running away to the RIGHT: 1 turns to face right; 2 tail tucked tightly under the belly, silhouette clearly narrower; 3 leaping away, tail still tucked; 4 a smaller escaping wolf, about half size. Frightened and cute, never hurt, lying down or defeated.
No tongue, no blood, no ground, no dust, no speed lines.
```

- 합격: E1 E3(공격 2칸 제외) E4 E5 E6 E7 E11 + W1 W2. 공격 2칸만 발이 뜬다. 퇴장 2~4칸은 1칸보다 좁다(AO-32).

### 2.2 박쥐 기준 시트 (AO-33, EN05 팔레트) — w02

**I-BAT** — 날개막 3색과 눈 색은 **박쥐의 다른 곳에 쓰지 않는 색**으로 둔다. 게임 정규화가 그 색을 인덱스 5·6·7·12로 옮겨 EN06·EN07 팔레트를 바꾼다(AO-33·36, P1 §1.5 표지 색과 같은 방식). EN05의 막·눈 색은 카드에 값이 없어 제안값이다(§17-5).

```
SUBJECT AND IDENTITY: the same chibi cave bat in every cell, FACING LEFT. A compact round torso about three eighths of the cell wide and tall, two big rounded ears, tiny feet, two small bright eyes, and two membrane wings with three finger ribs each. The torso has IDENTICAL size and shape in all eighteen cells and stays at the same place unless a pose line moves it; only the wings change. It hovers: the torso's lowest block is at the vertical middle of the cell, and nothing touches the lower quarter of the cell.
PALETTE ONLY: outline #2B2233; body #7A5A6E #3A3050; wing membrane in three flat tones #9A8A78 #6E5A48 #4A3F55 used ONLY on the wings; eyes #FFE38A used ONLY on the eyes; teeth #F0E6CC.
```

본문:

```
ROW 1 IDLE, 4 frames, 200 ms each: wings fully up; wings half down; wings fully down; wings half up.
ROW 2 MOVE, 4 frames, 120 ms each: the same four wing positions with the body tilted slightly forward to the left; the torso stays in place.
ROW 3 ATTACK, 4 frames, 100/80/100/160 ms: 1 wings swept back, anticipation; 2 dash: wings folded, torso three blocks further left; 3 bite, small mouth open; 4 back to the idle position.
ROW 4 HIT, 2 frames, 70/150 ms: 1 flinch, eyes shut, wings jerk up; 2 pushed one block right. Then two empty cells.
ROW 5 FLEE, 4 frames, 120 ms each, flying away up and to the right: 1 turning right and rising four blocks; 2 rising four more blocks; 3 smaller, about three quarters size; 4 about half size, near the top of the cell.
No blood, no shadow on the ground, no speed lines.
```

- 부양 표시용 그림자는 그리지 않는다. 게임이 발밑 그림자(AO-01)를 지면선에 놓는다(§17-4).
- 합격: E1 E4 E5 E6 E7 E11 + W1 W2. 18칸 몸통 크기가 같다(퇴장 3·4 제외). 대기·이동 인접 칸의 날개가 뚜렷이 다르다(1차 S4 문제).

### 2.3 코볼트 합성 시트 → 몸체·곡괭이 떼기 (AO-34·35, EN08 팔레트) — w03·w04

AO-34는 「곡괭이를 그리지 않고 손 위치만」 생성하라고 했지만, 따로 생성한 곡괭이는 손에 맞지 않는다(PROMPTS §0.2와 같은 문제). **곡괭이를 든 합성 시트를 먼저 만들고 몸체와 곡괭이를 뗀다**(§17-9). 입력 = 들쥐 합격본(배치) + 마스터(키 비교).

**I-KOBOLD**

```
SUBJECT AND IDENTITY: the same small chibi kobold in every cell, a cave-dwelling little creature standing on two legs, FACING LEFT in a slight three-quarter side view. Big round head almost half its height, short blunt snout, two long pointed ears sweeping backward, round dark eyes, yellow-green skin, a brown sleeveless vest, a dark belt, a cream belly, bare three-toed feet, no tail. It is about four fifths as tall as the adventurer in the second input image. It carries a miner's pickaxe LONGER than its own height: small grey iron head, brown wooden haft. Keep head, ears, vest and pickaxe identical in every cell.
PALETTE ONLY: outline #2B2233; skin #9AA85A #6E7A5A; vest #8E5E38; belt #5E3C24; belly #C8C2B8; eyes #2B2233; pickaxe head #7D7B80 #4C4A52; haft #C08A58 #8E5E38.
```

본문(w03 생성):

```
Second input image role: height reference only; do not draw that character.
ROW 1 IDLE, 4 frames, 200 ms each, the pickaxe resting on the shoulder in the same grip in all four: 1 stand; 2 breathe, chest one block up; 3 same as 1; 4 sniff, snout one block forward.
ROW 2 MOVE, 4 frames, 120 ms each, walking in place, pickaxe still on the shoulder: 1 near foot forward; 2 body one block lower; 3 far foot forward; 4 body one block higher.
ROW 3 ATTACK, 4 frames, 100/80/100/160 ms, overhead swing to the left: 1 pickaxe raised behind the head; 2 top of the swing; 3 smashes down in front, pickaxe head near the ground line; 4 back to the shoulder grip. If a raised pickaxe would leave the cell, crouch one or two blocks and tilt the haft to 45 degrees; never shorten the pickaxe.
ROW 4 HIT, 2 frames, 70/150 ms: 1 flinch, eyes squeezed; 2 recoil one block right. Then two empty cells.
ROW 5 FLEE, 4 frames, 120 ms each: 1 trips and sits down hard; 2 pushes up with one hand; 3 stands, turned to the RIGHT; 4 runs away to the right hugging the pickaxe. Comic and cute, never hurt or left lying.
```

떼기(w04, 입력 = 합격한 w03):

| 결과 | 떼기 문장(X 뒤) |
| --- | --- |
| `enm_kobold` 몸체 18 | `Remove the pickaxe entirely (iron head and wooden haft). Where the haft crossed in front of the kobold, continue the kobold's own existing colours across that small gap and nothing else; the hands keep their gripping shape, empty.` |
| `enm_prop_kobold_pickaxe` 18 → 게임이 공격 4 + 쥠 1(대기 1칸)을 고른다 | `Keep ONLY the pickaxe in each cell (iron head and wooden haft). Remove the kobold entirely, including the hands holding it.` |

- 몸체 떼기의 「가려진 틈 잇기」는 PROMPTS §3.5 먼 층과 같은 예외다(떼어 낸 몸체가 구멍 난 채 쓰일 수 없어서). 틈은 자루 폭(1~2블록)만 허용한다.
- 합격: w03 E1 E3 E4 E5 E6 E7 E11 + W1 W2, 곡괭이가 몸보다 길다. w04 E8 E10 E11, 몸체 칸에 금속·나무 색이 남지 않는다.

### 2.4 변형·정예 — 교체 편집 → 떼기 (AO-35·36, 15 §7.2) — w05~w08

15 §7.2의 변형은 **크기를 바꾸지 않고 팔레트와 소품으로만** 구분한다. 게임 파일은 계열 시트 1장 + 팔레트 JSON + 소품 레이어다. 여기서 만드는 교체 편집본은 두 가지로 쓴다: ① 소품을 **계열 시트와 같은 칸에서 떼는 원본** ② 게임이 만들 변형 팔레트의 **색 목표(검토용)**. 편집본 자체를 게임 시트로 쓰지 않는다.

조립: SW + 문장 + D. 입력 = 합격한 계열 시트(들쥐 `08-rat18-48-r3`, w01, w02, w03).

| 번호 | 적 | 입력 | 교체 문장 (SW 뒤) | 떼기 (X 뒤) → 결과 |
| --- | --- | --- | --- | --- |
| w05 | EN02 큰 들쥐 | 들쥐 | `Recolour the fur: #9A8A78 becomes #6E5A48 and #6E5A48 becomes #4A3F55. On the NEAR ear only, draw a torn nick: a small V-shaped notch drawn as a dark #2B2233 line inside the ear's existing outline; the outer ear outline stays unchanged. The same nick in every cell.` | `Keep ONLY the near ear, including its nick, pixel for pixel.` → `enm_prop_rat_ear` 18(게임이 2자세를 고른다, §17-8) |
| w06a | EN04 잿빛 늑대 | w01 | `Recolour the fur: #8A96A6 becomes #6C6A70 and #6C6A70 becomes #4C4A52. The cream chest ruff #F0E6CC becomes light grey #B4B2B0.` | 떼기 없음. 팔레트 목표·검토용 |
| w06b | EN06 쇳소리 박쥐 | w02 | `Recolour ONLY the wing membranes: #9A8A78 becomes #E8E6E0, #6E5A48 becomes #B4B2B0, #4A3F55 becomes #7D7B80, so the wings look like thin sheets of metal.` | 떼기 없음. 검토용 |
| w06c | EN07 그림자 박쥐 | w02 | `Recolour the body: #7A5A6E becomes #3A3050 and #3A3050 becomes #2E2438. The eyes become pale moonlight blue #B9C8FF.` | 떼기 없음. 검토용 |
| w07a | EN09 코볼트 광부장 | w03 | `Recolour the skin: #9AA85A becomes #C8783A and #6E7A5A becomes #B0603A. Add a rounded brown leather miner's cap #8E5E38 #5E3C24 with a short front brim and a small dull brass plate #B07A3A on the front, sitting on top of the head between the ears; the ears stay visible.` | `Keep ONLY the miner's cap.` → `enm_prop_kobold_cap` 18 |
| w07b | EN10 녹슨 투구 코볼트 | w03 | `Recolour the skin: #9AA85A becomes #6E7A5A and #6E7A5A becomes #4D6A3E. Add an old dented iron miner's helmet #7D7B80 #4C4A52 with rust patches #B0603A covering the top of the head down to the brow; the ears poke out sideways under its rim.` | `Keep ONLY the rusty helmet.` → `enm_prop_kobold_rustyhelm` 18 |
| w08a | EB01 코볼트 두목 | w03 | `Recolour the skin one tone darker (see note). Add a horned iron helmet #7D7B80 #4C4A52 with two short curved ivory horns #F0E6CC. Make the pickaxe HEAD one and a half times larger; the haft keeps its length. Every outline pixel, on the kobold and on everything it holds, becomes dark gold #7A5A1E instead of #2B2233.` | ① `Keep ONLY the horned helmet.` → `enm_prop_kobold_hornhelm` 18 ② `Keep ONLY the pickaxe.` → `enm_prop_kobold_pickaxe_big` 18 |
| w08b | EB02 늙은 광부장 | w07a 결과 | `Add a long white beard #E8E4DC #C8C2B8 from the chin down over the chest. Add a small bronze lantern (frame #E0B06A #B07A3A, flame pane #FFE38A, no glow) hanging from the far hand in every cell. Every outline pixel becomes dark gold #7A5A1E instead of #2B2233.` 다음에 둘째 편집: `Change ONLY the lantern's flame pane: one block smaller and lower.` | ① `Keep ONLY the white beard.` → `kobold_beard` ② 두 편집본 각각 `Keep ONLY the lantern.` → `kobold_lantern` 깜박임 2 |

- EB01 「한 톤 짙게」의 색값이 정해져 있지 않다. 편집 문장의 `(see note)` 자리는 `#9AA85A becomes {EB01 본색} and #6E7A5A becomes {EB01 그늘}`로 바꾼다. 값은 §17-6에서 정한 뒤 넣는다. 정해지기 전에는 w08a를 **소품 떼기 원본**으로만 쓰고 색은 보지 않는다.
- 등불은 P1 c18(J04 등불)과 같은 모양이어야 한다. P1 c18이 합격했으면 **둘째 입력 이미지**로 넣고 `the same lantern design as the second input image, at the kobold's scale`를 덧붙인다.
- 정예 외곽선 `#7A5A1E`는 게임 팔레트가 외곽선 인덱스를 바꿔서도 낸다. 편집본은 색 목표와 소품 원본이다.
- 합격: 모든 편집 W3(겹쳐 보면 윤곽이 같고 차이는 지정한 색·부품에만), E4 E11. 떼기 E8 E10 E11.

### 2.5 정예 깃발 (AO-35 `elite_flag`) — w09

셀이 정해지지 않았다(manifest `unspecified`). **깃발 전용 16 × 16 셀**(32 규격 12 × 12)로 정한다. 정예는 코볼트 두 종만이 아니라 층의 `관문 잔당`(01 §8.2, 박쥐 포함)에도 붙으므로 계열 셀에 묶지 않는다(§17-2).
조립: A(`{16x16}`) + C(`N=2, COLS=2, ROWS=1, EMPTY_CELLS=없음`) + 본문 + D. C의 발바닥 문장은 「깃대 아래 끝」으로 읽는다.

```
A tiny gold pennant on a short pole, the whole thing about five by five blocks, centred in its cell, the pole's lower end on the ground line. Cloth #FFE38A, pole and outline dark gold #7A5A1E, two colours only. Cell 1: the cloth hangs straight; cell 2: the cloth tip flutters one block up. No emblem, no letters, no glow.
```

- 합격: E1 E4 E6 E7 E11. 5 × 5 안이 꽉 차고 실크기에서 금색 점으로 보인다.

---

## 3 보스 EB03 부서진 종의 파수꾼 (AO-37·38, 15 §7.3) — w34~w38

셀 64 × 56(8:7), 지면선 y 55(`{G}` = 1/56), 폭 넓고 낮게. 31프레임을 한 번에 생성하면 칸이 무너지므로 **정체성 1칸 → 18칸 시트 두 장**으로 나눈다. 두 장은 한 몸 전체 그림이라 레이어 정합이 필요 없고, 칸 정렬은 게임 정규화(`align ground`)가 맞춘다.

**균열은 표지 색 `#B0603A`로 그린다.** 파수꾼의 다른 곳에 쓰지 않는 색이라 게임 정규화가 그 화소를 인덱스 15로 옮기고 단계 팔레트(p1 `#7A4E24`, p3 `#FFE38A`)를 입힌다(AO-38, §17-12).

**I-BOSS**

```
SUBJECT AND IDENTITY: the same boss in every cell: the Broken-Bell Warden, a broad, low, heavy guardian golem of grey stone and bronze, FACING LEFT in a slight three-quarter side view. Instead of a head it carries one huge bronze bell resting on its shoulders, mouth down, with ONE jagged crack running down the bell's front: exactly the same crack shape and place in every cell. Blocky stone torso with bronze plates and rivets, a small round bell emblem on the chest, thick short legs. Its front arm ends in a heavy bronze bell-clapper mallet. Shoulders span about nine tenths of the cell width; the warden fills the cell height to one block below the top. Slow, silent, not evil; no face on the bell.
PALETTE ONLY: outline #2B2233; bronze #E0B06A #B07A3A #7A4E24; stone #B4B2B0 #7D7B80 #4C4A52; the crack ONLY in #B0603A, a colour used nowhere else.
```

| 번호 | 무엇 | 조립 · 입력 | 본문 |
| --- | --- | --- | --- |
| w34 | 정체성 1칸 | A(`{64x56}`) + I-BOSS + C-E(`N=1, COLS=1, ROWS=1, W:H=8:7, G=1/56, EMPTY=없음`) + 본문 + D. 입력 = w03 코볼트(덩치 비교) | `Input image role: size reference only: the warden is nearly twice as tall and about three times as wide as this kobold; do not draw the kobold. One standing idle pose, the master image for every later boss sheet.` |
| w35 | 시트 1: 대기·공격 A·공격 B (18) | A + I-BOSS + C-E(`N=18, COLS=6, ROWS=3, W:H=8:7, G=1/56, EMPTY=없음`) + 본문 + D. 입력 = w34(`Input image role: this is the exact boss to draw; copy it exactly, not its layout.`) | 아래 |
| w36 | 시트 2: 피격·단계 전환·퇴장 (13) | 같음(`N=13, COLS=6, ROWS=3, EMPTY=Row 1 holds three sprites and row 2 four sprites; the remaining cells of those rows stay empty.`) | 아래 |

w35 본문:

```
ROW 1 IDLE, 6 frames, 180 ms each. The body, arms and legs do not move by even one block; only the bell rocks on the shoulders: 1 upright; 2 bell tilted one block left; 3 upright; 4 tilted one block right; 5 upright; 6 the bell sits one block lower.
ROW 2 ATTACK A, mallet slam, 6 frames, 100/80/60/60/140/200 ms: 1 ready, mallet low; 2 mallet raised to the shoulder; 3 mallet at its highest point beside the bell; 4 slams down in front on the left, mallet head at the ground line; 5 follow-through, body leaning forward; 6 back to ready.
ROW 3 ATTACK B, bell toll, 6 frames, 120/120/100/100/160/240 ms: 1 crouches one block; 2 braces with arms spread; 3 the bell rings: body fixed, the bell silhouette two blocks larger; 4 bell still enlarged; 5 bell back to normal size, slight lean; 6 back to the idle pose.
Draw NO sound waves, rings, lines, dust or light: the shockwave is a separate effect.
```

w36 본문:

```
ROW 1 HIT, 3 frames, 70/120/160 ms: 1 flinch, the bell jolts up one block; 2 pushed one block to the right, knees bent; 3 halfway back. All three poses clearly different.
ROW 2 PHASE SHIFT, 4 frames, 150/150/200/400 ms: pose and silhouette EXACTLY the same in all four; only the crack's colour changes step by step: #B0603A, #C8783A, #FFE38A, then #FFE38A with a one-block #FFFFFF core. No glow outside the crack.
ROW 3 SHUTDOWN, 6 frames, 150/150/150/200/300 ms then hold: the ringing stops and the warden sinks down, never broken: 1 sways; 2 down on one knee; 3 on both knees; 4 the bell bows forward; 5 still, resting; 6 exactly the same as 5.
```

균열·파동·종추:

| 번호 | 결과 | 만드는 법 |
| --- | --- | --- |
| w37a | 고정 균열 마스크(게임 인덱스 15 확인용) | w35를 X + `Keep ONLY the crack pixels (#B0603A) in each cell.` |
| w37b | `boss_bellwarden_crack` 1칸 (2단계 금 겹침) | w34를 SW + `Add two more short branching cracks to the bell, in #B0603A, starting from the existing crack.` → X + `Keep ONLY the newly added cracks; remove the original crack and the warden.` |
| w38 | `fx_bell_wave` 4 | A(`{64x56}`) + C-FX(`N=4, COLS=4, ROWS=1, ANCHOR=the arc centre sits near the right edge at mid-height of the cell`) + 본문 + D-FX |
| (선택) | `boss_prop_clapper` 6 | AO-38이 종추를 떼기로 확정할 때만: w35를 X + `Keep ONLY the bronze mallet at the end of the front arm in row 2.` (§17-10) |

w38 본문:

```
A bell's sound shockwave, 4 frames, 120 ms each: three thin concentric arcs, each exactly ONE block thick, bulging toward the LEFT, spaced four blocks apart. The outermost arc's radius grows 12, 18, 24, 30 blocks over frames 1 to 4. Colours #FFE38A, #FFFFFF, #B07A3A only. Arcs are clipped at the cell edge. No red, no dust, no blur.
```

- 파동 셀은 카드의 48 × 48이 아니라 보스 셀 64 × 56으로 둔다(반지름 30이 48 셀에 들어가지 않는다, §17-11).
- 합격: w34~36 E1 E3(대기 전체) E4 E5 E6 E7 E11 + W4. w37 E8 E10. w38 E1 E4 E6 E7 + W9.

---

## 4 배경 (AO-39~42, 15 §8)

### 4.0 공통

- **합성 후 분리**(PROMPTS §3.5): 장면 하나를 C-BG 띠로 생성 → 합격본에서 X로 먼 층·중간 층·가까운 층을 뗀다. 먼 층만 가려진 곳을 이어 그린다(PROMPTS §3.5의 유일한 예외).
- 조립(합성): A(`{256x64}`) + C-BG(`{DARKEST}`는 장면마다) + 본문 + D-BG. **입력 = 합격한 들판 합성(PROMPTS §3.5 ①)**을 `Input image role: framing and style reference only: copy its strip size and position on the canvas, its ground line height, its pixel-block size and its soft outline-free style; do not copy its scenery.`로 넣는다. 들판이 합격하기 전에는 마을·폐광을 시작하지 않는다.
- 층 떼기 문장 = PROMPTS §3.5 ②와 같은 형식: 먼 층 `Keep ONLY the {far}. Remove …, and continue the {far} naturally where they were hidden (this layer alone is fully opaque inside the strip).`, 중간·가까운 층 `Keep ONLY the {…}. Everything else inside and outside the strip becomes flat #FF00FF.`
- **계절·낮밤은 그리지 않는다.** 기본 팔레트 한 벌만 만들고 LUT 16개(AO-44, 게임)가 봄·여름·가을·겨울 × 낮·밤을 만든다. 폐광·틈에는 LUT가 없다. 불빛은 **꺼진 채** 그리고 켜진 불빛은 겹침 파일로 뗀다(P-15).
- 장소별 차이(H1~A4)는 장소 팔레트(게임, §17-15)와 §5 장소 소품이 낸다.

### 4.1 들판 (AO-39) — PROMPTS §3.5 그대로

P0다. 여기서는 새로 쓰지 않는다. PROMPTS v1.2 §3.5 ①은 D 대신 D-BG를 쓴다(이 문서의 제안을 반영했다).

### 4.2 마을 (AO-40) — w10·w11

`{DARKEST}` = `#8E5E38`. 창 불빛 없음. 시설 배치는 AO-40을 따른다(여관·길드·치료소 = 중간 층, 대장간·잡화점 = 장소 소품, §17-13).

w10 합성 본문:

```
Soft, low-contrast daytime riverside village for a calm idle game. Inside the strip, from back to front:
Far: pale sky #B9C8FF with two flat clouds #E8EEF2; a low range of soft distant mountains #C8C2B8 #9A948C, the horizon at about one third of the strip height.
Mid, all inside the left 47% of the strip, standing on the ground line, roof tops below the top quarter: (1) the inn 'Acorn Cap': a small cream-walled house #F0E6CC #C8C2B8 whose roof is a round brown dome shaped like an acorn cap #8E5E38 #C08A58 with a tiny stem, and a window box with flowers; (2) the guild post: a small timber house #C08A58 #8E5E38 with a green banner #6D8F5A on a pole showing a simple forked-road emblem in cream, and a notice board; (3) the clinic: a white canvas tent #F0E6CC with a small wooden water wheel beside it. Exactly four small windows in total, all dark and unlit #6E6862.
Near: a flat dirt road #C08A58 #8E5E38 whose top edge is the ground line, a low dry-stone wall #9A948C #C8C2B8 in front of the buildings in the left part only, grass tufts #6D8F5A #8FC06A.
The right half: only sky, mountains, road and a little grass.
No people, no animals, no smoke, no light.
```

층 떼기(입력 = 합격 w10):

| 층 | 문장 |
| --- | --- |
| `bg_town_far` | 먼 층 형식, `{far}` = `sky, clouds and mountains`, 지울 것 = `the buildings, banner, notice board, water wheel, stone wall, road and grass` |
| `bg_town_mid` | `Keep ONLY the three buildings, the banner with its pole, the notice board and the water wheel.` |
| `bg_town_near` | `Keep ONLY the dirt road, the stone wall and the grass tufts.` |

w11 창 불빛 `bg_town_window_lit`: w10을 SW + `Light the four windows: fill every window pane with flat gold #FFE38A. Change nothing else; no glow around the windows.` → X + `Keep ONLY the four gold window panes.` 이 겹침에는 LUT를 적용하지 않는다(P-15).

- 합격: E4 E7 E8 E11 + W5 W6 W7. 기본 3층에 따뜻한 불빛 화소가 없다(AO-40).

### 4.3 폐광 (AO-41, D1 기본) — w13·w14

`{DARKEST}` = `#6E6862`. 어둠은 칠하지 않는다(D3의 어둠·등불 빛 원은 게임 연출).

w13 합성 본문:

```
Abandoned mine tunnel interior for a calm idle game, evenly lit mid-grey, never black: the game darkens it later. Inside the strip:
Far: a rough rock tunnel wall filling the whole strip #9A948C #6E6862, one diagonal band of blue ore vein #5A7FA8 and a few paler stones #C8C2B8.
Mid, inside the left 47%: two timber support arches #C08A58 #8E5E38 (two posts and a crossbeam each), their tops below the top quarter; an EMPTY iron lantern hook #7D7B80 hanging from each crossbeam; cart rails #7D7B80 on wooden sleepers #8E5E38 running along the floor across the full width.
Near: a gravel floor #9A948C #6E6862 with a few pebbles #C8C2B8, its top edge the ground line.
The right half: plain wall, rails and gravel only.
No lanterns, no flames, no light beams, no creatures.
```

층 떼기: `bg_mine_far` = 먼 층 형식(`rock wall and ore vein`), `bg_mine_mid` = `Keep ONLY the two timber arches, the empty hooks and the rails with their sleepers.`, `bg_mine_near` = `Keep ONLY the gravel floor and pebbles.`

w14 등불 `bg_mine_lantern_lit` 2프레임:
1. w13을 SW + `Hang one small lit bronze lantern on each empty hook: frame #E0B06A #B07A3A, flat gold flame pane #FFE38A, no glow.` (P1 c18 합격 시 둘째 입력으로 같은 등불 모양)
2. 1의 결과를 SW + `Change ONLY each lantern's flame pane: one block smaller and lower.`
3. 두 결과 각각 X + `Keep ONLY the two lanterns.`

- 합격: E4 E7 E8 E11 + W5 W6 W7. 기본 3층에 불빛 0.

### 4.4 A4 길바뀜의 틈 먼 층 (AO-42) — w15

틈은 먼 층만 바뀌고 중간·가까운 층은 폐광이다(15 §8.3). 그래서 **폐광 합성 w13을 편집**해 틈 벽을 넣고 먼 층만 뗀다(지평·바닥이 폐광과 맞는다).
카드 색 중 `#4A3F55`(바탕)·`#7A1F33`(장미)는 L\* 30 미만이라 배경 규칙에 걸린다. 아래처럼 바꾼다(§17-14).

```
Replace ONLY the far rock wall with the wall of a dimensional rift. Keep the timber arches, hooks, rails and gravel exactly as they are.
The rift wall: muted ash stone #9A948C #6E6862; a jagged crack in the left part of the strip, from about 8% to 23% of the width, leaking pale starlight #B9C8FF with tiny white star specks #FFFFFF; small flat stone shards #C8C2B8 floating beside it; low dark-green vines #4D6A3E with small deep-red roses #B04A42 creeping along the bottom of the wall; two cold, unlit iron candlesticks #7D7B80 on a rock ledge. Muted, low saturation. No moon, no crescent, no cup or chalice.
```

조립: SW + 위 문장 + D-BG → X + 먼 층 형식(`rift wall, crack, starlight, floating shards, vines, roses and candlesticks`). 결과 = `bg_rift_far`.

- 식은 촛대(02 §6.4)는 장소 소품 대신 이 먼 층에 넣는다(§5의 20개에 넣지 않는다). 별잠 샘은 `prop_star_spring`(§8)을 쓴다.
- 합격: E4 E7 E8 E11 + W5 W7. 초승달·잔 모양이 없다(AO-42).

### 4.5 계절·낮밤·장소 팔레트 (그림 없음)

| 무엇 | 처리 | 이 문서가 할 일 |
| --- | --- | --- |
| 봄·여름·가을·겨울 × 낮·밤 16 | 게임 LUT(AO-44) | 없음. 기본 타일의 풀·나무 색이 **서로 다른 색**이어야 LUT가 따로 바꿀 수 있다: 풀 `#6D8F5A`, 언덕 `#8FC06A` `#5E9A4A`, 나뭇잎 `#6D8F5A` `#4D6A3E`는 들판 합성에서 이미 나뉜다 |
| 밤 창·등불 | 겹침 파일 w11·w14 | 위 |
| 장소 팔레트 7(H1 밝은 연두, H3 황갈, H4 채도 −50%, A2 −15%, A3 채도 −40%, D2 청회, D3 −40%) | 게임 변환(카드·수량 없음) | §17-15 |

---

## 5 배경 장소 소품 20종 확정안 (AO-43) — w12·w16

AO-43 표에는 이름이 32개여서 「20개를 넘기지 않는다」와 맞지 않았고, 크기가 「32 × 32 또는 48 × 32에서 고른다」로 미정이었다. **아래 20개와 크기로 확정한다**(48 규격 논리 화소, 폭 × 높이). 지면선 y 56에 바닥을 두고, 위 끝은 y 16 아래(축소 창)에 들어오게 **높이 40 이하**로 잡았다. 15 §8.3의 H1 「여울 물줄기 띠·작은 나무다리」가 카드에 빠져 있어 넣었다.

| # | 파일 `bg_prop_…` | 장소 | 크기 | 층 | 합성 | 내용 · 줄이며 합친 것 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `smithy` | T00 | 48 × 40 | 중간 | PC-T | 대장간: 검은 굴뚝(연기 없음), 모루, 벽에 건 칼 |
| 2 | `store` | T00 | 64 × 40 | 중간 | PC-T | 잡화점: 약초 다발 처마 + **빨랫줄**(합침) |
| 3 | `stream` | H1 | 96 × 12 | 가까운 | PC-H1 | 여울 물줄기 띠 + **징검다리·갈대**(합침) |
| 4 | `footbridge` | H1 · A1 | 48 × 16 | 가까운 | PC-H1 | 작은 나무다리(A1 「작은 다리」 공용) |
| 5 | `acornpile` | H1 | 24 × 12 | 가까운 | PC-H1 | 도토리 무더기(L04 들쥐 굴) |
| 6 | `willow` | H2 | 48 × 40 | 중간 | PC-H2 | 늘어진 버드나무. 두 번 놓아 「2그루」 |
| 7 | `watermill` | H2 | 64 × 40 | 중간 | PC-H2 | 물레방아 + **부서진 수문과 둑 경사**(합침) |
| 8 | `beacon` | H3 | 32 × 40 | 중간 | PC-H3 | 무너진 봉화대 |
| 9 | `rocks` | H3 | 48 × 24 | 중간 | PC-H3 | 둥근 바위 무리 + 억새 |
| 10 | `slagheap` | H4 | 64 × 32 | 중간 | PC-H4 | 회색 광재 더미 + 노란 꽃 몇 송이 |
| 11 | `cart` | H4 | 32 × 24 | 중간 | PC-H4 | 버려진 나무 손수레(기울어짐) |
| 12 | `brokengate` | H5 | 64 × 40 | 중간 | PC-H5 | 반쯤 무너진 큰 나무 갱도 문 + 글자 없는 녹슨 경고판 |
| 13 | `outerlight` | H5 | 24 × 40 | 먼 | PC-H5 | 먼 층 오른쪽 끝의 바깥 빛 구멍. 흰 한 색, 밤은 팔레트로 `#B9C8FF` |
| 14 | `belltower` | A3 · H5 | 32 × 40 | 중간(A3) · 먼(H5) | PC-A3 | 종 없는 빈 돌 종탑. H5 먼 실루엣은 같은 파일을 옅은 팔레트로 |
| 15 | `milestone` | A1 · A2 | 16 × 24 | 중간 | PC-A1 | 이끼 낀 돌 이정석 + 글자 없는 나무 팔 |
| 16 | `shrine` | A1 | 32 × 32 | 중간 | PC-A1 | 작은 돌 사당 |
| 17 | `conifer` | A2 | 32 × 40 | 중간 | PC-A2 | 소나무. 여러 번 놓는다 |
| 18 | `ruin` | A3 | 256 × 64 | 중간 대체 | PC-A3 | 마을 중간 층의 폐허판: 내려앉은 지붕, 빈 창틀, 무성한 풀, 돌 우물 |
| 19 | `mine_d2` | D2 | 256 × 64 | 중간 겹침 | PC-D2 | 금속 파이프, 식은 화로, 종 파편, 청 광맥 조각 |
| 20 | `mine_d3` | D3 | 256 × 64 | 중간 겹침 | PC-D3 | 거대한 종 조각, 이름 새긴 기둥(글자 대신 새김 홈), 무너진 천장 틈 |

카드 목록에서 빠진 것과 대신 쓰는 것:

| 카드 이름 | 처리 |
| --- | --- |
| `noticeboard` | `prop_notice_board`(§8, AO-50)를 쓴다 |
| `steppingstones`·`reeds` / `clothesline` / `brokensluice` | 3 `stream` / 2 `store` / 7 `watermill`에 합침 |
| `roundrock` | 9 `rocks` |
| `belltower_far`·`belltower_empty` | 14 `belltower` 하나 + 팔레트 |
| `fog` | `fx_weather_fog`(§6) — A2 안개 띠와 날씨 안개가 같은 규격(흰 띠 40%, 4 px/초)이다 |
| `well` | 18 `ruin`에 합침 |
| `pipe`·`bellshard`·`coldhearth`·`bridge` | 19 `mine_d2`에 합침. 갱도 다리(C01-3)는 P3 ES05가 장면으로 그린다 |
| `giantbell`·`namepillar` | 20 `mine_d3`에 합침 |
| `starspring` / `candlestick` | `prop_star_spring`(§8) / `bg_rift_far`(§4.4) |

- 1~17은 게임이 bbox를 잘라 위 크기 셀에 넣고 x 0~120 안에 자유롭게 놓는다. 18~20은 **타일과 같은 256 × 64 겹침**이라 합성 장면과 칸이 맞아야 하므로 기본 장면을 편집해 만든다. 18~20의 반투명(ASSET_ORDERS §0.7의 `bg_prop_ruin`)은 쓰지 않는다 — 폐허판은 중간 층을 **대신** 그린다.
- H5의 반쯤 묻힌 광차는 `prop_mine_cart`(§8)를 쓴다. H3 먼 층 y −6 이동은 게임 배치다.

### 5.1 장소 합성 편집 (w12: T·H1~H4·A1·A2, w16: H5·A3·D2·D3)

조립: SW + 문장 + D-BG. 입력 = 합격한 기본 합성(w10 마을, PROMPTS §3.5 들판, w13 폐광). 1~17은 떼기 쉽게 **띠의 오른쪽 절반**에 서로 떨어뜨려 더한다. 색은 그 장면의 색과 배경 확장 묶음만 쓰고 `{DARKEST}`보다 어둡지 않게 한다.

| 합성 | 입력 | 더하는 문장 (SW 뒤) |
| --- | --- | --- |
| PC-T | w10 | `ADD in the RIGHT half of the strip, standing on the ground line, well apart: (1) a small smithy, 48 by 40 blocks: stone and timber walls #9A948C #C08A58, a tall chimney #7D7B80 with no smoke, an anvil #7D7B80 by the door and a sword hanging on the wall #B4B2B0; (2) a general store, 64 by 40 blocks: cream walls #F0E6CC, a striped awning #6D8F5A #F0E6CC with bundles of dried herbs #8FC06A hanging from its eave, and a short clothesline beside it with two cloths #F0E6CC #5A7FA8. All windows unlit #6E6862.` |
| PC-H1 | 들판 | `ADD in the RIGHT half, well apart: (1) a shallow stream, a flat band 96 by 12 blocks lying along the ground line, water #B9C8FF #E8EEF2 with three flat stepping stones #C8C2B8 and a few reeds #8FC06A at both ends; (2) a small wooden footbridge 48 by 16 blocks #C08A58 #8E5E38; (3) a small pile of acorns 24 by 12 blocks #C08A58 #8E5E38.` |
| PC-H2 | 들판 | `ADD in the RIGHT half, well apart: (1) a weeping willow, 48 by 40 blocks, drooping curtains of leaves #8FC06A #5E9A4A, trunk #8E5E38; (2) a wooden water wheel beside a broken sluice gate on a low earthen dike slope, 64 by 40 blocks, wood #C08A58 #8E5E38, dike #C08A58, water #B9C8FF.` |
| PC-H3 | 들판 | `ADD in the RIGHT half, well apart: (1) a ruined stone beacon tower, 32 by 40 blocks, crumbled top #C8C2B8 #9A948C; (2) a cluster of round boulders with tufts of silver grass, 48 by 24 blocks, rocks #C8C2B8 #9A948C, grass #E8EEF2 #B8A04A.` |
| PC-H4 | 들판 | `ADD in the RIGHT half, well apart: (1) a heap of grey mine slag, 64 by 32 blocks, #C8C2B8 #9A948C with a few tiny yellow flowers #FFE38A; (2) an abandoned wooden handcart tilted on one wheel, 32 by 24 blocks, #C08A58 #8E5E38 #7D7B80.` |
| PC-A1 | 들판 | `ADD in the RIGHT half, well apart: (1) a mossy stone milestone with one blank wooden arm, 16 by 24 blocks, stone #C8C2B8 #9A948C, moss #8FC06A, wood #C08A58; (2) a small stone wayside shrine with a little roof, 32 by 32 blocks, #C8C2B8 #9A948C #8E5E38.` |
| PC-A2 | 들판 | `ADD in the RIGHT half: one pine tree, 32 by 40 blocks, dark-green needles #5E9A4A #4D6A3E, trunk #8E5E38.` |
| PC-H5 | w13 | `ADD in the RIGHT half, well apart: (1) a huge half-collapsed wooden mine gate, 64 by 40 blocks: broken timber frame and planks #C08A58 #8E5E38 and one blank rusty warning plate #B0603A #7D7B80 with no writing; (2) at the far right end of the far wall, a tall opening where daylight shows, 24 by 40 blocks, one flat white #FFFFFF shape.` |
| PC-A3 | w10 | ① 폐허판: `Turn the village into an abandoned miners' village: keep every building in exactly the same place and size, but cave the roofs in, leave the window frames empty, tear the tent, remove the banner cloth (bare pole), grow tall grass #8FC06A over the wall, and add a small round stone well #C8C2B8 #9A948C just right of the clinic, still inside the left half.` ② 같은 결과를 다시 SW + `ADD in the RIGHT half: a small empty stone bell tower with no bell, 32 by 40 blocks, #C8C2B8 #9A948C #8E5E38.` |
| PC-D2 | w13 | `ADD inside the left half, between and in front of the timber arches: two rusty metal pipes along the wall #7D7B80 #B0603A, a cold stone hearth with no fire #9A948C #C8C2B8, three small broken bronze bell shards on the floor #E0B06A #B07A3A, and two short streaks of blue ore #5A7FA8 on the wall.` |
| PC-D3 | w13 | `ADD inside the left half, between and in front of the timber arches: a giant fragment of a broken bronze bell lying on its side #E0B06A #B07A3A #7A4E24, a stone pillar #C8C2B8 #9A948C carved with rows of short notches (no letters), and a jagged crack in the ceiling showing paler rock #C8C2B8.` |

떼기(X 뒤, 입력 = 각 합성 결과):

| 결과 | 문장 |
| --- | --- |
| 1~17 | `Keep ONLY the objects added in the right half. Everything else inside and outside the strip becomes flat #FF00FF.` — 게임이 물체별 bbox로 나눠 표의 크기 셀에 넣는다 |
| 18 `ruin` | 입력 PC-A3 ①. `Keep ONLY the ruined buildings, the bare pole, the notice board, the water wheel, the overgrown grass and the well. Everything else becomes flat #FF00FF.` |
| 19·20 | `Keep ONLY the objects added in the left half. Everything else becomes flat #FF00FF.` |

- 합격: E4 E7 E8 E10 E11 + W5 W8. 13지역을 조립해 02 §6 풍경 키워드가 읽힌다(AO-43 육안). 20·ES20(P3)의 거대한 종은 보스 종(w34)과 같은 청동·같은 금 모양이다.

---

## 6 날씨 (AO-45, 15 §8.3) — w17

생성 모델은 **입자 수 정확히 40·30**과 **알파 40%**를 보장하지 못한다(§17-18). 처리안: 입자 **스프라이트**를 그리고 게임이 화면당 40·30개를 흩뿌린다(15의 「입자」 표현과 맞다). 안개는 불투명 흰색으로 받고 알파 102는 게임이 준다(그림자·빛 원과 같은 방식).

w17a 입자: A(`{16x16}`) + C-FX(`N=6, COLS=6, ROWS=1, ANCHOR=the particle is centred in the cell`) + 본문 + D-FX

```
Tiny weather particles, one per cell, each only a few blocks in size and centred in a mostly empty cell. Cells 1-2: raindrops, a thin diagonal streak falling from upper right to lower left, one block thick, two blocks long in cell 1 and three blocks long in cell 2, pale blue #B9C8FF. Cells 3-4: snowflakes, a single block in cell 3 and a 2 by 2 block in cell 4, #FFFFFF with #E8EEF2. Cells 5-6: falling leaves, a 2 by 2 block leaf #B8A04A in cell 5 and #C8783A in cell 6.
```

- 5·6칸(낙엽)은 P-18이 승인될 때만 쓴다(B-09). 그전에는 버린다.

w17b 안개 `fx_weather_fog`: A(`{256x64}`) + C-BG(`{DARKEST}`=`#FFFFFF`) + 본문 + D-FX

```
Only a horizontal band of fog across the whole strip: one flat, fully opaque white #FFFFFF shape filling roughly the middle third of the strip's height, its top and bottom edges gently wavy in hard one-block steps, a few separate small white wisps above and below it. The band meets the left and right edges at the same height so it tiles. Nothing else: no sky, no ground, no scenery. The game makes it semi-transparent.
```

- AO-45의 구운 256 × 64 비·눈 겹침이 꼭 필요하면(런타임 입자 불가 판정 시) 같은 C-BG로 `about forty raindrops scattered evenly`를 요청하되 **개수는 게임 검사에서 ±를 허용**해야 한다(§17-18).
- `fx_whiteflash`(흰빛 덮기)는 그리지 않는다. 합성 대상 실루엣을 흰색으로 칠하는 런타임 마스크라 그림이 필요 없다(§17-19).
- 합격: E4 E6 E7 E11 + W9. 안개 띠 가장자리가 계단식이고 반투명·흐림이 없다.

---

## 7 공용 효과 6종 (AO-46~48, 15 §9.1) — w18~w20

조립: A(`{48x48}`) + C-FX + 본문 + D-FX. 효과마다 **따로 생성**한다(같은 장에 두면 모양이 서로 닮는다, 1차 S7). 기준점은 48 셀 좌표를 비율로 옮겼다. 파일당 4색 이내.

| 번호 | 효과 | C-FX 값 | 본문 |
| --- | --- | --- | --- |
| w18a | FX1 타격 4 · 60 ms × 4 | `N=4, COLS=4, ROWS=1, ANCHOR=the exact centre of the cell` | `A horizontally bursting angular impact. 1 a single 2-block white dot at the anchor; 2 four sharp wedge shards flying out to the left and right, low and wide; 3 the largest: a flat jagged burst about 22 blocks wide and 10 blocks tall, white core #FFFFFF, gold rim #FFE38A, bronze tips #E0B06A; 4 two small leftover shards. Always at least twice as wide as tall. No star shape, no circle, no red.` |
| w18b | FX3 발견 반짝임 4 · 90 ms × 4 | `N=4, COLS=4, ROWS=1, ANCHOR=centred horizontally, about 40% down from the cell top` | `A vertical four-pointed sparkle, taller than wide. 1 one-block dot; 2 a small cross 3 blocks wide and 5 tall; 3 a four-pointed star 5 blocks wide and 9 tall; 4 one-block dot. Gold #FFE38A with a #FFFFFF centre, two colours only.` |
| w19a | FX2 회복 6 · 100 ms × 6 | `N=6, COLS=6, ROWS=1, ANCHOR=three fixed columns at 38%, 48% and 58% of the cell width` | `Three small green motes, 2 by 2 blocks, one in each fixed column, rising from 62% of the cell height to 29% over the six frames, slightly staggered; in frames 5 and 6 they shrink to single blocks and fade out by disappearing. Colours #8FE0A0 #6D8F5A with a #FFFFFF glint. No plus sign, no cross, no bar, no circle, no symbol.` |
| w19b | FX5 부상 4 · 100 ms × 4 | `N=4, COLS=4, ROWS=1, ANCHOR=centred horizontally, about 20% down from the cell top` | `Two sweat drops #B9C8FF and two small 3 by 3 diamond sparks #FFE38A circling above a head at the anchor; each frame the four items move a quarter turn around the anchor. No four-pointed stars, no blood, no red.` |
| w20a | FX4 레벨업 8 · 90 ms × 8 | `N=8, COLS=4, ROWS=2, ANCHOR=the bottom row of motes starts on a ground line about 8% above the cell bottom, horizontally centred` | `Six gold motes rising from the feet to above the head over eight frames: they start as small 2-block squares on the ground line, spread slightly, climb, and in the last two frames sparkle as single blocks near the top. Colours #FFE38A #E0B06A #FFFFFF.` |
| w20b | FX6 저주·달빛 6 · 150 ms × 6 반복 | `N=6, COLS=6, ROWS=1, ANCHOR=a flat ellipse centred horizontally on a ground line about 8% above the cell bottom` | `A looping ground ring: a flat ellipse outline 20 blocks wide and 4 blocks tall, IDENTICAL in all six cells, with three 3 by 3 particles orbiting it, each frame one sixth of a turn further. The whole effect stays within 22 by 10 blocks. Colours #8E4FA3 and #FFFFFF only. No red.` |

- FX6의 달빛 변형(`#B9C8FF`)은 그리지 않는다. 같은 그림을 게임 팔레트로 바꾼다(`pal_fx_moon`, AO-48). `props.json`의 `moon_fx`도 이것이다(P-09).
- FX6 타원이 칸마다 달라지면: 합격한 1칸을 입력으로 SW + `Make cells 2-6 use exactly the ellipse of cell 1; only the three particles move.`
- 빛 원 `fx_lantern_glow`는 P1 c20.
- 합격: E1 E4 E6 E7 E11 + W9. 32px(실크기)에서 FX1·FX3·FX5가 즉시 구분된다.

---

## 8 소품 24종 43프레임 (AO-49·50, 15 §9.2) — w21~w24

P0의 책 2칸(PROMPTS AO-49)을 뺀 **23종 41프레임**이다. 소품 바닥은 지면선(48 셀 y 43)에 닿는다. 파일당 3색 이내(AO-49·50). 외곽선 `#2B2233`을 3색에 넣는지 카드가 정하지 않아 **외곽선은 따로 센다**고 읽었다(PROMPTS §3.3 책도 같다).

### 8.1 캐릭터 합성에서 떼는 소품 (몸에 딱 맞아야 하는 것) — w21

| 소품 | 입력 | 교체 문장(SW 뒤) → 떼기(X 뒤) | 게임이 고르는 칸 |
| --- | --- | --- | --- |
| `prop_bread` 1 | 마스터 3행 | (교체 없음) → `Keep ONLY the bread roll in each cell. Remove the character entirely, including the hand holding it.` | 식사 1칸 |
| `prop_loot_sack` 6 | 합격한 REF-A 걷기 12(PROMPTS §3.1) | `Add an oversized lumpy brown loot sack #C08A58 #8E5E38 tied with a cord #F0E6CC on the character's back, bigger than the torso, about 24 blocks wide and 26 tall, bouncing slightly with each step.` → `Keep ONLY the loot sack, including the parts that stick out past the body.` | 걷기 12칸 중 1·2·4·7·8·10(AO-03과 같은 칸, P-17) |
| `prop_bandage` 1 | 마스터 1행 1칸 | `Wrap two horizontal cream bandage strips #F0E6CC #C8C2B8 around the torso, each two blocks tall, following the torso's outline.` → `Keep ONLY the two bandage strips.` | 1칸 |

- 떼기 문장은 PROMPTS §3.2 머리말을 앞에 붙이므로 **보이는 화소만** 남는다. 자루가 팔 뒤로 가려진 곳은 비어 있는 것이 맞다(E10).

### 8.2 새로 생성하는 손 소품·표시 — w22

조립: A(`{48x48}`) + C-PROP + 본문 + D(w22b는 D-MARK). 입력 = 마스터(크기 기준).

- 손 소품은 단독 생성이라 PROMPTS §2.3 단검과 같은 밀도 문제(사양 크기로 맞추면 뭉개짐)가 날 수 있다. 정규화 뒤 뭉개지는 소품은 §8.1처럼 캐릭터 합성에 들린 모습으로 교체 → 떼기로 바꾼다.

w22a 손 소품 6 (`N=6, COLS=3, ROWS=2`):

```
Prop-only sprites, no hand and no body, each sized for this character's small hands:
1 potion vial about 5 by 7 blocks: round glass #C8C2B8 with green liquid #8FE0A0 and a cork #8E5E38.
2 walking cane about 20 blocks long, standing upright, plain wood #C08A58 #8E5E38 with a curved top.
3 mushroom umbrella FLOATING in the upper part of its cell: a wide red mushroom cap about 22 by 12 blocks #B04A42 with cream spots #F0E6CC and a short stem #F0E6CC.
4 whistle, horizontal, about 12 by 5 blocks: a flat WOODEN tube #C08A58 #8E5E38 with a round sound hole near the right end, a small mouth opening at the left and a little ring on top.
5 torn map about 14 by 10 blocks: parchment #F0E6CC #C8C2B8 with a torn jagged edge, a faint path line and a tiny bell drawing, both in the same brown #8E5E38; no writing.
6 sealed letter about 12 by 9 blocks: envelope #F0E6CC #C8C2B8 with one perfectly round, symmetric wax seal #B04A42 in the centre; no strokes, no writing.
```

w22b 표시 4 (`N=4, COLS=4, ROWS=1`, 모두 떠 있다, 금지 블록은 D-MARK):

```
Floating marks, no body. Cells 1-2: an exclamation speech bubble about 10 by 12 blocks, white #FFFFFF with a gold exclamation mark #FFE38A and a small tail at the bottom; cell 2 is the same bubble one block larger. Cells 3-4: sleep marks made of two small zigzag lines, NOT the letter Z: a larger zigzag and a smaller one above it, pale blue #B9C8FF; in cell 4 both zigzags are one block higher.
```

- 호각은 J01 아이템 아이콘(§10)·토리 초상(§12)·P3 ES06~08과 같은 물건이다. **나무 호각**이다(15 §9.3 ES06, 11 C02-1, 08 J01 「끈에 매단 나무 호각」). 카드 AO-49 「청동 호각」과 AO-57 J01 색 `#B07A3A` `#7A4E24`는 소유 문서와 달라 고칠 대상이다(`OPEN_DECISIONS.md` OD-33).
- 지도·편지는 P3 ES03·ES18의 입력이 된다.

### 8.3 장면 소품과 상태 편집 — w23·w24

w23 모닥불 4 (`N=4, COLS=4, ROWS=1`): A + C-PROP + 본문 + D

```
A campfire, 4 frames, 120 ms each, looping. Three crossed logs #8E5E38 that are pixel-identical in all four cells; only the flames change: frame 1 medium flame, 2 taller and leaning left, 3 short and wide, 4 taller and leaning right. Flames #FFE38A #C8783A in flat stepped shapes, about 22 blocks wide and 24 tall in total. No glow, no sparks outside the flame, no smoke.
```

- 통나무가 칸마다 달라지면: 1칸을 입력으로 SW + `Cells 2-4 use exactly the logs of cell 1; only the flames differ.`

w24a 정지 10 (`N=10, COLS=5, ROWS=2`): A + C-PROP + 본문 + D

```
Scene props standing on the ground, one per cell:
1 standing lantern about 14 by 20 blocks: bronze frame #B07A3A #7A4E24, flame pane #FFE38A, no glow.
2 village notice board: two posts and a plank board #C08A58 #8E5E38 with three small blank paper notes #F0E6CC.
3 treasure chest, CLOSED: wood #C08A58 #8E5E38 with bronze bands #B07A3A.
4 dungeon door, CLOSED: heavy planks #8E5E38 #5E3C24 in a stone frame #9A948C, about 30 by 42 blocks.
5 spike trap, HIDDEN: a flat floor plate #9A948C #7D7B80 with small holes.
6 mine cart on a short rail piece: iron body #7D7B80 #4C4A52 with a wooden rim #8E5E38.
7 bedroll, about 32 by 8 blocks: rolled-out blanket #5A7FA8 #3E5A7E with a cream pillow end #F0E6CC.
8 clinic cot: a low wooden frame #C08A58 with a white sheet #F0E6CC #C8C2B8.
9 star spring: a low round stone basin #C8C2B8 #9A948C, its rim carved with small four-point star marks, clear water #B9C8FF with two flat ripple rings rising gently in the middle.
10 silver chalice with a foot: #E8E6E0 #B4B2B0.
```

w24b 둘째 상태(입력 = 합격 w24a): SW + 아래 + D. 바뀌지 않는 칸(2·7·8·10)은 그대로 남는다.

```
Change ONLY these cells: 1 the flame pane one block smaller and lower (flicker); 3 the chest OPEN, lid swung up and back, a gold glint #FFE38A inside; 4 the door OPEN, swung inward so its dark doorway #6E6862 shows; 5 the trap SPRUNG, a row of iron spikes #B4B2B0 sticking up from the plate; 6 the cart's wheels turned a quarter (rolling); 9 the water's ripple rings shifted outward by one block.
```

w24c 샘 물결 3·4: w24b를 SW + `Change ONLY cell 9: ripple rings one more block outward.` → 다시 한 번. (샘 4프레임 = w24a 9, w24b 9, w24c 9 두 장)

w24d 꺼진 등불: w24a를 SW + `Change ONLY cell 1: the lantern is out, the flame pane becomes dull grey glass #6E6862, and a small boxy travel backpack #8E5E38 #5E3C24 with a rolled flap rests against its foot.` → 게임이 1칸을 `prop_lantern_out`으로 쓴다. 색 3개 제한(AO-50: `#6E6862` `#7A4E24` + 1)을 넘으면 등불 틀을 `#7A4E24`로 낮춘다.

- 색은 카드 AO-50을 따른다(모닥불 `#FFE38A` `#C8783A` `#8E5E38`, 등불 `#B07A3A` `#FFE38A` `#7A4E24`, 파일당 3색 + 외곽선). 샘·광차·등불·배낭은 P3 장면과 같은 문장이다(P3 §2 표, `OPEN_DECISIONS.md` OD-67).
- 등불은 P1 c18(J04)과 같은 모양이다. c18이 합격했으면 둘째 입력으로 넣는다. `prop_lantern_out`·샘·잔·광차·편지·지도·모닥불은 **P3 이벤트 장면의 모양 기준 입력**이다(ES01·03·10·11·15·18).
- 합격: E1 E3 E4 E6 E7 E11 + W10. 상태 쌍을 겹쳐 보면 바뀐 부분만 다르다. 모닥불 통나무 4칸이 같다.

---

## 9 UI 아이콘 42 (AO-51~54, 03 §4, 15 §11) — w25~w28

조립: A-UI(`{12x12}` 또는 `{16x16}`) + C-ICON + 본문 + D-UI. **첫 장(w25)이 스타일 키다.** w26 이후에는 합격 w25를 `Input image role: style reference only: copy its outline weight, block size, shading style and fill; do not copy its icons.`로 넣는다. 아이콘마다 **지정색 1 + 그 어두운 명암 1 + 외곽선 `#2B2233`**, 3색 이내. 지정색은 03 §4 값 그대로 적는다(정확 일치는 게임 양자화가 맞춘다). 대응 글자는 아이콘에 그리지 않는다(`ui_icons.map.json`, 게임).

| 번호 | 파일 | C-ICON 값 | 본문 |
| --- | --- | --- | --- |
| w25 | `ui_state_*_12` 12종 | `N=12, COLS=4, ROWS=3, S=12` | 아래 A |
| w26 | `ui_hp_*`·`ui_fat_*` 8 | `N=8, COLS=4, ROWS=2, S=16` | 아래 B |
| w27 | `ui_inj_*`·`ui_sp_*` 7 | `N=7, COLS=4, ROWS=2, S=16, EMPTY=the last cell of row 2 stays empty.` | 아래 C |
| w28a | 표식·태도·메뉴·슬롯·트레이 12 | `N=12, COLS=4, ROWS=3, S=16` | 아래 D |
| w28b | 배지·종료 표식 3 (12 × 12) | `N=3, COLS=3, ROWS=1, S=12` | 아래 E |

A (w25):

```
Twelve status glyphs, bold simple silhouettes readable at their real 12-pixel size, each with a clearly different outline shape: 1 house with a pitched roof #8C6E4B; 2 hammer beside a small pouch #B07A3A; 3 two footprints #6D8F5A; 4 short sword pointing up-right #C0603A; 5 folded map #3F8F8A; 6 arched door with two steps #6A5A8C; 7 small campfire #D98A2B; 8 house with an arrow pointing LEFT #5A7FA8; 9 small vial with a cross #4FA37A; 10 sealed scroll with an exclamation mark #7B5CC4; 11 open book with a sprout #A8894A; 12 two vertical bars #6C7A89.
```

B (w26):

```
Eight status icons; the SHAPE changes with each stage, not only the colour. Row 1, health: 1 full heart #5DA85D; 2 heart filled only in its lower three quarters, the top quarter empty inside the outline, #D8B04A; 3 heart filled only in its lower half #E0823A; 4 empty heart outline with a one-block vertical crack down its middle #D9534F. Row 2, fatigue: 5 thin crescent moon #9AA5B1; 6 half moon #C9A34A; 7 full moon with one small zigzag mark beside it #D9822B; 8 full moon with two small zigzag marks #D9534F. Zigzags are plain zigzag lines, never the letter Z.
```

C (w27):

```
Seven status icons: 1 one adhesive bandage strip, diagonal, #D9A441; 2 two bandage strips crossed #D9A441; 3 a bandaged forearm with a small cross #C8453C; 4 two vertical bars, the same shape as glyph 12 of the style reference, #6C7A89; 5 an hourglass #4A90C2; 6 a ring with a crack #8E4FA3; 7 a crescent moon with a single drop #A3243A.
```

D (w28a):

```
Twelve icons: 1 sealed scroll with a round seal #7B5CC4; 2 open book #A8894A; 3 round-topped shield silhouette #5A7FA8; 4 diamond-shaped compass needle #6D8F5A; 5 raised sword pointing straight up #C0603A; 6 three dots in a horizontal row #6C7A89; 7 sword lying diagonally #7D7B80; 8 breastplate #7D7B80; 9 plain ring #B07A3A; 10 small orb on a stand #8E4FA3; 11 acorn with its cap #8C6E4B; 12 the same acorn with one small round dot #7B5CC4 at its upper right.
```

E (w28b):

```
Three small emblems: 1 a lantern frame with NO flame, the glass empty and dull, #6E6862; 2 the same lantern lit, frame #B07A3A with a gold flame #FFE38A inside; 3 a crescent moon #B9C8FF. Lanterns 1 and 2 have exactly the same frame shape.
```

- 명암 색은 03 §4에 값이 없다(§17-29). 게임이 UI 확장 묶음에 등록한 명암으로 양자화한다.
- 합격: E1 E4 E6 E7 E11 + W11. `ui_sp_pause_16`과 `ui_state_pause_12`가 같은 모양이다. 켜진 등불과 꺼진 등불의 불 화소 차가 보인다.

---

## 10 아이템 아이콘 34 (AO-55~58, 24 × 24) — w29~w32

15에는 아이템 아이콘이 없고 카드가 24 × 24로 신설했다(P-04 승인 대기). 16 × 16 판은 B-02로 미뤄져 있다(§17-25). **첫 장(w29 무기)이 스타일 키**이고, P1의 무기·방어구 레이어가 합격했으면 **정체성 입력**으로 함께 넣는다(`Input image role: the in-game look of these items; match their shapes and colours.`).
조립: A-UI(`{24x24}`) + C-ICON(`S=24`) + 본문 + D-UI. 공통: 빛은 왼쪽 위, 아이콘당 4색 + 외곽선, 등급 표시(보석·광채) 없음.

| 번호 | 카드 | C-ICON 값 |
| --- | --- | --- |
| w29 | AO-55 무기 10 | `N=10, COLS=5, ROWS=2` |
| w30 | AO-56 방어구 7 | `N=7, COLS=4, ROWS=2, EMPTY=the last cell of row 2 stays empty.` |
| w31 | AO-57 장신구 5 · 유물 4 | `N=9, COLS=3, ROWS=3` |
| w32 | AO-58 소모품 8 | `N=8, COLS=4, ROWS=2` |

w29:

```
Ten weapon icons, each weapon alone, laid diagonally with the grip at lower left and the tip at upper right. Lengths in blocks exactly as listed so the length ranks are obvious: 1 rusty short sword 16, grey blade #7D7B80 with three or four rust blocks #B0603A and one missing notch in the top edge, a dark leather grip #5E3C24, no light wood colour anywhere; 2 short sword 16, silver blade #E8E6E0 #B4B2B0, leather grip #8E5E38; 3 dagger 10, the shortest, green cloth grip #6D8F5A; 4 longsword 22, blue grip #3E5A7E; 5 pickaxe 16, grey iron head #7D7B80, brown haft #8E5E38; 6 spear 22, ivory head #F0E6CC with a small fang-shaped metal ornament; 7 short sword 16 with a tiny bell, a trapezoid wider at the bottom, 3 by 3 blocks, hanging from the pommel #E0B06A; 8 longsword 22, silver blade with a one-block blue line #5A7FA8 along its middle; 9 longsword 22, dark two-tone blade #B4B2B0 #4C4A52 and a bronze guard #B07A3A; 10 bell maul 18, a bronze bell head three times as thick as the haft, with a one-block crack line.
```

w30:

```
Seven armour icons, front view: 1 quilted cream tunic with loose sleeves #F0E6CC #C8C2B8 and three small square patches; 2 SLEEVELESS tan leather vest #C08A58 #8E5E38 with two shoulder straps and a belt, cream undershirt showing two blocks at each shoulder; 3 dark leather armour #8E5E38 #5E3C24 with a blue belt #3E5A7E and a small leather cap above it; 4 heavy brown miner's coat #C08A58 #8E5E38 with a red scarf #B04A42 and a brimmed cap; 5 dark bat-leather hooded cloak #5E3C24 #4A3F55 whose hem is cut into three pointed scallops; 6 mismatched rusty plate #7D7B80 #4C4A52 #B0603A with one oversized pauldron on the left only; 7 BRONZE cuirass #E0B06A #B07A3A #7A4E24 with a bell silhouette on the chest and a one-block rim along its bottom edge, never any silver.
```

w31:

```
Nine small treasures: 1 a flat WOODEN whistle #C08A58 #8E5E38, a tube about 12 by 5 blocks with a round 3-block sound hole, a mouth opening, a ring on top and a short cord; 2 a leather cord #5E3C24 with three pointed ivory teeth #F0E6CC hanging down, the middle one longest, no beads; 3 a white feather #F0E6CC with a blue tip #5A7FA8; 4 a bronze lantern #E0B06A #B07A3A with a gold flame pane #FFE38A and a top ring; 5 ONE broken bell shard #B07A3A #7A4E24 with a jagged lower edge, never a whole bell; 6 a round jingle bell #E0B06A #B07A3A with a top ring and a one-block horizontal slit; 7 a round compass #B4B2B0 #4C4A52 with a red needle #B04A42 and a ring; 8 an ANGULAR square canteen of pale glass #B9C8FF with a leather shoulder strap #5E3C24 and one small gold star #FFE38A; 9 a footed silver chalice #E8E6E0 #B4B2B0.
```

w32:

```
Eight consumables. Items 1-5 are the SAME healing potion in five tiers: the liquid is always the same green #8FE0A0 in round glass #C8C2B8; tiers differ only by bottle size and attachments: 1 small flask 9 blocks tall with a cork; 2 flask 12 blocks tall; 3 flask 14 blocks tall with wide shoulders; 4 the tier-3 flask with darker liquid bands #6D8F5A and a two-block wax seal; 5 the tier-3 flask with one small gold star #FFE38A and a one-block glass highlight. 6 a cloth-wrapped ration bundle #8E5E38 #F0E6CC tied with string; 7 a rolled bandage #F0E6CC #C8C2B8 with a loose end; 8 a long-necked dark wine bottle, glass #4A3F55, wine #7A1F33, with a 3 by 3 pale-blue crescent #B9C8FF on its shoulder.
```

- 합격: E1 E4 E6 E7 E11 + W11. 16px로 줄여 봐도(게임 미리보기) W04·W08·W09, A06·A07, W07·W10·J05·R01, CP01~03이 서로 갈린다(카드 자동 기준은 정규화 뒤).

---

## 11 책 UI 부품 3 (AO-59, 15 §11) — w33

조립: A-UI(`{20x96}`) + C-FREE(`N=3`) + 본문 + D-UI. 세 부품을 **같은 블록 크기**로 한 장에 그려 크기 비율을 지킨다. 게임이 bbox로 자르고 9-slice 경계·팔레트 3개(은퇴·사망·긴 잠)를 정한다.

```
Three flat UI parts drawn with the same pixel-block size: 1 a book spine exactly 20 blocks wide and 96 blocks tall, leather #8E5E38 #5E3C24 with a #2B2233 border, an EMPTY 12 by 12 block square slot near the top for an emblem, two thin bands near the top and bottom, and plain vertical banding in the middle so it can be stretched sideways; no letters or title. 2 a shelf plank tile 16 by 16 blocks, wood #8E5E38 #5E3C24 with grain lines running horizontally so it tiles left to right. 3 a ribbon bookmark exactly 4 blocks wide and 16 blocks tall, red #B04A42 with a notched V end at the bottom.
```

- 합격: E4 E7 E11 + W11. 끈이 4 × 16 비율이다(1차 S8은 58 × 88). 책등 가운데를 가로로 늘여도 무늬가 깨지지 않는다.

---

## 12 초상 72 (AO-60~62, 15 §10) — w39~w45

초상은 정면 흉상이다. **주인공 초상은 스프라이트 마스터와 같은 사람**이어야 하고(W12), **NPC 초상은 NPC 전신 기준 시트 `n01`(PROMPTS §7.4)과 같은 사람**이어야 한다(15 §9.3 「NPC는 10절 초상과 같은 인물」). v1.0은 초상을 먼저 만들어 P3 장면의 입력으로 쓰게 했지만, v1.1은 순서를 **`n01` → NPC 초상**으로 정했다(주인공 초상이 스프라이트 마스터에서 나오는 것과 같은 방향. 이유는 PROMPTS §7.1). P3 장면은 초상을 기다리지 않는다.

부품 25장은 한 좌표계에서 겹쳐져야 하므로(AO-60) **완성 흉상 → 교체 편집 → 떼기**로 만든다. 48 판은 64 합성을 E-POR로 다시 찍은 뒤 **다시 뗀다**(64를 줄이지 않는다, 15 §10).

### 12.1 주인공 초상 마스터 — w39

조립: A-POR(`{64x64}`) + C-POR(`N=1, COLS=1, ROWS=1, S=64`) + 본문 + D. 입력 = 마스터 스프라이트.

**I-HERO-POR**

```
Input image role: identity reference: this is the same person, now drawn front-facing as a head-and-shoulders portrait with more detail. Copy its hair silhouette and colours, skin, eye shape and clothing; do not copy its pose or layout.
Front-facing bust of this youthful androgynous adventurer: short chestnut hair (HR01) #7A4E30 #553420 with the same fringe shape, medium warm skin #E3B48E #C88E68 #A0664A, a round face, round dark eyes two blocks wide and three tall with a one-block highlight, small eyebrows, a tiny mouth, calm neutral expression, ears visible. Cream quilted tunic collar #F0E6CC #C8C2B8 with a brown cord #8E5E38 at the neck. The head takes about three fifths of the bust height. Outline #2B2233. No helmet, no hat.
```

### 12.2 주인공 초상 부품 25 — w40~w42

조립: SW + 문장 + D (A·C 없음, 입력이 배치를 가진다). 교체 편집은 **한 칸을 여러 칸으로 늘리는** 편집이므로 첫 문장에 배치를 적는다.

| 번호 | 입력 | 교체 문장 (SW 뒤) |
| --- | --- | --- |
| w40 머리 6 | w39 | `Make a sheet of 3 columns by 2 rows of identical 64x64 cells. Every cell shows this exact bust at exactly the same position and size, identical except the hair and, in cells 3, 5 and 6, narrow eyes (two blocks wide, one block tall, slightly slanted). Hair per cell, all in the same chestnut #7A4E30 #553420: 1 HR01 short hair, as the input; 2 HR02 hair tied back in one tail; 3 HR03 chin-length bob; 4 HR04 curly hair; 5 HR05 two braids; 6 HR06 shaggy, messy hair.` |
| w41 표정 8 | w40 | `Make a sheet of 4 columns by 2 rows. Row 1 repeats cell 1 of the input (round eyes), row 2 repeats cell 3 (narrow eyes), same position and size. Only the eyes, eyebrows and mouth change. Columns: 1 neutral; 2 smile; 3 worry, brows raised in the middle; 4 resolve, determined brows and a firm mouth.` |
| w42 목깃·나이·장신구 9 | w39 | `Make a sheet of 3 columns by 3 rows, this exact bust in every cell at the same position and size, identical except: 1 the cream quilted cloth collar, as the input; 2 a tan leather vest collar with two straps #C08A58 #8E5E38 over the cream undershirt; 3 a grey metal plate gorget #B4B2B0 #7D7B80; 4 a tall black cloak collar #2E2438 lined with crimson #7A1F33; 5 veteran age: two grey blocks #9A948C at each temple and one wrinkle line at each eye corner; 6 elder: white hair #E8E4DC #C8C2B8, white eyebrows, two wrinkle lines at each eye corner and one on the forehead; 7 an old flat wooden whistle #C08A58 #8E5E38 on a cord around the neck; 8 a leather cord necklace with three pointed ivory rat teeth #F0E6CC; 9 a small broken bronze bell shard #B07A3A #7A4E24 on a cord.` |

떼기(X 뒤):

| 결과 | 입력 · 문장 |
| --- | --- |
| `por_hair_h01~h06` 6 | w40 · `Keep ONLY the hair in each cell.` |
| `por_face_round`·`narrow` 2 | w40의 1칸·3칸 · `Keep ONLY the bare head, ears and neck skin. Remove the hair, eyes, eyebrows, mouth and collar. Where hair covered the head, show a smooth bald skin-coloured head of the same size and outline.` (P1 L1 민머리와 같은 예외) |
| `por_expr_{base,smile,worry,resolve}_{round,narrow}` 8 | w41 · `Keep ONLY the eyes, eyebrows and mouth of each face, pixel for pixel.` |
| `por_collar_{cloth,leather,metal,vampire}` 4 | w42 1~4칸 · `Keep ONLY the collar and clothing below the neck.` |
| `por_wrinkle_{veteran,elder}` 2 | w42 5·6칸 · `Keep ONLY the wrinkle lines (and in cell 5 the grey temple blocks).` 노년 흰머리·흰 눈썹은 머리 팔레트(게임) |
| `por_jewel_{j01,j02,j05}` 3 | w42 7~9칸 · `Keep ONLY the item hanging at the neck and its cord.` |

- 머리카락은 밤색 한 벌로 그리고 머리색 8팔레트(게임)가 바꾼다. 얼굴형(둥근 눈·가는 눈)은 P1 얼굴 시트와 같은 모양이어야 한다(P1 §3.2가 합격했으면 w40에 둘째 입력으로 넣는다).
- 초상 표정 4종(기본·웃음·걱정·결연)은 동작 표정 5종(P1)과 목록이 다르다(AO-60). 섞지 않는다.

### 12.3 NPC 정체성 (PROMPTS §7로 옮김)

v1.0의 NB-01~NB-09는 P3의 외형표와 합쳐 PROMPTS §7.3 `[ID-N01]`~`[ID-N09]`가 되었다(NB-0n = `[ID-N0n]`). 외형은 거기서만 고친다. 초상에서는 문장의 괄호 `(Full body: …)`를 괄호째 뺀다. 합칠 때 달라진 점: 도담 머리 밤색 `#7A4E30`·피부 밝음, 유안 망토 녹색(길잡이 두건 색), 비엘 머리 은백 `#E8E4DC`(검은 망토 위 윤곽), 토리 모자 `#C08A58` + 윗부분 `#7A4E24`, 호각 나무 `#C08A58` `#8E5E38`, 미루 약초는 캐릭터 48색 안의 녹 `#6D8F5A` `#4D6A3E`. 모두 `임시`다(`OPEN_DECISIONS.md` OD-02).

### 12.4 NPC 초상 11 — w43·w44

w43 (9명): A-POR(`{64x64}`) + C-POR(`N=9, COLS=3, ROWS=3, S=64`) + 본문 + PROMPTS §7.3 `[ID-N01]`~`[ID-N09]`(괄호째 뺀 판) + D. 입력 = 이미지 1 w39(스타일), 이미지 2 `nref`(PROMPTS §7.4, 정체성).

```
Input image roles: image 1 is a style reference only: copy its pixel density, outline, shading, framing and proportions; do not copy the person. Image 2 is the identity reference sheet: its cells 1 to 9 are the nine people below in the same order; copy each person's hair, face, skin, colours and clothing exactly and draw them as front-facing busts; do not copy its layout, poses or its cells 10 and 11.
Nine different villagers, one per cell, in this order: cell 1 Hadel, 2 Boreum, 3 Miru, 4 Dodam, 5 Sena, 6 Dohan, 7 Yuan, 8 Biel, 9 Tori. Each keeps a neutral, characterful expression. Every person must be recognisable by silhouette alone: hair and headwear shapes all differ. No helmets.
```

w44 (추가 표정 2): w43을 SW + `Change ONLY the face of cell 5 (Sena) to a worried expression and the face of cell 8 (Biel) to a cold, resolute expression. Nothing else changes.` → 게임이 5칸 = `por_npc_n05_worry`, 8칸 = `por_npc_n08_resolve`.

### 12.5 48 × 48 판 36 — w45

w39~w44의 **합성 결과**(w40·w41·w42·w43·w44)에 E-POR를 적용하고, 결과에서 12.2의 떼기를 **다시** 한다. NPC는 떼기 없이 칸 그대로다.

- 합격: E1 E4 E6 E7 E8 E10 E11 E21 + W12 W13 W14. NPC는 9명을 나란히 놓고 역할이 구분된다(AO-61 육안). 흉상에 투구가 없다. NPC 초상을 `nref`와 나란히 놓고 같은 사람으로 읽힌다(W12).

---

## 13 합격 기준

### 13.1 PROMPTS E1~E12 적용

| 묶음 | 적용하는 E |
| --- | --- |
| 적 기준 시트·보스 시트 | E1 E3 E4 E5 E6 E7 E11 (E2는 「같은 개체」로 읽는다) |
| 교체 편집(변형·정예·상태·장소·점등·초상) | E4 E11 E21 + W3 |
| 떼기(층·소품·부품) | E8 E10 E11 E21 |
| 배경 합성 | E4 E7 E11 |
| 효과·날씨 | E1 E4 E6 E7 E11 |
| 소품 | E1 E3 E4 E6 E7 E11 |
| 아이콘·책 UI | E1 E4 E6 E7 E11 |
| 초상 | E1 E4 E6 E7 E11 (E9 대신 W12) |
| 32 규격 | E12 |

### 13.2 세계 쪽 새 기준 W1~W14 (P1의 E13~E19와 번호가 겹치지 않게 W를 쓴다)

| 번호 | 기준 |
| --- | --- |
| W1 | **적 실루엣 구분**: 들쥐·늑대·박쥐·코볼트·주인공을 실크기(32·48, 100%)로 검게 칠해 나란히 놓아도 3초 안에 구분된다(낮고 긴 몸+꼬리 / 큰 네발+귀·꼬리 / 떠 있는 날개 / 선 두 발+긴 귀+곡괭이). 코볼트는 주인공보다 확실히 작다 |
| W2 | **방향과 퇴장**: 모든 칸이 왼쪽을 본다(퇴장 행의 돌아선 칸 제외). 퇴장은 달아나는 모습이고 누워 끝나거나 다친 모습이 없다 |
| W3 | **교체 정합**: 편집 결과를 입력과 겹치면 차이가 지정한 색·부품 자리에만 있다. 윤곽·포즈·칸 위치가 1블록도 움직이지 않았다 |
| W4 | **보스 덩치·고정**: 코볼트 옆에서 넓고 낮은 덩치가 즉시 읽힌다. 대기 6칸에서 몸은 그대로이고 종만 움직인다. 균열 모양이 31칸 모두 같다 |
| W5 | **배경 명도**: 어두운 외곽선이 없고 `{DARKEST}`보다 어두운 색이 없다(순흑·자두색 외곽선 없음). 주인공 스프라이트를 x 16~64에 얹어도 묻히지 않는다 |
| W6 | **층 정합**: 뗀 층을 순서대로 겹치면 합성 장면과 같다. 지면선이 한 줄로 곧고 층마다 같은 높이다 |
| W7 | **가로 이음(육안)**: 띠 두 장을 이어 붙인 모습을 상상했을 때 지평·지면·하늘이 끊기지 않고, 가장자리에 걸친 물체가 없다. 오른쪽 절반이 조용하다 |
| W8 | **장소 소품**: 크기가 기본 장면의 나무·울타리와 어울리고 바닥이 지면선에 닿는다. 02 §6 키워드로 무엇인지 읽힌다. 글자가 없다 |
| W9 | **효과 형태**: FX1 가로로 넓음, FX3 세로 4각 별, FX5 마름모, FX2에 기호 없음, 파동은 1블록 두께 원호. 기준점이 칸마다 같다. 붉은색·흐림이 없다 |
| W10 | **소품 크기·상태**: 손 소품이 주인공 손 크기에 맞고(책·빵 기준), 놓는 소품은 바닥이 지면선에 닿는다. 상태 쌍은 바뀌는 부분만 다르다 |
| W11 | **아이콘 판독**: 실제 크기(12·16·24px, 100%)에서 하나하나 무엇인지 읽힌다. 단계 아이콘은 색만이 아니라 모양이 다르다. 지정색이 눈으로 맞다 |
| W12 | **초상-스프라이트 일치**: 주인공 초상이 마스터와 같은 머리 모양·머리색·피부·눈 모양이다. NPC 초상이 `nref`(PROMPTS §7.4)·P3 장면의 같은 인물과 같은 머리·옷·색이다 |
| W13 | **초상 부품 겹침**: 얼굴 바탕 + 표정 + 머리 + 목깃 + 장신구를 겹치면 합성 흉상과 같다. 눈·목 위치가 모든 칸에서 같다 |
| W14 | **48 초상**: 64 판보다 블록이 눈에 띄게 크고 다시 찍은 그림이다(매끈한 축소가 아니다). 같은 사람으로 알아본다 |

---

## 14 제작 순서

15 §13.2 단계 5~7을 따른다. 네 문서를 합친 순서는 PROMPTS §5.3이다. NPC 초상은 `n01`(PROMPTS §7.4) 뒤에 만든다. P3 장면은 NPC 초상을 기다리지 않는다. 번호 = 파일 이름 `w{번호}`.

| 번호 | 내용 | 요청 | 입력 | 선행 | 카드 | 15 단계 |
| --- | --- | --- | --- | --- | --- | --- |
| w01 | 늑대 기준 시트 18 | 생성 | 들쥐 합격본 | O02 | AO-32 | 5 |
| w02 | 박쥐 기준 시트 18 | 생성 | 들쥐 합격본 | O02 | AO-33 | 5 |
| w03 | 코볼트 합성 18 | 생성 | 들쥐 합격본, 마스터 | O02 | AO-34 | 5 |
| w04 | 코볼트 몸체·곡괭이 떼기 | 떼기 ×2 | w03 | w03 | AO-34·35 | 5 |
| w05 | EN02 교체 → 귀 떼기 | 교체, 떼기 | 들쥐 합격본 | — | AO-35 | 5 |
| w06 | EN04·06·07 색 목표(검토용) | 교체 ×3 | w01, w02 | w01·w02 | AO-36 | 5 |
| w07 | EN09·EN10 교체 → 모자·투구 떼기 | 교체 ×2, 떼기 ×2 | w03 | w03 | AO-35 | 5 |
| w08 | EB01·EB02 교체 → 뿔 투구·큰 곡괭이·수염·등불 떼기 | 교체 ×3, 떼기 ×5 | w03, w07a, (P1 c18) | w07, §17-6 | AO-35 | 5 |
| w09 | 정예 깃발 2 | 생성 | — | — | AO-35 | 5 |
| w10 | 마을 합성 → 3층 떼기 | 생성, 떼기 ×3 | 들판 합성 합격본 | PROMPTS §3.5 | AO-40 | 5 |
| w11 | 마을 창 불빛 | 교체, 떼기 | w10 | w10 | AO-40 | 5 |
| w12 | 장소 합성 PC-T·H1·H2·H3·H4·A1·A2 → 떼기 | 교체 ×7, 떼기 ×7 | w10, 들판 | w10 | AO-43 | 5~6 |
| w13 | 폐광 합성 → 3층 떼기 | 생성, 떼기 ×3 | 들판 합성 합격본 | PROMPTS §3.5 | AO-41 | 6 |
| w14 | 폐광 등불 2 | 교체 ×2, 떼기 ×2 | w13, (P1 c18) | w13 | AO-41 | 6 |
| w15 | 틈 먼 층 | 교체, 떼기 | w13 | w13 | AO-42 | 6 |
| w16 | 장소 합성 PC-H5·A3(2)·D2·D3 → 떼기 | 교체 ×5, 떼기 ×5 | w13, w10 | w13 | AO-43 | 6 |
| w17 | 날씨 입자·안개 | 생성 ×2 | — | — | AO-45 | 6 |
| w18 | FX1·FX3 | 생성 ×2 | — | — | AO-46 | 6 |
| w19 | FX2·FX5 | 생성 ×2 | — | — | AO-47 | 6 |
| w20 | FX4·FX6 | 생성 ×2 | — | — | AO-48 | 6 |
| w21 | 빵·자루·붕대 떼기 | 교체 ×2, 떼기 ×3 | 마스터, REF-A | REF-A 합격 | AO-49 | 6 |
| w22 | 손 소품 6·표시 4 | 생성 ×2 | 마스터 | — | AO-49 | 6 |
| w23 | 모닥불 4 | 생성 | 마스터 | — | AO-50 | 6 |
| w24 | 장면 소품 10 → 상태 편집 → 꺼진 등불 | 생성, 교체 ×4 | 마스터, (P1 c18) | — | AO-50 | 6 |
| w25 | UI 상태 12(스타일 키) | 생성 | — | — | AO-51 | 6 |
| w26~w28 | UI 8 · 7 · 12 · 3 | 생성 ×4 | w25 | w25 | AO-52~54 | 6 |
| w29 | 아이템 무기 10(스타일 키) | 생성 | (P1 무기 레이어) | P1 c14 권장 | AO-55 | 6 |
| w30~w32 | 아이템 방어구·장신구·소모품 | 생성 ×3 | w29, (P1 방어구) | w29 | AO-56~58 | 6 |
| w33 | 책 UI 3 | 생성 | — | — | AO-59 | 7 |
| w34 | 보스 정체성 1 | 생성 | w03 | w03 | AO-37 | 7 |
| w35·w36 | 보스 시트 18 + 13 | 생성 ×2 | w34 | w34 | AO-37 | 7 |
| w37 | 균열 마스크·균열 겹침 | 떼기, 교체, 떼기 | w35, w34 | w35 | AO-38 | 7 |
| w38 | 보스 파동 4 | 생성 | — | — | AO-38 | 7 |
| w39 | 주인공 초상 마스터 | 생성 | 마스터 | — | AO-60 | 7 |
| w40~w42 | 초상 머리·표정·목깃/나이/장신구 → 떼기 | 교체 ×3, 떼기 ×6 | w39 | w39 | AO-60 | 7 |
| w43·w44 | NPC 9 + 표정 2 | 생성, 교체 | w39, `n01` | w39, `n01` | AO-61 | 7 |
| w45 | 초상 48 판 → 다시 떼기 | 밀도 ×5, 떼기 ×6 | w40~w44 | 64 판 합격 | AO-62 | 7 |

- 한 번호가 §13 기준을 통과하지 못하면 프롬프트를 고쳐 다시 생성하고 다음 번호로 넘어가지 않는다(ASSET_ORDERS §1.2). 같은 표면 지적이 두 번 반복되면 세 번째 수정 전에 구조를 다시 본다(원인 한 줄 + 다른 방법).

---

## 15 진행표

진행 상태는 PROMPTS §6.3 한 곳에만 적는다(v1.1에서 옮겼다).

---

## 16 수량 대조 (15 §13.1, 한 규격 기준)

| 15 §13.1 항목 | 15 수량 | 이 문서 | 다른 곳 | 비고 |
| --- | ---: | ---: | --- | --- |
| 적 4계열 × 18 | 72 | 54(늑대·박쥐·코볼트) | 들쥐 18 = PROMPTS P0 | ✅ 72 |
| 적 소품 | 22 | 22 | — | 곡괭이 5·큰 곡괭이 5·귀·모자·녹슨 투구·뿔 투구·수염·등불·깃발 각 2. 떼기 결과는 18칸 층이라 게임이 고른다(§17-8) |
| 보스 | 35 | 35 | — | 본체 31 + 파동 4. 카드의 균열 겹침 1·종추 6은 15 밖(§17-10) |
| 효과 | 32 | 32 | — | FX1 4·FX2 6·FX3 4·FX4 8·FX5 4·FX6 6 |
| 소품 | 43 | 41 | 책 2 = PROMPTS P0 | ✅ 43 |
| 이벤트 장면 | 80 | 0 | P3 | 소품·장소 입력은 이 문서가, NPC 입력은 PROMPTS §7.4 `n01`이 준다 |
| 배경 타일 | 10장 | 7 | 들판 3 = PROMPTS P0 | ✅ 10. 점등 겹침 2장(창·등불)은 15 밖(P-15) |
| 배경 장소 소품 | 약 20 | **20** | — | §5 확정안 |
| 초상 | 72 | 72 | — | 부품 25 + NPC 11 = 36 × 2크기 |
| UI 아이콘 | 42 | 42 | — | 12 + 8 + 7 + 15 |
| 책 UI 부품 | 3 | 3 | — | 팔레트 3은 게임 |
| 팔레트·변환표 | 약 69 | 0 | 게임(D56 8번) | 변형 색 목표(w06·w07·w08)만 검토용으로 만든다 |
| (15에 없음) 아이템 아이콘 | — | 34 | — | 카드 신설(P-04) |
| (15에 없음) 날씨 | — | 입자 4(+2)·안개 1 | — | AO-45. 흰빛 덮기는 그리지 않는다 |

---

## 17 확인 필요

`docs/art/OPEN_DECISIONS.md`로 옮겼다(v1.1). 본문의 「§17-n」은 그 표의 `옛 번호` 열 `P2-17-n`으로 찾는다. 이 정리에서 닫은 것: 20(공통 블록 충돌 → PROMPTS D-BG·이 문서 D-MARK, OD-63), 21(NPC 외형 → 02 §8, OD-38), 23(호각 = 나무, OD-33), 31(P3와 공유하는 모양 → PROMPTS §5.3 순서, OD-66) 등. 각 항목의 상태는 그 표에 있다.
