# V05 생성 결과 및 중단 보고

2026-09-24 · 근거: [V05_REQUEST.md](../../../docs/art/V05_REQUEST.md) v1.0

## 결과

**총 8 PNG를 생성했다. V05-01~05 다섯 항목을 시도했고, 요청 62건 전체 완료가 아니다. 합격 확정 0건.** V05-02는 2회, V05-05는 3회 시도했다. V05-05 세 번째 결과까지 `art:gate` 종료 코드 1이므로 요청서 §0의 “세 번째도 떨어지면 멈추고 보고한다”에 따라 이후 생성을 중단했다.

원인 추정 한 줄: **ImageGen이 격자 틀의 정확한 위치·인물 크기보다 일반적인 6×2 시트 배치를 따라 재구성해, 수치 피드백을 두 번 반영해도 지면선과 키를 맞추지 못했다.** 원인이 확정된 것은 아니며 아래 세 원본과 로그로 틀·수치·문장을 재검토할 수 있다.

모든 PNG는 내장 ImageGen의 생성 원본을 그대로 복사했다. 자르기·리사이즈·배경 제거·색 변경·조립·화소 이동을 코드로 하지 않았다. `assets/game` 적용, `art:normalize`, `derive`, 미리보기 합성, 진행표 갱신은 실행하지 않았다. 생성 원본 경로는 [provenance.json](provenance.json), 실제 크기·알파·색·SHA-256은 [inspection.json](inspection.json)에 있다.

내장 도구에는 별도 출력 크기 설정 인자가 없어서 입력 이미지와 프롬프트에 정확한 크기를 명시했다. 실제 결과 8장 모두 해당 입력/틀의 캔버스 크기는 일치했다. 이번 중단 사유는 캔버스 크기가 아니라 **칸 안의 크기·위치 검사 실패**다.

## 요약표

| 항목 | 시도 | PNG | 판정 |
| --- | ---: | --- | --- |
| V05-01 | 1 | [02-ref-b-actions18-48-teal.png](02-ref-b-actions18-48-teal.png) | 정밀 편집 합격 보류 |
| V05-02 | 1 | [04-ref-c-leather-actions18-48-teal.png](04-ref-c-leather-actions18-48-teal.png) | 편집 불합격 |
| V05-02 | 2 | [04-ref-c-leather-actions18-48-teal-r2.png](04-ref-c-leather-actions18-48-teal-r2.png) | 편집 불합격 |
| V05-03 | 1 | [c01-ref-d-hit-discover-interact11-48-teal.png](c01-ref-d-hit-discover-interact11-48-teal.png) | 위치 정합 불합격 |
| V05-04 | 1 | [c02-ref-e-cheer-collapse9-48-teal.png](c02-ref-e-cheer-collapse9-48-teal.png) | 정밀 편집 합격 보류 |
| V05-05 | 1 | [01-ref-a-walk12-48.png](01-ref-a-walk12-48.png) | 틀 검사 실패 |
| V05-05 | 2 | [01-ref-a-walk12-48-r2.png](01-ref-a-walk12-48-r2.png) | 틀 검사 실패 |
| V05-05 | 3 | [01-ref-a-walk12-48-r3.png](01-ref-a-walk12-48-r3.png) | 틀 검사 실패 |

## 검사 해석

- A 묶음(V05-01~04)의 `--no-canvas` gate는 요청서가 지정한 **참고 검사**다. 원본이 틀 이전 시트이므로 이 검사에서 나온 키·중심·경계 보정 지시는 원본 보존 편집에 적용하지 않았다. 이 실패만으로 편집 불합격을 판정하지 않았다.
- 편집은 입력과 같은 크기인지 확인하고, `layers` 정합·RGB/알파 통계·눈으로 본 차이를 함께 기록했다. `layers` 통과는 요청한 곳만 색이 바뀌었다는 증거가 아니다. V05-02 재시도에는 크기 변경 지시 대신 관찰된 반투명 문제에 대한 편집 피드백을 붙였다.
- V05-05는 요청서 그대로 `chr_elder` 격자와 `NUM(chr_walk12)`, `--rows 'walk:6,walk:6'`를 사용했다. 2·3차 프롬프트 끝에 직전 gate의 `Regeneration feedback:` 아래 전문을 GF 블록으로 붙였다. 기존의 틀·마스터를 같은 순서로 다시 입력했다.
- gate의 배경 100.0%는 허용 오차 안에 들어왔다는 뜻이다. PNG 원시 RGB 값은 #F903FA·#FA03FA 등으로 분산되어 **정확히 #FF00FF 단색**이라는 별도 요청 조건은 충족하지 못했다. PNG를 후처리하지 않았다.
- [inspection.json](inspection.json)의 윤곽 XOR는 RGB에서 R/B>180, G<90를 배경으로 보고 alpha>=128을 사용하는 보조 측정이다. `art:gate`/`layers`의 공식 판정을 대체하지 않는다. RGB 차이에는 작은 색 잡음과 요청한 바지색 교체도 포함되므로 전체 차이 수를 전부 잘못된 변경으로 해석하지 않는다.
- REF-C는 기존 대응표에 항목이 없어 [inspection-ref-c.map.json](inspection-ref-c.map.json)을 **읽기 검사 전용 데이터**로 추가했다. 기준은 v03 REF-C 원본이며 기존 REF-B와 같은 격자·행·팔레트·정렬 설정을 썼다. 이 대응표로 `layers`만 실행했고 정규화 PNG는 출력하지 않았다.

## 미완료 범위와 다음 검토 사항

- V05-01·04: 위치 검사 통과와 별개로 정확한 단색 배경·요청 영역 밖 색 보존이 해결되지 않아 새 원본으로 승인하지 않았다.
- V05-02: 두 번째 결과는 반투명 문제가 해결됐지만 옷자락까지 색이 바뀌었다. 세 번째 시도는 다른 항목의 중단 규칙 발동 전에 실행하지 않았다.
- V05-03: 네 칸 위치 정합 실패. 이 시트에서 파생 가림막·몸체를 생성하지 않았다.
- V05-05: 처음 + 재시도 2회 소진. 임시 격자·NUM·GF와 실제 ImageGen 결과를 게임 쪽에서 다시 검토해야 한다. 검사 기준을 완화하거나 결과를 코드로 맞추지 않았다.
- V05-06 및 C~G는 미착수. 표정·가림막·몸체·몬스터·H1 배경 16변형/층·NPC 초상·이벤트 장면은 생성하지 않았다. 배경 품질 기준 `v04/bg-four-regions-quality-r2.png`와 기존 `output/pixel-art-v01/images/bg_four_regions_draft.png`에 대한 실제 신작 비교도 아직 할 수 없다.
- 요청서 §0.5는 “틀 필요” 시트를 제외하지만 F의 V05-18에는 “틀 필요” 주인공 초상이 포함되어 있다. 미착수 항목이며, 해당 항목을 재개하기 전에 문서의 두 지시를 정리할 필요가 있다.

## 항목별 원본 · 입력 · 보낸 프롬프트 · 검사 전문

### V05-01 · 1차 · 02-ref-b-actions18-48-teal

[PNG](02-ref-b-actions18-48-teal.png) · [프롬프트 전문](02-ref-b-actions18-48-teal.prompt.txt) · [gate 출력 전문](02-ref-b-actions18-48-teal.gate.txt) · [위치 검사](02-ref-b-actions18-48-teal.layers.json) · [초기 비교](02-ref-b-actions18-48-teal.comparison.txt)

입력 순서:

1. `E:/AI_work/Tap_rpg/assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`

시도 횟수: 1 · gate 종료 코드: 1 · 참고 no-canvas 모드.

육안 및 남은 차이: 청록 바지와 원래 18칸 배치는 보인다. 크기 1536×1024 유지, RGB 불투명. layers는 전 칸 통과(최소 containment 0.995). 그러나 바지 밖 머리 영역에도 RGB 채널 차이 >32인 화소 1,741개가 있고 배경은 정확한 #FF00FF 한 값이 아니다. E21 정밀 색 유지 및 단색 배경 합격 보류. 윤곽의 대략적 위치 통과를 색 교체 전체 합격으로 처리하지 않았다.

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Use case: precise recolour edit of the provided sprite sheet. Keep the exact canvas size, every pixel position, every shape and the flat #FF00FF background exactly; do not crop, resize, redraw or move anything. Recolour ONLY the trousers in every cell: their lit blocks to #27978D and their shaded blocks to #00766D. The tunic hem, waist cord, boots, skin and everything else keep their exact colours.

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.

OUTPUT CANVAS: exactly 1536 x 1024 pixels, identical to the input image. Fully opaque RGB output, #FF00FF outside the figures. This is a recolour only, not a redraw.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/02-ref-b-actions18-48-teal.png" "--spec" "chr_actions_a" "--no-canvas" "--rows" "idle,attack,sit_eat,sleep"

