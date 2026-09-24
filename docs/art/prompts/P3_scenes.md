# P3_scenes — 이벤트 장면 20개 프롬프트

버전 1.1 · 2026년 9월 24일 · 대상: 이미지 생성 모델을 쓰는 제작 AI
1.1: 15 §9.3 보정(커밋 e878cce) 반영 — 표의 x는 인물 가로 중심, 주인공 비움 폭 x ± 16(`잠` ± 22, `환호` 위로 y 6), 축소 창은 장면을 쓰지 않음(y 16 제약·320 × 48 검사 삭제), 반복 장면은 처음 자세로 돌아오는 몸짓, ES09 `끝 유지`. PROMPTS v1.2 정합 — 등장인물 외형·NPC 전신 기준 시트를 PROMPTS §7로 옮김(`[ID-N0n]`, `nref` 칸 번호 바뀜), 장면 블록 이름 S-* → SC-*, 호각은 나무, 같은 소품 문장을 P2와 맞춤, 진행표·확인 필요를 PROMPTS §6.4·`OPEN_DECISIONS.md`로 옮김.
상위 문서: `docs/art/PROMPTS.md` v1.2(이하 **PROMPTS**). 제작 방식은 `ASSET_ORDERS.md` §0.0(D56): 이미지 생성·편집만 쓰고, 코드로 그리기·자르기·축소·배경 제거를 하지 않는다. 색인·전체 제작 순서는 PROMPTS §5다.
사양은 `docs/design/15_아트_스프라이트_사양.md` §9.3(D63, 이하 **15 §9.3**)이 소유한다. 이 문서는 그 표를 프롬프트로 옮기기만 한다. 표와 이 문서가 다르면 표가 맞다.
관련: 등장인물 외형은 PROMPTS §7(02 §8이 출처), 사건 도입 문장은 11, 장소 모습은 02 §6·15 §8, 소품 모양은 15 §9.2와 `ASSET_ORDERS.md` AO-49·AO-50·AO-57(프롬프트는 P2 §8), 적은 15 §7, 사망 연출은 09 §5.2, 동반자는 12 §2.1.

---

## 0 범위와 쓰는 법

### 0.1 범위

15 §9.3의 ES01~ES20. 장면마다 128 × 64 칸 4개(250 ms × 4)이고, 48 규격 제작 원본을 먼저 만든다. 32 규격은 O02가 32를 채택했을 때만 만든다(§7.3). 장면이 쓰는 **NPC 전신 기준 시트**(`n01`, 합격본 `nref`)는 PROMPTS §7.4가 만든다.

### 0.2 장면 그림이 지켜야 할 것 (15 §9.3 요약)

| 항목 | 규칙 | 프롬프트에서 막는 곳 |
| --- | --- | --- |
| 한 칸 | 128 × 64, 불투명한 완성 장면. 지면선 y 56 | SC-K·SC-C |
| 프레임 | 4칸. 반복 장면은 **처음 자세로 돌아오는 몸짓**(1→2→3→2, 0·1·2·1 등)이라 4→1이 튀지 않는다. 한 번 일어나고 끝나는 움직임은 `끝 유지`(ES09·ES15·ES19)로 4칸째에서 멈춘다 | 장면별 FRAMES |
| 주인공 | **그리지 않는다.** 게임이 현재 인물을 표의 x·동작으로 얹는다. 표의 x = 인물 가로 중심(`center_x`), 발바닥 y 56. 비울 자리는 x ± 16, `잠` ± 22, `환호`는 위로 y 6까지 | 장면별 HERO SLOT + SC-D |
| NPC | 초상(15 §10)과 같은 인물, 2.2등신 SD(48 규격 어른 키 약 38). 표의 NPC x도 인물 중심 | PROMPTS §7 외형 + `nref` 입력 |
| 축소 창 | **장면을 쓰지 않는다**(15 §9.3). 축소 창은 한 줄 기록이 없고 풍경 폭이 96이다. 장면 그림에 축소 창용 제약을 두지 않는다 | — |
| 배율 | 125·150%에서 위쪽 빈 높이를 장면 맨 윗줄 색으로 채운다 → 맨 위 8줄은 한 색 | SC-K·SC-C |
| 색 | 기본 48색 + 배경 확장 묶음. 달그늘(ES11·ES19)만 변이·정예 묶음 추가. 밤·계절 변환표를 쓰지 않는다 | 장면별 팔레트 |
| 외곽선 | 인물·소품은 `#2B2233`. 배경 면은 어두운 외곽선 없음, 배경 최암부는 외곽선보다 L\* 15 이상 밝게 | SC-A |
| 움직임 줄이기 | 1칸째만 보인다(`끝 유지`는 4칸째) → 그 한 칸만으로 사건이 읽혀야 한다 | SE12 |

배경 최암부 계산: 외곽선 `#2B2233`의 L\*는 14.9이므로 배경 화소는 L\* 29.9 이상이어야 한다. 기본 48색 가운데 배경에 쓸 수 있는 가장 어두운 색은 `#4C4A52`(L\* 31.9)다. `#4A3F55`(28.6), `#3A4458`(28.7), `#5E3C24`(28.7), `#553420`(25.2), `#2E2438`(16.1), `#7A1F33`(27.7)은 **인물·소품에만** 쓴다.

### 0.3 좌표 읽는 법

- 15 §9.3의 x는 **인물·소품의 가로 중심(발 중심)**이다(15 §9.3 주인공 행, e878cce). 범위(`x 76~116`)는 물체의 왼쪽 끝~오른쪽 끝이다.
- 프롬프트에는 픽셀 대신 **칸 폭에 대한 비율**(왼쪽 끝 0, 오른쪽 끝 1)을 쓴다. 비율 = x ÷ 128.
- **주인공 자리**: 가로는 15 §9.3 값 그대로다. 세로(지면선 위)는 이 문서가 정했다(48 규격 키 38 + 여유).

| 동작 | 가로 (15 §9.3) | 세로 |
| --- | --- | --- |
| `대기`·`발견`·`걷기`·`상호작용`·`앉기와 식사` | x − 16 ~ x + 16 | y 10 ~ 56 |
| `환호` | x − 16 ~ x + 16 | y 6 ~ 56(15 §9.3) |
| `잠` | x − 22 ~ x + 22 | y 34 ~ 56 |

- v1.0은 `상호작용`을 x + 22(뻗는 손)까지, ES16 `앉기와 식사 + 책`을 x + 20까지 비웠다. 15가 폭을 정했으므로 x ± 16으로 맞췄다. 손이 NPC·소품과 닿는지는 §6 V-S1이 본다. 닿으면 15 §9.3의 폭을 고치자고 올린다(`OPEN_DECISIONS.md` OD-37).
- 주인공 자리 안에는 **배경 면(하늘·벽·땅·바닥)만** 둔다. 사람·동물·소품·그림자·밝은 점·대비가 센 무늬를 두지 않는다. 지면선 아래 바닥 띠(y 56~63)는 바닥·침상 면이 이어져도 된다(ES19).

### 0.4 요청 조립

| 단계 | 조립 | 쓰는 때 |
| --- | --- | --- |
| ① 열쇠 칸 K | [SC-A] + [SC-K] + [입력 역할 문장] + [장면 본문] + [SC-D] | 먼저 한 칸(프레임 1)만 만든다. 구도·주인공 자리·NPC 정체성을 여기서 확정한다 |
| ② 띠 | 합격한 K를 입력으로 넣고 [SC-E] + [장면 본문의 FRAMES 줄만] + [SC-D] | K의 화소를 네 칸에 그대로 옮기고 움직이는 부분만 바꾼다 |
| (대안) 한 번에 띠 | [SC-A] + [SC-C] + [입력 역할 문장] + [장면 본문] + [SC-D] | ①②가 안 될 때. 정지 부분이 칸마다 흔들리기 쉽다 |

- 두 단계로 나누는 이유는 v03 교훈과 같다(PROMPTS §2.2: 따로 생성한 층은 맞지 않았고, 합성 후 편집이 맞았다). 네 칸을 따로 그리면 배경이 칸마다 조금씩 달라져 반복 재생에서 떨린다. 열쇠 칸을 먼저 합격시키면 구도 실패를 네 칸 비용 없이 고칠 수 있다.
- 공통 블록은 줄이지 않고 전문을 붙인다. 장면 본문의 영어 프롬프트는 각 장면 절의 코드 블록이다.

### 0.5 저장

PROMPTS §0.3 그대로. 파일 이름은 `assets/_imagegen/{판}/es{번호}-{이름}-48-k.png`(열쇠 칸), `…-48.png`(띠)와 같은 이름 `.prompt.txt`. 폴더 `README.md`에 입력으로 넣은 이미지 경로(`nref`·소품·장소 배경)를 적는다. 게임 규격 파일 `assets/scenes/es_{사건 id}_48.png`(512 × 64)와 `.frames.json`은 게임 쪽 정규화가 만든다(15 §9.3 파일 행).

---

## 1 등장인물 (PROMPTS §7이 단일 출처)

v1.0의 등장인물 외형표·영어 정체성 문장·NPC 전신 기준 시트(NPC-REF)는 P2의 초상 정체성 블록과 합쳐 **PROMPTS §7**로 옮겼다. 외형은 거기서만 고친다.

- 장면 본문의 `[ID-…]` 자리에 PROMPTS §7.3 문장을 넣는다. 괄호 `(Full body: …)`는 괄호와 표지를 빼고 내용을 넣는다. 인물이 두 명이면 두 문장 모두 넣는다.
- 옛 이름 대응: `[ID-N01]` → `[ID-N01]`, `[ID-N04]` → `[ID-N04]`, `[ID-N05]` → `[ID-N05]`, `[ID-N07]` → `[ID-N07]`, `[ID-N08]` → `[ID-N08]`, `[ID-N09]` → `[ID-N09]`. `[ID-PARTNER]`·`[ID-TRAVELER]`는 그대로다.
- `nref` 칸 번호(PROMPTS §7.4): 1 하델 · 4 도담 · 5 세나 · 7 유안 · 8 비엘 · 9 토리 · 10 동반자 · 11 여행자. v1.0의 8칸 시트와 번호가 다르다.
- 키: 어른 약 38(15 §9.3), 세나 약 34, 토리 약 30(02 §8.9 「작은 키」, 수치는 `임시`), 앉은 유안·여행자 약 26.
- 도한(N06)은 장면에 나오지 않는다(02 §8.6). 보름·미루는 장면에 나오지 않는다.
- 입력 역할 문장(장면 K 단계에서 본문 앞에 붙인다):

