# PROMPTS — 이미지 생성 전달용 프롬프트 모음

버전 1.3 · 2026년 9월 24일 · 대상: 이미지 생성 모델을 쓰는 제작 AI
1.3: `OPEN_DECISIONS.md` 사용자 결정(2026-09-24) 반영 — 규격은 48만(D64, 32 편집 E·32 칸 폐기), 무기는 셀 밖 허용(D65, S-W 문장·E6 고침), 정규화의 화소 옮기기·자르기(D66), NPC `임시` 외형 승인(§7), 전체 순서(§5.3)·진행표(§6) 갱신.
1.2: 네 문서(이 문서·`prompts/P1_character.md`·`P2_world.md`·`P3_scenes.md`) 정합 — §5 색인과 전체 제작 순서, §6 단일 진행표, §7 NPC 외형 단일 출처 신설. 배경 금지 블록 D-BG와 교체 편집 머리말 S·S-W를 §1로 모음. 편집이 색을 바꾸지 않게(§3.2, E21). 단검은 손에 든 합성에서 떼기(§3.3). 정규화·미리보기 도구 결과(§2.3). 확인 필요는 `OPEN_DECISIONS.md` 한 곳에 모은다.
1.1: v03 검토 반영(§2.2) — 기준 인물 지정, 편집 규칙 강화(보이는 화소만·배경 단색), 배경은 합성 후 분리, 32 규격은 48 편집, 그림자·책·검 보완, P0 진행표(§6)
제작 방식 규칙은 `ASSET_ORDERS.md` 0.0절(D56)이다. **이 문서와 `prompts/` 세 문서의 프롬프트는 카드의 프롬프트보다 우선한다.** 카드의 규격·동작 설명은 프롬프트 문서가 옮기지 않은 세부를 확인할 때 본다. 규칙·수치는 `docs/design/15_아트_스프라이트_사양.md`(이하 15)가, 인물·세계는 02가, 사건 원문은 11이 소유한다(00 §2.4). 프롬프트 문서와 소유 문서가 다르면 소유 문서가 맞다.
출발점은 v02 시안(`assets/_imagegen/v02/`)의 프롬프트다. 외형·일관성이 확인된 문장은 그대로 살렸고, v02에서 나온 문제는 공통 블록에 막는 문장을 넣었다.

---

## 0 쓰는 법

### 0.1 프롬프트 조립

