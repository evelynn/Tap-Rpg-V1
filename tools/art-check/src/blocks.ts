// 원본 블록 격자 찾기와 블록 가운데 최빈색 표본 — 시트(normalize.ts)와 띠(strip.ts)가 같이 쓴다.
// 생성 그림은 원본 화소 약 S개(정수 아님, 위상 모름)를 한 칸으로 그린다. 칸 경계에는 두 색이 섞인 화소가 끼고
// 면 안에는 작은 잡음이 있다. 논리 화소를 원본 칸들의 평균으로 만들면 가장자리가 흐려지고(띠 옛 방식),
// 원본 화소마다 팔레트로 스냅한 뒤 다수결하면 두 팔레트 색 사이 색의 면이 점무늬가 된다(시트 옛 방식).
//   1 색 묶기(clusterColors): 원본 색을 빈도 순으로 훑어, 이미 있는 대표색과 가중 거리 tol 이하면 그 묶음, 아니면 새 대표.
//     대표색 = 묶음에서 가장 흔한 원본 색 그대로(평균 내지 않는다). 잡음만 모으고 색을 새로 만들지 않는다.
//   2 블록 크기(gradientAcf → blockSize): 색 경계 세기(gradients)의 행 안·열 안 자기상관. 경계가 S 간격이면 S, 2S, 3S …에서
//     솟으므로 지연 2 이상의 첫 봉우리를 잡고, 그 둘레에서 k·S 봉우리 평균이 가장 큰 S로 0.01 단위까지 다듬는다.
//     같은 행 안의 경계끼리 거리만 보므로 칸마다 격자 위상이 달라도(생성 그림은 격자가 고르지 않다) 흔들리지 않는다.
//   3 격자선(fitCuts): 축마다 색 경계 비율 e(x)(그 경계에서 색이 바뀐 행 비율)를 가장 많이 지나는 선 열을 동적 계획으로 찾는다.
//     선 간격은 0.6S ~ 1.4S, 간격이 S에서 벗어나면 벌점 λ·((간격 − S)/S)². 첫·끝 칸은 잘린 칸이라 벌점이 없다.
//     선 수는 안쪽 간격 평균이 S가 되게 맞춘다(선마다 빼는 값 β를 이분 탐색). 전역 주기+위상 하나보다
//     느린 위상 흐름(장면 칸마다 다른 위상)을 따라간다.
//   4 블록 색(blockMode): 블록 가운데 inner(기본 55%) 영역 화소의 최빈 묶음. 배경이 절반을 넘으면 투명.
//     가장자리 섞인 화소는 가운데 영역에 거의 없으므로 최빈색이 면 색이다.
//   5 논리 화소 → 블록: 논리 화소 가운데 점이 든 블록(최근접 블록 가운데)의 색. 원본 블록 크기와 논리 화소 크기가 달라도
//     블록끼리 섞지 않는다(블록이 두 번 쓰이거나 건너뛸 뿐).
//   6 외톨이 접기(foldIslands): 상하좌우 네 이웃이 모두 같은 색 c인 1화소가 c와 가중 거리 tol 미만이면 c로.
//     눈·반짝임처럼 둘레와 먼 색은 남긴다.
import { colorDistance, type SourceImage } from './normalize'

/** 또렷한 표본의 기본값. 시트와 띠가 같이 쓴다 */
export const CRISP = {
  /** 색 묶기 허용 가중 거리(면 안 잡음). 경계 세기도 이 값 이하는 0 */
  clusterTol: 20,
  /** 블록 가운데 영역 비율 */
  inner: 0.55,
  /** 외톨이 접기: 둘레 색과 가중 거리가 이 값 미만이면 잡음 */
  islandTol: 60,
  /** 칸 안 거의 같은 색 합치기(시트): 가중 거리 미만 */
  mergeTol: 26,
  /** 자기상관 최대 지연 */
  maxLag: 64,
  /** 격자선 간격 벌점 */
  lambda: 4,
} as const

/** 묶음 번호 격자. -1 = 제외(배경·다른 칸) */
export interface LabelImage {
  /** 원본 좌표 원점 */
  x0: number
  y0: number
  w: number
  h: number
  labels: Int32Array
}

