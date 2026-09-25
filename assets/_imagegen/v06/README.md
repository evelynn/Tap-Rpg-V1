# V06 이미지 생성 결과

## 배치 1 · 2026-09-25 · RGB 보강 및 불합격 삭제/재생성 보고

배치 1의 14개 산출물 작업을 모두 시도했다. 기존 시도 포함 총 25회 생성했으며 **PNG 11장 보관, 육안 불합격 PNG 14개를 결과 폴더에서 삭제**했다. **완전 합격 14장 달성은 아님**: L7 표정, REF-E 머리카락, H1 이음 3개 작업은 아래 중지 규칙에 걸렸다. 보관한 11장은 게임 측 최종 겹침·팔레트·재생 검수를 위한 인계본이다.

- 최신 사용자 지시를 적용: 색상을 RGB 수치로 명시하고, 편집 시 합격 입력의 색을 유지하도록 지시했다. 이어진 「불합격시 지우고 재생성」에 따라 육안 불합격도 삭제/재생성했다. WARN만을 이유로 재생성한 항목은 없다.
- 요청서 §0.4의 2026-09-25 개정판 적용: 과거 띠 예외 ㄱ·ㄴ은 폐지됨. 띠 위치·크기·잘림 경고를 그대로 기록했다.
- 쉘에서 실행한 명령은 `pnpm art:gate`뿐이다. 생성/편집은 ImageGen만 사용했다. PNG는 원본 복사만 했으며 화소 수정·정규화·코드 그림 생성은 하지 않았다. 저장소 코드·문서·tools/art-check·assets/game은 수정하지 않았다.
- `.prompt.txt`는 실제 전송 전문과 일치한다. `.gate.txt`는 검사 대상 항목의 명령+출력 전문이다. 문 없는 가림막에는 요청서 §0.6에 따라 gate 파일을 만들지 않았다.
- 최종 파일 대조: 보관 PNG 11장의 SHA-256이 생성기 원본과 모두 같다. 삭제 대상 14개는 이 폴더에 없다. 모든 편집 결과 해상도는 입력과 같았다.
- [V06_REQUEST.md](../../../docs/art/V06_REQUEST.md) §0.5·§3의 **배치 1 「여기까지 하고 보고」** 경계에서 멈춘다. 배치 2 이후는 생성하지 않았다.

| id | 파일(마지막 시도) | 시도 | 문 | 예외 | 육안 | 인계 |
| --- | --- | ---: | --- | --- | --- | --- |
| V06-01 | l7-expression12-48-r3.png — 삭제 | 3/3 | PASS · 경고 1 | 없음 | 불합격 | 멈춤 |
| V06-02 | [01-ref-a-walk12-48-r3-body.png](01-ref-a-walk12-48-r3-body.png) | 1/3 | PASS · 경고 27 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-02 | [02-ref-b-actions18-48-teal-body.png](02-ref-b-actions18-48-teal-body.png) | 1/3 | PASS · 경고 9 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-02 | [c01-ref-d-hit-discover-interact11-48-teal-body.png](c01-ref-d-hit-discover-interact11-48-teal-body.png) | 1/3 | PASS · 경고 3 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-02 | [c02-ref-e-cheer-collapse9-48-teal-body.png](c02-ref-e-cheer-collapse9-48-teal-body.png) | 1/3 | PASS · 경고 2 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-03 | [01-ref-a-walk12-48-r3-hair-mask.png](01-ref-a-walk12-48-r3-hair-mask.png) | 1/3 | 해당 없음 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-03 | [c01-ref-d-hit-discover-interact11-48-teal-hair-mask.png](c01-ref-d-hit-discover-interact11-48-teal-hair-mask.png) | 1/3 | 해당 없음 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-03 | c02-ref-e-cheer-collapse9-48-teal-hair-mask-r3.png — 삭제 | 3/3 | 해당 없음 | 없음 | 불합격 | 멈춤 |
| V06-04 | [01-ref-a-walk12-48-r3-face-mask-r2.png](01-ref-a-walk12-48-r3-face-mask-r2.png) | 2/3 | 해당 없음 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-04 | [02-ref-b-actions18-48-teal-face-mask-r3.png](02-ref-b-actions18-48-teal-face-mask-r3.png) | 3/3 | 해당 없음 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-04 | [c01-ref-d-hit-discover-interact11-48-teal-face-mask-r2.png](c01-ref-d-hit-discover-interact11-48-teal-face-mask-r2.png) | 2/3 | 해당 없음 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-04 | [c02-ref-e-cheer-collapse9-48-teal-face-mask.png](c02-ref-e-cheer-collapse9-48-teal-face-mask.png) | 1/3 | 해당 없음 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-05 | [es01-stranger-campfire-48-r3.png](es01-stranger-campfire-48-r3.png) | 3/3 | PASS · 경고 4 | 없음 | 합격(육안 범위) | 검수용 인계 |
| V06-06 | w10-h1-river-meadow-summer-day-seam-r2.png — 삭제 | 2/3 | PASS · 경고 4 | 없음 | 불합격 | 멈춤 |

### 중지된 작업과 다음 단계 영향

1. **V06-01 L7 표정**: 3차에서 가는 눈 놀람은 개선됐으나 ELDER 무표정 칸에 웃는 입이 생겼다. 최대 3회 도달(§0.5.2). V06-07 홍조/L2의 게임 합격 선행 조건이 충족되지 않았다.
2. **V06-03 REF-E 머리카락**: 3차에도 누운 머리의 귀 둘레 피부색이 남았다. 최대 3회 도달(§0.5.2). 이 파일을 머리카락만의 가림막으로 인계할 수 없다.
3. **V06-06 H1 이음**: 1차는 왼쪽 수관, 2차는 오른쪽 수관이 중앙 보존 영역에서 바뀌었다. 지정 영역 밖 변경이 두 번 반복되어 중지(§0.5.2). H1 층/계절/시간대의 선행 합격본은 아직 없다.

원인 추정: ImageGen이 RGB 숫자와 정밀 편집 문장을 따르더라도 화소 단위 분리·영역 고정·미세 표정을 재해석하는 경우가 있었다. 내부 원인은 확인하지 못했다. 문 PASS는 구조 검사 결과이며 모든 육안 조건의 합격을 뜻하지 않는다.

### H1 가로 이음 검토

두 결과 모두 원본의 1983×793 크기를 유지하고 풍경 밀도는 보존했지만 W3에서 탈락했다. 1차는 양 끝 나무를 없애면서 중앙의 수관도 지웠다. 2차는 큰 나무를 다시 유지했지만 오른쪽 수관이 왼쪽으로 이동했다. 양 끝을 나란히 이어 보는 관점에서 하늘·길의 높이는 가깝지만, 수풀·원경 연결을 완전 이음으로 확정할 수 없었다. 코드로 이어 붙인 이미지는 만들지 않았다. 검사 도구의 선택 구간 이음 점수는 각각 88.5, 107.1이며 WARN 그대로 기록했다. 이 점수 때문에 재생성한 것은 아니다.

### 보관본의 검수 범위

