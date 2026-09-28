// 조건 단말 기본 등록(CONTENT_SCHEMA §4.1 표 = 16 §3.2 43종 중 thirst_gte를 뺀 42종 + 신설 15종 = 57종).
// 평가는 규칙 층의 CONDITION_EVAL이 같은 이름으로 한다. 결합자 all·any·not·num은 common.ts에 있다.
import { z } from 'zod'
import {
  END_KINDS, MUTATIONS, SPECIALIZATIONS, flagKey, grade, int, lifeStage, obj, posInt, ratio, ref, regionFilter, regionKind,
  registerCondition, season, skill, slot, stat, tier, timeOfDay, weather,
} from '../common'

const bool = z.boolean()
const codexKind = z.enum(['items', 'enemies', 'events', 'locations'])
// 16 §5.9 policies의 값이 스칼라인 필드(lethal_scope는 객체라 비교 대상이 아니다). 저장 스키마(T11)가 생기면 거기서 가져온다
const policyKey = z.enum([
  'attitude', 'reserve_mode', 'reserve_custom', 'risk_cap', 'lethal_allowed', 'fate_handling', 'auto_specialization',
  'auto_equip', 'destination', 'destination_warning_ack', 'family_formation', 'auto_succession', 'offline_progress',
  'stage_boundary_stop', 'lethal_warning_dismissed',
])
const eventCount = obj({ event: ref('event'), count: int })

const BASE: [string, z.ZodType, string][] = [
  ['age_gte', int, '현재 나이 ≥'],
  ['age_lt', int, '현재 나이 <'],
  ['level_gte', int, '레벨 ≥'],
  ['level_lt', int, '레벨 <'],
  ['life_stage', z.array(lifeStage), '생애 단계가 목록 중 하나'],
  ['specific_age', z.array(int), '이번 판단 지점에서 막 도달한 나이'],
  ['location', z.array(ref('region')), '현재 장소가 목록 중 하나'],
  ['location_kind', z.array(regionKind), '현재 장소 종류'],
  ['location_tag', z.string(), '현재 장소가 꼬리표 보유'],
  ['location_match', regionFilter, '현재 장소가 거르개에 맞음(ID 나열 대신 속성)'],
  ['season', z.array(season), '계절'],
  ['time_of_day', timeOfDay, '현재 출정 시간대'],
  ['last_trip_time', timeOfDay, '가장 최근 끝난 출정의 시간대'],
  ['weather', z.array(weather), '현재 날씨'],
  ['attitude', z.array(ref('attitude')), '현재 태도'],
  ['has_trait', ref('trait'), '특성 보유'],
  ['trait_hook', z.string().regex(/^[a-z][a-z0-9_]*$/, '훅 이름은 snake_case다'), '보유 특성 중 하나의 ai_hooks[이름]이 참'],
  ['has_item', ref('item'), '가방·장착·수령 대기함에 정의 보유'],
  ['has_item_where', obj({ slot: slot.optional(), grade_gte: grade.optional(), tier_gte: tier.optional(), unique: bool.optional() }), '조건에 맞는 장비 보유'],
  ['equipped', ref('item'), '장착 중'],
  ['received_relic', z.union([ref('item'), z.literal(true)]), '이전 인물에게서 유품으로 받음(true = 어떤 유품이든)'],
  ['has_consumable', obj({ carry_groups: z.array(ref('carry_group')).min(1), count: posInt }), '나열한 소지 묶음 중 하나에 소모품 count개 이상'],
  ['flag', z.union([flagKey(), obj({ key: flagKey(), value: z.union([bool, int]) })]), '플래그가 참 또는 값 일치(범위 무관, 꼬리 바인딩 가능)'],
  ['chain_stage', obj({ chain: ref('chain'), stage: int }), '줄기 단계 플래그 값이 같음'],
  ['lifetime_count_lt', eventCount, '이번 생애 발생 횟수 <'],
  ['family_count_lt', eventCount, '가문 전체 발생 횟수 <'],
  ['skill_rank_gte', obj({ skill, rank: int }), '숙련 단계 ≥'],
  ['stat_gte', obj({ stat, value: int }), '능력치 원값 ≥'],
  ['guild_rank_gte', ref('guild_rank'), '길드 등급 이상(guild_rank.order)'],
  ['coins_gte', int, '소지금 ≥'],
  ['injury', z.enum(['none', 'light', 'serious', 'any']), '부상 상태'],
  ['specialization', z.array(z.enum(SPECIALIZATIONS)), '전문화'],
  ['second_job_ready', z.literal(true), '2차 전직 조건(05 §8.5, D79)'],
  ['mutation', z.enum(MUTATIONS), '변이'],
  ['generation_gte', int, '가문 대수 ≥'],
  ['visited', ref('region'), '이번 생애에 장소 방문'],
  ['discovered', ref('region'), '가문이 장소를 발견(해금)'],
  ['discovery_found', ref('discovery'), '이번 생애에 발견 지점 발견'],
  ['defeated', ref('enemy'), '이번 생애에 격파'],
  ['family_defeated', ref('enemy'), '가문 누군가가 격파'],
  ['policy', obj({ key: policyKey, value: z.union([bool, z.number(), z.string()]) }), '방침 값 일치(key는 저장 policies 필드 이름)'],
  ['hp_ratio_lte', ratio, '현재 체력 비율 ≤'],
  ['fatigue_gte', int, '피로 ≥'],
  ['npc_relation_gte', obj({ npc: ref('npc'), value: int }), '인연 수치 ≥'],
  ['in_town', bool, '마을에 있음'],
  ['guild_aid_active', bool, '길드 지원 기간'],
  ['quest_active', bool, '의뢰 진행 중'],
  ['first_sortie_of_family', bool, '첫 가문 첫 인물의 첫 출정'],
  ['first_sortie_of_character', bool, '모든 새 인물의 첫 출정'],
  ['safe_returns_gte', obj({ count: int, where: regionFilter.optional() }), '무사 귀환 누계(장소별 카운터 합) ≥'],
  ['codex_count_gte', obj({ codex: codexKind, count: int }), '도감 종류별 발견 수 ≥'],
  ['codex_complete', codexKind, '그 도감 종류 정의 전부 발견'],
  ['reaction_active', ref('descendant_reaction'), '후손 반응 기간 안'],
  ['life_end_kind', z.array(z.enum(END_KINDS)), '생애 종료 종류'],
  ['died_at', regionFilter, '사망 장소가 거르개에 맞음'],
  ['thirst_stage_gte', ref('thirst_stage'), '갈증 단계 ≥(변이 특성의 단계 순서)'],
  ['combat_kind', z.array(z.enum(['normal', 'elite_gate', 'boss_gate'])), '지금 치르는 전투 종류'],
  ['main_place', regionFilter, '주 활동 장소(최근 출정 최빈)가 거르개에 맞음'],
]

let registered = false

// 모듈 로드 때 1회 실행된다. 다시 불러도 한 번만 등록한다.
export function registerBaseConditions(): void {
  if (registered) return
  registered = true
  for (const [name, params, doc] of BASE) registerCondition(name, params, doc)
}

registerBaseConditions()
