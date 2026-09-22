// 사건 변수 선택자(CONTENT_SCHEMA §4.5). 사건의 context_vars가 템플릿 변수를 채우는 규칙 이름.
// 계산은 규칙 층의 SELECTOR_HANDLERS가 같은 이름으로 한다. 수치·기준은 이름이 아니라 params로 준다.
import { z } from 'zod'
import { ParamRegistry, activityRisk, obj, ratio } from '../common'
import { templateVars } from './template-vars'

export const contextSelectors = new ParamRegistry('사건 변수 선택자')
const yieldsByName = new Map<string, readonly string[]>()

// yields = 이 선택자가 채우는 템플릿 변수(등록표에 있어야 한다)
export function registerContextSelector(
  name: string,
  opts: { yields: readonly string[]; params: z.ZodType; doc?: string },
): void {
  for (const v of opts.yields) {
    if (!templateVars.match(v)) throw new Error(`선택자 ${name}: 등록되지 않은 템플릿 변수 ${v}`)
  }
  contextSelectors.register(name, opts.params, opts.doc ?? '')
  yieldsByName.set(name, opts.yields)
}

export function selectorYields(name: string): readonly string[] | undefined {
  return yieldsByName.get(name)
}

// context_vars 항목. params가 없으면 빈 객체로 검사한다(필수 params를 빠뜨리면 오류).
// 뒤 항목의 place_var가 앞 항목 변수인지는 W1이 본다.
export const contextVarSchema = obj({
  var: z.string(),
  selector: z.string(),
  params: z.unknown().optional(),
}).superRefine((cv, ctx) => {
  contextSelectors.lock()
  const sel = contextSelectors.get(cv.selector)
  if (!sel) return void ctx.addIssue({ code: 'custom', path: ['selector'], message: `알 수 없는 변수 선택자: ${cv.selector}` })
  if (!selectorYields(cv.selector)?.includes(cv.var)) {
    ctx.addIssue({ code: 'custom', path: ['var'], message: `${cv.selector} 선택자가 채우는 변수가 아니다: ${cv.var}` })
  }
  const r = sel.params.safeParse(cv.params ?? {})
  if (!r.success) {
    for (const iss of r.error.issues) ctx.addIssue({ code: 'custom', path: ['params', ...iss.path], message: iss.message })
  }
})

// 4.5 기본 5종
registerContextSelector('rumor_place', {
  yields: ['rumor_place'],
  params: obj({ chain_next_chance: ratio }),
  doc: '해금됐고 미발견 요소가 남은 장소 중 무작위. 진행 중 연속 사건이 있으면 chain_next_chance 확률로 그 다음 단계 장소',
})
registerContextSelector('best_hunting_ground', {
  yields: ['target_place'],
  params: obj({ max_risk: activityRisk }),
  doc: '해금 사냥터 중 인물 위험 등급이 max_risk 이하인 곳 가운데 권장 중앙값이 가장 높은 곳',
})
registerContextSelector('main_enemy_of', {
  yields: ['enemy'],
  params: obj({ place_var: z.string() }),
  doc: '앞서 채운 장소 변수의 조우 표에서 가중치가 가장 큰 적',
})
registerContextSelector('random_friend_name', {
  yields: ['friend'],
  params: obj({}),
  doc: '이름 풀에서 가문 인물과 겹치지 않는 이름(life 난수 흐름)',
})
registerContextSelector('offered_relic', {
  yields: ['relic_name', 'relic_note'],
  params: obj({}),
  doc: '헌납 후보(희귀 이상 유물 중 선택 창에서 고름)',
})
