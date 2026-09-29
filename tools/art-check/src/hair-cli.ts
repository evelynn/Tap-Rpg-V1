// art:hairfit — 주인공 시트의 칸마다 머리 자세·자리를 찾는다(D88). 그림을 만들지 않고 위치만 잰다.
//   tsx tools/art-check/src/hair-cli.ts
// 입력(assets/ready, 정규화 결과): 시트 <이름>.png의 머리 가림막 <이름>_hairmask.png, REF-H에서 뗀 기본 머리 hair_hr01_48.png(자세 3칸).
// 칸마다 HR01의 세 자세를 ±SEARCH 옮겨 가며 가림막과 겹침(IoU)이 가장 큰 자세·이동을 고른다. HR01이 게임 시트 머리와 같은
// 머리 모양이라(V06-21 REF-H에서 뗌) 이 자리에 다른 머리 모양(HR02~06)을 얹으면 머리에 맞는다.
// 결과: assets/ready/chr_hair_fit.json. 화면(apps/desktop/ui/src/hair.ts)이 이 자리로 머리를 떼고 얹는다.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, type PngImage } from './png'

const DIR = 'assets/ready'
export const SHEETS = ['chr_actions18_48', 'chr_actions11_48', 'chr_actions9_48', 'chr_walk12_48'] as const
export const CELL = 48
export const SEARCH = 16
/** 이보다 겹침이 낮으면 보고한다(사람이 보고 판단) */
export const MIN_IOU = 0.6

export interface Fit { cell: number; pose: number; dx: number; dy: number; iou: number }

type Pts = [number, number][]

function cellPoints(img: PngImage, cx: number, cy: number): Pts {
  const out: Pts = []
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) if (img.rgba[((cy * CELL + y) * img.width + cx * CELL + x) * 4 + 3]! > 0) out.push([x, y])
  }
  return out
}

/** 가림막 점들과 자세별 머리 점들 → 가장 잘 겹치는 자세·이동. 같으면 앞 자세·작은 이동(탐색 순서) */
export function bestFit(mask: Pts, poses: Pts[], search = SEARCH): Omit<Fit, 'cell'> {
  const inMask = new Set(mask.map(([x, y]) => y * 1000 + x))
  let best = { pose: 0, dx: 0, dy: 0, iou: -1 }
  const order: [number, number][] = []
  for (let dy = -search; dy <= search; dy++) for (let dx = -search; dx <= search; dx++) order.push([dx, dy])
  order.sort((a, b) => Math.max(Math.abs(a[0]), Math.abs(a[1])) - Math.max(Math.abs(b[0]), Math.abs(b[1])))
  poses.forEach((h, pose) => {
    for (const [dx, dy] of order) {
      let inter = 0
      for (const [x, y] of h) if (inMask.has((y + dy) * 1000 + x + dx)) inter++
      const iou = inter / (mask.length + h.length - inter)
      if (iou > best.iou + 1e-9) best = { pose, dx, dy, iou }
    }
  })
  return { ...best, iou: Math.round(best.iou * 1000) / 1000 }
}

function main(): void {
  const hr01 = decodePng(readFileSync(join(DIR, 'hair_hr01_48.png')))
  const poses = [0, 1, 2].map((p) => cellPoints(hr01, p, 0))
  const out: Record<string, Fit[]> = {}
  const low: string[] = []
  for (const name of SHEETS) {
    const mask = decodePng(readFileSync(join(DIR, `${name}_hairmask.png`)))
    const cols = mask.width / CELL
    const rows = mask.height / CELL
    const fits: Fit[] = []
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const m = cellPoints(mask, cx, cy)
        if (!m.length) continue
        const f = { cell: cy * cols + cx, ...bestFit(m, poses) }
        if (f.iou < MIN_IOU) low.push(`${name} 칸 ${f.cell} 겹침 ${f.iou}`)
        fits.push(f)
      }
    }
    out[name] = fits
    const ious = fits.map((f) => f.iou)
    process.stdout.write(`${name}: ${fits.length}칸 · 겹침 최소 ${Math.min(...ious)} 중앙 ${ious.sort()[ious.length >> 1]}\n`)
  }
  writeFileSync(join(DIR, 'chr_hair_fit.json'), JSON.stringify({ version: 1, cell: CELL, base_hair: 'hair_hr01_48', sheets: out }, null, 1) + '\n')
  for (const l of low) process.stdout.write(`! ${l}\n`)
}

if (process.argv[1]?.endsWith('hair-cli.ts')) main()
