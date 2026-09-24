# P2_world — 세계 쪽 에셋 프롬프트 (적·보스·배경·장소 소품·날씨·효과·소품·아이콘·책 UI·초상)

버전 1.4 · 2026년 9월 24일 · 대상: 이미지 생성 모델을 쓰는 제작 AI
1.4(배경만): 장소 × 계절 × 시간대를 기본 장면 편집으로 모두 그린다(D72). §4 전면 교체(템플릿 `bg_strip` 수치, 기본 15·패널 37, 계절·시간대·세대 특징·색조 편집, 먼 층 FILL, 점등 7), §5 장소 소품 없앰, C-BG 수치·C-BGP 추가, §0·§13 W7·§14 w10~w16·§16 배경 줄 갱신.
1.3: 배경 품질 기준 v04 네 지역 합성(D71). C-BG에서 평탄·저대비·오른쪽 절반 비움 문장 삭제, §4를 띠 자르기 → 이음 판 → 불 끈 판 → 층 떼기로 교체.
1.2: `OPEN_DECISIONS.md` 사용자 결정(2026-09-24, 권장안) 반영 — 48 규격만(D64), 배경 가로 이음·장면 떨림은 두 번 실패 뒤 정규화가 자르기·옮기기(D66), 장소 소품 20·정예 깃발 16 × 16·입자 스프라이트·흰빛 덮기 파일 없음·박쥐 색·변형 둘째 톤·마을 중간 층 승인, 종추 별도 파일 없음.
1.1: PROMPTS v1.2 정합 — D-BG를 PROMPTS §1로 옮김, 표시용 D-MARK 추가, SW에 색 유지 문장, NPC 정체성 블록(NB)을 PROMPTS §7로 합치고 NPC 초상은 NPC 전신 기준 시트 `n01`에서 만듦, 호각은 나무, 같은 소품의 색을 카드(AO-19·49·50)에 맞춤, 진행표·확인 필요를 PROMPTS §6.3·`OPEN_DECISIONS.md`로 옮김.
상위 문서: `docs/art/PROMPTS.md` v1.3(이하 **PROMPTS**). 공통 블록 A~E·D-BG·S, 떼기 머리말 X(§3.2), 육안 기준 E1~E12·E21, NPC 외형(§7)은 PROMPTS에 있고 여기서 다시 적지 않는다. 색인·전체 제작 순서는 PROMPTS §5, 진행표는 PROMPTS §6.3이다. 캐릭터 쪽은 `P1_character.md`(이하 **P1**), 이벤트 장면 20개는 `P3_scenes.md`(이하 **P3**)가 가진다.
제작 방식은 `ASSET_ORDERS.md` §0.0(D56): 이미지 생성·편집만 쓰고, 코드로 그리기·자르기·축소·배경 제거·복제를 하지 않는다. 규칙·수치는 `docs/design/15_아트_스프라이트_사양.md`(이하 **15**)가 소유한다. 카드 안 프롬프트보다 이 문서가 우선한다. 카드(AO-xx)와 15가 다른 곳은 `docs/art/OPEN_DECISIONS.md`(옛 번호 `P2-17-n`)에 있고, 2026-09-24 사용자 결정(권장안)으로 닫혔다. 이 문서는 그 결정을 반영했다.

---

## 0 범위와 쓰는 법

### 0.1 범위

15 §13.1에서 **캐릭터 소계(388)와 이벤트 장면(80, P3)을 뺀 나머지 전부**다. P0에서 이미 PROMPTS가 가진 것(들쥐 EN01 48 `08-rat18-48-r3` 합격, 들판 3층 AO-39 §3.5, 책 AO-49 2칸, 그림자 AO-01)은 다시 쓰지 않고 입력으로만 쓴다.

| 묶음 | 15 §13.1 | 카드 | 이 문서 절 |
| --- | --- | --- | --- |
| 적 4계열 · 적 소품 · 변형·정예 | 72 · 22 | AO-31~36 | §2 |
| 보스 EB03 | 35 | AO-37·38 | §3 |
| 배경 그림 · 점등 겹침(D72) | 456(띠 149 · 패널 307) · 7 | AO-39~42 | §4 |
| 배경 장소 소품 | 0(D72, 기본 장면에 그린다) | AO-43 | §5 |
| 날씨 | (8.3 날씨 입자) | AO-45 | §6 |
| 공용 효과 6종 | 32 | AO-46~48 | §7 |
| 소품 24종 | 43 | AO-49·50 | §8 |
| UI 아이콘 | 42 | AO-51~54 | §9 |
| 아이템 아이콘(15에 없음, 카드 신규) | — | AO-55~58 | §10 |
| 책 UI 부품 | 3 | AO-59 | §11 |
| 초상(부품 25 + NPC 11) × 2크기 | 72 | AO-60~62 | §12 |

- 팔레트(AO-36 등)와 `fx_lantern_glow`(P1 c20)는 여기서 그리지 않는다. 배경의 계절·시간대는 변환표 없이 **기본 장면을 편집해 모두 그린다**(15 §8, D72).

### 0.2 이 문서의 다섯 가지 요청

| 종류 | 무엇 | 조립 |
| --- | --- | --- |
| **생성** | 계열 기준 시트, 합성 장면, 새 소품·효과·아이콘 | A(또는 A-UI·A-POR) + 정체성 블록 + C 계열 + 본문 + D 계열 |
| **교체 편집** | 합격한 시트를 입력으로 넣고 **색을 바꾸거나 부품을 더한다**(변형·정예·상태·장소 소품·점등) | SW + 문장 + D 계열 |
| **떼기** | 합성 결과에서 **그 부품·층만 남긴다**. 보이는 화소만 | X(= PROMPTS §3.2 머리말) + 떼기 문장 |
| **밀도 편집** | 초상 48 판(E-POR). 32 규격(PROMPTS E)은 폐기(D64) | E-POR |
| **상태 편집** | 닫힘 → 열림처럼 **바뀌는 부분만** 다시 그린다 | SW + 문장 + D 계열 |

원칙은 PROMPTS §0.2와 같다. **같은 이미지에서 나온 것끼리만 위치가 맞는다.** 그래서
- 적 변형·정예 소품은 계열 기준 시트를 **편집**해 입히고, 입힌 결과에서 **뗀다**(계열 시트와 칸이 맞는다).
- 배경은 장소마다 **기본 장면 한 장**을 그리고 계절·시간대 변형을 그 편집으로 만든다. 층은 기본에서 한 번 떼고, 변형은 도구가 기본의 층 마스크로 자른다. 점등 겹침은 켠 편집과의 차이로 뗀다(§4, D72).
- 두 상태 소품(상자·문·함정 등)은 첫 상태를 생성하고 **상태 편집**으로 둘째 상태를 만든다.

### 0.3 저장

PROMPTS §0.3 그대로. 파일 이름은 `assets/_imagegen/{판}/w{번호}-{이름}-{규격}.png`(w = world)와 같은 이름 `.prompt.txt`. 번호는 §14 제작 순서표의 번호다. 떼어 낸 결과는 `README.md`에 **어느 합성에서 뗐는지** 적는다.

### 0.4 규격

규격은 **48 × 48 하나**다(O02 결정 2026-09-24, D64, `ASSET_ORDERS.md` §1.1). 32 규격은 만들지 않는다. 배경·아이콘·초상은 규격 구분이 없다(초상은 64와 48을 둘 다 만든다, §12).

### 0.5 게임 쪽 정규화가 맡는 것 (D56)