한 번의 생성 요청 = **[A 스타일] + [B 주인공 정체성](캐릭터일 때) + [C 배치] + [에셋 본문] + [D 금지]**를 순서대로 이어 붙인 하나의 글이다.
공통 블록은 줄이지 말고 전문을 붙인다. `{...}` 자리는 에셋 본문이 정한 값으로 바꾼다.
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
- 합격 판정은 §4 육안 기준으로 한다. 규격 수치 검사(셀 크기·색 수·알파)는 게임 쪽 정규화 뒤에 한다.

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
SUBJECT AND IDENTITY: one and the same youthful androgynous human adventurer in every cell, chibi proportions about 2.2 heads tall (the head is close to half of the body height). Facing RIGHT in a slight three-quarter side view, never front-facing. Short chestnut hair (HR01) with two flat browns, medium warm skin, round dark eyes, tiny mouth. Cream quilted short tunic with elbow-length sleeves, thin brown waist cord, two or three small square repair patches, muted grey-beige trousers, brown boots. Keep every hair lock, facial feature, garment detail, body proportion and limb thickness identical across all cells. Expressive and charming, not a stiff stick figure.
FAR-SIDE LIMBS: the arm and leg farther from the viewer are always one shade darker than the near-side limbs, so left and right steps are distinguishable.
PALETTE ONLY: outline #2B2233; skin #E3B48E #C88E68 #A0664A; hair #7A4E30 #553420; cloth #F0E6CC #C8C2B8; cord and boots #8E5E38; trousers #C8C2B8 #9A948C.
```

- NPC의 정체성 문장은 §7.3이다.

### C 배치

```
LAYOUT: exactly {N} sprites in exactly {COLS} equal columns and {ROWS} equal rows of identical square cells, evenly spaced, reading order left to right then next row. {EMPTY_CELLS}
One pose per cell. Every sprite is entirely inside its own cell with clear empty margins; nothing crosses into a neighbouring cell. Same drawing scale in every cell. Every figure's lowest point (feet, or hips when seated, or body when lying) sits on the SAME local ground line in its cell, about 10% above the cell bottom; no ground line is drawn. The body's horizontal center is at the same local x in every cell unless the pose itself moves it.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the sprites, the exact same value in every pixel (preferred over transparency: transparent outputs came back with halos and dark fringes). Never a brown, dark or coloured backdrop, never a vignette, spotlight, halo, glow ring, gradient or drawn checkerboard.
```

- 정사각이 아닌 적 칸·효과·소품·아이콘·초상·배경 띠는 P2 §1.2의 C 변형을 쓴다.

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

---

## 3 P0 에셋별 프롬프트

P0 범위는 `ASSET_ORDERS.md` §1.2다. **48 규격만 만든다**(O02 = 48, D64). §1 E(32 편집)는 쓰지 않는다.

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

합격한 REF-A·REF-B를 각각 **편집 입력**으로 넣고 옷만 바꾼다(v03 동작 시트는 이 방식으로 인물이 유지됐다). 조립: S + 본문 + D.

```
Clothing replacement: instead of the cream tunic, a sleeveless tan leather vest #C08A58 #8E5E38 with two vertical shoulder straps and a 2-block belt, the cream undershirt #F0E6CC visible at the shoulders. Everything else (face, hair, trousers, boots, poses) identical to the reference sheet.
```

### 3.2 레이어 부품 — 기준 합성 시트를 편집해 떼어 낸다

모든 부품 프롬프트는 **편집**이다. 입력 이미지 = 합격한 REF 시트. 공통 머리말(이하 **X**, 네 문서가 같은 이름으로 부른다):

```
Use case: precise edit of the provided sprite sheet. Keep the exact canvas, the exact cell layout, and the exact position, size and pose of everything that remains. Do not redraw, move or restyle anything that is kept. Keep every kept pixel's exact colour: never recolour, relight, brighten, darken or saturate anything. Keep ONLY the pixels of the kept part that are VISIBLE in the input: never draw hidden portions, never extend sleeves or garments over skin that was visible, never smooth or complete a shape. Everything removed becomes the same single flat #FF00FF magenta as the input background, one exact value everywhere: no gradient, no shading, no vignette, no glow, no halo, no dark fringe. No new content.
```

| 번호 | 카드 | 입력 | 머리말 뒤에 붙일 문장 |
| --- | --- | --- | --- |
| L1 | AO-02·03·04·07·08 몸체 | REF-A, REF-B | `Remove the hair, the face (eyes, eyebrows, mouth), the tunic, the belt, the sword and the bread. Where clothing is removed, show the bare base body: skin #E3B48E #C88E68 #A0664A with a plain cream sleeveless undershirt #F0E6CC #C8C2B8 and the same trousers and boots. The head stays as a smooth bald skin-coloured head of the same size and outline.` |
| L2 | AO-13 얼굴 | L7 결과(+ 볼 홍조 표지, P1 §3.3) | `Keep ONLY the eyes, eyebrows and mouth of each figure, and the single #B04A42 cheek block, pixel for pixel as they are. Do not redraw or enlarge them. Remove everything else, including skin, hair and outline.` |
| L3 | AO-14 머리카락 HR01 | REF-A, REF-B | `Keep ONLY the hair. Remove face, skin, body, clothing, weapon and all other parts.` |
| L4 | AO-20 천옷 | REF-A, REF-B | `Keep ONLY the cream quilted tunic and its brown waist cord with the repair patches. Remove the body, skin, head, hair, trousers, boots, sword and bread.` |
| L5 | AO-21 가죽옷 | REF-C | `Keep ONLY the leather vest, its straps and belt, and the cream undershirt visible at the shoulders. Remove everything else.` |
| L6 | AO-16·17 무기 | REF-B 2행(V1), §3.3 교체 결과(V2) | `Keep ONLY the {sword / dagger} in each cell (blade, guard, grip). Remove the character entirely, including the hand holding it.` — V1 v03 위치 합격 |
| L7 | AO-13 표정 5종 | REF-B 1행 1칸 | 표정 시트를 먼저 만든다: `Keep this exact character, pose and size. Make a 5-cell row of the same frame, identical except the facial expression: neutral, smile, grimace (focused frown), eyes closed, surprise. Only the eyes, eyebrows and mouth change.` 그다음 결과에 L2를 적용해 얼굴만 뗀다 |

