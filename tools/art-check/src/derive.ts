// 파생 레이어: 옷·무기 레이어를 생성기에게 떼어 달라고 하지 않고, 기준 시트의 화소에서 골라낸다(새 화소를 그리지 않는다).
//   1 남은 화소 = 기준 시트가 불투명한데, 빼는 레이어(몸체·머리카락·얼굴)의 맨 위 화소가 없거나
//                 그 색과 가중 거리 match_distance를 넘는 자리.
//                 생성기가 떼어 낸 몸체·머리카락은 모양은 맞지만 음영을 다시 칠한다(스냅 뒤 같은 색 26~39%) —
//                 거리 0으로 비교하면 남은 화소 대부분이 음영 차이라 허용 거리를 둔다.
//   2 부류 나누기(칸마다, 기준 시트의 스냅 색 → 팔레트 묶음)
//     씨앗   : 남은 화소 가운데 부류의 core 묶음 색. 8방향 덩어리가 min_core 화소 미만이면 버린다(음영 잡티)
//     키우기 : 씨앗에서 남은 화소를 따라 reach 걸음까지, 그 부류의 core·extra 묶음 색만 붙인다.
//              두 부류가 같은 걸음에 닿으면 이웃이 더 많은 쪽, 같으면 목록 앞 부류(모호로 센다)
//     outside 부류(무기): 덩어리마다 빼는 레이어 실루엣 밖 화소가 하나도 없으면 버린다(몸 안의 금속색 음영)
//     inside 부류(옷)   : 씨앗에 닿지 않은 남은 화소 덩어리 가운데 화소 절반 이상이 이 부류의 core·loose 색이고
//                         실루엣 밖 화소가 없는 것(허리끈처럼 옷 몸판과 떨어진 조각)도 가진다
//     가려짐 : 그리기 순서에서 부류보다 위인 빼는 레이어가 불투명한 자리는 그 부류가 가질 수 없다(보이지 않는다)
//   3 어느 부류도 갖지 않은 남은 화소 = 잔여(이유별로 센다)
// 재합성(oracle): 빼는 레이어와 부류 레이어를 그리기 순서(15 §3.1)대로 쌓아 기준 시트와 칸마다 비교한다.
//
// 색 출처 reference(모양은 생성 레이어, 색은 기준 시트):
//   1 보이는 화소 배정 = 기준 불투명 화소는 그 자리를 덮는 맨 위 빼는 레이어의 것이다.
//     같은 재질 = 가중 거리 ≤ match_distance 또는 같은 팔레트 묶음(다시 칠한 음영).
//     맨 위가 같은 재질이 아니고 아래 레이어가 같은 재질이면 아래 레이어의 것(삐져나온 칼 아래 손, 머리카락 앞 팔) —
//     단 그런 화소의 8방향 덩어리가 min_core 이상일 때만(흩어진 점은 다시 칠한 음영 차이다).
//     예외: 그 레이어보다 위에 그리는 부류가 있고(몸체 위 옷) 같은 재질이 아니면 남은 화소
//     (피부 위 소매). 같은 재질이면 레이어에 둔다(크림 속옷 = 크림 겉옷 몸판, 눈으로 구별되지 않는다).
//   2 남은 화소는 위 부류 나누기 규칙 그대로.
//   3 빼는 레이어 산출 = 배정된 화소는 기준 색, 가려진 화소(위 레이어·부류 아래)와 잔여 아래에 드러난 화소는
//     생성기 자기 색(장비를 바꿀 때 필요하다). 기준 실루엣 밖 화소는 버린다(기준에 없는 화소, 1px 어긋남).
import { formatHex } from './manifest'
import { colorDistance } from './normalize'
import { blit, createRaster, type Raster } from './raster'