제작 AI는 하지 않는다. 프롬프트가 이것을 대신하려고 억지 수치를 요구하지 않는다.

| 정규화 | 내용 |
| --- | --- |
| 자홍 키 | `#FF00FF`를 투명으로(`imagegen.map.json` key·tolerance) |
| 격자·정렬 | 칸 나누기, 지면선·가로 중심 맞춤(`align`), 장소 소품·효과의 bbox 자르기. 무기는 넓힌 무기 셀 80 × 64(15 §12.2) |
| 색 | 등록 팔레트로 양자화, 인덱스 배정(표지 색 → 전용 인덱스, P1 §1.5와 같은 방식) |
| 알파 | 2값화. 반투명이 허용된 파일(그림자·빛 원·안개)은 **불투명으로 받은 뒤** 알파를 준다 |
| 팔레트 | 변형 팔레트 12, 책등 3. 배경 변환표·장소 팔레트는 없다(D72) |
| 가로 이음 | A17 검사. 먼저 다시 생성한다. 같은 기본 장면이 두 번 어긋나면 캔버스 1920 × 1024, 띠 1920 × 384(320 블록, S = 6 그대로, 같은 y 320~703)로 다시 생성하고, 정규화가 좌우 끝이 맞는 256 폭 구간을 골라 **모든 층과 모든 변형에 같은 구간으로** 자른다(15 §12.2, D66, OD-07 결정). 변형은 기본을 편집하므로 이음을 다시 맞추지 않는다. 새 화소는 그리지 않는다 |

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

**C-BG 배경 띠** (PROMPTS §3.5의 띠 문장 + 배경 외곽선 규칙을 한 블록으로. v1.4: 템플릿 `bg_strip` 수치, §4.0)

```
LAYOUT: canvas 1536 x 1024 pixels. The scene is ONE horizontal pixel-art strip exactly 1536 x 384 pixels, from y 320 to y 703, full canvas width; every pixel above y 320 and below y 703 is one flat #FF00FF color and nothing is drawn there. One logical block is 6 x 6 pixels, so the strip is one side-view scene 256 blocks wide and 64 blocks high. The walkable ground surface is one perfectly straight horizontal line at block row 56 (image y 656) across the whole strip. The leftmost and rightmost columns continue into each other so the strip tiles: no object touches or crosses the left or right edge, and the horizon and the ground meet both edges at the same height and colour.
DETAIL AND STYLE: match the attached quality reference exactly in pixel-block size, detail density and rendering: clustered foliage with several shades, visible material texture on walls, roofs, wood and stone, overlapping terrain layers with depth, deliberate small pixel details (flowers, pebbles, planks, crystals). Spread interesting shapes across the WHOLE strip; do not leave empty halves. Shading uses darker shades of the same hue; small dark accents are fine, but no pure black and no large area darker than {DARKEST}. Do not place a long row of large brown rounded shapes right above the ground line at character height (they swallow a brown-haired character standing in front).
```

**C-BGP 배경 패널 두 장** (v1.4, 발견 지점·던전 특수 방, §4.6)

```
LAYOUT: canvas 1536 x 1024 pixels. One horizontal band exactly 1536 x 384 pixels, from y 320 to y 703; every pixel above y 320 and below y 703 is one flat #FF00FF color and nothing is drawn there. One logical block is 6 x 6 pixels. The band holds TWO separate finished side-view scenes side by side, each 768 x 384 pixels (128 x 64 blocks): scene L fills x 0-767 and scene R fills x 768-1535, meeting at a hard vertical cut at x 768; nothing crosses the cut and the two scenes share no objects. In each scene the walkable ground surface is one straight horizontal line at image y 656, and the floor in front stays open: no tall object stands on the ground line between blocks 16 and 120 of that scene; large features stand behind, in the upper part, or at the scene's outer edge.
DETAIL AND STYLE: match the attached quality reference exactly in pixel-block size, detail density and rendering: clustered foliage or rock with several shades, visible material texture, overlapping layers with depth, deliberate small pixel details. Shading uses darker shades of the same hue; no pure black and no large area darker than {DARKEST}.
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

**I-BAT** — 날개막 3색과 눈 색은 **박쥐의 다른 곳에 쓰지 않는 색**으로 둔다. 게임 정규화가 그 색을 인덱스 5·6·7·12로 옮겨 EN06·EN07 팔레트를 바꾼다(AO-33·36, P1 §1.5 표지 색과 같은 방식). EN05의 막·눈 색은 승인되어 카드 AO-33에 들어갔다(OD-13 결정).

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

- EN04·EN07·EN09·EN10 교체 색은 승인되어 15 §7.2에 들어갔다(OD-12 결정). EB01 「한 톤 짙게」는 새 색 2개를 `pal_master.json`에 등록하기로 했지만 **값은 아직 정하지 않았다**(OD-12, 사용자 확인 대기). 편집 문장의 `(see note)` 자리는 `#9AA85A becomes {EB01 본색} and #6E7A5A becomes {EB01 그늘}`로 바꾼다. 값이 정해지기 전에는 w08a를 **소품 떼기 원본**으로만 쓰고 색은 보지 않는다.
- 등불은 P1 c18(J04 등불)과 같은 모양이어야 한다. P1 c18이 합격했으면 **둘째 입력 이미지**로 넣고 `the same lantern design as the second input image, at the kobold's scale`를 덧붙인다.
- 정예 외곽선 `#7A5A1E`는 게임 팔레트가 외곽선 인덱스를 바꿔서도 낸다. 편집본은 색 목표와 소품 원본이다.
- 합격: 모든 편집 W3(겹쳐 보면 윤곽이 같고 차이는 지정한 색·부품에만), E4 E11. 떼기 E8 E10 E11.

### 2.5 정예 깃발 (AO-35 `elite_flag`) — w09

**깃발 전용 16 × 16 셀**이다(OD-30 결정, 15 §7.2, 카드 AO-35·`assets.manifest.json` `enm_prop_elite_flag_48`). 정예는 코볼트 두 종만이 아니라 층의 `관문 잔당`(01 §8.2, 박쥐 포함)에도 붙으므로 계열 셀에 묶지 않는다.
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

w38 본문:

```
A bell's sound shockwave, 4 frames, 120 ms each: three thin concentric arcs, each exactly ONE block thick, bulging toward the LEFT, spaced four blocks apart. The outermost arc's radius grows 12, 18, 24, 30 blocks over frames 1 to 4. Colours #FFE38A, #FFFFFF, #B07A3A only. Arcs are clipped at the cell edge. No red, no dust, no blur.
```

- 파동 셀은 보스 셀 64 × 56이다(반지름 30이 48 셀에 들어가지 않는다, OD-60, 카드 AO-38 고침). 종추는 본체에 그리고 별도 파일을 만들지 않는다(OD-59).
- 합격: w34~36 E1 E3(대기 전체) E4 E5 E6 E7 E11 + W4. w37 E8 E10. w38 E1 E4 E6 E7 + W9.

---

## 4 배경 (AO-39~42, 15 §8) — v1.4: 장소 × 계절 × 시간대, 기본 장면 + 편집 (D72)

규칙과 수량은 15 §8·§13.1이 가진다. 이 절은 문장과 순서만 가진다. 장소마다 **기본 장면(`여름 · 낮`) 한 장**을 생성하고, 계절과 시간대는 기본을 **편집**해 그린다. 색 변환표는 쓰지 않는다. 층 마스크는 기본에서 한 번 떼고 변형은 도구가 그 마스크로 자른다(15 §8.5).

### 4.0 공통

