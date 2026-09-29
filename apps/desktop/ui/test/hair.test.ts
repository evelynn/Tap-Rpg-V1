// 머리 합성(D88): 도구가 잰 자리(chr_hair_fit.json)로 기본 머리를 떼고 고른 머리를 얹는다
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodePng } from '../../../../tools/art-check/src/png'
import { HAIR_STYLES, HAIR_TONES, composeHair, hairFile, toneOf, type HairFitFile, type Rgba } from '../src/hair'
import { SHEETS } from '../src/sprites'

const READY = fileURLToPath(new URL('../../../../assets/ready/', import.meta.url))
const img = (name: string): Rgba => {
  const p = decodePng(readFileSync(`${READY}${name}.png`))
  return { width: p.width, height: p.height, data: new Uint8ClampedArray(p.rgba) }
}
const fits = JSON.parse(readFileSync(`${READY}chr_hair_fit.json`, 'utf8')) as HairFitFile
const HERO = ['chr18', 'chr11', 'chr9', 'walk'].map((k) => SHEETS[k]!.file)

describe('머리 합성(D88)', () => {
  it('주인공 시트 4장 모든 내용 칸에 머리 자리가 있다', () => {
    for (const f of HERO) {
      const mask = img(`${f}_hairmask`)
      const cols = mask.width / 48
      const withHair = new Set<number>()
      for (let i = 0; i < mask.data.length / 4; i++) if (mask.data[i * 4 + 3]! > 0) withHair.add(Math.floor(i / mask.width / 48) * cols + Math.floor((i % mask.width) / 48))
      assert.deepEqual(new Set(fits.sheets[f]!.map((x) => x.cell)), withHair, f)
    }
  })

  it('HR01로 다시 얹으면 원래 머리 자리의 80% 이상이 머리로 남고(안쪽 구멍은 채움, 머리를 돌린 chr11이 가장 낮다), 머리 밖 화소는 그대로다(오라클)', () => {
    for (const f of HERO) {
      const base = img(f)
      const mask = img(`${f}_hairmask`)
      const out = composeHair(base, mask, img(hairFile('HR01')), fits.sheets[f]!, 'hair_chestnut')
      let m = 0
      let covered = 0
      for (let i = 0; i < base.data.length; i += 4) {
        const inMask = mask.data[i + 3]! > 0
        if (inMask) { m++; if (out.data[i + 3]! > 0) covered++ }
        // 머리 자리도 빈 곳도 아닌(얼굴·몸·칼) 화소는 바뀌지 않는다
        else if (base.data[i + 3]! > 0) assert.deepEqual([...out.data.slice(i, i + 4)], [...base.data.slice(i, i + 4)], `${f} 화소 ${i / 4}`)
      }
      assert.ok(covered / m >= 0.8, `${f} 덮임 ${(covered / m).toFixed(3)}`)
    }
  })

  it('6종 × 6색이 모두 다르고, 머리 화소는 윤곽 + 고른 계열 2톤뿐이다', () => {
    const base = img('chr_actions18_48')
    const mask = img('chr_actions18_48_hairmask')
    const seen = new Set<string>()
    for (const style of HAIR_STYLES) {
      const hair = img(hairFile(style))
      for (const color of Object.keys(HAIR_TONES)) {
        const out = composeHair(base, mask, hair, fits.sheets.chr_actions18_48!, color)
        let h = 0
        for (let i = 0; i < out.data.length; i += 4) h = (h * 31 + out.data[i]! * 7 + out.data[i + 1]! * 3 + out.data[i + 2]! + out.data[i + 3]!) >>> 0
        seen.add(`${h}`)
        if (color === 'hair_wheat') {
          const allowed = new Set(['#2B2233', ...HAIR_TONES.hair_wheat!].map((x) => x.toLowerCase()))
          for (let i = 0; i < out.data.length; i += 4) {
            if (mask.data[i + 3]! > 0 && out.data[i + 3]! > 0 && base.data[i + 3]! > 0) {
              const hex = `#${[0, 1, 2].map((k) => out.data[i + k]!.toString(16).padStart(2, '0')).join('')}`
              assert.ok(allowed.has(hex), `${style} ${hex}`)
            }
          }
        }
      }
    }
    assert.equal(seen.size, 36)
  })

  it('톤 나누기: 가장 어두운 쪽 윤곽, 나머지는 중앙값으로 밝음·그늘', () => {
    assert.deepEqual(toneOf([[20, 20, 20], [200, 180, 100], [120, 80, 50], [210, 190, 110], [110, 70, 40], [215, 195, 115], [115, 75, 45], [205, 185, 105], [118, 78, 48]]), [0, 1, 2, 1, 2, 1, 2, 1, 2])
  })
})