assets/_imagegen/v05/02-ref-b-actions18-48-teal.png
FAIL chr_actions_a · no-canvas · 이미지 1536×1024 (틀 1536×1024) · S 4.14 (block) · 시트 블록 4.1 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   idle 1              17587     0  -0.7  50.8(40)       4.1   0.0%  ✗ height
  (1,0)   idle 2              17536     0   0.0  50.8(40)       4.2   0.0%  ✗ height
  (2,0)   idle 3              17566     0   0.0  50.8(40)       4.1   0.0%  ✗ height
  (3,0)   idle 4              17595     0   0.0  50.8(40)       4.2   0.0%  ✗ height
  (0,1)   attack 1            19340     0   0.2  49.6(-)        4.1   0.0%  ✗ bbox
  (1,1)   attack 2            20530     0  -2.9  63.6(-)        4.0   0.0%  ✗ bbox,center
  (2,1)   attack 3            21212     0  -4.1  56.1(-)        3.9   0.0%  ✗ bbox,center
  (3,1)   attack 4            21790     0  -1.2  48.6(-)        4.2   0.0%  ✗ bbox
  (4,1)   attack 5            20708     0   0.0  53.0(-)        4.1   0.0%  ✗ bbox
  (5,1)   attack 6            19226     0   0.0  49.6(-)        4.1   0.0%  ✗ bbox
  (0,2)   sit_eat 1           18548     0   0.0  44.7(35)       4.1   0.0%  ✗ height
  (1,2)   sit_eat 2           18313     0   0.7  44.7(35)       4.1   0.0%  ✗ height
  (2,2)   sit_eat 3           18493     0   0.7  44.7(35)       4.1   0.0%  ✗ height
  (3,2)   sit_eat 4           18297     0   0.7  44.7(35)       4.1   0.0%  ✗ height
  (0,3)   sleep 1             18249     0     -  30.2(-)        4.2   0.0%  ok
  (1,3)   sleep 2             18257     0     -  30.2(-)        4.3   0.0%  ok
  (2,3)   sleep 3             18228     0     -  30.2(-)        4.2   0.0%  ok
  (3,3)   sleep 4             18245     0     -  30.2(-)        4.1   0.0%  ok

Regeneration feedback:
Regenerate this sheet on the chr_actions_a template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "idle 1": the figure is 50.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
- Cell (1,0) "idle 2": the figure is 50.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
- Cell (2,0) "idle 3": the figure is 50.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
- Cell (3,0) "idle 4": the figure is 50.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
- Cell (0,1) "attack 1": the drawing crosses the cell boundary on the bottom by 1.2 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "attack 2": the drawing crosses the cell boundary on the top by 0.5 blocks, bottom by 1.2 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "attack 2": the figure's horizontal center is 2.9 blocks left of the center of the other frames in this column; move it 2.9 blocks right.
- Cell (2,1) "attack 3": the drawing crosses the cell boundary on the bottom by 1.2 blocks. Keep every pixel inside its own cell.
- Cell (2,1) "attack 3": the figure's horizontal center is 4.1 blocks left of the center of the other frames in this column; move it 4.1 blocks right.
- Cell (3,1) "attack 4": the drawing crosses the cell boundary on the right by 7 blocks, bottom by 1.2 blocks. Keep every pixel inside its own cell.
- Cell (4,1) "attack 5": the drawing crosses the cell boundary on the bottom by 1.2 blocks. Keep every pixel inside its own cell.
- Cell (5,1) "attack 6": the drawing crosses the cell boundary on the bottom by 1.2 blocks. Keep every pixel inside its own cell.
- Cell (0,2) "sit_eat 1": the figure is 44.7 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
- Cell (1,2) "sit_eat 2": the figure is 44.7 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
- Cell (2,2) "sit_eat 3": the figure is 44.7 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
- Cell (3,2) "sit_eat 4": the figure is 44.7 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 4.1x4.1 block.
(Measured without the template canvas: the ground line is compared between frames of the same row and the center between frames of the same column, not against the template marks.)
 ELIFECYCLE  Command failed with exit code 1.
```

</details>

### V05-02 · 1차 · 04-ref-c-leather-actions18-48-teal

[PNG](04-ref-c-leather-actions18-48-teal.png) · [프롬프트 전문](04-ref-c-leather-actions18-48-teal.prompt.txt) · [gate 출력 전문](04-ref-c-leather-actions18-48-teal.gate.txt) · [REF-C 위치 검사 두 시도](04-ref-c-leather-recolour.layers.json)

입력 순서:

1. `E:/AI_work/Tap_rpg/assets/_imagegen/v03/04-ref-c-leather-actions18-48-r2.png`

시도 횟수: 1 · gate 종료 코드: 1 · 참고 no-canvas 모드.

육안 및 남은 차이: 1536×1024 유지. 바지와 어깨 속옷 색은 바뀌었으나 배경에 흐린 색 띠가 보이고 RGBA로 출력됐다. 1,572,864화소 중 1,572,858화소가 불투명하지 않으며 gate의 인물 내부 반투명 판정이 모든 사용 칸 100%이다. 불합격. layers 위치만은 통과(최소 containment 0.985).

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Use case: precise recolour edit of the provided sprite sheet. Keep the exact canvas size, every pixel position, every shape and the flat #FF00FF background exactly; do not crop, resize, redraw or move anything. Recolour ONLY the trousers in every cell: their lit blocks to #27978D and their shaded blocks to #00766D. The tunic hem, waist cord, boots, skin and everything else keep their exact colours.

Also recolour ONLY the undershirt visible at the shoulders under the leather vest: its lit blocks to #7EA6B8 and its shaded blocks to #546E7A. The leather vest, straps and belt keep their exact colours.

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.

OUTPUT CANVAS: exactly 1536 x 1024 pixels, identical to the input image. Fully opaque RGB output, #FF00FF outside the figures. This is a recolour only, not a redraw.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/04-ref-c-leather-actions18-48-teal.png" "--spec" "chr_actions_a" "--no-canvas" "--rows" "idle,attack,sit_eat,sleep"

assets/_imagegen/v05/04-ref-c-leather-actions18-48-teal.png
FAIL chr_actions_a · no-canvas · 이미지 1536×1024 (틀 1536×1024) · S 3.84 (block) · 시트 블록 3.8 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   idle 1              17556     0  -1.0  54.9(40)       3.8 100.0%  ✗ height,alpha
  (1,0)   idle 2              17514     0   0.0  54.9(40)       3.8 100.0%  ✗ height,alpha
  (2,0)   idle 3              17544     0   0.0  54.9(40)       3.7 100.0%  ✗ height,alpha
  (3,0)   idle 4              17616     0   0.0  54.9(40)       3.8 100.0%  ✗ height,alpha
  (0,1)   attack 1            19189     0   0.0  53.1(-)        3.8 100.0%  ✗ bbox,alpha
  (1,1)   attack 2            20419     0  -3.1  68.2(-)        3.8 100.0%  ✗ bbox,center,alpha
  (2,1)   attack 3            21013     0  -4.4  59.9(-)        3.7 100.0%  ✗ bbox,center,alpha
  (3,1)   attack 4            21552     0  -1.6  52.1(-)        3.8 100.0%  ✗ bbox,alpha
  (4,1)   attack 5            20604     0   0.0  56.8(-)        3.9 100.0%  ✗ bbox,alpha
  (5,1)   attack 6            19073     0   0.0  53.1(-)        3.9 100.0%  ✗ bbox,alpha
  (0,2)   sit_eat 1           18550     0   0.0  47.9(35)       3.9 100.0%  ✗ height,alpha
  (1,2)   sit_eat 2           18323     0   0.8  48.2(35)       3.8 100.0%  ✗ height,alpha
  (2,2)   sit_eat 3           18542     0   1.0  48.2(35)       3.8 100.0%  ✗ height,alpha
  (3,2)   sit_eat 4           18319     0   0.8  48.2(35)       3.9 100.0%  ✗ height,alpha
  (0,3)   sleep 1             18410     0     -  32.8(-)        4.0 100.0%  ✗ alpha
  (1,3)   sleep 2             18402     0     -  32.8(-)        4.0 100.0%  ✗ alpha
  (2,3)   sleep 3             18387     0     -  32.8(-)        4.0 100.0%  ✗ alpha
  (3,3)   sleep 4             18398     0     -  32.8(-)        4.0 100.0%  ✗ alpha

Regeneration feedback:
Regenerate this sheet on the chr_actions_a template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "idle 1": the figure is 54.9 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (0,0) "idle 1": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (1,0) "idle 2": the figure is 54.9 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (1,0) "idle 2": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (2,0) "idle 3": the figure is 54.9 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (2,0) "idle 3": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (3,0) "idle 4": the figure is 54.9 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (3,0) "idle 4": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (0,1) "attack 1": the drawing crosses the cell boundary on the bottom by 1 block. Keep every pixel inside its own cell.
- Cell (0,1) "attack 1": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (1,1) "attack 2": the drawing crosses the cell boundary on the top by 0.5 blocks, bottom by 1 block. Keep every pixel inside its own cell.
- Cell (1,1) "attack 2": the figure's horizontal center is 3.1 blocks left of the center of the other frames in this column; move it 3.1 blocks right.
- Cell (1,1) "attack 2": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (2,1) "attack 3": the drawing crosses the cell boundary on the bottom by 1 block. Keep every pixel inside its own cell.
- Cell (2,1) "attack 3": the figure's horizontal center is 4.4 blocks left of the center of the other frames in this column; move it 4.4 blocks right.
- Cell (2,1) "attack 3": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (3,1) "attack 4": the drawing crosses the cell boundary on the right by 7.3 blocks, bottom by 1 block. Keep every pixel inside its own cell.
- Cell (3,1) "attack 4": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (4,1) "attack 5": the drawing crosses the cell boundary on the bottom by 1 block. Keep every pixel inside its own cell.
- Cell (4,1) "attack 5": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (5,1) "attack 6": the drawing crosses the cell boundary on the bottom by 1 block. Keep every pixel inside its own cell.
- Cell (5,1) "attack 6": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (0,2) "sit_eat 1": the figure is 47.9 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (0,2) "sit_eat 1": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (1,2) "sit_eat 2": the figure is 48.2 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (1,2) "sit_eat 2": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (2,2) "sit_eat 3": the figure is 48.2 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (2,2) "sit_eat 3": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- Cell (3,2) "sit_eat 4": the figure is 48.2 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.8x3.8 block.
- Cell (3,2) "sit_eat 4": 100% of the pixels inside the figure are semi-transparent; every figure pixel must be fully opaque with hard edges (no anti-aliasing, no soft glow).
- ...and 4 more problems of the same kinds.
(Measured without the template canvas: the ground line is compared between frames of the same row and the center between frames of the same column, not against the template marks.)
 ELIFECYCLE  Command failed with exit code 1.
```

