// 일상 기록 문형(14, CONTENT_SCHEMA §5.11). 코어는 문형 id만 알고(textSlots) 문장은 데이터다.
import { z } from 'zod'
import { PatternRegistry, journalTag, line, obj, posInt } from '../common'

// 점으로 이은 snake_case 두 조각 이상(journal.hunt.win_generic)
export const TEXT_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/

// variants는 한 줄 기록(line)이라 V6 길이 검사를 받는다. max_len은 이 문형만 상한을 바꾼다(없으면 balance.ui.line_max).
export const textSchema = obj({
  id: z.string().regex(TEXT_ID_PATTERN, '문형 id는 점으로 이은 snake_case다(예: journal.hunt.win_generic)'),
  tag: journalTag.optional(),
  variants: z.array(line).min(1),
  max_len: posInt.optional(),
})

export type TextDef = z.infer<typeof textSchema>

// 코어가 부르는 문형 id. 번들에 없는 슬롯은 V2 오류(W1). 잠금은 그 검사가 처음 읽을 때 한다.
export const textSlots = new PatternRegistry<{ doc: string }>('텍스트 슬롯')

export function registerTextSlot(id: string, doc = ''): void {
  if (!TEXT_ID_PATTERN.test(id)) throw new Error(`텍스트 슬롯 id 형식 오류: ${id}`)
  textSlots.register(id, { doc })
}