export interface DeriveClassSpec {
  name: string
  /** 씨앗 색: 팔레트 묶음 이름 또는 '#RRGGBB' */
  core: string[]
  /** 씨앗에 붙을 수만 있는 색(여러 부류가 같이 써도 된다) */
  extra: string[]
  /** outside = 실루엣 밖에 닿는 덩어리만(무기) · inside = 떨어진 조각도 가진다(옷) */
  place: 'inside' | 'outside'
  /**
   * inside 부류가 씨앗 없이 떨어진 조각을 가질 때, 조각 화소 절반 이상이 core 또는 이 색이어야 한다(예: 허리끈 가죽).
   * extra에만 있는 어두운 윤곽색으로 된 조각(눈·윤곽 어긋남)을 옷으로 가져가지 않으려는 것이다
   */
  loose?: string[]
}

/** 그리기 순서(뒤 → 앞) 한 칸. 빼는 레이어면 raster, 부류면 classes 번호 */
export type StackSlot = { layer: string; raster: Raster } | { cls: number }

export interface DeriveInput {
  ref: Raster
  cell: [number, number]
  grid: [number, number]
  /** 내용 칸 여부(행 우선). 빈 칸은 건너뛴다 */
  filled: boolean[]
  order: StackSlot[]
  classes: DeriveClassSpec[]
  /** 스냅된 RGB → 팔레트 묶음 이름 */
  groupOf: (rgb: number) => string | undefined
  /** layer(기본) = 빼는 레이어를 그대로 쓴다 · reference = 모양은 레이어, 보이는 화소의 색은 기준 시트(recolored) */
  colorSource?: 'layer' | 'reference'
}

export interface DeriveOptions {
  matchDistance: number
  reach: number
  minCore: number
}

export const DEFAULT_DERIVE: DeriveOptions = { matchDistance: 100, reach: 3, minCore: 3 }

export interface DeriveCellReport {
  col: number
  row: number
  ref_pixels: number
  leftover: number
  /** 부류 이름 → 가진 화소 */
  assigned: Record<string, number>
  /** 두 부류가 같은 걸음에 닿아 목록 순서로 정한 화소 */
  ambiguous: number
  /** 어느 부류 색도 아니다(피부·머리카락 음영, 얼굴 등) */
  residual_no_class: number
  /** 부류 색이지만 그리기 순서에서 부류보다 위인 빼는 레이어에 가려져 가질 수 없다 */
  residual_blocked: number
  /** 부류 색이지만 씨앗에 닿지 않았고 떨어진 조각 규칙에도 안 맞는다 */
  residual_unreached: number
  /** outside 부류 덩어리인데 실루엣 밖 화소가 없어 버렸다 / core 덩어리가 min_core 미만 */
  residual_rejected: number
  /** 잔여 가운데 이웃 1화소 안에 같은 색(허용 거리 안)의 빼는 레이어 화소가 있는 것 — 레이어가 1화소 어긋난 자리(위 넷과 겹쳐 센다) */
  residual_offset: number
  /** 잔여 화소의 묶음별 수 */
  residual_groups: Record<string, number>
  /** 색 출처 reference일 때만: 빼는 레이어 이름 → 색 바꾸기 통계 */
  layers?: Record<string, LayerColorStats>
  /** 색 출처 reference일 때만: 어느 부류·레이어도 갖지 못한 기준 화소(재합성에서 빠진다) */
  missing?: number
}

/** 색 출처 reference에서 빼는 레이어 하나의 칸별 통계 */
export interface LayerColorStats {
  /** 기준에서 이 레이어가 보이는 화소 — 기준 색을 받는다(grown·absorbed 포함) */
  visible: number
  /** visible 가운데 레이어에도 있던 화소에서 생성기 색과 기준 색이 다른 것 */
  recolored: number
  /** recolored 화소의 가중 거리 합(평균 = shift_sum / recolored) */
  shift_sum: number
  /** 어느 레이어도 덮지 않은 기준 화소를, 이웃한 이 레이어 화소와 기준 색이 가까워 넓혀 받은 것(실루엣 가장자리 1px 어긋남) */
  grown: number
  /** 부류도 이웃 레이어도 갖지 않아 덮고 있던 이 레이어가 기준 색으로 흡수한 남은 화소(분류 못 한 화소 — 눈·허리끈·음영 차이 등) */
  absorbed: number
  /** 기준에서 더 위 레이어·부류 아래에 가려진 화소 — 생성기 색 그대로 둔다 */
  hidden: number
  /** 기준에서 이 레이어보다 아래 것이 보이는 자리라 버린 화소(레이어가 삐져나옴) */
  trimmed: number
  /** 기준 실루엣 밖이라 버린 화소 */
  dropped: number
}

