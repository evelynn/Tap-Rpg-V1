import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decodePng, PngError } from '../src/png'
import { encodePng } from './helpers/png-encode'

function pixel(img: { width: number; rgba: Uint8Array }, x: number, y: number): number[] {
  const o = (y * img.width + x) * 4
  return [img.rgba[o]!, img.rgba[o + 1]!, img.rgba[o + 2]!, img.rgba[o + 3]!]
}

describe('PNG 해석', () => {
  it('RGBA 8비트를 화소 그대로 읽는다', () => {
    const samples = [
      255, 0, 0, 255, 0, 255, 0, 128,
      0, 0, 255, 0, 43, 34, 51, 255,
    ]
    const img = decodePng(encodePng({ width: 2, height: 2, colorType: 6, samples }))
    assert.equal(img.width, 2)
    assert.equal(img.height, 2)
    assert.equal(img.colorType, 6)
    assert.deepEqual(pixel(img, 0, 0), [255, 0, 0, 255])
    assert.deepEqual(pixel(img, 1, 0), [0, 255, 0, 128])
    assert.deepEqual(pixel(img, 1, 1), [43, 34, 51, 255])
  })

  it('스캔라인 필터 0~4를 모두 복원한다', () => {
    const width = 6
    const height = 5
    const samples: number[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        samples.push((x * 17 + y * 5) & 0xff, (x * 3 + y * 29) & 0xff, (x * 41 + y) & 0xff, x === 0 ? 0 : 255)
      }
    }
    const plain = decodePng(encodePng({ width, height, colorType: 6, samples }))
    const filtered = decodePng(encodePng({ width, height, colorType: 6, samples, filters: [0, 1, 2, 3, 4] }))
    assert.deepEqual([...filtered.rgba], [...plain.rgba])
    assert.deepEqual(pixel(filtered, 3, 4), [(3 * 17 + 20) & 0xff, (9 + 116) & 0xff, (123 + 4) & 0xff, 255])
  })

  it('인덱스 PNG를 PLTE·tRNS까지 풀어 준다', () => {
    const img = decodePng(encodePng({
      width: 2,
      height: 1,
      colorType: 3,
      samples: [0, 1],
      palette: [[0, 0, 0], [43, 34, 51]],
      trns: [0, 255],
    }))
    assert.equal(img.paletteSize, 2)
    assert.equal(img.hasTrns, true)
    assert.deepEqual(pixel(img, 0, 0), [0, 0, 0, 0])
    assert.deepEqual(pixel(img, 1, 0), [43, 34, 51, 255])
  })

  it('회색·RGB는 알파를 255로 채운다', () => {
    const gray = decodePng(encodePng({ width: 2, height: 1, colorType: 0, samples: [0, 200] }))
    assert.deepEqual(pixel(gray, 1, 0), [200, 200, 200, 255])
    const rgb = decodePng(encodePng({ width: 1, height: 1, colorType: 2, samples: [10, 20, 30] }))
    assert.deepEqual(pixel(rgb, 0, 0), [10, 20, 30, 255])
  })

  it('PNG가 아니거나 인터레이스면 거절한다', () => {
    assert.throws(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), PngError)
    const interlaced = encodePng({ width: 1, height: 1, colorType: 6, samples: [0, 0, 0, 0], interlace: 1 })
    assert.throws(() => decodePng(interlaced), /인터레이스/)
  })
})