```
Input image role: identity reference sheet. Copy ONLY the people named in this scene from it (cell {n} = {name}): the same head shape, hair, face, clothing, colors and body height. Do not copy its layout, its magenta background, its poses or any other person in it.
```

---

## 2 소품 모양 기준

장면 소품은 15 §9.2 소품·AO-57 아이콘과 **같은 물건으로 읽혀야** 한다. 장면은 48 규격과 같은 화소 크기(주인공 키 38블록)이므로 크기도 소품 카드 그대로 쓴다. 해당 소품이 먼저 합격해 있으면(P2 w22~w24) 그 이미지를 장면 K 단계에 입력으로 더 넣는다(입력 역할: `shape reference for the {prop}; copy its shape, size and colors, not its background`). 아직 없으면 아래 문장이 기준이다. 반대로 장면이 먼저 합격하면 그 장면의 소품을 소품 카드의 참고 입력으로 넘긴다. 아래 문장은 P2 §8의 같은 소품 문장과 색·모양이 같다(v1.1에서 맞췄다, `OPEN_DECISIONS.md` OD-67).

| 소품 | 장면 | 기준(출처) | 장면 속 문장(영어) |
| --- | --- | --- | --- |
| 모닥불 | ES01 | 22 × 24, 통나무 3개는 4프레임 동일·불꽃만 변함, `#FFE38A` `#C8783A` `#8E5E38`(AO-50) | `three crossed logs #8E5E38 that stay pixel-identical in every frame, flames #FFE38A #C8783A, about 22 blocks wide and 24 tall` |
| 세움 등불 | ES15 | 14 × 20, 틀 고정·유리 안 노란 면만 변함, `#B07A3A` `#FFE38A` `#7A4E24`(AO-50) | `a small standing lantern about 14 by 20 blocks, bronze frame #B07A3A #7A4E24, glass panel` |
| 꺼진 등불 | ES15 4칸 | 불 화소 0, `#6E6862` `#7A4E24`(AO-50 `prop_lantern_out`) | `the same lantern with dark glass #6E6862 and no yellow pixel` |
| 찢어진 지도 | ES03 ES04 | 14 × 10(AO-49). 모서리에 '도한' 이름과 작은 종 그림(11 C01-1) — 이름은 글자이므로 그리지 않는다. 소품 파일 3색 제한 때문에 종 그림도 선과 같은 갈색 | `a torn paper map about 14 by 10 blocks, cream #F0E6CC with shade #C8C2B8, one jagged torn edge, a few thin brown lines and a tiny bell drawing in one corner, both #8E5E38, no writing` |
| 호각 | ES06 ES07 ES08 | 가로 12 × 세로 5 납작한 관, 끝 구멍 3px, 입구 2px, 위 고리 2px(AO-49·AO-57 J01). **나무**(15 §9.3 ES06, 11 C02-1, 08 J01) `#C08A58` `#8E5E38` | PROMPTS §7.3 `[ID-N09]`의 호각 문장 + `about 12 by 5 blocks` |
| 별잠 샘물 | ES10 | 물결 4프레임 반복(AO-50 `prop_star_spring`). 별빛 문양을 새긴 돌샘(11 F02) | `a low round stone basin #C8C2B8 #9A948C, its rim carved with small four-point star marks, clear water #B9C8FF with two flat ripple rings rising gently in the middle` |
| 은잔 | ES11 | 굽 달린 은잔, `#E8E6E0` `#B4B2B0`, 받침(AO-57 R04) | `a footed silver chalice #E8E6E0 #B4B2B0 with a round base` |
| 편지 | ES18 | 12 × 9, **봉인은 좌우 대칭 원형 1개**, 대각선 획 금지(AO-49) | `a sealed envelope 12 by 9 blocks, cream #F0E6CC with shade #C8C2B8, one symmetric round red wax seal #B04A42 in the center, no writing and no diagonal strokes` |
| 녹슨 검 | ES17 | W01 = V1 한손검, 날 녹 `#B0603A` `#7D7B80`, 이 빠진 날(15 §6.4), 손잡이 `#5E3C24`(AO-19). V1 길이 16(48) | `a rusty short straight sword about 16 blocks long, blade #B0603A #7D7B80 with one chipped notch, small cross guard, dark leather grip #5E3C24` |
| 남은 배낭 | ES15 | P1 REF-P 2칸 배낭과 같은 물건 `#8E5E38` `#5E3C24`(AO-26), P2 w24d `prop_lantern_out`의 배낭과 같은 문장 | `a small boxy travel backpack #8E5E38 #5E3C24 with a rolled flap` |
| 광차 | ES03 | P2 w24a 6칸 `prop_mine_cart`와 같은 물건 | `a mine cart with an iron body #7D7B80 #4C4A52 and a wooden rim #8E5E38` |

---

## 3 장면 공통 블록

v1.0의 S-A·S-K·S-E·S-C·S-D를 SC-A·SC-K·SC-E·SC-C·SC-D로 이름만 바꿨다(PROMPTS §1의 교체 머리말 S와 헷갈리지 않게).

### SC-A 장면 스타일 (PROMPTS A를 장면용으로 바꾼 것)

```
Asset type: Tap RPG 2D pixel-art EVENT SCENE, a short looping animation of one small side-view scene for a 128x64-pixel game window. This is real game pixel art, not an illustration, poster, UI or pixel-art-themed painting.
PIXEL LANGUAGE: each panel must look designed on a genuine logical 128x64 pixel canvas and shown with large, uniform, perfectly square pixel blocks. Crisp hard square clusters, deliberate one-block stair-steps, flat color fills in large coherent areas, restrained detail.
OUTLINE RULE: people, creatures and props have a one-block outer contour in dark plum #2B2233. Background surfaces (sky, walls, floor, ground, water, hills, buildings, tent cloth) have NO dark outlines: their edges use a slightly darker shade of the same hue, and no background pixel is darker than #4C4A52.
SCALE: chibi people about 2.2 heads tall; an adult stands about 38 blocks tall with the feet on row 56 of 64 and the top of the head near row 18. Children are shorter as stated.
Light is shown only with flat stepped bands of a lighter color. Absolutely no blur, anti-aliasing, smooth vector curves, gradients, soft lighting, glow, bloom, painterly strokes, noisy dithering, fur texture, glossy or 3D rendering, photographic detail.
```

### SC-K 열쇠 칸 배치 (① 단계)

```
LAYOUT: one single panel exactly twice as wide as it is tall, spanning the full canvas width and placed in the vertical middle of the canvas. Above and below the panel the canvas is one single flat #FF00FF magenta, the exact same value in every pixel. The panel is a complete opaque scene from edge to edge, with no border or frame. Draw FRAME 1 only.
A straight flat ground line runs across the panel at 7/8 of its height (row 56 of 64); every person and prop stands on it. The top eighth of the panel (rows 0-7) is one quiet flat color.
```

### SC-E 띠 만들기 편집 (② 단계, 입력 = 합격한 열쇠 칸)

```
Use case: precise edit of the provided single scene panel. Make one horizontal strip of four copies of this exact panel placed side by side, edge to edge, with no gap, border or dividing line; the strip is exactly eight times as wide as it is tall, spans the full canvas width and sits in the vertical middle; above and below it the canvas is one flat #FF00FF magenta, one exact value everywhere. Copy every pixel of the panel unchanged, with its exact colour, into all four copies, then apply ONLY the changes listed under FRAMES (panel 1 = frame 1, left to right). Do not redraw, move, restyle, recolour, relight, brighten or saturate anything else. The empty hero slot stays empty in all four panels.
```

### SC-C 한 번에 띠 배치 (대안)

```
LAYOUT: one single horizontal strip of exactly four equal panels in one row, edge to edge. Each panel is exactly twice as wide as it is tall, so the whole strip is exactly eight times as wide as it is tall. The strip spans the full canvas width and sits in the vertical middle; everything above and below it is one flat #FF00FF magenta, the exact same value in every pixel. No gaps, borders, frames or dividing lines between panels; every panel is a complete opaque scene from edge to edge.
The four panels are four animation frames of the SAME scene seen from the SAME fixed camera: every background shape, person and prop keeps the identical position, size, pose and colors in all four panels; only the changes listed under FRAMES happen, each by one or two blocks. A straight flat ground line runs at row 56 of 64 (7/8 of the panel height) in every panel and everyone stands on it. The top eight rows of each panel are one quiet flat color.
```

### SC-D 장면 금지

```
Do NOT draw: the player character, any young adventurer who could be mistaken for it, any person in the empty hero slot, any person or creature not listed, text, letters, numbers, runes, writing on signs, paper or banners, labels, frame numbers, arrows, musical notes, zZ letters, speech bubbles, UI elements, panel borders, grid lines, dividing lines, watermark, blood, wounds, corpses, weapons being swung, magic effects not listed, motion trails, vignette, spotlight, glow halo, lens flare, gradient sky. Output only the finished image.
```

- v1.0의 `any adventurer`는 하델(은퇴 모험가)이 나오는 장면과 부딪힐 수 있어 `any young adventurer who could be mistaken for it`으로 좁혔다.

### HERO SLOT 문장 틀 (장면 본문 안)

```
HERO SLOT (keep empty): {a} to {b} of the panel width (0 = left edge, 1 = right edge), ground line up to row {top}, show only plain {background}. No person, prop, shadow or bright detail (the player character is added later).
```

---

## 4 장면별 프롬프트

읽는 법: 각 장면의 영어 코드 블록이 **장면 본문**이다. §0.4의 조립표대로 공통 블록과 이어 붙인다. `[ID-…]`는 PROMPTS §7.3 문장으로 바꾼다(§1). 배치 표의 px는 128 × 64 칸 기준이다. 본문 길이는 `[ID-…]` 문장을 빼고 약 160~230단어다(인물 한 명당 약 35단어가 더해진다).

### ES01 · L09 모닥불 옆 낯선 여행자

11 도입: 모닥불 너머에서 망토를 쓴 여행자가 손을 녹여도 되겠냐고 묻는다. 신발 밑창이 닳은 것을 보니 먼 길을 온 사람이다.

```
SCENE: a stranger by the campfire. A night meadow campsite under the stars, calm and warm, not scary. Night sky #3E5A7E with a lower band #5A6A9A, a few single-block stars #FFE38A #FFFFFF, low hill silhouettes #5A6A9A, dark grass #4D6A3E with a #5E9A4A top edge on the ground line. Around the fire the ground shows two flat stepped rings of warm light, #B8A04A inside and #8E5E38 outside.
HERO SLOT (keep empty): 0.06 to 0.31 of the panel width, ground line up to row 10, show only plain night grass and sky. No person, prop, shadow or bright detail (the player character is added later).
PROPS AND PEOPLE:
- Campfire centered at 0.47: three crossed logs #8E5E38 that stay pixel-identical in every frame, flames #FFE38A #C8783A, about 22 blocks wide and 24 tall.
- [ID-TRAVELER] Sitting on the ground centered at 0.66, facing LEFT toward the fire, knees up, both hands held out to the flames, the boot soles turned toward the fire so the worn patches show. Seated height about 26 blocks.
FRAMES: flames change shape every frame; frames 2 and 4 the traveler's hands rub together one block closer, frames 1 and 3 hands apart; one star blinks off in frame 3.
```

