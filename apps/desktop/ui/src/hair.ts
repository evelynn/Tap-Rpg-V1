// 주인공 머리 합성(D88): 게임 시트의 기본 머리(HR01)를 머리 가림막으로 떼고, 고른 머리 모양(HR01~06, 자세 3칸)을
// 칸마다 도구가 잰 자리(assets/ready/chr_hair_fit.json, art:hairfit)에 얹고, 머리색 6계열(15 §2.2) 2톤으로 바꾼다.
// 화소를 새로 그리지 않는다 — 생성 그림의 화소를 옮기고(D66) 팔레트 색만 바꾼다(머리 레이어 3색: 윤곽 + 2톤, 15 §2.2).
// 얹는 자리: 기본 머리가 있던 곳이나 빈 곳만. 얼굴·손·칼처럼 머리 앞에 있던 화소는 그대로 둔다.

export interface HairFit { cell: number; pose: number; dx: number; dy: number }
export interface HairFitFile { cell: number; sheets: Record<string, HairFit[]> }

export interface Rgba { width: number; height: number; data: Uint8ClampedArray }

// 15 §2.2 머리색 6계열 × 2톤(밝음, 그늘)
export const HAIR_TONES: Record<string, [string, string]> = {
  hair_darkbrown: ['#4A3A32', '#2F2420'],
  hair_chestnut: ['#7A4E30', '#553420'],
  hair_auburn: ['#A4523A', '#743426'],
  hair_wheat: ['#D8B868', '#A8883E'],
  hair_ash: ['#9A948C', '#6E6862'],
  hair_blueblack: ['#3A4458', '#262E3E'],
}
// 15 §5.1 노년 흰머리 팔레트
export const WHITE_TONES: [string, string] = ['#E8E4DC', '#C8C2B8']
export const HAIR_STYLES = ['HR01', 'HR02', 'HR03', 'HR04', 'HR05', 'HR06'] as const

