// 운명 선택 창(03 §6, 440 × 420): 중요 선택 표식을 누르면 연다. 선택지마다 이익·대가·되돌림, 판정이면 성공 확률(5% 단위).
// 되돌릴 수 없는 선택은 3초 안에 두 번 눌러 확정한다. `나중에 결정`·Esc는 창만 닫는다(보류 유지).
// 별빛 길이 있는 사건이면 `별빛으로 비추기` 단추로 가호 `숨은 길`을 쓴다(D78).
import { eventSuccessChance, illuminate, illuminateBlock, submitChoice, type World } from '@tap/core'
import { button, h } from './detail/view'

interface ChoicePreview { label: string; benefit?: string; cost?: string; reversible?: boolean }

const CONFIRM_MS = 3000
const REVERSIBLE = { yes: '되돌릴 수 있음', no: '되돌릴 수 없음' } as const
const BLOCK_TEXT: Record<string, string> = {
  no_charge: '별빛이 모자랍니다', life_cap: '이번 생애에는 더 쓸 수 없습니다(3번)', no_target: '이 선택에는 비출 길이 없습니다',
}

export class ChoiceWindow {
  private picked: string | null = null
  private confirmUntil = 0
  private readonly body: HTMLElement
  private readonly title: HTMLElement
  private readonly foot: HTMLElement

  constructor(private readonly root: HTMLElement, private readonly world: World, private readonly onDone: () => void) {
    this.title = h('div', { class: 'd-title' })
    this.body = h('div', { class: 'd-body' })
    this.foot = h('div', { class: 'd-foot' })
    root.replaceChildren(h('div', { class: 'd-head' }, this.title, button('×', () => this.hide(), { title: '나중에 결정 (Esc)' })), this.body, this.foot)
    root.hidden = true
    root.tabIndex = -1
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide() })
  }

  get visible(): boolean {
    return !this.root.hidden
  }

  show(): void {
    if (!this.world.state.pending_choice) return
    const was = this.visible
    this.root.hidden = false
    this.render()
    if (!was) this.root.focus() // 연 순간에만 포커스(03 §1)
  }

  hide(): void {
    this.root.hidden = true
    this.picked = null
  }

  render(): void {
    if (!this.visible) return
    const w = this.world
    const p = w.state.pending_choice
    if (!p) return this.hide()
    const ev = w.content.get('event', p.event_id)
    this.title.textContent = `중요한 선택 · ${ev.name}`
    const pr = p.preview_rendered as { body?: string; note?: string; choices?: Record<string, ChoicePreview> }
    const scope = { place: p.location, vars: (p.context.vars ?? {}) as Record<string, string>, eventId: ev.id }
    const list = h('div', {})
    for (const id of p.choices_visible) {
      if (p.excluded.includes(id)) continue
      const c = ev.choices.find((x) => x.id === id)
      const pv = pr.choices?.[id]
      if (!c || !pv) continue
      const chance = c.check ? Math.round(eventSuccessChance(w, w, c.check, scope) * 20) * 5 : null
      const row = h('div', { class: `d-choice${this.picked === id ? ' on' : ''}${c.starlight ? ' star' : ''}`, role: 'radio', 'aria-checked': String(this.picked === id), tabindex: '0' },
        h('div', { class: 'd-strong' }, `${this.picked === id ? '●' : '○'} ${c.starlight ? '✦ ' : ''}${pv.label}`),
        pv.benefit ? h('div', { class: 'd-sub' }, `이익: ${pv.benefit}`) : null,
        pv.cost ? h('div', { class: 'd-sub' }, `대가: ${pv.cost}`) : null,
        h('div', { class: 'd-sub d-dim' }, `${pv.reversible ? REVERSIBLE.yes : REVERSIBLE.no}${chance !== null ? ` · 성공 확률 약 ${chance}%` : ''}`))
      const pick = (): void => {
        this.picked = id
        this.confirmUntil = 0
        this.render()
      }
      row.onclick = pick
      row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') pick() }
      list.append(row)
    }
    const scroll = this.body.scrollTop
    this.body.replaceChildren(...[
      pr.body ? h('div', { class: 'd-sec' }, pr.body) : null,
      pr.note ? h('div', { class: 'd-note' }, pr.note) : null,
      list,
    ].filter((n): n is HTMLElement => n !== null))
    this.body.scrollTop = scroll

    // 상태줄 + 단추줄(03 §6.1): 별빛으로 비추기 · 나중에 결정 · 선택(되돌릴 수 없으면 두 번)
    const acts: HTMLElement[] = []
    if (ev.choices.some((c) => c.starlight) && !p.illuminated) {
      const block = illuminateBlock(w)
      acts.push(button(`✦ 별빛으로 비추기 (별빛 ${w.content.balance.blessing.costs.illuminate})`, () => { illuminate(w); this.render() },
        { disabled: block !== null, ...(block ? { title: BLOCK_TEXT[block] ?? '' } : {}) }))
    }
    const irreversible = this.picked !== null && pr.choices?.[this.picked]?.reversible === false
    const confirming = irreversible && performance.now() < this.confirmUntil
    acts.push(
      h('span', { class: 'd-grow' }),
      button('나중에 결정', () => this.hide()),
      button(confirming ? '정말 고르기' : '선택', () => this.submit(irreversible, confirming), { disabled: this.picked === null }),
    )
    this.foot.replaceChildren(
      h('div', { class: 'd-dim' }, `방침: ${w.state.policies.fate_handling === 'hold' ? '보류하고 기다림 · 나이가 멈춰 있음' : '거절하고 계속'}`),
      h('div', { class: 'd-acts' }, ...acts),
    )
  }

  private submit(irreversible: boolean, confirming: boolean): void {
    if (!this.picked) return
    if (irreversible && !confirming) {
      this.confirmUntil = performance.now() + CONFIRM_MS
      this.render()
      setTimeout(() => this.render(), CONFIRM_MS + 50)
      return
    }
    submitChoice(this.world, this.picked, this.world.ports)
    this.picked = null
    if (this.world.state.pending_choice) this.render() // 다시 고르기(reopen_choices)
    else {
      this.hide()
      this.onDone()
    }
  }
}