- 걷기 부품(v03 `12`~`15`)은 불합격 걷기 시트에서 뗐으므로, 새 REF-A가 합격하면 다시 뗀다.
- 잠·앉기 행에서 머리카락·옷을 뗄 때도 같은 문장을 쓴다. 칸이 비어 버리면(부품이 없는 포즈) 그 칸은 빈 채로 둔다.
- 편집 결과를 입력과 겹쳐 봤을 때 남긴 부품의 위치가 1블록이라도 움직였으면 불합격이다(E8). **색이 달라졌어도 불합격이다**(E21, §2.3 머리카락).
- L5의 어깨 크림 속옷: 15 §6.4 A02 「밝은 가죽 + 크림 속옷」이 가죽 팔레트에 속옷을 넣고, 몸체 속옷은 민소매(L1)이므로 어깨의 크림 화소는 가죽 레이어가 가진다(P1 확인 필요 9 해결, `OPEN_DECISIONS.md`).

### 3.3 새로 만드는 부품

#### AO-17 · 무기 V2 단검 — 손에 든 합성에서 떼기 (v1.2 교체)

v03 단독 생성본(`05-dagger10-48-r2`)은 정규화에서 불합격이다(§2.3: 밀도가 사양의 약 3배). **단독 생성하지 않는다.** 기준 인물의 공격 행에서 칼만 단검으로 바꾸고 떼어 낸다. 한손검이 통과한 방식과 같다.

① 교체 — 입력 = 기준 인물(REF-B, v03 r4). 조립: S + S-W + 본문 + D. 칼이 있는 2행(공격 6)만 바뀐다.

```
a DAGGER clearly shorter than the input sword, about 0.6 times its length: a straight silver blade #E8E6E0 #B4B2B0, a small brass guard #B07A3A and a grip wrapped with green cloth #6D8F5A. The blade points in the same direction as the input sword in each cell; only the length, guard and grip change.
```

② 떼기 — 입력 = 합격한 ①. X + L6 문장(`dagger`).

- 피격 3칸은 P1 c14(REF-D에 같은 교체), 착용 1칸은 P1 c17(REF-Q)에서 만든다. 15 §6.3·§12.2의 무기 시트 = 공격 6 + 피격 3 + 착용 1이다.
- 합격: E1 E4 E8 E10 E11 E13 E21 + P1 E14. 단검 길이가 한손검의 약 0.6(15 §6.3: 10 / 16)이고, 정규화 뒤 16px 실크기에서 단검으로 읽힌다.

#### AO-49 · 책 소품 2프레임 (P0 분)

조립: A + C(`N=2, COLS=2, ROWS=1, EMPTY_CELLS=없음`) + 본문 + D

```
Prop-only sprites, no hand and no body. A SMALL open book as held by a chibi character at chest height. Its width is about one fifth of the character's standing height (about 8 blocks of a 48-block cell) so it fits in two small hands without hiding the torso. Most of each cell stays empty: brown cover #8E5E38, cream pages #F0E6CC, outline #2B2233, three colors only. Cell 1: book open flat. Cell 2: the same book with one page lifted mid-turn. No letters, lines of text or symbols on the pages.
```

- 책도 손 소품이라 §2.3 단검과 같은 밀도 문제가 날 수 있다. 정규화 뒤 8블록 폭에서 뭉개지면 REF-B 3행(앉기)에서 빵을 책으로 바꾸는 교체 → 떼기로 바꾼다.

#### AO-01 · 발밑 그림자

