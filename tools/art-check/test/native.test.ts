// 원본 도트 그대로(D83): 소수 주기로 그려지고 경계가 번진 도트 그림에서 도트를 그대로 되찾는다
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractNative, type Raster } from '../src/native'

// 도트 nx × ny(무작위 색 8가지)를 주기 P로 그리고, 경계 한 화소를 양쪽 색 평균으로 번지게 한다
function synth(nx: number, ny: number, P: number, seed = 7): { dots: number[][]; img: Raster } {
  let s = seed
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const pal = Array.from({ length: 8 }, () => [Math.floor(rnd() * 256), Math.floor(rnd() * 256), Math.floor(rnd() * 256)])
  const dots = Array.from({ length: ny }, () => Array.from({ length: nx }, () => Math.floor(rnd() * 8)))
  const W = Math.floor(nx * P)
  const H = Math.floor(ny * P)
  const rgba = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = Math.min(nx - 1, Math.floor(x / P))
      const j = Math.min(ny - 1, Math.floor(y / P))
      let c = pal[dots[j]![i]!]!
      const edge = Math.floor((x + 1) / P) !== Math.floor(x / P) && i + 1 < nx
      if (edge) c = c.map((v, k) => (v + pal[dots[j]![i + 1]!]![k]!) >> 1)
      rgba.set([c[0]!, c[1]!, c[2]!, 255], (y * W + x) * 4)
    }
  }
  return { dots: dots.map((r) => r.map((d) => d)), img: { width: W, height: H, rgba } }
}

describe('원본 도트 그대로 옮기기(D83)', () => {
  it('주기 5·번진 경계에서 주기를 되찾고 도트를 1:1로 옮긴다', () => {
    const { dots, img } = synth(80, 30, 5)
    const r = extractNative(img)
    assert.equal(r.period[0], 5)
    assert.deepEqual([r.image.width, r.image.height], [80, 30])
    // 옮긴 색이 원래 도트와 같다(가운데 색을 고르므로 번진 경계에 끌리지 않는다)
    const same = (i: number, j: number, k: number) => r.image.rgba[(j * 80 + i) * 4]! === r.image.rgba[(j * 80 + k) * 4]!
    let ok = 0
    for (let j = 0; j < 30; j++) for (let i = 0; i + 1 < 80; i++) if ((dots[j]![i] === dots[j]![i + 1]) === same(i, j, i + 1)) ok++
    assert.ok(ok / (30 * 79) > 0.97, `이웃 같음 일치 ${ok / (30 * 79)}`)
  })

  it('주기를 손으로 정하면 그 값으로 옮긴다(자동이 두 배로 잴 때, 예: 경계가 딱딱한 소수 주기)', () => {
    const { img } = synth(60, 20, 4.5)
    const r = extractNative(img, [4.5, 4.5])
    assert.deepEqual([r.image.width, r.image.height], [60, 20])
  })
})