</details>

### V05-02 · 2차 · 04-ref-c-leather-actions18-48-teal-r2

[PNG](04-ref-c-leather-actions18-48-teal-r2.png) · [프롬프트 전문](04-ref-c-leather-actions18-48-teal-r2.prompt.txt) · [gate 출력 전문](04-ref-c-leather-actions18-48-teal-r2.gate.txt) · [REF-C 위치 검사 두 시도](04-ref-c-leather-recolour.layers.json)

입력 순서:

1. `E:/AI_work/Tap_rpg/assets/_imagegen/v03/04-ref-c-leather-actions18-48-r2.png`

시도 횟수: 2 · gate 종료 코드: 1 · 참고 no-canvas 모드.

육안 및 남은 차이: 1536×1024 RGB, 반투명 0화소로 개선됐다. 그러나 공격·앉기 칸에서 허리 아래 옷자락까지 청록색으로 바뀌었고 바지 밖 머리 영역에도 RGB 채널 차이 >32인 화소 1,408개가 남았다. layers 위치는 통과(최소 containment 0.986)하지만 요청 부분만 색을 바꾼 결과로는 불합격. 배경도 정확한 단일 #FF00FF가 아니다.

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Use case: precise recolour edit of the provided sprite sheet. Keep the exact canvas size, every pixel position, every shape and the flat #FF00FF background exactly; do not crop, resize, redraw or move anything. Recolour ONLY the trousers in every cell: their lit blocks to #27978D and their shaded blocks to #00766D. The tunic hem, waist cord, boots, skin and everything else keep their exact colours.

Also recolour ONLY the undershirt visible at the shoulders under the leather vest: its lit blocks to #7EA6B8 and its shaded blocks to #546E7A. The leather vest, straps and belt keep their exact colours.

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.

OUTPUT CANVAS: exactly 1536 x 1024 pixels, identical to the input image. Fully opaque RGB output, #FF00FF outside the figures. This is a recolour only, not a redraw.

PREVIOUS ATTEMPT FAILED THE EDIT CHECK. Use the original input image again. Keep the exact original 1536 x 1024 canvas, each original shape, position and all colours outside the two requested recolours. The previous result incorrectly introduced transparency across every figure and the entire background. Deliver a completely opaque image: alpha must be 255 everywhere, including the flat solid #FF00FF background. Treat magenta as painted solid background that must remain visible, not a chroma key to remove. No transparent or translucent pixels, no alpha masking, no feathering, no haze or colour halos. Background must be one exact flat #FF00FF RGB value. Only the trousers and exposed shoulder undershirt change colour; leather, hair, skin, boots and swords retain their original pixels and colours. Do not resize figures or reposition any frames.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/04-ref-c-leather-actions18-48-teal-r2.png" "--spec" "chr_actions_a" "--no-canvas" "--rows" "idle,attack,sit_eat,sleep"

assets/_imagegen/v05/04-ref-c-leather-actions18-48-teal-r2.png
FAIL chr_actions_a · no-canvas · 이미지 1536×1024 (틀 1536×1024) · S 3.06 (block) · 시트 블록 3.1 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   idle 1              17468     0  -1.3  69.1(40)       3.0   0.0%  ✗ height
  (1,0)   idle 2              17391     0   0.0  69.1(40)       3.0   0.0%  ✗ height
  (2,0)   idle 3              17368     0   0.0  69.1(40)       2.9   0.0%  ✗ height
  (3,0)   idle 4              17459     0   0.0  69.1(40)       3.0   0.0%  ✗ height
  (0,1)   attack 1            18963     0   0.0  66.4(-)        2.9   0.0%  ✗ bbox
  (1,1)   attack 2            20187     0  -3.6  85.8(-)        2.8   0.0%  ✗ bbox,center
  (2,1)   attack 3            20785     0  -5.6  75.3(-)        2.7   0.0%  ✗ bbox,center
  (3,1)   attack 4            21269     0  -1.6  65.1(-)        3.4   0.0%  ✗ bbox
  (4,1)   attack 5            20434     0   0.0  71.4(-)        2.8   0.0%  ✗ bbox
  (5,1)   attack 6            18877     0   0.0  66.8(-)        3.0   0.0%  ✗ bbox
  (0,2)   sit_eat 1           18479     0   0.0  60.6(35)       3.3   0.0%  ✗ height
  (1,2)   sit_eat 2           18229     0   1.0  60.6(35)       3.2   0.0%  ✗ height
  (2,2)   sit_eat 3           18404     0   1.0  60.6(35)       3.1   0.0%  ✗ height
  (3,2)   sit_eat 4           18157     0   1.0  60.6(35)       3.1   0.0%  ✗ height
  (0,3)   sleep 1             18096     0     -  41.2(-)        3.2   0.0%  ok
  (1,3)   sleep 2             18112     0     -  41.2(-)        3.3   0.0%  ok
  (2,3)   sleep 3             18091     0     -  41.2(-)        3.2   0.0%  ok
  (3,3)   sleep 4             18077     0     -  41.2(-)        3.3   0.0%  ok

Regeneration feedback:
Regenerate this sheet on the chr_actions_a template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "idle 1": the figure is 69.1 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
- Cell (1,0) "idle 2": the figure is 69.1 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
- Cell (2,0) "idle 3": the figure is 69.1 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
- Cell (3,0) "idle 4": the figure is 69.1 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
- Cell (0,1) "attack 1": the drawing crosses the cell boundary on the bottom by 1.3 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "attack 2": the drawing crosses the cell boundary on the top by 0.7 blocks, bottom by 1.3 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "attack 2": the figure's horizontal center is 3.6 blocks left of the center of the other frames in this column; move it 3.6 blocks right.
- Cell (2,1) "attack 3": the drawing crosses the cell boundary on the bottom by 1.3 blocks. Keep every pixel inside its own cell.
- Cell (2,1) "attack 3": the figure's horizontal center is 5.6 blocks left of the center of the other frames in this column; move it 5.6 blocks right.
- Cell (3,1) "attack 4": the drawing crosses the cell boundary on the right by 9.2 blocks, bottom by 1.3 blocks. Keep every pixel inside its own cell.
- Cell (4,1) "attack 5": the drawing crosses the cell boundary on the bottom by 1.3 blocks. Keep every pixel inside its own cell.
- Cell (5,1) "attack 6": the drawing crosses the cell boundary on the bottom by 1.3 blocks. Keep every pixel inside its own cell.
- Cell (0,2) "sit_eat 1": the figure is 60.6 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
- Cell (1,2) "sit_eat 2": the figure is 60.6 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
- Cell (2,2) "sit_eat 3": the figure is 60.6 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
- Cell (3,2) "sit_eat 4": the figure is 60.6 blocks tall but must be 35 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 3.1x3.1 block.
(Measured without the template canvas: the ground line is compared between frames of the same row and the center between frames of the same column, not against the template marks.)
 ELIFECYCLE  Command failed with exit code 1.
