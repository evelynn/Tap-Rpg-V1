// 규칙 함수가 읽는 문맥: 콘텐츠, 저장 상태, 조건 평가기.
// 조건 단말 평가(CONDITION_EVAL)는 사건 규칙 태스크 몫이라 여기서는 함수로 받는다.
import type { Content } from '../content/index'
import type { Condition } from '../schema/index'
import type { Character } from '../state/character'
import type { SaveBody } from '../state/save'

export type ConditionTest = (cond: Condition) => boolean

export interface RuleContext {
  content: Content
  state: SaveBody
  test: ConditionTest
}

// 상수 조건만 아는 기본 평가기. 단말 조건이 오면 평가기를 넣으라고 알린다
export const constantConditionTest: ConditionTest = (cond) => {
  if (typeof cond === 'boolean') return cond
  throw new Error(`조건 평가기가 없다(단말 조건 ${Object.keys(cond).join(',')}). RuleContext.test를 넣는다`)
}

export function characterOf(ctx: RuleContext): Character {
  const c = ctx.state.character
  if (!c) throw new Error('현재 인물이 없다(계승 대기)')
  return c
}
