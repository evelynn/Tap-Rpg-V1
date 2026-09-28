// art:native — assets/ready의 배경 띠(json의 source·band)를 원본 도트 그대로 다시 뽑는다(D83).
//   tsx tools/art-check/src/native-cli.ts [이름 앞부분 …] [--period 5.3]   (기본: bg_. --period는 json에 고정된다)
// 결과: assets/ready/<이름>.png(원본 도트 수 그대로, 자르지 않는다 D84)와 json의 size·native 칸. 원본(assets/_imagegen)은 읽기만 한다.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng } from './png'
import { encodeRgbaPng } from './png-write'
import { crop, extractNative } from './native'

const DIR = 'assets/ready'
const argv = process.argv.slice(2)
let period: [number, number] | undefined
const prefixes: string[] = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--period') {
    const p = Number(argv[++i])
    period = [p, p]
  } else prefixes.push(argv[i]!)
}
if (!prefixes.length) prefixes.push('bg_')

let n = 0
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const name = f.slice(0, -5)
  if (!prefixes.some((p) => name.startsWith(p))) continue
  const meta = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Record<string, unknown>
  if (meta.role !== 'strip' || typeof meta.source !== 'string' || !Array.isArray(meta.band)) continue
  const [bx, by, bw, bh] = meta.band as number[]
  const src = decodePng(readFileSync(meta.source))
  const band = crop(src, bx!, by!, bw!, bh!)
  // 주기를 손으로 정한 그림(--period, 자동이 두 배로 잘못 잴 때)은 json에 고정해 다음 일괄 실행에도 그 값을 쓴다
  const prev = meta.native as { period?: [number, number]; period_fixed?: boolean } | undefined
  const fixed = period ?? (prev?.period_fixed ? prev.period : undefined)
  const nat = extractNative(band, fixed)
  const img = nat.image
  writeFileSync(join(DIR, `${name}.png`), encodeRgbaPng(img.width, img.height, img.rgba))
  meta.size = [img.width, img.height]
  meta.native = {
    period: nat.period, ...(fixed ? { period_fixed: true } : {}), phase: nat.phase, dots: [img.width, img.height],
    note: '원본 도트 한 칸 = 게임 화소 한 칸(D83). 자르지 않고 게임이 높이 128 창 아래에 붙여 그린다(D84)',
  }
  writeFileSync(join(DIR, f), `${JSON.stringify(meta, null, 2)}\n`)
  console.log(`${name}\t주기 ${nat.period.join('×')}\t도트 ${img.width}×${img.height}`)
  n++
}
console.log(`${n}장을 원본 도트로 다시 뽑았다`)