```

</details>

### V05-03 · 1차 · c01-ref-d-hit-discover-interact11-48-teal

[PNG](c01-ref-d-hit-discover-interact11-48-teal.png) · [프롬프트 전문](c01-ref-d-hit-discover-interact11-48-teal.prompt.txt) · [gate 출력 전문](c01-ref-d-hit-discover-interact11-48-teal.gate.txt) · [위치 검사](c01-ref-d-hit-discover-interact11-48-teal.layers.json)

입력 순서:

1. `E:/AI_work/Tap_rpg/assets/_imagegen/v04/c01-ref-d-hit-discover-interact11-48.png`

시도 횟수: 1 · gate 종료 코드: 1 · 참고 no-canvas 모드.

육안 및 남은 차이: 1774×887 유지, RGB 불투명. 청록 바지와 자홍 배경이 생겼다. layers에서 hit 1·2와 discover 1·2 네 칸이 containment 0.932~0.948로 0.95 기준 미달이다. 원본과 윤곽 차이가 있어 E8 정합 불합격. 배경이 정확한 단일 #FF00FF가 아니므로 배경 조건도 미달.

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Use case: precise recolour edit of the provided sprite sheet. Keep the exact canvas size, every pixel position and every shape exactly; do not crop, resize, redraw or move anything. The transparent background becomes one flat, fully opaque #FF00FF everywhere; pixels that were mostly transparent become background, and every other pixel becomes fully opaque with its own colour.
Recolour ONLY the trousers in every cell: their lit blocks to #27978D and their shaded blocks to #00766D. The tunic hem, waist cord, boots, skin and everything else keep their exact colours.

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.

OUTPUT CANVAS: exactly 1774 x 887 pixels, identical to the input image. Fully opaque RGB output, #FF00FF outside the figures. This is a recolour only, not a redraw.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/c01-ref-d-hit-discover-interact11-48-teal.png" "--spec" "chr_actions_a" "--no-canvas" "--rows" "hit,discover,interact"

assets/_imagegen/v05/c01-ref-d-hit-discover-interact11-48-teal.png
FAIL chr_actions_a · no-canvas · 이미지 1774×887 (틀 1536×1024) · S 6.66 (block) · 시트 블록 6.7 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   hit 1               32233     0   0.2  36.8(40)       7.1   0.0%  ✗ height
  (1,0)   hit 2               30795     0  -1.2  35.3(40)       7.0   0.0%  ✗ height
  (2,0)   hit 3               31389     0   0.0  36.8(40)       7.2   0.0%  ✗ height
  (0,1)   discover 1          27781     0  -0.3  38.6(40)       6.6   0.0%  ok
  (1,1)   discover 2          27989     0   2.9  37.1(40)       6.7   0.0%  ✗ center
  (2,1)   discover 3          28499     0   1.5  37.4(40)       7.1   0.0%  ok
  (3,1)   discover 4          28341     0  -0.3  36.9(40)       6.3   0.0%  ok
  (0,2)   interact 1          30893     0   0.0  36.8(40)       6.3   0.0%  ✗ height
  (1,2)   interact 2          29838     0   0.0  36.6(40)       6.4   0.0%  ✗ height
  (2,2)   interact 3          28216     0  -1.4  36.5(40)       6.7   0.0%  ✗ height
  (3,2)   interact 4          30710     0   0.3  36.6(40)       6.3   0.0%  ✗ height

Regeneration feedback:
Regenerate this sheet on the chr_actions_a template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "hit 1": the figure is 36.8 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 6.7x6.7 block.
- Cell (1,0) "hit 2": the figure is 35.3 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 6.7x6.7 block.
- Cell (2,0) "hit 3": the figure is 36.8 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 6.7x6.7 block.
- Cell (1,1) "discover 2": the figure's horizontal center is 2.9 blocks right of the center of the other frames in this column; move it 2.9 blocks left.
- Cell (0,2) "interact 1": the figure is 36.8 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 6.7x6.7 block.
- Cell (1,2) "interact 2": the figure is 36.6 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 6.7x6.7 block.
- Cell (2,2) "interact 3": the figure is 36.5 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 6.7x6.7 block.
- Cell (3,2) "interact 4": the figure is 36.6 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 6.7x6.7 block.
(Measured without the template canvas: the ground line is compared between frames of the same row and the center between frames of the same column, not against the template marks.)
 ELIFECYCLE  Command failed with exit code 1.
```

</details>

### V05-04 · 1차 · c02-ref-e-cheer-collapse9-48-teal

[PNG](c02-ref-e-cheer-collapse9-48-teal.png) · [프롬프트 전문](c02-ref-e-cheer-collapse9-48-teal.prompt.txt) · [gate 출력 전문](c02-ref-e-cheer-collapse9-48-teal.gate.txt) · [위치 검사](c02-ref-e-cheer-collapse9-48-teal.layers.json)

입력 순서:

1. `E:/AI_work/Tap_rpg/assets/_imagegen/v04/c02-ref-e-cheer-collapse9-48-r2.png`

시도 횟수: 1 · gate 종료 코드: 1 · 참고 no-canvas 모드.

육안 및 남은 차이: 2172×724 유지, RGB 불투명. 환호 4칸·쓰러짐 5칸과 청록 바지가 보인다. layers 위치는 전 칸 통과(최소 containment 0.957, 마지막 쓰러짐 칸 best_shift [1,0]). 다만 원본의 윤곽·색과 픽셀 단위 차이가 있고 배경이 정확한 단일 #FF00FF가 아니다. 정밀 편집 합격 보류. 원본의 반투명을 불투명으로 바꾸면서 생길 수 있는 윤곽 차이와 실제 재그림을 구분하는 최종 판독도 남아 있다.

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Use case: precise recolour edit of the provided sprite sheet. Keep the exact canvas size, every pixel position and every shape exactly; do not crop, resize, redraw or move anything. The transparent background becomes one flat, fully opaque #FF00FF everywhere; pixels that were mostly transparent become background, and every other pixel becomes fully opaque with its own colour.
Recolour ONLY the trousers in every cell: their lit blocks to #27978D and their shaded blocks to #00766D. The tunic hem, waist cord, boots, skin and everything else keep their exact colours.

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.

OUTPUT CANVAS: exactly 2172 x 724 pixels, identical to the input image. Fully opaque RGB output, #FF00FF outside the figures. This is a recolour only, not a redraw.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/c02-ref-e-cheer-collapse9-48-teal.png" "--spec" "chr_actions_b" "--no-canvas" "--rows" "cheer,collapse"

assets/_imagegen/v05/c02-ref-e-cheer-collapse9-48-teal.png
FAIL chr_actions_b · no-canvas · 이미지 2172×724 (틀 1536×1024) · S 8.86 (block) · 시트 블록 8.9 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   cheer 1             36907     0  -0.4  28.4(-)        9.3   0.0%  ok
  (1,0)   cheer 2             38089     1  -0.8  33.3(40)      11.7   0.0%  ✗ height,block
  (2,0)   cheer 3             39209     0  -1.4  32.8(40)      11.8   0.0%  ✗ height,block
  (3,0)   cheer 4             38094     0   0.0  30.1(40)      10.0   0.0%  ✗ height
  (0,1)   collapse 1          46178     0   0.4  34.1(40)       8.9   0.0%  ✗ height
  (1,1)   collapse 2          38392     0   0.8  29.0(-)        8.3   0.0%  ok
  (2,1)   collapse 3          42001     0   1.4  26.5(-)        8.4   0.0%  ok
  (3,1)   collapse 4          33869     0     -  14.9(-)        8.4   0.0%  ✗ bbox
  (4,1)   collapse 5          34005     0     -  14.9(-)        8.3   0.0%  ✗ bbox

Regeneration feedback:
Regenerate this sheet on the chr_actions_b template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (1,0) "cheer 2": the figure is 33.3 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 8.9x8.9 block.
- Cell (1,0) "cheer 2": the art pixels are about 11.7 image pixels wide, but every art pixel must be a 8.9x8.9 block. Redraw on the 8.9-pixel grid; do not rescale or blur.
- Cell (2,0) "cheer 3": the figure is 32.8 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 8.9x8.9 block.
- Cell (2,0) "cheer 3": the art pixels are about 11.8 image pixels wide, but every art pixel must be a 8.9x8.9 block. Redraw on the 8.9-pixel grid; do not rescale or blur.
- Cell (3,0) "cheer 4": the figure is 30.1 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 8.9x8.9 block.
- Cell (0,1) "collapse 1": the figure is 34.1 blocks tall but must be 40 blocks tall (±8%); draw it larger to match the reference figure, keeping one art pixel = one 8.9x8.9 block.
- Cell (3,1) "collapse 4": the drawing crosses the cell boundary on the right by 0.2 blocks. Keep every pixel inside its own cell.
- Cell (4,1) "collapse 5": the drawing crosses the cell boundary on the right by 0.9 blocks. Keep every pixel inside its own cell.
(Measured without the template canvas: the ground line is compared between frames of the same row and the center between frames of the same column, not against the template marks.)
 ELIFECYCLE  Command failed with exit code 1.