**품질 기준 입력** — 모든 기본 장면 생성에 `assets/_imagegen/v04/bg-four-regions-quality-r2.png`를 넣고 본문 앞에 붙인다(편집에는 넣지 않는다. 입력 그림이 기본 장면이다):

```
Input image role: quality and style reference only: match its pixel-block size, detail density, shading and colour richness. Do not copy its layout or objects.
```

**수치 블록** — C-BG(띠)·C-BGP(패널, §1.2)의 LAYOUT 줄이 이 값을 가진다. 템플릿 `docs/art/templates/bg_strip.*`와 같다.

| 값 | 띠 | 패널 |
| --- | --- | --- |
| 캔버스 | 1536 × 1024 | 같음 |
| 그림 자리 | y 320~703, 전체 폭 1536 × 384 | 같은 자리를 왼쪽 x 0~767, 오른쪽 x 768~1535 두 장으로 |
| 배율 S | 6(1블록 = 6 × 6 화소), 256 × 64 블록 | 6, 한 장 128 × 64 블록 |
| 지면선 | 논리 y 56 = 이미지 y 656, 한 줄로 곧게 | 장마다 이미지 y 656 |
| 그림 밖 | `#FF00FF` 한 색. 아무것도 그리지 않는다 | 같음. 짝 없는 패널은 오른쪽 절반도 `#FF00FF` |
| 이음 | 좌우 끝이 이어진다 | 없음(x 768에서 딱 끊는다) |
| 비울 바닥 | 없음(흐르므로 판독 검사로 지킨다) | 장마다 캐릭터 x 16~64, 적·소품 x 72~120 앞 바닥에 키 큰 물체 없음 |

- `{DARKEST}` = `#4C4A52`(L* 약 32. 외곽선 `#2B2233` L* 약 15보다 15 이상 밝다, 15 §2.3). 모든 배경 공통.
- **관문 검사**: 생성·편집 결과마다 `pnpm art:gate <결과 PNG> --spec bg_strip`(패널 두 장은 `--spec bg_panel2`, 짝 없는 패널은 `--spec bg_panel1`)을 돌려 통과해야 다음 편집으로 간다. 캔버스 크기, 그림 자리 밖이 `#FF00FF` 한 색인지, 지면선 높이, 띠 좌우 이음(패널은 x 768 끊는 선)을 본다. 명령 형식은 `tools/art-check` `gate`(`--spec <시트>`)를 따르고, 배경 시트 이름 셋은 도구 쪽 `template-spec`에 들어올 이름이다(임시).
- **D-BG 변형**(PROMPTS §1 D-BG가 막는 것을 그려야 할 때만, 해당 단어만 뺀 판):

| 블록 | 쓰는 곳 | 문장 |
| --- | --- | --- |
| D-BG | 기본 장면(A2 제외), 계절 편집, 먼 층 채움, 세대 특징(`bats` 제외) | PROMPTS §1 D-BG 그대로 |
| D-BG-SKY | 시간대 편집, A2 기본 장면(안개 띠), 틈 색조 | `Do NOT draw: text, letters, numbers, signs with writing, arrows, grid lines, borders, frames, watermark, characters, people, animals, enemies, blood, sun disc, light rays, lens flare, bloom, soft glow halos, gradients, vignette. Output only the finished strip.` |
| D-BG-LIT | 점등 편집(마을 창, 폐광 등불) | `Do NOT draw: text, letters, numbers, signs with writing, arrows, grid lines, borders, frames, watermark, characters, people, animals, enemies, blood, light rays, bloom, glow or halo outside a window or lantern frame, gradients, vignette. Output only the finished strip.` |
| D-BG-BAT | D1 세대 특징 `bats` | D-BG에서 `animals, `를 `animals other than the small hanging bats, `로 바꾼 판 |

- **KEEP 문장** — 계절·시간대·색조 편집의 문장 끝에 붙인다:

```
Keep every silhouette, building, object and the ground line exactly where they are and exactly the same shape; change only colours and surface details inside existing shapes, and the sky. Do not add, move or remove objects.
```

### 4.1 기본 장면 15 (띠) — 생성

조립: A(`{256x64}`) + 품질 기준 입력 문장 + C-BG + `SCENE:` 문장 + `Summer, full daylight. All windows and lanterns are unlit.` + D-BG(A2는 D-BG-SKY). 운명 장소 둘은 `Summer, full daylight` 대신 `Cool dim underground light.`, 폐광·틈은 `Cool even underground light, lantern hooks unlit.`을 붙인다.

| 세트 | 장소 | `SCENE:` 문장 | 층 마스크(먼 / 중간 / 가까운) |
| --- | --- | --- | --- |
| `bg_town` | T00 | `Acorn Ford village beside a shallow ford. Five buildings spread evenly across the whole strip, each about 40 blocks wide: an inn with a round brown acorn-cap roof and flower boxes; a guild outpost with a green banner showing a plain forked-road mark and a blank notice board; a clinic made of a white canvas tent beside a small hut and a wooden water wheel; a smithy with a black chimney, an anvil and a sword on the wall; a general store with bundles of dried herbs under its eave and a short clothesline. Behind them a low stone bridge over the ford, trees and layered hills.` | 야외 |
| `bg_river_meadow` | H1 | `Ford-side meadow where every adventurer first fights. Ankle-high bright yellow-green grass with clover, a shallow sparkling ford across the midground with flat stepping stones, reeds at the water's edge, a short wooden fence, a small pile of acorns by a burrow. Rolling hills and a tiny far village behind.` | 야외 |
| `bg_willow_bank` | H2 | `Willow embankment. Two weeping willows with drooping leaf curtains, a raised earthen dike path with a sloping bank, a wooden water wheel beside a broken sluice gate, duckweed on still water.` | 야외 |
| `bg_wolf_hill` | H3 | `Wolf hill: a windy rocky hilltop with tufts of silver grass, round boulders and a ruined stone beacon tower; the distant ridge line sits higher than on lowland maps; cloud shadows on the slopes. Tawny yellow-brown grass.` | 야외 |
| `bg_slag_valley` | H4 | `Slag valley: grey heaps of mine slag like small hills, rusty rails on wooden sleepers, a collapsed wooden ore-sorting shed, an abandoned handcart tilted on one wheel, a few tiny yellow flowers. Desaturated grey-brown colours, dusty air in the distance.` | 야외 |
| `bg_mine_gate` | H5 | `Inside the old main entrance of the bell mine. A huge half-collapsed wooden mine gate, broken timber supports, a mine cart half buried in black dust, one blank rusty warning plate. Near the right end of the far wall a tall opening shows daylight outside and the silhouette of a distant empty bell tower; the opening does not touch the strip edge.` | 지하 |
| `bg_river_path` | A1 | `Ford field road around the village: a dirt country road, a wooden signpost with blank arms, a small water mill, a small stone wayside shrine with a little roof, a hill of wildflowers, a small wooden footbridge over a brook.` | 야외 |
| `bg_mist_trail` | A2 | `Misty mountain trail on a steep slope: pine trees, a moss-covered stone milestone, a rope suspension bridge between two cliffs, the chimney of the old mine on a far ridge, pale flat mist bands in the far layer with hard stepped edges. Cool dark greens.` | 야외 |
| `bg_miner_village` | A3 | `Abandoned miners' village in the mountains: houses with caved-in roofs and empty window frames, a round stone well, an empty stone bell tower with no bell, a blank miners' roster board, a rusty pickaxe in a yard, tall grass overgrowing the walls. Dusty desaturated colours.` | 야외 |
| `bg_mine_upper` | D1 | `Upper level of the bell mine, still showing human care: timber support frames, cart rails on wooden sleepers along the floor, empty lantern hooks, small broken bronze bell shards on the floor, a side tunnel branching off into darkness.` | 지하 |
| `bg_mine_mid` | D2 | `Middle level of the bell mine, a wide excavation hall: an underground stream in a stone channel, rusty metal pipes along the wall, a cold stone hearth with no fire, an ore wagon, streaks of blue ore #5A7FA8 in the rock. Blue-grey colours.` | 지하 |
| `bg_mine_deep` | D3 | `Deep level of the bell mine where lantern light does not reach far: deep shadows, blue crystal veins, a giant broken bronze bell fragment lying on its side, a stone pillar carved with rows of short notches, a jagged crack in the ceiling. The darkest map, still no colour darker than {DARKEST}.` | 지하 |
| `bg_rift` | A4 | `The Pathshift Rift beyond a collapsed deep mine wall: blue-violet cave walls, a slender jagged crack leaking starlight with a tiny star-speckled sky inside, small stone shards floating in the air, a ruined stone arch, thorny vines with small black roses.` | 지하 |
| `bg_star_spring` | 별잠 샘(F02) | `The edge of the Starsleep ruins inside the rift: a clear spring in a round stone basin carved with star patterns, small stone shards floating above it, a starlight crack in the wall behind, very still.` | 한 장 |
| `bg_moonshade_cellar` | 달그늘 지하(F03) | `The cellar beneath the Moonshade estate: stone steps coming down at the left, a long wooden table, cold unlit candlesticks, thorny vines with black roses on the stone walls, a cool dim stillness.` | 한 장 |

