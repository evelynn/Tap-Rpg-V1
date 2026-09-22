// 던전 함정 스키마(07 §5.3). DC는 지역 기준 + offset이다.
import { z } from 'zod'
import { def, effectList, int, line, obj, ref } from '../common'

export const trapSchema = def({
  name: z.string(),
  detect_dc_offset: int,
  // null = 회피 판정 없음(경보 종줄)
  evade: obj({ check: ref('check_kind'), dc_offset: int }).nullable(),
  // null = 해제 불가
  disarm_dc_offset: int.nullable(),
  fail: effectList,
  lines: obj({ detect: line, disarm: line, evade: line, fail: line }),
})
