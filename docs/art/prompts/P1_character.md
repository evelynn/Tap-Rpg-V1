# P1_character — 캐릭터 쪽 나머지 에셋 프롬프트

버전 1.2 · 2026년 9월 24일 · 대상: 이미지 생성 모델을 쓰는 제작 AI
1.2: `OPEN_DECISIONS.md` 사용자 결정(2026-09-24) 반영 — 48 규격만(D64, §13 폐기·c24 폐기), 무기 셀 밖 허용(D65, §7.2·E14), 선택 부품 규약 확정(D67, §1.5), 모든 무기 한 손(D68), 볼 홍조 표지(§3.3)·흰머리 보조판(§11.3, c25) 추가, 두건 = 가림 `일부`.
1.1: PROMPTS v1.2 정합 — 교체 머리말 S·무기 공통 문장 S-W를 PROMPTS §1로 옮김, 모든 무기(V1·V2 포함)를 합성에서 떼기(REF-Q 7칸), 쓰러짐 4를 15 §4 「엎드림」으로, 진행표·확인 필요를 PROMPTS §6·`OPEN_DECISIONS.md`로 옮김.
상위 문서: `docs/art/PROMPTS.md` v1.3(이하 **PROMPTS**). 공통 블록 A~E·S·S-W, 떼기 머리말 X(§3.2), 육안 기준 E1~E12·E21은 PROMPTS에 있고 여기서 다시 적지 않는다. 색인·전체 제작 순서는 PROMPTS §5, 진행표는 PROMPTS §6.2, 확인 필요는 `docs/art/OPEN_DECISIONS.md`(옛 번호 `P1-n`)다.
제작 방식은 `ASSET_ORDERS.md` §0.0(D56): 이미지 생성·편집만 쓰고, 코드로 그리기·자르기·축소·배경 제거를 하지 않는다. 규칙·수치는 `docs/design/15_아트_스프라이트_사양.md`(이하 **15**)가 소유한다. 카드 안 프롬프트보다 이 문서가 우선한다.

---

## 0 범위와 쓰는 법

### 0.1 범위

15 §13.1 캐릭터 소계 388프레임 가운데 P0(PROMPTS §3)에 없는 나머지 전부다. 카드로는 AO-05~AO-10, AO-13(나머지), AO-14(6칸 판), AO-15, AO-16·AO-17(나머지: 피격·착용), AO-18, AO-20~AO-23, AO-25~AO-29다. AO-19·AO-24·AO-30은 팔레트 데이터라 게임 쪽 담당이다(§0.0 8번). 이 문서는 그 팔레트가 쓸 **선택 부품 표지**(§1.5)와 흡혈귀 확인 합성(§12)만 다룬다.

### 0.2 선행 조건

1. **기준 인물**: `assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`(PROMPTS §0.2의 0번, 이하 **마스터**). 새로 생성하는 캐릭터 시트에는 모두 이 이미지를 입력으로 넣는다.
2. **REF-A 걷기 12**(PROMPTS §3.1)가 합격해야 걷기 행이 들어가는 모든 교체 편집(방어구·망토·방패·노년)을 시작할 수 있다. 그전에는 REF-B·REF-D·REF-E 편집만 한다.
3. **규격은 48 × 48이다**(O02 결정 2026-09-24, D64). O02를 기다리지 않는다. 32 규격은 만들지 않는다(§13).

### 0.3 세 가지 요청

| 종류 | 무엇 | 머리말 |
| --- | --- | --- |
| **생성** | 새 기준 합성 시트(REF-D·E·H·P·Q). 모든 부품을 입은 완성 인물 | A + B + C + G + F + 본문 + D |
| **교체 편집** | 합격한 합성 시트를 입력으로 넣고 **부품 하나만 바꾼다**(머리 모양·옷 계열·투구·무기·망토·방패). 포즈·위치·색은 그대로 | S(PROMPTS §1) + 교체 문장 + D |
| **떼기** | 합성 시트(원본 또는 교체 결과)에서 **그 부품만 남긴다**. 보이는 화소만 | PROMPTS §3.2 머리말(이하 **X**) + 떼기 문장 |

변형은 모두 「교체 편집 → 떼기」 두 단계로 만든다. 같은 합성 시트에서 나오므로 모든 변형이 같은 몸체 프레임에 겹친다. 게임 쪽 정규화가 떼어 낸 레이어를 15 §12.2 시트 배치로 모은다(`docs/art/imagegen.map.json`의 `reference`/`layer` 짝).

### 0.4 저장

PROMPTS §0.3 그대로. 파일 이름은 `assets/_imagegen/{판}/c{번호}-{이름}-48.png`(c = character)와 같은 이름 `.prompt.txt`. 번호는 §15 제작 순서표의 번호를 쓴다. 떼어 낸 레이어는 `README.md`에 **어느 합성 시트에서 뗐는지** 적는다.

---

## 1 추가 공통 블록

### F 기준 인물 입력 (생성할 때, 마스터를 입력으로 넣고 본문 앞에)

```
Input image role: this is the exact character to draw. Copy its head shape, hair silhouette, eye size, face proportions, clothing, colors, pixel-block size and figure size relative to the cell exactly, and the short sword of its attack row whenever a sword is asked for. Do not copy its poses or its layout. No strap, no pouch, no bag, nothing on the back.
```

### G 크기 (생성할 때, C 뒤에)

시트마다 셀 안 인물 크기가 다르면 레이어가 겹치지 않는다. PROMPTS C에는 크기 문장이 없어 여기서 더한다(48 규격 키 40(머리카락 포함) / 셀 48, 머리 폭 18, 머리카락 최상단 y 4를 비율로 옮김, D74).

```
SCALE: exactly the figure scale of the input sheet. A standing figure is about four fifths of the cell height, the top of the head about one eighth of the cell height below the cell top, and the head about three eighths of the cell width. Seated, crouched and lying poses keep the same head size.
```

### S 교체 편집 머리말 (교체 편집마다 맨 앞에)

PROMPTS §1 S 전문을 쓴다(v1.2에서 옮겼다. 색 유지 문장이 더해졌다). 문장을 고칠 때는 PROMPTS만 고친다.

- 교체 편집에는 D를 뒤에 붙인다. A·B·C는 붙이지 않는다(입력 이미지가 정체성·배치를 가진다).
- 교체 편집 결과를 입력과 겹쳐 봤을 때 **차이가 바꾼 부품 자리에만** 있어야 한다(E13). 남긴 화소의 색도 입력과 같아야 한다(E21).

### X 떼기 머리말

PROMPTS §3.2 공통 머리말을 그대로 쓴다(보이는 화소만, 입력 색 그대로, 배경 한 값 `#FF00FF`). 떼기 문장은 각 절 표에 있다. 떼기 합격 기준에는 E8·E10·E11과 함께 **E21(색 유지)**을 늘 본다.

### 1.5 선택 부품 (15 §3.2 · ASSET_ORDERS §0.3의 인덱스 11~15)

15는 선택 부품을 계열 시트 안의 전용 팔레트 인덱스로 미리 그려 두게 했다. 이미지 생성은 인덱스를 만들지 못하므로 의도(「팔레트로 켜고 끈다」)를 다음 두 방식으로 옮긴다. 이 규약은 사용자 결정으로 확정되어 15 §3.2에 들어갔다(`OPEN_DECISIONS.md` OD-04, D67).