- 별잠 샘은 소품 `prop_star_spring`(§8, w24)이 합격했으면 그것을 **모양 참고 입력**으로 더 넣는다(`Input image role: the spring basin must match this prop's shape and colours.`). P3 ES10·ES11·ES19는 이 두 띠를 장소 입력으로 쓴다.
- T00 시설 다섯은 15 §8.3대로 띠 전체에 나눈다. 갈색 둥근 지붕은 여관 하나뿐이다(C-BG 마지막 문장).

**층 떼기** (기본 장면만. 변형은 도구가 마스크로 자른다)

| 묶음 | 중간 층 X 문장 `Keep ONLY …` | 가까운 층 X 문장 `Keep ONLY …` | 먼 층 FILL `{FAR}` |
| --- | --- | --- | --- |
| 야외 | `the buildings, trees, bridges, fences, rocks, water and all objects standing between the distant background and the walking path` | `the walking path from the ground line down to the strip bottom, with its edge grass and stones` | `the sky, clouds, distant mountains, far hills, far trees and far buildings` |
| 지하 | `the support frames, gates, carts, posts, pipes, pillars, crystals, arches, vines and all objects standing in front of the back wall` | `the floor band from the ground line down to the strip bottom, with its rails and stones` | `the back cave wall, the ceiling, the deep cave silhouettes, and for H5 the daylight opening with the distant bell tower` |

- 조립: 중간·가까운 층은 X(PROMPTS §3.2) + 문장. 먼 층은 아래 FILL 머리말.

**FILL 먼 층 채움 머리말** (기본 장면과 모든 변형에 한 번씩)

```
Use case: edit of the provided background strip. Keep the exact canvas, the strip position and the flat #FF00FF outside the strip. Keep ONLY the far layer: {FAR}. Remove every middle and near object and paint what the far layer shows behind them, continuing its shapes, colours, season and time of day seamlessly. Every far-layer pixel that was already visible keeps its exact colour. Everything that is not far layer becomes the same flat #FF00FF. No new objects.
```

- 도구는 FILL 결과에서 **기본의 중간·가까운 층 마스크 안 화소만** 가져온다. 나머지 먼 층 화소는 변형 그림에서 마스크로 자른다(15 §8.5).

### 4.2 계절 편집 3 × 야외 8 — 입력 = 그 장소의 기본 장면

조립: SW(§1.4) + 계절 문장 + KEEP + D-BG. 여름은 기본 그대로다.

| 계절 | 문장 |
| --- | --- |
| 봄 `spring` | `Make it early spring: grass and leaves turn fresh light green #8FC06A, tree crowns look lighter and younger, small white and pale pink blossoms appear on the trees, and small wildflowers dot the meadow and verges.` |
| 가을 `autumn` | `Make it autumn: tree leaves turn orange, amber and brown (#C8783A, #B8A04A, #8E5E38), grass turns golden #B8A04A, a thin layer of fallen leaves lies on the ground surface and on roof tops.` |
| 겨울 `winter` | `Make it winter: snow #E8EEF2 with #FFFFFF highlights covers the ground surface, roof tops, wall tops, rocks and fences; tree foliage becomes snow-laden, white on top of the existing leaf clusters; water turns darker and freezes at the edges. No falling snow.` |

### 4.3 시간대 편집 3 × 계절 4 × 야외 8, 그리고 H5 — 입력 = 그 계절의 낮 그림

조립: SW + 시간대 문장 + KEEP + D-BG-SKY. **순서: 계절 먼저, 시간대 나중**(기본 → 계절 낮 → 계절 시간대). 편집 두 번을 넘기지 않는다. 낮은 계절 편집 결과 그대로다.

| 시간대 | 야외 문장 | H5 문장(바깥 빛 구멍만) |
| --- | --- | --- |
| 새벽 `dawn` | `Make it dawn: the sky turns pale pink and gold near the horizon, fading to soft blue above; the distant layers become cooler and paler with one thin flat mist band low in the far layer; only the tops of shapes catch a faint warm light from the left. Windows and lanterns stay unlit.` | `Only the daylight opening changes: it shows a pale pink and gold dawn sky, and the rock right around it catches a faint warm light. Everything else stays exactly as it is.` |
| 해질녘 `dusk` | `Make it dusk: the sky turns orange and warm purple with a few lit cloud edges, the distant hills turn violet, the tops of shapes catch warm orange light and the rest is one shade darker. A few tiny distant windows in the far layer may glow warm; windows and lanterns in the middle and near layers stay unlit.` | `Only the daylight opening changes: it shows an orange and purple dusk sky, and the cave inside is one shade darker.` |
| 밤 `night` | `Make it night: the sky becomes deep blue with a small round moon and scattered one-block stars; everything is lit by cool moonlight, one to two shades darker and bluer, but the band from the ground line up to character height stays readable and no colour is darker than {DARKEST}. A few tiny distant windows in the far layer glow warm; windows and lanterns in the middle and near layers stay unlit.` | `Only the daylight opening changes: it shows a deep blue night sky with a small moon and stars, and the cave inside is one shade darker, still no colour darker than {DARKEST}.` |

- H5는 계절이 없다. 입력 = H5 기본 장면(낮).
- 밤이 판독 검사(15 §2.3, 명도 −15% 캐릭터)에 걸리면 SW + `Lighten ONLY the {shape} in the band from the ground line up to character height by one shade.`로 고친다.

### 4.4 세대 특징 9(D1~D3)과 틈 색조 2(A4) — 입력 = 그 층·틈의 기본 장면

조립: SW + 문장 + D-BG(`bats`는 D-BG-BAT, 색조는 D-BG-SKY). 특징 편집은 받침목·벽·바닥 같은 면 위에 물체를 더하고, 층 경계를 넘지 않게 **중간 층 물체 앞이나 벽면 안**에 둔다. 02 §2.3 흔적 문장에서 옮겼고, 원문에 없는 모습은 `임시`다.

