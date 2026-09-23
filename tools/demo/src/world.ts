// 콘텐츠 팩을 읽고 데모용 세계를 만든다. 파일·시계는 이 파일에서만 쓴다(코어는 순수).
import { fileURLToPath } from 'node:url'
import { formatIssue, validateContent } from '@tap/content-kit'
import { Content, createGameWorld, sha256, utf8, type World } from '@tap/core'
import type { DemoArgs } from './args'

export const BASE_PACK = fileURLToPath(new URL('../../../content/base', import.meta.url))

export function loadContent(dir: string = BASE_PACK): Content {
  const { bundle, issues } = validateContent([dir])
  if (!bundle) throw new Error(`콘텐츠를 읽지 못했다:\n${issues.map(formatIssue).join('\n')}`)
  return new Content(bundle.defs)
}

// 가문 씨앗은 16진 16자리다(16 §5.2). 그 모양이 아니면 해시해서 쓴다
export function seedHex(seed: string): string {
  if (/^[0-9a-f]{16}$/.test(seed)) return seed
  return [...sha256(utf8(seed))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 데모 외형(외형 ID는 화면 몫이라 콘텐츠 검사 대상이 아니다)
const APPEARANCE = { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null }

export function createDemoWorld(content: Content, args: DemoArgs): World {
  if (args.attitude && !content.list('attitude').some((a) => a.id === args.attitude)) {
    throw new Error(`모르는 태도: ${args.attitude} (쓸 수 있는 값: ${content.list('attitude').map((a) => a.id).join(', ')})`)
  }
  const world = createGameWorld(content, {
    familyName: args.family,
    familySeed: seedHex(args.seed),
    foundedUtc: Date.now(),
    character: { name: args.name, background: 'bg_river', appearance: APPEARANCE },
  })
  if (args.attitude) world.state.policies.attitude = args.attitude
  return world
}
