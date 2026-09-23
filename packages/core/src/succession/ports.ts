// 사건 포트 중 생애·계승이 맡는 것(services.ts의 deferred를 대신한다).
// WorldOptions.ports로 끼우면 S01의 create_partner와 S02의 create_child_candidate가 실제로 동작한다.
import type { EventPorts, LifePort } from '../events/ports'
import { fateItemPort } from '../life/fate'
import { applyMutation } from '../life/vampire'
import { CHILDHOOD_DETAIL, textLine } from '../life/text'
import { characterOf, type RuleContext } from '../rules/context'
import type { EventWorld } from '../events/scope'
import type { JournalDraft } from '../state/journal'
import { createChildCandidate, makePartner } from './candidates'

const ctxOf = (w: EventWorld): RuleContext => ({ content: w.content, state: w.state, test: () => false })

export function successionLifePort(): LifePort {
  return {
    mutate(w, p) {
      applyMutation(ctxOf(w), p.trait_id)
    },
    createPartner(w) {
      makePartner(ctxOf(w), w.rng.life)
    },
    createChildCandidate(w) {
      createChildCandidate(ctxOf(w), w.rng.life)
    },
  }
}

// WorldOptions.ports에 넣을 조각. base를 주면 헌납 유물 기본 선택(09 §6.2)도 함께 갈아 끼운다.
// base는 기본 어댑터의 포트 묶음이다(sim/services.ts에서 조립할 때 넘긴다)
export function successionPorts(base?: EventPorts): Partial<EventPorts> {
  const life = successionLifePort()
  return base ? { life, item: { ...base.item, ...fateItemPort(base.item) } } : { life }
}

// 12 §2.2 자녀의 어린 시절 기록(마을 귀환 시 chance, 생애 최대 max_per_life)
export function childhoodNote(w: EventWorld): JournalDraft | null {
  const ctx = ctxOf(w)
  const ch = characterOf(ctx)
  const c = w.content.balance.inheritance.childhood
  const key = 'childhood_notes'
  if ((ch.counters[key] ?? 0) >= c.max_per_life || !ch.children.length) return null
  if (!w.rng.life.chance(c.chance)) return null
  const cand = w.state.family.candidates[ch.children[w.rng.life.bounded(ch.children.length)]!]
  if (!cand) return null
  ch.counters[key] = (ch.counters[key] ?? 0) + 1
  const variant = (ch.counters[key] - 1) % 3
  const vals = { child: cand.name, name: ch.name }
  return {
    tag: 'family',
    line: textLine(w.content, c.text_id, vals, '{child:이/가} 목검을 휘둘렀다', variant),
    detail: textLine(w.content, CHILDHOOD_DETAIL, vals, '{child:이/가} 마당에서 놀았다.', variant),
  }
}