| 방식 | 대상 | 하는 일 | 끌 때(게임 팔레트) |
| --- | --- | --- | --- |
| **표지 색** | 윤곽 안쪽 무늬: 기운 자국(A01), 녹(A06), 종 문양(A07), 청 광맥(W08), 가드(W09), 금 간 자국(W10), 이 빠진 날(W01), 자루 끝 종(W07), 송곳니 장식(W06) | 그 계열 합성·무기 교체 문장에 **그 레이어 안에서 다른 곳에 쓰지 않는 색**으로 함께 그린다. 게임 정규화가 그 색을 인덱스 11~15로 옮긴다 | 윤곽 안 무늬는 **바탕 색**으로(투명이면 구멍이 난다). 윤곽 밖으로 더해지는 종·송곳니만 투명 |
| **겹침 레이어** | 윤곽을 바꾸거나 다른 면을 덮는 부품: 목도리(A04), 짝짝이 어깨받이(A06), 망토 연결 고리(A05) | 계열 합성에 부품을 더하는 교체 편집 → 부품만 떼기. 44프레임 겹침 파일이 따로 생긴다 | 겹침 파일을 그리지 않는다 |

| 부품 | 레이어 | 표지 색 | 모양 |
| --- | --- | --- | --- |
| 기운 자국 A01 | 천옷 | 합성의 헝겊 조각 색이 옷의 다른 곳에 없으면 그대로. 겹치면 조각만 `#C08A58`로 바꾸는 편집을 한 번 한다(§5.1) | 2 × 2블록 조각 3개 |
| 청색 허리띠 A03 | 가죽 | 표지 불필요 — 허리띠 `#5E3C24`가 가죽 레이어에서 유일한 색 | 허리띠 |
| 녹 A06 | 금속 | `#B0603A` | 가슴판 위 2블록 얼룩 2~3개 |
| 종 문양 A07 | 금속 | `#7A4E24` | 가슴판 가운데, 아래가 넓은 사다리꼴 테두리 |
| 청 광맥 W08 | V3 | `#5A7FA8` | 날 가운데 1블록 선 |
| 가드 W09 | V3 | `#7D7B80` | 십자 가드 전체(W04·W08은 금속, W09는 청동으로 팔레트) |
| 금 간 자국 W10 | V6 | `#4C4A52` | 종 머리를 가로지르는 가는 선 |
| 이 빠진 날 W01 | V1 | `#5A7FA8` | 날 한쪽 가장자리 가운데의 1 × 2블록 홈(W01은 투명, 나머지는 날 색) |
| 자루 끝 종 W07 | V1 | `#E0B06A` `#B07A3A` | 자루 끝에 매단 작은 종, 검 길이의 약 1/6 |
| 송곳니 장식 W06 | V4 | `#B4B2B0` | 창날 바로 아래 휜 금속 장식 |
| 볼 홍조(새내기) | 얼굴 | `#B04A42` | 가까운 쪽 볼의 1블록(§3.3). 새내기 팔레트만 색을 주고 그 밖은 투명 |
| 관자놀이 흰머리(숙련기) | 머리카락 | 표지 대신 **보조판**: 두 블록만 흰색으로 바꾼 머리카락 레이어(§11.3). 정규화가 원판과의 차이로 인덱스를 잡는다 | 관자놀이 2블록 |

---

## 2 새 기준 합성 시트 (가장 먼저)

REF-A·REF-B(P0)에 없는 동작 5종(15 §4의 피격·발견·상호작용·환호·쓰러짐)을 두 장으로 나눠 만든다. 한 장에 30칸을 넣는 것보다 칸 수가 적어야 포즈가 정확하다(REF-B 24칸이 합격선).

### 2.1 REF-D · 피격 3 · 발견 4 · 상호작용 4 (AO-05·06·09)

조립: A + B + C(`N=11, COLS=6, ROWS=3, EMPTY_CELLS=Row 1 holds three sprites; its last three cells stay completely empty. Rows 2 and 3 hold four sprites each; their last two cells stay completely empty.`) + G + F + 본문 + D. 입력: 마스터.

```
ROW 1 HIT, 3 frames, 70/120/160 ms. The same short sword as the input is held forward in the front hand, blade pointing up-right, and the far-side arm is raised in front of the chest as a guard, in all three cells. 1 flinch: shoulders hunched, head pulled down one block, eyes squeezed shut in a grimace. 2 the whole figure is pushed back exactly one block to the LEFT, feet still on the ground line, torso leaning back, grimace. 3 recover: the relaxed stance again with the shoulders one block lower, focused frown. No white flash, no impact star, no sweat.
ROW 2 DISCOVER, 4 frames, 120/120/200/400 ms, no held objects. 1 the head lifts, chin one block up, neutral face. 2 the torso leans forward one block to the right. 3 the same body as 2, eyes wide and round, tiny round open mouth, eyebrows raised in surprise. 4 exactly the same as 3. No exclamation mark, no bubble.
ROW 3 INTERACT, 4 frames, 150/150/150/250 ms, standing, the head bowed forward by one step so the face looks down at the hands in all four cells, no object drawn. 1 the front arm reaches forward at waist height, open hand. 2 the same reach, the hand closes into a fist-like grip. 3 pull: the gripping hand comes back beside the body and the torso leans back one block. 4 the same pose as 1, relaxed neutral face.
```

- 뒷팔을 가슴 앞에 든 피격 자세는 수호자 방패(§9.2)가 그 손에 붙기 때문이다.
- 상호작용의 숙인 머리는 머리카락·투구 `숙임` 칸(REF-H 2칸)의 원본이다.
- 합격: E1~E7, E9, E11, E16(표정: 피격 찡그림, 발견 3·4 놀람). 피격 2칸만 몸 중심이 1블록 왼쪽이다.

### 2.2 REF-E · 환호 4 · 쓰러짐 5 (AO-10)

조립: A + B + C(`N=9, COLS=6, ROWS=2, EMPTY_CELLS=Row 1 holds four sprites; its last two cells stay completely empty. Row 2 holds five sprites; its last cell stays completely empty.`) + G + F + 본문 + D. 입력: 마스터.

```
ROW 1 CHEER, 4 frames, 120/120/180/400 ms, no held objects. 1 crouch: knees bent, height about two thirds of standing, arms swung back. 2 jump: the whole body lifted so the feet are about one twentieth of the standing height above the ground line, arms rising. 3 apex: feet about one tenth of the standing height above the ground line, both arms straight up, big open smile, happy curved eyes. 4 landing: feet back on the ground line, knees slightly bent, arms coming down, smile. Only cells 2 and 3 leave the ground line.
ROW 2 COLLAPSE, 5 frames, 100/120/140/200 ms then hold. Gentle and non-violent: exhaustion, not injury. 1 stagger: torso tilted back, arms out to the sides for balance, weary half-closed eyes. 2 kneel: one knee on the ground, height about two thirds of standing, head drooping. 3 lean forward: torso tilted about 45 degrees, both hands just above the ground. 4 lying FACE-DOWN on its stomach, head to the right, the head turned sideways so one cheek rests on the ground and the face shows toward the viewer, legs straight, arms close to the body and not spread, eyes half closed. 5 exactly the same body as 4, eyes fully closed.
Cells 4 and 5 must clearly differ from the sleep pose of the input: lying on the stomach, not curled on the side, no hand under the cheek, the legs straight. Body length about two thirds of the cell width, like the sleep pose.
```

- 환호 2·3칸은 지면선 예외다(15 §12.3 검수 2: +2px, +4px → 키의 1/20, 1/10).
- 쓰러짐 4는 15 §4의 「엎드림」이다(v1.0은 카드 AO-10의 옆으로 누움을 따랐다). 15 §4 표정 연결이 쓰러짐 5에 「눈감음」을 두므로 얼굴은 옆으로 돌려 보이게 한다(`OPEN_DECISIONS.md` OD-53).
- 합격: E1~E7(E3은 환호 2·3 제외), E9, E11, E16(환호 3·4 웃음, 쓰러짐 5 눈감음), E17.

### 2.3 REF-H · 머리 자세 3칸 (AO-14·15·23·26·28의 원본)