```

</details>

### V05-05 · 1차 · 01-ref-a-walk12-48

[PNG](01-ref-a-walk12-48.png) · [프롬프트 전문](01-ref-a-walk12-48.prompt.txt) · [gate 출력 전문](01-ref-a-walk12-48.gate.txt)

입력 순서:

1. `E:/AI_work/Tap_rpg/docs/art/templates/chr_elder.grid.png`
2. `E:/AI_work/Tap_rpg/assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`

시도 횟수: 1 · gate 종료 코드: 1 · 틀 모드.

육안 및 남은 차이: 1536×1024 RGB, 12칸·청록 바지·낮게 내려온 팔은 보인다. 키 55.2~55.4블록(기준 40), 1행 지면 -3·2행 +19블록, 중심·칸 경계 위반. 12칸 모두 gate 실패. 육안상 두 행의 선행 다리 구분도 충분하지 않다. gate 미통과이므로 정식 육안 합격 단계로 넘기지 않았다.

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Asset type: Tap RPG small 2D pixel-art game sprite sheet. This is a real sprite art request, not a UI, diagram, poster or pixel-art-themed illustration.
PIXEL LANGUAGE: every figure must look designed on a genuine logical 48x48 pixel canvas and then shown with large, uniform, perfectly square pixel blocks. Crisp hard square pixel clusters and deliberate one-block stair-steps. Strong readable silhouette with very restrained internal detail. Outer contour exactly one pixel-block thick in dark plum #2B2233 (characters, enemies, weapons and props only; backgrounds follow their own rule in §3.5). Flat color fills in large coherent clusters.
Absolutely no blur, anti-aliasing, smooth vector curves, gradients, soft lighting, glow, painterly strokes, noisy dithering, fur or hair texture, glossy or 3D rendering, photographic detail.

SUBJECT AND IDENTITY: one and the same youthful androgynous human adventurer in every cell, chibi proportions about 2.2 heads tall (the head is close to half of the body height). Facing RIGHT in a slight three-quarter side view, never front-facing. Short chestnut hair (HR01) with two flat browns, medium warm skin, round dark eyes, tiny mouth. Cream quilted short tunic with elbow-length sleeves, thin brown waist cord, two or three small square repair patches, muted teal canvas work trousers, brown boots. Keep every hair lock, facial feature, garment detail, body proportion and limb thickness identical across all cells. Expressive and charming, not a stiff stick figure.
FAR-SIDE LIMBS: the arm and leg farther from the viewer are always one shade darker than the near-side limbs, so left and right steps are distinguishable.
PALETTE ONLY: outline #2B2233; skin #E3B48E #C88E68 #A0664A; hair #7A4E30 #553420; cloth #F0E6CC #C8C2B8; cord and boots #8E5E38; trousers #27978D #00766D.

TEMPLATE (input image 1 = docs/art/templates/chr_elder.grid.png, the layout template of sheet chr_walk12 (temporary identical chr_elder grid)): input image 1 is NOT art to copy; it fixes the canvas, the cells and the size of every drawing.
- Output exactly one image of exactly 1536 x 1024 pixels, the same canvas as input image 1. Keep every cell exactly where it is in input image 1.
- Draw on a hard art-pixel grid: every art pixel is exactly 5 x 5 image pixels, every block the same size, straight square steps, no half blocks, no anti-aliasing, no blur.
- If input image 1 shows placeholder figures: repaint each placeholder figure in place with the pose asked for below, at the same height, with its lowest pixel exactly on the placeholder's lowest pixel row (the ground line) and on the same horizontal centre. The placeholder gives size and position only: do not copy its colours, clothes, pose or identity.
- If input image 1 is an empty grid: the cyan ticks in the margins mark the cell borders, each column's centre and, on the left and right, the row just below each row's lowest pixel (the ground line). Use them only to place the drawings.
- Nothing outside the cells. Remove every cyan #00FFFF tick: the output has no cyan pixel at all.
- Everything that is not a drawing is one flat #FF00FF, the exact same value in every pixel, including the margins and the empty cells. The image is fully opaque: no transparency, no semi-transparent pixels.
- No text, letters, numbers, labels, grid lines, cell borders or tick marks in the output.

NUMBERS - template chr_walk12 (computed by art:template for rows walk,walk; same geometry as chr_elder). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 2 rows of cells, each 48 x 48 art px = 240 x 240 px. Grid top-left x 48, y 272; grid 1440 x 480 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 272 + (row-1) x 240. Nothing outside the grid.
- Cells used: 12, no empty cell.
- Row 1 walk (6 frames): lowest figure pixels on image rows y 487-491 (ground line y 492); height 40 art px = 200 px.
- Row 2 walk (6 frames): lowest figure pixels on image rows y 727-731 (ground line y 732); height 40 art px = 200 px.
- Horizontal centre (the figure's middle column): column 1 x 163-167, column 2 x 403-407, column 3 x 643-647, column 4 x 883-887, column 5 x 1123-1127, column 6 x 1363-1367.
- INTERIM: chr_walk12 is not in specs.json yet. Attach docs/art/templates/chr_elder.grid.png (the same grid, byte for byte) and gate with --spec chr_elder --rows walk:6,walk:6.

LAYOUT: exactly 12 sprites in exactly 6 equal columns and 2 equal rows of identical square cells, evenly spaced, reading order left to right then next row. All twelve cells are used; there are no empty cells.
One pose per cell. Every sprite is entirely inside its own cell with clear empty margins; nothing crosses into a neighbouring cell. Same drawing scale in every cell. Every figure's lowest point (feet, or hips when seated, or body when lying) sits on the SAME local ground line in its cell, exactly where the NUMBERS block puts it; no ground line is drawn. The body's horizontal center is on the centre column the NUMBERS block gives, in every cell, unless the pose itself moves it.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the sprites, the exact same value in every pixel (preferred over transparency: transparent outputs came back with halos and dark fringes). Never a brown, dark or coloured backdrop, never a vignette, spotlight, halo, glow ring, gradient or drawn checkerboard.

Input image 2 role: this is the exact character to draw. Copy its head shape, hair silhouette, eye size, face proportions, clothing and pixel density exactly; its trousers are drawn teal #27978D #00766D as stated above, not grey. Do not copy its poses or its layout. No strap, no pouch, no bag, nothing on the back.

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

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/01-ref-a-walk12-48.png" "--spec" "chr_elder" "--rows" "walk:6,walk:6"

assets/_imagegen/v05/01-ref-a-walk12-48.png
FAIL chr_elder · canvas · 이미지 1536×1024 (틀 1536×1024) · S 5 (template) · 시트 블록 5.1 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   walk 1              29473    -3  -6.4  55.2(40)       5.0   0.0%  ✗ bbox,ground,center,height
  (1,0)   walk 2              28835    -3  -3.4  55.2(40)       5.0   0.0%  ✗ bbox,ground,center,height
  (2,0)   walk 3              27606    -3  -1.4  55.2(40)       5.0   0.0%  ✗ bbox,ground,height
  (3,0)   walk 4              27856    -3   0.6  55.4(40)       5.1   0.0%  ✗ bbox,ground,height
  (4,0)   walk 5              28796    -3   2.8  55.2(40)       5.0   0.0%  ✗ bbox,ground,center,height
  (5,0)   walk 6              28839    -3   5.2  55.4(40)       5.0   0.0%  ✗ bbox,ground,center,height
  (0,1)   walk 1              29241    19  -6.6  55.4(40)       5.1   0.0%  ✗ bbox,ground,center,height
  (1,1)   walk 2              29014    19  -4.2  55.4(40)       5.1   0.0%  ✗ bbox,ground,center,height
  (2,1)   walk 3              27519    19  -1.8  55.4(40)       5.1   0.0%  ✗ bbox,ground,height
  (3,1)   walk 4              27632    19   0.0  55.4(40)       5.1   0.0%  ✗ bbox,ground,height
  (4,1)   walk 5              28888    19   3.0  55.2(40)       5.1   0.0%  ✗ bbox,ground,center,height
  (5,1)   walk 6              28766    19   5.4  55.2(40)       5.0   0.0%  ✗ bbox,ground,center,height

Regeneration feedback:
Regenerate this sheet on the chr_elder template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "walk 1": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (0,0) "walk 1": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,0) "walk 1": the figure's horizontal center is 6.4 blocks left of the center mark; move it 6.4 blocks right.
- Cell (0,0) "walk 1": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (1,0) "walk 2": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (1,0) "walk 2": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,0) "walk 2": the figure's horizontal center is 3.4 blocks left of the center mark; move it 3.4 blocks right.
- Cell (1,0) "walk 2": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (2,0) "walk 3": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (2,0) "walk 3": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (3,0) "walk 4": the drawing crosses the cell boundary on the top by 15.2 blocks. Keep every pixel inside its own cell.
- Cell (3,0) "walk 4": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (3,0) "walk 4": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (4,0) "walk 5": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (4,0) "walk 5": the figure's horizontal center is 2.8 blocks right of the center mark; move it 2.8 blocks left.
- Cell (4,0) "walk 5": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (5,0) "walk 6": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (5,0) "walk 6": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (5,0) "walk 6": the figure's horizontal center is 5.2 blocks right of the center mark; move it 5.2 blocks left.
- Cell (5,0) "walk 6": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,1) "walk 1": the drawing crosses the cell boundary on the bottom by 14.6 blocks. Keep every pixel inside its own cell.
- Cell (0,1) "walk 1": the lowest pixel is 19 blocks below the ground line; move the figure up 19 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,1) "walk 1": the figure's horizontal center is 6.6 blocks left of the center mark; move it 6.6 blocks right.
- Cell (0,1) "walk 1": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (1,1) "walk 2": the drawing crosses the cell boundary on the bottom by 14.6 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "walk 2": the lowest pixel is 19 blocks below the ground line; move the figure up 19 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,1) "walk 2": the figure's horizontal center is 4.2 blocks left of the center mark; move it 4.2 blocks right.
- Cell (1,1) "walk 2": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- ...and 14 more problems of the same kinds.
 ELIFECYCLE  Command failed with exit code 1.
```

