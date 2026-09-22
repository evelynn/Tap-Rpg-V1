// 효과 기본 등록(CONTENT_SCHEMA §4.2 확정 파라미터 = 16 §4.3의 50종 + add_material·remove_consumable·roll_check
// + reveal_discovery·open_chest·create_partner = 56종).
// 실행은 규칙 층의 EFFECT_HANDLERS가 같은 이름으로 한다. 모든 효과는 {type, when?, ...params} strict 객체다.
import { z } from 'zod'
import {
  BINDING_PATTERN, GRADES, INJURY_GRADES, JOURNAL_IMPORTANCE, ROOM_KINDS, activity, animationAction, condition, counterNames, dice,
  effMin, effectList, effects, exactlyOne, flagKey, grade, id, int, journalTag, line, modifier, nonNegInt, obj, posInt,
  ratio, ref, registerEffect, skill, slot, stat, template, tier, units, weightTable,
} from '../common'

const bool = z.boolean()
const flagValue = z.union([bool, int])
const varName = z.string().regex(/^[a-z][a-z0-9_]*$/, '변수 이름은 snake_case다')
// 장소 자리: 장소 ID 또는 바인딩 {place}·{사건 장소 변수}(§3.1)
const place = z.union([ref('region'), z.string().regex(BINDING_PATTERN, '바인딩은 {변수} 형식이다')])

// 나열한 키 중 하나만 가진 객체(예: {encounters: 2})
function oneKey(keys: [string, ...string[]], value: z.ZodType) {
  const check = exactlyOne(...keys)
  return obj(Object.fromEntries(keys.map((k) => [k, value.optional()]))).refine(
    (v) => check(v) === undefined,
    `${keys.join(' | ')} 중 키 하나만 쓴다`,
  )
}

// V8: 선택 창 cost가 비어 있으면 안 되는 효과. 새 효과를 더하는 코드가 여기에 이름을 더한다.
export const COST_REQUIRED_EFFECTS = new Set<string>(['mutate', 'extend_lifespan', 'remove_item', 'life_stat_add'])

// 선택지 combat과 start_combat 공통 필드
const enemyPick = z.union([
  obj({ enemy_id: ref('enemy') }),
  obj({ by_location: z.record(ref('region'), ref('enemy')) }),
  obj({ from_region_table: z.literal(true) }), // 현재 장소 조우 표에서 뽑음
])
const combatShape = {
  enemies: z.array(enemyPick).min(1),
  count: z.union([posInt, z.array(obj({ when: condition, count: posInt })).min(1)]),
  sequential: bool.optional(),
  first_strike: z.enum(['char', 'enemy', 'default']).optional(),
  ambush: bool.optional(),
  pre_check: obj({ kind: ref('check_kind'), dc_offset: int, on_fail: z.array(modifier) }).optional(),
  reward_mult: z.number().min(0).optional(),
}
export const combatSchema = obj(combatShape)

// 사건 피해는 체력 비율 1 미만(V9). 체력 1 미만 금지는 핸들러 계약이다.
const damageRatio = ratio.refine((r) => r < 1, { message: '사건 피해 hp_ratio는 1 미만이다', params: { rule: 'V9' } })

let registered = false