생성 모델은 35% 반투명을 만들지 못한다(v03은 회색 불투명). **불투명한 한 색 타원으로 받고, 투명도 35%는 게임이 그릴 때 준다.**
조립: A + 본문 + C의 BACKGROUND 문장

```
One single flat horizontal ellipse, about 40% of the cell width and one twelfth of the cell height, centred horizontally near the bottom of a square cell. One fully opaque color only: dark plum #2B2233. Hard stepped pixel edges, no gradient, no blur, no grey, nothing else in the image.
```

#### AO-16 · 무기 V1 한손검 나머지 4프레임 (v1.2 교체)

공격 6칸은 v03 합격본(`20-sword-actions18-48-r2`, REF-B에서 뗌)이다. 나머지 4칸은 단독 편집으로 만들지 않고 **합성에서 뗀다**(§2.3 단검과 같은 이유).

- 피격 3 = P1 c13(REF-D 피격 행에서 X + L6). 카드의 「앞으로 든 3」은 15 §6.3의 「피격 3」이다.
- 착용 1 = P1 c17(REF-Q, 허리 뒤 칼집). 15 §3.1은 「허리나 등에 찬 모습 1프레임」이다.
- 공격 2·3·4칸의 칼끝이 48 셀을 넘는다(§2.3). 무기 레이어만 셀 밖으로 나갈 수 있으므로(OD-03 결정, D65) 정규화가 잘라 내지 않고 무기 셀 80 × 64에 담는다.

### 3.4 적

#### AO-31 · 여울 들쥐 EN01 (v02 유지 + 가장자리 수정)

v02 `02-rat18.prompt.txt` 본문을 그대로 쓰고, 앞에 A(`{32x24}`), 뒤에 C의 BACKGROUND 문장과 D를 붙인다. 추가 문장:

```
Every outline pixel is fully opaque dark plum #2B2233; there is no reddish or semi-transparent fringe around any silhouette.
```

32 규격은 만들지 않는다(D64).

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

- 번호는 네 문서에서 겹치지 않는다: E1~E12·E21(이 문서), E13~E20(P1 §14), W1~W14(P2 §13.2), SE1~SE13·V-S1~V-S7(P3 §5·§6). 새 공통 기준은 E22부터 붙인다.

---

## 5 문서 색인 (v1.2)

### 5.1 무엇이 어디에 있나

| 문서 | 다루는 것 | 카드 | 파일 접두사 | 합격 기준 | 여기서 정의하는 블록 |
| --- | --- | --- | --- | --- | --- |
| `PROMPTS.md`(이 문서) | 제작 방법(§0), 공통 블록(§1), P0(§3), NPC 외형 단일 출처와 NPC 전신 기준 시트(§7), **전체 진행표(§6)** | AO-01~04·07·08·13·14·16·17·20·21·31·39·49의 P0 분 | P0는 번호만 `{2자리}-{이름}`(v02·v03 관례), NPC 기준 `n{번호}` | E1~E12, E21 | A B C D D-BG E S S-W X L1~L7, `[ID-…]` |
| `prompts/P1_character.md` | 캐릭터의 나머지: 동작 5종(REF-D·E), 머리 자세(REF-H), 머리 6종, 방어구 3계열, 투구, 무기 V1·V2 나머지·V3~V6, 망토, 전문화, 장신구, 나이, 흡혈귀 확인 | AO-05~10, 13·14·15, 16·17 나머지, 18, 20~23, 25~29 | `c{번호}` | E13~E20 | F G |
| `prompts/P2_world.md` | 적·보스·배경·장소 소품·날씨·효과·소품·UI 아이콘·아이템 아이콘·책 UI·초상 | AO-31~62의 P0 밖 | `w{번호}` | W1~W14 | A-UI A-POR C-E C-FX C-PROP C-ICON C-POR C-BG C-FREE D-FX D-UI D-MARK SW E-POR R-EN I-WOLF I-BAT I-KOBOLD I-BOSS I-HERO-POR |
| `prompts/P3_scenes.md` | 이벤트 장면 ES01~ES20(15 §9.3, D63) | (카드 없음) | `es{번호}-{이름}-48[-k]` | SE1~SE13, V-S1~V-S7 | SC-A SC-K SC-E SC-C SC-D, HERO SLOT |
| `OPEN_DECISIONS.md` | 네 문서의 「확인 필요」 통합표와 결정 결과(2026-09-24 사용자 결정 반영), 소유 문서·카드 변경 기록, 도구 작업 | — | — | — | — |