export interface DeriveResult {
  /** classes 순서, 기준 시트와 같은 크기 */
  layers: Raster[]
  cells: DeriveCellReport[]
  /** 색 출처 reference일 때만: order에 나오는 빼는 레이어 순서(뒤 → 앞)대로, 색을 바꾼 레이어 */
  recolored?: { layer: string; raster: Raster }[]
}

const N8: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

const rgbAt = (r: Raster, o: number): number => (r.rgba[o]! << 16) | (r.rgba[o + 1]! << 8) | r.rgba[o + 2]!

function distAt(a: Raster, b: Raster, o: number): number {
  return colorDistance(a.rgba[o]!, a.rgba[o + 1]!, a.rgba[o + 2]!, b.rgba[o]!, b.rgba[o + 1]!, b.rgba[o + 2]!)
}

/** 색 목록 항목이 이 화소 색에 맞는가(묶음 이름 또는 '#RRGGBB') */
function matcher(list: string[], groupOf: (rgb: number) => string | undefined): (rgb: number) => boolean {
  const hex = new Set(list.filter((s) => s.startsWith('#')).map((s) => Number.parseInt(s.slice(1), 16)))
  const groups = new Set(list.filter((s) => !s.startsWith('#')))
  return (rgb) => hex.has(rgb) || groups.has(groupOf(rgb) ?? '')
}

/** 칸 안 8방향 덩어리들. mask가 참인 화소만 */
function components(mask: Uint8Array, w: number, h: number): number[][] {
  const seen = new Uint8Array(w * h)
  const out: number[][] = []
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue
    const comp: number[] = []
    const stack = [s]
    seen[s] = 1
    while (stack.length > 0) {
      const p = stack.pop()!
      comp.push(p)
      const x = p % w
      const y = (p - x) / w
      for (const [dx, dy] of N8) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const n = ny * w + nx
        if (!mask[n] || seen[n]) continue
        seen[n] = 1
        stack.push(n)
      }
    }
    out.push(comp)
  }
  return out
}