// 모듈 로드 때 1회 실행된다. 다시 불러도 한 번만 등록한다.
export function registerBaseEffects(): void {
  if (registered) return
  registered = true

  // 자원·상태
  registerEffect('add_coins', { amount: nonNegInt.optional(), units: units.optional() }, '동전 획득(units = 장소 동전 단위 배수)', exactlyOne('amount', 'units'))
  registerEffect(
    'remove_coins',
    { amount: nonNegInt.optional(), units: units.optional(), ratio: ratio.optional(), sortie_income_ratio: ratio.optional(), inn_costs: posInt.optional() },
    '동전 잃음(0 아래로 내려가지 않음). sortie_income_ratio = 이번 출정 동전 수입의 비율, inn_costs = 여관비(balance.recovery.inn.cost × inn_cost_mult) N회분',
    exactlyOne('amount', 'units', 'ratio', 'sortie_income_ratio', 'inn_costs'),
  )
  registerEffect('add_xp', { amount: nonNegInt.optional(), units: units.optional(), encounters: posInt.optional() }, '경험치', exactlyOne('amount', 'units', 'encounters'))
  registerEffect('heal', { hp: posInt.optional(), hp_ratio: ratio.optional() }, '체력 회복', exactlyOne('hp', 'hp_ratio'))
  registerEffect('damage', { hp: posInt.optional(), hp_ratio: damageRatio.optional(), dice: dice.optional() }, '체력 감소(체력 1 아래로 내리지 않음)', exactlyOne('hp', 'hp_ratio', 'dice'))
  registerEffect('add_fatigue', { value: int }, '피로(음수 가능)')
  registerEffect('injury', { grade: z.enum(INJURY_GRADES), stat: stat.optional() }, '부상')
  registerEffect('cure_injury', { grade: z.enum([...INJURY_GRADES, 'all']) }, '부상 치유')
  registerEffect('life_stat_add', { stat, value: int, floor: int.optional() }, '이번 생애 동안의 능력치 변화(floor 기본 0)')

  // 물건
  registerEffect('add_item', { item_id: ref('item'), grade: grade.optional(), to: z.enum(['bag', 'pending_box', 'bag_or_pending']) }, '장비 획득')
  registerEffect(
    'add_random_item',
    {
      tier: z.union([z.literal('location'), z.literal('character'), tier]),
      grade_table: ref('drop_table').optional(),
      grade_weights: weightTable(GRADES).optional(),
      slot: slot.optional(),
      exclude_cursed: bool.optional(),
    },
    '무작위 장비(grade_table = balance.economy.drops 키)',
    exactlyOne('grade_table', 'grade_weights'),
  )
  registerEffect(
    'remove_item',
    { item_id: ref('item').optional(), selector: z.enum(['chosen_relic', 'highest_rare_relic']).optional() },
    '장비 잃음·헌납',
    exactlyOne('item_id', 'selector'),
  )
  registerEffect(
    'add_consumable',
    { consumable_id: ref('consumable').optional(), tier: z.literal('current').optional(), count: posInt },
    '소모품(보유 한도 초과분은 사라짐)',
    exactlyOne('consumable_id', 'tier'),
  )
  registerEffect('remove_consumable', { carry_groups: z.array(ref('carry_group')).min(1), count: posInt }, '나열 순서대로 가진 묶음 하나에서 뺀다')
  registerEffect('add_material', { material_id: ref('material'), count: posInt }, '재료 획득')
  registerEffect('open_chest', {}, '보물 방 상자 내용(balance.dungeon.chest·drops.treasure_chest)을 받는다. 잠김·함정 판정은 없다')
  registerEffect(
    'offer_purchase',
    {
      pool: obj({ facilities: z.array(ref('facility')).min(1), slots: z.array(slot).min(1) }),
      tier: z.union([z.literal('character'), tier]),
      grade_weights: weightTable(GRADES),
      price_mult: z.number().min(0),
      defect: z.array(modifier).optional(),
      exempt_discount_cap: bool.optional(),
      respect_auto_buy: bool.optional(),
    },
    '특가 구매 제안(후보는 그 시설에 shop을 선언한 장비)',
  )

  // 특성·생애
  registerEffect('add_trait', { trait_id: ref('trait') }, '특성 획득', undefined, 2)
  registerEffect('remove_trait', { trait_id: ref('trait') }, '특성 제거', undefined, 2)
  registerEffect('specialize', { spec: z.enum(['guardian', 'pathfinder', 'defer']) }, '전문화 확정 또는 미룸', undefined, 2)
  registerEffect('extend_lifespan', { years: posInt, cap: int.optional() }, '은퇴 나이 연장(cap 없으면 balance 상한)')
  registerEffect('mutate', { trait_id: ref('trait') }, '변이(kind mutation 특성)', undefined, 2)
  registerEffect('register_relic', { selector: z.enum(['this_item', 'uid']), priority: z.union([z.literal(1), z.literal(2)]) }, '유품 등록')
  registerEffect('create_child_candidate', {}, '자녀 후보 1명 생성')
  registerEffect('create_partner', {}, '동반자 1명 생성(12 §2.1 이름·직업·선천 특성·외형)')

  // 플래그와 연속 사건(범위 접두는 flagKey(scope)가 강제, V19)
  registerEffect('set_flag', { key: flagKey('life'), value: flagValue.optional() }, '생애 플래그(value 기본 true)', undefined, 3)
  registerEffect('clear_flag', { key: flagKey('life') }, '생애 플래그 지움', undefined, 3)
  registerEffect('set_family_flag', { key: flagKey('fam'), value: flagValue.optional() }, '가문 플래그(value 기본 true)', undefined, 4)
  registerEffect(
    'set_trip_flag',
    { key: flagKey('trip'), value: flagValue.optional(), remaining: oneKey(['encounters', 'rooms', 'scenes'], posInt).optional() },
    '출정 플래그. 출정 동안 효과는 플래그 등록표 trip_modifiers가 단일 출처',
    undefined,
    3,
  )
  registerEffect('clear_trip_flag', { key: flagKey('trip') }, '출정 플래그 지움', undefined, 3)
  registerEffect(
    'counter_add',
    { key: z.string(), value: int, where: place.optional() },
    '생애 카운터. where가 있으면 그 장소 누계도 함께 올린다',
    (v) => (counterNames.has(String(v.key)) ? undefined : `등록되지 않은 카운터: ${String(v.key)}`),
  )
  registerEffect('advance_chain', { chain_id: ref('chain'), stage: posInt }, '줄기 단계 기록', undefined, 3)
  registerEffect('end_chain', { chain_id: ref('chain'), outcome: varName }, '줄기 완료(outcome은 그 chain의 outcomes 중 하나, W1)', undefined, 4)

  // 진행·장소
  registerEffect('unlock_location', { location_id: ref('region') }, '장소 해금(가문 단위)')
  registerEffect(
    'reveal_discovery',
    { prefer: z.array(ref('discovery')).min(1).optional() },
    '현재 장소의 미발견 발견 지점 하나를 판정 없이 발견(prefer 중 미발견이 먼저, 없으면 조건이 맞는 미발견 지점 중 event 흐름 무작위)',
  )
  registerEffect(
    'set_destination',
    { location: ref('region').optional(), place_var: varName.optional(), activity: activity.optional(), scope: z.literal('next_sortie'), respect_risk_cap: bool.optional() },
    '다음 출정 목적지 고정(place_var는 그 사건 context_vars 변수, W1)',
    exactlyOne('location', 'place_var'),
  )
  registerEffect(
    'accept_quest',
    {
      quest: ref('event'),
      location_var: varName,
      enemy_var: varName,
      goal_wins: posInt,
      deadline: z.literal('next_sortie'),
      reward: obj({ coin_units: units, xp_units: units }),
      settle: z.literal('ratio_floor'),
      cancel_on: z.literal('serious_injury'),
      lines: obj({ complete: line, partial: line, cancel: line }),
    },
    '의뢰 성립(보상 단위는 location_var 장소 기준). 다음 출정 목적지도 고정',
  )
  registerEffect(
    'sortie_mod',
    {
      remaining_add: oneKey(['encounters', 'scenes'], int).optional(),
      return_travel_sec_add: int.optional(),
      camp: obj({ hp_mult: z.number().min(0).optional(), fatigue_add: int.optional() }).optional(),
    },
    '현재 출정 조정. camp.fatigue_add는 야영 피로 변화에 더하는 값',
    (v) => (v.remaining_add ?? v.return_travel_sec_add ?? v.camp) === undefined ? 'remaining_add·return_travel_sec_add·camp 중 하나 이상이 필요하다' : undefined,
  )
  registerEffect(
    'dungeon_mod',
    {
      op: z.enum(['add_room', 'skip_rooms', 'next_room_weight']),
      room_kind: z.enum(ROOM_KINDS).optional(),
      count: posInt.optional(),
      weight_add: int.optional(),
      scope: z.enum(['this_sortie', 'next_visit']),
      location: place.optional(),
    },
    '던전 방 배열 조작(location 기본 {place})',
  )
  registerEffect('add_time', { sec: posInt }, '행동 시간 추가')
  registerEffect('end_sortie', { reason: z.enum(['event', 'injury', 'command']) }, '출정 즉시 종료, 귀환')
  registerEffect(
    'temp_mod',
    {
      modifier,
      scope: z.enum(['scene', 'next_scene', 'sortie', 'next_sortie', 'encounters', 'next_decision', 'eff_min', 'next_check', 'next_visit']),
      count: posInt.optional(),
      duration_min: effMin.optional(),
      location: place.optional(),
    },
    '일시 수정자',
    (v) =>
      v.scope === 'encounters' && v.count === undefined ? 'scope encounters는 count가 필요하다'
      : v.scope === 'eff_min' && v.duration_min === undefined ? 'scope eff_min은 duration_min이 필요하다'
      : v.scope === 'next_visit' && v.location === undefined ? 'scope next_visit은 location이 필요하다'
      : undefined,
  )
  registerEffect(
    'shop_discount',
    { ratio, uses: posInt.optional(), facility: ref('facility').optional(), duration_min: effMin.optional() },
    '상점 할인(할인 상한에 포함)',
  )

  // 전투와 흐름
  registerEffect(
    'start_combat',
    { ...combatShape, on_win: effectList.optional(), on_defeat: effectList.optional(), on_stalemate: effectList.optional() },
    '결과 안에서 전투 시작',
  )
  registerEffect(
    'roll_check',
    {
      check: obj({ kind: ref('check_kind'), dc: int.optional(), dc_offset: int.optional() }).refine(
        (c) => c.dc === undefined || c.dc_offset === undefined,
        'dc와 dc_offset은 함께 쓰지 않는다',
      ),
      success: effectList,
      partial: effectList.optional(),
      failure: effectList.optional(),
    },
    '결과 안에서 판정을 한 번 더 굴림',
  )
  registerEffect('chance', { p: ratio, then: effectList, else: effectList.optional() }, '확률 분기(event 난수 흐름으로 미리 굴림)')
  registerEffect('if', { cond: condition, then: effectList, else: effectList.optional() }, '조건 분기')
  registerEffect('on_town_return', { effects: effectList, line: line.optional() }, '다음 마을 도착 때 적용')
  registerEffect(
    'schedule_event',
    { event_id: ref('event'), at: z.enum(['next_town_return', 'next_camp', 'eff_min']), after_min: effMin.optional() },
    '후속 사건 예약(발화 때 condition만 검사)',
    (v) => (v.at === 'eff_min' && v.after_min === undefined ? 'at eff_min은 after_min이 필요하다' : undefined),
  )
  registerEffect('reopen_choices', { exclude: z.array(z.string()), situational: z.array(modifier).optional() }, '같은 선택 창을 일부 선택지를 빼고 다시 연다')

  // 기록·관계·연출
  registerEffect('npc_relation', { npc_id: ref('npc'), delta: int }, '인연 수치 변화')
  registerEffect('skill_use', { skill: z.union([skill, z.literal('lowest_rank')]), count: posInt }, '숙련 사용 횟수 가산(lowest_rank = 단계가 가장 낮은 숙련, 같으면 숙련 목록 순서 앞)')
  registerEffect('family_record', { kind: z.enum(['chronicle', 'bond', 'codex']), key: z.string().min(1), text: template }, '가문 기록', undefined, 5)
  // background면 그 종류로 참조 검사(V2). 칭호는 achievement.rewards로만 준다.
  const unlockBase = { type: z.literal('unlock_family'), when: condition.optional() }
  effects.register(
    'unlock_family',
    z.discriminatedUnion('kind', [
      obj({ ...unlockBase, kind: z.literal('background'), id: ref('background') }),
      obj({ ...unlockBase, kind: z.literal('appearance'), id }),
    ]),
    '가문 해금',
  )
  registerEffect('journal', { tag: journalTag, line, detail: template.optional(), importance: z.enum(JOURNAL_IMPORTANCE).optional() }, '결과 문장 외 추가 기록', undefined, 5)
  registerEffect('animation', { action: animationAction, props: z.array(ref('prop')).optional() }, '연출 지시(오프라인 정산에서는 무시)', undefined, 6)
}

registerBaseEffects()