- 블록은 표의 마지막 열 문서에서만 정의하고, 다른 문서는 이름으로만 부른다. 블록 문장을 고칠 때는 정의한 곳만 고친다.
- 편집 머리말은 세 가지다: X(떼기, §3.2), S(캐릭터 교체, §1), SW(세계 에셋 교체·상태, P2 §1.4). 장면 띠 편집은 SC-E(P3 §3). 넷 모두 색 유지 문장을 가진다(E21).
- 15 수량 대조: 캐릭터 388 = P0 + P1(P1 §17), 세계 = P2 §16, 장면 80 = P3.

### 5.2 파일 이름

`assets/_imagegen/{판}/{접두사}{번호}-{이름}-{규격}.png` + 같은 이름 `.prompt.txt`. 떼어 낸 결과는 폴더 `README.md`에 **어느 합성에서 뗐는지** 적는다. 번호는 각 문서 제작 순서표의 번호다(P1 §15 `c`, P2 §14 `w`, P3 §7 `es`, 이 문서 §7.4 `n`). 게임 규격 파일 이름(15 §12.1)은 정규화가 붙인다(`docs/art/imagegen.map.json`).

### 5.3 전체 제작 순서

「선행」이 합격해야 시작한다. 한 줄 안의 순서는 각 문서의 순서표를 따른다.

| 단계 | 무엇 (문서·번호) | 선행 | 막는 결정 (`OPEN_DECISIONS.md`) |
| --- | --- | --- | --- |
| 0 P0 마무리 | §3: REF-A 재생성 → 걷기 부품 다시 떼기, 천옷·가죽·머리카락 다시 떼기(색 유지), L7 표정(+ 볼 홍조 표지, P1 §3.3), V2 단검(REF-B 교체), 책, 그림자, 들판 합성 → 3층, 검 다시 정규화(무기 셀 80 × 64, 도구 T5) | 마스터(있음) | — |
| 1 O02 | **결정: 48 × 48(D64, 2026-09-24).** 참가자 비교 테스트는 플레이 검증(17 §6 S1)으로 미뤘다. 32 쌍은 만들지 않는다 | — | — |
| 2 NPC·배경·UI·초상 | ① `n01` NPC 전신 기준 시트(§7.4) → P3 시범 ES15·ES18(인물 없음)·ES01. ② P2 배경 w10~w16(들판 합격 뒤), UI 아이콘 w25~w28, 책 UI w33. ③ P2 초상 w39~w42 → NPC 초상 w43·w44(`n01` 뒤) → w45 | 마스터, 들판 합성 | — |
| 2′ 효과·소품 | P2 효과 w17~w20, 소품 w22~w24 | — | — |
| 3 캐릭터 | P1 c01~c23, c25. 걷기 행이 든 c08·c09·c15·c16·c21과 P2 w21 전리품 자루는 **새 REF-A 합격 뒤** | REF-A(걷기 행만) | — |
| 4 적·보스 | P2 w01~w09, w34~w38 | 들쥐 합격본 | OD-12의 EB01 색값만(w08a 색, 소품 떼기는 진행) |
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

### 6.1 P0 (2026-09-24, v03 + 도구 결과 + 사용자 결정 기준)

32 열은 없앴다(O02 = 48, D64).