- 입력: nref(11칸 = 여행자). 모닥불 소품이 합격해 있으면 함께.
- 배치: 주인공 x 24 `앉기와 식사`, 자리 8~40(0.06~0.31) / 모닥불 49~71 / 여행자 72~96(앉음).
- 프레임: 불꽃 4모양(통나무는 네 칸 동일) · 손 비비기 0/1/0/1 · 별 하나 3칸에서 꺼짐. 1→4→1 이어진다.
- 분위기: 밤이지만 따뜻하고 조용하다. 여행자는 수상하지 않고 지친 사람.
- 팔레트: 하늘 `#3E5A7E` `#5A6A9A`, 별 `#FFE38A` `#FFFFFF`, 풀 `#4D6A3E` `#5E9A4A`, 빛 고리 `#B8A04A` `#8E5E38`, 불 `#FFE38A` `#C8783A`, 통나무 `#8E5E38` `#5E3C24`, 망토 `#9A948C` `#6E6862`, 밑창 `#8E5E38` `#C8C2B8`, 외곽선 `#2B2233`. 밤 변환표를 쓰지 않고 이 색으로 직접 칠한다.
- 장면 금지: 여행자의 얼굴을 자세히 그리지 않는다(두건 그늘). 무기 없음. 빛 번짐 대신 계단형 고리.

### ES02 · L23 생일 잔치

11 도입: 여관 문을 열자 도담 아주머니가 촛불 꽂은 빵을 들고 서 있다. "{age}번째 생일이지? 올해도 무사히 돌아왔네."

```
SCENE: a birthday at the inn "Acorn Cap". Cozy interior: warm wooden plank wall #C08A58 with #8E5E38 plank edges, a small window with a flower pot at 0.47-0.56 (rows 22-36), a plank floor #8E5E38 below the ground line, a low table at the right edge (0.86 to 1.0) with a soup bowl #F0E6CC. Warm evening light, cheerful and homely.
HERO SLOT (keep empty): 0.11 to 0.36 of the panel width, ground line up to row 6, show only plain wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE AND PROPS:
- [ID-N04] Standing centered at 0.69, facing LEFT, holding with both hands at chest height a round bread loaf #C08A58 #8E5E38 topped with three short cream candles #F0E6CC with tiny flames #FFE38A, offering it toward the left.
FRAMES: the candle flames flicker, a different candle tallest in each frame; Dodam's arms and the bread move toward the left by 0, 1, 2, 1 blocks in frames 1-4 (a gentle offering gesture); everything else identical.
```

- 입력: nref(4칸 = 도담).
- 배치: 주인공 x 30 `환호`, 자리 14~46(0.11~0.36), 위로 y 6까지 / 도담 76~100, 빵은 x 66~74 / 창 60~72 / 탁자 110~128.
- 프레임: 촛불 깜박임, 빵 내밀기 0·1·2·1블록.
- 분위기: 따뜻한 저녁, 축하. 촛불 수는 나이를 뜻하지 않는다(3개 고정).
- 팔레트: 벽·바닥 `#C08A58` `#8E5E38`, 창 `#B9C8FF` `#E0B06A`, 화분 `#B04A42` `#6D8F5A`, 빵 `#C08A58` `#8E5E38`, 초 `#F0E6CC` `#FFE38A`, 도담 `#F6D9C2` `#E8B89A` `#8E5E38` `#C08A58` `#7A4E30` `#B04A42` `#F0E6CC` `#B4B2B0`, 외곽선.
- 장면 금지: 숫자 초·글자 간판 없음. 다른 손님 없음.

### ES03 · C01-1 찢어진 지도

11 도입: 무너진 광차 밑에 찢어진 지도가 끼어 있다. 모서리에 '도한'이라는 이름과 작은 종 그림이 있다. 선은 중층 쪽으로 이어지다 찢겨 나갔다.

```
SCENE: the torn map. A small room in the upper level of an abandoned mine: rough rock wall #6E6862 #7D7B80, a wooden support post #C08A58 #8E5E38 at 0.45 with a crossbeam across rows 10-14, gravel floor #9A948C #6E6862 below the ground line. Dim, quiet, a little mysterious, warmly lit by one small oil lamp.
HERO SLOT (keep empty): 0.09 to 0.34 of the panel width, ground line up to row 10, show only plain rock wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PROPS:
- A small oil lamp on the post at 0.45, rows 20-30: bronze #B07A3A, flame #FFE38A, two flat stepped rings of lighter rock #9A948C around it.
- An overturned mine cart lying on its side from 0.59 to 0.91 on the ground line: iron body #7D7B80 #4C4A52 with a wooden rim #8E5E38, one wheel sticking up.
- A torn paper map about 14 by 10 blocks, cream #F0E6CC #C8C2B8, one jagged edge, thin brown lines and a tiny bell drawing in a corner, both #8E5E38, no writing, lying half under the cart's left end at 0.52-0.62.
FRAMES: the lamp flame changes shape and its light rings shift by one block; the map's loose corner lifts one block in frames 2 and 3; two or three single-block dust specks #C8C2B8 drift down one block per frame in a repeating pattern.
```

- 입력: nref 없음. 폐광 배경(AO-41 등)이 합격해 있으면 장소 참고 입력.
- 배치: 주인공 x 28 `상호작용`, 자리 12~44(0.09~0.34) / 등잔 x 58 / 지도 66~80 / 광차 76~116.
- 프레임: 등잔 불꽃, 지도 모서리 0·1·1·0, 먼지 한 블록씩 떨어짐(무늬 반복).
- 분위기: D1 상층, 사람 손길이 남은 갱도(02 §6.3). 무섭지 않다.
- 팔레트: 벽 `#6E6862` `#7D7B80`, 나무 `#C08A58` `#8E5E38`, 바닥 `#9A948C` `#6E6862`, 레일 `#7D7B80`, 광차 `#7D7B80` `#4C4A52` `#8E5E38`, 등잔 `#B07A3A` `#FFE38A`, 지도 `#F0E6CC` `#C8C2B8` `#8E5E38`, 먼지 `#C8C2B8`, 외곽선.
- 장면 금지: 지도 위 이름 글자('도한') 금지 — 종 그림만. 박쥐·코볼트 없음.

### ES04 · C01-2 광부의 가족

11 도입: 지도를 펼치자 광부 차림의 소녀가 걸음을 멈춘다. "그거… 우리 아버지 글씨예요."

```
SCENE: the miner's family. The edge of the village square of Acorn Ford by day: packed dirt road #C08A58 #8E5E38 below the ground line, a low stone wall #9A948C #C8C2B8 behind, a distant house with a round acorn-cap brown roof #8E5E38 and a clothesline on the right, pale sky #B9C8FF with one flat cloud #E8EEF2. Bright, calm, a quiet surprise.
HERO SLOT (keep empty): 0.11 to 0.36 of the panel width, ground line up to row 10, show only plain wall, road and sky. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE AND PROPS:
- A low wooden crate #C08A58 #8E5E38 at 0.41-0.50 (top at row 46) with the torn map lying unfolded on it: about 14 by 10 blocks, cream #F0E6CC, one jagged edge, thin brown lines and a tiny bell drawing, both #8E5E38, no writing.
- [ID-N05] Standing centered at 0.66, facing LEFT toward the map.
FRAMES: 1 Sena stands still, eyes wide in surprise; 2 she leans one block forward; 3 she reaches one hand toward the map; 4 same as frame 2. Her muffler end swings one block in frames 2 and 3.
```

- 입력: nref(5칸 = 세나).
- 배치: 주인공 x 30 `대기`, 자리 14~46(0.11~0.36) / 상자와 지도 52~64 / 세나 72~96.
- 프레임: 멈춤(놀람) → 몸 기울임 → 손 뻗음 → 기울임. 15 §9.3의 「놀라 멈춤 → 손을 뻗음」을 처음 자세로 돌아오는 몸짓(1→2→3→2)으로 옮겼다(15 §9.3 프레임 행).
- 지도 자리: 11 도입은 주인공이 지도를 펼친다. 주인공 레이어는 `대기`라 손에 든 지도가 없으므로 장면의 상자 위에 둔다(15 §9.3 표에 주인공 소품이 없다. `OPEN_DECISIONS.md` OD-43).
- 팔레트: 길 `#C08A58` `#8E5E38`, 담 `#9A948C` `#C8C2B8`, 지붕 `#8E5E38`, 하늘 `#B9C8FF` `#E8EEF2`, 상자 `#C08A58` `#8E5E38`, 지도 `#F0E6CC` `#C8C2B8` `#8E5E38`, 세나 `#4A3A32` `#2F2420` `#E3B48E` `#C88E68` `#B04A42` `#E0B06A` `#B07A3A` `#8E5E38` `#5E3C24` `#C8C2B8` `#9A948C`, 외곽선.
- 장면 금지: 세나가 우는 얼굴 금지(조심스럽고 놀란 얼굴). 다른 마을 사람 없음.

### ES05 · C01-3 무너진 갱도 다리

11 도입(한 줄): 무너진 갱도 다리 앞에 섰다 / 벽 너머에서 돌 두드리는 소리. 선택 대기로 이어지는 중대 분기다.

```
SCENE: the collapsed mine bridge. The middle level of the abandoned mine, blue-grey tone: rock walls #7D7B80 #6E6862 with a blue ore vein #5A7FA8, a thin metal pipe along rows 12-14, a few bronze bell shards #B07A3A on a ledge. On the left a solid rock ledge from 0 to 0.48, its flat top exactly on the ground line. From 0.50 a wooden plank bridge #C08A58 #8E5E38 with rope rails continues to the right at the ground line, BROKEN between 0.70 and 0.80: a gap with a deep chasm below, filled with flat bands #6E6862 and #4C4A52, never darker. Beyond the gap a far rock wall from 0.82 to 1.0. Tense but not frightening.
HERO SLOT (keep empty): 0.06 to 0.31 of the panel width, ground line up to row 10, show only plain rock wall and ledge. No person, prop, shadow or bright detail (the player character is added later).
DETAILS: the broken bridge end at 0.70 hangs one block lower with two dangling planks; a trickle of small stone dust #C8C2B8 #9A948C falls from a crack in the far wall at 0.88.
FRAMES: the dust specks fall one block per frame in a repeating pattern; the dangling planks sway down and up by 0, 1, 1, 0 blocks; the rope rail sags one block in frames 2 and 3.
```

