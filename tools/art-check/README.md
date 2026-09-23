# @tap/art-check

픽셀 에셋 자동 검사기. `docs/art/assets.manifest.json`이 정한 규격과 실제 PNG 화소를 대조한다.
Node 22 내장 모듈만 쓴다(새 npm 패키지 없음). PNG는 직접 해석한다 — 시그니처·IHDR·PLTE·tRNS를 읽고
IDAT를 `node:zlib`의 `inflateSync`로 푼 뒤 스캔라인 필터(0~4)를 복원해 8비트 RGBA로 정규화한다.

## 실행

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