export interface ColorClusters {
  /** 묶음 대표색 [r, g, b] (묶음에서 가장 흔한 원본 색) */
  colors: [number, number, number][]
  /** 묶음 화소 수 */
  counts: number[]
  /** 원본 색(0xRRGGBB) → 묶음 번호 */
  of: Map<number, number>
}

/**
 * 색 묶기. pixels = 원본 화소 번호(y·W + x) 목록. 빈도 순(같으면 색 값 순)으로 훑어 대표색과 가중 거리 tol 이하인
 * 가장 가까운 묶음에 넣는다. tol 0이면 같은 색만 묶는다.
 */
export function clusterColors(img: SourceImage, pixels: Iterable<number>, tol: number): ColorClusters {
  const hist = new Map<number, number>()
  const d = img.rgba
  for (const p of pixels) {
    const rgb = (d[p * 4]! << 16) | (d[p * 4 + 1]! << 8) | d[p * 4 + 2]!
    hist.set(rgb, (hist.get(rgb) ?? 0) + 1)
  }
  const order = [...hist.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  // 가중 거리 ≤ tol이면 채널 차이는 r·b ≤ tol/√2, g ≤ tol/2 — 한 변이 그보다 큰 상자 격자에서 이웃 상자만 본다
  const cell = Math.max(1, Math.floor(tol / Math.SQRT2) + 1)
  const buckets = new Map<number, number[]>()
  const bkey = (r: number, g: number, b: number): number => (Math.floor(r / cell) * 1024 + Math.floor(g / cell)) * 1024 + Math.floor(b / cell)
  const colors: [number, number, number][] = []
  const counts: number[] = []
  const of = new Map<number, number>()
  for (const [rgb, n] of order) {
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = rgb & 0xff
    let best = -1
    let bestD = Infinity
    if (tol > 0) {
      const cr = Math.floor(r / cell)
      const cg = Math.floor(g / cell)
      const cb = Math.floor(b / cell)
      for (let i = cr - 1; i <= cr + 1; i++) {
        for (let j = cg - 1; j <= cg + 1; j++) {
          for (let k = cb - 1; k <= cb + 1; k++) {
            const list = buckets.get((i * 1024 + j) * 1024 + k)
            if (list === undefined) continue
            for (const c of list) {
              const [cr2, cg2, cb2] = colors[c]!
              const dist = colorDistance(r, g, b, cr2, cg2, cb2)
              if (dist <= tol && dist < bestD) {
                bestD = dist
                best = c
              }
            }
          }
        }
      }
    }
    if (best < 0) {
      best = colors.length
      colors.push([r, g, b])
      counts.push(0)
      const k = bkey(r, g, b)
      const list = buckets.get(k)
      if (list === undefined) buckets.set(k, [best])
      else list.push(best)
    }
    counts[best]! += n
    of.set(rgb, best)
  }
  return { colors, counts, of }
}

/** 원본 사각형의 묶음 번호 격자. include(p)가 거짓이거나 이미지 밖이면 -1 */
export function labelImage(img: SourceImage, cl: ColorClusters, x0: number, y0: number, w: number, h: number, include: (p: number) => boolean): LabelImage {
  const labels = new Int32Array(w * h).fill(-1)
  const d = img.rgba
  for (let y = 0; y < h; y++) {
    const sy = y0 + y
    if (sy < 0 || sy >= img.height) continue
    for (let x = 0; x < w; x++) {
      const sx = x0 + x
      if (sx < 0 || sx >= img.width) continue
      const p = sy * img.width + sx
      if (!include(p)) continue
      labels[y * w + x] = cl.of.get((d[p * 4]! << 16) | (d[p * 4 + 1]! << 8) | d[p * 4 + 2]!) ?? -1
    }
  }
  return { x0, y0, w, h, labels }
}

/**
 * 색 경계 세기 격자. gx[y·w + x] = 화소 (x−1, y)와 (x, y) 사이, gy[y·w + x] = (x, y−1)과 (x, y) 사이.
 * 둘 다 포함 화소면 원본 색의 가중 거리(floor 이하는 0 — 면 안의 잡음), 한쪽만 포함이면 255, 둘 다 제외면 0.
 */
export function gradients(img: SourceImage, x0: number, y0: number, w: number, h: number, include: (p: number) => boolean, floor: number): [Float32Array, Float32Array] {
  const d = img.rgba
  const W = img.width
  const inc = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = y0 + y
    if (sy < 0 || sy >= img.height) continue
    for (let x = 0; x < w; x++) {
      const sx = x0 + x
      if (sx >= 0 && sx < W && include(sy * W + sx)) inc[y * w + x] = 1
    }
  }
  const g = (a: number, b: number, pa: number, pb: number): number => {
    if (!inc[a] && !inc[b]) return 0
    if (!inc[a] || !inc[b]) return 255
    const v = colorDistance(d[pa * 4]!, d[pa * 4 + 1]!, d[pa * 4 + 2]!, d[pb * 4]!, d[pb * 4 + 1]!, d[pb * 4 + 2]!)
    return v > floor ? v : 0
  }
  const gx = new Float32Array(w * h)
  const gy = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const p = (y0 + y) * W + x0 + x
      if (x > 0) gx[i] = g(i - 1, i, p - 1, p)
      if (y > 0) gy[i] = g(i - w, i, p - W, p)
    }
  }
  return [gx, gy]
}