머리카락·투구·두건·스카프·깃은 동작별이 아니라 **자세 3칸(기본·숙임·누움)**이다(15 §6.1·§6.2, §12.2). 세 자세를 한 장에 모은 합성 시트를 만들고, 머리에 붙는 모든 부품을 이 시트의 교체 편집으로 만든다.
조립: A + B + C(`N=3, COLS=3, ROWS=1, EMPTY_CELLS=`) + G + 본문 + D. 입력: 마스터(이미지 1), 합격한 REF-D(이미지 2).

```
Input image role: image 1 is the exact character and supplies cells 1 and 3; image 2 supplies cell 2. Copy the identity, pixel-block size and figure size relative to the cell exactly. Do not copy the layouts.
THREE HEAD POSES of the same fully dressed character, no held objects, no sword, no bread:
1 UPRIGHT: the relaxed idle stance of image 1, row 1 frame 1, head upright.
2 BOWED: the interact pose of image 2, row 3 frame 2: standing, head bowed forward one step so the face looks down, the front hand gripping forward at waist height.
3 LYING: the sleep pose of image 1, row 4 frame 1: lying on its side, head to the right resting on the lower arm, eyes closed.
The head, hair and face are exactly the same size in all three cells; only the head angle differs.
```

- 합격: E1, E2, E4, E9, E11. 세 칸의 머리 크기가 같다.

---

## 3 몸체와 얼굴 (AO-05~AO-10, AO-13)

### 3.1 몸체·천옷 레이어 — REF-D, REF-E에서 떼기

| 레이어 | 입력 | X 뒤 문장 |
| --- | --- | --- |
| 몸체(AO-05~10) | REF-D, REF-E | PROMPTS L1 그대로 |
| 천옷(AO-20 나머지 28) | REF-D, REF-E | PROMPTS L4 그대로 |
| 머리카락(참고용) | — | 떼지 않는다. 머리카락은 §4의 자세 3칸을 쓴다(확인 필요 12) |

- 몸체 44프레임 = REF-B(대기 4·공격 6·앉기 4·잠 4) + REF-A에서 고른 걷기 6 + REF-D 11 + REF-E 9.
- 합격: E8, E10, E11. 쓰러짐 4·5, 피격 1~3에서 몸체가 잘리지 않았는지 본다.
- 몸체 속옷은 회청 민소매 `#7EA6B8` `#546E7A`, 바지는 청록 캔버스 `#27978D` `#00766D`다(PROMPTS L1, D73). 뗀 몸체에 크림 `#F0E6CC`나 회색 바지 `#C8C2B8` `#9A948C` 화소가 있으면 불합격이다. 먼저 뗀 v04 `c03-body-ref-d-48`·`c03-body-ref-e-48`은 크림 속옷·회색 바지라 모양만 합격이고, 다음 차례에 새 L1로 다시 뗀다.
- **바지 색 교체(떼기 전에 한 번)**: 바지는 기준 시트에서 보이는 자리라 파생 도구가 기준 시트 색을 쓴다(D73). 합격한 기준 시트(REF-A·REF-B·REF-C·REF-D·REF-E) 각각에 아래 편집을 한 번 하고, 그 결과를 L1·L4·파생의 입력으로 쓴다.

```
Use case: precise recolour edit of the provided sprite sheet. Keep every pixel position, shape and the flat #FF00FF background exactly. Recolour ONLY the trousers in every cell: their lit blocks to #27978D and their shaded blocks to #00766D. The tunic hem, waist cord, boots, skin and everything else keep their exact colours.
```

### 3.2 얼굴 — 둥근 눈 5 (P0) + 가는 눈 5 (AO-13)

둥근 눈은 PROMPTS L7 → L2 그대로다. 가는 눈(HR03·HR05·HR06용)은 **합격한 L7 표정 시트(떼기 전)**를 입력으로 편집한 뒤 L2로 뗀다.

```
Use case: precise edit of the provided 5-cell expression sheet. Keep the canvas, the cells, the flat #FF00FF background and every pixel of hair, skin, body and clothing exactly. Change ONLY the eyes, the same way in every cell: replace the round eyes with NARROW eyes, each a short horizontal slit two blocks wide and one block tall, in exactly the same place and with the same spacing as the round eyes. Eyebrows and mouths stay exactly as they are. The closed-eyes cell stays unchanged. In the smile cell the slits curve slightly upward; in the surprise cell they open to two blocks tall.
```

- 조립: 본문 + D. 그다음 결과에 X + L2 문장.
- 합격: E1, E4, E8, E11. 다섯 칸의 눈 위치가 같다(AO-13). 둥근 눈과 나란히 놓고 실크기에서 다른 얼굴형으로 읽힌다.

### 3.3 볼 홍조 표지 (새내기, 15 §5.1, `OPEN_DECISIONS.md` OD-17)

새내기 볼 홍조 1픽셀은 얼굴 시트의 전용 인덱스다. 얼굴 12프레임을 늘리지 않고 표지 색으로 넣는다. 입력 = 합격한 표정 시트(떼기 전) 두 장: 둥근 눈(PROMPTS L7)과 가는 눈(§3.2 편집 결과). 조립: 본문 + D.

```
Use case: precise recolour edit of the provided 5-cell expression sheet. Keep every pixel position, shape and colour and the flat #FF00FF background exactly. In every cell, recolour ONE single block of skin on the near cheek, one block below and one block toward the ear from the lower edge of the near eye, to #B04A42. The same place in every cell. Nothing else changes.
```

- 그다음 결과에 X + PROMPTS L2(홍조 블록을 남기는 판)로 얼굴을 뗀다.
- 합격: E1, E4, E8, E11, E21 + E19(`#B04A42`가 얼굴 레이어의 다른 곳에 없다). 다섯 칸의 홍조 위치가 같다.

---

## 4 머리카락 6종 × 자세 3 × 변형 2 (AO-14 6칸 판, AO-15)

### 4.1 순서

1. HR01: REF-H를 그대로 떼기 → 기본 변형 3칸.
2. HR02~HR06: REF-H에 **머리 모양 교체** → 합성 시트 5장 → 각각 떼기 → 기본 변형 3칸씩.
3. 기본 변형 3칸 레이어를 입력으로 **윗머리 떼기** 편집 → 가림 변형 3칸.
4. 게임 쪽이 기본 3 + 가림 3을 AO-14 순서의 6칸 시트로 모은다.

### 4.2 머리 모양 교체 (S + 문장 + D, 입력 REF-H)

모든 교체 문장 앞에 다음 공통 문장을 붙인다.

```
SWAP (hair only, all three cells): change ONLY the hairstyle. Keep the same two chestnut browns #7A4E30 #553420 and the #2B2233 outline, follow each cell's head angle, and keep the face, eyes, skin, body and clothing unchanged. New style:
```

| ID | 15 §6.1 | 뒤에 붙일 문장 |
| --- | --- | --- |
| HR02 | 뒤로 하나 묶은 머리 | `one ponytail at the BACK of the head (the left side, away from the face). The top stays short and neat; the tail hangs down behind the head, about one third of the head height long below the tie, tied with a small band in the darker hair brown. No ribbon.` |
| HR03 | 단발 | `a straight bob: smooth hair falling straight down both sides of the head and cut in one level horizontal line about two blocks below the ear, with a straight fringe above the eyebrows.` |
| HR04 | 곱슬 | `curly hair: three big round curly clumps (crown, back and side) bulging about one sixth of the head width beyond the head outline. Each curl is one flat rounded mass with no strand texture.` |
| HR05 | 두 갈래 땋은 머리 | `two plaited braids, one hanging down on each side of the head (the far one partly behind the neck), each about one quarter of the head height long below the jaw line, made of three stacked round segments with ends tied in the darker brown. The two braids mirror each other.` |
| HR06 | 더벅머리 | `shaggy hair: thick uneven bangs covering the whole forehead down to the eyebrows, and short messy spikes sticking out about two blocks in every direction around the head.` |