</details>

### V05-05 · 2차 · 01-ref-a-walk12-48-r2

[PNG](01-ref-a-walk12-48-r2.png) · [프롬프트 전문](01-ref-a-walk12-48-r2.prompt.txt) · [gate 출력 전문](01-ref-a-walk12-48-r2.gate.txt)

입력 순서:

1. `E:/AI_work/Tap_rpg/docs/art/templates/chr_elder.grid.png`
2. `E:/AI_work/Tap_rpg/assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`

시도 횟수: 2 · gate 종료 코드: 1 · 틀 모드.

육안 및 남은 차이: 1536×1024 RGB. 키 48.8블록으로 줄었지만 기준 40에 미달, 1행 지면 -11·2행 +17블록. 12칸 모두 경계·지면·키 실패, 일부 중심·블록 크기도 실패. 같은 지적이 두 번째 반복됐다.

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Asset type: Tap RPG small 2D pixel-art game sprite sheet. This is a real sprite art request, not a UI, diagram, poster or pixel-art-themed illustration.
PIXEL LANGUAGE: every figure must look designed on a genuine logical 48x48 pixel canvas and then shown with large, uniform, perfectly square pixel blocks. Crisp hard square pixel clusters and deliberate one-block stair-steps. Strong readable silhouette with very restrained internal detail. Outer contour exactly one pixel-block thick in dark plum #2B2233 (characters, enemies, weapons and props only; backgrounds follow their own rule in §3.5). Flat color fills in large coherent clusters.
Absolutely no blur, anti-aliasing, smooth vector curves, gradients, soft lighting, glow, painterly strokes, noisy dithering, fur or hair texture, glossy or 3D rendering, photographic detail.

SUBJECT AND IDENTITY: one and the same youthful androgynous human adventurer in every cell, chibi proportions about 2.2 heads tall (the head is close to half of the body height). Facing RIGHT in a slight three-quarter side view, never front-facing. Short chestnut hair (HR01) with two flat browns, medium warm skin, round dark eyes, tiny mouth. Cream quilted short tunic with elbow-length sleeves, thin brown waist cord, two or three small square repair patches, muted teal canvas work trousers, brown boots. Keep every hair lock, facial feature, garment detail, body proportion and limb thickness identical across all cells. Expressive and charming, not a stiff stick figure.
FAR-SIDE LIMBS: the arm and leg farther from the viewer are always one shade darker than the near-side limbs, so left and right steps are distinguishable.
PALETTE ONLY: outline #2B2233; skin #E3B48E #C88E68 #A0664A; hair #7A4E30 #553420; cloth #F0E6CC #C8C2B8; cord and boots #8E5E38; trousers #27978D #00766D.

TEMPLATE (input image 1 = docs/art/templates/chr_elder.grid.png, the layout template of sheet chr_walk12 (temporary identical chr_elder grid)): input image 1 is NOT art to copy; it fixes the canvas, the cells and the size of every drawing.
- Output exactly one image of exactly 1536 x 1024 pixels, the same canvas as input image 1. Keep every cell exactly where it is in input image 1.
- Draw on a hard art-pixel grid: every art pixel is exactly 5 x 5 image pixels, every block the same size, straight square steps, no half blocks, no anti-aliasing, no blur.
- If input image 1 shows placeholder figures: repaint each placeholder figure in place with the pose asked for below, at the same height, with its lowest pixel exactly on the placeholder's lowest pixel row (the ground line) and on the same horizontal centre. The placeholder gives size and position only: do not copy its colours, clothes, pose or identity.
- If input image 1 is an empty grid: the cyan ticks in the margins mark the cell borders, each column's centre and, on the left and right, the row just below each row's lowest pixel (the ground line). Use them only to place the drawings.
- Nothing outside the cells. Remove every cyan #00FFFF tick: the output has no cyan pixel at all.
- Everything that is not a drawing is one flat #FF00FF, the exact same value in every pixel, including the margins and the empty cells. The image is fully opaque: no transparency, no semi-transparent pixels.
- No text, letters, numbers, labels, grid lines, cell borders or tick marks in the output.

NUMBERS - template chr_walk12 (computed by art:template for rows walk,walk; same geometry as chr_elder). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 2 rows of cells, each 48 x 48 art px = 240 x 240 px. Grid top-left x 48, y 272; grid 1440 x 480 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 272 + (row-1) x 240. Nothing outside the grid.
- Cells used: 12, no empty cell.
- Row 1 walk (6 frames): lowest figure pixels on image rows y 487-491 (ground line y 492); height 40 art px = 200 px.
- Row 2 walk (6 frames): lowest figure pixels on image rows y 727-731 (ground line y 732); height 40 art px = 200 px.
- Horizontal centre (the figure's middle column): column 1 x 163-167, column 2 x 403-407, column 3 x 643-647, column 4 x 883-887, column 5 x 1123-1127, column 6 x 1363-1367.
- INTERIM: chr_walk12 is not in specs.json yet. Attach docs/art/templates/chr_elder.grid.png (the same grid, byte for byte) and gate with --spec chr_elder --rows walk:6,walk:6.

LAYOUT: exactly 12 sprites in exactly 6 equal columns and 2 equal rows of identical square cells, evenly spaced, reading order left to right then next row. All twelve cells are used; there are no empty cells.
One pose per cell. Every sprite is entirely inside its own cell with clear empty margins; nothing crosses into a neighbouring cell. Same drawing scale in every cell. Every figure's lowest point (feet, or hips when seated, or body when lying) sits on the SAME local ground line in its cell, exactly where the NUMBERS block puts it; no ground line is drawn. The body's horizontal center is on the centre column the NUMBERS block gives, in every cell, unless the pose itself moves it.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the sprites, the exact same value in every pixel (preferred over transparency: transparent outputs came back with halos and dark fringes). Never a brown, dark or coloured backdrop, never a vignette, spotlight, halo, glow ring, gradient or drawn checkerboard.

Input image 2 role: this is the exact character to draw. Copy its head shape, hair silhouette, eye size, face proportions, clothing and pixel density exactly; its trousers are drawn teal #27978D #00766D as stated above, not grey. Do not copy its poses or its layout. No strap, no pouch, no bag, nothing on the back.

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

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.

PREVIOUS ATTEMPT FAILED THE SIZE CHECK. Keep everything that was right and fix exactly these problems:
Regenerate this sheet on the chr_elder template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "walk 1": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (0,0) "walk 1": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,0) "walk 1": the figure's horizontal center is 6.4 blocks left of the center mark; move it 6.4 blocks right.
- Cell (0,0) "walk 1": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (1,0) "walk 2": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (1,0) "walk 2": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,0) "walk 2": the figure's horizontal center is 3.4 blocks left of the center mark; move it 3.4 blocks right.
- Cell (1,0) "walk 2": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (2,0) "walk 3": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (2,0) "walk 3": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (3,0) "walk 4": the drawing crosses the cell boundary on the top by 15.2 blocks. Keep every pixel inside its own cell.
- Cell (3,0) "walk 4": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (3,0) "walk 4": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (4,0) "walk 5": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (4,0) "walk 5": the figure's horizontal center is 2.8 blocks right of the center mark; move it 2.8 blocks left.
- Cell (4,0) "walk 5": the figure is 55.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (5,0) "walk 6": the drawing crosses the cell boundary on the top by 15 blocks. Keep every pixel inside its own cell.
- Cell (5,0) "walk 6": the lowest pixel is 3 blocks above the ground line; move the figure down 3 blocks so the lowest pixel sits directly on the ground line.
- Cell (5,0) "walk 6": the figure's horizontal center is 5.2 blocks right of the center mark; move it 5.2 blocks left.
- Cell (5,0) "walk 6": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,1) "walk 1": the drawing crosses the cell boundary on the bottom by 14.6 blocks. Keep every pixel inside its own cell.
- Cell (0,1) "walk 1": the lowest pixel is 19 blocks below the ground line; move the figure up 19 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,1) "walk 1": the figure's horizontal center is 6.6 blocks left of the center mark; move it 6.6 blocks right.
- Cell (0,1) "walk 1": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (1,1) "walk 2": the drawing crosses the cell boundary on the bottom by 14.6 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "walk 2": the lowest pixel is 19 blocks below the ground line; move the figure up 19 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,1) "walk 2": the figure's horizontal center is 4.2 blocks left of the center mark; move it 4.2 blocks right.
- Cell (1,1) "walk 2": the figure is 55.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- ...and 14 more problems of the same kinds.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/01-ref-a-walk12-48-r2.png" "--spec" "chr_elder" "--rows" "walk:6,walk:6"