| 변형 | 02 §2.3 | 문장 |
| --- | --- | --- |
| D1 `bats` | 박쥐 둥지가 늘었다 | `ADD a colony of small hanging bats clustered on the ceiling rock and the timber beams, folded wings, dark purple-brown #7A5A6E #4A3F55, no glowing eyes.` |
| D1 `storeroom` | 버려진 창고가 드러났다 | `ADD a fallen wooden shelf and a few stacked wooden crates against the back wall, #C08A58 #8E5E38.` |
| D1 `ladder` | 사다리가 무너졌다 | `ADD a broken wooden ladder lying against the wall and a rope strung between two timber posts as a makeshift handrail, wood #C08A58 #8E5E38, rope #F0E6CC.` |
| D2 `flood` | 지하수가 차올랐다 | `ADD ankle-deep still water over the floor surface: a flat band two blocks high on the ground line with thin light ripples #5A7FA8 #B9C8FF, and a few drops falling from the ceiling.` |
| D2 `restroom` | 광부 휴게실이 열렸다 | `ADD two old wooden chairs and a small table beside the cold stone hearth, #C08A58 #8E5E38.` (탁자 임시) |
| D2 `clang` | 쇳소리가 울린다 | `ADD loose metal chains and short pipes hanging from the ceiling beams, #7D7B80 #B4B2B0.` (임시: 소리를 그림으로 옮김) |
| D3 `crystal` | 수정 광맥이 드러났다 | `ADD larger blue crystal clusters bursting from the back wall and along the floor edge, #5A7FA8 #B9C8FF, flat colours, no glow halo.` |
| D3 `shadow` | 그림자가 짙어졌다 | `Make the back wall and the ceiling one shade darker, except a small round area under each lantern hook; no colour darker than {DARKEST}. Change nothing else.` |
| D3 `toll` | 종의 울림이 새어 나온다 | `ADD thin falls of dust from cracks in the ceiling and a second bronze bell fragment half buried in the back wall, #E0B06A #B07A3A.` (임시: 소리를 그림으로 옮김) |
| A4 `tint2` | 틈 색조(02 §2.2) | `Shift the whole rift's colour mood from blue-violet to deep teal: the walls turn teal-grey, the star crack edge turns pale cyan; the black roses stay deep red-purple.` + KEEP (임시) |
| A4 `tint3` | 〃 | `Shift the whole rift's colour mood from blue-violet to dusky rose-violet: the walls take a muted rose tint, the star crack edge turns pale pink; the black roses stay deep red-purple.` + KEEP (임시) |

- A4 기본 장면이 `tint1`(청보라)이다. 세대 특징 기본 장면(D1~D3)은 게임에서 보이지 않는 마스크 원본이다(15 §8.3).

### 4.5 점등 겹침 7 — 입력 = 불 꺼진 변형

조립: SW + 문장 + D-BG-LIT. 켠 판과 입력의 **차이 화소를 도구가 떼어** 겹침으로 쓴다(옷·무기 레이어와 같은 방식). 가까운·중간 층 창·등불은 모든 변형에서 꺼진 색(`#6E6862` 창, `#7D7B80` 등불 유리)이다.

| 겹침 | 입력 | 문장 |
| --- | --- | --- |
| `bg_town_lit_dawn` | `bg_town` 여름 · 새벽 | `Light only three windows (one in the inn, one in the smithy, one in the store): panes #FFE38A with one inner shade #C8783A, flat, no glow outside the frame. Change nothing else.` |
| `bg_town_lit_dusk` | 여름 · 해질녘 | `Light most windows and the lamp posts: panes and flames #FFE38A with one inner shade #C8783A, flat, no glow outside the frame. Change nothing else.` |
| `bg_town_lit_night` | 여름 · 밤 | `Light every window, lamp post and lantern: panes and flames #FFE38A with one inner shade #C8783A, flat, no glow outside the frame. Change nothing else.` |
| `bg_{mine_gate,mine_upper,mine_mid,mine_deep}_lantern_lit` 1칸 | 그 띠의 기본 장면 | `Hang a small lit lantern on every empty lantern hook, matching the attached lantern prop: flame #FFE38A with core #C8783A, frame #B07A3A. Change nothing else.` (P1 c18 등불을 모양 입력으로) |
| 〃 2칸 | 1칸 결과 | `Make every lantern flame one block shorter and leaning one block left. Change nothing else.` |

- 마을 겹침 셋은 창 자리가 모든 변형에서 같으므로 네 계절에 같이 쓴다. 낮에는 겹침이 없다(15 §8.6).
- 폐광 등불 겹침은 H5·D1~D3 띠마다 하나(2프레임). 세대 특징 변형도 같은 겹침을 쓴다. 패널의 등불은 패널 기본 장면에 켜진 채 그린다.

### 4.6 패널 37 — 발견 지점 25 · 던전 특수 방 12

조립(기본): A(`{128x64}`) + 품질 기준 입력 문장 + C-BGP + `SCENE L:` 문장 + `SCENE R:` 문장 + 조명 문장 + D-BG. 야외 패널은 `Summer, full daylight.`, 지하 패널은 `Cool dim underground light; lanterns may be lit.`(D-BG에서 `light sources, lit windows, flames, glow, `를 뺀다). 야외 패널 짝 9장은 §4.2·§4.3의 계절·시간대 편집을 **짝째로** 한다(한 편집이 두 장을 함께 바꾼다). 먼 층 채움은 없다(흐르지 않는다).

**발견 지점**(07 §6.3 지점 이름, 02 §6 키워드. 원문에 없는 모습은 `임시`)

