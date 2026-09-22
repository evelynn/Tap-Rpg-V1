// 저장 상태 공통 타입(16 §5). 정적 데이터(obj)와 달리 _note를 받지 않는 strict 객체다.
import { z } from 'zod'
import { FLAG_KEY_PATTERN, ID_PATTERN, STATS, modifier, type FlagScope } from '../schema/index'

export const s = z.strictObject
// 종류별 일련번호 uid: ch_0001, it_000212, so_00318, fa_0001
export const uid = z.string().regex(/^[a-z]{2}_\d+$/, 'uid 형식이 아니다')
export const defId = z.string().regex(ID_PATTERN, '정의 ID 형식이 아니다')
export const flagKeyValue = z.string().regex(FLAG_KEY_PATTERN, '플래그 키 형식이 아니다')
// 범위별 저장 위치(16 §5.2): life. → 인물, fam. → 가문, trip. → 출정
export const scopedFlagKey = (scope: FlagScope) => flagKeyValue.startsWith(`${scope}.`, `${scope}. 플래그 키여야 한다`)
export const intV = z.number().int()
export const nat = intV.min(0)
export const effMinV = z.number().min(0)
export const utcMs = intV.min(0)
export const statRecord = z.record(z.enum(STATS), intV)
// 저장된 효과는 콘텐츠에서 온 것이라 type만 확인한다(파라미터 검증은 콘텐츠 검사 몫)
export const savedEffect = z.looseObject({ type: z.string() })
export const flagValue = z.union([z.boolean(), intV])

// 일시 수정자(16 §5.4 temp_mods, §5.7 sortie.temp_mods, C29). remaining = 남은 횟수(encounters·next_check 등)
export const TEMP_MOD_SCOPES = [
  'scene', 'next_scene', 'sortie', 'next_sortie', 'encounters', 'next_decision', 'eff_min', 'next_check', 'next_visit',
] as const
export const tempModSchema = s({
  modifier,
  scope: z.enum(TEMP_MOD_SCOPES),
  remaining: nat.nullable(),
  expires_eff_min: effMinV.nullable(),
  source_event: defId.nullable(),
})
export type TempMod = z.infer<typeof tempModSchema>
