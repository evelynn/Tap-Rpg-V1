// RGBA 화면 조각. 정규화 결과와 검수용 확대본을 조립할 때만 쓴다.

export interface Raster {
  width: number
  height: number
  /** width * height * 4 바이트 */
  rgba: Uint8Array
}

export function createRaster(width: number, height: number): Raster {
  return { width, height, rgba: new Uint8Array(width * height * 4) }
}

/** '#RRGGBB' → [r, g, b] */
export function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function fillRect(dst: Raster, x: number, y: number, w: number, h: number, rgb: [number, number, number], alpha = 255): void {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(dst.width, x + w)
  const y1 = Math.min(dst.height, y + h)
  for (let j = y0; j < y1; j++) {
    for (let i = x0; i < x1; i++) blendPixel(dst, i, j, rgb[0], rgb[1], rgb[2], alpha)
  }
}

function blendPixel(dst: Raster, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (a === 0) return
  const o = (y * dst.width + x) * 4
  if (a === 255) {
    dst.rgba[o] = r
    dst.rgba[o + 1] = g
    dst.rgba[o + 2] = b
    dst.rgba[o + 3] = 255
    return
  }
  const t = a / 255
  dst.rgba[o] = Math.round(r * t + dst.rgba[o]! * (1 - t))
  dst.rgba[o + 1] = Math.round(g * t + dst.rgba[o + 1]! * (1 - t))
  dst.rgba[o + 2] = Math.round(b * t + dst.rgba[o + 2]! * (1 - t))
  dst.rgba[o + 3] = Math.max(dst.rgba[o + 3]!, a)
}

/** src의 (sx, sy, w, h) 조각을 dst의 (dx, dy)에 알파를 존중해 덮는다. 밖으로 나간 부분은 버린다. */
export function blit(dst: Raster, src: Raster, dx: number, dy: number, sx = 0, sy = 0, w = src.width, h = src.height): void {
  for (let j = 0; j < h; j++) {
    const ty = dy + j
    const fy = sy + j
    if (ty < 0 || ty >= dst.height || fy < 0 || fy >= src.height) continue
    for (let i = 0; i < w; i++) {
      const tx = dx + i
      const fx = sx + i
      if (tx < 0 || tx >= dst.width || fx < 0 || fx >= src.width) continue
      const o = (fy * src.width + fx) * 4
      blendPixel(dst, tx, ty, src.rgba[o]!, src.rgba[o + 1]!, src.rgba[o + 2]!, src.rgba[o + 3]!)
    }
  }
}

/** 정수배 최근접 확대 */
export function upscale(src: Raster, k: number): Raster {
  const out = createRaster(src.width * k, src.height * k)
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / k)
    for (let x = 0; x < out.width; x++) {
      const so = (sy * src.width + Math.floor(x / k)) * 4
      const o = (y * out.width + x) * 4
      out.rgba[o] = src.rgba[so]!
      out.rgba[o + 1] = src.rgba[so + 1]!
      out.rgba[o + 2] = src.rgba[so + 2]!
      out.rgba[o + 3] = src.rgba[so + 3]!
    }
  }
  return out
}

export function crop(src: Raster, x: number, y: number, w: number, h: number): Raster {
  const out = createRaster(w, h)
  blit(out, src, 0, 0, x, y, w, h)
  return out
}
