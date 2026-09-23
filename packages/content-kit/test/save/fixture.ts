// 저장 어댑터 테스트 도우미: 기반 팩으로 Content와 새 가문 저장 본문을 만든다.
import { fileURLToPath } from 'node:url'
import { Content, createGameWorld, type RawDefs, type SaveBody } from '@tap/core'
import { readPackFiles } from '../../src/pack/read'

const baseDir = fileURLToPath(new URL('../../../../content/base', import.meta.url))

let cached: Content | undefined

export function baseContent(): Content {
  if (cached) return cached
  const files = readPackFiles(baseDir, 'base')
  if (files.issues.length) throw new Error(`기반 팩을 읽지 못했다: ${files.issues[0]!.message}`)
  const defs: RawDefs = {}
  for (const d of files.defs) {
    const byId = (defs[d.kind] ??= {})
    byId[d.id] = d.value
  }
  cached = new Content(defs)
  return cached
}

export function newSaveBody(): SaveBody {
  const world = createGameWorld(baseContent(), {
    familyName: '조약돌',
    familySeed: '0123456789abcdef',
    foundedUtc: 1_789_500_000_000,
    character: {
      name: '모라',
      background: 'bg_river',
      birthSeason: 'spring',
      appearance: { body: 'b1', hair: 'h1', hair_color: 'c1', skin_tone: 's1', decor: [], age_stage_override: null },
    },
  })
  return world.snapshot()
}
