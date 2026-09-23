// 생애·계승이 쓰는 문형 슬롯과 코어 문장. 데이터에 문형이 있으면 그것을 쓰고, 없으면 코어 문장으로 채운다.
// 코어가 든 한국어 문장은 I50 (3)의 이어받기다(문형이 생기면 registerTextSlot 쪽으로 옮긴다).
import type { Content } from '../content/index'
import { registerTextSlot } from '../schema/index'
import { renderTemplate, type TemplateValues } from '../text/index'

// 09 §2.2 노화 상세, 12 §2.2 어린 시절 상세, 12 §1.3 출발 기록.
// 어린 시절 한 줄(journal.family.childhood)은 balance.inheritance.childhood.text_id가 가리키므로 여기서 등록하지 않는다
export const AGE_DETAIL = 'journal.growth.age_detail'
export const CHILDHOOD_DETAIL = 'journal.family.childhood_detail'
export const NEW_NAME_DETAIL = 'journal.house.new_name_detail'

for (const id of [AGE_DETAIL, CHILDHOOD_DETAIL, NEW_NAME_DETAIL]) registerTextSlot(id, '생애·계승(T10)')

// 문형 하나를 렌더한다. variant는 번들 순서로 고른다(난수를 쓰지 않는다)
export function textLine(content: Content, id: string, values: TemplateValues, fallback: string, variant = 0): string {
  const def = content.has('text', id) ? content.get('text', id) : null
  const t = def ? def.variants[variant % def.variants.length]! : fallback
  return renderTemplate(t, values)
}