/**
 * 경계 세기의 자기상관(행 안 가로, 열 안 세로를 더한다). acf[k] / acf[0], k = 0 .. maxLag.
 * 같은 행에서 경계끼리의 거리만 보므로 칸마다·물체마다 격자 위상이 달라도 블록 크기를 잴 수 있다.
 */
export function gradientAcf(gx: Float32Array, gy: Float32Array, w: number, h: number, maxLag: number, into?: Float64Array): Float64Array {
  const acf = into ?? new Float64Array(maxLag + 1)
  let mx = 0
  let my = 0
  for (let i = 0; i < w * h; i++) {
    mx += gx[i]!
    my += gy[i]!
  }
  mx /= w * h
  my /= w * h
  for (let k = 0; k <= maxLag; k++) {
    let s = 0
    for (let y = 0; y < h; y++) {
      const row = y * w
      for (let x = 0; x + k < w; x++) s += (gx[row + x]! - mx) * (gx[row + x + k]! - mx)
    }
    for (let y = 0; y + k < h; y++) {
      const a = y * w
      const b = (y + k) * w
      for (let x = 0; x < w; x++) s += (gy[a + x]! - my) * (gy[b + x]! - my)
    }
    acf[k]! += s
  }
  return acf
}

export interface BlockSizeEstimate {
  /** 블록 크기(원본 화소, 0.01 단위) */
  period: number
  /** 첫 봉우리의 두드러짐 A(p) − min(A(2..p)), A = acf / acf[0]. 클수록 격자가 뚜렷하다 */
  prominence: number
}

/**
 * 자기상관에서 블록 크기를 잰다. 경계가 S 간격이면 A는 S, 2S, 3S …에서 솟는다.
 * 1 첫 봉우리: 지연 2 이상에서 처음 나오는 극대 p0(A(p0) > A(p0 − 1), A(p0) ≥ A(p0 + 1))이고 두드러짐이 minProminence 이상.
 *   지연 1은 칸 경계의 섞인 화소(경계가 두 화소에 걸친다) 때문에 늘 높아 보지 않는다. 멀리 있는 큰 구조(2S, 3S, 나무 간격)가
 *   더 높아도 첫 봉우리가 기본 주기다.
 * 2 다듬기: S ∈ [p0 − 0.75, p0 + 0.75]에서 A(k·S)의 평균(k·S ≤ 최대 지연, 분수 지연은 선형 보간)이 가장 큰 S.
 *   먼 봉우리까지 맞추므로 정수가 아닌 블록 크기(예: 5.43)를 0.01 단위로 잡는다.
 * 봉우리가 없으면 null(격자가 없거나 흐리다).
 */
