# @tap/art-check

픽셀 에셋 자동 검사기. `docs/art/assets.manifest.json`이 정한 규격과 실제 PNG 화소를 대조한다.
Node 22 내장 모듈만 쓴다(새 npm 패키지 없음). PNG는 직접 해석한다 — 시그니처·IHDR·PLTE·tRNS를 읽고
IDAT를 `node:zlib`의 `inflateSync`로 푼 뒤 스캔라인 필터(0~4)를 복원해 8비트 RGBA로 정규화한다.

## 실행

제작 원본(이미지 생성물, `assets/_imagegen/`)은 `inspect`로 사실만 본다. 원본은 규격과 달라도 된다(설계 결정 D56). `check`는 M2 에셋 로더가 정규화한 게임 규격 파일의 합격 판정용이다.

```bash
# 매니페스트 전수 검사
pnpm exec tsx tools/art-check/src/cli.ts check

# 우선순위·항목만 추려서
pnpm exec tsx tools/art-check/src/cli.ts check --priority P0
pnpm exec tsx tools/art-check/src/cli.ts check --id chr_body_base_48 --id fx_shadow_48

# 기계용 출력 / 미제작도 실패로 세기 / 아직 안 그린 칸은 경고로만
pnpm exec tsx tools/art-check/src/cli.ts check --json
pnpm exec tsx tools/art-check/src/cli.ts check --require-all
pnpm exec tsx tools/art-check/src/cli.ts check --id chr_body_base_48 --allow-empty

# 매니페스트에 없는 PNG의 사실만 세기(크기·알파·색 수·정수 격자)
pnpm exec tsx tools/art-check/src/cli.ts inspect output/pixel-art-v01/images
```

- `--manifest <경로>` 기본값 `docs/art/assets.manifest.json`.
- `--root <경로>` 산출물 트리의 뿌리. 기본값은 매니페스트의 `defaults.root`(= 저장소 뿌리).
- 종료 코드: `0` 오류 없음 · `1` 오류 있음 · `2` 사용법·읽기 실패.

## 검사 항목

| 코드 | 검사 | ASSET_ORDERS 0.9절 대응 |
| --- | --- | --- |
| M0 | PNG를 읽을 수 있는가 | — |
| M1 | 크기가 규격과 같고 칸 크기로 정수 나눗셈이 되는가 | A5 |
| M2 | 칸 가장자리 `margin`px 안에 내용이 없는가(칸 밖 침범·이웃 칸 접촉) | A6, A9 |
| M3 | 알파가 허용값(기본 0·255)뿐인가 | A2 |
| M4 | 고유 색 수가 전체·칸별 상한 안인가 | A4 |
| M5 | 모든 색이 팔레트 안인가(위반 색과 화소 수를 돌려준다) | A3, A18 |
| M6 | 내용이 있어야 할 칸이 비었거나, 비어야 할 칸에 내용이 있는가 | 0.6절 |
| M7 | 동반 JSON(`.anchors.json`·`.frames.json`·`.9slice.json`)이 있고 형식이 맞는가 | A10 |
| M8 | 기준점이 칸 안에 있는가 | A10 |

M1이 실패하면 칸 단위 검사(M2·M4 칸별·M6)는 돌리지 않는다. 격자가 없으면 칸 좌표가 뜻을 잃기 때문이다.

`chr_body_base_48`처럼 한 시트를 카드 여러 장(AO-02~AO-10)이 나눠 채우는 동안에는 `--allow-empty`를 붙인다.
그러면 「내용이 있어야 하는데 빈 칸」만 경고가 되고, 「비어야 하는데 내용이 있는 칸」은 그대로 오류로 남는다.
시트를 다 채운 뒤에는 플래그 없이 다시 돌려 종료 코드 0을 받아야 한다.

## 생성 원본 정규화 (`normalize` · `preview` · `layers`)

D56에 따라 그림은 이미지 생성 모델이 만든 큰 PNG(예 1536×1024, 단색 `#FF00FF` 배경 또는 투명 배경, N열 × M행 등간격 격자,
칸 하나에 포즈 하나)로 들어온다. 이것을 게임 규격 시트(논리 칸 48×48·32×32·32×24…, 알파 0/255, 팔레트 색, 인덱스 PNG)로
바꾸는 것이 게임 쪽 담당이고, 이 세 명령이 그 도구다. 원본은 손대지 않고 읽기만 한다.

