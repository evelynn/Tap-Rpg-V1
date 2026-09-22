// 연속 사건 관리(10 §7): 단계 플래그, 후계자 이어받기, 생애 종료 시 미완료 처리.
import { addJournal } from '../journal/index'
import type { ConditionTest } from '../rules/context'
import { characterOf } from '../rules/context'
import { chainStageKey, chainUnfinishedKey } from '../schema/index'
import { render, ruleContext, textValues, type EventWorld } from './scope'

export interface ChainResume {
  chain_id: string
  stage: number
  line: string
}

// 이 판단 지점에서 이어받을 줄기(가문 미완료 + resume_at 조건). 이어받기는 한 번뿐이다
export function chainResumes(w: EventWorld, test: ConditionTest): ChainResume[] {
  const ch = characterOf(ruleContext(w, test))
  const out: ChainResume[] = []
  for (const chain of w.content.list('chain')) {
    if (!chain.inheritable) continue
    const stage = w.state.family.flags[chainUnfinishedKey(chain.id)]
    if (typeof stage !== 'number' || (ch.flags[chainStageKey(chain.id)] ?? 0) !== 0) continue
    const at = chain.resume_at.find((r) => r.stage === stage && test(r.when))
    if (at) out.push({ chain_id: chain.id, stage, line: at.line })
  }
  return out
}

export function applyChainResume(w: EventWorld, r: ChainResume): void {
  const ch = characterOf(ruleContext(w, () => false))
  ch.flags[chainStageKey(r.chain_id)] = r.stage
  delete w.state.family.flags[chainUnfinishedKey(r.chain_id)]
  addJournal(w, { tag: 'important', line: render(r.line, textValues(w, { place: ch.location, vars: {} })) })
}

// 생애 종료: 1~마지막 앞 단계의 줄기를 끝나지 않은 이야기로 남기고 가문 플래그를 세운다(10 §7.3).
// 돌려주는 문장은 연대기(생애 기록 unfinished)에 넣는다
export function closeLifeChains(w: EventWorld): string[] {
  const fam = w.state.family
  const ch = characterOf(ruleContext(w, () => false))
  const lines: string[] = []
  for (const chain of w.content.list('chain')) {
    const stage = ch.flags[chainStageKey(chain.id)]
    if (typeof stage !== 'number' || stage < 1 || stage >= chain.stages) continue
    fam.flags[chainUnfinishedKey(chain.id)] = stage
    fam.flag_meta[chainUnfinishedKey(chain.id)] = { set_gen: fam.generation }
    const vals = textValues(w, { place: ch.location, vars: {} })
    lines.push(render(chain.unfinished_line, {
      ...vals,
      chain_name: chain.name,
      last_step_summary: render(chain.stage_summaries[stage - 1]!, vals),
    }))
  }
  return lines
}