export function blockSize(acf: Float64Array, minProminence = 0.02): BlockSizeEstimate | null {
  const maxLag = acf.length - 1
  if (!(acf[0]! > 0)) return null
  const A = (t: number): number => {
    const i = Math.floor(t)
    if (i >= maxLag) return acf[maxLag]! / acf[0]!
    const f = t - i
    return ((1 - f) * acf[i]! + f * acf[i + 1]!) / acf[0]!
  }
  let p0 = -1
  let prominence = 0
  let low = Infinity
  for (let k = 2; k < maxLag / 2; k++) {
    low = Math.min(low, A(k))
    if (A(k) > A(k - 1) && A(k) >= A(k + 1) && A(k) - low >= minProminence) {
      p0 = k
      prominence = A(k) - low
      break
    }
  }
  if (p0 < 0) return null
  let best = p0
  let bestScore = -Infinity
  for (let k100 = Math.max(200, Math.round((p0 - 0.75) * 100)); k100 <= Math.round((p0 + 0.75) * 100); k100++) {
    const S = k100 / 100
    let s = 0
    let n = 0
    for (let k = 1; k * S <= maxLag; k++, n++) s += A(k * S)
    s /= n
    if (s > bestScore) {
      bestScore = s
      best = S
    }
  }
  return { period: best, prominence: Math.round(prominence * 1000) / 1000 }
}

/** 축별 경계 세기 합. ex[x] = 열 x−1|x 경계(x = 1 .. w−1), ey[y]도 같다. 안쪽 경계 평균이 1이 되게 나눈다 */
export function edgeProfiles(gx: Float32Array, gy: Float32Array, w: number, h: number): [Float64Array, Float64Array] {
  const ex = new Float64Array(w + 1)
  const ey = new Float64Array(h + 1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ex[x]! += gx[y * w + x]!
      ey[y]! += gy[y * w + x]!
    }
  }
  const norm = (e: Float64Array, n: number): Float64Array => {
    let s = 0
    for (let i = 1; i < n; i++) s += e[i]!
    const m = n > 1 ? s / (n - 1) : 0
    if (m > 0) for (let i = 0; i <= n; i++) e[i] = e[i]! / m
    return e
  }
  ex[0] = 0
  ey[0] = 0
  return [norm(ex, w), norm(ey, h)]
}

export interface GridSummary {
  /** 안쪽 격자선 간격 평균 [가로, 세로](안쪽 선이 둘 미만이면 사각형 크기) */
  period: [number, number]
  /** 첫 안쪽 격자선 위치(사각형 기준) [가로, 세로] */
  phase: [number, number]
  /** 블록 수 [가로, 세로](첫·끝 잘린 블록 포함) */
  blocks: [number, number]
  /** 경계 세기 가운데 격자선에 걸린 비율 [가로, 세로]. 칸 경계가 섞인 화소로 두 화소에 걸치면 0.5 안팎이 최대다 */
  edge_fit: [number, number]
}

const r2 = (n: number): number => Math.round(n * 100) / 100

export function summarizeCuts(cutsX: number[], cutsY: number[], ex: Float64Array, ey: Float64Array): GridSummary {
  const one = (cuts: number[], e: Float64Array): [number, number, number, number] => {
    const inner = cuts.slice(1, -1)
    const n = cuts[cuts.length - 1]!
    const period = inner.length >= 2 ? (inner[inner.length - 1]! - inner[0]!) / (inner.length - 1) : n
    let total = 0
    for (let i = 1; i < n; i++) total += e[i]!
    let on = 0
    for (const c of inner) if (Number.isInteger(c)) on += e[c]!
    return [r2(period), r2(inner[0] ?? 0), cuts.length - 1, total > 0 ? r2(on / total) : 0]
  }
  const [px, ox, nx, fx] = one(cutsX, ex)
  const [py, oy, ny, fy] = one(cutsY, ey)
  return { period: [px, py], phase: [ox, oy], blocks: [nx, ny], edge_fit: [fx, fy] }
}

export interface CutOptions {
  /** 간격 벌점 세기 */
  lambda?: number
}