```bash
pnpm art:normalize            # docs/art/imagegen.map.json의 모든 항목 → assets/game/<이름>.png + <이름>.json
pnpm art:normalize --name ref_actions18_48
pnpm art:preview              # assets/game/_preview/ 에 ×4 검수 확대본

# 레이어 정합 측정(대응표 이름 또는 원본 PNG 경로). 한 칸이라도 기준을 넘으면 종료 코드 1
pnpm exec tsx tools/art-check/src/cli.ts layers ref_actions18_48 body_actions18_48 hair_actions18_48 sword_actions18_48
pnpm exec tsx tools/art-check/src/cli.ts layers ref_actions18_48 assets/_imagegen/v03/19-cloth-actions18-48-r2.png \
  --clothing assets/_imagegen/v03/19-cloth-actions18-48-r2.png   # 불합격 천옷 → 실패(종료 1)
```

`assets/game/`은 생성 산출물이라 저장소에 넣지 않는다(`.gitignore`). 언제든 원본과 대응표에서 다시 만든다.

### 대응표 `docs/art/imagegen.map.json`

| 키 | 뜻 |
| --- | --- |
| `source_dir` · `out_dir` | 원본 폴더와 산출 폴더(저장소 뿌리 기준) |
| `key` · `key_tolerance` | 배경 열쇠 색과 RGB 거리 허용치 |
| `alpha_threshold` | 알파가 이 값 미만이면 배경(투명 배경 원본) |
| `key_despill` | `min(R,B) − G`가 이 값 이상이면 배경 — 자홍과 섞인 테두리 화소를 지운다. 기본 팔레트에서 여기 걸리는 색은 효과 보라 `#8E4FA3`뿐이라, 그 색을 쓰는 시트가 생기면 `null`로 끈다 |
| `entries[].role` | `reference`(기준 시트: 정렬을 계산) 또는 `layer`(부품: `ref`의 변환을 그대로 물려받는다) |
| `grid` · `cell` · `rows` | 원본 격자 [열, 행], 논리 칸 [폭, 높이], 행별 `{action, frames}`. `frames` 밖의 칸은 빈 칸이다 |
| `palette` | 매니페스트 `palette_sets` 키, 또는 `palettes` 묶음 이름 배열(예: 캐릭터에서 효과 색 `fx`를 뺄 때) |
| `align` | `{mode:"ground", bottom, center_x}`(ASSET_ORDERS 0.4·0.5절) 또는 `{mode:"center"}`(기준점이 따로 붙는 무기·소품) |
| `scale` | 원본 화소 몇 개가 논리 화소 1개인가. 적지 않으면 `max(원본 칸 폭/논리 칸 폭, 원본 칸 높이/논리 칸 높이)` |
| `preview` | 창 모형의 캐릭터·적·소품, 정합 확인 레이어, 32/48 비교 쌍, 들판 배경 층 |

### 처리 순서 (칸마다)

1. **배경 열쇠**: 알파 < `alpha_threshold`, 열쇠 색 근처, 자홍 번짐이면 배경.
2. **칸 배정**: 전경 화소를 8방향 덩어리로 묶어 **무게중심이 든 격자 칸**에 준다. 생성 그림은 발끝·칼끝이 격자선을 몇 화소 넘기 때문에, 격자선으로 자르면 발이 잘리고 이웃 칸에 조각이 생긴다.
3. **팔레트 번호**: 원본 화소마다 가장 가까운 팔레트 색(가중 RGB 거리 redmean).
4. **블록 다수결**: 블록 = 원본 `scale`×`scale` 화소. 불투명 화소가 절반 이상이면 불투명, 색은 최다 팔레트 번호. 블록 격자의 위상은 색 경계가 블록 경계에 가장 많이 걸리는 값.
5. **외톨이 화소 제거**(8방향으로 이웃 없는 1화소).
6. **정렬**: 기준 시트만 계산한다. `ground`는 가장 아래 불투명 행을 `bottom`에, 불투명 화소 x의 중앙값(칼·꼬리에 덜 끌리는 몸 중심)을 `center_x`에 둔다. **레이어는 기준 시트의 축척·블록 기준점·이동을 그대로 쓴다** — 따로 정렬하면 칸마다 어긋난다.
7. 칸 밖으로 나간 화소는 버리고 센다. 빈 칸이어야 할 곳의 내용도 버리고 보고한다.

보고 JSON(`<이름>.json`)에는 시트별 칸 비율·축척·**원본 그림에서 잰 화소 블록 크기**(색 경계 주기의 푸리에 추정)와 경고, 칸별 원본 bbox·블록 기준점·이동·불투명 수·칸 밖 버림·외톨이 제거·bbox·사용 색·팔레트 오차(평균·최대)·블록 순도가 들어간다.
축척과 원본 블록 크기가 15% 넘게 다르면 경고한다(합쳐지면 가는 선이 빠지고, 늘어나면 계단이 생긴다).

### 미리보기 (`assets/game/_preview/`, 0.10절 V1·V3·V7)