| 항목 | 카드 | 48 | 다음 할 일 |
| --- | --- | --- | --- |
| 기준 인물 동작 | AO-02·04·07·08 | ✅ v03 r4 | — |
| 걷기 12 | AO-03 | ❌ 인물 불일치 | REF-A를 기준 인물 입력으로 재생성 |
| 가죽옷 합성 | AO-21 | 🔶 동작 ✅ / 걷기는 새 REF-A 뒤 | 새 REF-A 편집 |
| 몸체 레이어 | AO-02~08 | 🔶 동작 ✅ / 걷기 재추출 | — |
| 머리카락 HR01 | AO-14 | ❌ 동작: 위치 ✅·색 ❌(§2.3) / 걷기 재추출 | 색 유지 머리말로 다시 떼기 |
| 얼굴 | AO-13 | ❌ | L7 → 볼 홍조 표지(P1 §3.3) → L2 |
| 천옷 레이어 | AO-20 | ❌ 소매 늘림·배경 | 새 머리말로 재추출 |
| 가죽옷 레이어 | AO-21 | ❌ 소매 늘림 | 새 머리말(L5 어깨 속옷 포함)로 재추출 |
| 한손검 | AO-16 | 🔶 공격 6 ✅(셀 넘침 허용, OD-03 결정) / 피격·착용은 P1 c13·c17 | 무기 셀 80 × 64로 다시 정규화(도구 T5) |
| 단검 | AO-17 | ❌ 밀도(§2.3) | REF-B 교체 → 떼기(§3.3) |
| 책 | AO-49 | ❌ 크기 | 재생성 |
| 그림자 | AO-01 | ❌ 반투명 | 불투명 한 색으로 재생성 |
| 들쥐 | AO-31 | ✅ | — |
| 들판 3층 | AO-39 | ❌ 층 정합 | 합성(D-BG) 후 분리. 가로 이음이 두 번 어긋나면 5:1 재생성 + 정규화 구간 자르기(D66) |

### 6.2 P1 캐릭터 (P1 번호 `c`)

| 항목 | 카드 | 합성 | 레이어 | 다음 할 일 |
| --- | --- | --- | --- | --- |
| 피격·발견·상호작용 | AO-05·06·09 | ⬜ | ⬜ | c01 |
| 환호·쓰러짐 | AO-10 | ⬜ | ⬜ | c02 |
| 머리 자세 3 | AO-14·15·23 | ⬜ | — | c04 |
| 머리카락 HR01 6칸 | AO-14 | — | ⬜ | c05 |
| 머리카락 HR02~06 | AO-15 | ⬜ | ⬜ | c06 |
| 얼굴 가는 눈 5 | AO-13 | ⬜ | ⬜ | c07 (P0 L7 합격 뒤) |
| 천옷 나머지 28 | AO-20 | ✅(기본 복장) | ⬜ | c03, c10 |
| 가죽 44 | AO-21 | 🔶 A·B(P0) | ⬜ | c08 |
| 금속 44 | AO-22 | ⬜ | ⬜ | c09 |
| 선택 부품 겹침 3(목도리·짝짝이 어깨받이·연결 고리) | AO-20~22 | ⬜ | ⬜ | c11(규약 OD-04 결정, D67) |
| 투구 15 | AO-23 | ⬜ | ⬜ | c12 |
| V1 피격 3·착용 1·표지 | AO-16 | ⬜ | ⬜ | c13, c17(무기 셀 80 × 64) |
| V2 피격 3·착용 1 | AO-17 | ⬜ | ⬜ | c14, c17 |
| V3~V6 40 | AO-18 | ⬜ | ⬜ | c14, c17(한 손, D68) |
| 망토 44 | AO-25 | ⬜ | ⬜ | c15 |
| 봇짐·배낭 4 | AO-26 | ⬜ | ⬜ | c18 |
| 두건·스카프 6 | AO-26 | ⬜ | ⬜ | c19(두건 = 가림 `일부`) |
| 방패 20 | AO-27 | ⬜ | ⬜ | c16, c17 |
| 깃 3·등불 2·빛 원 | AO-28 | ⬜ | ⬜ | c18~c20 |
| 노년 몸체 10 | AO-29 | ⬜ | ⬜ | c21 |
| 주름 2 | AO-13·29 | ⬜ | ⬜ | c22 |
| 흰머리 보조판 6장 | AO-29 | — | ⬜ | c25(OD-16) |
| 흡혈귀 확인 | AO-30 | ⬜ | — | c23(선택) |