| 짝 | 칸 | 지점 | `SCENE` 문장 |
| --- | --- | --- | --- |
| P1 | L | A1-1 물레방아 터 | `The site of an old water mill: a mossy stone foundation and a broken wooden water wheel half in a brook.` (임시) |
| P1 | R | A1-2 버드나무 둑 가는 길 | `A path opening between reeds toward a row of weeping willows on a distant dike.` |
| P2 | L | A1-3 늑대 발자국 언덕 | `A grassy slope rising toward rocky hills, a line of wolf paw prints pressed into the mud of the path.` |
| P2 | R | A1-4 오래된 이정표 | `An old weathered wooden signpost with blank arms leaning at a fork in the road, moss on its post.` |
| P3 | L | A1-5 여울 다리 아래 | `Under the stone bridge of the ford: the arch overhead, shallow sparkling water, and the largest round stone lying below the bridge.` |
| P3 | R | A1-6 도토리 숲 샘터 | `A small spring among oak trees, acorns on the ground, a ring of stones around clear water, a flat spot for a camp.` (임시) |
| P4 | L | A2-1 폐광 입구 | `A mine entrance framed with old timber in the misty mountainside, rails running into the dark, the mine chimney above.` |
| P4 | R | A2-2 안개 속 돌탑 | `A tall cairn of stacked stones standing alone in thick flat mist bands on the trail.` |
| P5 | L | A2-3 산양 길 | `A narrow goat path along a steep cliff ledge, small hoof prints, pine roots gripping the rock.` (발자국 임시) |
| P5 | R | A2-4 버려진 순찰 초소 | `An abandoned wooden patrol hut with a sagging roof and a small lookout platform, a cold stone fire ring.` (임시) |
| P6 | L | A2-5 종소리 들리는 절벽 | `A cliff edge above a misty gorge, the old mine's chimney and slag far below.` (임시) |
| P6 | R | A2-6 약초 비탈 | `A sunny slope thick with herbs and small flowers among rocks.` |
| P7 | L | A3-1 광부 조합 회관 | `The miners' guild hall: a larger stone building with a broken double door, a blank sign board and empty lantern hooks by the door.` (임시) |
| P7 | R | A3-2 세나의 옛집 | `A small empty miner's house with rows of child height marks cut into the door frame, a tiny garden gone wild.` |
| P8 | L | A3-3 무너진 선광장 | `A collapsed ore-sorting shed: fallen roof beams over wooden sorting chutes and heaps of grey ore.` |
| P8 | R | A3-4 광부 묘지 | `A miners' graveyard on a slope: rows of small plain stones with no writing, a rusty pickaxe planted beside one.` (곡괭이 임시) |
| P9 | L | A1-7 이름 없는 무덤 | `A small nameless grave mound under a lone tree, one plain stone with no writing, wildflowers.` |
| P9 | R | A3-6 광부들의 노래비 | `A standing stone monument carved with rows of short notches instead of words, wild grass around it.` |
| Q1 | L | A4-1 별빛이 새는 틈 | `A close view of the starlight crack: a tall jagged fissure showing a star-speckled night sky, hard pale-blue edge blocks.` |
| Q1 | R | A4-2 달그늘 지하 계단 | `Stone steps descending into darkness, thorny vines with black roses along the walls, a cold candlestick on a ledge.` |
| Q2 | L | A4-3 떠도는 폐허 파편 | `Fragments of ancient ruins floating in the air: broken columns and carved stones with star patterns.` |
| Q2 | R | A4-4 검은 장미 덩굴 | `A cave wall entirely covered with thick thorny vines of black roses.` |
| Q3 | L | A4-5 거꾸로 흐르는 물줄기 | `A thin stream of water flowing upward from a still pool into a crack in the ceiling.` |
| Q3 | R | A4-6 길바뀜의 중심 | `The heart of the Pathshift: several stone-slab paths meet and twist around a hazy circle, floating stones and faint starlight.` (임시) |
| Q10 | L | A3-5 우물 속 갱도 | `Inside the village well: the round stone shaft opens sideways into an old mine tunnel, a rope hangs from above, wet stone.` 오른쪽 절반 비움 |

**던전 특수 방**(층마다. 07 §5.3 방 종류, 02 §6.3 키워드. 보물 상자·문·가시 함정 소품은 게임이 얹으므로 그리지 않는다)

| 짝 | 칸 | 방 | `SCENE` 문장 |
| --- | --- | --- | --- |
| Q4 | L | D1 보물 `treasure` | `A small side chamber of the upper mine: timber supports, a patch of ore vein in the wall, an empty floor spot in front.` |
| Q4 | R | D1 함정 `trap` | `A narrow timber-braced passage: loose rocks on a cracked ceiling beam, uneven floor planks with small holes.` |
| Q5 | L | D1 휴식 지점 `rest` | `An abandoned miners' shelter: a wooden bench, a lit lantern on a hook, a cold fire ring.` |
| Q5 | R | D1 관문 `gate` | `A wide dead-end chamber at the end of a branching tunnel, heavy timber frames and piles of scrap wood and stone.` (임시) |
| Q6 | L | D2 보물 | `A side chamber with a thick streak of blue ore #5A7FA8 in the wall and an old ore wagon.` |
| Q6 | R | D2 함정 | `A passage of creaking floorboards over a gap, loose rocks overhead, a thin bell cord strung across at knee height.` |
| Q7 | L | D2 휴식 지점 | `The miners' rest room: a cold stone hearth, old wooden chairs, a water channel along the wall, a lit lantern.` |
| Q7 | R | D2 관문 | `A wide excavation hall with ore wagons on rails, streaks of blue ore and a lantern post.` (임시) |
| Q8 | L | D3 보물 | `A crystal grotto: large blue crystal clusters in the walls, an empty floor spot in front.` |
| Q8 | R | D3 함정 | `A dark passage with a slot in the wall for a rusty saw blade and a crumbling floor edge.` |
| Q9 | L | D3 휴식 지점 | `A dry niche in the rock with a flat stone bench and one small lit lantern, darkness around.` (임시) |
| Q9 | R | D3 관문 `gate` | `The bell chamber: a vast dark hall with a huge empty timber bell frame at the back where the great bell once hung, bronze fragments on the floor, stone pillars carved with rows of short notches.` |

- D3 관문은 보스(64 × 56, 풍경 x 64~128, 15 §7.3)가 설 자리 바닥을 비운다. ES20(P3)은 이 패널을 장소 입력으로 쓴다.
- 짝 없는 Q10의 오른쪽 절반은 `#FF00FF`로 둔다(`SCENE R:` 대신 `The right half x 768-1535 is flat #FF00FF.`).

### 4.7 제작 순서와 수량

「선행」이 `art:gate`와 §13 합격 기준을 통과해야 다음 줄로 간다. 호출 = 생성·편집 요청 한 번.

| 번호 | 무엇 | 요청 | 호출 | 결과 | 선행 |
| --- | --- | --- | --- | --- | --- |
| w10 | 야외 8곳 기본 장면 → 중간·가까운 X, 먼 층 FILL | 생성 8, 떼기 16, FILL 8 | 32 | 기본 8, 층 마스크 8 | 품질 기준(있음). H1 먼저(AO-39 들판을 대신) |
| w11 | 야외 계절 편집 → 시간대 편집 | 편집 24 + 96 | 120 | 변형 120 | w10 그 장소 |
| w12 | 야외 변형 먼 층 FILL, 마을 점등 | FILL 120, 편집 3 | 123 | 층 타일 128 × 3, 마을 겹침 3 | w11 |
| w13 | 폐광 띠 H5·D1·D2·D3: 기본 → X·FILL → H5 시간대 3·세대 특징 9 → FILL | 생성 4, 떼기 8, FILL 4 + 12, 편집 12 | 40 | 기본 4 + 변형 12 | 품질 기준 |
| w14 | 폐광 등불 겹침 | 편집 8 | 8 | 겹침 4(각 2칸) | w13, P1 c18 |
| w15 | 틈 A4 기본 → X·FILL → 색조 2 → FILL, 운명 장소 2 | 생성 3, 떼기 2, FILL 3, 편집 2 | 10 | 띠 3 + 한 장 띠 2 | w13 |
| w16 | 패널: 야외 발견 짝 9 → 계절·시간대 편집, 지하 발견·특수 방 짝 10 | 생성 19, 편집 9 × 15 | 154 | 패널 307 | w10(야외 색), w13(지하 색), w24 별잠 샘물(선택) |
| 합계 | | | **487** | 그림 456, 층 타일 441, 패널 307, 점등 겹침 7 | |

- 수량 대조(15 §13.1): 띠 149 = 기본 15 + 변형 134(야외 120, H5 3, 세대 특징 9, 색조 2). 패널 307 = 야외 발견 18 × 16 + 지하 발견 7 + 특수 방 12. 층 타일 441 = 층을 나누는 띠 147 × 3.
- 다시 생성은 호출 수에 넣지 않았다. 한 줄이 두 번 실패하면 세 번째 전에 원인 한 줄과 다른 방법을 적는다(§14 끝).
- 합격: 생성 E4 E7 E11 + W5 W7 W8 + 품질 기준과 나란히 놓아 밀도가 같거나 높다(사람 눈). 편집 E4 E11 E21 + W3(차이가 편집한 곳에만) + 15 §8.5 검사 세 가지(겹침 = 원본, 층 경계 차이 1% 이하, 판독 검사). 떼기 E8 E10 E11 + W6. 패널은 판독 검사를 x 16~64에서만 잰다.

