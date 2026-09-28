// 원본 도트 그대로 옮기기(D83): 생성 그림의 도트 한 칸(원본 P 화소, 소수)을 게임 화소 한 칸으로 옮긴다.
// 규격 크기로 늘이거나 줄이지 않으므로 도트를 두 번 쓰거나 빠뜨리지 않는다. 새로 그리지 않고 칸 가운데 색을 고르기만 한다(D66).
//
// 1 주기: 가로·세로 색 변화 세기의 자기상관 A(k)에서 S의 배수 지연 A(S), A(2S) …의 평균이 가장 큰 S(3~9, 0.01 단위).
//   원본 도트 경계가 부드럽게 번져 문턱 없이 세기를 그대로 쓴다. 2S·3S도 봉우리만 지나 점수가 높으므로 S/2·S/3이 95% 이상이면 작은 쪽.
//   도트는 정사각형이라 가로·세로를 더해 한 주기로 잰다. 생성 그림은 한 장 안에서도 도트 크기가 고르지 않아(세밀한 곳 약 3,
//   굵은 곳 약 5화소) 자동 주기는 사람 눈으로 확인하고, 틀리면 --period로 고정한다(native-cli).
// 2 위상: 격자선(o, o + S …) 위의 색 변화 세기 평균이 가장 큰 o.
// 3 칸마다 가운데 절반 네모의 채널별 중앙값을 그 칸 색으로 한다(번진 경계 화소를 피한다).

export interface Raster { width: number; height: number; rgba: Uint8Array }

export interface NativeResult {
  period: [number, number]
  phase: [number, number]
  image: Raster
}

// 축별 색 변화 세기(이웃 화소 RGB 차 합). axis 0 = 가로(열 사이), 1 = 세로(행 사이)
function diffLines(img: Raster, axis: 0 | 1, step: number): Float64Array[] {
  const { width: W, height: H, rgba: d } = img
  const lines: Float64Array[] = []
  const outer = axis === 0 ? H : W
  const inner = axis === 0 ? W : H
  for (let o = 0; o < outer; o += step) {
    const line = new Float64Array(inner - 1)
    for (let i = 0; i + 1 < inner; i++) {
      const a = axis === 0 ? (o * W + i) * 4 : (i * W + o) * 4
      const b = axis === 0 ? a + 4 : a + W * 4
      line[i] = Math.abs(d[a]! - d[b]!) + Math.abs(d[a + 1]! - d[b + 1]!) + Math.abs(d[a + 2]! - d[b + 2]!)
    }
    lines.push(line)
  }
  return lines
}

// 줄마다 평균을 뺀 자기상관을 A(0)으로 나눠 더한다
export function lineAcf(lines: Float64Array[], maxLag: number): Float64Array {
  const acf = new Float64Array(maxLag + 1)
  for (const l of lines) {
    let m = 0
    for (const v of l) m += v
    m /= l.length || 1
    const a = new Float64Array(maxLag + 1)
    for (let k = 0; k <= maxLag; k++) {
      let s = 0
      for (let i = 0; i + k < l.length; i++) s += (l[i]! - m) * (l[i + k]! - m)
      a[k] = s
    }
    if (a[0]! > 0) for (let k = 0; k <= maxLag; k++) acf[k]! += a[k]! / a[0]!
  }
  return acf
}

export function periodFromAcf(acf: Float64Array, lo = 3, hi = 9): number {
  const maxLag = acf.length - 1
  const A = (t: number): number => {
    const i = Math.floor(t)
    if (i >= maxLag) return acf[maxLag]!
    const f = t - i
    return (1 - f) * acf[i]! + f * acf[i + 1]!
  }
  const scores: [number, number][] = []
  for (let k100 = lo * 100; k100 <= hi * 100; k100++) {
    const S = k100 / 100
    let s = 0
    let n = 0
    for (let k = 1; k * S <= maxLag; k++, n++) s += A(k * S)
    scores.push([S, n ? s / n : -Infinity])
  }
  let [best, bestV] = scores[0]!
  for (const [S, v] of scores) if (v > bestV) [best, bestV] = [S, v]
  for (const d of [3, 2]) {
    const S = Math.round((best / d) * 100) / 100
    const hit = scores.find((x) => Math.abs(x[0] - S) < 0.005)
    if (S >= lo && hit && hit[1] >= bestV * 0.95) return S
  }
  return best
}

