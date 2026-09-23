// 실제 스키마 e2e 팩(fixtures/e2e)을 임시 폴더에 복사하고 기반 팩에 코어 balance 예시를 넣는다(balance 사본을 두지 않는다).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { textSlots } from '../src/core'

const e2e = fileURLToPath(new URL('fixtures/e2e', import.meta.url))
const balance = fileURLToPath(new URL('../../core/test/schema/world/fixtures/balance.json', import.meta.url))
const family = fileURLToPath(new URL('fixtures/e2e/base/text/family.json', import.meta.url))

// 코어 규칙 층이 registerTextSlot으로 등록한 문형은 번들에 없으면 V2다(ARCHITECTURE §3).
// 기반 팩이 실제로 무엇을 등록했는지는 코드가 정하므로 자리값 한 줄을 여기서 만들어 둔다
function coreSlots(): Record<string, unknown>[] {
  const taken = new Set([String((JSON.parse(readFileSync(family, 'utf8')) as { id: string }).id)])
  return textSlots.list().map((s) => s.pattern).filter((id) => !taken.has(id))
    .map((id) => ({ id, variants: ['한 줄'] }))
}

// extra: 임시 폴더 기준 경로 → JSON 값(음성 사례용 팩·파일)
export function stagePacks(extra: Record<string, unknown> = {}): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'tap-e2e-'))
  cpSync(e2e, dir, { recursive: true })
  cpSync(balance, join(dir, 'base', 'balance.json'))
  writeFileSync(join(dir, 'base', 'text', 'core_slots.json'), JSON.stringify(coreSlots()))
  for (const [path, value] of Object.entries(extra)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), JSON.stringify(value))
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}