| 파일 | 내용 |
| --- | --- |
| `<시트>.x4.png` | 정규화 시트 ×4. 칸 경계(회색), 지면선(파랑), 가로 중심(주황 점) |
| `window.x4.png` | 520×64 기본 창 모형(03 §2.2): 캐릭터 x 16~64, 지면선 y 56, 적 x 72~120, 글자 판 88%. 대기(+걷기) 프레임마다 한 줄. 무기는 `hand_f` 기준점이 아직 없어 손에 들리지 못하므로 글자 판 자리에 실크기로 늘어놓아 크기만 비교한다 |
| `window-small.x4.png` | 320×48 축소 창(03 §3): 배경 아래 48줄, 적 x 56~92 |
| `layers.x4.png` | 칸마다 [기준 \| 레이어 합성 \| 차이]. 차이의 빨강 = 기준 실루엣 밖 레이어, 파랑 = 레이어가 안 덮은 기준 |
| `<48>_vs_<32>.x1.png` · `.x2.png` | 32·48 실크기·2배 비교 |

배경은 `preview.field`의 정규화 파일이 모두 있으면 이어 붙이고, 없으면 단색 하늘·풀밭이다.

### 레이어 정합 기준 (`layers`)

| 값 | 뜻 | 기본 기준 |
| --- | --- | --- |
| 포함률 | 레이어 화소 가운데 기준 실루엣 안 비율 | ≥ 0.95 (`--min-containment`) |
| 최적 이동 | ±3 논리 화소 안에서 **색 일치율**이 가장 높은 이동(0.01 안쪽이면 작은 이동). 실루엣 포함률로 고르면 칼날처럼 가는 레이어가 날 방향으로 미끄러져도 1.0이라 쓸 수 없다 | 체비쇼프 ≤ 1 (`--max-shift`) |
| 피부 겹침 | 옷 레이어(`--clothing` 또는 대응표 `clothing: true`) 화소 가운데 기준 시트의 같은 자리가 피부색인 비율 | ≤ 0.03 (`--max-skin`) |

피부색은 매니페스트 `skin` 묶음에서 **옷 레이어가 쓰는 피부 아닌 색과 가중 거리 40 미만인 색을 뺀 것**이고, 상하좌우 이웃 2개 이상이 피부색인 화소만 센다.
원본의 크림색 옷이 `#F0E6CC`와 `#F6D9C2` 사이라 기준 시트에서 옷이 두 색으로 갈라지고, 옷 음영 일부가 피부 중간색으로 스냅되기 때문이다.

### 알려진 한계

- **색 수**: 원본 화소마다 스냅하므로 면 안에 두 팔레트 색이 섞여 점무늬가 남고, 칸당 색 수가 카드 상한(몸체+얼굴 6, 적 12)을 크게 넘는다. 색 줄이기(묶음별 대표색 고정)는 아직 없다 — `check`의 M4를 통과하지 못한다.
- **무기 기준점**: `hand_f`·`back` 기준점(.anchors.json)이 없어 무기 시트는 가운데 정렬만 한다. 몸체와 1:1로 대응하는 무기 시트는 기준 시트의 레이어로 뽑아야 한다(검 레이어처럼).
- **시트 배치**: 출력은 원본 격자 배치 그대로다(예 동작 18칸 6×4). 15 §12.2의 10행 몸체 시트·3행 무기 시트로 옮기는 것은 다음 단계다.
- 원본 화소 블록 추정은 생성 그림의 격자가 고르지 않아 ±10% 정도다. 면이 넓은 레이어에서는 흔들려 레이어는 재지 않는다.

## 규격을 고치려면

규격은 코드에 없다. 전부 `docs/art/assets.manifest.json`에 있다. 새 산출물은 `assets` 배열에 항목을 더하고,
값이 아직 정해지지 않은 산출물은 `unspecified`에 적는다(검사기가 「명세 미정」으로 같이 보고한다).
매니페스트 자체의 앞뒤(크기 = 칸 × 격자, 행 프레임 합 = frames, 팔레트 키 존재, 경로 중복)는 읽는 즉시 검증하며,
틀리면 검사 전에 종료 코드 2로 멈춘다.

## 시험

```bash
node --import tsx --test "tools/art-check/test/**/*.test.ts"
```

시험은 합성 PNG를 코드로 만들어(`test/helpers/png-encode.ts`) 항목마다 통과·실패 사례를 함께 본다.
정규화 시험(`test/normalize.test.ts`)은 논리 그림을 잡음과 함께 정수배로 키운 자홍 배경 원본을 코드로 만들어
배경 열쇠·다수결 축소·정렬·격자선 넘김·레이어 변환 물려받기·팔레트 스냅·PNG 기록 왕복·정합 측정을 본다.