- AO-15 실루엣 수치(묶음 꼬리 6px, 단발 귀 아래 2px, 곱슬 3px, 땋은 줄 4px, 더벅 2px)를 머리 크기 비율로 옮겼다.
- 좌우 비대칭 장식(리본·한쪽 핀)을 넣지 않는다. HR02 꼬리는 항상 뒤쪽(왼쪽).

### 4.3 떼기와 가림 변형

| 단계 | 입력 | 문장 |
| --- | --- | --- |
| 기본 변형 | REF-H, REF-H-HR02~06 | X + PROMPTS L3 |
| 가림 변형 | 위 결과(머리카락 3칸) | X + `Remove ONLY the crown: every hair pixel on the top of the skull above the level of the top of the forehead (about one quarter of the head height below the highest hair point; in the lying cell measure from the side of the head farthest from the neck). Keep the side locks and the fringe exactly{, and the whole ponytail / both braids}.` |

- `{...}`는 HR02(`, and the whole ponytail`)·HR05(`, and both braids`)만 넣는다(AO-15: 꼬리·땋은 줄은 투구 뒤로 나온다).
- 투구 가림 `전부`는 머리카락을 그리지 않으므로 칸이 없다.
- 합격: E1, E4, E8, E10, E11, E15. 6종을 나란히 놓고 실크기에서 실루엣이 서로 구분된다(AO-15 육안).

---

## 5 방어구 몸통 3계열 (AO-20·21·22) + 선택 부품

각 계열은 **네 장의 합성 시트**(REF-A 걷기 12, REF-B 동작 18, REF-D 11, REF-E 9)를 교체 편집하고 각각 뗀다. 게임 쪽이 44프레임 시트로 모은다(걷기는 12칸 중 1·2·4·7·8·10).

### 5.1 천옷 (AO-20)

- 합성은 기본 복장 그대로다(교체 없음). REF-A·REF-B는 PROMPTS L4(P0), REF-D·REF-E는 §3.1.
- 기운 자국 표지(§1.5): 떼어 낸 천옷 레이어에서 헝겊 조각 색이 옷 그늘 색과 같으면 다음 편집을 한 번 한다(입력: 천옷 레이어 4장 각각).

```
Use case: precise recolour edit of the provided sprite sheet. Keep every pixel position, shape and the flat #FF00FF background exactly. Recolour ONLY the small square repair patches on the tunic to #C08A58, the same patches in every cell. Nothing else changes.
```

### 5.2 가죽 (AO-21)

- 교체 문장: PROMPTS §3.1 REF-C 문장 그대로. REF-D·REF-E에도 같은 문장으로 교체한다(REF-A·REF-B판은 P0 것을 쓴다).
- 떼기: PROMPTS L5. P0의 가죽 레이어(v03 `15`·`21`)는 소매를 늘려 불합격이므로 REF-C 네 장 모두 새 머리말로 다시 뗀다.
- 어깨에 보이는 회청 속옷 소매(`#7EA6B8`, D73)는 가죽 레이어가 가진다(PROMPTS L5, 15 §6.4 A02 「밝은 가죽 + 회청 속옷 소매」). 확인 필요 9는 이것으로 닫았다(`OPEN_DECISIONS.md` OD-48).

### 5.3 금속 (AO-22) — REF-M

S + 문장 + D, 입력 REF-A·REF-B·REF-D·REF-E 각각.

```
SWAP (clothing, every non-empty cell): replace the cream tunic, its waist cord and patches with segmented plate armour covering the same area. A steel chest plate of three overlapping horizontal bands from collar to hips; rounded pauldrons that stick out about two blocks beyond each shoulder, the only place where the outline gets wider; plain steel plates on the upper arms down to the elbows. Colors: #B4B2B0 main, #7D7B80 shade, #4C4A52 deep shade, #E8E6E0 small highlights on top edges, outline #2B2233. Also, identical in every cell: two or three small rust spots #B0603A on the chest plate, and a small bell-shaped trapezoid emblem outlined in #7A4E24 in the middle of the chest plate. Forearms, hands, trousers, boots, head, hair, face, sword and bread unchanged.
```

떼기: X + `Keep ONLY the plate armour: chest plate with its rust spots and emblem, pauldrons and upper-arm plates. Remove everything else.`

- 녹·종 문양은 §1.5 표지 색이다. A06은 녹을 켜고 문양을 바탕색으로, A07은 문양을 켜고 녹을 바탕색으로 바꾼다(게임 팔레트).
- 은색 기본 팔레트에 청동을 넣지 않는다(A07 청동은 팔레트 교체, AO-22·24).

### 5.4 선택 부품 겹침 레이어 (§1.5 겹침 방식)

| 부품 | 입력(합성 4장) | 교체 문장(S 뒤) | 떼기(X 뒤) |
| --- | --- | --- | --- |
| 목도리 A04 | 천옷 합성 REF-A·B·D·E | `SWAP (add, every non-empty cell): a thick red wool muffler #B04A42 wrapped around the neck over the tunic collar, about two blocks tall, with one short end hanging at the back (left). It follows the neck in every pose; the chin and face stay visible.` | `Keep ONLY the red muffler.` |
| 짝짝이 어깨받이 A06 | REF-M 4장 | `SWAP (add, every non-empty cell): make ONLY the near-side (brighter) pauldron one size bigger by adding one extra steel plate #7D7B80 #4C4A52 along its outer edge, one block thick. The far-side pauldron stays as it is.` | `Keep ONLY the added extra plate on the near pauldron.` |
| 망토 연결 고리 A05 | 가죽 합성 REF-C 4장 | `SWAP (add, every non-empty cell): a small round bronze clasp #B07A3A #7A4E24, about two blocks wide, at the collar on the near shoulder, where a cloak would fasten.` | `Keep ONLY the bronze clasp.` |

- 합격(5.1~5.4): E1, E4, E8, E10, E11, E13(교체), E19. 세 계열을 나란히 놓고 3초 안에 다른 옷으로 읽힌다(AO-21 육안). 금속은 어깨가 좌우로 넓다.

---

## 6 투구 5형태 × 3자세 (AO-23)

REF-H에 투구를 씌우는 교체 편집 → 투구만 떼기. 가림 `일부` 투구는 합성에서 앞머리·옆머리가 보이고, `전부` 투구는 머리카락이 하나도 보이지 않는다.

공통 문장(S 뒤): `SWAP (headwear, all three cells): put the helmet described below on the head, following each head angle. The face stays as it is.`

| 파일 | 가림 | 뒤에 붙일 문장 |
| --- | --- | --- |
| `miner` 광부 모자(A04) | 일부 | `A soft brown miner's cap #8E5E38 #5E3C24 covering the top of the head down to the top of the ears, a short front brim about two blocks long over the forehead, and a tiny bronze lamp hook #B07A3A on the front: a hook only, no lamp, no light. The fringe and side locks remain visible below the cap.` |
| `leather` 가죽 모자(A03) | 일부 | `A soft round leather cap #C08A58 #8E5E38 shaped like a dome, covering the crown down to the top of the ears, no brim. The fringe and side locks remain visible below it.` |
| `hood` 두건(A05) | 일부 | `A dark brown cloth hood #5E3C24 with #4A3F55 inner lining, a pointed triangular silhouette with the peak falling back behind the head, the hem reaching the shoulders; the face opening shows the eyes, eyebrows and fringe.` |
| `scrap` 조각 투구(A06) | 전부 | `A full-cover helmet of three riveted scrap iron plates #7D7B80 #4C4A52 with small rust patches #B0603A, covering the whole head, all hair and the face, with one horizontal eye slit exactly as tall as the eyes, where the eyes are; both eyes stay visible through it. No hair shows.` |
| `bell` 종 모양 투구(A07) | 전부 | `A bronze bell-shaped helmet #E0B06A #B07A3A #7A4E24: a trapezoid wider at the bottom with a darker rim line along the lower edge, covering the whole head, all hair and the face down to the chin, with one horizontal eye slit exactly as tall as the eyes; both eyes stay visible through it. No hair shows.` |

