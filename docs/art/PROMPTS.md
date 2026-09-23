# PROMPTS — 이미지 생성 전달용 프롬프트 모음

버전 1.1 · 2026년 9월 23일 · 대상: 이미지 생성 모델을 쓰는 제작 AI
1.1: v03 검토 반영(§2.2) — 기준 인물 지정, 편집 규칙 강화(보이는 화소만·배경 단색), 배경은 합성 후 분리, 32 규격은 48 편집, 그림자·책·검 보완, P0 진행표(§6)
제작 방식 규칙은 `ASSET_ORDERS.md` 0.0절(D56)이다. **이 문서의 프롬프트는 그 카드의 프롬프트보다 우선한다.** 카드의 규격·동작 설명은 이 문서가 옮기지 않은 세부를 확인할 때 본다.
출발점은 v02 시안(`assets/_imagegen/v02/`)의 프롬프트다. 외형·일관성이 확인된 문장은 그대로 살렸고, v02에서 나온 문제는 공통 블록에 막는 문장을 넣었다.

---

## 0 쓰는 법

### 0.1 프롬프트 조립

한 번의 생성 요청 = **[A 스타일] + [B 주인공 정체성](캐릭터일 때) + [C 배치] + [에셋 본문] + [D 금지]**를 순서대로 이어 붙인 하나의 글이다.
공통 블록은 줄이지 말고 전문을 붙인다. `{...}` 자리는 에셋 본문이 정한 값으로 바꾼다.

### 0.2 제작 순서 (레이어 부품은 편집으로 떼어 낸다)

캐릭터는 몸체·얼굴·머리카락·옷·무기가 **따로 겹쳐지는 레이어**다(15 §3). 부품을 따로 생성하면 칸마다 위치가 어긋나 겹치지 않는다. 그래서 순서를 이렇게 한다.

0. **기준 인물(마스터)**: `assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`다. 이후 모든 캐릭터 시트(걷기·가죽옷·32 규격·표정)는 이 이미지를 **정체성 참고 입력**으로 함께 넣는다. 입력 없이 새로 생성하면 머리 모양·얼굴 비율이 달라진다(v03 걷기 시트가 그랬다).
1. **기준 합성 시트**를 생성한다. 모든 부품을 입은 완성 캐릭터로 동작 시트를 만든다(§3.1). 외형·동작·배치를 여기서 확정한다.
2. 기준 합성 시트가 합격하면, 그 이미지를 **편집 입력**으로 넣고 "이 부품만 남기고 나머지는 투명"으로 편집해 레이어를 얻는다(§3.2). 같은 이미지에서 떼어 내므로 위치가 맞는다.
3. 떼어 낸 부품은 **입력에서 보이던 화소만** 남긴다. 가려져 있던 부분을 새로 그려 넣거나, 소매를 늘리거나, 모양을 다듬으면 안 된다. 입력에서 피부가 보이던 자리는 옷 레이어에서 비어 있어야 한다(몸체 레이어가 그 자리를 가진다). 그래야 몸체 + 옷 + 머리를 겹쳤을 때 기준 시트와 똑같아진다.
4. 편집이 부품을 떼어 내지 못하면(아래 v02 사례처럼 결과가 입력과 같으면) **코드로 자르지 말고** 멈추고 검토 기록에 적는다. 게임 쪽이 다른 방법을 정한다.

### 0.3 한 장을 낼 때

- 생성 결과를 **그대로** 저장한다. 코드로 자르기·축소·배경 제거·색 변환을 하지 않는다(D56).
- 저장 위치: `assets/_imagegen/{판}/{번호}-{이름}.png` + 같은 이름 `.prompt.txt`(보낸 프롬프트 전문) + 폴더의 `README.md`(포즈 수, 눈으로 본 결과, 남은 차이).
- 결과가 기준과 다르면 **프롬프트를 고쳐 다시 생성**한다. 고친 문장을 `.prompt.txt`에 남긴다.
- 합격 판정은 §4 육안 기준으로 한다. 규격 수치 검사(셀 크기·색 수·알파)는 게임 쪽 정규화 뒤에 한다.

---

## 1 공통 블록

### A 스타일