### 6.3 P2 세계 (P2 번호 `w`)

| 항목 | 카드 | 번호 | 결과물 | 상태 | 다음 할 일 |
| --- | --- | --- | --- | --- | --- |
| 들쥐 EN01 48 | AO-31 | (P0) | 18 | ✅ v03 r3 | 입력으로 사용 |
| 늑대 | AO-32 | w01 | 18 | ⬜ | 생성(O02 = 48) |
| 박쥐 | AO-33 | w02 | 18 | ⬜ | 〃 |
| 코볼트 몸체 | AO-34 | w03·w04 | 18 | ⬜ | 〃 |
| 코볼트 곡괭이 | AO-35 | w04 | 5(18에서) | ⬜ | w03 뒤 |
| 들쥐 귀 EN02 | AO-35 | w05 | 2(18에서) | ⬜ | — |
| 모자·녹슨 투구 | AO-35 | w07 | 2 + 2 | ⬜ | w03 뒤 |
| 뿔 투구·큰 곡괭이·수염·등불 | AO-35 | w08 | 2 + 5 + 2 + 2 | ⬜ | 소품 떼기는 진행. EB01 색값(OD-12)만 대기 |
| 정예 깃발 | AO-35 | w09 | 2 | ⬜ | 16 × 16 셀(OD-30 결정) |
| 변형 색 목표 EN04·06·07 | AO-36 | w06 | 검토용 3 | ⬜ | — |
| 보스 본체 | AO-37 | w34~w36 | 31 | ⬜ | 7단계 |
| 보스 균열·파동 | AO-38 | w37·w38 | 1 + 4(파동 셀 64 × 56) | ⬜ | 〃 |
| 들판 3층 | AO-39 | (P0) | 3 | ❌ 층 정합 | §3.5 합성 후 분리 |
| 마을 3층 + 창 불빛 | AO-40 | w10·w11 | 3 + 1 | ⬜ | 들판 합격 뒤 |
| 폐광 3층 + 등불 | AO-41 | w13·w14 | 3 + 2 | ⬜ | 〃 |
| 틈 먼 층 | AO-42 | w15 | 1 | ⬜ | w13 뒤 |
| 장소 소품 20 | AO-43 | w12·w16 | 20 | ⬜ | 목록·크기 승인(OD-09). 들판·마을·폐광 합성 합격 뒤 |
| 날씨 입자·안개 | AO-45 | w17 | 입자 4(+낙엽 2) + 안개 1 | ⬜ | 입자 스프라이트 방식 승인(OD-25) |
| 효과 6종 | AO-46~48 | w18~w20 | 32 | ⬜ | — |
| 소품 A | AO-49 | w21·w22 | 18(책 제외) | ⬜ | 자루는 REF-A 뒤 |
| 소품 B | AO-50 | w23·w24 | 23 | ⬜ | — |
| UI 아이콘 | AO-51~54 | w25~w28 | 42 | ⬜ | w25 먼저 |
| 아이템 아이콘 | AO-55~58 | w29~w32 | 34 | ⬜ | 규격 24 승인. 만들지는 `ASSET_BACKLOG.md` O-02 |
| 책 UI | AO-59 | w33 | 3 | ⬜ | — |
| 초상 부품 64 | AO-60 | w39~w42 | 25 | ⬜ | — |
| NPC 초상 64 | AO-61 | w43·w44 | 11 | ⬜ | `n01` 합격 뒤 |
| 초상 48 판 | AO-62 | w45 | 36 | ⬜ | 64 합격 뒤 |

### 6.4 NPC 기준과 이벤트 장면 (P3 번호 `es`)

`nref` 칸 번호는 §7.4 순서다(1 하델 · 4 도담 · 5 세나 · 7 유안 · 8 비엘 · 9 토리 · 10 동반자 · 11 여행자).

32 열은 없앴다(O02 = 48, D64). 정지 부분 떨림은 두 번 재생성 실패 뒤 정규화가 1칸에서 복사한다(D66, 도구 T10).