- 입력: 폐광 중층 배경이 합격해 있으면 장소 참고.
- 배치: 주인공 x 24 `발견`, 자리 8~40(0.06~0.31) / 다리 64~128, 끊긴 곳 90~102 / 먼 벽 105~128 / 돌가루 x 112.
- 프레임: 돌가루 낙하(반복 무늬), 다리 끝 0·1·1·0, 밧줄 처짐.
- 분위기: D2 중층(15 §8.3 청회색, 금속 파이프, 종 파편, 청 광맥). 긴장하되 공포가 아니다.
- 팔레트: 벽 `#7D7B80` `#6E6862` `#5A7FA8`, 틈 `#6E6862` `#4C4A52`, 다리 `#C08A58` `#8E5E38`, 밧줄 `#C08A58`, 종 파편 `#B07A3A`, 돌가루 `#C8C2B8` `#9A948C`, 파이프 `#B4B2B0`, 외곽선(다리·파편만).
- 장면 금지: 벽 너머 사람(광부) 그림 금지 — 소리는 돌가루로만 보인다. 검은 구멍(`#2B2233` 틈) 금지.

### ES06 · C02-1 다리 밑에서 우는 아이

11 도입: 여울 다리 밑에서 작은 아이가 무릎을 끌어안고 울고 있다. 손에는 나무 호각이 꼭 쥐여 있다. "토리… 집에 가는 길을 잃었어."

```
SCENE: a child crying under the bridge. Under the stone arch bridge of Acorn Ford by the water: the underside of the arch #9A948C #C8C2B8 fills rows 0-12 and comes down as a thick stone pier at 0.86-1.0; a shallow stream #5A7FA8 with ripple highlights #B9C8FF flows behind the figures in rows 40-54; a pebbly bank #C8C2B8 #9A948C with a few reeds #6D8F5A #4D6A3E in front, its top on the ground line. Soft shaded daylight; lonely but gentle.
HERO SLOT (keep empty): 0.09 to 0.34 of the panel width, ground line up to row 12, show only plain water, bank and bridge stone. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE: [ID-N09] Sitting on the bank centered at 0.64, facing LEFT, hugging both knees, face bowed onto the knees, the flat wooden whistle on its cord clutched in one hand: a flat tube about 12 by 5 blocks, #C08A58 #8E5E38, a round sound hole near the far end, a small loop on top. Two single-block tears #B9C8FF.
FRAMES: Tori's shoulders rise one block in frames 2 and 4 (sobbing) and settle in frames 1 and 3; the ripple highlights shift one block to the right each frame in a repeating pattern.
```

- 입력: nref(9칸 = 토리). 호각 소품이 합격해 있으면 함께.
- 배치: 주인공 x 28 `발견`, 자리 12~44(0.09~0.34) / 토리 72~92(앉음) / 교각 110~128.
- 프레임: 어깨 들썩임 0·1·0·1, 물결 반짝임 오른쪽으로 한 블록씩(무늬 주기 4).
- 분위기: 외롭지만 부드럽다. 곧 도움을 받을 아이.
- 팔레트: 돌 `#9A948C` `#C8C2B8`, 물 `#5A7FA8` `#B9C8FF`, 둑 `#C8C2B8` `#9A948C`, 갈대 `#6D8F5A` `#4D6A3E`, 토리 `#C08A58` `#7A4E24` `#A4523A` `#F6D9C2` `#E8B89A` `#FFE38A` `#5A7FA8` `#B04A42` `#3E5A7E`, 호각 `#C08A58` `#8E5E38`, 외곽선.
- 장면 금지: 크게 벌린 입의 울부짖음 금지. 늑대 없음.

### ES07 · C02-2 언덕의 호각 소리

11 도입: 언덕 너머에서 가늘고 높은 호각 소리가 끊어질 듯 이어진다. 광대 가족의 짐수레가 여울 늑대들에게 둘러싸여 있다.

```
SCENE: a whistle on the hill. A windy hilltop meadow by day: pale sky #B9C8FF, one flat cloud #E8EEF2, tawny grass #B8A04A with #8FC06A patches, a far ridge #5E9A4A, one round boulder #9A948C at 0.38. Urgent but not violent.
HERO SLOT (keep empty): 0.03 to 0.28 of the panel width, ground line up to row 10, show only plain grass and sky. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE, CREATURES AND PROPS:
- A clown family's handcart wagon from 0.56 to 0.94 on the ground line: wooden bed and two wheels #C08A58 #8E5E38, an arched cloth cover with bright stripes #B04A42 #FFE38A #5A7FA8.
- [ID-N09] Standing on the wagon's front board at 0.66 (feet on row 46), blowing the flat wooden whistle (#C08A58 #8E5E38, a sound hole, a small loop) held to the mouth, cheeks puffed.
- Three short curved sound arcs #FFFFFF in front of the whistle: plain arcs, not musical notes.
- Two small distant wolves on the far slope between 0.34 and 0.52, rows 36-46, half size, flat grey-blue silhouettes #8A96A6 #6C6A70 without dark outline, low prowling stance, facing right toward the wagon.
FRAMES: sound arcs 1, 2, 3, then 2; the wagon cover flaps one block in frames 2 and 4; the wolves creep right by 0, 1, 2, 1 blocks.
```

- 입력: nref(9칸 = 토리). 늑대 EN03 시트가 합격해 있으면 모양 참고(늑대 계열 48 × 32, 15 §7.1).
- 배치: 주인공 x 20 `걷기`, 자리 4~36(0.03~0.28) / 바위 x 48 / 늑대 둘 44~66 / 수레 72~120 / 토리 x 84, 발 y 46.
- 프레임: 소리 선 1·2·3·2줄, 덮개 펄럭임, 늑대 0·1·2·1블록. 15 §9.3의 「늑대 그림자 다가옴」을 처음 자리로 돌아오는 서성임으로 옮겼다(15 §9.3 프레임 행).
- 늑대: 15 §9.3은 적이 나오면 7절 외형·색을 따르라 한다. 여울 늑대 EN03 회청 `#8A96A6`을 쓰되, 15 §9.3 표가 「늑대 그림자」라 했으므로 외곽선 없는 납작한 형체로 그렸다(`OPEN_DECISIONS.md` OD-44).
- 팔레트: 하늘 `#B9C8FF` `#E8EEF2`, 풀 `#B8A04A` `#8FC06A` `#5E9A4A`, 바위 `#9A948C`, 수레 `#C08A58` `#8E5E38` `#B04A42` `#FFE38A` `#5A7FA8`, 토리 색, 호각 `#C08A58` `#8E5E38`, 소리 선 `#FFFFFF`, 늑대 `#8A96A6` `#6C6A70`(적 확장 묶음), 외곽선.
- 장면 금지: 늑대가 무는 장면·이빨 클로즈업 금지. 음표 기호 금지(음표는 방향이 있는 기호다).

### ES08 · C02-3 호각의 보답

11 도입: 광장에 알록달록한 광대 천막이 섰다. 토리가 달려와 {name}의 손에 나무 호각을 쥐여 준다. "이제 이건 네 거야. 위험하면 크게 불어."

```
SCENE: the whistle's reward. The village square on a bright day: a big colorful clown tent from 0.55 to 1.0 in the background (striped cloth #B04A42 #F0E6CC and #5A7FA8 #FFE38A panels, a background surface without dark outline), two small pennant flags on the tent poles in rows 16-24, cobbled square #C8C2B8 #9A948C below the ground line, pale sky #B9C8FF. Joyful and festive.
HERO SLOT (keep empty): 0.14 to 0.39 of the panel width, ground line up to row 10, show only plain square and sky. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE: [ID-N09] Standing in front of the tent centered at 0.59, facing LEFT, one arm stretched out to the left holding the flat wooden whistle (#C08A58 #8E5E38, a sound hole, a small loop) on its cord, a big happy open smile.
FRAMES: Tori hops: 0, 1, 2, 1 blocks above the ground line in frames 1-4, the whistle arm one block higher in frame 3; the pennants flap one block in frames 2 and 4.
```

- 입력: nref(9칸 = 토리).
- 배치: 주인공 x 34 `상호작용`, 자리 18~50(0.14~0.39) / 토리 68~84, 호각 끝 x 62 / 천막 70~128.
- 프레임: 폴짝 0·1·2·1블록, 깃발 펄럭임.
- 분위기: 축제, 기쁨. 광대 가족 다른 사람은 그리지 않는다(표에 없음).
- 팔레트: 천막 `#B04A42` `#F0E6CC` `#5A7FA8` `#FFE38A`, 깃대 `#8E5E38`, 광장 `#C8C2B8` `#9A948C`, 하늘 `#B9C8FF`, 토리 색, 호각, 외곽선(토리·호각).
- 장면 금지: 천막 간판 글자 금지. 광대 분장한 어른 금지.

### ES09 · F01 전문화의 갈림길 (끝 유지)

11 선택 창 본문: 하델이 길드 명부를 덮고 {name}을 부른다. "이제 초보 딱지는 뗄 때가 됐지. 방패를 들고 앞에 설 텐가, 지도를 들고 앞서 걸을 텐가?"

```
SCENE: the crossroads of specialization; a hold scene (the last panel stays). Interior of the guild branch office: plank wall #C08A58 #8E5E38; on the wall a round wooden shield #8E5E38 with a metal rim #B4B2B0 at 0.84-0.94 (rows 22-34) and a pinned paper map #F0E6CC #C8C2B8 with brown lines and no writing at 0.40-0.55 (rows 20-32); a green guild banner #6D8F5A with a pale forked-path mark (a simple Y shape) hanging at the right edge; plank floor below the ground line. Serious and calm, warm afternoon light from the left.
HERO SLOT (keep empty): 0.11 to 0.36 of the panel width, ground line up to row 10, show only plain wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE AND PROPS:
- A wooden standing lectern at 0.49-0.58 (top at row 40) holding a thick guild ledger, cover #5E3C24, cream pages #F0E6CC, no writing.
- [ID-N01] Standing centered at 0.69, facing LEFT, leaning on the cane with the far hand, the near hand on the ledger.
FRAMES (one way, frame 4 is held): 1 ledger open, Hadel looking down at it; 2 its cover half raised by Hadel's hand; 3 ledger closed, his hand flat on it, head still bowed; 4 same as 3 but his head raised, looking LEFT toward the empty slot. Frame 4 alone must read as Hadel with the closed ledger, turning to the hero to ask.
```