export function deriveLayers(input: DeriveInput, opts: DeriveOptions = DEFAULT_DERIVE): DeriveResult {
  const { ref, cell, grid, order, classes, groupOf } = input
  const [cw, ch] = cell
  const K = classes.length
  const layers = classes.map(() => createRaster(ref.width, ref.height))
  const inCore = classes.map((c) => matcher(c.core, groupOf))
  const inPalette = classes.map((c) => matcher([...c.core, ...c.extra], groupOf))
  const inLoose = classes.map((c) => matcher([...c.core, ...(c.loose ?? [])], groupOf))
  // 부류 k보다 위(앞)에 그리는 빼는 레이어들
  const clsPos = classes.map((_, k) => order.findIndex((s) => 'cls' in s && s.cls === k))
  const subtract = order.flatMap((s, i) => ('raster' in s ? [{ name: s.layer, raster: s.raster, pos: i }] : []))
  const byRef = input.colorSource === 'reference'
  const recolored = byRef ? subtract.map((s) => ({ layer: s.name, raster: createRaster(ref.width, ref.height) })) : undefined
  const cells: DeriveCellReport[] = []
  /** 색 출처 reference: 레이어 화소가 기준 화소와 같은 재질인가 = 가중 거리 ≤ match_distance 또는 같은 팔레트 묶음(다시 칠한 음영) */
  const sameMaterial = (r: Raster, o: number): boolean => {
    if (distAt(ref, r, o) <= opts.matchDistance) return true
    const g = groupOf(rgbAt(ref, o))
    return g !== undefined && g === groupOf(rgbAt(r, o))
  }

  for (let row = 0; row < grid[1]; row++) {
    for (let col = 0; col < grid[0]; col++) {
      if (!input.filled[row * grid[0] + col]) continue
      const x0 = col * cw
      const y0 = row * ch
      const n = cw * ch
      const at = (p: number): number => ((y0 + Math.floor(p / cw)) * ref.width + x0 + (p % cw)) * 4
      const leftover = new Uint8Array(n)
      const outside = new Uint8Array(n)
      const allowed: Uint8Array[] = classes.map(() => new Uint8Array(n))
      let refPixels = 0
      const tops: (Raster | null)[] = new Array<Raster | null>(n).fill(null)
      /** 맨 위 빼는 레이어 번호(subtract 순서), 없으면 -1 */
      const topIdx = new Int16Array(n).fill(-1)
      /** 색 출처 reference: 보이는 화소의 주인 레이어 번호(subtract 순서), 없으면 -1 */
      const owner = new Int16Array(n).fill(-1)
      /** 아래 레이어로 내려줄 후보(아래 레이어 번호 + 1). 덩어리가 min_core 미만이면 맨 위 레이어에 둔다 */
      const passDown = new Int16Array(n)
      for (let p = 0; p < n; p++) {
        const o = at(p)
        let top: Raster | null = null
        for (let i = 0; i < subtract.length; i++) {
          if (subtract[i]!.raster.rgba[o + 3]! === 0) continue
          top = subtract[i]!.raster
          topIdx[p] = i
        }
        tops[p] = top
        if (ref.rgba[o + 3]! === 0) continue
        refPixels++
        if (top === null) outside[p] = 1
        if (byRef && top !== null) {
          const t = topIdx[p]!
          if (sameMaterial(top, o)) {
            owner[p] = t
            continue
          }
          // 맨 위 레이어 색이 멀면, 색이 가까운 아래 레이어(칼 가장자리 아래 손 등)
          let low = -1
          for (let i = t - 1; i >= 0 && low < 0; i--) {
            const r = subtract[i]!.raster
            if (r.rgba[o + 3]! > 0 && sameMaterial(r, o)) low = i
          }
          if (low >= 0) {
            owner[p] = t
            passDown[p] = low + 1
            continue
          }
          // 위에 그릴 부류가 없으면 색이 멀어도 맨 위 레이어의 화소(다시 칠한 머리카락)
          if (!clsPos.some((cp) => cp > subtract[t]!.pos)) {
            owner[p] = t
            continue
          }
        } else if (top !== null && distAt(ref, top, o) <= opts.matchDistance) continue
        leftover[p] = 1
        const rgb = rgbAt(ref, o)
        for (let k = 0; k < K; k++) {
          if (!inPalette[k]!(rgb)) continue
          if (subtract.some((s) => s.pos > clsPos[k]! && s.raster.rgba[o + 3]! > 0)) continue
          allowed[k]![p] = 1
        }
      }

      // 내려주기: 다시 칠한 머리카락 속 화소가 몸체의 어두운 음영과 가까워 흩어져 내려가면 머리카락에 구멍이 난다 —
      // min_core 이상 덩어리(머리카락 앞으로 올린 팔, 칼자루를 쥔 손)만 내려준다
      if (byRef) {
        for (const comp of components(Uint8Array.from(passDown, (v) => (v > 0 ? 1 : 0)), cw, ch)) {
          if (comp.length < opts.minCore) continue
          for (const p of comp) owner[p] = passDown[p]! - 1
        }
      }

      // 씨앗: 부류마다 core 색 덩어리(min_core 이상)
      const label = new Int16Array(n).fill(-1)
      const rejected = new Uint8Array(n)
      for (let k = 0; k < K; k++) {
        const core = new Uint8Array(n)
        for (let p = 0; p < n; p++) if (allowed[k]![p] && label[p]! < 0 && inCore[k]!(rgbAt(ref, at(p)))) core[p] = 1
        for (const comp of components(core, cw, ch)) {
          if (comp.length < opts.minCore) {
            for (const p of comp) rejected[p] = 1
            continue
          }
          for (const p of comp) label[p] = k
        }
      }

      // 키우기: 걸음마다 모든 부류를 한꺼번에 넓힌다
      let ambiguous = 0
      for (let step = 0; step < opts.reach; step++) {
        const claims: [number, number][] = []
        for (let p = 0; p < n; p++) {
          if (!leftover[p] || label[p]! >= 0) continue
          const x = p % cw
          const y = (p - x) / cw
          const votes = new Array<number>(K).fill(0)
          for (const [dx, dy] of N8) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue
            const l = label[ny * cw + nx]!
            if (l >= 0 && allowed[l]![p]) votes[l]! += 1
          }
          const best = Math.max(...votes)
          if (best === 0) continue
          const winners = votes.flatMap((v, k) => (v === best ? [k] : []))
          if (winners.length > 1) ambiguous++
          claims.push([p, winners[0]!])
        }
        if (claims.length === 0) break
        for (const [p, k] of claims) label[p] = k
      }

      // outside 부류: 실루엣 밖에 닿지 않는 덩어리는 버린다
      for (let k = 0; k < K; k++) {
        if (classes[k]!.place !== 'outside') continue
        const mask = new Uint8Array(n)
        for (let p = 0; p < n; p++) if (label[p] === k) mask[p] = 1
        for (const comp of components(mask, cw, ch)) {
          if (comp.some((p) => outside[p])) continue
          for (const p of comp) {
            label[p] = -2
            rejected[p] = 1
          }
        }
      }

      // inside 부류: 씨앗에 닿지 않은 떨어진 조각
      const loose = new Uint8Array(n)
      // 덩어리는 부류 색이 아닌 남은 화소까지 이어서 잰다 — 머리카락 덩어리 속 가죽색 조각을 따로 떼어 옷으로 가져가지 않도록
      for (let p = 0; p < n; p++) if (leftover[p] && label[p] === -1) loose[p] = 1
      for (const comp of components(loose, cw, ch)) {
        if (comp.some((p) => outside[p])) continue
        for (let k = 0; k < K; k++) {
          if (classes[k]!.place !== 'inside') continue
          const mine = comp.filter((p) => allowed[k]![p])
          const anchored = mine.filter((p) => inLoose[k]!(rgbAt(ref, at(p)))).length
          if (anchored * 2 < comp.length) continue
          for (const p of mine) label[p] = k
          break
        }
      }

      const assigned: Record<string, number> = {}
      for (const c of classes) assigned[c.name] = 0
      const residualGroups: Record<string, number> = {}
      let leftoverN = 0
      let noClass = 0
      let blocked = 0
      let unreached = 0
      let rejectedN = 0
      let offset = 0
      for (let p = 0; p < n; p++) {
        if (!leftover[p]) continue
        leftoverN++
        const o = at(p)
        const l = label[p]!
        if (l >= 0) {
          assigned[classes[l]!.name]! += 1
          const dst = layers[l]!
          dst.rgba.set(ref.rgba.subarray(o, o + 4), o)
          continue
        }
        const rgb = rgbAt(ref, o)
        const g = groupOf(rgb) ?? formatHex(rgb)
        residualGroups[g] = (residualGroups[g] ?? 0) + 1
        const px = p % cw
        const py = (p - px) / cw
        if (N8.some(([dx, dy]) => {
          const nx = px + dx
          const ny = py + dy
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) return false
          const t = tops[ny * cw + nx]
          const q = at(ny * cw + nx)
          return t != null && colorDistance(ref.rgba[o]!, ref.rgba[o + 1]!, ref.rgba[o + 2]!, t.rgba[q]!, t.rgba[q + 1]!, t.rgba[q + 2]!) <= opts.matchDistance
        })) offset++
        if (rejected[p]) rejectedN++
        else if (!inPalette.some((f) => f(rgb))) noClass++
        else if (allowed.some((a) => a[p])) unreached++
        else blocked++
      }
      let layerStats: Record<string, LayerColorStats> | undefined
      let missing = 0
      if (recolored !== undefined) {
        // 부류가 갖지 않은 남은 화소:
        //   1) 어느 레이어도 덮지 않은 자리(실루엣 가장자리 1px 어긋남)는 이웃한 레이어 화소와 기준 색이 가까우면 그 레이어로 넓힌다
        //   2) 레이어가 덮은 자리는 맨 위 레이어가 흡수한다 — 더 위 레이어로 넓히면 눈(어두운 색)이 앞머리를 따라 머리카락으로 간다
        //   3) 둘 다 아니면 빠짐
        const grown = new Uint8Array(n)
        for (let step = 0; step < Math.max(1, opts.reach); step++) {
          const claims: [number, number][] = []
          for (let p = 0; p < n; p++) {
            if (!leftover[p] || label[p]! >= 0 || owner[p]! >= 0 || topIdx[p]! >= 0) continue
            const o = at(p)
            const x = p % cw
            const y = (p - x) / cw
            const votes = new Array<number>(subtract.length).fill(0)
            for (const [dx, dy] of N8) {
              const nx = x + dx
              const ny = y + dy
              if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue
              const q = ny * cw + nx
              const w = owner[q]!
              if (w < 0) continue
              const oq = at(q)
              if (colorDistance(ref.rgba[o]!, ref.rgba[o + 1]!, ref.rgba[o + 2]!, ref.rgba[oq]!, ref.rgba[oq + 1]!, ref.rgba[oq + 2]!) <= opts.matchDistance) votes[w]! += 1
            }
            let best = -1
            for (let i = 0; i < votes.length; i++) if (votes[i]! > 0 && (best < 0 || votes[i]! >= votes[best]!)) best = i
            if (best >= 0) claims.push([p, best])
          }
          if (claims.length === 0) break
          for (const [p, i] of claims) {
            owner[p] = i
            grown[p] = 1
          }
        }
        const absorbed = new Uint8Array(n)
        for (let p = 0; p < n; p++) {
          if (!leftover[p] || label[p]! >= 0 || owner[p]! >= 0) continue
          if (topIdx[p]! >= 0) {
            owner[p] = topIdx[p]!
            absorbed[p] = 1
          } else missing++
        }
        layerStats = {}
        subtract.forEach((s, i) => {
          const st: LayerColorStats = { visible: 0, recolored: 0, shift_sum: 0, grown: 0, absorbed: 0, hidden: 0, trimmed: 0, dropped: 0 }
          const dst = recolored[i]!.raster
          for (let p = 0; p < n; p++) {
            const o = at(p)
            const mine = s.raster.rgba[o + 3]! > 0
            if (owner[p] === i) {
              if (grown[p]) st.grown++
              else if (absorbed[p]) st.absorbed++
              else st.visible++
              if (mine && !absorbed[p]) {
                const d = distAt(ref, s.raster, o)
                if (d > 0) {
                  st.recolored++
                  st.shift_sum += d
                }
              }
              dst.rgba.set(ref.rgba.subarray(o, o + 4), o)
              continue
            }
            if (!mine) continue
            if (ref.rgba[o + 3]! === 0) {
              st.dropped++
              continue
            }
            // 기준에서 이 레이어보다 아래 것이 보이는 자리 = 이 레이어가 삐져나온 화소(버린다)
            const w = owner[p]!
            const below = w >= 0 ? subtract[w]!.pos < s.pos : label[p]! >= 0 && clsPos[label[p]!]! < s.pos
            if (below) {
              st.trimmed++
              continue
            }
            st.hidden++
            dst.rgba.set(s.raster.rgba.subarray(o, o + 4), o)
          }
          st.shift_sum = Math.round(st.shift_sum)
          layerStats![s.name] = st
        })
      }
      cells.push({
        col,
        row,
        ref_pixels: refPixels,
        leftover: leftoverN,
        assigned,
        ambiguous,
        residual_no_class: noClass,
        residual_blocked: blocked,
        residual_unreached: unreached,
        residual_rejected: rejectedN,
        residual_offset: offset,
        residual_groups: residualGroups,
        ...(layerStats === undefined ? {} : { layers: layerStats, missing }),
      })
    }
  }
  return recolored === undefined ? { layers, cells } : { layers, cells, recolored }
}

