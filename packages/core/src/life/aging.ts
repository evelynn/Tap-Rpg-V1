// 나이 진행과 노화 적용(09 §1~§2). 능력치 이정표 계산의 단일 출처는 rules/growth.applyAging이고,
// 이 파일은 판단 지점에서 알릴 것(생애 단계 경계·기록·유품 등록 안내·외형 단계)만 만든다.
//
// 09 §2.1 "나이가 오르는 순간이 진행 중이면 다음 판단 지점에서 효과를 적용한다"는 13 §8.2의
// 행동 시작 시 결과 선확정으로 이미 지켜진다: 진행 중인 판정은 행동을 시작할 때 굴려 둔 값이라
// 그 사이에 나이가 올라도 결과가 바뀌지 않는다. 그래서 능력치는 바로 적용하고, 알림만 미룬다.
import type { Content } from '../content/index'
import { characterOf, type RuleContext } from '../rules/context'
import type { AgingChange } from '../rules/growth'
import { STAT_LABELS } from '../rules/labels'
import type { JournalDraft } from '../state/journal'
import type { Family } from '../state/family'
import { ageAt, lifeStageAt, stageBoundaryReached, type LifeStage, type StageBoundaries } from '../time/index'
import { AGE_DETAIL, textLine } from './text'

// C25 notices_shown 키. 65세 도달과 치명 위험 허용 첫 켬에 한 번씩 안내한다(12 §5.1)
export const RELIC_NOTICE_AGE = 'relic_designation_age'
export const RELIC_NOTICE_LETHAL = 'relic_designation_lethal'

// balance.aging.life_stages의 둘째~넷째 from_age(I10)
export function stageBoundaries(content: Content): StageBoundaries {
  const ages = [...content.balance.aging.life_stages].sort((a, b) => a.from_age - b.from_age).slice(1).map((s) => s.from_age)
  if (ages.length !== 3) throw new Error(`생애 단계가 4개가 아니다(balance.aging.life_stages: ${ages.length + 1})`)
  return [ages[0]!, ages[1]!, ages[2]!]
}

export function currentAge(ctx: RuleContext): number {
  return ageAt(characterOf(ctx).eff_min, ctx.content.balance.time)
}

export function lifeStageOf(ctx: RuleContext, age: number = currentAge(ctx)): LifeStage {
  return lifeStageAt(age, stageBoundaries(ctx.content))
}

// 외형 단계: 변이 뒤에는 변이 시점 단계로 고정한다(09 §7.8 "흰 머리가 더 진행되지 않는다")
export function appearanceStage(ctx: RuleContext): LifeStage {
  const ch = characterOf(ctx)
  const age = currentAge(ctx)
  return lifeStageOf(ctx, ch.mutation ? Math.min(age, ch.mutation.since_age) : age)
}

export interface AgeTick {
  from: number
  to: number
  changes: readonly AgingChange[]
  boundary: number | null // 이번에 넘은 생애 단계 경계 나이(가장 이른 것 하나, I10)
  stage: LifeStage
}

// World의 onAge에서 받은 값을 판단 지점에서 쓸 모양으로 바꾼다
export function ageTick(content: Content, from: number, to: number, changes: readonly AgingChange[]): AgeTick {
  const b = stageBoundaries(content)
  return { from, to, changes, boundary: stageBoundaryReached(from, to, b), stage: lifeStageAt(to, b) }
}

// 안내를 한 번만 띄운다(C25). 처음이면 true를 돌려주고 기록한다
export function showNoticeOnce(family: Family, key: string, gen: number): boolean {
  if (family.notices_shown[key] !== undefined) return false
  family.notices_shown[key] = gen
  return true
}

const changeText = (changes: readonly AgingChange[]): string =>
  changes.map((c) => `${STAT_LABELS[c.stat]} ${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta)}`).join(', ')

// [성장] 기록(09 §2.2)과 유품 등록 안내(12 §5.1). 나이를 넘긴 판단 지점에서 부른다
export function ageNotices(ctx: RuleContext, tick: AgeTick): JournalDraft[] {
  const { content } = ctx
  const ch = characterOf(ctx)
  const out: JournalDraft[] = []
  if (tick.changes.length || tick.boundary !== null) {
    const age = tick.changes[0]?.age ?? tick.boundary ?? tick.to
    const change = tick.changes.length ? changeText(tick.changes) : '한 걸음을 더 걸었다'
    out.push({
      tag: 'growth',
      sub: 'age',
      line: `${age}세가 되었다`,
      detail: textLine(content, AGE_DETAIL, { age, change }, '{age}세. {change}'),
      ...(tick.boundary !== null ? { importance: 'major' as const } : {}),
    })
  }
  const noticeAge = content.balance.inheritance.relic_notice_age
  if (tick.from < noticeAge && tick.to >= noticeAge && showNoticeOnce(ctx.state.family, RELIC_NOTICE_AGE, ch.generation)) {
    out.push({ tag: 'important', line: '남길 물건을 정해 두세요', detail: '유품은 생전에 두 개까지 정할 수 있다.' })
  }
  return out
}

// 치명 위험 허용을 처음 켤 때의 유품 등록 안내(12 §5.1). 켜는 쪽이 부른다
export function lethalRelicNotice(ctx: RuleContext): JournalDraft | null {
  if (!showNoticeOnce(ctx.state.family, RELIC_NOTICE_LETHAL, characterOf(ctx).generation)) return null
  return { tag: 'important', line: '남길 물건을 정해 두세요', detail: '치명 위험을 허용했다. 유품은 생전에만 정할 수 있다.' }
}