---

## 5 배경 장소 소품 — 없앰 (AO-43, D72)

D70의 장소 소품 20개(v1.3 확정안)는 **각 장소의 기본 장면에 그린다**(15 §8.3, D72). 장소마다 기본 장면이 따로 있으니 공용 장면에 소품을 더해 장소를 구분할 필요가 없어졌고, 따로 뗀 소품은 계절·시간대 변형과 색이 맞지 않는다. 파일은 0개다. 옛 소품이 어느 기본 장면으로 갔는지:

| 옛 `bg_prop_…` | 이제 그리는 곳(§4.1) |
| --- | --- |
| `smithy` `store` | `bg_town`(시설 다섯 중 둘) |
| `stream` `footbridge` `acornpile` | `bg_river_meadow`(징검다리 여울·도토리 무더기), `bg_river_path`(작은 다리) |
| `willow` `watermill` | `bg_willow_bank` |
| `beacon` `rocks` | `bg_wolf_hill` |
| `slagheap` `cart` | `bg_slag_valley` |
| `brokengate` `outerlight` | `bg_mine_gate`(바깥 빛은 시간대 편집, §4.3) |
| `belltower` | `bg_miner_village`(빈 종탑), `bg_mine_gate`(먼 실루엣) |
| `milestone` `shrine` | `bg_river_path`(이정표·사당), `bg_mist_trail`(이정석) |
| `conifer` | `bg_mist_trail` |
| `ruin` | `bg_miner_village` |
| `mine_d2` `mine_d3` | `bg_mine_mid`, `bg_mine_deep` |

- 소품 목록에서 이미 옮겨 둔 것은 그대로다: 게시판 `prop_notice_board`, 광차 `prop_mine_cart`, 별잠 샘물 `prop_star_spring`(§8), 안개 `fx_weather_fog`(§6).
- 카드 AO-43과 `assets.manifest.json`의 `bg_prop_*` 항목은 이 결정에 맞춰 거둔다(도구·카드 쪽 작업).

---

## 6 날씨 (AO-45, 15 §8.3) — w17

생성 모델은 **입자 수 정확히 40·30**과 **알파 40%**를 보장하지 못한다. 입자 **스프라이트**를 그리고 게임이 화면당 40·30개를 흩뿌린다(OD-25 결정, 15 §8.3, 카드 AO-45 `fx_particle_{rain,snow}_48`, 비·눈 각 2칸 16 × 16). 안개는 불투명 흰색으로 받고 알파 102는 게임이 준다(그림자·빛 원과 같은 방식).

w17a 입자: A(`{16x16}`) + C-FX(`N=6, COLS=6, ROWS=1, ANCHOR=the particle is centred in the cell`) + 본문 + D-FX

```
Tiny weather particles, one per cell, each only a few blocks in size and centred in a mostly empty cell. Cells 1-2: raindrops, a thin diagonal streak falling from upper right to lower left, one block thick, two blocks long in cell 1 and three blocks long in cell 2, pale blue #B9C8FF. Cells 3-4: snowflakes, a single block in cell 3 and a 2 by 2 block in cell 4, #FFFFFF with #E8EEF2. Cells 5-6: falling leaves, a 2 by 2 block leaf #B8A04A in cell 5 and #C8783A in cell 6.
```

- 5·6칸(낙엽)은 P-18이 승인될 때만 쓴다(B-09). 그전에는 버린다.

w17b 안개 `fx_weather_fog`: A(`{256x64}`) + C-BG(`{DARKEST}`=`#FFFFFF`) + 본문 + D-FX

```
Only a horizontal band of fog across the whole strip: one flat, fully opaque white #FFFFFF shape filling roughly the middle third of the strip's height, its top and bottom edges gently wavy in hard one-block steps, a few separate small white wisps above and below it. The band meets the left and right edges at the same height so it tiles. Nothing else: no sky, no ground, no scenery. The game makes it semi-transparent.
```

- 구운 256 × 64 비·눈 겹침은 만들지 않는다(OD-25 결정).
- `fx_whiteflash`(흰빛 덮기)는 그리지 않는다. 합성 대상 실루엣을 흰색으로 칠하는 런타임 처리라 그림이 필요 없다(OD-26 결정, 15 §4).
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

- 호각은 J01 아이템 아이콘(§10)·토리 초상(§12)·P3 ES06~08과 같은 물건이다. **나무 호각**이다(15 §9.3 ES06, 11 C02-1, 08 J01 「끈에 매단 나무 호각」). 카드 AO-49 「청동 호각」과 AO-57 J01 색은 나무로 고쳤다(`OPEN_DECISIONS.md` OD-33).
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

- 명암 색은 03 §4에 값이 없다. 게임이 UI 확장 묶음에 등록한 명암으로 양자화한다(OD-29 결정, 15 §11).
- 합격: E1 E4 E6 E7 E11 + W11. `ui_sp_pause_16`과 `ui_state_pause_12`가 같은 모양이다. 켜진 등불과 꺼진 등불의 불 화소 차가 보인다.

---

## 10 아이템 아이콘 34 (AO-55~58, 24 × 24) — w29~w32

15에는 아이템 아이콘이 없고 카드가 24 × 24로 신설했다. 만들면 24 × 24로 정했고(OD-08 결정, P-04 규격 승인), **만들지는 `ASSET_BACKLOG.md` O-02가 정한다**(그전에는 시작하지 않는다). 16 × 16 판은 B-02로 미뤄져 있다. **첫 장(w29 무기)이 스타일 키**이고, P1의 무기·방어구 레이어가 합격했으면 **정체성 입력**으로 함께 넣는다(`Input image role: the in-game look of these items; match their shapes and colours.`).
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

v1.0의 NB-01~NB-09는 P3의 외형표와 합쳐 PROMPTS §7.3 `[ID-N01]`~`[ID-N09]`가 되었다(NB-0n = `[ID-N0n]`). 외형은 거기서만 고친다. 초상에서는 문장의 괄호 `(Full body: …)`를 괄호째 뺀다. 합칠 때 달라진 점: 도담 머리 밤색 `#7A4E30`·피부 밝음, 유안 망토 녹색(길잡이 두건 색), 비엘 머리 은백 `#E8E4DC`(검은 망토 위 윤곽), 토리 모자 `#C08A58` + 윗부분 `#7A4E24`, 호각 나무 `#C08A58` `#8E5E38`, 미루 약초는 캐릭터 48색 안의 녹 `#6D8F5A` `#4D6A3E`. 모두 `임시`이고 사용자가 승인했다(2026-09-24, `OPEN_DECISIONS.md` OD-02).

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

### 13.2 세계 쪽 새 기준 W1~W14 (P1의 E13~E19와 번호가 겹치지 않게 W를 쓴다)