떼기: X + `Keep ONLY the {cap / hood / helmet}. Remove the hair, face, eyes, skin, body and clothing; the eye slit becomes background.`

- 합격: E1, E4, E8, E10, E11, E13, E15. 가림 `일부` 셋은 §4 가림 변형 6종과, `전부` 둘은 얼굴 레이어와 겹쳐 본다(V4).

---

## 7 무기 (AO-16·17 나머지, AO-18)

**모든 무기 프레임은 손에 들거나 몸에 찬 합성에서 뗀다**(PROMPTS §2.3: 단독 생성한 단검은 밀도가 사양의 약 3배라 정규화에서 뭉개졌다). 무기 시트 = 공격 6 + 피격 3 + 착용 1(15 §6.3·§12.2). 공격 = REF-B, 피격 = REF-D 1행, 착용 = REF-Q(§7.3).
**무기 레이어만 셀 밖으로 나갈 수 있다**(OD-03 결정, D65). 정규화가 뗀 무기를 hand_f 기준으로 넓힌 무기 셀 80 × 64(몸체 셀 원점 = (16, 16))에 담는다. 떼기 결과를 잘라 내지 않는다. **모든 무기는 앞손 한 손으로 쥔다**(D68).

### 7.1 V1 한손검 — 피격 3칸과 표지

- **피격 3칸**: REF-D에서 X + PROMPTS L6 문장으로 뗀다(1행만 검이 있다). 몸체 피격 자세와 1:1로 맞는다. 카드 AO-16의 「앞으로 든 3」은 15 §6.3의 「피격 3」이다(`OPEN_DECISIONS.md` OD-49).
- **착용 1칸**: REF-Q 1칸(§7.3). PROMPTS v1.1의 가로 칼집 단독 편집은 쓰지 않는다.
- **표지 편집**(W01 이 빠진 날, W07 자루 끝 종): 입력 = V1 레이어(공격 6, 피격 3, 착용 1) 각각.

```
Use case: precise edit of the provided weapon sprite sheet. Keep every existing pixel, position and the flat #FF00FF background exactly. In every cell with a sword: (1) recolour a notch one block deep and two blocks long on one edge of the blade, halfway along the blade, to #5A7FA8; (2) add a tiny bronze bell #E0B06A #B07A3A with a #2B2233 outline hanging from the pommel end, about one sixth of the sword length. The carried sword in its scabbard gets only the bell. Nothing else changes.
```

### 7.2 V2·V3~V6 — 무기 교체 편집

입력: REF-B(2행 공격 6), REF-D(1행 피격 3). S + S-W + 문장 + D. S-W(무기 교체 공통 문장)는 PROMPTS §1에 있다(v1.2에서 옮겼다). V2의 REF-B 교체는 P0(PROMPTS §3.3 AO-17)가 하고, 이 문서는 REF-D 교체만 한다.

| ID | 15 §6.3 (48 길이) | 뒤에 붙일 문장 |
| --- | --- | --- |
| V2 단검(W03) | 10 = V1의 0.6배 | PROMPTS §3.3 AO-17 문장 그대로(REF-D에만) |
| V3 장검(W04·W08·W09) | 22 = V1의 1.4배 | `a LONGSWORD about 1.4 times as long as the input sword, a straight silver blade #E8E6E0 #B4B2B0 with a thin blue line #5A7FA8 one block wide along its middle, a cross guard in #7D7B80 a little wider than the input guard, and a grip wrapped in blue #3E5A7E. The blade points in the same direction as the input sword in each cell; only the length changes.` |
| V4 창(W06) | 22 = 1.4배 | `a SPEAR about 1.4 times as long as the input sword: a straight wooden shaft #8E5E38 #5E3C24, a leaf-shaped ivory head #F0E6CC, and a small curved fang-shaped steel ornament #B4B2B0 just below the head. The spear is ALWAYS horizontal with the head pointing RIGHT, never rotated; the front hand holds the shaft near its middle and the spear simply follows the hand's position in each cell.` |
| V5 곡괭이(W05) | 16 = 1.0배 | `a PICKAXE as long as the input sword: a straight wooden handle #8E5E38 #5E3C24 gripped near its end, with a grey iron head #7D7B80 at the far end crossing the handle at a right angle, one long curved point and one short blunt end. Handle direction per attack cell: 1 down-right, 2 straight up overhead, 3 still straight up, 4 straight down in front of the body, 5 straight down, 6 down-right at the hip. In the hit cells it is held upright in front of the chest.` |
| V6 종추(W10) | 18 = 1.1배 | `a BELL MAUL about 1.1 times as long as the input sword: a short handle #7A4E24 and a bronze bell-shaped head #E0B06A #B07A3A #7A4E24 at the far end, a trapezoid wider at its outer end with a one-block clapper at its lower edge and a thin crack line #4C4A52 across the bell. Same handle directions as a pickaxe: 1 down-right, 2 up, 3 up, 4 down in front, 5 down, 6 down-right at the hip. In the hit cells it is held upright in front of the chest.` |

떼기: X + `Keep ONLY the {dagger / longsword / spear / pickaxe / bell maul} in each cell (all its parts). Remove the character entirely, including the hand holding it.`

- AO-18의 각도(창 방향 2 고정, 곡괭이·종추 3 → 0 → 0 → 4 → 4 → 3)를 셀별 문장으로 옮겼다. 몸체 손 경로는 검 기준 하나뿐이고 모든 무기를 한 손으로 쥔다(15 §6.3, D68 — V3 공격 2·3의 두 손과 V4 두 손 쥠은 없앴다, OD-06). 방향 값은 검수용이다(15 §3.2).
- V3·V4(22)는 공격 4칸에서 셀 폭을 넘는다. V1(16)도 이미 넘는다(PROMPTS §2.3). S-W는 무기가 칸 가장자리를 넘어 빈 여백까지 나가도 되게 고쳤다(OD-03 결정). 옆 칸의 인물·무기에 닿으면 다시 생성하고, 모델이 길이를 줄여 맞추면 불합격이다(E14).
- 청 광맥·가드·송곳니·금은 §1.5 표지 색이다.

### 7.3 착용 1칸 — REF-Q (V1·V2·V3~V6 + 방패)

무기는 공격·피격 밖에서 허리나 등에 찬 1프레임을 `back`에 붙인다(15 §3.1). 뒤 부품이므로 합성에서 **몸 뒤**에 그린다. V1·V2도 여기서 만든다(v1.1: 여섯 무기의 착용 칸을 한 합성에서 뽑아 모양·밀도를 맞춘다).
조립: A + B + C(`N=7, COLS=4, ROWS=2, EMPTY_CELLS=Row 2 holds three sprites; its last cell stays completely empty.`) + G + 본문 + D. 입력: 마스터(V1 검을 가진다), V2 레이어, V3~V6 레이어 4장, 방패 레이어(§9.2).