assets/_imagegen/v05/01-ref-a-walk12-48-r2.png
FAIL chr_elder · canvas · 이미지 1536×1024 (틀 1536×1024) · S 5 (template) · 시트 블록 4.3 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   walk 1              23219   -11  -7.6  48.8(40)       4.3   0.0%  ✗ bbox,ground,center,height
  (1,0)   walk 2              22735   -11  -4.6  48.8(40)       4.3   0.0%  ✗ bbox,ground,center,height
  (2,0)   walk 3              21818   -11  -1.4  48.8(40)       4.2   0.0%  ✗ bbox,ground,height,block
  (3,0)   walk 4              20593   -11  -1.2  48.8(40)       4.3   0.0%  ✗ bbox,ground,height
  (4,0)   walk 5              22324   -11   0.4  48.8(40)       4.2   0.0%  ✗ bbox,ground,height,block
  (5,0)   walk 6              21827   -11   2.4  48.8(40)       4.3   0.0%  ✗ bbox,ground,center,height
  (0,1)   walk 1              22757    17  -7.4  48.8(40)       4.2   0.0%  ✗ bbox,ground,center,height,block
  (1,1)   walk 2              22797    17  -4.6  48.8(40)       4.3   0.0%  ✗ bbox,ground,center,height
  (2,1)   walk 3              21734    17  -1.6  48.8(40)       4.3   0.0%  ✗ bbox,ground,height
  (3,1)   walk 4              20585    17  -1.2  48.8(40)       4.2   0.0%  ✗ bbox,ground,height,block
  (4,1)   walk 5              22898    17   0.4  48.8(40)       4.3   0.0%  ✗ bbox,ground,height
  (5,1)   walk 6              21434    17   2.6  48.8(40)       4.3   0.0%  ✗ bbox,ground,center,height

Regeneration feedback:
Regenerate this sheet on the chr_elder template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "walk 1": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (0,0) "walk 1": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,0) "walk 1": the figure's horizontal center is 7.6 blocks left of the center mark; move it 7.6 blocks right.
- Cell (0,0) "walk 1": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (1,0) "walk 2": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (1,0) "walk 2": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,0) "walk 2": the figure's horizontal center is 4.6 blocks left of the center mark; move it 4.6 blocks right.
- Cell (1,0) "walk 2": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (2,0) "walk 3": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (2,0) "walk 3": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (3,0) "walk 4": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (3,0) "walk 4": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (3,0) "walk 4": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (4,0) "walk 5": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (4,0) "walk 5": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (5,0) "walk 6": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (5,0) "walk 6": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (5,0) "walk 6": the figure's horizontal center is 2.4 blocks right of the center mark; move it 2.4 blocks left.
- Cell (5,0) "walk 6": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,1) "walk 1": the drawing crosses the cell boundary on the bottom by 12.8 blocks. Keep every pixel inside its own cell.
- Cell (0,1) "walk 1": the lowest pixel is 17 blocks below the ground line; move the figure up 17 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,1) "walk 1": the figure's horizontal center is 7.4 blocks left of the center mark; move it 7.4 blocks right.
- Cell (0,1) "walk 1": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,1) "walk 1": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (1,1) "walk 2": the drawing crosses the cell boundary on the bottom by 12.8 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "walk 2": the lowest pixel is 17 blocks below the ground line; move the figure up 17 blocks so the lowest pixel sits directly on the ground line.
- ...and 16 more problems of the same kinds.
 ELIFECYCLE  Command failed with exit code 1.
```

</details>

### V05-05 · 3차 · 01-ref-a-walk12-48-r3

[PNG](01-ref-a-walk12-48-r3.png) · [프롬프트 전문](01-ref-a-walk12-48-r3.prompt.txt) · [gate 출력 전문](01-ref-a-walk12-48-r3.gate.txt)

입력 순서:

1. `E:/AI_work/Tap_rpg/docs/art/templates/chr_elder.grid.png`
2. `E:/AI_work/Tap_rpg/assets/_imagegen/v03/02-ref-b-actions18-48-r4.png`

시도 횟수: 3 · gate 종료 코드: 1 · 틀 모드.

육안 및 남은 차이: 1536×1024 RGB. 키 46.4~47.6블록으로 개선됐지만 기준 40±8%를 벗어났다. 1행 지면 -7·2행 +11블록, 모든 칸 경계·지면·키 실패. 일부 블록 크기 실패. 두 행의 팔다리 교대도 여전히 명확하지 않다. 세 번째 gate 실패이므로 요청서 §0에 따라 여기서 생성 중단.

<details>
<summary>보낸 프롬프트 전문</summary>

```text
Asset type: Tap RPG small 2D pixel-art game sprite sheet. This is a real sprite art request, not a UI, diagram, poster or pixel-art-themed illustration.
PIXEL LANGUAGE: every figure must look designed on a genuine logical 48x48 pixel canvas and then shown with large, uniform, perfectly square pixel blocks. Crisp hard square pixel clusters and deliberate one-block stair-steps. Strong readable silhouette with very restrained internal detail. Outer contour exactly one pixel-block thick in dark plum #2B2233 (characters, enemies, weapons and props only; backgrounds follow their own rule in §3.5). Flat color fills in large coherent clusters.
Absolutely no blur, anti-aliasing, smooth vector curves, gradients, soft lighting, glow, painterly strokes, noisy dithering, fur or hair texture, glossy or 3D rendering, photographic detail.

SUBJECT AND IDENTITY: one and the same youthful androgynous human adventurer in every cell, chibi proportions about 2.2 heads tall (the head is close to half of the body height). Facing RIGHT in a slight three-quarter side view, never front-facing. Short chestnut hair (HR01) with two flat browns, medium warm skin, round dark eyes, tiny mouth. Cream quilted short tunic with elbow-length sleeves, thin brown waist cord, two or three small square repair patches, muted teal canvas work trousers, brown boots. Keep every hair lock, facial feature, garment detail, body proportion and limb thickness identical across all cells. Expressive and charming, not a stiff stick figure.
FAR-SIDE LIMBS: the arm and leg farther from the viewer are always one shade darker than the near-side limbs, so left and right steps are distinguishable.
PALETTE ONLY: outline #2B2233; skin #E3B48E #C88E68 #A0664A; hair #7A4E30 #553420; cloth #F0E6CC #C8C2B8; cord and boots #8E5E38; trousers #27978D #00766D.

TEMPLATE (input image 1 = docs/art/templates/chr_elder.grid.png, the layout template of sheet chr_walk12 (temporary identical chr_elder grid)): input image 1 is NOT art to copy; it fixes the canvas, the cells and the size of every drawing.
- Output exactly one image of exactly 1536 x 1024 pixels, the same canvas as input image 1. Keep every cell exactly where it is in input image 1.
- Draw on a hard art-pixel grid: every art pixel is exactly 5 x 5 image pixels, every block the same size, straight square steps, no half blocks, no anti-aliasing, no blur.
- If input image 1 shows placeholder figures: repaint each placeholder figure in place with the pose asked for below, at the same height, with its lowest pixel exactly on the placeholder's lowest pixel row (the ground line) and on the same horizontal centre. The placeholder gives size and position only: do not copy its colours, clothes, pose or identity.
- If input image 1 is an empty grid: the cyan ticks in the margins mark the cell borders, each column's centre and, on the left and right, the row just below each row's lowest pixel (the ground line). Use them only to place the drawings.
- Nothing outside the cells. Remove every cyan #00FFFF tick: the output has no cyan pixel at all.
- Everything that is not a drawing is one flat #FF00FF, the exact same value in every pixel, including the margins and the empty cells. The image is fully opaque: no transparency, no semi-transparent pixels.
- No text, letters, numbers, labels, grid lines, cell borders or tick marks in the output.

