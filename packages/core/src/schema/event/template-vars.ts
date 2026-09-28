// 문장 템플릿 변수 등록표(16 §1.4.3, CONTENT_SCHEMA §4.6). 엔진이 값을 채우므로 코드가 소유한다.
// V5(W1)가 템플릿의 변수가 여기 있는지 본다. 조사 쌍 9종은 text/template.ts 파서가 단일 출처다. 옛 표기(16 §1.4.4)는 등록하지 않는다.
import { PatternRegistry } from '../common'

// context = 엔진이 문맥에서 넣음, event = 사건의 context_vars(선택자)가 고름
export type TemplateVarSource = 'context' | 'event'

// 점 없는 이름만 등록하므로 PatternRegistry를 이름 등록부로 쓴다. 조회: templateVars.match(name)?.meta.source
// 잠금: V5 검사(W1)가 처음 읽을 때 lock()한다.
export const templateVars = new PatternRegistry<{ source: TemplateVarSource }>('템플릿 변수')

const VAR_NAME = /^[a-z][a-z0-9_]*$/

export function registerTemplateVar(name: string, { source }: { source: TemplateVarSource }): void {
  if (!VAR_NAME.test(name)) throw new Error(`템플릿 변수 이름은 snake_case: ${name}`)
  templateVars.register(name, { source })
}

// 16 §1.4.3 전부. 사건 선택자가 고르는 변수만 event.
const EVENT_VARS = ['friend', 'rumor_place', 'target_place', 'relic_name', 'relic_note', 'relic_uid']
const CONTEXT_VARS = [
  // 인물과 가족
  'name', 'heir', 'parent_name', 'parent_call', 'partner', 'job', 'child', 'guardian', 'family', 'generation',
  'age', 'level', 'attitude', 'spec', 'kind', 'rank', 'role', 'retire_age', 'retire_age_plus10', 'sleep_age',
  'luck', 'luck_after', 'start', 'end', 'age_word', 'season',
  // 장소·사물·적
  'place', 'feature', 'depth', 'item', 'old_item', 'weapon', 'relic', 'loot', 'npc', 'enemy', 'enemy_kind',
  'coins', 'count', 'n', 'm', 'first_page', 'memory', 'achievement', 'chain_name', 'last_step_summary', 'binder',
  'trait', 'old_trait', 'trait_name', 'trait_reason', 'trait_adj', 'skill', 'injury', 'change',
  // D77: 성장·휴식 상세와 최근 요약
  'hp', 'fatigue', 'use', 'xp', 'places',
  // 판정·선택·사망 원인
  'dice', 'stat', 'stat_value', 'bonus_name', 'bonus', 'luck_half', 'total', 'dc', 'result', 'cost', 'reason',
  'rule', 'choice_short', 'offer', 'quote', 'risk_line', 'injury_line', 'final_check_line',
]
for (const name of CONTEXT_VARS) registerTemplateVar(name, { source: 'context' })
for (const name of EVENT_VARS) registerTemplateVar(name, { source: 'event' })
