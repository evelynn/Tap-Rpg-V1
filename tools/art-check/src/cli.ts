// 에셋 자동 검사기 진입점.
//   tsx tools/art-check/src/cli.ts check   [--manifest <경로>] [--root <경로>] [--priority P0] [--id <id>] [--require-all] [--json]
//   tsx tools/art-check/src/cli.ts inspect <파일·폴더...> [--manifest <경로>] [--json]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkFile, imageFacts, type FileResult, type FileSource } from './checks'
import { loadManifest, resolveFiles, type Manifest } from './manifest'
import { renderFindings, renderSummary, renderTable, summarize } from './report'
import { decodePng, PngError } from './png'

const PKG_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const DEFAULT_MANIFEST = join(PKG_ROOT, 'docs/art/assets.manifest.json')

export const USAGE = `사용법
  art-check check   [--manifest <경로>] [--root <경로>] [--priority <P0|P1|P2>] [--id <id>] [--require-all] [--allow-empty] [--json]
  art-check inspect <파일·폴더...> [--manifest <경로>] [--json]

check   매니페스트가 정한 규격과 실제 PNG를 대조한다. 오류가 하나라도 있으면 종료 코드 1.
        --allow-empty는 아직 안 그린 칸(M6 빈 칸)을 경고로 낮춘다. 한 시트를 카드 여러 장이 나눠 채우는 동안 쓴다.
inspect 매니페스트에 없는 PNG의 사실만 센다(크기·알파·색 수·격자 나눗셈). 읽기 실패만 종료 코드 2.`

export interface Args {
  command: 'check' | 'inspect' | 'help'
  manifest: string
  root: string | null
  priority: string | null
  ids: string[]
  requireAll: boolean
  allowEmpty: boolean
  json: boolean
  paths: string[]
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: 'help',
    manifest: DEFAULT_MANIFEST,
    root: null,
    priority: null,
    ids: [],
    requireAll: false,
    allowEmpty: false,
    json: false,
    paths: [],
  }
  let i = 0
  const first = argv[0]
  if (first === 'check' || first === 'inspect') {
    args.command = first
    i = 1
  } else if (first === undefined || first === '--help' || first === '-h' || first === 'help') {
    return args
  } else {
    throw new Error(`모르는 명령이다: ${first}`)
  }
  const value = (name: string, given: string | undefined): string => {
    if (given === undefined) throw new Error(`${name}에 값이 없다`)
    return given
  }
  for (; i < argv.length; i++) {
    const a = argv[i]!
    const eq = a.indexOf('=')
    const name = a.startsWith('--') && eq > 0 ? a.slice(0, eq) : a
    const inline = a.startsWith('--') && eq > 0 ? a.slice(eq + 1) : undefined
    const next = (): string => (inline !== undefined ? inline : value(name, argv[++i]))
    switch (name) {
      case '--manifest': args.manifest = next(); break
      case '--root': args.root = next(); break
      case '--priority': args.priority = next(); break
      case '--id': args.ids.push(next()); break
      case '--require-all': args.requireAll = true; break
      case '--allow-empty': args.allowEmpty = true; break
      case '--json': args.json = true; break
      case '--help':
      case '-h': args.command = 'help'; break
      default:
        if (a.startsWith('-')) throw new Error(`모르는 옵션이다: ${a}`)
        args.paths.push(a)
    }
  }
  return args
}

function makeSource(root: string): FileSource {
  return {
    readBinary(rel) {
      try {
        return readFileSync(join(root, rel))
      } catch {
        return null
      }
    },
    readJson(rel) {
      let text: string
      try {
        text = readFileSync(join(root, rel), 'utf8')
      } catch {
        return null
      }
      try {
        return JSON.parse(text) as unknown
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e))
      }
    },
  }
}

function resolveRoot(args: Args, manifest: Manifest, manifestPath: string): string {
  if (args.root !== null) return resolve(args.root)
  return resolve(dirname(manifestPath), manifest.defaults.root)
}

