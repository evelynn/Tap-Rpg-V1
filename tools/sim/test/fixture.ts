// 테스트용 기반 팩 로더. 팩 검증이 느려 한 번만 읽는다
import { fileURLToPath } from 'node:url'
import type { Content } from '@tap/core'
import { loadContent } from '../src/content'

export const BASE_PACK = fileURLToPath(new URL('../../../content/base', import.meta.url))

let cached: Content | undefined

export function baseContent(): Content {
  cached ??= loadContent([BASE_PACK]).content
  return cached
}
