// 첫 실행 창(03 §12.1, 480 × 560): 저장이 없을 때 한 번. 가문 이름 → 첫 인물 → 태도 → 자리 잡기 → 시작.
// 텍스트 입력이 있어 포커스를 가져간다(03 §10). 고른 값으로 새 가문을 만든다(main.ts newFamily).
import type { Appearance, Content } from '@tap/core'
import { button, h } from './detail/view'

export interface FirstRunResult {
  family: string
  name: string
  seed?: string
  appearance: Appearance
  attitude: string | null
}

// 15 §2.2 머리색 6계열, 머리 모양 6종(HR01~HR06)
export const HAIR_STYLES = ['HR01', 'HR02', 'HR03', 'HR04', 'HR05', 'HR06'] as const
export const HAIR_COLORS = [
  ['hair_darkbrown', '흑갈', '#4A3A32'], ['hair_chestnut', '밤색', '#7A4E30'], ['hair_auburn', '적갈', '#A4523A'],
  ['hair_wheat', '밀빛', '#D8B868'], ['hair_ash', '잿빛', '#9A948C'], ['hair_blueblack', '청흑', '#3A4458'],
] as const
// 03 §12.1 태도 카드 문구 원문
export const ATTITUDE_CARDS: Record<string, string> = {
  stable: '마을 가까이에서 꾸준히 벌고, 다치기 전에 돌아옵니다.',
  adventurous: '낯선 길과 사람을 찾아다닙니다. 수입은 들쭉날쭉합니다.',
  challenging: '깊은 던전에 도전합니다. 자주 다치고 오래 쉽니다.',
}

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!

export class FirstRunWindow {
  private step = 0
  private family = ''
  private name = ''
  private hair: string = 'HR03'
  private color: string = 'hair_chestnut'
  private attitude = 'adventurous'

  static defaultAppearance(): Appearance {
    return { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null }
  }

  // preview: 고른 머리 모양·색의 주인공 대기 1칸(D88 머리 합성). 없으면 기본 모습 그림
  constructor(private readonly root: HTMLElement, private readonly content: Content, private readonly failNote: string | null, private readonly openFolder: () => void,
    private readonly preview: (style: string, color: string) => HTMLCanvasElement | null = () => null) {
    const pool = content.list('name_pool')[0]
    this.family = pool ? pick(pool.family_names) : '모래'
    this.name = pool ? pick(pool.given_names) : '모라'
    this.hair = pick(HAIR_STYLES)
    this.color = pick(HAIR_COLORS)[0]
  }

  ask(): Promise<FirstRunResult> {
    return new Promise((resolve) => {
      this.root.hidden = false
      this.render(resolve)
      this.root.focus()
    })
  }

  private render(done: (r: FirstRunResult) => void): void {
    const pool = this.content.list('name_pool')[0]
    const famOk = [...this.family.trim()].length >= 2 && [...this.family.trim()].length <= 8
    const nameOk = [...this.name.trim()].length >= 1 && [...this.name.trim()].length <= 6
    const input = (value: string, max: number, onInput: (v: string) => void): HTMLElement => {
      const el = h('input', { type: 'text', maxlength: String(max) }) as HTMLInputElement
      el.value = value
      el.oninput = () => { onInput(el.value); okBtn.toggleAttribute('disabled', !(this.step === 0 ? [...el.value.trim()].length >= 2 : [...el.value.trim()].length >= 1)) }
      setTimeout(() => el.focus(), 0)
      return el
    }
    const body = h('div', { class: 'd-body' })
    let canNext = true
    if (this.step === 0) {
      canNext = famOk
      body.append(
        ...(this.failNote ? [h('div', { class: 'd-confirm' }, h('div', {}, this.failNote), h('div', { class: 'd-acts' }, button('폴더 열기', () => this.openFolder())))] : []),
        h('div', { class: 'd-strong' }, '가문 이름을 정합니다'),
        h('div', { class: 'd-note' }, '대를 이어 쓰는 이름입니다. 2~8자.'),
        h('div', { class: 'd-line' }, input(this.family, 8, (v) => { this.family = v }), button('무작위', () => { if (pool) this.family = pick(pool.family_names); this.render(done) })))
    } else if (this.step === 1) {
      canNext = nameOk
      body.append(
        h('div', { class: 'd-strong' }, '첫 인물'),
        h('div', { class: 'd-note' }, '이름은 1~6자입니다.'),
        h('div', { class: 'd-line' }, input(this.name, 6, (v) => { this.name = v }), button('무작위', () => {
          if (pool) this.name = pick(pool.given_names)
          this.hair = pick(HAIR_STYLES)
          this.color = pick(HAIR_COLORS)[0]
          this.render(done)
        })),
        h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, '머리'), h('span', { class: 'd-seg' },
          ...HAIR_STYLES.map((s, i) => button(`${i + 1}`, () => { this.hair = s; this.render(done) }, { on: this.hair === s })))),
        h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, '머리색'), h('span', { class: 'd-seg' },
          ...HAIR_COLORS.map(([id, label, hex]) => {
            const b = button(label, () => { this.color = id; this.render(done) }, { on: this.color === id })
            b.style.borderLeft = `8px solid ${hex}`
            return b
          }))),
        h('div', { class: 'd-preview' }, this.preview(this.hair, this.color) ?? h('div', { class: 'd-hero' })))
    } else if (this.step === 2) {
      body.append(h('div', { class: 'd-strong' }, '어떤 태도로 모험할까요?'), h('div', { class: 'd-note' }, '언제든 바꿀 수 있습니다.'),
        ...[...this.content.list('attitude')].sort((a, b) => a.order - b.order).map((a) => {
          const card = h('div', { class: `d-choice${this.attitude === a.id ? ' on' : ''}`, role: 'radio', tabindex: '0' },
            h('div', { class: 'd-strong' }, `${a.name}${a.id === 'adventurous' ? '  · 추천' : ''}`), h('div', { class: 'd-note' }, ATTITUDE_CARDS[a.id] ?? ''))
          card.onclick = () => { this.attitude = a.id; this.render(done) }
          return card
        }))
    } else if (this.step === 3) {
      body.append(h('div', { class: 'd-strong' }, '자리 잡기'),
        h('div', {}, '작업 표시줄 오른쪽 위에 작게 머뭅니다. 끌어서 옮길 수 있습니다.'),
        h('div', { class: 'd-place' }, h('div', { class: 'd-place-win' })))
    } else {
      body.append(h('div', { class: 'd-strong' }, `${this.family.trim()} 가문의 ${this.name.trim()}`),
        h('div', {}, '준비가 끝났습니다. 시작을 누르면 모험이 시작됩니다.'),
        h('div', { class: 'd-note' }, '스스로 사냥하고 쉬고 돌아옵니다. 그냥 두셔도 됩니다.'))
    }
    const last = this.step === 4
    const okBtn = button(last ? '시작' : '다음', () => {
      if (!last) { this.step++; this.render(done); return }
      this.root.hidden = true
      done({
        family: this.family.trim(), name: this.name.trim(), attitude: this.attitude,
        appearance: { ...FirstRunWindow.defaultAppearance(), hair: this.hair, hair_color: this.color },
      })
    }, { disabled: !canNext })
    this.root.replaceChildren(
      h('div', { class: 'd-head' }, h('div', {}, `처음 시작 ${this.step + 1}/5`)),
      body,
      h('div', { class: 'd-foot' }, h('div', { class: 'd-acts' },
        this.step > 0 ? button('이전', () => { this.step--; this.render(done) }) : null, okBtn)))
  }
}