function phaseOf(lines: Float64Array[], S: number): number {
  const n = lines[0]?.length ?? 0
  const sum = new Float64Array(n)
  for (const l of lines) for (let i = 0; i < n; i++) sum[i]! += l[i]!
  let best = 0
  let bestV = -Infinity
  for (let o10 = 0; o10 < Math.round(S * 10); o10++) {
    const o = o10 / 10
    let s = 0
    let c = 0
    for (let x = o; x < n; x += S, c++) s += sum[Math.round(x)] ?? 0
    const v = c ? s / c : 0
    if (v > bestV) {
      bestV = v
      best = o
    }
  }
  return best + 1 // 격자선은 경계(열 i|i+1) 위치라 칸 시작은 선 + 1
}

export function extractNative(img: Raster, period?: [number, number]): NativeResult {
  const gx = diffLines(img, 0, 3)
  const gy = diffLines(img, 1, 3)
  const both = lineAcf(gx, 64)
  const ay = lineAcf(gy, 64)
  for (let k = 0; k <= 64; k++) both[k]! += ay[k]!
  const auto = period ? 0 : periodFromAcf(both)
  const px = period?.[0] ?? auto
  const py = period?.[1] ?? auto
  const ox = phaseOf(gx, px) % px
  const oy = phaseOf(gy, py) % py
  const nx = Math.floor((img.width - ox) / px)
  const ny = Math.floor((img.height - oy) / py)
  const out = new Uint8Array(nx * ny * 4)
  const { width: W, rgba: d } = img
  const ch: number[][] = [[], [], [], []]
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = ox + (i + 0.5) * px
      const cy = oy + (j + 0.5) * py
      const x0 = Math.round(cx - px / 4)
      const x1 = Math.round(cx + px / 4)
      const y0 = Math.round(cy - py / 4)
      const y1 = Math.round(cy + py / 4)
      for (const c of ch) c.length = 0
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const p = (y * W + x) * 4
          for (let k = 0; k < 4; k++) ch[k]!.push(d[p + k]!)
        }
      }
      const o = (j * nx + i) * 4
      for (let k = 0; k < 4; k++) {
        const s = ch[k]!.sort((a, b) => a - b)
        out[o + k] = s[s.length >> 1]!
      }
    }
  }
  const r = (v: number) => Math.round(v * 100) / 100
  return { period: [r(px), r(py)], phase: [r(ox), r(oy)], image: { width: nx, height: ny, rgba: out } }
}

// 창 높이(64)에 맞춘다: 지면 줄(띠 높이의 56/64)이 y 56에 오도록 위를 자른다. 모자라면 맨 윗줄 색으로 위를 채운다(늘이지 않는다)
export function fitHeight(img: Raster, height = 64, ground = 56): { image: Raster; cropTop: number } {
  const g = Math.round((img.height * ground) / height)
  let top = g - ground
  top = Math.max(Math.min(top, img.height - height), img.height < height ? img.height - height : 0)
  const out = new Uint8Array(img.width * height * 4)
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.max(0, y + top))
    out.set(img.rgba.subarray(sy * img.width * 4, (sy + 1) * img.width * 4), y * img.width * 4)
  }
  return { image: { width: img.width, height, rgba: out }, cropTop: top }
}

export function crop(img: Raster, x: number, y: number, w: number, h: number): Raster {
  const out = new Uint8Array(w * h * 4)
  for (let j = 0; j < h; j++) out.set(img.rgba.subarray(((y + j) * img.width + x) * 4, ((y + j) * img.width + x + w) * 4), j * w * 4)
  return { width: w, height: h, rgba: out }
}
