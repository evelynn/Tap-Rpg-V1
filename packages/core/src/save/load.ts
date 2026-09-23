// 저장 파일 로드 검사(16 §7.1)와 이전(13 §8.7). 치명 검사 K1~K7에 하나라도 걸리면 손상으로 보고,
// 파일을 아는 쪽(13 §8.5 복구 절차)이 다음 후보 파일로 넘어간다. 보정 B1~B15는 repair.ts가 한다.
import type { Content } from '../content/index'
import type { ContentKind } from '../schema/index'
import { saveBodySchema, saveRootSchema, type SaveBody, type SaveRoot } from '../state/save'
import { bodyChecksum } from './checksum'
import { hasMigrationPath, migrateSaveBody, SAVE_SCHEMA_VERSION } from './migrate'
import { repairSave, type SaveDiagnostic } from './repair'

export const FATAL_CODES = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'] as const
export type FatalCode = (typeof FATAL_CODES)[number]

export interface LoadOk {
  ok: true
  root: SaveRoot
  // 앱보다 높은 버전이면 읽기 전용으로 열고 저장하지 않는다(13 §8.7)
  read_only: boolean
  migrated: number[] // 적용한 이전 함수의 출발 버전
  diagnostics: SaveDiagnostic[]
}

export interface LoadFail {
  ok: false
  code: FatalCode
  message: string
}

export type LoadResult = LoadOk | LoadFail

const fail = (code: FatalCode, message: string): LoadFail => ({ ok: false, code, message })

// 어느 필드가 걸렸는지 진단 로그에 남기려면 경로가 있어야 한다
const issueLine = (issue?: { path: PropertyKey[]; message: string }): string =>
  issue ? `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}` : ''

// 방침 destination의 "고정하지 않음" 값(16 §5.9). 장소 ID가 아니다
const AUTO_DESTINATION = 'auto'

// K5가 보는 참조: def_id·장소·사건·특성. 키 순서는 보고 순서를 고정하려고 정렬해 모은다
function contentRefs(body: SaveBody): [ContentKind, string][] {
  const refs: [ContentKind, string][] = [['attitude', body.policies.attitude]]
  if (body.policies.destination !== AUTO_DESTINATION) refs.push(['region', body.policies.destination])
  const ch = body.character
  if (ch) {
    refs.push(['background', ch.background], ['guild_rank', ch.guild_rank], ['region', ch.location])
    for (const id of ch.visited) refs.push(['region', id])
    for (const t of ch.traits) refs.push(['trait', t.id])
    if (ch.mutation) refs.push(['trait', ch.mutation.trait_id])
    if (ch.quest) refs.push(['event', ch.quest.event_id], ['region', ch.quest.location_id], ['enemy', ch.quest.enemy_id])
    for (const e of ch.scheduled_events) refs.push(['event', e.event_id])
    for (const id of Object.keys(ch.event_counts).sort()) refs.push(['event', id])
    for (const id of ch.recent_life_events) refs.push(['event', id])
  }
  for (const uid of Object.keys(body.item_instances).sort()) refs.push(['item', body.item_instances[uid]!.def_id])
  for (const id of Object.keys(body.inventory.consumables).sort()) refs.push(['consumable', id])
  const pc = body.pending_choice
  if (pc) refs.push(['event', pc.event_id], ['region', pc.location])
  const ca = body.current_activity
  if (ca.sortie) refs.push(['region', ca.sortie.location_id])
  if (ca.next_sortie_override) {
    refs.push(['region', ca.next_sortie_override.location_id], ['event', ca.next_sortie_override.source_event])
  }
  return refs
}

// text: 저장 파일 본문. content: 현재 정적 데이터(K5·보정이 읽는다)
export function loadSave(text: string, content: Content): LoadResult {
  // K1 JSON 해석 가능, header·body 존재
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return fail('K1', `JSON 해석 실패: ${(e as Error).message}`)
  }
  if (typeof parsed !== 'object' || parsed === null) return fail('K1', '저장 파일이 객체가 아니다')
  const raw = parsed as { header?: unknown; body?: unknown }
  if (typeof raw.header !== 'object' || raw.header === null) return fail('K1', 'header가 없다')
  if (typeof raw.body !== 'object' || raw.body === null) return fail('K1', 'body가 없다')
  const header = raw.header as Record<string, unknown>

  // K2 체크섬 일치
  if (typeof header.checksum !== 'string') return fail('K2', 'header.checksum이 없다')
  const sum = bodyChecksum(raw.body)
  if (sum !== header.checksum) return fail('K2', `체크섬 불일치(파일 ${header.checksum}, 계산 ${sum})`)

  // K3 schema_version이 정수이고 이전 함수가 존재
  const version = header.schema_version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail('K3', `schema_version이 정수가 아니다(${String(version)})`)
  }
  // 더 새로운 버전은 읽기 전용으로 연다(13 §8.7). 이 버전의 스키마로 검사하지 않는다
  if (version > SAVE_SCHEMA_VERSION) {
    return { ok: true, root: raw as SaveRoot, read_only: true, migrated: [], diagnostics: [] }
  }
  if (!hasMigrationPath(version)) return fail('K3', `v${version} → v${SAVE_SCHEMA_VERSION} 이전 함수가 없다`)
  const moved = migrateSaveBody(raw.body as Record<string, unknown>, version)

  // K4 5절 필수 필드 존재·형식 일치
  const body = saveBodySchema.safeParse(moved.body)
  if (!body.success) return fail('K4', `저장 본문 형식 위반: ${issueLine(body.error.issues[0])}`)
  const state = body.data

  // K5 참조하는 정적 데이터 ID가 모두 있다(삭제된 ID는 이전 함수가 대체해야 한다)
  for (const [kind, id] of contentRefs(state)) {
    if (!content.has(kind, id)) return fail('K5', `${kind} '${id}'가 정적 데이터에 없다`)
  }

  // K6 가방·장착·수령 대기함·유품 지정의 uid가 모두 item_instances에 있다
  const inv = state.inventory
  const owned = [...inv.bag, ...inv.pending_box, ...Object.values(inv.equipped).filter((u): u is string => !!u)]
  for (const uid of owned) if (!state.item_instances[uid]) return fail('K6', `장비 인스턴스 '${uid}'가 없다`)

  // K7 pending_choice가 있으면 state = awaiting_choice(열거값 유효성은 K4가 이미 봤다)
  const ca = state.current_activity
  if (state.pending_choice && ca.state !== 'awaiting_choice') {
    return fail('K7', `선택 대기인데 상태가 '${ca.state}'다`)
  }

  const diagnostics = repairSave(content, state)
  const root = saveRootSchema.safeParse({ header: { ...header, schema_version: SAVE_SCHEMA_VERSION }, body: state })
  if (!root.success) return fail('K4', `저장 머리 형식 위반: ${issueLine(root.error.issues[0])}`)
  return { ok: true, root: root.data, read_only: false, migrated: moved.applied, diagnostics }
}
