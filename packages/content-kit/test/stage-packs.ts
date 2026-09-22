// 실제 스키마 e2e 팩(fixtures/e2e)을 임시 폴더에 복사하고 기반 팩에 코어 balance 예시를 넣는다(balance 사본을 두지 않는다).
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const e2e = fileURLToPath(new URL('fixtures/e2e', import.meta.url))
const balance = fileURLToPath(new URL('../../core/test/schema/world/fixtures/balance.json', import.meta.url))

// extra: 임시 폴더 기준 경로 → JSON 값(음성 사례용 팩·파일)
export function stagePacks(extra: Record<string, unknown> = {}): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'tap-e2e-'))
  cpSync(e2e, dir, { recursive: true })
  cpSync(balance, join(dir, 'base', 'balance.json'))
  for (const [path, value] of Object.entries(extra)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), JSON.stringify(value))
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}
