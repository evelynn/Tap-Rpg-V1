// 복귀 요약 창(03 §9, 400 × 300): 시작할 때 10분 넘게 정산했으면 스스로 연다(포커스는 가져가지 않는다, 03 §1).
// 머리 한 줄 · 멈춘 까닭 · 최대 6줄 · 단추. 복구·읽기 전용 알림은 맨 위(13 §8.5·§8.7).
import type { SummaryView } from '@tap/core'
import { button, h } from './detail/view'

export interface SummaryActions {
  journal: () => void // 일지 보기
  book: () => void // 생애의 책(생애가 끝났을 때)
  choice: () => void // 선택하러 가기
  succession: () => void // 계승 진행
}

export const SUMMARY_MIN_SEC = 600 // 시작 때 이만큼 넘게 정산했으면 연다(03 §1)
export const SUMMARY_MAX_LINES = 6

export class SummaryWindow {
  constructor(private readonly root: HTMLElement, private readonly act: SummaryActions) {
    root.hidden = true
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide() })
  }

  hide(): void {
    this.root.hidden = true
  }

  show(v: SummaryView | null, notes: string[] = []): void {
    const lines = v ? [...v.lines, ...v.story.map((s) => `· ${s}`)].slice(0, SUMMARY_MAX_LINES) : []
    const acts = h('div', { class: 'd-acts' },
      v?.lifeEnded ? button('생애의 책', () => { this.hide(); this.act.book() }) : button('일지 보기', () => { this.hide(); this.act.journal() }),
      v?.awaiting === 'succession' ? button('계승 진행', () => { this.hide(); this.act.succession() }) : null,
      v?.awaiting === 'fate' || v?.awaiting === 'branch' ? button('선택하러 가기', () => { this.hide(); this.act.choice() }) : null,
      button('닫기', () => this.hide()))
    this.root.replaceChildren(
      h('div', { class: 'd-head' }, h('div', {}, '자리를 비운 동안'), button('×', () => this.hide(), { title: '닫기 (Esc)' })),
      h('div', { class: 'd-body' },
        ...notes.map((n) => h('div', { class: 'd-note' }, n)),
        ...(v ? [
          h('div', { class: 'd-strong' }, v.head),
          ...(v.stop ? [h('div', { class: 'd-sec' }, h('div', { class: 'd-dim' }, '멈춘 까닭'), h('div', {}, v.stop))] : []),
          ...lines.map((l) => h('div', { class: 'd-row' }, l)),
        ] : [])),
      h('div', { class: 'd-foot' }, acts))
    this.root.hidden = false
  }
}