- 입력: nref(1칸 = 하델).
- 배치: 주인공 x 30 `대기`, 자리 14~46(0.11~0.36) / 벽 지도 51~70 / 명부대 63~74 / 하델 76~100 / 방패 108~120.
- 프레임: 명부 열림 → 반쯤 → 닫힘 → 닫힘 + 고개를 듦, **4칸째 유지**(15 §9.3 ES09 「명부를 덮고 고개를 듦, 끝 유지」, e878cce). 움직임 줄이기에서도 4칸째만 보인다. v1.0의 방패·지도 반짝임은 15 표에서 빠져 지웠다.
- 분위기: 진지하지만 따뜻하다. 결정을 기다리는 자리.
- 팔레트: 벽·바닥 `#C08A58` `#8E5E38`, 방패 `#8E5E38` `#B4B2B0`, 지도 `#F0E6CC` `#C8C2B8` `#8E5E38`, 깃발 `#6D8F5A` `#F0E6CC`, 명부 `#5E3C24` `#F0E6CC`, 하델 색, 외곽선.
- 장면 금지: 명부·지도·깃발에 글자 금지. 방패·지도 말고 다른 무기 진열 없음.

### ES10 · F02 별잠 샘물

11 선택 창 본문: 길바뀜의 틈 안쪽, 별빛 문양이 새겨진 돌샘에서 물이 솟는다. … 샘가에는 다리를 다친 길잡이 유안이 앉아 있다. "그 물, 한 사람 몫밖에 안 나와요."

```
SCENE: the Starsleep spring. The end of a misty mountain path: pale misty sky #E8EEF2 #B9C8FF, two dark-green conifers #4D6A3E #6D8F5A at the right edge, mossy rocks #9A948C #6D8F5A, flat horizontal mist bands #E8EEF2 across rows 30-40 (flat and opaque, no transparency). Hushed, sacred, a little sad.
HERO SLOT (keep empty): 0.05 to 0.30 of the panel width, ground line up to row 10, show only plain mist, rock and path. No person, prop, shadow or bright detail (the player character is added later).
PROPS AND PEOPLE:
- The Starsleep spring from 0.44 to 0.72 on the ground line: a low round stone basin #C8C2B8 #9A948C, its rim carved with small four-point star marks, clear water #B9C8FF with two flat ripple rings rising gently in the middle.
- [ID-N07] Sitting on the ground centered at 0.78, leaning back against the right side of the basin, facing LEFT, the bandaged leg stretched out.
FRAMES: the ripple rings on the water move outward in four phases and loop; one star mark sparkles #FFFFFF in frame 2 and another in frame 4; Yuan's chest rises one block in frame 3.
```

- 입력: nref(7칸 = 유안). 별잠 샘물 소품이 합격해 있으면 함께 — 없으면 이 장면이 샘 모양의 기준이 되고 AO-50 `prop_star_spring`에 넘긴다.
- 배치: 주인공 x 22 `발견`, 자리 6~38(0.05~0.30) / 샘 56~92 / 유안 90~112(앉음) / 침엽수 112~128.
- 프레임: 물결 4위상 반복, 별 반짝 2·4칸, 유안 숨.
- 장소: 15 §9.3은 「안개 산길 끝」, 11 F02·02 §6.4는 「길바뀜의 틈 안쪽」이다. 표를 따랐다(사용자 결정 `OPEN_DECISIONS.md` OD-11). 틈으로 바꾸면 SCENE 첫 문장을 `Inside the Pathshift rift: cracked dark-grey rock #6E6862 #7D7B80 with starlight leaking through the cracks as flat pale bands #B9C8FF #FFE38A, a few small floating stone fragments` 로 바꾼다.
- 팔레트: 하늘 `#E8EEF2` `#B9C8FF`, 안개 `#E8EEF2`, 나무 `#4D6A3E` `#6D8F5A`, 바위 `#9A948C` `#6D8F5A`, 샘 `#C8C2B8` `#9A948C` `#B9C8FF`, 반짝 `#FFFFFF`, 유안 `#3A4458` `#262E3E` `#B97F5A` `#93603F` `#6D8F5A` `#4D6A3E` `#B4B2B0` `#B04A42` `#F0E6CC` `#C8C2B8`, 외곽선.
- 장면 금지: 피·상처 금지 — 다친 다리는 흰 붕대로만. 반투명 안개 금지(불투명 띠).

### ES11 · F03 마지막 잔을 권하는 성주

11 선택 창 본문: 틈의 끝, 검은 장미가 핀 지하 계단 위에 긴 탁자가 놓여 있다. 창백한 얼굴의 비엘 달그늘이 낡은 은잔을 민다. "너의 길은 아직 끝나지 않았구나."

```
SCENE: the lord offers the last cup. An underground stair hall of the Moonshadow estate: cold lilac stone walls #A596B0 #CFC3D6 with block joints #7D7B80, a flight of stone steps rising to the upper right in the background with moonlight as flat pale bands #B9C8FF on the steps, stone floor #7D7B80 below the ground line. A long table from 0.39 to 0.92 with a wine-red cloth #7A1F33, its top at row 40. Elegant, cool, quietly tempting; not horror.
HERO SLOT (keep empty): 0.08 to 0.33 of the panel width, ground line up to row 10, show only plain stone wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE AND PROPS:
- [ID-N08] Standing behind the table centered at 0.72, facing LEFT, lower body hidden by the table, one hand pushing the cup.
- A footed silver chalice #E8E6E0 #B4B2B0 with a round base on the table at 0.56 under his fingers.
- A three-candle bronze candelabra #B07A3A on the table at 0.86, flames #FFE38A.
- Black roses on a vine around the table's left leg at 0.40: petals #7A1F33 #2E2438, leaves #4D6A3E.
FRAMES: the chalice slides left by 0, 1, 2, 1 blocks with his hand following; the candle flames flicker; one rose sways one block in frames 2 and 3.
```

- 입력: nref(8칸 = 비엘). 은잔 아이콘(AO-57 R04)이 합격해 있으면 함께.
- 배치: 주인공 x 26 `대기`, 자리 10~42(0.08~0.33) / 탁자 50~118(윗면 y 40) / 장미 x 51 / 은잔 x 72 / 비엘 80~104 / 촛대 x 110.
- 프레임: 잔 밀기 0·1·2·1블록, 촛불, 장미. 「잔이 탁자 위로 밀려 옴」을 처음 자리로 돌아오는 몸짓으로 옮겼다(15 §9.3 프레임 행).
- 분위기: 우아하고 서늘하다. 흡혈 장면이 아니다(02 §10).
- 팔레트: 벽 `#A596B0` `#CFC3D6` `#7D7B80`, 달빛 `#B9C8FF`, 바닥 `#7D7B80`, 탁자보 `#7A1F33`, 은잔 `#E8E6E0` `#B4B2B0`, 촛대 `#B07A3A` `#FFE38A`, 장미 `#7A1F33` `#2E2438` `#4D6A3E`, 비엘 `#EDE6EE` `#CFC3D6` `#A596B0` `#C2263A` `#E8E4DC` `#C8C2B8` `#2E2438` `#7A1F33`, 외곽선. 변이·정예 묶음을 쓰는 두 장면 중 하나다.
- 장면 금지: 붉은 액체 흘림·송곳니 강조·박쥐 금지. 잔 속 음료는 보이지 않게.

### ES12 · S01 가정을 꾸리다

11 상세 기록(배우자형): 여울 다리 위에서 {partner}와 약속을 나눴다. 여울가 작은 집에 등불이 하나 더 걸렸다. `{partner}`는 성별을 드러내지 않는다.

```
SCENE: starting a household. Evening on top of the stone bridge over the ford: sunset sky in flat stepped bands #FFE38A, #E0B06A, #B9C8FF (bands, not a gradient), small distant village roofs #8E5E38 on the horizon, the bridge deck of pale stone #C8C2B8 #9A948C whose top is the ground line across the whole panel, and below the deck edge (rows 60-63) a strip of stream #5A7FA8 with ripples #B9C8FF. A low stone railing runs behind the figures (top at row 44). Two iron lantern posts #4C4A52 stand on the railing at 0.09 and 0.88, lantern tops at rows 22-26. Tender, quiet, warm.
HERO SLOT (keep empty): 0.19 to 0.44 of the panel width, ground line up to row 10, show only plain sky, railing and deck. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE: [ID-PARTNER] Standing centered at 0.55, facing LEFT toward the empty slot, a gentle smile, hands loosely together.
FRAMES: the right lantern at 0.88 comes alive: 1 dark glass #7D7B80, 2 small ember #C8783A, 3 fully lit #FFE38A, 4 ember #C8783A; the left lantern stays lit and steady; the ripples shift one block right each frame in a repeating pattern.
```

- 입력: nref(10칸 = 동반자).
- 배치: 주인공 x 40 `대기`, 자리 24~56(0.19~0.44) / 동반자 58~82 / 등불 x 12, x 112.
- **간격이 가장 좁은 장면**이다. 주인공 자리 끝(56)과 동반자 왼쪽 끝(58) 사이가 2px다. 합성 검수에서 가장 먼저 본다(§6).
- 프레임: 오른쪽 등불 꺼짐 → 불씨 → 켜짐 → 불씨(숨 쉬듯 되풀이). 「등불이 하나 더 켜짐」을 1→2→3→2 몸짓으로 옮겼다(15 §9.3 프레임 행).
- 형태 변형: 배우자·동반자·공동 양육 가족 세 형태가 이 장면 하나를 쓴다(15 §9.3 표 아래 문단).
- 팔레트: 노을 `#FFE38A` `#E0B06A` `#B9C8FF`, 지붕 `#8E5E38`, 다리 `#C8C2B8` `#9A948C`, 물 `#5A7FA8` `#B9C8FF`, 등불 기둥 `#4C4A52`, 등불 `#7D7B80` `#C8783A` `#FFE38A`, 동반자 `#4A3A32` `#2F2420` `#E3B48E` `#C88E68` `#5A7FA8` `#3E5A7E` `#F0E6CC` `#8E5E38` `#C8C2B8` `#9A948C`, 외곽선. `#4A3A32` `#2F2420`은 이 장면에서 동반자 머리에만 쓴다(교체용).
- 장면 금지: 하트·반지·입맞춤·꽃다발 등 연애 공략 표현 금지(02 §10). 성별을 알리는 옷·체형·머리 모양 금지.

### ES13 · S02 아이의 소식

11 상세 기록: 첫째 — 작은 울음소리가 여관까지 들렸다. 둘째 이후 — 집이 조금 좁아졌다. 문 앞 신발이 하나 늘었다.