| 장면 | 사건 | 입력 | 열쇠 칸 K | 띠 48 | 정규화 | 합성 검수(P3 §6) |
| --- | --- | --- | --- | --- | --- | --- |
| `n01` NPC 기준 | — | 마스터 | — | ⬜(시트) | — | — |
| ES01 | L09 | nref 11 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES02 | L23 | nref 4 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES03 | C01-1 | — | ⬜ | ⬜ | ⬜ | ⬜ |
| ES04 | C01-2 | nref 5 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES05 | C01-3 | — | ⬜ | ⬜ | ⬜ | ⬜ |
| ES06 | C02-1 | nref 9 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES07 | C02-2 | nref 9, EN03 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES08 | C02-3 | nref 9 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES09 | F01 | nref 1 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES10 | F02 | nref 7, (P2 w15 틈) | ⬜ | ⬜ | ⬜ | ⬜ |
| ES11 | F03 | nref 8 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES12 | S01 | nref 10 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES13 | S02 | nref 10, ES12 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES14 | S03 | nref 1·4 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES15 | S04 | — | ⬜ | ⬜ | ⬜ | ⬜ |
| ES16 | S05 | — | ⬜ | ⬜ | ⬜ | ⬜ |
| ES17 | S06 | nref 1 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES18 | S07 | — | ⬜ | ⬜ | ⬜ | ⬜ |
| ES19 | S08 | nref 8, ES11 | ⬜ | ⬜ | ⬜ | ⬜ |
| ES20 | EB03 | EB03 시트 | ⬜ | ⬜ | ⬜ | ⬜ |

합계 목표: 장면 20 × 4칸 = 80프레임(15 §13.1).

---

## 7 NPC 외형 (단일 출처, v1.2)

P2 초상(옛 NB-01~NB-09)과 P3 장면(옛 등장인물 외형표·`[ID-…]`·NPC-REF)이 따로 적던 NPC 외형을 여기 하나로 합쳤다. **NPC 외형은 이 절만 고친다.** P2·P3은 이 절을 부른다.

### 7.1 출처와 순서

- 출처 우선순위: **02 §8 외형 키워드**(인물·세계 소유, 00 §2.4) → 15 §10(초상: 투구 없음, 세나·비엘 표정 추가)·15 §9.3(장면 속 역할 설명) → `ASSET_ORDERS.md` AO-61 외형 단서. 앞 출처와 부딪히는 뒤 출처는 쓰지 않는다.
- AO-61에서 쓰지 않은 것(02와 부딪힘): 하델 「가죽 목깃」(02: 녹색 길드 조끼), 미루 「안경 없는 가는 눈」(02: 동그란 안경), 세나 「두 갈래 땋은 머리」(02: 짧게 묶은 머리), 유안 「이마 붕대」(02: 붕대 감은 다리). AO-61의 유안 「길잡이 두건 목 스카프」는 02의 길잡이 망토와 부딪히지 않아 「두건을 내려 목에 두름」으로 합쳤다. AO-61에 없던 도담 머릿수건·토리 모자는 02에서 더했다.
- 세 출처 어디에도 없는 세부(색·옷 모양·키 수치)는 **`임시`**다. **사용자가 승인했다**(2026-09-24, `OPEN_DECISIONS.md` OD-02). 생성 결과를 보고 고칠 수 있고, 고칠 때는 이 절만 고친다.
- 색은 기본 48색 안에서 고른다(15 §2.2). 비엘만 흡혈귀 확장 묶음을 쓴다(15 §5.2).
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
- 파일: `assets/_imagegen/{판}/n01-npc-ref-48.png`. 합격본을 `nref`라 부른다.

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
| P3 장면 열쇠 칸 K | `nref` | 장면 인물의 `[ID-…]`(괄호 풀어서) + P3 §1의 입력 역할 문장 |
| P2 NPC 초상 w43 | w39(스타일) + `nref`(정체성) | `[ID-N01]`~`[ID-N09]`(괄호째 뺀 판) + P2 §12.4의 입력 역할 문장 |
| 검수 | `nref` | P3 SE9, P2 W12: 같은 인물끼리 나란히 놓고 본다 |
