// 주인공 모습(D88): 고른 머리 모양·색으로 주인공 시트 4장을 합성해 그림 표(images)의 같은 이름 자리에 넣는다.
// 원본 시트는 따로 들고 있어 머리가 바뀌면(첫 실행·계승) 원본에서 다시 합성한다.
import { SHEETS } from './sprites'
import { HAIR_STYLES, composeHair, hairFile, hairTones, type HairFitFile, type Rgba } from './hair'
import type { Images } from './render'

export const HERO_SHEETS = ['chr18', 'chr11', 'chr9', 'walk'].map((k) => SHEETS[k]!.file)
// 화면이 불러올 머리 그림(가림막 4 + 머리 모양 6)
export const HAIR_FILES = [...HERO_SHEETS.map((f) => `${f}_hairmask`), ...HAIR_STYLES.map(hairFile)]

function pixels(img: CanvasImageSource & { width: number; height: number }): Rgba {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height)
  return { width: d.width, height: d.height, data: d.data }
}

function canvasOf(r: Rgba): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = r.width
  c.height = r.height
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0)
  return c
}

export class HeroLook {
  private readonly base = new Map<string, Rgba>()
  private readonly cache = new Map<string, Rgba>()
  private key = ''

  // images: 불러온 그림 표(주인공 시트 자리를 합성본으로 바꾼다). fits: chr_hair_fit.json(없으면 합성하지 않는다)
  constructor(private readonly images: Images, private readonly fits: HairFitFile | null) {}

  private rgba(file: string): Rgba | null {
    const hit = this.cache.get(file)
    if (hit) return hit
    const img = this.images[file] as (CanvasImageSource & { width: number; height: number }) | undefined
    if (!img || !img.width) return null
    const r = pixels(img)
    this.cache.set(file, r)
    return r
  }

  /** 합성한 시트(없으면 null). style HR01~06, color 15 §2.2 계열 id */
  sheet(file: string, style: string, color: string | [string, string]): Rgba | null {
    if (!this.base.has(file)) { const b = this.rgba(file); if (b) this.base.set(file, b) }
    const base = this.base.get(file)
    const mask = this.rgba(`${file}_hairmask`)
    const hair = this.rgba(hairFile((HAIR_STYLES as readonly string[]).includes(style) ? style : 'HR01'))
    const fits = this.fits?.sheets[file]
    return base && mask && hair && fits ? composeHair(base, mask, hair, fits, color) : null
  }

  /** 그림 표의 주인공 시트를 이 머리로 바꾼다(나이·흡혈귀에 따른 색, 15 §5.1·§5.2). 같은 머리면 아무것도 하지 않는다 */
  apply(style: string, color: string, age = 18, vampire = false): void {
    const tones = hairTones(color, age, vampire)
    const key = `${style}|${tones.join(',')}`
    if (key === this.key) return
    this.key = key
    for (const f of HERO_SHEETS) {
      const r = this.sheet(f, style, tones)
      if (r) this.images[f] = canvasOf(r)
    }
  }

  /** 첫 실행 미리보기: 대기 1칸(48 × 48)을 k배로 */
  preview(style: string, color: string, k = 2): HTMLCanvasElement | null {
    const r = this.sheet(HERO_SHEETS[0]!, style, color)
    if (!r) return null
    const c = document.createElement('canvas')
    c.width = 48 * k
    c.height = 48 * k
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(canvasOf(r), 0, 0, 48, 48, 0, 0, 48 * k, 48 * k)
    return c
  }
}