```
Asset type: Tap RPG small 2D pixel-art game sprite sheet. This is a real sprite art request, not a UI, diagram, poster or pixel-art-themed illustration.
PIXEL LANGUAGE: every figure must look designed on a genuine logical {48x48} pixel canvas and then shown with large, uniform, perfectly square pixel blocks. Crisp hard square pixel clusters and deliberate one-block stair-steps. Strong readable silhouette with very restrained internal detail. Outer contour exactly one pixel-block thick in dark plum #2B2233 (characters, enemies, weapons and props only; backgrounds follow their own rule in §3.5). Flat color fills in large coherent clusters.
Absolutely no blur, anti-aliasing, smooth vector curves, gradients, soft lighting, glow, painterly strokes, noisy dithering, fur or hair texture, glossy or 3D rendering, photographic detail.
```

### B 주인공 정체성 (캐릭터 시트마다 붙인다)

```
SUBJECT AND IDENTITY: one and the same youthful androgynous human adventurer in every cell, chibi proportions about 2.2 heads tall (the head is close to half of the body height). Facing RIGHT in a slight three-quarter side view, never front-facing. Short chestnut hair (HR01) with two flat browns, medium warm skin, round dark eyes, tiny mouth. Cream quilted short tunic with elbow-length sleeves, thin brown waist cord, two or three small square repair patches, muted grey-beige trousers, brown boots. Keep every hair lock, facial feature, garment detail, body proportion and limb thickness identical across all cells. Expressive and charming, not a stiff stick figure.
FAR-SIDE LIMBS: the arm and leg farther from the viewer are always one shade darker than the near-side limbs, so left and right steps are distinguishable.
PALETTE ONLY: outline #2B2233; skin #E3B48E #C88E68 #A0664A; hair #7A4E30 #553420; cloth #F0E6CC #C8C2B8; cord and boots #8E5E38; trousers #C8C2B8 #9A948C.
```

### C 배치

```
LAYOUT: exactly {N} sprites in exactly {COLS} equal columns and {ROWS} equal rows of identical square cells, evenly spaced, reading order left to right then next row. {EMPTY_CELLS}
One pose per cell. Every sprite is entirely inside its own cell with clear empty margins; nothing crosses into a neighbouring cell. Same drawing scale in every cell. Every figure's lowest point (feet, or hips when seated, or body when lying) sits on the SAME local ground line in its cell, about 10% above the cell bottom; no ground line is drawn. The body's horizontal center is at the same local x in every cell unless the pose itself moves it.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the sprites, the exact same value in every pixel (preferred over transparency: transparent outputs came back with halos and dark fringes). Never a brown, dark or coloured backdrop, never a vignette, spotlight, halo, glow ring, gradient or drawn checkerboard.
```

### D 금지

```
Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.
```

### E 32 규격 (O02 비교용)

32 규격은 새로 생성하지 않고 **합격한 48 규격 시트를 편집 입력으로 넣어** 만든다. 같은 인물·같은 포즈·같은 칸 배치를 지키고 화소 밀도만 낮춘다. v03의 32 동작·들쥐 시트는 48과 세부 밀도가 거의 같아 비교가 되지 않았다.

```
Use case: precise edit of the provided 48-pixel sprite sheet. Redraw the SAME sheet at a much coarser pixel density, as if designed on a 32x32 logical canvas per cell: every pixel block is one and a half times larger than in the input, the standing figure is about 26 blocks tall and the head about 12 blocks wide. Simplify: no interior outline lines, eyes one block wide and two blocks tall, no eyebrows, hair as two or three flat masses, clothing folds removed. Keep the same character, the same pose in every cell, the same cell layout, the same flat #FF00FF background.
```