export interface RecomposeCell {
  col: number
  row: number
  /** 기준 또는 재합성이 불투명한 화소 수(분모) */
  union: number
  /** 둘 다 불투명하고 색 거리 ≤ match_distance */
  match: number
  /** match / union */
  rate: number
  /** 같은 분모에서 스냅 색이 똑같은 비율(참고) */
  exact_rate: number
  /** 기준은 불투명인데 재합성이 비었다 */
  missing: number
  /** 기준은 투명인데 재합성이 불투명(빼는 레이어가 실루엣 밖으로 나감) */
  extra: number
  /** 둘 다 불투명인데 색이 match_distance를 넘게 다르다 */
  color_off: number
  pass: boolean
}

/** 레이어를 뒤 → 앞 순서로 겹친 한 장 */
export function stackLayers(width: number, height: number, stack: Raster[]): Raster {
  const out = createRaster(width, height)
  for (const r of stack) blit(out, r, 0, 0)
  return out
}

/** 재합성 비교. 내용 칸마다 비율과 합격(rate ≥ minRate) */
export function compareRecompose(
  ref: Raster,
  comp: Raster,
  cell: [number, number],
  grid: [number, number],
  filled: boolean[],
  matchDistance: number,
  minRate: number,
): RecomposeCell[] {
  const [cw, ch] = cell
  const out: RecomposeCell[] = []
  for (let row = 0; row < grid[1]; row++) {
    for (let col = 0; col < grid[0]; col++) {
      if (!filled[row * grid[0] + col]) continue
      let union = 0
      let match = 0
      let exact = 0
      let missing = 0
      let extra = 0
      let off = 0
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const o = ((row * ch + y) * ref.width + col * cw + x) * 4
          const a = ref.rgba[o + 3]! > 0
          const b = comp.rgba[o + 3]! > 0
          if (!a && !b) continue
          union++
          if (a && !b) missing++
          else if (!a && b) extra++
          else {
            const d = distAt(ref, comp, o)
            if (d <= matchDistance) match++
            else off++
            if (d === 0) exact++
          }
        }
      }
      const rate = union === 0 ? 1 : match / union
      out.push({
        col,
        row,
        union,
        match,
        rate: Math.round(rate * 10000) / 10000,
        exact_rate: union === 0 ? 1 : Math.round((exact / union) * 10000) / 10000,
        missing,
        extra,
        color_off: off,
        pass: rate >= minRate,
      })
    }
  }
  return out
}