```
SCENE: news of a child. Early evening at the door of a small house by the ford: a cottage wall #F0E6CC #C8C2B8 with a timber frame #8E5E38 from 0.42 to 1.0, the edge of a round acorn-cap brown roof #8E5E38 #C08A58 in the top rows, a warm lit window with inner squares #FFE38A and a frame #E0B06A at 0.47-0.56 (rows 24-36), a wooden door #C08A58 #8E5E38 at 0.77-0.92; to the left an open view of the ford #5A7FA8 and evening sky bands #B9C8FF #E0B06A; a stepping-stone path #9A948C below the ground line. Warm, happy, gentle.
HERO SLOT (keep empty): 0.16 to 0.41 of the panel width, ground line up to row 6, show only plain sky, water and path. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE AND PROPS:
- [ID-PARTNER] The same person as the partner reference, standing centered at 0.63, facing LEFT, cradling in both arms a swaddled baby: a small cream bundle #F0E6CC with a blue edge #5A7FA8 and only a tiny round face (3 blocks) #F6D9C2.
- One tiny pair of red child's shoes #B04A42 on the ground by the door at 0.80-0.86.
FRAMES: the bundle rocks by 0, 1, 0, 1 blocks to the left; the window's inner squares swap between #FFE38A and #E0B06A in frames 2 and 4.
```

- 입력: nref(10칸 = 동반자). ES12가 먼저 합격했으면 ES12 띠도 정체성 입력으로.
- 배치: 주인공 x 36 `환호`, 자리 20~52(0.16~0.41), 위로 y 6까지 / 창 60~72 / 동반자 68~92 / 신발 102~110 / 문 98~118.
- 프레임: 포대기 흔들기 0·1·0·1, 창 불빛.
- 아기 표현: 포대기와 3블록 얼굴만. 표정·손발·성별을 그리지 않는다(02 §10, `OPEN_DECISIONS.md` OD-45).
- 팔레트: 벽 `#F0E6CC` `#C8C2B8` `#8E5E38`, 지붕 `#8E5E38` `#C08A58`, 창 `#FFE38A` `#E0B06A`, 문 `#C08A58` `#8E5E38`, 물·하늘 `#5A7FA8` `#B9C8FF` `#E0B06A`, 길 `#9A948C`, 포대기 `#F0E6CC` `#5A7FA8` `#F6D9C2`, 신발 `#B04A42`, 동반자 색, 외곽선.
- 장면 금지: 출산 과정·침대의 산모 금지(02 §10). 우는 아기 얼굴 금지.

### ES14 · S03 은퇴

11 상세 기록 첫 문장: "{name}은 {age}세에 모험가 명부에서 이름을 내렸다." 역할별 소품(여관 간판·목검·편지·명부)은 주인공 쪽 소품으로 얹는다(15 §9.3).

```
SCENE: retirement. Sunset in front of the guild branch office: the office facade from 0.55 to 1.0 (plank wall #C08A58 #8E5E38, a door, a notice board with blank pinned papers, a green guild banner #6D8F5A with a pale Y-shaped forked-path mark), a dirt road #C08A58 below the ground line, a sunset sky in flat stepped bands #FFE38A #E0B06A #B04A42 #B9C8FF with two flat clouds #F0E6CC. Bittersweet, warm and peaceful.
HERO SLOT (keep empty): 0.11 to 0.36 of the panel width, ground line up to row 10, show only plain sky and road. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE:
- [ID-N01] Standing centered at 0.66, facing LEFT, raising the free hand to wave goodbye, the cane in the other.
- [ID-N04] Standing centered at 0.81, facing LEFT, one hand raised waving, a little behind Hadel where they overlap.
FRAMES: Hadel's hand: up, tilted, up, tilted; Dodam's hand: tilted, up, tilted, up; the clouds drift right by 0, 1, 2, 1 blocks.
```

- 입력: nref(1칸 = 하델, 4칸 = 도담).
- 배치: 주인공 x 30 `대기`(노년 외형은 게임이 얹는다), 자리 14~46(0.11~0.36) / 하델 72~96 / 도담 92~116 / 건물 70~128.
- 프레임: 손 흔들기 두 사람이 한 칸씩 엇갈림, 구름 0·1·2·1.
- 분위기: 아쉽지만 평온하다. 이별이 아니라 쉼.
- 팔레트: 노을 `#FFE38A` `#E0B06A` `#B04A42` `#B9C8FF`, 구름 `#F0E6CC`, 건물 `#C08A58` `#8E5E38`, 게시판 종이 `#F0E6CC`, 깃발 `#6D8F5A` `#F0E6CC`, 길 `#C08A58`, 하델·도담 색, 외곽선.
- 장면 금지: 역할 소품(간판·목검·편지·명부)을 장면에 그리지 않는다 — 게임이 주인공 쪽에 얹는다. 게시판 글자 금지.

### ES15 · S04 생애의 끝 (끝 유지)

09 §5.2: `쓰러짐` → 등불이 깜빡이다 꺼짐 → 인물이 사라지고 배낭과 무기 한 점이 남음 → 길드 편지. ES15는 그 가운데 `꺼진 등불 → 남은 배낭` 칸을 대신한다. 한 줄 기록: `[사망] {name}의 등불이 꺼졌다`.

```
SCENE: the end of a life. A hold scene: the last panel stays on screen. A quiet empty floor that is not any real place: a flat dusk-grey floor #6E6862 below the ground line with a slightly lighter top edge #7D7B80, and behind it one deep flat blue-grey #4C4A52 with a slightly lighter band #5A6A9A near the horizon (rows 44-55). No walls, no enemies, no people, no player character anywhere. Calm, dignified, sad but gentle; never scary.
EMPTY LEFT SIDE: from 0 to 0.42 of the panel width only plain floor and background; nothing is added there.
PROPS (between 0.44 and 0.62, standing on the ground line):
- A small standing lantern centered at 0.48, about 14 by 20 blocks, bronze frame #B07A3A #7A4E24, glass panel.
- A left-behind small boxy travel backpack #8E5E38 #5E3C24 with a rolled flap, centered at 0.57, leaning slightly toward the lantern.
FRAMES (one way, frame 4 is held): the lantern goes out in four steps. 1 flame #FFE38A with two flat light rings on the floor #9A948C and #7D7B80; 2 smaller flame, one ring; 3 a tiny ember #C8783A, no ring; 4 extinguished: glass #6E6862, no yellow pixel anywhere. Frame 4 alone must read as a lantern gone out beside a backpack.
```

- 입력: 없음. 세움 등불·꺼진 등불 소품(AO-50)이 합격해 있으면 함께.
- 배치: 주인공 없음(15 §9.3: 얹지 않는다). 등불 55~68, 배낭 64~80.
- 프레임: 켜짐 → 작아짐 → 불씨 → 꺼짐, **4칸째 유지**. 움직임 줄이기에서도 4칸째만 보인다.
- 분위기: 슬프지만 담담하다. 어둠은 짙은 청회색까지만(검정 금지). 공포·피·쓰러진 몸 금지.
- 팔레트: 바닥 `#6E6862` `#7D7B80`, 배경 `#4C4A52` `#5A6A9A`, 빛 고리 `#9A948C` `#7D7B80`, 등불 `#B07A3A` `#7A4E24` `#FFE38A` `#C8783A` `#6E6862`, 배낭 `#8E5E38` `#5E3C24`, 외곽선(등불·배낭).
- 장면 금지: 무덤·묘비·해골·꽃다발·무기 금지(09 §5.2의 「무기 한 점」은 `OPEN_DECISIONS.md` OD-18). 4칸째 `#FFE38A` 화소 0(AO-50 `prop_lantern_out`과 같은 기준).

### ES16 · S05 계승

11: `[계승] {heir}은 {parent_call}의 수첩을 펼쳤다` / 상세: "첫 장에는 {first_page}이 있었다."

```
SCENE: succession. An evening window corner in the family home: a wooden wall #C08A58 #8E5E38, a window at 0.47-0.78 (rows 16-38) showing dusk sky bands #E0B06A #B9C8FF and a far roof #8E5E38, and below it a low wooden table from 0.44 to 0.80 with its top at row 44, standing on a plank floor #8E5E38. Hushed, thoughtful, warm.
HERO SLOT (keep empty): 0.11 to 0.36 of the panel width, ground line up to row 10, show only plain wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PROPS ON THE TABLE:
- An open travel notebook at 0.56-0.66: cover #8E5E38, cream pages #F0E6CC, no writing.
- An empty small wooden keepsake stand #8E5E38 #C08A58 at 0.70-0.76: a little cradle-shaped holder with nothing on it.
- One candle #F0E6CC in a bronze holder #B07A3A at 0.49, flame #FFE38A.
FRAMES: the candle flame flickers in four shapes; the notebook's top page lifts by 0, 1, 2, 1 blocks.
```

- 입력: 없음. 책 소품(AO-49)이 합격해 있으면 수첩 모양 참고.
- 배치: 주인공 x 30 `앉기와 식사` + 책(게임이 얹음), 자리 14~46(0.11~0.36) / 초 x 63 / 수첩 72~84 / 빈 받침 90~98 / 탁자 56~102.
- 프레임: 촛불, 수첩 책장 들썩임 0·1·2·1. 주인공 손의 책은 게임의 책 소품(2프레임)이다.
- 빈 받침: 부모의 유품이 놓일 자리다. 실제 유품은 그리지 않는다(세대마다 다르다).
- 팔레트: 벽·바닥 `#C08A58` `#8E5E38`, 창 `#E0B06A` `#B9C8FF` `#8E5E38`, 탁자 `#C08A58` `#8E5E38`, 수첩 `#8E5E38` `#F0E6CC`, 받침 `#8E5E38` `#C08A58`, 초 `#F0E6CC` `#B07A3A` `#FFE38A`, 외곽선.
- 장면 금지: 영정·초상화·무덤 금지. 수첩 글자 금지.

### ES17 · S06 길드 지원

11 상세 기록: 하델이 말했다. "빈손으로 돌아오는 날도 있지. 여기 녹슨 검이라도 쥐게. 숙소 밥은 싱거워도 배는 부를 거야."

```
SCENE: guild support. A small guild dormitory room: plain plank wall #C08A58 #8E5E38, a narrow cot at the right edge from 0.80 to 1.0 (grey blanket #9A948C #C8C2B8 on a wooden frame #8E5E38), a small oil lamp hanging from a hook at 0.55 in rows 18-28 (bronze #B07A3A, flame #FFE38A), a plank floor below the ground line. Modest, kind, a little rueful.
HERO SLOT (keep empty): 0.125 to 0.375 of the panel width, ground line up to row 10, show only plain wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PEOPLE AND PROPS: [ID-N01] Standing centered at 0.67, facing LEFT, holding out in both open hands, flat and horizontal at chest height, a rusty short straight sword about 16 blocks long: blade #B0603A #7D7B80 with one chipped notch, small cross guard, dark leather grip #5E3C24 pointing to the left. The grip end is at 0.46.
FRAMES: Hadel's arms and the sword move toward the left by 0, 1, 2, 1 blocks; the hanging lamp swings by 0, 1, 0, 1 blocks.
```

