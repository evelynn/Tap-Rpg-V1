// 특성 행동 훅 등록부(CONTENT_SCHEMA §4.8). trait.ai_hooks의 키 = 훅 이름, 값 = 등록한 파라미터 스키마.
// 확장 코드는 첫 ai_hooks 검증 전에 registerTraitHook으로 더한다. 읽는 쪽은 규칙 층 TRAIT_HOOK_READERS(같은 이름 키).
import { z } from 'zod'
import { activity, choiceTag, condition, int, nonNegInt, obj, ParamRegistry, ratio, ref } from '../common'

export const traitHooks = new ParamRegistry('특성 훅')

export function registerTraitHook(name: string, params: z.ZodType, doc = ''): void {
  traitHooks.register(name, params, doc)
}

// 기본 10종
registerTraitHook('activity_weight_add', z.partialRecord(activity, int), '활동 가중치 가산(04 식의 특성 항)')
registerTraitHook('retreat_hp_add', ratio, '체력 퇴각 기준 가산(ratio, 0.10 = 10%p)')
registerTraitHook('location_score_add', z.array(obj({ when: condition, value: int })), '장소 점수 특성 가산(04 §6.1)')
registerTraitHook('choice_tag_bonus', z.partialRecord(choiceTag, int), '자동 선택 태그 보정(10 §5.3)')
registerTraitHook('event_weight_mult', z.record(ref('event'), z.number()), '사건 가중치 배수(10 §4.2)')
registerTraitHook('prefer_shortcut', z.boolean(), '길 선택에서 지름길을 고른다(07 §6.2)')
registerTraitHook('attempt_disarm', z.boolean(), '함정 해제를 시도한다(07 §5.3)')
registerTraitHook('camp_extra', nonNegInt, '출정 중 야영 허용 횟수 가산(06 §7)')
registerTraitHook('rest_preference', z.enum(['inn', 'camp']), '휴식 장소 선호(06 §7)')
registerTraitHook('winter_retreat_hp_add', ratio, '겨울 출정 퇴각 기준 가산(ratio). DS-29 통일 시 삭제 후보')

// 훅 이름을 키로 하는 엄격 객체. 첫 평가 때 등록부를 잠그고 그때까지 등록된 훅으로 모양을 만든다.
export const aiHooksSchema = z.lazy(() => {
  traitHooks.lock()
  return obj(Object.fromEntries(traitHooks.list().map((h) => [h.name, h.params.optional()])))
})