function runCheck(args: Args): number {
  const manifestPath = resolve(args.manifest)
  const manifest = loadManifest(manifestPath)
  const root = resolveRoot(args, manifest, manifestPath)
  const src = makeSource(root)
  let files = resolveFiles(manifest)
  if (args.priority !== null) files = files.filter((f) => f.priority === args.priority)
  if (args.ids.length > 0) files = files.filter((f) => args.ids.includes(f.id))
  if (files.length === 0) throw new Error('고른 조건에 맞는 산출물이 없다')

  const results: FileResult[] = files.map((f) => checkFile(f, src, { allowEmpty: args.allowEmpty }))
  const summary = summarize(results)
  const failed = summary.errors > 0 || (args.requireAll && summary.missing > 0)

  if (args.json) {
    process.stdout.write(JSON.stringify({
      manifest: relative(root, manifestPath).split('\\').join('/'),
      root: root.split('\\').join('/'),
      summary,
      unspecified: manifest.unspecified,
      results,
    }, null, 2) + '\n')
    return failed ? 1 : 0
  }

  process.stdout.write(renderTable(results) + '\n')
  const findings = renderFindings(results)
  if (findings !== '') process.stdout.write('\n지적\n' + findings + '\n')
  if (manifest.unspecified.length > 0) {
    process.stdout.write('\n명세 미정(검사 못 함)\n')
    for (const u of manifest.unspecified) {
      process.stdout.write(`    ${u.files} [${u.card}] — ${u.missing}\n`)
    }
  }
  process.stdout.write('\n' + renderSummary(summary) + '\n')
  if (args.requireAll && summary.missing > 0) {
    process.stdout.write('--require-all: 미제작 파일이 있어 실패로 센다\n')
  }
  return failed ? 1 : 0
}

function listPngs(target: string): string[] {
  const stat = statSync(target)
  if (stat.isFile()) return [target]
  return readdirSync(target)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => join(target, f))
}

function runInspect(args: Args): number {
  if (args.paths.length === 0) throw new Error('검사할 파일이나 폴더를 적어라')
  let palette: Set<number> | null = null
  try {
    const manifest = loadManifest(resolve(args.manifest))
    palette = new Set<number>()
    for (const colors of Object.values(manifest.palettes)) {
      for (const c of colors) palette.add(Number.parseInt(c.slice(1), 16))
    }
  } catch {
    palette = null
  }

  const rows: Record<string, unknown>[] = []
  for (const target of args.paths) {
    const abs = isAbsolute(target) ? target : resolve(target)
    for (const file of listPngs(abs)) {
      const buf = readFileSync(file)
      let facts
      try {
        const img = decodePng(buf)
        facts = imageFacts(img)
        let inPalette = 0
        if (palette !== null) {
          for (let i = 0; i < facts.pixels; i++) {
            if (img.rgba[i * 4 + 3]! === 0) continue
            const k = (img.rgba[i * 4]! << 16) | (img.rgba[i * 4 + 1]! << 8) | img.rgba[i * 4 + 2]!
            if (palette.has(k)) inPalette++
          }
        }
        const grid: Record<string, boolean> = {}
        for (const n of [12, 16, 24, 32, 48, 64]) grid[`${n}`] = facts.width % n === 0 && facts.height % n === 0
        rows.push({
          file: relative(process.cwd(), file).split('\\').join('/'),
          size: `${facts.width}×${facts.height}`,
          color_type: facts.colorType,
          bit_depth: facts.bitDepth,
          opaque: facts.opaque,
          partial_alpha: facts.partialAlpha,
          partial_alpha_pct: Number(((facts.partialAlpha / facts.pixels) * 100).toFixed(2)),
          colors: facts.colors,
          in_palette_pct: palette === null ? null : Number(((inPalette / Math.max(1, facts.opaque)) * 100).toFixed(2)),
          grid_divisible: grid,
        })
      } catch (e) {
        const msg = e instanceof PngError ? e.message : String(e)
        rows.push({ file, error: msg })
      }
    }
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ files: rows }, null, 2) + '\n')
    return 0
  }
  for (const r of rows) {
    if (r['error'] !== undefined) {
      process.stdout.write(`${String(r['file'])}: 읽기 실패 — ${String(r['error'])}\n`)
      continue
    }
    const grid = r['grid_divisible'] as Record<string, boolean>
    const fits = Object.entries(grid).filter(([, ok]) => ok).map(([n]) => n)
    process.stdout.write(
      `${String(r['file'])}\n` +
      `    크기 ${String(r['size'])} · 색타입 ${String(r['color_type'])} · 비트깊이 ${String(r['bit_depth'])}\n` +
      `    불투명 ${String(r['opaque'])} · 반투명 ${String(r['partial_alpha'])}(${String(r['partial_alpha_pct'])}%) · 고유색 ${String(r['colors'])}\n` +
      `    팔레트 안 화소 ${r['in_palette_pct'] === null ? '-' : `${String(r['in_palette_pct'])}%`} · 정수 격자 ${fits.length === 0 ? '없음' : fits.join('/')}\n`,
    )
  }
  return 0
}

export function main(argv: string[]): number {
  let args: Args
  try {
    args = parseArgs(argv)
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${USAGE}\n`)
    return 2
  }
  if (args.command === 'help') {
    process.stdout.write(USAGE + '\n')
    return 0
  }
  try {
    return args.command === 'check' ? runCheck(args) : runInspect(args)
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`)
    return 2
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
