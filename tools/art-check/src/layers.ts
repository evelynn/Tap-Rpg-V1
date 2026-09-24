// 레이어 정합 측정. 정규화된 기준 시트와 레이어 시트를 같은 칸끼리 겹쳐 본다.
//   포함률  = 레이어 불투명 화소 가운데 기준 실루엣 안에 든 비율
//   색 일치율 = 레이어 불투명 화소 가운데 기준 시트의 같은 자리가 같은 색인 비율
//   최적 이동 = 레이어를 ±search 논리 화소 옮겼을 때 색 일치율이 가장 높은 이동(0.01 안쪽이면 더 작은 이동)
//               — 실루엣 포함률로 고르면 칼날처럼 가는 레이어는 날 방향으로 미끄러져도 1.0이라 이동을 못 가린다
//   피부 겹침 = 옷 레이어 화소 가운데 기준 시트의 같은 자리가 피부색인 비율(노출된 팔을 소매로 다시 그린 경우)
import type { Raster } from './raster'

export interface RegistrationOptions {
  minContainment: number
  /** 최적 이동의 체비쇼프 거리 상한(논리 화소) */
  maxShift: number
  maxSkin: number
  /** 최적 이동 탐색 범위(논리 화소) */
  search: number
}

export const DEFAULT_REGISTRATION: RegistrationOptions = { minContainment: 0.95, maxShift: 1, maxSkin: 0.03, search: 3 }

export interface CellRegistration {
  col: number
  row: number
  layer_pixels: number
  containment: number
  color_match: number
  best_shift: [number, number]
  best_color_match: number
  /** null = 옷 레이어가 아니라 재지 않음 */
  skin_overlap: number | null
  pass: boolean
  reasons: string[]
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000

/** skin = 피부색 RGB(0xRRGGBB) 집합. null이면 피부 겹침을 재지 않는다 */
export function measureRegistration(
  ref: Raster,
  layer: Raster,
  cell: [number, number],
  grid: [number, number],
  skin: Set<number> | null,
  opts: RegistrationOptions = DEFAULT_REGISTRATION,
): CellRegistration[] {
  if (ref.width !== layer.width || ref.height !== layer.height) {
    throw new Error(`기준 ${ref.width}×${ref.height}와 레이어 ${layer.width}×${layer.height} 크기가 다르다`)
  }
  const [cw, ch] = cell
  const out: CellRegistration[] = []
  const opaque = (r: Raster, x: number, y: number): boolean => r.rgba[(y * r.width + x) * 4 + 3]! > 0
  for (let row = 0; row < grid[1]; row++) {
    for (let col = 0; col < grid[0]; col++) {
      const pts: [number, number][] = []
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) if (opaque(layer, col * cw + x, row * ch + y)) pts.push([x, y])
      }
      if (pts.length === 0) {
        out.push({ col, row, layer_pixels: 0, containment: 1, color_match: 1, best_shift: [0, 0], best_color_match: 1, skin_overlap: null, pass: true, reasons: [] })
        continue
      }
      const rgb = (r: Raster, x: number, y: number): number => {
        const o = (y * r.width + x) * 4
        return r.rgba[o + 3]! === 0 ? -1 : (r.rgba[o]! << 16) | (r.rgba[o + 1]! << 8) | r.rgba[o + 2]!
      }
      // [포함률, 색 일치율]
      const score = (dx: number, dy: number): [number, number] => {
        let inside = 0
        let same = 0
        for (const [x, y] of pts) {
          const tx = x + dx
          const ty = y + dy
          if (tx < 0 || ty < 0 || tx >= cw || ty >= ch) continue
          const c = rgb(ref, col * cw + tx, row * ch + ty)
          if (c < 0) continue
          inside++
          if (c === rgb(layer, col * cw + x, row * ch + y)) same++
        }
        return [inside / pts.length, same / pts.length]
      }
      const [base, baseMatch] = score(0, 0)
      let best: [number, number] = [0, 0]
      let bestM = baseMatch
      let bestD = 0
      for (let dy = -opts.search; dy <= opts.search; dy++) {
        for (let dx = -opts.search; dx <= opts.search; dx++) {
          const m = score(dx, dy)[1]
          const d = Math.max(Math.abs(dx), Math.abs(dy))
          if (m > bestM + 0.01 || (Math.abs(m - bestM) <= 0.01 && d < bestD)) {
            bestM = m
            best = [dx, dy]
            bestD = d
          }
        }
      }
      let skinOverlap: number | null = null
      if (skin !== null) {
        // 외톨이 피부색(옷 음영이 피부색으로 스냅된 점)은 세지 않는다: 상하좌우 이웃 2개 이상이 피부색이어야 피부
        const isSkin = (x: number, y: number): boolean =>
          x >= 0 && y >= 0 && x < cw && y < ch && skin.has(rgb(ref, col * cw + x, row * ch + y))
        let n = 0
        for (const [x, y] of pts) {
          if (!isSkin(x, y)) continue
          const around = Number(isSkin(x - 1, y)) + Number(isSkin(x + 1, y)) + Number(isSkin(x, y - 1)) + Number(isSkin(x, y + 1))
          if (around >= 2) n++
        }
        skinOverlap = n / pts.length
      }
      const reasons: string[] = []
      if (base < opts.minContainment) reasons.push(`포함률 ${round3(base)} < ${opts.minContainment}`)
      if (bestD > opts.maxShift) reasons.push(`최적 이동 (${best[0]},${best[1]}) > ${opts.maxShift}`)
      if (skinOverlap !== null && skinOverlap > opts.maxSkin) reasons.push(`피부 겹침 ${round3(skinOverlap)} > ${opts.maxSkin}`)
      out.push({
        col,
        row,
        layer_pixels: pts.length,
        containment: round3(base),
        color_match: round3(baseMatch),
        best_shift: best,
        best_color_match: round3(bestM),
        skin_overlap: skinOverlap === null ? null : round3(skinOverlap),
        pass: reasons.length === 0,
        reasons,
      })
    }
  }
  return out
}