- 들쥐는 `the standing figure is about 26 blocks tall and the head about 12 blocks wide`를 `the rat body is about 10 blocks tall`로 바꾼다.

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
| 머리 동작 `18-…-r3` | 합격 | 97.9~99.1%, 이동 ≤ 2px | — |
| 검 `20-…-r2` | 합격(6프레임) | 94.5~96.8%, 이동 ≤ 2px. 카드 AO-16의 나머지 4프레임(앞으로 든 3 + 칼집 1)이 없다 | §3.3 AO-16 나머지 |
| 천옷 동작 `19-…-r2` | 불합격 | ① 배경이 보라·갈색 그라데이션 + 후광. ② 옷 화소의 8.3%가 기준 시트의 피부 자리(식사 행 12.4%) — 소매를 팔까지 늘렸다 | §3.2 머리말(보이는 화소만·배경 단색) |
| 천옷 걷기 `14` | 불합격 | 옷 화소의 12.4%가 피부 자리. 걷기 시트 자체도 불합격 | 새 REF-A에서 다시 뗀다 |
| 가죽 동작 `21` | 불합격 | 옷 화소의 12.7%가 피부 자리(식사 행 22.1%) | §3.2 머리말 |
| 얼굴 `17-…-r2` | 불합격 | 그라데이션 배경·후광, 눈 모양이 바뀌었다. 또 카드(AO-13)가 요구하는 것은 동작별 얼굴이 아니라 **표정 5종** 시트다 | §3.2 L2 수정, L7 추가 |
| 32 걷기 `01-…-32-r2` | 보류 | 48보다 굵지만 불합격 걷기 인물을 따랐다 | §1 E(48 합격본을 편집) |
| 32 동작·들쥐 | 불합격 | 48과 세부 밀도가 거의 같아 O02 비교가 안 된다 | §1 E |
| 들쥐 48 `08-…-48-r3` | **합격** | 18칸·빈 칸·도토리·마지막 축소가 카드대로, 단색 배경, 붉은 테두리 없어짐 | — |
| 단검 48 `05-…-48-r2` | 합격 | 10칸, 길이·모양 일정, 녹색 손잡이·놋쇠 가드, 칼집 칸 | — |
| 책 `06` | 불합격(크기) | 책이 칸 폭의 3분의 1을 넘는다. 손에 들면 몸통을 가린다 | §3.3 책 크기를 인물 기준으로 |
| 그림자 `07` | 불합격 | 회색 불투명 막대. 생성 모델은 35% 반투명을 만들지 못한다 | §3.3 불투명 `#2B2233`으로 받고 투명도는 게임이 준다 |
| 배경 3층 `09~11` | 불합격(구조) | ① 세 장의 띠 높이·위치가 달라 겹치면 맞지 않는다(먼 층 띠 y 320~704, 가까운 층 지면 y 595). ② 중간 층에 검은 외곽선 — 배경 명도 규칙(L\* 30 미만 금지) 위반. 원인은 이 문서 1.0의 공통 블록 A가 배경에도 외곽선을 요구한 것 | §1 A 외곽선을 캐릭터·소품 전용으로. §3.5를 합성 후 분리로 교체 |

---

## 3 P0 에셋별 프롬프트

P0 범위는 `ASSET_ORDERS.md` §1.2다. 각 항목은 **48 규격 먼저**, 합격하면 §1 E를 적용해 32 규격을 만든다.

### 3.1 기준 합성 시트 (가장 먼저)

#### REF-A · 걷기 12 (AO-03 연구본, v03 재생성)

조립: A + B + C(`N=12, COLS=6, ROWS=2, EMPTY_CELLS=없음`) + 본문 + D. **기준 인물(§0.2의 0번)을 입력 이미지로 함께 넣고** 본문 앞에 다음을 붙인다.

```
Input image role: this is the exact character to draw. Copy its head shape, hair silhouette, eye size, face proportions, clothing and colors exactly. Do not copy its poses or its layout. No strap, no pouch, no bag, nothing on the back.
```

```
ANIMATION, one 660 ms walk cycle, twelve DISTINCT poses at 55 ms each, the whole body walking in place:
1 right foot forward contact, left foot behind, LEFT arm forward.
2 weight settles onto the right knee, upper body one block lower; the planted right foot does not move.
3 left foot lifts and swings under the body, arms start to cross.
4 narrow passing pose, feet close beneath the hips, upper body one block higher.
5 left leg extends forward, right arm comes forward.
6 left heel just above the ground before contact, trailing leg pushes off.
7 LEFT foot forward contact, right foot behind, RIGHT arm forward: the mirror step of pose 1, with the darker far-side leg now in front.
8 weight settles onto the left knee, upper body one block lower.
9 right foot lifts and swings under the body.
10 narrow passing pose, upper body one block higher.
11 right leg extends forward, left arm comes forward.
12 right heel just before contact, approaching pose 1 but NOT a copy of it.
Poses 1 and 7 have the widest stance, 4 and 10 the narrowest. Row 2 must visibly differ from row 1 because the near and far legs have swapped. No weapon, helmet, cape, bag or props.
```

- 게임에 쓰는 걷기 6프레임은 따로 생성하지 않는다. 이 12칸 중 1·2·4·7·8·10번을 게임 쪽이 고른다(AO-03 표).

#### REF-B · 대기·공격·앉기와 식사·잠 (AO-02·04·07·08) — v03 r4 합격, 기준 인물

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