```
Input image role: image 1 is the exact character and its attack row shows the exact short sword; images 2 to 7 show the exact dagger, longsword, spear, pickaxe, bell maul and round shield to carry: copy their shapes, lengths, sizes and colors exactly. Do not copy any layout.
SEVEN CELLS, each the relaxed idle stance of image 1 (row 1 frame 1), hands down, carrying ONE item, drawn BEHIND the body so the body overlaps it:
1 the short sword in a plain brown scabbard #8E5E38 hanging at the back of the waist, hilt up behind the far hip;
2 the dagger in a small brown sheath #8E5E38 hanging at the back of the waist, hilt up behind the far hip;
3 the longsword in a plain brown scabbard #8E5E38 slung diagonally across the back, hilt up behind the far shoulder;
4 the spear slung diagonally across the back, head up behind the head;
5 the pickaxe hanging at the back of the waist, head up behind the far hip;
6 the bell maul hanging at the back of the waist, bell head down;
7 the round shield slung flat on the back, only its rim showing around the body.
Every item keeps its exact length and stays inside its cell.
```

떼기: X + `Keep ONLY the carried item in each cell (sword or dagger with its scabbard, spear, pickaxe, maul or shield). Remove the character entirely.`

- 합격(7.1~7.3): E1, E4, E8, E10, E11, E13, E14, E18. 6종을 나란히 놓고 실크기에서 실루엣 4~5종 이상이 구분된다(AO-18).

---

## 8 망토 부품 44 (AO-25) — REF-K

S + 문장 + D, 입력 REF-A·REF-B·REF-D·REF-E 각각(천옷 기본 복장).

```
SWAP (add, every non-empty cell): a plain cape. Dark brown cloth #5E3C24 outside, #4A3F55 lining where the inside shows, outline #2B2233. It fastens at the collar with no visible clasp, covers the back of the shoulders and hangs behind the body down to knee height; its front edge falls just over the far shoulder, and the near arm and the face are never covered. Walking cells: the lower hem trails behind (to the left) and sways about two blocks, one frame behind the legs. Attack, hit and cheer: the hem flares back behind the body. Seated: the cape pools on the ground behind the hips. Lying (sleep, collapse 4 and 5): the cape lies over the body like a blanket from shoulders to knees, head and face uncovered. No pattern, no emblem, no hood.
```

망토는 몸 뒤(레이어 1)와 몸 앞(레이어 7)으로 나뉜다(AO-25 `split`). 두 번 뗀다.

| 레이어 | X 뒤 문장 |
| --- | --- |
| 뒷자락 | `Keep ONLY the parts of the cape that hang behind the body: the back panel and the hem. Remove the collar and any part lying over the shoulder, chest or body.` |
| 앞자락 | `Keep ONLY the collar and the parts of the cape lying over the body: over the far shoulder, over the chest, and the blanket-like drape in lying poses.` |

- 흡혈귀 망토는 같은 레이어에 팔레트만 바꾼다(`#2E2438` / `#7A1F33`, 15 §5.2). 새로 그리지 않는다.
- 합격: E1, E4, E8, E10, E11, E13, E18. 뒷자락 + 앞자락을 겹치면 REF-K와 같다. 얼굴이 가려진 칸이 없다.

---

## 9 전문화 부품 30 (AO-26·27, 15 §5.3)

### 9.1 봇짐 1 · 길잡이 배낭 3 · 등불(§10) — REF-P

조립: A + B + C(`N=6, COLS=6, ROWS=1, EMPTY_CELLS=`) + G + F + 본문 + D. 입력: 마스터.

```
SIX CELLS, each exactly the relaxed idle stance of the input (row 1 frame 1), hands down, with one added item:
1 a small round cloth bundle #8E5E38 #5E3C24 tied with a cord, carried high on the back, about one quarter of the standing height tall;
2 a boxy travel backpack #8E5E38 #5E3C24 with a rolled flap, on the back, a little over one third of the standing height tall;
3 the same backpack shifted one block up and tilted slightly back, as in mid-stride;
4 the same backpack shifted one block down and tilted slightly forward;
5 a tiny bronze lantern #E0B06A #B07A3A with a gold flame #FFE38A hanging from the front of the waist cord, about one fifth of the standing height tall;
6 the same lantern with the flame one block smaller.
Back items sit BEHIND the body so the body overlaps them. No straps across the chest, no glow, no light rays.
```

떼기: X + `Keep ONLY the added item in each cell (bundle, backpack or lantern). Remove the character entirely.`

- 봇짐 10 × 10, 배낭 14 × 14, 등불 5 × 7(AO-26·28)을 키 비율로 옮겼다. 흔들림 2칸(3·4)은 걷기 중 번갈아 쓴다.

### 9.2 수호자 방패 20 — REF-G

S + 문장 + D. 입력과 행: REF-B(1행 대기, 2행 공격), REF-A(12칸 전부), REF-D(1행 피격). 문장의 `{ROWS}`를 입력마다 바꾼다(`rows 1 and 2` / `all cells` / `row 1`).

```
SWAP (add, only in {ROWS}; all other cells stay exactly unchanged): a round wooden shield strapped to the far-side (darker) forearm and centred on the far hand wherever that hand is. Board #8E5E38 with #5E3C24 shade, a one-block steel rim #B4B2B0, outline #2B2233. Slightly taller than wide, about one third of the standing figure height, exactly the same size in every cell, no emblem or pattern. The shield is BEHIND the torso: the near-side body, near arm and held sword overlap it, and only the parts outside the body show. It never covers the face. Never move any arm.
```

떼기: X + `Keep ONLY the shield. Remove the character and the sword.`

- 뒷손이 대기·걷기에서는 아래, 공격에서는 몸 뒤, 피격에서는 가슴 앞(REF-D에서 들었다)에 있으므로, AO-27의 「몸 앞 아래 / 뒤로 빠짐 / 올려 막음」이 손 위치에서 나온다.
- 등에 멘 1칸은 REF-Q 5칸(§7.3). 테두리 `#B4B2B0`은 방어구 T3 미만일 때 게임 팔레트가 가죽 색으로 바꾼다(인덱스 11).
- 합격: E1, E4, E8, E10, E11, E13, E18. 방패 크기가 20칸 모두 같다(AO-27).

### 9.3 길잡이 두건 3 · 목 스카프 3 — REF-H 교체

| 부품 | 교체 문장(S 뒤, 입력 REF-H) | 떼기(X 뒤) |
| --- | --- | --- |
| 두건 `chr_part_hood` | `SWAP (headwear, all three cells): a soft green cloth hood #6D8F5A with #4D6A3E shade pulled over the head, following each head angle; the face opening shows the eyes, eyebrows and fringe, the hem ends at the neck, and a short pointed tail hangs behind the head.` | `Keep ONLY the green hood.` |
| 스카프 `chr_part_scarf` | `SWAP (add, all three cells): a red scarf #B04A42 wrapped once around the neck, with one short end hanging behind (to the left). The chin and face stay visible.` | `Keep ONLY the red scarf.` |

- 합격: E1, E4, E8, E10, E11, E13, E15. 두건은 투구 가림 `일부`로 다룬다 — 머리카락 가림 변형과 겹쳐 머리가 두건 밖으로 나오지 않는다(15 §5.3, OD-14 결정, D67).

---

## 10 장신구 표시 5 (AO-28)

| 부품 | 만드는 법 |
| --- | --- |
| J03 매의 깃 3자세(48만) | REF-H 교체: S + `SWAP (add, all three cells): a single white feather #F0E6CC with a blue tip #5A7FA8, tucked into the hair at the back of the head and pointing up and back, about half the head height long, following each head angle.` + D → X + `Keep ONLY the feather.` |
| J04 등불 깜박임 2 | REF-P 5·6칸에서 뗀다(§9.1) |
| 빛 원 `fx_lantern_glow` | 아래 생성. 효과 파일이라 15 §13.1 캐릭터 수에 들지 않는다 |

빛 원: 생성 모델은 반투명 64를 만들지 못한다(PROMPTS §3.3 그림자와 같은 문제). **불투명 한 색으로 받고 알파 64는 게임이 준다.** 조립: A + 본문 + C의 BACKGROUND 문장.