NUMBERS - template chr_walk12 (computed by art:template for rows walk,walk; same geometry as chr_elder). Numbers are image pixels of the output unless they say art px.
- Canvas: exactly 1536 x 1024 px (landscape).
- Block: S = 5. One art pixel = one 5 x 5 square of identical image pixels; every block exactly the same size, hard edges, no half blocks.
- Grid: 6 columns x 2 rows of cells, each 48 x 48 art px = 240 x 240 px. Grid top-left x 48, y 272; grid 1440 x 480 px. Cell (column,row), counted from (1,1) at the top-left, starts at x = 48 + (column-1) x 240, y = 272 + (row-1) x 240. Nothing outside the grid.
- Cells used: 12, no empty cell.
- Row 1 walk (6 frames): lowest figure pixels on image rows y 487-491 (ground line y 492); height 40 art px = 200 px.
- Row 2 walk (6 frames): lowest figure pixels on image rows y 727-731 (ground line y 732); height 40 art px = 200 px.
- Horizontal centre (the figure's middle column): column 1 x 163-167, column 2 x 403-407, column 3 x 643-647, column 4 x 883-887, column 5 x 1123-1127, column 6 x 1363-1367.
- INTERIM: chr_walk12 is not in specs.json yet. Attach docs/art/templates/chr_elder.grid.png (the same grid, byte for byte) and gate with --spec chr_elder --rows walk:6,walk:6.

LAYOUT: exactly 12 sprites in exactly 6 equal columns and 2 equal rows of identical square cells, evenly spaced, reading order left to right then next row. All twelve cells are used; there are no empty cells.
One pose per cell. Every sprite is entirely inside its own cell with clear empty margins; nothing crosses into a neighbouring cell. Same drawing scale in every cell. Every figure's lowest point (feet, or hips when seated, or body when lying) sits on the SAME local ground line in its cell, exactly where the NUMBERS block puts it; no ground line is drawn. The body's horizontal center is on the centre column the NUMBERS block gives, in every cell, unless the pose itself moves it.
BACKGROUND: one single flat #FF00FF magenta color everywhere outside the sprites, the exact same value in every pixel (preferred over transparency: transparent outputs came back with halos and dark fringes). Never a brown, dark or coloured backdrop, never a vignette, spotlight, halo, glow ring, gradient or drawn checkerboard.

Input image 2 role: this is the exact character to draw. Copy its head shape, hair silhouette, eye size, face proportions, clothing and pixel density exactly; its trousers are drawn teal #27978D #00766D as stated above, not grey. Do not copy its poses or its layout. No strap, no pouch, no bag, nothing on the back.

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

Do NOT draw: text, letters, numbers, labels, frame numbers, arrows, grid lines, cell borders, panel frames, watermark, ground shadow, landscape or scenery, blood, wounds, corpses, magic effects, motion trails, speech bubbles, extra characters, duplicate items. Output only the finished sprite sheet.

PREVIOUS ATTEMPT FAILED THE SIZE CHECK. Keep everything that was right and fix exactly these problems:
Regenerate this sheet on the chr_elder template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "walk 1": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (0,0) "walk 1": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,0) "walk 1": the figure's horizontal center is 7.6 blocks left of the center mark; move it 7.6 blocks right.
- Cell (0,0) "walk 1": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (1,0) "walk 2": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (1,0) "walk 2": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,0) "walk 2": the figure's horizontal center is 4.6 blocks left of the center mark; move it 4.6 blocks right.
- Cell (1,0) "walk 2": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (2,0) "walk 3": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (2,0) "walk 3": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (3,0) "walk 4": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (3,0) "walk 4": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (3,0) "walk 4": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (4,0) "walk 5": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (4,0) "walk 5": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (5,0) "walk 6": the drawing crosses the cell boundary on the top by 16.6 blocks. Keep every pixel inside its own cell.
- Cell (5,0) "walk 6": the lowest pixel is 11 blocks above the ground line; move the figure down 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (5,0) "walk 6": the figure's horizontal center is 2.4 blocks right of the center mark; move it 2.4 blocks left.
- Cell (5,0) "walk 6": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,1) "walk 1": the drawing crosses the cell boundary on the bottom by 12.8 blocks. Keep every pixel inside its own cell.
- Cell (0,1) "walk 1": the lowest pixel is 17 blocks below the ground line; move the figure up 17 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,1) "walk 1": the figure's horizontal center is 7.4 blocks left of the center mark; move it 7.4 blocks right.
- Cell (0,1) "walk 1": the figure is 48.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,1) "walk 1": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (1,1) "walk 2": the drawing crosses the cell boundary on the bottom by 12.8 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "walk 2": the lowest pixel is 17 blocks below the ground line; move the figure up 17 blocks so the lowest pixel sits directly on the ground line.
- ...and 16 more problems of the same kinds.
```

</details>

<details>
<summary>art:gate 출력 전문</summary>

```text
> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v05/01-ref-a-walk12-48-r3.png" "--spec" "chr_elder" "--rows" "walk:6,walk:6"

assets/_imagegen/v05/01-ref-a-walk12-48-r3.png
FAIL chr_elder · canvas · 이미지 1536×1024 (틀 1536×1024) · S 5 (template) · 시트 블록 4.4 · 배경 100.0% · 안내색 0 · 격자 밖 0
  칸      동작              화소     바닥Δ 중심Δ  키(기준)      블록  반투명  판정
  (0,0)   walk 1              21524    -7  -2.0  46.4(40)       4.2   0.0%  ✗ bbox,ground,height,block
  (1,0)   walk 2              20983    -7  -0.6  46.6(40)       4.3   0.0%  ✗ bbox,ground,height
  (2,0)   walk 3              20141    -7  -0.2  46.8(40)       4.2   0.0%  ✗ bbox,ground,height,block
  (3,0)   walk 4              18808    -7   0.0  46.6(40)       4.4   0.0%  ✗ bbox,ground,height
  (4,0)   walk 5              20820    -7   0.8  46.6(40)       4.1   0.0%  ✗ bbox,ground,height,block
  (5,0)   walk 6              20826    -7   1.6  46.6(40)       4.3   0.0%  ✗ bbox,ground,height
  (0,1)   walk 1              21423    11  -2.0  47.6(40)       4.5   0.0%  ✗ bbox,ground,height
  (1,1)   walk 2              21519    11  -0.8  47.2(40)       4.6   0.0%  ✗ bbox,ground,height
  (2,1)   walk 3              20257    11  -0.2  47.4(40)       4.4   0.0%  ✗ bbox,ground,height
  (3,1)   walk 4              18575    11  -0.2  47.6(40)       4.2   0.0%  ✗ bbox,ground,height,block
  (4,1)   walk 5              21333    11   0.8  47.4(40)       4.4   0.0%  ✗ bbox,ground,height
  (5,1)   walk 6              21182    11   1.6  47.4(40)       4.5   0.0%  ✗ bbox,ground,height

Regeneration feedback:
Regenerate this sheet on the chr_elder template (one art pixel = 5x5 image pixels; cells are numbered (column,row) from 0 at the top-left). Fix exactly these problems and change nothing else:
- Cell (0,0) "walk 1": the drawing crosses the cell boundary on the top by 9.8 blocks. Keep every pixel inside its own cell.
- Cell (0,0) "walk 1": the lowest pixel is 7 blocks above the ground line; move the figure down 7 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,0) "walk 1": the figure is 46.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,0) "walk 1": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (1,0) "walk 2": the drawing crosses the cell boundary on the top by 9.8 blocks. Keep every pixel inside its own cell.
- Cell (1,0) "walk 2": the lowest pixel is 7 blocks above the ground line; move the figure down 7 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,0) "walk 2": the figure is 46.6 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the drawing crosses the cell boundary on the top by 9.8 blocks. Keep every pixel inside its own cell.
- Cell (2,0) "walk 3": the lowest pixel is 7 blocks above the ground line; move the figure down 7 blocks so the lowest pixel sits directly on the ground line.
- Cell (2,0) "walk 3": the figure is 46.8 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,0) "walk 3": the art pixels are about 4.2 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (3,0) "walk 4": the drawing crosses the cell boundary on the top by 9.8 blocks. Keep every pixel inside its own cell.
- Cell (3,0) "walk 4": the lowest pixel is 7 blocks above the ground line; move the figure down 7 blocks so the lowest pixel sits directly on the ground line.
- Cell (3,0) "walk 4": the figure is 46.6 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the drawing crosses the cell boundary on the top by 9.8 blocks. Keep every pixel inside its own cell.
- Cell (4,0) "walk 5": the lowest pixel is 7 blocks above the ground line; move the figure down 7 blocks so the lowest pixel sits directly on the ground line.
- Cell (4,0) "walk 5": the figure is 46.6 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (4,0) "walk 5": the art pixels are about 4.1 image pixels wide, but every art pixel must be a 5x5 block. Redraw on the 5-pixel grid; do not rescale or blur.
- Cell (5,0) "walk 6": the drawing crosses the cell boundary on the top by 9.8 blocks. Keep every pixel inside its own cell.
- Cell (5,0) "walk 6": the lowest pixel is 7 blocks above the ground line; move the figure down 7 blocks so the lowest pixel sits directly on the ground line.
- Cell (5,0) "walk 6": the figure is 46.6 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (0,1) "walk 1": the drawing crosses the cell boundary on the bottom by 6.6 blocks. Keep every pixel inside its own cell.
- Cell (0,1) "walk 1": the lowest pixel is 11 blocks below the ground line; move the figure up 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (0,1) "walk 1": the figure is 47.6 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (1,1) "walk 2": the drawing crosses the cell boundary on the bottom by 6.4 blocks. Keep every pixel inside its own cell.
- Cell (1,1) "walk 2": the lowest pixel is 11 blocks below the ground line; move the figure up 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (1,1) "walk 2": the figure is 47.2 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- Cell (2,1) "walk 3": the drawing crosses the cell boundary on the bottom by 6.6 blocks. Keep every pixel inside its own cell.
- Cell (2,1) "walk 3": the lowest pixel is 11 blocks below the ground line; move the figure up 11 blocks so the lowest pixel sits directly on the ground line.
- Cell (2,1) "walk 3": the figure is 47.4 blocks tall but must be 40 blocks tall (±8%); draw it smaller to match the reference figure, keeping one art pixel = one 5x5 block.
- ...and 10 more problems of the same kinds.
 ELIFECYCLE  Command failed with exit code 1.
```

</details>