합격한 REF-A·REF-B를 각각 **편집 입력**으로 넣고 옷만 바꾼다(v03 동작 시트는 이 방식으로 인물이 유지됐다).

```
Clothing replacement: instead of the cream tunic, a sleeveless tan leather vest #C08A58 #8E5E38 with two vertical shoulder straps and a 2-block belt, the cream undershirt #F0E6CC visible at the shoulders. Everything else (face, hair, trousers, boots, poses) identical to the reference sheet.
```

### 3.2 레이어 부품 — 기준 합성 시트를 편집해 떼어 낸다

모든 부품 프롬프트는 **편집**이다. 입력 이미지 = 합격한 REF 시트. 공통 머리말:

```
Use case: precise edit of the provided sprite sheet. Keep the exact canvas, the exact cell layout, and the exact position, size and pose of everything that remains. Do not redraw, move or restyle anything that is kept. Keep ONLY the pixels of the kept part that are VISIBLE in the input: never draw hidden portions, never extend sleeves or garments over skin that was visible, never smooth or complete a shape. Everything removed becomes the same single flat #FF00FF magenta as the input background, one exact value everywhere: no gradient, no shading, no vignette, no glow, no halo, no dark fringe. No new content.
```

| 번호 | 카드 | 입력 | 머리말 뒤에 붙일 문장 |
| --- | --- | --- | --- |
| L1 | AO-02·03·04·07·08 몸체 | REF-A, REF-B | `Remove the hair, the face (eyes, eyebrows, mouth), the tunic, the belt, the sword and the bread. Where clothing is removed, show the bare base body: skin #E3B48E #C88E68 #A0664A with a plain cream sleeveless undershirt #F0E6CC #C8C2B8 and the same trousers and boots. The head stays as a smooth bald skin-coloured head of the same size and outline.` |
| L2 | AO-13 얼굴 | L7 결과 | `Keep ONLY the eyes, eyebrows and mouth of each figure, pixel for pixel as they are. Do not redraw or enlarge them. Remove everything else, including skin, hair and outline.` |
| L3 | AO-14 머리카락 HR01 | REF-A, REF-B | `Keep ONLY the hair. Remove face, skin, body, clothing, weapon and all other parts.` |
| L4 | AO-20 천옷 | REF-A, REF-B | `Keep ONLY the cream quilted tunic and its brown waist cord with the repair patches. Remove the body, skin, head, hair, trousers, boots, sword and bread.` |
| L5 | AO-21 가죽옷 | REF-C | `Keep ONLY the leather vest, its straps and belt. Remove everything else.` |
| L6 | AO-16 무기 V1 한손검 | REF-B 2행 | `Keep ONLY the sword in each cell (blade, guard, grip). Remove the character entirely, including the hand holding it.` — v03 합격 |
| L7 | AO-13 표정 5종 | REF-B 1행 1칸 | 표정 시트를 먼저 만든다: `Keep this exact character, pose and size. Make a 5-cell row of the same frame, identical except the facial expression: neutral, smile, grimace (focused frown), eyes closed, surprise. Only the eyes, eyebrows and mouth change.` 그다음 결과에 L2를 적용해 얼굴만 뗀다 |

- 걷기 부품(v03 `12`~`15`)은 불합격 걷기 시트에서 뗐으므로, 새 REF-A가 합격하면 다시 뗀다.
- 잠·앉기 행에서 머리카락·옷을 뗄 때도 같은 문장을 쓴다. 칸이 비어 버리면(부품이 없는 포즈) 그 칸은 빈 채로 둔다.
- 편집 결과를 입력과 겹쳐 봤을 때 남긴 부품의 위치가 1블록이라도 움직였으면 불합격이다.

### 3.3 새로 생성하는 부품

#### AO-17 · 무기 V2 단검

조립: A + C(`N=10, COLS=6, ROWS=2, EMPTY_CELLS=Row 2 holds four sprites; its last two cells stay empty.`) + 본문 + D

```
Weapon-only sprites, no hand and no body. A short dagger, clearly shorter than a one-handed sword: total length about one fifth of a 48-block cell, straight silver blade #E8E6E0 #B4B2B0, small brass guard #B07A3A, grip wrapped with green cloth #6D8F5A. Identical length and shape in every cell. Row 1, six angles following a slash: at the hip pointing down-right, straight up overhead, up-right ahead, horizontal pointing right, pointing down-right, back at the hip. Row 2: three frames held forward horizontally with a one-block bob, then one frame sheathed in a small brown leather sheath #8E5E38.
```

