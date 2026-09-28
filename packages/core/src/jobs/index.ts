// 직업과 기술(05 §8·§10, 01 §20, D79): 2차 전직 조건, 기술 익힘(상한·기록), 가문 수첩 요령(12 §7.7).
// 1차 직업은 character.specialization(코드 열거), 2차는 character.job2(balance.second_jobs 키)다.
import type { Content } from '../content/index'
import { addJournal } from '../journal/index'
import { rollCheck } from '../rules/check'
import { characterOf, type RuleContext } from '../rules/context'
import { registerTextSlot } from '../schema/index'
import type { Rng } from '../rules/random'
import { renderTemplate } from '../text/index'

export type TechSource = 'job' | 'event' | 'note'

export const JOB_TEXT = {
  learn: 'journal.growth.tech', learnDetail: 'journal.growth.tech_detail',
  note: 'journal.growth.note', noteFail: 'journal.growth.note_fail', noteDetail: 'journal.growth.note_detail', noteTaught: 'journal.growth.note_taught',
} as const
for (const id of Object.values(JOB_TEXT)) registerTextSlot(id, '직업·기술(D79)')

const text = (content: Content, id: string, v: Record<string, string | number> = {}): string =>
  renderTemplate(content.get('text', id).variants[0]!, v)

const rules = (ctx: RuleContext) => ctx.content.balance.job_rules

export const techName = (content: Content, id: string): string => content.balance.techniques[id]?.name ?? id
export const secondJob = (ctx: RuleContext) => {
  const id = ctx.state.character?.job2
  return id ? ctx.content.balance.second_jobs[id] ?? null : null
}

// 2차 전직 조건(05 §8.5): 1차 직업, 레벨, 1차 배수 숙련 하나가 단계 이상, 2차 없음, 미룬 뒤 레벨 조건
export function secondJobReady(ctx: RuleContext): boolean {
  const ch = characterOf(ctx)
  if (ch.specialization === 'none' || ch.job2) return false
  const r = rules(ctx)
  if (ch.level < r.second_level) return false
  const deferred = ch.counters[r.defer_counter]
  if (deferred !== undefined && ch.level < deferred) return false
  const spec = ctx.content.balance.specializations[ch.specialization]!
  return Object.keys(spec.skill_use_mult).some((s) => ch.skills[s as keyof typeof ch.skills].rank >= r.second_rank)
}

// 기술 익힘(05 §10.1): 같은 기술은 한 번, 사건·수첩 기술은 사건 상한 안. 익히면 [성장] 기록(14 §5.1)
export function canLearn(ctx: RuleContext, id: string, source: TechSource): boolean {
  const ch = characterOf(ctx)
  if (!ctx.content.balance.techniques[id] || ch.techniques.some((t) => t.id === id)) return false
  const r = rules(ctx)
  const count = (s: (x: TechSource) => boolean) => ch.techniques.filter((t) => s(t.source)).length
  return source === 'job' ? count((x) => x === 'job') < r.tech_job_cap : count((x) => x !== 'job') < r.tech_event_cap
}

export function learnTechnique(ctx: RuleContext, id: string, source: TechSource): boolean {
  if (!canLearn(ctx, id, source)) return false
  const ch = characterOf(ctx)
  const def = ctx.content.balance.techniques[id]!
  ch.techniques.push({ id, source, eff_min: ch.eff_min })
  addJournal(ctx, {
    tag: 'growth', sub: 'tech', importance: 'major',
    line: text(ctx.content, JOB_TEXT.learn, { skill: def.name }),
    detail: `${def.effect_text}\n${text(ctx.content, JOB_TEXT.learnDetail, { name: ch.name })}`,
  })
  return true
}

// 직업을 정하는 순간 그 전직 기술을 익힌다(05 §8.1·§8.5)
export function learnJobTechnique(ctx: RuleContext): void {
  const ch = characterOf(ctx)
  const t1 = ch.specialization === 'none' ? undefined : ctx.content.balance.specializations[ch.specialization]?.technique
  if (t1) learnTechnique(ctx, t1, 'job')
  const t2 = secondJob(ctx)?.technique
  if (t2) learnTechnique(ctx, t2, 'job')
}

// 생애 끝(12 §7.7): 가장 나중에 익힌 사건 기술 → 2차 전직 기술 → 1차 전직 기술을 가문 수첩 요령으로 적는다
export function writeNote(ctx: RuleContext): void {
  const ch = characterOf(ctx)
  const events = ch.techniques.filter((t) => t.source !== 'job').sort((a, b) => a.eff_min - b.eff_min)
  const t2 = secondJob(ctx)?.technique
  const t1 = ch.specialization === 'none' ? undefined : ctx.content.balance.specializations[ch.specialization]?.technique
  const pick = events.at(-1)?.id ?? (t2 && ch.techniques.some((t) => t.id === t2) ? t2 : undefined) ?? (t1 && ch.techniques.some((t) => t.id === t1) ? t1 : undefined)
  if (pick) ctx.state.family.technique_note = { tech_id: pick, gen: ch.generation }
}

// 수첩 속 요령(12 §7.7): 레벨 이상 마을 귀환 때 확률로 한 번 만난다. 은퇴 교관 부모가 살아 있으면 판정 없이 익힌다
export function noteEncounter(ctx: RuleContext, rng: Rng, parentCall: string, teacherAlive: boolean): void {
  const ch = characterOf(ctx)
  const note = ctx.state.family.technique_note
  const r = rules(ctx)
  if (!note || note.gen >= ch.generation || ch.level < r.note_min_level || ch.counters[r.note_counter]) return
  // 익힐 수 없으면(이미 앎·사건 기술 상한) 만나지 않는다. 익혔다는 기록만 남는 일을 막는다(독립 검증 D79-6)
  if (!canLearn(ctx, note.tech_id, 'note')) return
  if (!rng.chance(r.note_chance)) return
  ch.counters[r.note_counter] = 1
  const name = techName(ctx.content, note.tech_id)
  const ok = teacherAlive || (() => {
    const roll = rollCheck(ctx, rng, { kinds: [r.note_check], dc: r.note_dc })
    return roll.result === 'success' || roll.result === 'crit_success' || roll.result === 'partial'
  })()
  const detail = text(ctx.content, teacherAlive ? JOB_TEXT.noteTaught : JOB_TEXT.noteDetail, { parent_call: parentCall, skill: name })
  if (!ok) {
    addJournal(ctx, { tag: 'growth', line: text(ctx.content, JOB_TEXT.noteFail), detail })
    return
  }
  addJournal(ctx, { tag: 'growth', line: text(ctx.content, JOB_TEXT.note), detail })
  learnTechnique(ctx, note.tech_id, 'note')
}