- 입력: nref(1칸 = 하델). 녹슨 검(W01 V1) 레이어가 합격해 있으면 모양 참고.
- 배치: 주인공 x 32 `상호작용`, 자리 16~48(0.125~0.375) / 손잡이 끝 x 59~61 / 하델 74~98 / 등잔 x 70 / 침상 102~128.
- 프레임: 검 내밀기 0·1·2·1, 등잔 흔들림.
- 분위기: 도움을 받는 부끄러움과 고마움. 가난을 비참하게 그리지 않는다.
- 팔레트: 벽·바닥 `#C08A58` `#8E5E38`, 침상 `#9A948C` `#C8C2B8` `#8E5E38`, 등잔 `#B07A3A` `#FFE38A`, 검 `#B0603A` `#7D7B80` `#5E3C24`, 하델 색, 외곽선.
- 장면 금지: 검을 휘두르거나 겨누는 자세 금지(날이 주인공 쪽을 향하지 않게 손잡이가 왼쪽).

### ES18 · S07 은퇴한 부모의 편지

11 예: "여관 뒷마당 사과나무에 꽃이 폈다. 너도 밥은 꼭 챙겨 먹어라."

```
SCENE: a letter from a retired parent. A window seat inside the inn: plank wall #C08A58 #8E5E38, a wide window at 0.50-0.92 (rows 16-40) looking out on the ford (flat water #5A7FA8 with ripples #B9C8FF, far-bank grass #8FC06A, a tree branch with leaves #6D8F5A #8FC06A along the window's top edge), a wooden table from 0.44 to 0.80 with its top at row 44, a plank floor. A warm, nostalgic afternoon.
HERO SLOT (keep empty): 0.11 to 0.36 of the panel width, ground line up to row 10, show only plain wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PROPS ON THE TABLE:
- A sealed envelope at 0.47-0.56, 12 by 9 blocks, cream #F0E6CC with shade #C8C2B8, one symmetric round red wax seal #B04A42 in the center, no writing and no diagonal strokes.
- A candle #F0E6CC in a bronze holder #B07A3A at 0.74, flame #FFE38A.
FRAMES: the leaves outside sway by 0, 1, 0, 1 blocks; the candle flame flickers; the ripples shift one block right each frame in a repeating pattern.
```

- 입력: 없음. 편지 소품(AO-49 `prop_letter`)이 합격해 있으면 함께.
- 배치: 주인공 x 30 `상호작용`, 자리 14~46(0.11~0.36) / 편지 60~72(윗면 y 44 위) / 초 x 95 / 창 64~118.
- 프레임: 잎 흔들림, 촛불, 물결.
- 팔레트: 벽·바닥 `#C08A58` `#8E5E38`, 창밖 `#5A7FA8` `#B9C8FF` `#8FC06A` `#6D8F5A`, 탁자 `#C08A58` `#8E5E38`, 편지 `#F0E6CC` `#C8C2B8` `#B04A42`, 초 `#F0E6CC` `#B07A3A` `#FFE38A`, 외곽선.
- 장면 금지: 편지 글씨·우표 무늬 금지. 봉인 옆 대각선 획 금지(AO-49).

### ES19 · S08 긴 잠 (끝 유지)

11 상세 기록(정해진 나이): "{name}은 달그늘 지하의 서늘한 방에 누웠다. 비엘이 촛불 하나를 켜 두고 문을 닫았다. '좋은 꿈을.'"

```
SCENE: the long sleep; a hold scene (the last panel stays). A cool quiet chamber under the Moonshadow estate: lilac-grey stone walls #A596B0 #CFC3D6 with joints #7D7B80, a small high window slit letting in flat pale moonlight bands #B9C8FF, a stone floor #7D7B80 #9A948C. Serene and restful, never frightening.
HERO SLOT (keep empty): 0.09 to 0.44 of the panel width, ground line up to row 30, show only plain wall. Below it, from 0.08 to 0.46, a low stone pallet whose flat top is the ground line, a pale lilac sheet #CFC3D6 over its front (rows 56-62); nobody lies on it.
PROPS AND PEOPLE:
- At 0.49 on a small stone stand by the pallet's head end: one candle #F0E6CC with a steady flame #FFE38A and a small vase of two black roses #7A1F33 #2E2438.
- A doorway from 0.70 to 0.92 (rows 18-56) with a heavy dark wooden door #8E5E38 #5E3C24 hinged on the doorway's right side.
- [ID-N08] Standing in the open part of the doorway centered at 0.75, facing LEFT, one hand on the door edge, a calm farewell look.
FRAMES (one way, frame 4 held): the door closes; the open gap on the doorway's left side narrows 16, 12, 8, 4 blocks, hiding more of Biel; frame 4 shows only one eye, a hand on the door edge and the cloak edge. The candle stays lit.
```

- 입력: nref(8칸 = 비엘). ES11이 먼저 합격했으면 ES11 띠도 정체성 입력으로.
- 배치: 주인공 x 34 `잠`(머리는 오른쪽), 자리 12~56(0.09~0.44), 침상 10~58 / 촛대·꽃병 x 60~66 / 문간 90~118 / 비엘 x 96.
- 프레임: 문틈 16 → 12 → 8 → 4블록, **4칸째 유지**. 움직임 줄이기에서도 4칸째만 보인다 — 비엘이 거의 가려져도 문틈의 눈·손으로 인물이 읽혀야 한다.
- 11 S08 연출은 「머리맡의 잔, 촛불이 꺼짐 → 달빛 효과」도 적었다. 15 표에는 잔이 없고 촛불은 켜 둔다(11 상세 기록과 같다). 15 표(아트 사양 소유)를 따른다 — `OPEN_DECISIONS.md` OD-41. 11 S08 연출 줄은 소유 문서 정리 대상이다.
- 팔레트: 벽 `#A596B0` `#CFC3D6` `#7D7B80`, 달빛 `#B9C8FF`, 바닥 `#7D7B80` `#9A948C`, 침상 `#9A948C` `#CFC3D6`, 촛불 `#F0E6CC` `#FFE38A`, 장미 `#7A1F33` `#2E2438` `#4D6A3E`, 문 `#8E5E38` `#5E3C24`, 비엘 색, 외곽선. 변이·정예 묶음을 쓰는 두 장면 중 하나다.
- 장면 금지: 관·무덤·해골 금지. 문을 잠그는 자물쇠·쇠사슬 금지(갇히는 느낌이 아니다).

### ES20 · EB03 부서진 종의 파수꾼 첫 격파

02 §6.3: 종을 지키던 청동 파수 인형은 아직도 깨진 종 곁에 서 있다. 15 §7.3: 머리 대신 금 간 거대한 청동 종을 얹은 돌과 청동의 파수꾼, 퇴장은 「종소리가 멎고 주저앉는다」.

```
SCENE: first defeat of the Warden of the Broken Bell. The deepest gate chamber of the old mine: rough rock walls #6E6862 #7D7B80 with blue crystal veins #5A7FA8 #B9C8FF, a carved stone pillar with notches (no letters) at 0.45, a gravel floor #9A948C below the ground line. A crack in the ceiling at 0.70-0.80 lets a shaft of daylight fall straight down as flat stepped bands #E8EEF2 and #B9C8FF (opaque, no glow). Relief and awe after a long fight.
HERO SLOT (keep empty): 0.11 to 0.36 of the panel width, ground line up to row 6, show only plain rock wall and floor. No person, prop, shadow or bright detail (the player character is added later).
PROPS: a huge cracked bronze bell lying on its side, broken into three big pieces from 0.55 to 1.0 on the ground line, bronze #E0B06A #B07A3A #7A4E24 with dark crack lines, stone rubble #9A948C #6E6862 around it; the light shaft falls on the largest piece.
FRAMES: dust specks #C8C2B8 drift down one block per frame in a repeating pattern; the edges of the light shaft sway by 0, 1, 0, 1 blocks; nothing else moves.
```

- 입력: 보스 EB03 시트(AO-37 등)가 합격해 있으면 종의 모양·색 참고. 없으면 이 장면이 종의 기준이 된다 — 보스 시트 제작 때 넘긴다.
- 배치: 주인공 x 30 `환호`, 자리 14~46(0.11~0.36), 위로 y 6까지 / 기둥 x 58 / 종 조각 70~128 / 빛줄기 90~102.
- 프레임: 먼지 가라앉음(반복 무늬), 빛줄기 가장자리 흔들림.
- 분위기: 긴 싸움 뒤의 안도와 경외. 종의 금빛 새어 나옴(3단계 `#FFE38A`)은 꺼진 상태 — 종소리가 멎었다.
- 팔레트: 벽 `#6E6862` `#7D7B80` `#5A7FA8` `#B9C8FF`, 바닥 `#9A948C`, 빛 `#E8EEF2` `#B9C8FF`, 종 `#E0B06A` `#B07A3A` `#7A4E24`, 잔해 `#9A948C` `#6E6862`, 먼지 `#C8C2B8`, 외곽선(종·잔해).
- 장면 금지: 파수꾼의 몸(돌 팔다리)은 15 표에 없어 그리지 않는다(`OPEN_DECISIONS.md` OD-42). 파편이 날아가는 폭발·불꽃 금지.

---

## 5 장면 육안 합격 기준 (생성할 때마다 본다)

PROMPTS E1~E12 가운데 E1·E4·E7·E9·E11을 장면에 맞게 바꾸고 장면 전용 기준을 더했다. 띠 편집(SC-E)에는 PROMPTS E21(색 유지)도 함께 본다.