#### AO-49 · 책 소품 2프레임 (P0 분)

조립: A + C(`N=2, COLS=2, ROWS=1, EMPTY_CELLS=없음`) + 본문 + D

```
Prop-only sprites, no hand and no body. A SMALL open book as held by a chibi character at chest height. Its width is about one fifth of the character's standing height (about 8 blocks of a 48-block cell) so it fits in two small hands without hiding the torso. Most of each cell stays empty: brown cover #8E5E38, cream pages #F0E6CC, outline #2B2233, three colors only. Cell 1: book open flat. Cell 2: the same book with one page lifted mid-turn. No letters, lines of text or symbols on the pages.
```

#### AO-01 · 발밑 그림자

생성 모델은 35% 반투명을 만들지 못한다(v03은 회색 불투명). **불투명한 한 색 타원으로 받고, 투명도 35%는 게임이 그릴 때 준다.**
조립: A + 본문 + C의 BACKGROUND 문장

```
One single flat horizontal ellipse, about 40% of the cell width and one twelfth of the cell height, centred horizontally near the bottom of a square cell. One fully opaque color only: dark plum #2B2233. Hard stepped pixel edges, no gradient, no blur, no grey, nothing else in the image.
```

#### AO-16 · 무기 V1 한손검 나머지 4프레임

입력 = v03 `20-sword-actions18-48-r2.png`(합격 검 6프레임). 같은 검을 그대로 쓴다.

```
Use case: edit of the provided sheet. Using exactly this sword (same length, blade, cross guard and grip, same pixel size), add four cells in the empty row below the existing swords: three frames of the sword held forward horizontally pointing right with a one-block up-and-down bob, then one frame of the sword sheathed in a plain brown leather scabbard #8E5E38, horizontal. Do not change the existing six swords. Same flat #FF00FF background.
```

### 3.4 적

#### AO-31 · 여울 들쥐 EN01 (v02 유지 + 가장자리 수정)

v02 `02-rat18.prompt.txt` 본문을 그대로 쓰고, 앞에 A(`{32x24}`), 뒤에 C의 BACKGROUND 문장과 D를 붙인다. 추가 문장:

```
Every outline pixel is fully opaque dark plum #2B2233; there is no reddish or semi-transparent fringe around any silhouette.
```

32 규격은 새로 생성하지 않고 합격한 48 시트를 §1 E로 편집한다(v03 32는 밀도가 48과 같아 불합격).

### 3.5 배경

#### AO-39 · 들판 3층 — 합성 후 분리 (v03 방식 교체)

세 층을 따로 생성하면 띠 높이·위치가 달라 겹쳐지지 않는다(v03). 캐릭터와 같은 방식으로 **한 장의 합성 장면을 먼저 만들고 편집으로 층을 뗀다.**

① 합성 장면 — 조립: A + 본문 + D (C 없음)

```
A single wide horizontal pixel-art strip with an exact 4:1 aspect ratio, filling the full canvas width and placed in the vertical middle of the canvas; the area above and below the strip is one flat #FF00FF color. Soft, low-contrast daytime meadow for a calm idle game, seamlessly tileable left to right.
Inside the strip, from back to front: pale sky #B9C8FF with two or three flat clouds #E8EEF2; low rolling hills #8FC06A #5E9A4A with the horizon at about one third of the strip height; in the left half two small round trees (trunk #8E5E38, crown #6D8F5A #4D6A3E), a short wooden fence #C08A58 #8E5E38 and one grey boulder #9A948C, all standing on the ground; a flat walkable grass surface #6D8F5A #4D6A3E whose top edge is one perfectly straight horizontal line at 7/8 of the strip height, a thin soil band #8E5E38 #C08A58 below it, and a few tiny cream and yellow flowers #F0E6CC #FFE38A. The left quarter is plain because the character stands there. The right half has no objects.
BACKGROUND OUTLINES: no dark outlines at all. Edges of each shape use a slightly darker shade of the same hue; nothing darker than #4D6A3E. No light sources, no sun disc, no characters, no animals.
```

② 층 떼어 내기 — 입력 = 합격한 ①. §3.2 편집 머리말 뒤에 붙인다.