| 번호 | 기준 |
| --- | --- |
| W1 | **적 실루엣 구분**: 들쥐·늑대·박쥐·코볼트·주인공을 실크기(32·48, 100%)로 검게 칠해 나란히 놓아도 3초 안에 구분된다(낮고 긴 몸+꼬리 / 큰 네발+귀·꼬리 / 떠 있는 날개 / 선 두 발+긴 귀+곡괭이). 코볼트는 주인공보다 확실히 작다 |
| W2 | **방향과 퇴장**: 모든 칸이 왼쪽을 본다(퇴장 행의 돌아선 칸 제외). 퇴장은 달아나는 모습이고 누워 끝나거나 다친 모습이 없다 |
| W3 | **교체 정합**: 편집 결과를 입력과 겹치면 차이가 지정한 색·부품 자리에만 있다. 윤곽·포즈·칸 위치가 1블록도 움직이지 않았다 |
| W4 | **보스 덩치·고정**: 코볼트 옆에서 넓고 낮은 덩치가 즉시 읽힌다. 대기 6칸에서 몸은 그대로이고 종만 움직인다. 균열 모양이 31칸 모두 같다 |
| W5 | **배경 명도**: 어두운 외곽선이 없고 `{DARKEST}`보다 어두운 색이 없다(순흑·자두색 외곽선 없음). 주인공 스프라이트를 x 16~64에 얹어도 묻히지 않는다 |
| W6 | **층 정합**: 뗀 층을 순서대로 겹치면 합성 장면과 같다. 지면선이 한 줄로 곧고 층마다 같은 높이다 |
| W7 | **가로 이음(육안)**: 띠 두 장을 이어 붙인 모습을 상상했을 때 지평·지면·하늘이 끊기지 않고, 가장자리에 걸친 물체가 없다. 패널은 이음 대신 x 768의 끊는 선을 넘는 물체가 없다 |
| W8 | **장소 키워드**(v1.4, D72로 장소 소품 대신): 기본 장면·패널에서 15 §8.3·P2 §4.1·§4.6이 적은 장소 요소가 모두 보이고 02 §6 키워드로 무엇인지 읽힌다. 크기가 나무·울타리와 어울리고 바닥이 지면선에 닿는다. 글자가 없다 |
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
| w01 | 늑대 기준 시트 18 | 생성 | 들쥐 합격본 | — | AO-32 | 5 |
| w02 | 박쥐 기준 시트 18 | 생성 | 들쥐 합격본 | — | AO-33 | 5 |
| w03 | 코볼트 합성 18 | 생성 | 들쥐 합격본, 마스터 | — | AO-34 | 5 |
| w04 | 코볼트 몸체·곡괭이 떼기 | 떼기 ×2 | w03 | w03 | AO-34·35 | 5 |
| w05 | EN02 교체 → 귀 떼기 | 교체, 떼기 | 들쥐 합격본 | — | AO-35 | 5 |
| w06 | EN04·06·07 색 목표(검토용) | 교체 ×3 | w01, w02 | w01·w02 | AO-36 | 5 |
| w07 | EN09·EN10 교체 → 모자·투구 떼기 | 교체 ×2, 떼기 ×2 | w03 | w03 | AO-35 | 5 |
| w08 | EB01·EB02 교체 → 뿔 투구·큰 곡괭이·수염·등불 떼기 | 교체 ×3, 떼기 ×5 | w03, w07a, (P1 c18) | w07(EB01 색 목표만 OD-12 값 대기) | AO-35 | 5 |
| w09 | 정예 깃발 2 | 생성 | — | — | AO-35 | 5 |
| w10 | 야외 8곳 기본 장면 → 층 떼기(X 2, FILL 1) | 생성 ×8, 떼기 ×16, FILL ×8 | 품질 기준 | — | AO-39·40 | 5 |
| w11 | 야외 계절 24 → 시간대 96 | 편집 ×120 | w10 | w10 그 장소 | — | 5 |
| w12 | 야외 변형 먼 층 FILL, 마을 점등 3 | FILL ×120, 편집 ×3 | w11 | w11 | AO-40 | 5 |
| w13 | 폐광 띠 H5·D1·D2·D3 → 층 떼기 → H5 시간대·세대 특징 → FILL | 생성 ×4, 떼기 ×8, 편집 ×12, FILL ×16 | 품질 기준 | — | AO-41 | 6 |
| w14 | 폐광 등불 겹침 4(각 2칸) | 편집 ×8 | w13, (P1 c18) | w13 | AO-41 | 6 |
| w15 | 틈 A4 + 색조 2, 운명 장소 2 | 생성 ×3, 떼기 ×2, 편집 ×2, FILL ×3 | 품질 기준, (w24 별잠 샘물) | w13 | AO-42 | 6 |
| w16 | 패널 37: 발견 지점 25·특수 방 12 → 야외 짝 9의 계절·시간대 | 생성 ×19, 편집 ×135 | 품질 기준 | w10·w13 | — | 6 |
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
| w29 | 아이템 무기 10(스타일 키) | 생성 | (P1 무기 레이어) | `ASSET_BACKLOG.md` O-02, P1 c14 권장 | AO-55 | 6 |
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

## 16 수량 대조 (15 §13.1, 48 규격 한 벌)

| 15 §13.1 항목 | 15 수량 | 이 문서 | 다른 곳 | 비고 |
| --- | ---: | ---: | --- | --- |
| 적 4계열 × 18 | 72 | 54(늑대·박쥐·코볼트) | 들쥐 18 = PROMPTS P0 | ✅ 72 |
| 적 소품 | 22 | 22 | — | 곡괭이 5·큰 곡괭이 5·귀·모자·녹슨 투구·뿔 투구·수염·등불·깃발 각 2. 떼기 결과는 18칸 층이라 게임이 고른다(OD-22 결정, 15 §7.2) |
| 보스 | 35 | 35 | — | 본체 31 + 파동 4. 균열 겹침 1은 15 §7.3 2단계 부품, 종추는 본체에 그린다(OD-59) |
| 효과 | 32 | 32 | — | FX1 4·FX2 6·FX3 4·FX4 8·FX5 4·FX6 6 |
| 소품 | 43 | 41 | 책 2 = PROMPTS P0 | ✅ 43 |
| 이벤트 장면 | 80 | 0 | P3 | 소품·장소 입력은 이 문서가, NPC 입력은 PROMPTS §7.4 `n01`이 준다 |
| 배경 그림(D72) | 456 | 456 | — | 띠 149(기본 15 + 변형 134) + 패널 307(기본 37 + 변형 270). 층 타일 441, 점등 겹침 7(§4.7) |
| 배경 장소 소품 | 0 | 0 | — | 기본 장면에 그린다(§5, D72) |
| 초상 | 72 | 72 | — | 부품 25 + NPC 11 = 36 × 2크기 |
| UI 아이콘 | 42 | 42 | — | 12 + 8 + 7 + 15 |
| 책 UI 부품 | 3 | 3 | — | 팔레트 3은 게임 |
| 팔레트 | 53 | 0 | 게임(D56 8번) | 배경 변환표·장소 팔레트는 없앴다(D72). 변형 색 목표(w06·w07·w08)만 검토용으로 만든다 |
| (15에 없음) 아이템 아이콘 | — | 34 | — | 카드 신설(P-04) |
| (15에 없음) 날씨 | — | 입자 4(+2)·안개 1 | — | AO-45. 흰빛 덮기는 그리지 않는다(OD-26) |

---

## 17 확인 필요

`docs/art/OPEN_DECISIONS.md`로 옮겼다(v1.1). 본문의 「§17-n」은 그 표의 `옛 번호` 열 `P2-17-n`으로 찾는다. 이 정리에서 닫은 것: 20(공통 블록 충돌 → PROMPTS D-BG·이 문서 D-MARK, OD-63), 21(NPC 외형 → 02 §8, OD-38), 23(호각 = 나무, OD-33), 31(P3와 공유하는 모양 → PROMPTS §5.3 순서, OD-66) 등. 2026-09-24 사용자 결정(권장안)으로 나머지 사용자 결정 항목을 모두 닫았다. **남은 것: EB01 새 색 2개의 값(OD-12)** 하나. 각 항목의 상태는 그 표에 있다.
