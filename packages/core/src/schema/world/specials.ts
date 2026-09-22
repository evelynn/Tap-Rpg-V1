// 적 특수능력 등록부(CONTENT_SCHEMA §4.4). enemy.specials[]는 {kind, ...params} 판별 유니온이다.
// 특정 장비·특성 ID를 파라미터에 넣지 않는다 — 무효화는 수정자 flag나 special.{kind}.{param} 가산으로 쓴다.
import { z } from 'zod'
import { ParamRegistry, condition, effectList, int, modifier, obj, posInt, range, ratio, ref } from '../common'

export type EnemySpecial = { kind: string; [key: string]: unknown }

// 첫 enemySpecialSchema 평가 때 잠긴다. 확장 코드는 그 전에 registerEnemySpecial을 부른다.
export const enemySpecials = new ParamRegistry('적 특수능력')

export function registerEnemySpecial(kind: string, shape: z.ZodRawShape, doc = ''): void {
  enemySpecials.register(kind, obj({ kind: z.literal(kind), ...shape }), doc)
}

export const enemySpecialSchema: z.ZodType<EnemySpecial> = z.lazy(() => {
  enemySpecials.lock()
  const options = enemySpecials.list().map((e) => e.params) as unknown as [
    z.core.$ZodTypeDiscriminable,
    ...z.core.$ZodTypeDiscriminable[],
  ]
  return z.discriminatedUnion('kind', options, {
    error: '알 수 없는 적 특수능력 kind(등록부에 없음)',
  }) as unknown as z.ZodType<EnemySpecial>
})

// 기본 13종(07 §4.1·§4.3·§4.4)
const modifiers = z.array(modifier)

registerEnemySpecial('cowardly_flee', { hp_ratio_lte: ratio, chance: ratio, xp_ratio: ratio }, '체력 이하에서 확률 도주')
registerEnemySpecial('gnaw', { chance: ratio, ac_add: int, max_times: posInt }, '명중 시 확률로 인물 방어 감소')
registerEnemySpecial('pack_hunt', { min_count: posInt, hit_add: int }, '여럿일 때 명중 가산')
registerEnemySpecial('howl', { check: ref('check_kind'), on_fail: modifiers }, '첫 라운드 판정 실패 시 수정자')
registerEnemySpecial('erratic_flight', { first_attack_hit_add: int }, '인물 첫 공격 명중 가산')
registerEnemySpecial('screech', { fatigue: int }, '전투 후 피로 추가')
registerEnemySpecial('dark_defense', { ac_add: int, when: condition }, '조건이 참이면 방어 가산')
registerEnemySpecial('stone_throw', { damage: range, hit_check: z.boolean() }, '전투 전 원거리 공격 1회')
registerEnemySpecial('heavy_swing', { rounds: z.array(posInt).min(1), damage_mult: z.number().min(0) }, '지정 라운드 피해 배수')
registerEnemySpecial('damage_reduction', { value: int, min: int }, '받는 피해 감소(최소값)')
registerEnemySpecial(
  'summon',
  {
    hp_ratio_lte: ratio,
    enemy_id: ref('enemy'),
    level: int.optional(),
    skip_attack: z.boolean(),
    max_times: posInt,
  },
  '체력 이하에서 적 호출',
)
registerEnemySpecial(
  'cave_shake',
  {
    hp_thresholds: z.array(ratio).min(1),
    check: ref('check_kind'),
    dc_offset: int,
    fail: effectList,
    partial: effectList,
  },
  '체력 경계마다 판정, 실패·부분 효과',
)
registerEnemySpecial(
  'phases',
  {
    phases: z
      .array(
        obj({
          hp_above: ratio,
          name: z.string(),
          fear_check: obj({
            every_rounds: posInt,
            dc_offset: int,
            fail: modifiers,
            partial: modifiers,
            duration_rounds: posInt,
          }).optional(),
          attacks_per_round: posInt.optional(),
          damage_mult: z.number().min(0).optional(),
          ac_add: int.optional(),
          fx: z.string().optional(),
        }),
      )
      .min(1),
  },
  '체력 구간별 행동 단계',
)