/** 선마다 e[x] − beta를 얻고 간격 벌점을 빼는 동적 계획. 첫 선 0·끝 선 n 포함 */
function cutsFor(e: Float64Array, n: number, period: number, lambda: number, beta: number, gmin: number, gmax: number): number[] {
  const best = new Float64Array(n + 1).fill(-Infinity)
  const from = new Int32Array(n + 1).fill(-1)
  for (let x = 1; x <= Math.min(gmax, n - 1); x++) {
    best[x] = e[x]! - beta
    from[x] = 0
  }
  for (let x = 1; x < n; x++) {
    for (let g = gmin; g <= gmax; g++) {
      const px = x - g
      if (px < 1 || best[px] === -Infinity) continue
      const dev = (g - period) / period
      const v = best[px]! + e[x]! - beta - lambda * dev * dev
      if (v > best[x]!) {
        best[x] = v
        from[x] = px
      }
    }
  }
  let last = -1
  let lastV = -Infinity
  for (let x = Math.max(1, n - gmax); x < n; x++) {
    if (best[x]! > lastV) {
      lastV = best[x]!
      last = x
    }
  }
  if (last < 0) return [0, n]
  const cuts = [n]
  for (let x = last; x > 0; x = from[x]!) cuts.push(x)
  cuts.push(0)
  return cuts.reverse()
}

/** 안쪽 선 간격 평균(안쪽 선이 둘 미만이면 null) */
function meanGap(cuts: number[]): number | null {
  const k = cuts.length - 2
  return k >= 2 ? (cuts[cuts.length - 2]! - cuts[1]!) / (k - 1) : null
}

/**
 * 격자선 위치(0 = 사각형 왼쪽, n = 오른쪽 포함). e[x] = 경계 x의 색 경계 세기(평균 1).
 * 안쪽 선 간격은 [0.6S, 1.4S], 간격 벌점 λ·((간격 − S)/S)², 첫·끝 칸은 1 ~ 1.4S(잘린 칸, 벌점 없음).
 * 선마다 e[x] − β를 얻는다. β는 선 수를 정하는 값이라, 안쪽 간격 평균이 S(±1%)가 되도록 이분 탐색한다
 * — β 없이 e만 더하면 선을 많이 긋는 쪽(간격이 S보다 작은 격자)이 이긴다.
 */
export function fitCuts(e: Float64Array, n: number, period: number, o: CutOptions = {}): number[] {
  const lambda = o.lambda ?? 4
  const gmin = Math.max(1, Math.round(period * 0.6))
  const gmax = Math.max(gmin, Math.round(period * 1.4))
  if (n <= gmax) return [0, n]
  let lo = -8
  let hi = 8
  let best = cutsFor(e, n, period, lambda, 0, gmin, gmax)
  let bestErr = Math.abs((meanGap(best) ?? period) / period - 1)
  for (let it = 0; it < 24 && bestErr > 0.01; it++) {
    const beta = (lo + hi) / 2
    const cuts = cutsFor(e, n, period, lambda, beta, gmin, gmax)
    const g = meanGap(cuts) ?? period
    const err = Math.abs(g / period - 1)
    if (err < bestErr) {
      best = cuts
      bestErr = err
    }
    // β가 크면 선이 줄어 간격이 커진다
    if (g < period) lo = beta
    else hi = beta
  }
  return best
}

/** 선 목록에서 v가 든 칸 번호(cuts[i] ≤ v < cuts[i+1]). 범위 밖이면 -1 */
export function cellOf(cuts: number[], v: number): number {
  if (v < cuts[0]! || v >= cuts[cuts.length - 1]!) return -1
  let lo = 0
  let hi = cuts.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cuts[mid]! <= v) lo = mid
    else hi = mid - 1
  }
  return lo
}

export interface ModeResult {
  /** 최빈 묶음, -1 = 투명(배경이 절반 넘음) */
  label: number
  /** 이긴 묶음이 가운데 영역 화소에서 차지한 비율 */
  purity: number
}

/**
 * [x0, x1) × [y0, y1)(li 좌표, 실수 가능) 블록의 가운데 inner 영역 최빈 묶음.
 * 화소 가운데(x + 0.5)가 영역 안인 화소를 센다(li 밖 화소는 제외 -1로 센다). 영역이 좁아도 블록 가운데 화소 하나는 센다.
 * 같은 수면 블록 전체에서 더 많은 묶음, 그다음 번호가 작은(더 흔한) 묶음.
 */