```
One single flat filled circle centred in a square cell, diameter about three quarters of the cell width. One fully opaque color only: gold #FFE38A. Hard stepped pixel edge, no outline, no gradient, no blur, nothing else in the image.
```

- 48 규격만 만든다(D64).
- 합격: E4, E8, E10, E11. 등불은 캐릭터보다 훨씬 작다(AO-28).

---

## 11 나이 (AO-29, AO-13 주름, 15 §5.1)

| 단계 | 새로 그리는 것 | 팔레트로 하는 것(게임) |
| --- | --- | --- |
| 새내기 18~29 | 볼 홍조 표지 1블록(§3.3) | 볼 홍조 인덱스에 색(OD-17) |
| 전성기 30~49 | 없음 | 눈썹을 머리색 최암 톤으로 |
| 숙련기 50~64 | 주름 1칸, 흰머리 보조판(§11.3) | 머리 채도 −35%, 관자놀이 흰머리 2블록 인덱스(OD-16) |
| 노년 65+ | 노년 몸체 10 + 주름 1칸 | 흰머리 `#E8E4DC` `#C8C2B8`, 흰 눈썹 |

### 11.1 노년 몸체 10 — REF-EL

S 머리말에서 `Never move an arm, a hand or the head to fit the part.` 문장을 빼고 쓴다. 입력: REF-A(12칸 전부), REF-B(1행만).

```
SWAP (aging{, ONLY in row 1; rows 2 to 4 stay exactly unchanged}): the same person at 65 or older. Every cell keeps its leg and arm pose, but the upper back is bowed: the shoulders round forward and the head sits one block further forward and one block lower than in the input. Body size, head size and limb thickness stay the same. White hair #E8E4DC #C8C2B8 in the same haircut, white eyebrows #E8E4DC, two short wrinkle lines #A0664A at the outer eye corner. Clothing, trousers and boots unchanged.
```

- `{...}`는 REF-B 입력일 때만 넣는다.
- 떼기: X + PROMPTS L1 문장(주름·흰머리도 얼굴·머리카락과 함께 지워진다). 걷기는 12칸 중 6칸을 게임이 고른다.
- 합격: E1, E4, E8, E10, E11, E20.

### 11.2 주름 겹침 2 — REF-AGE

입력: 마스터. PROMPTS L7과 같은 방식으로 한 프레임에서 2칸을 만든다.

```
Keep this exact character, pose and size (row 1, frame 1). Make a 2-cell row of the same frame, identical except the age marks on the face. Cell 1 MATURE (50s): one short wrinkle line, one block long, at the outer corner of the eye, #A0664A. Cell 2 ELDER (65+): two wrinkle lines at the outer eye corner and one short line under the eye, all #A0664A. Hair, eyebrows, skin, clothing and pose unchanged. Flat #FF00FF background.
```

떼기: X + `Keep ONLY the wrinkle lines at the eye (the short #A0664A lines added for age). Remove everything else, including eyes, eyebrows, skin and hair.`

- 흰 눈썹은 얼굴 레이어의 눈썹 인덱스를 팔레트로 바꾼다(AO-13 「눈썹 전용 인덱스」). 겹침에 넣지 않는다(표정마다 눈썹 모양이 다르다).
- 합격: E1, E4, E8, E10, E11. 얼굴 레이어에 얹어 실크기에서 주름이 보인다.

### 11.3 관자놀이 흰머리 보조판 (숙련기, 15 §5.1, `OPEN_DECISIONS.md` OD-16) — c25

숙련기 흰머리 2픽셀은 머리카락 시트의 전용 인덱스다. 생성 그림에 인덱스가 없으므로 **머리 모양마다 그 두 블록만 흰색으로 바꾼 보조판**을 만들고, 게임 정규화가 원판과 보조판의 차이 화소를 흰머리 인덱스로 잡는다. 보조판은 게임 파일이 아니다(15 §13.1 수량 밖).
입력 = 떼어 낸 머리카락 레이어(HR01~HR06 각각의 기본 변형 3칸·가림 변형 3칸). 조립: 본문 + D.

```
Use case: precise recolour edit of the provided hair sprite sheet. Keep every pixel position, shape and colour and the flat #FF00FF background exactly. In every cell, recolour exactly TWO hair blocks at the near temple (the side hair just in front of the ear, at eye height, following the head angle of that cell) to white #E8E4DC. The same two blocks in every cell. Nothing else changes.
```

- 합격: E1, E4, E8, E21(바꾼 두 블록 밖의 색이 원판과 같다). 원판과 겹쳐 차이가 칸마다 정확히 2블록이다.

---

## 12 흡혈귀 (AO-30, 15 §5.2) — 새 프레임 0

피부·눈동자·망토 색은 팔레트 교체이고 게임 쪽 담당이다. 게임 쪽이 팔레트를 맞출 때 볼 **확인용 합성**만 선택으로 만든다(레이어로 쓰지 않는다, 수량 0).
입력: REF-K의 REF-B판(망토 입은 동작 18). S + 문장 + D.

```
SWAP (colors only, ONLY in row 1; rows 2 to 4 stay exactly unchanged): pale vampire look of the same person. Skin becomes #EDE6EE #CFC3D6 #A596B0; one block of each pupil becomes #C2263A; the cape becomes #2E2438 outside with #7A1F33 lining. Hair color, clothing, shapes and poses stay the same. No fangs, no blood, no bat motifs.
```

- 합격: E4, E11, E13. 창백한 피부가 밤 배경에서 묻히지 않는지는 게임 쪽 V5.

---

## 13 32 규격 (폐기)

O02는 48 × 48로 정했다(2026-09-24, D64). 32 규격은 만들지 않는다. v1.1의 절차(합성에 PROMPTS §1 E → 같은 문장으로 다시 떼기)는 쓰지 않는다.

---

## 14 육안 합격 기준 추가 (PROMPTS §4 E1~E12에 이어. E21은 PROMPTS)

| 번호 | 기준 |
| --- | --- |
| E13 | 교체 편집 결과를 입력과 겹치면 차이가 **바꾼 부품 자리에만** 있다. 팔·손·머리 위치가 1블록도 움직이지 않았다(노년 §11.1만 머리·어깨 예외) |
| E14 | 무기는 모든 칸에서 길이·모양이 같고, 손잡이가 앞손 안에 있고, V1 대비 길이가 지정 비율(V2 0.6, V3·V4 1.4, V5 1.0, V6 1.1)로 보인다. 칸 가장자리를 넘어 빈 여백까지 나가도 되지만 옆 칸의 인물·무기에 닿지 않는다(OD-03 결정, D65). 길이를 줄여 셀에 맞춘 것은 불합격 |
| E15 | 가림 `일부` 투구·두건이 머리카락 가림 변형의 잘린 선을 덮는다. `전부` 투구 아래로 머리카락이 한 화소도 보이지 않고, 눈 틈으로 두 눈이 보인다. 머리 6종 어느 것과 겹쳐도 머리카락이 투구 밖으로 나오지 않는다(15 §12.3 검수 12) |
| E16 | 합성 시트의 표정이 15 §4 연결을 따른다: 공격·피격 찡그림, 발견 놀람, 환호 웃음, 잠·쓰러짐 5 눈감음, 그 밖 기본 |
| E17 | 쓰러짐 4·5칸이 잠 자세와 한눈에 구별된다(엎드림, 뺨 밑 손 없음, 다리를 폄). 얼굴이 옆으로 보인다. 5칸은 4칸과 눈만 다르다 |
| E18 | 뒤 부품(방패·등 무기·봇짐·배낭·망토 뒷자락)은 합성에서 몸 뒤에 있다. 방패·망토가 얼굴을 가리지 않는다 |
| E19 | 선택 부품 표지 색(§1.5)이 그 레이어의 다른 곳에 쓰이지 않았다 |
| E20 | 노년은 기본 몸체와 키·머리 크기가 같고 등만 굽었다. 기본과 나란히 재생하면 같은 사람의 노년으로 읽힌다 |