| 번호 | 기준 | 대응 |
| --- | --- | --- |
| SE1 | 띠가 같은 크기 4칸, 전체 가로:세로 = 8:1(±2%), 칸 사이 선·틈 없음. 열쇠 칸은 2:1 한 칸 | E1 |
| SE2 | 띠 밖이 `#FF00FF` 한 값. 후광·비네트·그라데이션 없음 | E4 E11 |
| SE3 | FRAMES에 적지 않은 부분(배경·인물 위치·크기·색)이 네 칸에서 같다. 반복 재생에서 떨리는 곳이 없다 | 12.3 체크 8 |
| SE4 | FRAMES에 적은 변화만 있고 크기는 1~2블록. 반복 장면은 처음 자세로 돌아오는 몸짓이라 4→1이 이어진다. `끝 유지`(ES09·ES15·ES19)는 4칸이 최종 상태다 | 15 §9.3 |
| SE5 | 주인공 자리에 사람·동물·소품·그림자·밝은 점이 없다. 주인공처럼 보이는 모험가가 어디에도 없다 | 15 §9.3 |
| SE6 | 지면선이 칸 높이 7/8의 곧은 선이고 모든 인물·소품이 딛는다 | 03 §2.2 |
| SE7 | 칸 맨 위 8줄이 한 색이다(축소 창은 장면을 쓰지 않으므로 y 16 제약은 없다) | 15 §9.3 배율 |
| SE8 | 인물·소품만 `#2B2233` 외곽선. 배경 면에 어두운 테두리가 없고 `#4C4A52`보다 어두운 배경 화소가 없다 | 15 §2.3 |
| SE9 | NPC가 PROMPTS §7 외형표·nref와 같은 인물이다(머리·얼굴·옷·색). 2.2등신, 키는 PROMPTS §7.2 | E9 |
| SE10 | 소품이 §2 기준과 같은 물건으로 읽힌다(호각·지도·편지·샘·은잔·등불·검) | 15 §9.2 |
| SE11 | 글자·숫자·음표·화살표·피·상처·시신이 없다 | E7, 02 §10 |
| SE12 | 1칸 한 장만 보고도 사건이 읽힌다(`끝 유지`는 4칸) | 03 §14 움직임 줄이기 |
| SE13 | 장면별 팔레트 목록 밖 색이 없다(정규화 뒤 art-check M5로 센다) | 15 §2.2 |

- SE1~SE8·SE11·SE12는 생성 직후 육안으로 본다. SE3은 네 칸을 250 ms 반복으로 재생해 본다(§6).
- SE9는 nref와 나란히 놓고 본다. 두 장면 이상에 나오는 인물(하델·도담·토리·비엘·동반자)은 앞서 합격한 장면과도 나란히 놓는다.

---

## 6 검증 방법 — 주인공을 얹어 본다

장면 그림만으로는 합격시키지 않는다. **실제로 주인공이 얹힌 모습**을 사람 눈으로 본다(CLAUDE.md §5 사람 눈 검증).

### 6.1 순서

1. 게임 쪽 정규화(`tools/art-check` `normalize`)로 띠를 `es_{사건 id}_48.png` 512 × 64로 만든다.
2. `preview`로 주인공을 얹는다. 주인공 = 마스터(`02-ref-b-actions18-48-r4.png`)를 정규화한 캐릭터 시트의 해당 동작 1프레임. 중심을 장면 x에, 발바닥을 y 56에 맞춘다. flip 없음.
   - 마스터에 있는 동작: `대기`, `앉기와 식사`, `잠`. 없는 동작(`환호`·`상호작용`·`발견`·`걷기`)은 `대기` 1프레임으로 대신하고, §0.3 표의 가로·세로 여유를 상자로 겹쳐 그려 본다. 해당 동작 시트가 합격하면 다시 돈다.
   - 선택 대기 장면(ES05·ES09·ES10·ES11 = C01-3·F01~F03)은 8초 뒤 기존 선택 대기 표현으로 돌아가므로(15 §9.3) 장면이 보이는 동안의 모습만 본다.
3. 네 칸 모두 다음을 만든다.
   - 520 × 64 기본 창 모형 ×4 확대(100%).
   - 125%·150% 모형: 풍경 영역 높이 72·80, 위쪽 빈 줄을 장면 맨 윗줄 색으로 채운 것.
   - 네 칸 250 ms 반복 재생(또는 네 칸 나란히 + 칸 사이 차이 강조). 움직임 줄이기용 1칸(끝 유지는 4칸) 단독.

### 6.2 판정

| 번호 | 검사 | 통과 조건 |
| --- | --- | --- |
| V-S1 | 겹침 | 주인공 불투명 화소와 NPC·소품 불투명 화소가 지면선 위에서 겹치는 화소 0. 두 상자 사이 가로 간격 4px 이상(ES12는 가장 먼저 본다) |
| V-S2 | 대비 | 주인공 몸통·머리 평균 L\*와 주인공 자리 배경 평균 L\* 차이 25 이상(15 §2.3). 밤 장면 ES01은 주인공 명도 −15%를 적용하지 않는다(장면 고유 조명, 15 §9.3) |
| V-S3 | (없앰) | 축소 창은 장면을 쓰지 않는다(15 §9.3, e878cce). 번호는 비워 둔다 |
| V-S4 | 배율 | 125·150%에서 채운 윗줄과 장면 사이에 경계선이 보이지 않는다 |
| V-S5 | 반복 | 정지 부분이 떨리지 않는다(SE3). 떨림이 있으면 화소 차이 위치를 적는다 |
| V-S6 | 한 칸 | 움직임 줄이기 한 칸만 보고 사건이 읽힌다(SE12) |
| V-S7 | 실제 크기 | 100% 실제 크기로 60cm 거리에서 NPC가 누구인지, 소품이 무엇인지 알아본다(15 §12.3 체크 9) |

- 수치(V-S1·V-S2)만 통과하고 사람 눈(V-S4~V-S7)이 불합격이면 불합격이다.
- 불합격 사유는 폴더 `README.md`에 적고 프롬프트를 고쳐 다시 생성한다(PROMPTS §0.3). 같은 장면의 같은 지적이 두 번 되풀이되면 세 번째 수정 전에 원인을 한 문단으로 적고 구조 대안을 함께 낸다(CLAUDE.md §5).

### 6.3 preview에 필요한 것 (도구 담당에게 넘길 요청)

현재 `preview`는 창 모형에 캐릭터·적을 고정 자리(x 16 / x 72)로 얹는다. 장면 검수에는 다음이 필요하다. 이 문서는 도구를 고치지 않는다.

1. 입력: `es_{id}_48.png`(4칸) + `hero: {x, action, flip}`(15 §9.3 `.frames.json`과 같은 값).
2. 주인공 기준: x = 인물 가로 중심(스프라이트 기준점 `center_x`, 15 §9.3). 셀 왼쪽이 아니다.
3. 출력: 칸마다 기본 창·125/150% 모형, 겹침 화소 수·간격(V-S1), 대비(V-S2), 칸 사이 차이 지도(V-S5). 축소 창 모형은 만들지 않는다.
4. 도구 작업 목록: `OPEN_DECISIONS.md` T3.

---

## 7 제작 순서

### 7.1 현재 상태 (2026-09-24)

- 합격한 장소 배경은 **아직 없다.** 들판 3층(AO-39)은 v03에서 층 정합 불합격이고(PROMPTS §6), 마을·폐광 배경은 시작 전이다. 그래서 「이미 합격한 장소를 다시 쓰는 장면부터」는 지금 적용할 수 없다. 대신 **입력 의존이 적은 장면부터** 한다.
- 합격한 인물은 주인공 마스터뿐이다. NPC 전신 기준 시트 `n01`(PROMPTS §7.4)은 아직 없다. NPC 초상(P2 w43)은 `n01` 뒤에 만들고, 장면은 초상을 기다리지 않는다.

### 7.2 순서

| 차례 | 대상 | 이유 | 선행 |
| --- | --- | --- | --- |
| 0 | `n01` NPC 기준(PROMPTS §7.4) | 다섯 명이 여러 장면에 나온다. 정체성 기준이 먼저 있어야 한다 | 마스터(있음), 외형 승인(`OPEN_DECISIONS.md` OD-02) |
| 1 | **시범** ES15, ES18 | NPC가 없어 정체성 위험 없이 띠 형식·두 단계 제작·주인공 자리·끝 유지·preview 합성을 먼저 검증한다 | 없음 |
| 2 | 시범 ES01 | 한 번만 나오는 NPC(여행자) + 소품(모닥불) + 들판. 반복 장면 형식 검증 | nref |
| — | **O02 판정 대기** | 32가 채택되면 장면 속 인물 키가 26으로 바뀌어 전부 다시 그려야 한다. 시범 3장면 뒤 본 제작은 O02 뒤로 미룬다 | O02 |
| 3 | 들판·여울: ES06, ES07, ES12, ES13 | 들판 배경(AO-39)이 합격하면 장소 참고 입력으로 쓴다 | AO-39 합격이면 더 좋음 |
| 4 | 마을: ES02, ES04, ES08, ES09, ES14, ES16, ES17 | 하델·도담·토리 반복 등장 — 같은 인물끼리 나란히 검수 | 마을 배경 합격이면 더 좋음 |
| 5 | 폐광: ES03, ES05, ES20 | 폐광 배경·보스 시트 뒤가 좋다 | 폐광 배경, EB03 |
| 6 | 틈·달그늘: ES10, ES11, ES19 | 변이 묶음 색, 비엘 두 장면을 이어서 | ES10 장소 결정(OD-11) |

### 7.3 32 규격

- 15 §9.3대로 **O02가 채택한 규격만** 만든다. 48이 채택되면 32 장면은 만들지 않는다.
- 32가 채택되면: 48 장면을 PROMPTS §1 E 방식으로 편집하지 않는다(창 크기 128 × 64가 같으므로 블록 크기가 아니라 **인물 키만** 38 → 26으로 줄어든다). 장면 본문의 `an adult stands about 38 blocks tall … top of the head near row 18`을 `about 26 blocks tall … near row 30`으로, 아이 30 → 21, 세나 34 → 23으로 바꿔 새로 생성하고, 주인공 자리 폭을 x ± 11로 다시 계산한다.

---

## 8 진행표

진행 상태는 PROMPTS §6.4 한 곳에만 적는다(v1.1에서 옮겼다). 합계 목표: 장면 20 × 4칸 = 80프레임(15 §13.1).

---

## 9 확인 필요

`docs/art/OPEN_DECISIONS.md`로 옮겼다(v1.1). 옛 번호는 그 표의 `옛 번호` 열 `P3-n`으로 찾는다. 15 §9.3 보정(e878cce)과 소유 문서 규칙으로 닫은 것: 1 주인공 x(OD-34), 2 축소 창(OD-35), 3 한 방향 움직임·ES09 끝 유지(OD-36), 4 아기(OD-45), 8 NPC 외형 출처(OD-38), 10 ES20 파수꾼 몸(OD-42), 11 ES04 지도(OD-43), 12 아이 키(OD-40), 13 ES19 잔·촛불(OD-41), 14 먼 늑대(OD-44), 15 호각 재질(OD-33). 남은 사용자 결정: 5(OD-18), 6(OD-19), 7(OD-20), 8의 `임시` 외형 승인(OD-02), 9(OD-11), 17(OD-05), 18(OD-01). 16은 도구 작업 T2다.