export interface OverlapCell {
  col: number
  row: number
  derived: number
  other: number
  both: number
  /** 파생 화소 가운데 비교 레이어에도 있는 비율 */
  precision: number
  /** 비교 레이어 화소 가운데 파생에도 있는 비율 */
  recall: number
}

/** 파생 레이어와 비교 레이어(예: 합격한 추출 검)의 칸별 겹침 */
export function compareOverlap(derived: Raster, other: Raster, cell: [number, number], grid: [number, number], filled: boolean[]): OverlapCell[] {
  const [cw, ch] = cell
  const out: OverlapCell[] = []
  const r3 = (v: number): number => Math.round(v * 1000) / 1000
  for (let row = 0; row < grid[1]; row++) {
    for (let col = 0; col < grid[0]; col++) {
      if (!filled[row * grid[0] + col]) continue
      let d = 0
      let t = 0
      let both = 0
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const o = ((row * ch + y) * derived.width + col * cw + x) * 4
          const a = derived.rgba[o + 3]! > 0
          const b = other.rgba[o + 3]! > 0
          if (a) d++
          if (b) t++
          if (a && b) both++
        }
      }
      out.push({ col, row, derived: d, other: t, both, precision: d === 0 ? 1 : r3(both / d), recall: t === 0 ? 1 : r3(both / t) })
    }
  }
  return out
}