보관본 11장 중 문 대상 5장(몸체 4장, ES01)은 모두 PASS이며, 나머지 6장(머리카락 2장, 얼굴 4장)은 문 없음이다. 원본과 나란히 육안 대조했으나 화소 겹침 차분, 정지 영역 차이 0.5%, 잔여 금지 RGB 화소 수, 전체 팔레트 검사는 수행하지 않았다. 이는 게임 쪽 검수로 남긴다. RGB 지정은 생성 지시이며 정확한 RGB 일치의 증거가 아니다. 실제 검사에서 배경 평균색 오차는 key 허용 범위 내 WARN이었다.

### V06-01 · l7-expression12-48 · 시도 1

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `docs/art/templates/chr_face.placeholder.png` / 입력 2 = `assets/_imagegen/v05/02-ref-b-actions18-48-teal.png`
- 보낸 글 전문: [l7-expression12-48.prompt.txt](l7-expression12-48.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-33f5e984-77d7-4317-afef-4f5681c0747a.png`
- SHA-256: `f32643397526b21d8db57152619f41ffb93a9ad15a92ec8052dd4dab2bac6d88`
- 문: `pnpm art:gate assets/_imagegen/v06/l7-expression12-48.png --spec chr_face` → PASS · 경고 0. 종료 코드 0. [출력 전문](l7-expression12-48.gate.txt)
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E4/E11: 검정·갈색 배경과 후광. 당시 gate PASS였으나 사용자 후속 지시로 RGB 프롬프트를 보강하여 재생성. v06 PNG 삭제.
- 남은 차이/처리: 육안 불합격 E4/E11: 검정·갈색 배경과 후광. 당시 gate PASS였으나 사용자 후속 지시로 RGB 프롬프트를 보강하여 재생성. v06 PNG 삭제.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-01 · l7-expression12-48-r2 · 시도 2

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `docs/art/templates/chr_face.placeholder.png` / 입력 2 = `assets/_imagegen/v05/02-ref-b-actions18-48-teal.png`
- 보낸 글 전문: [l7-expression12-48-r2.prompt.txt](l7-expression12-48-r2.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-7de5cbd1-d07d-46a9-8635-9d3c37a49f82.png`
- SHA-256: `205d519f76fe7e4a36eb70922a41f93573006fa70695d1d8639a699ce5e2640c`
- 문: `pnpm art:gate assets/_imagegen/v06/l7-expression12-48-r2.png --spec chr_face` → PASS · 경고 1. 종료 코드 0. [출력 전문](l7-expression12-48-r2.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Background is not exactly #FF00FF: 100% of background pixels differ (mean #FA03F9), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격: 2행 5열 가는 눈 놀람이 2×2 논리블록보다 길게 보이고 1행 둥근 눈 놀람과 유사. E1의 세부 표정 조건 불충족. 배경 WARN이 아니라 눈 크기 때문에 사용자 후속 지시에 따라 삭제/재생성.
- 남은 차이/처리: 육안 불합격: 2행 5열 가는 눈 놀람이 2×2 논리블록보다 길게 보이고 1행 둥근 눈 놀람과 유사. E1의 세부 표정 조건 불충족. 배경 WARN이 아니라 눈 크기 때문에 사용자 후속 지시에 따라 삭제/재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-02 · 01-ref-a-walk12-48-r3-body · 시도 1

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/01-ref-a-walk12-48-r3.png`
- 보낸 글 전문: [01-ref-a-walk12-48-r3-body.prompt.txt](01-ref-a-walk12-48-r3-body.prompt.txt)
- PNG: [01-ref-a-walk12-48-r3-body.png](01-ref-a-walk12-48-r3-body.png)
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-2b738a4d-ba46-4651-9211-3817cfb7fd51.png`
- SHA-256: `d46b73c2716b134091d5c90306b027a200eed2f1cabe35519f9fb5900ac82f26`
- 문: `pnpm art:gate assets/_imagegen/v06/01-ref-a-walk12-48-r3-body.png --spec chr_elder --rows "walk:6,walk:6"` → PASS · 경고 27. 종료 코드 0. [출력 전문](01-ref-a-walk12-48-r3-body.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Cell (0,0) "walk 1": crosses the template cell boundary (top 7.8 blocks).
- Cell (0,0) "walk 1": lowest pixel 7 blocks above the template ground line.
- Cell (1,0) "walk 2": crosses the template cell boundary (top 7.8 blocks).
- Cell (1,0) "walk 2": lowest pixel 7 blocks above the template ground line.
- Cell (2,0) "walk 3": crosses the template cell boundary (top 7.8 blocks).
- Cell (2,0) "walk 3": lowest pixel 7 blocks above the template ground line.
- Cell (3,0) "walk 4": crosses the template cell boundary (top 7.8 blocks).
- Cell (3,0) "walk 4": lowest pixel 7 blocks above the template ground line.
- Figures are 112.3% of the spec height; normalization resamples the sheet by x0.89 (map scale_to_spec).
- Drawn pixel blocks are 4.1-4.2 image px in 3 cells, not 5 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #FA04F9), all within the key tolerance; keying removes them.
- ...and 8 more bbox warnings of the same kind.
- ...and 8 more ground warnings of the same kind.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 민머리, 얼굴 없음, 회청 민소매, 청록 바지, 원본 걷기 배치 유지 확인. 정밀 겹침 및 잔여 색 화소 검사는 게임 쪽 검수 필요.

- E8: 원본과 나란히 보아 프레임 배치·몸 자세가 유지됨. 정확한 겹침 비교는 게임 쪽에서 확인 필요.
- E10: 머리카락·얼굴·튜닉·허리끈·손 소품이 제거되고, 요청한 민머리·회청 민소매 몸체가 드러남.
- E11: 밝은 마젠타 배경, 후광 없음. 정확한 #FF00FF 불일치는 gate WARN이며 유지.
- E21: 청록 바지와 갈색 부츠의 색조가 원본과 대체로 같음. 원본과 화소별 RGB 동일성은 별도 정량 검사하지 않음.
- 추가 색 조건: 크림 튜닉과 회색 바지 영역이 육안상 없음. 해당 RGB 잔여 화소 0개라는 정량 보증은 하지 않음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-02 · 02-ref-b-actions18-48-teal-body · 시도 1

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/02-ref-b-actions18-48-teal.png`
- 보낸 글 전문: [02-ref-b-actions18-48-teal-body.prompt.txt](02-ref-b-actions18-48-teal-body.prompt.txt)
- PNG: [02-ref-b-actions18-48-teal-body.png](02-ref-b-actions18-48-teal-body.png)
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-40406b54-664f-4702-9fb2-0ba5d953bf56.png`
- SHA-256: `14dce1e9f74410e2cafa7f45293d646f83ab4d738c947b1f73d8da271c2682be`
- 문: `pnpm art:gate assets/_imagegen/v06/02-ref-b-actions18-48-teal-body.png --spec chr_actions_a --no-canvas --rows "idle,attack,sit_eat,sleep"` → PASS · 경고 9. 종료 코드 0. [출력 전문](02-ref-b-actions18-48-teal-body.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Cell (0,1) "attack 1": crosses the equal-grid cell boundary (bottom 0.9 blocks).
- Cell (1,1) "attack 2": crosses the equal-grid cell boundary (bottom 0.9 blocks).
- Cell (2,1) "attack 3": crosses the equal-grid cell boundary (bottom 0.9 blocks).
- Cell (2,1) "attack 3": horizontal center 3.2 blocks left of the column median.
- Cell (3,1) "attack 4": crosses the equal-grid cell boundary (bottom 0.9 blocks).
- Drawn pixel blocks are 3.7-4 image px in 18 cells, not 5.3 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #F903F9), all within the key tolerance; keying removes them.
- ...and 2 more bbox warnings of the same kind.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본과 나란히 보아 프레임 배치·몸 자세가 유지됨. 정확한 겹침 비교는 게임 쪽에서 확인 필요.
- E10: 머리카락·얼굴·튜닉·허리끈·손 소품이 제거되고, 요청한 민머리·회청 민소매 몸체가 드러남.
- E11: 밝은 마젠타 배경, 후광 없음. 정확한 #FF00FF 불일치는 gate WARN이며 유지.
- E21: 청록 바지와 갈색 부츠의 색조가 원본과 대체로 같음. 원본과 화소별 RGB 동일성은 별도 정량 검사하지 않음.
- 추가 색 조건: 크림 튜닉과 회색 바지 영역이 육안상 없음. 해당 RGB 잔여 화소 0개라는 정량 보증은 하지 않음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-02 · c01-ref-d-hit-discover-interact11-48-teal-body · 시도 1

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c01-ref-d-hit-discover-interact11-48-teal.png`
- 보낸 글 전문: [c01-ref-d-hit-discover-interact11-48-teal-body.prompt.txt](c01-ref-d-hit-discover-interact11-48-teal-body.prompt.txt)
- PNG: [c01-ref-d-hit-discover-interact11-48-teal-body.png](c01-ref-d-hit-discover-interact11-48-teal-body.png)
- 크기: 1774 × 887 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-f703b563-336c-4f42-ab9a-cb38ab550f4d.png`
- SHA-256: `fb72dd2d94119c8592a1f8917bab0c11ad9d7911f28f9fcd9a663365da17344c`
- 문: `pnpm art:gate assets/_imagegen/v06/c01-ref-d-hit-discover-interact11-48-teal-body.png --spec chr_actions_a --no-canvas --rows "hit,discover,interact"` → PASS · 경고 3. 종료 코드 0. [출력 전문](c01-ref-d-hit-discover-interact11-48-teal-body.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Cell (1,1) "discover 2": horizontal center 3.2 blocks right of the column median.
- Cell (2,1) "discover 3": horizontal center 2.4 blocks right of the column median.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #F903F9), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본과 나란히 보아 프레임 배치·몸 자세가 유지됨. 정확한 겹침 비교는 게임 쪽에서 확인 필요.
- E10: 머리카락·얼굴·튜닉·허리끈·손 소품이 제거되고, 요청한 민머리·회청 민소매 몸체가 드러남.
- E11: 밝은 마젠타 배경, 후광 없음. 정확한 #FF00FF 불일치는 gate WARN이며 유지.
- E21: 청록 바지와 갈색 부츠의 색조가 원본과 대체로 같음. 원본과 화소별 RGB 동일성은 별도 정량 검사하지 않음.
- 추가 색 조건: 크림 튜닉과 회색 바지 영역이 육안상 없음. 해당 RGB 잔여 화소 0개라는 정량 보증은 하지 않음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-02 · c02-ref-e-cheer-collapse9-48-teal-body · 시도 1

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c02-ref-e-cheer-collapse9-48-teal.png`
- 보낸 글 전문: [c02-ref-e-cheer-collapse9-48-teal-body.prompt.txt](c02-ref-e-cheer-collapse9-48-teal-body.prompt.txt)
- PNG: [c02-ref-e-cheer-collapse9-48-teal-body.png](c02-ref-e-cheer-collapse9-48-teal-body.png)
- 크기: 2172 × 724 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-74b032a3-8b23-444d-b31e-9e6f2de0f094.png`
- SHA-256: `33e482e6429b9be3a4d30ce1d7bfa12fda7b780ee1c9fb592de77812f048597f`
- 문: `pnpm art:gate assets/_imagegen/v06/c02-ref-e-cheer-collapse9-48-teal-body.png --spec chr_actions_b --no-canvas --rows "cheer,collapse"` → PASS · 경고 2. 종료 코드 0. [출력 전문](c02-ref-e-cheer-collapse9-48-teal-body.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Drawn pixel blocks are 9.5-9.5 image px in 1 cells, not 7.5 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #F606F8), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본과 나란히 보아 프레임 배치·몸 자세가 유지됨. 정확한 겹침 비교는 게임 쪽에서 확인 필요.
- E10: 머리카락·얼굴·튜닉·허리끈·손 소품이 제거되고, 요청한 민머리·회청 민소매 몸체가 드러남.
- E11: 밝은 마젠타 배경, 후광 없음. 정확한 #FF00FF 불일치는 gate WARN이며 유지.
- E21: 청록 바지와 갈색 부츠의 색조가 원본과 대체로 같음. 원본과 화소별 RGB 동일성은 별도 정량 검사하지 않음.
- 추가 색 조건: 크림 튜닉과 회색 바지 영역이 육안상 없음. 해당 RGB 잔여 화소 0개라는 정량 보증은 하지 않음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-03 · 01-ref-a-walk12-48-r3-hair-mask · 시도 1

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/01-ref-a-walk12-48-r3.png`
- 보낸 글 전문: [01-ref-a-walk12-48-r3-hair-mask.prompt.txt](01-ref-a-walk12-48-r3-hair-mask.prompt.txt)
- PNG: [01-ref-a-walk12-48-r3-hair-mask.png](01-ref-a-walk12-48-r3-hair-mask.png)
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-424bd0d5-8e6c-4d01-b1b4-760947f41592.png`
- SHA-256: `2a751be9b4864b2f1f5becdc890cccb156e2ed7f32e22119a474a02ae88fb04d`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본의 각 머리 위치·기울기·행 구성이 육안상 유지됨. 정밀 겹침 비교 미실행.
- E10: 머리카락과 그 외곽선만 남고 얼굴·몸·무기 제거를 확인. 원본과 나란히 확인했으며 숨은 화소의 정량 비교 미실행.
- E11: 밝은 마젠타 단색으로 보이며 후광 없음. 이 항목은 문 없음이므로 정확한 배경 RGB 계측 판정 없음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-03 · c01-ref-d-hit-discover-interact11-48-teal-hair-mask · 시도 1

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c01-ref-d-hit-discover-interact11-48-teal.png`
- 보낸 글 전문: [c01-ref-d-hit-discover-interact11-48-teal-hair-mask.prompt.txt](c01-ref-d-hit-discover-interact11-48-teal-hair-mask.prompt.txt)
- PNG: [c01-ref-d-hit-discover-interact11-48-teal-hair-mask.png](c01-ref-d-hit-discover-interact11-48-teal-hair-mask.png)
- 크기: 1774 × 887 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-e42b42ea-bff3-4e75-a1fc-a2492e3bf1de.png`
- SHA-256: `d9183d818a7f7933d5797f3b3ce0a65ebdad431b011910e0be662a811e0bd59f`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본의 각 머리 위치·기울기·행 구성이 육안상 유지됨. 정밀 겹침 비교 미실행.
- E10: 머리카락과 그 외곽선만 남고 얼굴·몸·무기 제거를 확인. 원본과 나란히 확인했으며 숨은 화소의 정량 비교 미실행.
- E11: 밝은 마젠타 단색으로 보이며 후광 없음. 이 항목은 문 없음이므로 정확한 배경 RGB 계측 판정 없음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-03 · c02-ref-e-cheer-collapse9-48-teal-hair-mask · 시도 1

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c02-ref-e-cheer-collapse9-48-teal.png`
- 보낸 글 전문: [c02-ref-e-cheer-collapse9-48-teal-hair-mask.prompt.txt](c02-ref-e-cheer-collapse9-48-teal-hair-mask.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 2172 × 724 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-56880671-984d-436e-b469-d7c402b9920c.png`
- SHA-256: `3fab74b8f575f06a51e453a1848d2f98d768f2f263420c45cc3f224a8c0aaca1`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E10: 마지막 누운 두 칸에 귀의 피부색과 눈 선이 남음. 사용자 후속 지시에 따라 v06 PNG 삭제/재생성.
- 남은 차이/처리: 육안 불합격 E10: 마지막 누운 두 칸에 귀의 피부색과 눈 선이 남음. 사용자 후속 지시에 따라 v06 PNG 삭제/재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-04 · 01-ref-a-walk12-48-r3-face-mask · 시도 1

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/01-ref-a-walk12-48-r3.png`
- 보낸 글 전문: [01-ref-a-walk12-48-r3-face-mask.prompt.txt](01-ref-a-walk12-48-r3-face-mask.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-8ae3af9d-24ac-4659-a0b8-2fffa1946439.png`
- SHA-256: `61d97d56baea55cbe1a507b3f9c4e0a2d97db4b544c70cec918a991c47552a5f`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E10: 눈 사이/주변의 피부색이 남음. 사용자 후속 지시에 따라 v06의 PNG 삭제 후 재생성.
- 남은 차이/처리: 육안 불합격 E10: 눈 사이/주변의 피부색이 남음. 사용자 후속 지시에 따라 v06의 PNG 삭제 후 재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-04 · 02-ref-b-actions18-48-teal-face-mask · 시도 1

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/02-ref-b-actions18-48-teal.png`
- 보낸 글 전문: [02-ref-b-actions18-48-teal-face-mask.prompt.txt](02-ref-b-actions18-48-teal-face-mask.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-81ae00b4-444b-47fa-94ef-f11b79309bc0.png`
- SHA-256: `d54e3c8c27f45cb982f71ea7c30f7ce0e80c6eceb968fad14f3413e22931ad3e`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E10: 눈 사이/주변의 피부색이 남음. 사용자 후속 지시에 따라 v06의 PNG 삭제 후 재생성.
- 남은 차이/처리: 육안 불합격 E10: 눈 사이/주변의 피부색이 남음. 사용자 후속 지시에 따라 v06의 PNG 삭제 후 재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-04 · c01-ref-d-hit-discover-interact11-48-teal-face-mask · 시도 1

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c01-ref-d-hit-discover-interact11-48-teal.png`
- 보낸 글 전문: [c01-ref-d-hit-discover-interact11-48-teal-face-mask.prompt.txt](c01-ref-d-hit-discover-interact11-48-teal-face-mask.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1774 × 887 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-6e98e280-7d92-4929-80ab-080dd27fcdaa.png`
- SHA-256: `f60a2ed0e8fe01273cc5dcf8d48c468aa0ac142f3da3cdce2ff7bbb5149bd82d`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E10: 눈 사이/주변의 피부색이 남음. 사용자 후속 지시에 따라 v06의 PNG 삭제 후 재생성.
- 남은 차이/처리: 육안 불합격 E10: 눈 사이/주변의 피부색이 남음. 사용자 후속 지시에 따라 v06의 PNG 삭제 후 재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-04 · c02-ref-e-cheer-collapse9-48-teal-face-mask · 시도 1

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c02-ref-e-cheer-collapse9-48-teal.png`
- 보낸 글 전문: [c02-ref-e-cheer-collapse9-48-teal-face-mask.prompt.txt](c02-ref-e-cheer-collapse9-48-teal-face-mask.prompt.txt)
- PNG: [c02-ref-e-cheer-collapse9-48-teal-face-mask.png](c02-ref-e-cheer-collapse9-48-teal-face-mask.png)
- 크기: 2172 × 724 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-5223fb71-e635-44c1-aba6-e86cb0e862c2.png`
- SHA-256: `3fb99606fc638e00a7a566daa12fcb13dc6f6c95e105da58a29d7542ddac25cb`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본 얼굴의 행·열 위치와 자세 방향을 육안 대조. 정밀 겹침 비교 미실행.
- E10: 눈·눈썹·입만 남고 두 눈 사이 피부색 연결 영역이 제거됨. 가림 영역의 새 화소 여부는 게임의 원본 겹침 확인 필요.
- E11: 밝은 마젠타 단색 배경, 검정/갈색 후광 없음. 이 항목은 문 없음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-03 · c02-ref-e-cheer-collapse9-48-teal-hair-mask-r2 · 시도 2

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c02-ref-e-cheer-collapse9-48-teal.png`
- 보낸 글 전문: [c02-ref-e-cheer-collapse9-48-teal-hair-mask-r2.prompt.txt](c02-ref-e-cheer-collapse9-48-teal-hair-mask-r2.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 2172 × 724 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-89f781d5-d04e-457d-af6d-1cf91b244b22.png`
- SHA-256: `daf4f6054342d862c1713e9ec520476c62a75e03f5f0fa9529786b7620fa4268`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E11: 귀/눈 잔여는 사라졌으나 마젠타 배경이 검정으로 표시되고 가장자리 색번짐이 생김. r1과 다른 실패 원인. r3 재생성.
- 남은 차이/처리: 육안 불합격 E11: 귀/눈 잔여는 사라졌으나 마젠타 배경이 검정으로 표시되고 가장자리 색번짐이 생김. r1과 다른 실패 원인. r3 재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-03 · c02-ref-e-cheer-collapse9-48-teal-hair-mask-r3 · 시도 3

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c02-ref-e-cheer-collapse9-48-teal.png`
- 보낸 글 전문: [c02-ref-e-cheer-collapse9-48-teal-hair-mask-r3.prompt.txt](c02-ref-e-cheer-collapse9-48-teal-hair-mask-r3.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 2172 × 724 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-6eb9c5ac-b39d-4cfe-b1bb-2a4c181345fd.png`
- SHA-256: `0f7172afa7d29b97233fcfa447b20115262590172350edb79545400d62f28389`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E10: 누운 두 칸의 귀 둘레에 밝은 피부색 화소가 남음. 배경 마젠타와 눈 제거는 개선됨. 세 번째 시도까지 불합격으로 이 항목 중지(§0.5.2).
- 남은 차이/처리: 육안 불합격 E10: 누운 두 칸의 귀 둘레에 밝은 피부색 화소가 남음. 배경 마젠타와 눈 제거는 개선됨. 세 번째 시도까지 불합격으로 이 항목 중지(§0.5.2).
- 인계: 멈춤.

### V06-04 · 01-ref-a-walk12-48-r3-face-mask-r2 · 시도 2

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/01-ref-a-walk12-48-r3.png`
- 보낸 글 전문: [01-ref-a-walk12-48-r3-face-mask-r2.prompt.txt](01-ref-a-walk12-48-r3-face-mask-r2.prompt.txt)
- PNG: [01-ref-a-walk12-48-r3-face-mask-r2.png](01-ref-a-walk12-48-r3-face-mask-r2.png)
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-9c1b20f0-a27a-40b9-a85c-01502f6319f0.png`
- SHA-256: `ca2a941e5443642ead46860247dc156b32c0f311763342c409f116642e5aa23a`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본 얼굴의 행·열 위치와 자세 방향을 육안 대조. 정밀 겹침 비교 미실행.
- E10: 눈·눈썹·입만 남고 두 눈 사이 피부색 연결 영역이 제거됨. 가림 영역의 새 화소 여부는 게임의 원본 겹침 확인 필요.
- E11: 밝은 마젠타 단색 배경, 검정/갈색 후광 없음. 이 항목은 문 없음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-04 · 02-ref-b-actions18-48-teal-face-mask-r2 · 시도 2

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/02-ref-b-actions18-48-teal.png`
- 보낸 글 전문: [02-ref-b-actions18-48-teal-face-mask-r2.prompt.txt](02-ref-b-actions18-48-teal-face-mask-r2.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-8cc3a23a-ca91-417d-9b8b-a52168596867.png`
- SHA-256: `3faa5fdcd9b17384b5075d1af8c11a844464a83b3787eaeb32ffa5e796730623`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 E11/E8: 배경에 보라·갈색 번짐/후광, 수면행 얼굴 방향도 원본과 달라짐. 이전 피부 잔여와 다른 오류. r3 재생성.
- 남은 차이/처리: 육안 불합격 E11/E8: 배경에 보라·갈색 번짐/후광, 수면행 얼굴 방향도 원본과 달라짐. 이전 피부 잔여와 다른 오류. r3 재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-04 · 02-ref-b-actions18-48-teal-face-mask-r3 · 시도 3

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/02-ref-b-actions18-48-teal.png`
- 보낸 글 전문: [02-ref-b-actions18-48-teal-face-mask-r3.prompt.txt](02-ref-b-actions18-48-teal-face-mask-r3.prompt.txt)
- PNG: [02-ref-b-actions18-48-teal-face-mask-r3.png](02-ref-b-actions18-48-teal-face-mask-r3.png)
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-a9c10803-b255-4ec2-97a5-3d969b6308b1.png`
- SHA-256: `76d4be66b1cfd42ecad35a98bb9041a8542e8fef321cb1a1c60c4f65538c48a0`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본 얼굴의 행·열 위치와 자세 방향을 육안 대조. 정밀 겹침 비교 미실행.
- E10: 눈·눈썹·입만 남고 두 눈 사이 피부색 연결 영역이 제거됨. 가림 영역의 새 화소 여부는 게임의 원본 겹침 확인 필요.
- E11: 밝은 마젠타 단색 배경, 검정/갈색 후광 없음. 이 항목은 문 없음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-04 · c01-ref-d-hit-discover-interact11-48-teal-face-mask-r2 · 시도 2

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/c01-ref-d-hit-discover-interact11-48-teal.png`
- 보낸 글 전문: [c01-ref-d-hit-discover-interact11-48-teal-face-mask-r2.prompt.txt](c01-ref-d-hit-discover-interact11-48-teal-face-mask-r2.prompt.txt)
- PNG: [c01-ref-d-hit-discover-interact11-48-teal-face-mask-r2.png](c01-ref-d-hit-discover-interact11-48-teal-face-mask-r2.png)
- 크기: 1774 × 887 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-543be661-8b82-431a-8d8f-2e3abf89709a.png`
- SHA-256: `c4996449dfa1626f317de00973dd149f3c9cf26b1645ec9f8613f1bfc795307e`
- 문: 해당 없음(요청서 V06-03/04). 실행하지 않음.
- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- E8: 원본 얼굴의 행·열 위치와 자세 방향을 육안 대조. 정밀 겹침 비교 미실행.
- E10: 눈·눈썹·입만 남고 두 눈 사이 피부색 연결 영역이 제거됨. 가림 영역의 새 화소 여부는 게임의 원본 겹침 확인 필요.
- E11: 밝은 마젠타 단색 배경, 검정/갈색 후광 없음. 이 항목은 문 없음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-05 · es01-stranger-campfire-48 · 시도 1

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/es01-stranger-campfire-48-k-r3.png`
- 보낸 글 전문: [es01-stranger-campfire-48.prompt.txt](es01-stranger-campfire-48.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-a47cb086-5535-4bc1-b39d-859854f5781a.png`
- SHA-256: `f9f4f5b4debb775d270e01571eef412442359edb37a4f72f822de9c91ed0885d`
- 문: `pnpm art:gate assets/_imagegen/v06/es01-stranger-campfire-48.png --spec scene_event` → PASS · 경고 4. 종료 코드 0. [출력 전문](es01-stranger-campfire-48.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Strip painted at x 0-1535, y 384-639 (1536x256 px); the template strip is x 0-1535, y 416-607 (1536x192 px); normalization crops the strip and resamples it to 512x64.
- Strip 1536x256 (6.00:1) is taller than 8.00:1; normalization removes the top 64 rows (y 384-447) and keeps the bottom row y 639.
- Drawn pixel blocks are 4-4.1 image px in 4 cells, not 3 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #F808FA), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 SE4: 네 칸 불꽃 형태의 변화가 충분히 확인되지 않음. gate 구조 PASS와 별개로 사용자 후속 지시에 따라 PNG 삭제/재생성.
- 남은 차이/처리: 육안 불합격 SE4: 네 칸 불꽃 형태의 변화가 충분히 확인되지 않음. gate 구조 PASS와 별개로 사용자 후속 지시에 따라 PNG 삭제/재생성.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-05 · es01-stranger-campfire-48-r2 · 시도 2

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/es01-stranger-campfire-48-k-r3.png`
- 보낸 글 전문: [es01-stranger-campfire-48-r2.prompt.txt](es01-stranger-campfire-48-r2.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-303f5390-2fb3-4909-92b6-86946d5333a0.png`
- SHA-256: `5be9f8513da1f9446a381f2e2a313bbb9105c4e41ca92a0b364ae3b67d198f9c`
- 문: `pnpm art:gate assets/_imagegen/v06/es01-stranger-campfire-48-r2.png --spec scene_event` → PASS · 경고 4. 종료 코드 0. [출력 전문](es01-stranger-campfire-48-r2.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Strip painted at x 0-1535, y 384-639 (1536x256 px); the template strip is x 0-1535, y 416-607 (1536x192 px); normalization crops the strip and resamples it to 512x64.
- Strip 1536x256 (6.00:1) is taller than 8.00:1; normalization removes the top 64 rows (y 384-447) and keeps the bottom row y 639.
- Drawn pixel blocks are 3.9-4 image px in 4 cells, not 3 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #FC03FA), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 SE4: 2프레임 불꽃 위쪽 변화가 1~2블록을 넘음. 네 불꽃/손/별 변화는 확보했으나 움직임 폭 제한 위반. 세 번째 시도에서 3~6 이미지 화소로 제한.
- 남은 차이/처리: 육안 불합격 SE4: 2프레임 불꽃 위쪽 변화가 1~2블록을 넘음. 네 불꽃/손/별 변화는 확보했으나 움직임 폭 제한 위반. 세 번째 시도에서 3~6 이미지 화소로 제한.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-06 · w10-h1-river-meadow-summer-day-seam · 시도 1

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/w10-h1-river-meadow-summer-day-r3.png`
- 보낸 글 전문: [w10-h1-river-meadow-summer-day-seam.prompt.txt](w10-h1-river-meadow-summer-day-seam.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1983 × 793 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-753cd6e5-be0c-4803-b8f1-5b6aaa297bf4.png`
- SHA-256: `b8de81f7bf4c3520b318ed660df207e3db6cfcbc5d246331bbd80847eeb4504b`
- 문: `pnpm art:gate assets/_imagegen/v06/w10-h1-river-meadow-summer-day-seam.png --spec bg_far` → PASS · 경고 4. 종료 코드 0. [출력 전문](w10-h1-river-meadow-summer-day-seam.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Image is 1983x793, not the 1536x1024 template canvas; the strip was found by its content at x 0-1982, y 201-595 (1983x395 px); normalization crops the strip and resamples it to 256x64.
- Strip 1983x395 (5.02:1) is wider than 4.00:1; normalization keeps x 180-1759 (removes 180 left and 223 right columns), the window with the smallest left-right seam difference: seam score 88.5 (mean colour distance of the 4 edge columns, 0 = identical).
- Drawn pixel blocks are 4.6-4.6 image px in 1 cells, not 6.2 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #F603FB), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 W3: 왼쪽 큰 나무의 수관이 x248 이후 중앙 보존 구역에서도 없어짐. 검사 PASS·경고4이며 이음 점수88.5는 재생성 원인 아님. 허용된 양 끝1/8 밖 변경 때문에 삭제 후 재시도.
- 남은 차이/처리: 육안 불합격 W3: 왼쪽 큰 나무의 수관이 x248 이후 중앙 보존 구역에서도 없어짐. 검사 PASS·경고4이며 이음 점수88.5는 재생성 원인 아님. 허용된 양 끝1/8 밖 변경 때문에 삭제 후 재시도.
- 인계: 불합격 시도, 뒤 재생성 이력 참조.

### V06-06 · w10-h1-river-meadow-summer-day-seam-r2 · 시도 2

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/w10-h1-river-meadow-summer-day-r3.png`
- 보낸 글 전문: [w10-h1-river-meadow-summer-day-seam-r2.prompt.txt](w10-h1-river-meadow-summer-day-seam-r2.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1983 × 793 (입력과 같음)
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-1410deb1-8465-4841-984e-8e3b1d917a58.png`
- SHA-256: `0fe465b97d964098482fe6bdc9bcf1d9d87bcb808d9eee4d635f9321a4fb18e8`
- 문: `pnpm art:gate assets/_imagegen/v06/w10-h1-river-meadow-summer-day-seam-r2.png --spec bg_far` → PASS · 경고 4. 종료 코드 0. [출력 전문](w10-h1-river-meadow-summer-day-seam-r2.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Image is 1983x793, not the 1536x1024 template canvas; the strip was found by its content at x 0-1982, y 202-594 (1983x393 px); normalization crops the strip and resamples it to 256x64.
- Strip 1983x393 (5.05:1) is wider than 4.00:1; normalization keeps x 400-1971 (removes 400 left and 11 right columns), the window with the smallest left-right seam difference: seam score 107.1 (mean colour distance of the 4 edge columns, 0 = identical).
- Drawn pixel blocks are 4.5-4.5 image px in 1 cells, not 6.1 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #F604FB), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격 W3: 오른쪽 큰 나무의 수관이 원본보다 왼쪽으로 옮겨져 중앙 보존 구역(x1735 미만)을 침범함. 허용 범위 밖 변경이 두 번 반복되어 §0.5.2에 따라 항목 중지. W7도 실제 반복 연결 보장 못함. gate PASS·경고4의 이음107.1은 그 자체로 재생성 사유 아님.
- 남은 차이/처리: 육안 불합격 W3: 오른쪽 큰 나무의 수관이 원본보다 왼쪽으로 옮겨져 중앙 보존 구역(x1735 미만)을 침범함. 허용 범위 밖 변경이 두 번 반복되어 §0.5.2에 따라 항목 중지. W7도 실제 반복 연결 보장 못함. gate PASS·경고4의 이음107.1은 그 자체로 재생성 사유 아님.
- 인계: 멈춤.

### V06-05 · es01-stranger-campfire-48-r3 · 시도 3

- 결과: 보관 · 게임 검수용 인계
- 입력(넣은 순서): 입력 1 = `assets/_imagegen/v05/es01-stranger-campfire-48-k-r3.png`
- 보낸 글 전문: [es01-stranger-campfire-48-r3.prompt.txt](es01-stranger-campfire-48-r3.prompt.txt)
- PNG: [es01-stranger-campfire-48-r3.png](es01-stranger-campfire-48-r3.png)
- 크기: 1536 × 1024 (입력과 같음)
- 원본 보존: 최종 대조에서 생성기 원본과 SHA-256 같음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-36eca77e-e3db-427d-96c8-9e8d8148a91f.png`
- SHA-256: `8df6dc2264057c8933593083afc35e265f6f824ca59757724a1a4e9e44a547aa`
- 문: `pnpm art:gate assets/_imagegen/v06/es01-stranger-campfire-48-r3.png --spec scene_event` → PASS · 경고 4. 종료 코드 0. [출력 전문](es01-stranger-campfire-48-r3.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Strip painted at x 0-1535, y 384-639 (1536x256 px); the template strip is x 0-1535, y 416-607 (1536x192 px); normalization crops the strip and resamples it to 512x64.
- Strip 1536x256 (6.00:1) is taller than 8.00:1; normalization removes the top 64 rows (y 384-447) and keeps the bottom row y 639.
- Drawn pixel blocks are 4-4 image px in 4 cells, not 3 (one logical pixel); normalization resamples.
- Background is not exactly #FF00FF: 100% of background pixels differ (mean #FB03FA), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 아래 기준별 확인 참조.

- SE2: 마젠타 단색, 후광 없음. 정확한 배경색 차이는 gate WARN으로 유지.
- SE3: 통나무·여행자 몸·숲·지면이 네 칸에서 육안상 같은 배치. 정지 화소 차이 0.5% 이하 여부는 계측하지 않았음.
- SE4: r2의 큰 불꽃 변화가 줄었고, 미세한 불꽃 끝/내부/불씨 변화와 2·4칸 손 모음이 보임. 3칸 낮은 하늘의 별 하나가 사라짐. 정확한 이동 화소 수와 반복 재생은 게임 검수 필요.
- SE5: 주인공 자리 비어 있음. 원본에서 허용된 불빛 일부 침범 유지.
- SE6: 인물·통나무가 지면에 닿고 바닥 띠가 유지됨. gate 채움 100%.
- SE7: 원본 띠 맨 위는 한 색의 하늘로 보임. 새 도구가 윗부분 64행을 자르는 경고를 기록했으므로 최종 잘림 뒤 상단 규칙은 게임 쪽 확인 필요.
- SE8: 인물/소품의 어두운 외곽선과 원본 배경 색조 유지. 배경 최저 RGB 전수 검사는 미실행.
- SE9: 원본 ES01 여행자 후드·눈·옷·키가 유지됨.
- SE10: 모닥불/통나무가 원본과 같은 물건으로 읽힘.
- SE11: 글자·숫자·금지 기호·잔혹 표현 없음.
- SE12: 모닥불 옆 여행자와 만나는 장면으로 읽힘.
- SE13: 원본 팔레트 시각 유지. 정규화 후 M5 색 검사는 게임 측 작업.
- E21: 기존 색조를 참고해 생성. 원본 RGB 완전 동일 여부는 정량 보증하지 않음.
- 남은 차이: 정밀 겹침/팔레트 및 실제 게임 적용 검수는 게임 쪽에 인계. 코드로 이미지를 고치지 않음.
- 인계: 검수용 인계.

### V06-01 · l7-expression12-48-r3 · 시도 3

- 결과: 육안 불합격 · v06 PNG 삭제
- 입력(넣은 순서): 입력 1 = `docs/art/templates/chr_face.placeholder.png` / 입력 2 = `assets/_imagegen/v05/02-ref-b-actions18-48-teal.png`
- 보낸 글 전문: [l7-expression12-48-r3.prompt.txt](l7-expression12-48-r3.prompt.txt)
- PNG: 결과 폴더의 사본 삭제
- 크기: 1536 × 1024
- 원본 보존: 삭제 전 원본 그대로 복사한 결과. 생성기 원본은 남아 있음
- 생성기 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-8c06e8e5-39a9-4b80-b5d4-f62b3552a6b8.png`
- SHA-256: `e2e25923676f6048f580995ae340e26a08f7ce70bafab2897196b079d39095fe`
- 문: `pnpm art:gate assets/_imagegen/v06/l7-expression12-48-r3.png --spec chr_face` → PASS · 경고 1. 종료 코드 0. [출력 전문](l7-expression12-48-r3.gate.txt)

경고 전문(재생성 사유로 사용하지 않음):

- Background is not exactly #FF00FF: 100% of background pixels differ (mean #FA03F9), all within the key tolerance; keying removes them.

- 예외: 없음. 띠는 개정 §0.4의 정상 경고 처리.
- 눈으로 본 결과: 육안 불합격: 가는 눈 놀람은 개선되었으나 3행 2열 ELDER가 neutral 조건과 달리 웃는 입으로 보임. 세 번째 시도도 세부 표정 조건 불충족으로 §0.5.2에 따라 중지.
- 남은 차이/처리: 육안 불합격: 가는 눈 놀람은 개선되었으나 3행 2열 ELDER가 neutral 조건과 달리 웃는 입으로 보임. 세 번째 시도도 세부 표정 조건 불충족으로 §0.5.2에 따라 중지.
- 인계: 멈춤.

## 멈춤 보고 · 실패 기록 접근

현재 중지된 작업은 L7 표정 3회, REF-E 머리카락 3회, H1 이음 2회이다. 해당 시도의 프롬프트 전문과 문 출력 전문은 위 링크 및 같은 폴더에 보존했다. 최신 사용자 지시에 따라 불합격 PNG의 v06 사본은 전부 삭제했다. 각 항목에 생성기 원본 경로와 SHA-256을 기록했으며 생성기 원본 자체는 보존되어 있다. 문 없는 가림막의 자동 검사 결과를 만들어 내지 않았다.

## 이전 중단 보고 · 역사 기록

아래는 이번 재개 전 보고 원문이다. 현재 상태는 이 문서 위쪽의 새 보고가 우선한다. 이전에 적힌 PNG의 v06 사본은 후속 사용자 지시에 따라 삭제되었을 수 있다.

# V06 생성·검토 기록

## 배치 1 · 2026-09-25 · 요약

**14장 중 1장 생성 후 요청서 §0.5(3)에 따라 전체 중단했다.** V06-01은 `art:gate`에서 PASS·경고0이지만 원본을 직접 열어 보면 어두운 갈색/검정 그라데이션과 후광이 보이며, 요구된 불투명 단색 `#FF00FF` 배경이 아니다. 이 불일치는 띠 예외 대상이 아니다. V06-02~06의 나머지 13장과 다음 배치는 시작하지 않았다.

적용한 중단 규칙: [V06_REQUEST.md §0.1(3)·§0.5(3)](../../../docs/art/V06_REQUEST.md) — “PASS인데 눈으로 명백히 틀림”이면 “그 자리에서 멈추고 보고한다”. 재생성은 FAIL일 때만 허용하므로 PASS 결과에 임의 지적을 붙이거나 r2를 만들지 않았다.

| id | 파일 | 시도 | 문 | 예외 | 육안 | 인계 |
| --- | --- | --- | --- | --- | --- | --- |
| V06-01 | [l7-expression12-48.png](l7-expression12-48.png) | 1/3 | PASS · 경고 0 | 없음 | 보류(E4·E11) | **전체 멈춤** |
| V06-02 | `01-ref-a-walk12-48-r3-body.png` | 미착수 | 미실행 | — | 미검토 | 전체 중단으로 미착수 |
| V06-02 | `02-ref-b-actions18-48-teal-body.png` | 미착수 | 미실행 | — | 미검토 | 전체 중단으로 미착수 |
| V06-02 | `c01-ref-d-hit-discover-interact11-48-teal-body.png` | 미착수 | 미실행 | — | 미검토 | 전체 중단으로 미착수 |
| V06-02 | `c02-ref-e-cheer-collapse9-48-teal-body.png` | 미착수 | 미실행 | — | 미검토 | 전체 중단으로 미착수 |
| V06-03 | `01-ref-a-walk12-48-r3-hair-mask.png` | 미착수 | 미실행(문 해당 없음 항목) | — | 미검토 | 전체 중단으로 미착수 |
| V06-03 | `c01-ref-d-hit-discover-interact11-48-teal-hair-mask.png` | 미착수 | 미실행(문 해당 없음 항목) | — | 미검토 | 전체 중단으로 미착수 |
| V06-03 | `c02-ref-e-cheer-collapse9-48-teal-hair-mask.png` | 미착수 | 미실행(문 해당 없음 항목) | — | 미검토 | 전체 중단으로 미착수 |
| V06-04 | `01-ref-a-walk12-48-r3-face-mask.png` | 미착수 | 미실행(문 해당 없음 항목) | — | 미검토 | 전체 중단으로 미착수 |
| V06-04 | `02-ref-b-actions18-48-teal-face-mask.png` | 미착수 | 미실행(문 해당 없음 항목) | — | 미검토 | 전체 중단으로 미착수 |
| V06-04 | `c01-ref-d-hit-discover-interact11-48-teal-face-mask.png` | 미착수 | 미실행(문 해당 없음 항목) | — | 미검토 | 전체 중단으로 미착수 |
| V06-04 | `c02-ref-e-cheer-collapse9-48-teal-face-mask.png` | 미착수 | 미실행(문 해당 없음 항목) | — | 미검토 | 전체 중단으로 미착수 |
| V06-05 | `es01-stranger-campfire-48.png` | 미착수 | 미실행 | — | 미검토 | 전체 중단으로 미착수 |
| V06-06 | `w10-h1-river-meadow-summer-day-seam.png` | 미착수 | 미실행 | — | 미검토 | 전체 중단으로 미착수 |

### V06-01 · l7-expression12-48 · 시도 1

- 입력(넣은 순서): 입력 1 = [docs/art/templates/chr_face.placeholder.png](../../../docs/art/templates/chr_face.placeholder.png), 입력 2 = [assets/_imagegen/v05/02-ref-b-actions18-48-teal.png](../v05/02-ref-b-actions18-48-teal.png).
- 보낸 글: [l7-expression12-48.prompt.txt](l7-expression12-48.prompt.txt). A + B + T + NUM(chr_face) + C + L7 입력 역할/본문 + D 전문을 지정 순서대로 조립했다. 미치환 자리 없음. 새 입력/창작 지시를 더하지 않았다.
- 결과: [l7-expression12-48.png](l7-expression12-48.png).
- 크기: **1536 × 1024**, 생성 틀과 같음. PNG 헤더: RGBA, 8비트. 픽셀 편집·알파 변환을 하지 않았다.
- 원본 보존: 생성기 원본과 SHA-256 같음.
  - 원본: `C:\Users\hansol\.codex\generated_images\01a0cdee-a295-7ff0-9875-ee99196ef0f1\exec-33f5e984-77d7-4317-afef-4f5681c0747a.png`
  - 원본 SHA-256: `f32643397526b21d8db57152619f41ffb93a9ad15a92ec8052dd4dab2bac6d88`
  - 저장 PNG SHA-256: `f32643397526b21d8db57152619f41ffb93a9ad15a92ec8052dd4dab2bac6d88`
- 문: `pnpm art:gate assets/_imagegen/v06/l7-expression12-48.png --spec chr_face` → **PASS, 종료 코드 0, 경고 0**. 출력은 [l7-expression12-48.gate.txt](l7-expression12-48.gate.txt)에 명령과 함께 전문 보존.
- 예외: **없음**. `chr_face`는 §0.4의 배경·장면 띠 예외에 해당하지 않는다.
- 눈으로 본 결과:
  - **E1**: 5열 × 3행, 인물 12개, 3행 뒤 세 칸에 인물 없음. 칸 구성은 맞음.
  - **E2**: 머리·몸·옷·대기 자세는 육안상 같은 계열로 반복됨. 정확한 겹침 검사는 수행하지 않음.
  - **E4**: 보류. 평평한 자홍 배경 대신 어두운 그라데이션/후광이 보임.
  - **E9**: 밤색 머리·크림 튜닉·청록 바지·갈색 부츠와 오른쪽을 보는 인물은 유지. 마스터와의 최종 동일성 판정은 인계하지 않음.
  - **E11**: 보류. 배경 전체가 단일 자홍색이 아니고 각 인물 주변에 밝고 어두운 띠가 보임.
  - **닫힌 눈 추가 기준**: 1행 4칸과 2행 4칸은 직선 가로 눈으로 보이며 `^^` 모양이 아님.
  - **표정 추가 관찰**: 2행 3칸은 가는 눈보다 둥근 눈에 가까워 보임. 이 또한 합격으로 확정하지 않음.
- 남은 차이: 불투명 단색 자홍 조건과 실제 표시 결과의 불일치, 2행 일부 눈 모양. 문 출력의 배경100%·경고0과 육안 결과가 상충한다.
- 인계: **멈춤**. 게임 쪽의 검사/판정 확인 전 추가 생성 금지.

## 멈춤 보고

- 항목: **V06-01 첫 시도**. 배치 1 경계 이전의 즉시 전체 중단이다.
- PNG 전부: [l7-expression12-48.png](l7-expression12-48.png) **1장**. r2/r3 없음.
- 보낸 글 전문: [l7-expression12-48.prompt.txt](l7-expression12-48.prompt.txt).
- 문 출력 전문: [l7-expression12-48.gate.txt](l7-expression12-48.gate.txt), 아래에도 동일 기록.
- 한 줄 원인 추정: **생성기가 불투명 단색 자홍 조건을 어겼는데 검사기는 해당 배경을 제거 가능한 배경으로 판정했을 가능성이 있다.** 원인은 확정하지 않았으며 검사 도구의 코드/허용치를 조사·수정하지 않았다.
- 요청서 §0.3에 따라 PASS에는 GF를 붙이지 않았다. 다른 `--spec`이나 `--no-canvas`로 바꿔 검사하지 않았다.
- 이번 작업에서 쓴 저장소 경로는 `assets/_imagegen/v06/`뿐이다. 소스·도구·문서·게임 에셋 변경, git 작업, 정규화·파생·테스트 실행 없음. 실행한 셸 명령은 위의 `pnpm art:gate` 1회뿐이다. 문서/입력 읽기, 원본 파일 복사, 크기/해시 확인은 파일 입출력 도구로 처리했으며 그림 화소를 생성·변경하는 코드를 쓰지 않았다.

### 문 출력 전문

```text
pnpm art:gate assets/_imagegen/v06/l7-expression12-48.png --spec chr_face

> tap-rpg@ art:gate E:\AI_work\Tap_rpg
> tsx tools/art-check/src/cli.ts gate "assets/_imagegen/v06/l7-expression12-48.png" "--spec" "chr_face"

assets/_imagegen/v06/l7-expression12-48.png
PASS chr_face · canvas · 이미지 1536×1024 (틀 1536×1024) · S 6 (template) · 칸 격자 · 시트 블록 6.0 · 키 비율 - · 배경 100.0% · 안내색 0 · 격자 밖 0 · 경고 0
  칸      동작              화소     바닥Δ 틀Δ  중심Δ  키(기준)      블록  반투명  판정
  (0,0)   round_basic         22394     -    -     -  40.0(-)        6.0   0.0%  ok
  (1,0)   round_smile         22401     -    -     -  40.0(-)        6.0   0.0%  ok
  (2,0)   round_frown         22396     -    -     -  40.0(-)        6.0   0.0%  ok
  (3,0)   round_closed        22392     -    -     -  40.0(-)        6.0   0.0%  ok
  (4,0)   round_surprised     22405     -    -     -  40.0(-)        6.0   0.0%  ok
  (0,1)   narrow_basic        22374     -    -     -  40.0(-)        6.0   0.0%  ok
  (1,1)   narrow_smile        22373     -    -     -  40.0(-)        6.0   0.0%  ok
  (2,1)   narrow_frown        22391     -    -     -  40.0(-)        6.0   0.0%  ok
  (3,1)   narrow_closed       22362     -    -     -  40.0(-)        6.0   0.0%  ok
  (4,1)   narrow_surprised    22389     -    -     -  40.0(-)        6.0   0.0%  ok
  (0,2)   wrinkle_veteran     22411     -    -     -  40.0(-)        6.0   0.0%  ok
  (1,2)   wrinkle_elder       22384     -    -     -  40.0(-)        6.0   0.0%  ok

Regeneration feedback:
The delivery matches the chr_face template. No regeneration needed.
```