// 채도만 k배(HSL). 15 §5.1 숙련기 `머리색 채도 −35%`
export function desaturate(hex: string, k: number): string {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return hex
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  const s2 = s * k
  const c = (1 - Math.abs(2 * l - 1)) * s2
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return `#${[r1, g1, b1].map((v) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** 나이에 따른 머리 2톤(15 §5.1): 50~64 채도 −35%, 65 이상 흰머리. 흡혈귀는 변이 때 색을 지킨다(§5.2) */
export function hairTones(color: string, age: number, vampire = false): [string, string] {
  const t = HAIR_TONES[color] ?? HAIR_TONES.hair_chestnut!
  if (vampire) return t
  if (age >= 65) return WHITE_TONES
  if (age >= 50) return [desaturate(t[0], 0.65), desaturate(t[1], 0.65)]
  return t
}
export const hairFile = (style: string): string => `hair_${style.toLowerCase()}_48`
export const OUTLINE = '#2B2233'

const rgb = (hex: string): [number, number, number] => [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)]
const lum = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b

/**
 * 머리 화소 → 톤(0 윤곽 · 1 밝음 · 2 그늘). 가장 어두운 1/8 가운데 명도 60 미만은 윤곽,
 * 나머지는 그 명도 중앙값(짝수면 가운데 둘의 평균)보다 밝으면 밝음
 */
export function toneOf(pixels: [number, number, number][]): number[] {
  const ls = pixels.map(([r, g, b]) => lum(r, g, b))
  const sorted = [...ls].sort((a, b) => a - b)
  if (!sorted.length) return []
  const dark = sorted[Math.max(0, sorted.length >> 3)]!
  const isOutline = (l: number): boolean => l <= dark && l < 60
  const rest = sorted.filter((l) => !isOutline(l))
  const k = rest.length
  const mid = k === 0 ? 0 : k % 2 ? rest[k >> 1]! : (rest[k / 2 - 1]! + rest[k / 2]!) / 2
  return ls.map((l) => (isOutline(l) ? 0 : l > mid ? 1 : 2))
}

/**
 * base·mask: 같은 크기의 주인공 시트와 그 머리 가림막. hair: 머리 레이어(48 × 48 자세 3칸 가로).
 * 반환: 새 시트(base는 바꾸지 않는다). 자리가 없는 칸(가림막이 빈 칸)은 그대로다.
 */
export function composeHair(base: Rgba, mask: Rgba, hair: Rgba, fits: readonly HairFit[], color: string | [string, string], cellSize = 48): Rgba {
  const out = new Uint8ClampedArray(base.data)
  const W = base.width
  const cols = Math.floor(W / cellSize)
  const tones = Array.isArray(color) ? color : HAIR_TONES[color] ?? HAIR_TONES.hair_chestnut!
  const pal = [rgb(OUTLINE), rgb(tones[0]), rgb(tones[1])]
  // 자세별 머리 화소와 톤(한 번만)
  const poses = [0, 1, 2].map((p) => {
    const pts: [number, number][] = []
    const cs: [number, number, number][] = []
    for (let y = 0; y < cellSize; y++) {
      for (let x = 0; x < cellSize; x++) {
        const i = (y * hair.width + p * cellSize + x) * 4
        if (hair.data[i + 3]! > 0) { pts.push([x, y]); cs.push([hair.data[i]!, hair.data[i + 1]!, hair.data[i + 2]!]) }
      }
    }
    return { pts, tone: toneOf(cs) }
  })
  for (const f of fits) {
    const ox = (f.cell % cols) * cellSize
    const oy = Math.floor(f.cell / cols) * cellSize
    const inMask = (x: number, y: number): boolean => mask.data[((oy + y) * W + ox + x) * 4 + 3]! > 0
    const idx = (x: number, y: number): number => ((oy + y) * W + ox + x) * 4
    const p = poses[f.pose]!
    // 1 고른 머리가 덮는 자리(기본 머리 자리·빈 곳만. 얼굴·손·칼 앞에는 얹지 않는다)
    const cover = new Map<number, number>() // y * size + x → 톤
    p.pts.forEach(([hx, hy], k) => {
      const x = hx + f.dx
      const y = hy + f.dy
      if (x < 0 || y < 0 || x >= cellSize || y >= cellSize) return
      if (base.data[idx(x, y) + 3]! > 0 && !inMask(x, y)) return
      cover.set(y * cellSize + x, p.tone[k]!)
    })
    // 2 덮이지 않은 기본 머리: 칸 바깥 빈 곳과 이어지면(기본 머리의 삐친 모양) 떼고, 안에 갇힌 구멍이면 남겨 색만 바꾼다
    const open = (x: number, y: number): boolean => !cover.has(y * cellSize + x) && (inMask(x, y) || base.data[idx(x, y) + 3]! === 0)
    const outside = new Uint8Array(cellSize * cellSize)
    const stack: number[] = []
    for (let t = 0; t < cellSize; t++) for (const [x, y] of [[t, 0], [t, cellSize - 1], [0, t], [cellSize - 1, t]] as const) {
      if (open(x, y) && !outside[y * cellSize + x]) { outside[y * cellSize + x] = 1; stack.push(y * cellSize + x) }
    }
    while (stack.length) {
      const q = stack.pop()!
      const x = q % cellSize
      const y = (q - x) / cellSize
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= cellSize || ny >= cellSize || outside[ny * cellSize + nx] || !open(nx, ny)) continue
        outside[ny * cellSize + nx] = 1
        stack.push(ny * cellSize + nx)
      }
    }
    const kept: [number, number][] = []
    const keptRgb: [number, number, number][] = []
    for (let y = 0; y < cellSize; y++) {
      for (let x = 0; x < cellSize; x++) {
        if (!inMask(x, y) || cover.has(y * cellSize + x)) continue
        const i = idx(x, y)
        if (outside[y * cellSize + x]) out[i + 3] = 0
        else { kept.push([x, y]); keptRgb.push([base.data[i]!, base.data[i + 1]!, base.data[i + 2]!]) }
      }
    }
    const keptTone = toneOf(keptRgb)
    const paint = (x: number, y: number, tone: number): void => {
      const i = idx(x, y)
      const c = pal[tone]!
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255
    }
    kept.forEach(([x, y], k) => paint(x, y, keptTone[k]!))
    for (const [q, tone] of cover) paint(q % cellSize, Math.floor(q / cellSize), tone)
  }
  return { width: base.width, height: base.height, data: out }
}
