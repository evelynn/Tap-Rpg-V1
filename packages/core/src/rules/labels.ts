// 판정 기록 항 이름(05 §6.6). 코드 열거(능력치·숙련·전문화·날씨)와 데이터에 이름이 없는 출처만 여기 둔다.
// 특성·장비·판정 종류 이름은 콘텐츠에서 읽는다.
import type { SKILLS, SPECIALIZATIONS, STATS, WEATHERS } from '../schema/index'

export const STAT_LABELS: Record<(typeof STATS)[number], string> = {
  str: '힘', dex: '민첩', kno: '지식', wil: '의지', soc: '사교', luk: '행운',
}
export const SKILL_LABELS: Record<(typeof SKILLS)[number], string> = {
  melee: '근접', mobility: '기동', search: '탐색', survival: '생존', negotiation: '교섭',
}
export const SPEC_LABELS: Record<Exclude<(typeof SPECIALIZATIONS)[number], 'none'>, string> = {
  guardian: '수호자', pathfinder: '길잡이',
}
export const WEATHER_LABELS: Record<(typeof WEATHERS)[number], string> = {
  clear: '맑음', rain: '비', fog: '안개', snow: '눈',
}
export const SOURCE_LABELS = {
  fatigue: '피로',
  night: '밤',
  temp: '일시 효과',
  trip: '출정 효과',
  situational: '상황',
  other: '기타',
  capped: '보정(상한)',
} as const