---

## 15 제작 순서표

「선행」이 합격해야 시작한다. 한 줄이 끝날 때마다 합격 기준을 보고, 떨어지면 프롬프트를 고쳐 다시 요청한다(다음 줄로 넘어가지 않는다).

| 번호 | 작업 | 종류 | 입력 | 선행 | 카드 | 우선 |
| --- | --- | --- | --- | --- | --- | --- |
| c01 | REF-D 피격·발견·상호작용 11 | 생성 | 마스터 | — | AO-05·06·09 | P1 |
| c02 | REF-E 환호·쓰러짐 9 | 생성 | 마스터 | — | AO-10 | P1 |
| c03 | 몸체·천옷 떼기(D·E) | 떼기 ×4 | c01, c02 | c01·c02 | AO-05~10·20 | P1 |
| c04 | REF-H 머리 자세 3 | 생성 | 마스터, c01 | c01 | AO-14·15·23 | P1 |
| c05 | HR01 떼기 + 가림 | 떼기 ×2 | c04 | c04 | AO-14 | P1 |
| c06 | HR02~06 교체 → 떼기 → 가림 | 교체 ×5, 떼기 ×10 | c04 | c04 | AO-15 | P1 |
| c07 | 가는 눈 표정 → 볼 홍조 표지(둥근 눈·가는 눈, §3.3) → 얼굴 떼기 | 편집 ×3, 떼기 ×2 | P0 L7 | P0 L7 | AO-13 | P1 |
| c08 | 가죽 교체(D·E) + 가죽 떼기(A·B·D·E) | 교체 ×2, 떼기 ×4 | REF-C, c01, c02 | c01·c02, REF-A | AO-21 | P1 |
| c09 | 금속 교체(A·B·D·E) + 떼기 | 교체 ×4, 떼기 ×4 | REF-A·B, c01, c02 | REF-A | AO-22 | P1 |
| c10 | 기운 자국 표지 편집(필요할 때) | 편집 ≤4 | 천옷 레이어 | c03 | AO-20 | P1 |
| c11 | 선택 부품 겹침 3종 | 교체 ×12, 떼기 ×12 | 천옷·가죽·금속 합성 | c08·c09 | AO-20~22·24 | P1 |
| c12 | 투구 5 교체 → 떼기 | 교체 ×5, 떼기 ×5 | c04 | c05·c06 | AO-23 | P1 |
| c13 | V1 피격 떼기 + V1 표지 편집 | 떼기, 편집 ×3 | c01, P0 V1 | c01 | AO-16 | P1 |
| c14 | V2 교체(D) + V3~V6 교체(B·D) → 떼기 | 교체 ×9, 떼기 ×9 | REF-B, c01, P0 V2 | c01 | AO-17·18 | P1 |
| c15 | 망토 교체(A·B·D·E) → 앞·뒤 떼기 | 교체 ×4, 떼기 ×8 | REF-A·B, c01, c02 | REF-A | AO-25 | P2 |
| c16 | 방패 교체(A·B·D) → 떼기 | 교체 ×3, 떼기 ×3 | REF-A·B, c01 | REF-A | AO-27 | P2 |
| c17 | REF-Q 착용 무기 6·방패 1 → 떼기 | 생성, 떼기 | 마스터, P0 V2, c14, c16 | c14·c16 | AO-16~18·27 | P2 |
| c18 | REF-P 봇짐·배낭·등불 6 → 떼기 | 생성, 떼기 | 마스터 | — | AO-26·28 | P2 |
| c19 | 두건·스카프·깃 교체 → 떼기 | 교체 ×3, 떼기 ×3 | c04 | c04 | AO-26·28 | P2 |
| c20 | 빛 원 | 생성 | — | — | AO-28 | P2 |
| c21 | 노년 교체(A·B) → 몸체 떼기 | 교체 ×2, 떼기 ×2 | REF-A·B | REF-A | AO-29 | P2 |
| c22 | 주름 2칸 → 떼기 | 편집, 떼기 | 마스터 | — | AO-13·29 | P2 |
| c23 | 흡혈귀 확인 합성(선택) | 교체 | c15의 B판 | c15 | AO-30 | P2 |
| c24 | (폐기 — 32 규격을 만들지 않는다, D64) | — | — | — | — | — |
| c25 | 관자놀이 흰머리 보조판(§11.3) | 편집 ×12(6종 × 기본·가림) | c05·c06 머리카락 레이어 | c05·c06 | AO-29 | P2 |

---

## 16 진행표

진행 상태는 PROMPTS §6.2 한 곳에만 적는다(v1.1에서 옮겼다).

---

## 17 수량 대조 — 15 §13.1 캐릭터 소계 388

| 15 §13.1 항목 | 프레임 | P0(PROMPTS §3) | 이 문서 | 출처 |
| --- | ---: | ---: | ---: | --- |
| 몸체 | 44 | 24 (대기·걷기·공격·앉기·잠) | 20 (피격 3·발견 4·상호작용 4·환호 4·쓰러짐 5) | §2.1·2.2·3.1 |
| 노년 몸체 | 10 | 0 | 10 | §11.1 |
| 얼굴 | 12 | 5 (둥근 눈, L7→L2) | 7 (가는 눈 5·주름 2) | §3.2·11.2 |
| 머리카락 | 36 | 0 (P0는 프레임별 떼기) | 36 (6종 × 3자세 × 2변형) | §4 |
| 방어구 몸통 | 132 | 32 (천옷·가죽 16씩) | 100 (천옷 28·가죽 28·금속 44) | §5 |
| 투구 | 15 | 0 | 15 | §6 |
| 망토 | 44 | 0 | 44 | §8 |
| 무기 | 60 | 12 (V1 공격 6, V2 공격 6) | 48 (V1·V2 피격 3 + 착용 1, V3~V6 40) | §7 |
| 장신구 표시 | 5 | 0 | 5 (깃 3·등불 2) | §10 |
| 전문화 | 30 | 0 | 30 (방패 19+등 1, 두건 3·스카프 3·배낭 3, 봇짐 1) | §7.3·9 |
| **합계** | **388** | **73** | **315** | 73 + 315 = 388 |

388에 들지 않는 부산물: 합성 시트, 걷기 12의 나머지 6칸(방어구·망토·방패·노년), 선택 부품 겹침 3종 × 44(게임 파일 `chr_part_muffler`·`pauldron`·`clasp`, 15 §3.2), 빛 원 1, 흡혈귀 확인 합성, 관자놀이 흰머리 보조판(c25, 게임 파일 아님).

---

## 18 확인 필요

`docs/art/OPEN_DECISIONS.md`로 옮겼다(v1.1). 본문의 「확인 필요 N」은 그 표의 `옛 번호` 열 `P1-N`으로 찾는다. 이 문서에서 닫은 것: 9(가죽 레이어가 어깨 속옷을 가진다, OD-48), 10(피격 3·착용 1을 합성에서 뗀다, OD-49), 18(쓰러짐 4 = 15 §4 엎드림, OD-53). 2026-09-24 사용자 결정(권장안)으로 닫은 것: 1·15(선택 부품 규약, OD-04 → §1.5), 2(한 손, OD-06 → §7.2), 4(무기 셀 넘침 허용, OD-03 → §7·E14), 5(앉기 head `기본`, OD-15), 6(흰머리 보조판, OD-16 → §11.3), 7(볼 홍조 표지, OD-17 → §3.3), 13(두건 가림 `일부`, OD-14 → §9.3), 17(걷기 재생 6, OD-31). 남은 것 없음.
