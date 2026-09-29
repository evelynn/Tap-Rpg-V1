// 기본 창 시제품 빌드: 콘텐츠 번들(JSON) + esbuild 묶음 + index.html + 스프라이트를 dist 한 폴더에 모은다.
// dist는 파일 시스템 없이 fetch만 쓰므로 뒤에 Tauri 2 껍데기가 그대로 싣는다.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { formatIssue, validateContent } from '@tap/content-kit'
import { BACKGROUNDS, SHEETS, STRIPS, PROPS } from '../src/sprites'

export const UI_DIR = fileURLToPath(new URL('..', import.meta.url))
export const DIST = join(UI_DIR, 'dist')
const REPO = join(UI_DIR, '../../..')
const READY = join(REPO, 'assets/ready')

// content/base → 번들 {format, packs, content_hash, defs}. 코어 Content.fromBundle이 그대로 읽는다
export function writeContentBundle(out: string, packs: readonly string[] = [join(REPO, 'content/base')]): void {
  const { bundle, issues } = validateContent(packs)
  if (!bundle) throw new Error(`콘텐츠 검증 실패:\n${issues.map(formatIssue).join('\n')}`)
  writeFileSync(out, JSON.stringify(bundle))
}

// 화면이 쓰는 시트·띠만 옮긴다. 아직 없는 그림은 건너뛰고 알린다
function copySprites(): string[] {
  const dir = join(DIST, 'sprites')
  mkdirSync(dir, { recursive: true })
  const missing: string[] = []
  for (const f of new Set([...Object.values(SHEETS).map((s) => s.file), ...Object.values(STRIPS), ...BACKGROUNDS, ...Object.values(PROPS).map((p) => p.file)])) {
    const src = join(READY, `${f}.png`)
    if (existsSync(src)) copyFileSync(src, join(dir, `${f}.png`))
    else missing.push(f)
  }
  return missing
}

export async function buildUi(): Promise<void> {
  mkdirSync(DIST, { recursive: true })
  writeContentBundle(join(DIST, 'content.json'))
  await build({
    entryPoints: [join(UI_DIR, 'src/main.ts')],
    outfile: join(DIST, 'main.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    sourcemap: true,
    logLevel: 'warning',
  })
  copyFileSync(join(UI_DIR, 'index.html'), join(DIST, 'index.html'))
  const missing = copySprites()
  console.log(`빌드 완료: ${DIST}${missing.length ? ` (없는 그림: ${missing.join(', ')})` : ''}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildUi()