| 층 | 머리말 뒤 문장 |
| --- | --- |
| 먼 층 | `Keep ONLY the sky, clouds and hills. Remove the trees, fence, boulder, grass surface, soil and flowers, and continue the sky and hills naturally where they were hidden (this layer alone is fully opaque inside the strip).` |
| 중간 층 | `Keep ONLY the two trees, the fence and the boulder. Everything else inside and outside the strip becomes flat #FF00FF.` |
| 가까운 층 | `Keep ONLY the grass surface, the soil band and the flowers. Everything else inside and outside the strip becomes flat #FF00FF.` |

- 먼 층만 가려진 부분을 이어 그린다(배경에 빈 곳이 있으면 안 되므로). §0.2 3번 「보이는 화소만」의 유일한 예외다.

---

## 4 육안 합격 기준 (생성할 때마다 본다)

| 번호 | 기준 |
| --- | --- |
| E1 | 요구한 열·행·칸 수와 빈 칸 위치가 정확하다 |
| E2 | 모든 칸이 같은 인물·같은 크기·같은 옷이다(부품 시트는 같은 부품) |
| E3 | 발(또는 엉덩이·누운 몸)의 아래 끝이 모든 칸에서 같은 높이다 |
| E4 | 배경이 투명하거나 `#FF00FF` 한 색이다. 후광·비네트·그라데이션이 없다 |
| E5 | 프레임마다 포즈가 다르다(같은 포즈를 지정한 칸만 같다). 걷기 1행과 2행은 앞뒤 다리가 다르다 |
| E6 | 칸 밖으로 넘치거나 옆 칸에 닿는 부분이 없다 |
| E7 | 글자·숫자·테두리·그림자·피가 없다 |
| E8 | 편집으로 뗀 부품은 입력 이미지와 겹쳤을 때 위치가 그대로다 |
| E9 | 모든 캐릭터 시트가 기준 인물(§0.2의 0번)과 같은 인물이다: 머리 부피·눈 크기·얼굴 비율·옷 |
| E10 | 뗀 부품에는 입력에서 보이던 화소만 있다. 소매가 팔로 늘거나 가려진 부분이 새로 그려지지 않았다 |
| E11 | 배경 전체가 같은 자홍색 한 값이다. 그라데이션·후광·어두운 테두리가 없다 |
| E12 | 32 규격은 48과 나란히 놓았을 때 블록이 눈에 띄게 크고 세부가 적다 |

---

## 5 P1 이후

P0 판정(O02, `ASSET_ORDERS.md` §1.1) 뒤에 같은 틀(공통 블록 + 기준 합성 → 편집 분리)로 카드별 프롬프트를 이 문서에 더한다. 그전까지 P1 카드는 카드 안의 프롬프트를 A~D 블록과 함께 쓴다.

---

## 6 P0 진행표 (2026-09-23, v03 기준)

✅ 합격 · 🔶 일부 · ❌ 다시 · ⬜ 아직

| 항목 | 카드 | 48 | 32 | 다음 할 일 |
| --- | --- | --- | --- | --- |
| 기준 인물 동작 | AO-02·04·07·08 | ✅ v03 r4 | ⬜ | §1 E로 32 편집 |
| 걷기 12 | AO-03 | ❌ 인물 불일치 | ⬜ | REF-A를 기준 인물 입력으로 재생성 |
| 가죽옷 합성 | AO-21 | 🔶 동작 ✅ / 걷기는 새 REF-A 뒤 | ⬜ | 새 REF-A 편집 |
| 몸체 레이어 | AO-02~08 | 🔶 동작 ✅ / 걷기 재추출 | ⬜ | — |
| 머리카락 HR01 | AO-14 | 🔶 동작 ✅ / 걷기 재추출 | ⬜ | — |
| 얼굴 | AO-13 | ❌ | ⬜ | L7 → L2 |
| 천옷 레이어 | AO-20 | ❌ 소매 늘림·배경 | ⬜ | 새 머리말로 재추출 |
| 가죽옷 레이어 | AO-21 | ❌ 소매 늘림 | ⬜ | 새 머리말로 재추출 |
| 한손검 | AO-16 | 🔶 6/10 | ⬜ | 나머지 4프레임 |
| 단검 | AO-17 | ✅ | 🔶 v03 있음(E12 확인) | — |
| 책 | AO-49 | ❌ 크기 | ⬜ | 재생성 |
| 그림자 | AO-01 | ❌ 반투명 | ⬜ | 불투명 한 색으로 재생성 |
| 들쥐 | AO-31 | ✅ | ❌ 밀도 | §1 E로 32 편집 |
| 들판 3층 | AO-39 | ❌ 층 정합 | — | 합성 후 분리 |