export function blockMode(li: LabelImage, x0: number, x1: number, y0: number, y1: number, inner: number): ModeResult {
  const span = (a: number, b: number): [number, number] => {
    const m = (a + b) / 2
    const half = Math.max(0.5, ((b - a) * inner) / 2)
    return [Math.ceil(m - half - 0.5), Math.floor(m + half - 0.5)]
  }
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= li.w || y >= li.h ? -1 : li.labels[y * li.w + x]!)
  const [ax, bx] = span(x0, x1)
  const [ay, by] = span(y0, y1)
  const counts = new Map<number, number>()
  let n = 0
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      const v = at(x, y)
      counts.set(v, (counts.get(v) ?? 0) + 1)
      n++
    }
  }
  if (n === 0) return { label: -1, purity: 0 }
  const bg = counts.get(-1) ?? 0
  if (bg * 2 > n) return { label: -1, purity: bg / n }
  let bestN = 0
  let tied: number[] = []
  for (const [v, c] of counts) {
    if (v < 0) continue
    if (c > bestN) {
      bestN = c
      tied = [v]
    } else if (c === bestN) tied.push(v)
  }
  if (tied.length > 1) {
    // 블록 전체 수로 가른다
    const full = new Map<number, number>()
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const v = at(x, y)
        if (tied.includes(v)) full.set(v, (full.get(v) ?? 0) + 1)
      }
    }
    tied.sort((a, b) => (full.get(b) ?? 0) - (full.get(a) ?? 0) || a - b)
  }
  return { label: tied[0]!, purity: bestN / n }
}

/** 선 목록을 간격 period로 앞뒤로 늘려 [lo, hi)를 덮게 한다(레이어 그림이 기준 칸 사각형 밖으로 나갈 때) */
export function extendCuts(cuts: number[], lo: number, hi: number, period: number): number[] {
  const out = [...cuts]
  while (out[0]! > lo) out.unshift(out[0]! - period)
  while (out[out.length - 1]! < hi) out.push(out[out.length - 1]! + period)
  return out
}

/**
 * 외톨이 접기. idx[w·h] = 색 번호(-1 투명). 네 이웃이 모두 같은 불투명 색 c(≠ 자기)이고 가중 거리 < tol이면 c로 바꾼다.
 * 바꾼 화소 수를 돌려준다. 한 번 훑기(바뀐 화소가 다른 외톨이 판정에 쓰이지 않게 원래 값으로 판정).
 */
export function foldIslands(idx: Int32Array | Int16Array, w: number, h: number, rgbOf: (i: number) => [number, number, number], tol: number): number {
  const src = idx.slice()
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      const v = src[p]!
      if (v < 0) continue
      const c = src[p - 1]!
      if (c < 0 || c === v || src[p + 1] !== c || src[p - w] !== c || src[p + w] !== c) continue
      if (colorDistance(...rgbOf(v), ...rgbOf(c)) >= tol) continue
      idx[p] = c
      n++
    }
  }
  return n
}

/**
 * 칸 안 거의 같은 색 합치기. idx = 색 번호(-1 투명). 흔한 색부터, 그보다 드문 색 가운데 가중 거리 < tol인 색을 흔한 색으로 바꾼다.
 * 바꾼 화소 수를 돌려준다.
 */
export function mergeNearColors(idx: Int32Array | Int16Array, rgbOf: (i: number) => [number, number, number], tol: number): number {
  const counts = new Map<number, number>()
  for (const v of idx) if (v >= 0) counts.set(v, (counts.get(v) ?? 0) + 1)
  const order = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([v]) => v)
  const to = new Map<number, number>()
  for (let i = 0; i < order.length; i++) {
    const c = order[i]!
    if (to.has(c)) continue
    for (let j = i + 1; j < order.length; j++) {
      const d = order[j]!
      if (to.has(d)) continue
      if (colorDistance(...rgbOf(c), ...rgbOf(d)) < tol) to.set(d, c)
    }
  }
  let n = 0
  for (let p = 0; p < idx.length; p++) {
    const t = to.get(idx[p]!)
    if (t === undefined) continue
    idx[p] = t
    n++
  }
  return n
}
