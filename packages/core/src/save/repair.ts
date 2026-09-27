// 보정 검사 B1~B15(16 §7.1). 실패하면 고치고 진단 로그에 남긴 뒤 계속한다.
// 난수를 쓰는 재굴림(B9의 대체 장비, B2의 레벨업 배분)은 로드 시점에 하지 않는다 — 결정성 계약(I05).
import type { Content } from '../content/index'
import { derivedChainFlags, SLOTS, STATS, type FlagDef } from '../schema/index'
import type { SaveBody } from '../state/save'
import { statCap } from '../rules/derived'
import { constantConditionTest } from '../rules/context'
import { xpToNext } from '../rules/growth'
import { familyHeldItems } from '../items/roll'
import { dropItemRefs } from '../items/bag'

// 시계 이상 기록 보관 수(16 §7.1 B12)
const CLOCK_ANOMALY_KEEP = 20

export const REPAIR_CODES = [
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15',
] as const
export type RepairCode = (typeof REPAIR_CODES)[number]

export interface SaveDiagnostic {
  code: RepairCode
  message: string
}

// 등록표 키와 맞는가(B13). 키 묶음(`fam.death_{place}`)은 앞부분과 비지 않은 꼬리로 본다(16 §5.2)
function flagMatcher(defs: readonly FlagDef[]): (key: string) => boolean {
  const exact = new Set<string>()
  const prefixes: string[] = []
  for (const f of defs) {
    const at = f.id.indexOf('{')
    if (at < 0) exact.add(f.id)
    else prefixes.push(f.id.slice(0, at))
  }
  return (key) => exact.has(key) || prefixes.some((p) => key.startsWith(p) && key.length > p.length)
}

// 저장 상태를 제자리에서 고친다. 돌려주는 진단은 로그로 남긴다
export function repairSave(content: Content, state: SaveBody): SaveDiagnostic[] {
  const out: SaveDiagnostic[] = []
  const log = (code: RepairCode, message: string): void => void out.push({ code, message })
  const b = content.balance
  const ch = state.character

  if (ch) {
    const ctx = { content, state, test: constantConditionTest }

    // B1 능력치 원값 0~상한(변이 상한 포함)
    for (const stat of STATS) {
      const cap = statCap(ctx, stat)
      const v = Math.max(0, Math.min(cap, ch.stats[stat]))
      if (v !== ch.stats[stat]) {
        log('B1', `능력치 ${stat} ${ch.stats[stat]} → ${v}`)
        ch.stats[stat] = v
      }
    }

    // B2 레벨 1~최대, xp는 다음 레벨 요구량 미만
    const level = Math.max(1, Math.min(b.xp.max_level, ch.level))
    if (level !== ch.level) {
      log('B2', `레벨 ${ch.level} → ${level}`)
      ch.level = level
    }
    const need = xpToNext(content, ch.level)
    if (need !== null && ch.xp >= need) {
      log('B2', `경험치 ${ch.xp} → ${need - 1}(레벨 ${ch.level} 요구량 ${need})`)
      ch.xp = need - 1
    }

    // B3 피로 0~최대, 체력 0 이상. 최대 체력은 조건부 수정자에 달려 있어 로드 시점에 보지 않는다
    const fatigue = Math.max(0, Math.min(b.stats.fatigue.max, ch.fatigue))
    if (fatigue !== ch.fatigue) {
      log('B3', `피로 ${ch.fatigue} → ${fatigue}`)
      ch.fatigue = fatigue
    }
    if (ch.hp < 0) {
      log('B3', `체력 ${ch.hp} → 0`)
      ch.hp = 0
    }

    // B7 선천·후천 특성 수 상한. 초과분은 활성 목록에서 밀어낸다(06 §1.1 displaced)
    for (const kind of ['innate', 'acquired'] as const) {
      const cap = b.stats.trait_caps[kind]
      const active = ch.traits.filter((t) => !t.inactive && content.get('trait', t.id).kind === kind)
      for (const t of active.slice(cap)) {
        log('B7', `${kind} 특성 상한 ${cap} 초과: ${t.id} 밀어냄`)
        t.inactive = 'displaced'
      }
    }

    // B8 경상 상한. 초과하면 경상을 모두 지우고 중상 1개로 합친다(I38과 같은 처리)
    const light = ch.injuries.filter((i) => i.grade === 'light')
    if (light.length > b.injury.light_cap) {
      const last = light[light.length - 1]!
      log('B8', `경상 ${light.length}개 → 중상 1개(${last.stat})`)
      ch.injuries = ch.injuries.filter((i) => i.grade !== 'light')
      ch.injuries.push({ grade: 'serious', stat: last.stat, remaining_min: last.remaining_min, source: last.source })
    }

    // B10 소지금 0 이상
    if (ch.coins < 0) {
      log('B10', `소지금 ${ch.coins} → 0`)
      ch.coins = 0
    }

    // B11 은퇴 나이 상한, 흡혈귀 긴 잠 나이 상한(변이 정의의 sleep.cap)
    const retireCap = b.inheritance.lifespan.extend_cap
    if (ch.retire_age > retireCap) {
      log('B11', `은퇴 나이 ${ch.retire_age} → ${retireCap}`)
      ch.retire_age = retireCap
    }
    const sleepCap = ch.mutation ? content.get('trait', ch.mutation.trait_id).mutation?.sleep.cap : undefined
    if (ch.mutation && sleepCap !== undefined && ch.mutation.long_sleep_age > sleepCap) {
      log('B11', `긴 잠 나이 ${ch.mutation.long_sleep_age} → ${sleepCap}`)
      ch.mutation.long_sleep_age = sleepCap
    }
  }

  const inv = state.inventory

  // B5 장착 슬롯과 장비 슬롯 일치. 어긋난 장비는 가방으로
  for (const slot of SLOTS) {
    const u = inv.equipped[slot] ?? null
    if (!u) continue
    const inst = state.item_instances[u]
    if (inst && content.get('item', inst.def_id).slot === slot) continue
    log('B5', `장착 슬롯 ${slot}에 맞지 않는 장비 ${u} → 가방`)
    inv.equipped[slot] = null
    if (inst) inv.bag.push(u)
  }

  // B4 가방 상한. 넘친 장비는 수령 대기함으로
  if (inv.bag.length > b.stats.bag_slots) {
    const over = inv.bag.splice(b.stats.bag_slots)
    log('B4', `가방 상한 ${b.stats.bag_slots} 초과 ${over.length}개 → 수령 대기함`)
    inv.pending_box.push(...over)
  }

  // B6 유품 지정 수·중복·priority. 뒤쪽 지정을 해제한다
  const relicMax = b.inheritance.relic_designations_max
  const seen = new Set<string>()
  const keep = inv.relic_designations.filter((d) => {
    if (seen.has(d.uid) || (d.priority !== 1 && d.priority !== 2)) return false
    seen.add(d.uid)
    return true
  }).slice(0, relicMax)
  if (keep.length !== inv.relic_designations.length) {
    log('B6', `유품 지정 ${inv.relic_designations.length}건 → ${keep.length}건`)
    inv.relic_designations = keep
  }

  // B9 고유 장비는 가문 안에 1개. 오래된 것만 남기고 나머지 인스턴스를 지운다.
  // 가문이 지금 가진 것(familyHeldItems)만 센다: 판매 기록·빈 병 기념품은 가문에 없는 것이다(08 §9.5, I75)
  const held = new Set(familyHeldItems(state).map((i) => i.uid))
  const byDef = new Map<string, string[]>()
  for (const uid of Object.keys(state.item_instances).sort()) {
    if (!held.has(uid)) continue
    const def = content.get('item', state.item_instances[uid]!.def_id)
    if (!def.unique) continue
    const list = byDef.get(def.id) ?? []
    list.push(uid)
    byDef.set(def.id, list)
  }
  for (const [defId, uids] of byDef) {
    for (const uid of uids.slice(1)) {
      log('B9', `고유 장비 ${defId} 중복: ${uid} 삭제(08 §9.5 대체 장비 굴림은 난수를 써 로드에서 하지 않는다)`)
      delete state.item_instances[uid]
      dropItemRefs(inv, uid)
    }
  }

  // B14 교체 제안은 슬롯당 1건·슬롯 수 이하(없는 장비를 가리키면 삭제), 장착 예약도 있는 장비만, 소모품은 carry_group 한도 이하
  const orders = inv.equip_orders?.filter((o) => state.item_instances[o.uid])
  if (inv.equip_orders && orders!.length !== inv.equip_orders.length) {
    log('B14', `장착 예약 ${inv.equip_orders.length}건 → ${orders!.length}건`)
    inv.equip_orders = orders
  }
  const bySlot = new Set<string>()
  const sugg = inv.equip_suggestions.filter((sg) => {
    if ('uid' in sg.source && !state.item_instances[sg.source.uid]) return false
    if (bySlot.has(sg.slot)) return false
    bySlot.add(sg.slot)
    return true
  }).slice(0, SLOTS.length)
  if (sugg.length !== inv.equip_suggestions.length) {
    log('B14', `교체 제안 ${inv.equip_suggestions.length}건 → ${sugg.length}건`)
    inv.equip_suggestions = sugg
  }
  const carried = new Map<string, number>()
  for (const id of Object.keys(inv.consumables).sort()) {
    const group = content.get('consumable', id).carry_group
    const limit = b.economy.carry_limits[group] ?? 0
    const used = carried.get(group) ?? 0
    const n = Math.max(0, Math.min(limit - used, inv.consumables[id]!))
    if (n !== inv.consumables[id]) {
      log('B14', `소모품 ${id} ${inv.consumables[id]} → ${n}(묶음 ${group} 한도 ${limit})`)
      inv.consumables[id] = n
    }
    carried.set(group, used + n)
  }

  // B12 시계 이상 기록은 최근 20개만
  const anomalies = state.offline_state.clock_anomalies
  if (anomalies.length > CLOCK_ANOMALY_KEEP) {
    log('B12', `시계 이상 기록 ${anomalies.length}개 → ${CLOCK_ANOMALY_KEEP}개`)
    state.offline_state.clock_anomalies = anomalies.slice(anomalies.length - CLOCK_ANOMALY_KEEP)
  }

  // B13 플래그 키가 등록표(flags + 줄기 파생)에 있는가. 없는 키는 보존하고 경고만
  const known = flagMatcher([...content.list('flag'), ...content.list('chain').flatMap(derivedChainFlags)])
  const flagSets: [string, Record<string, unknown>][] = [
    ['가문', state.family.flags],
    ...(ch ? [['생애', ch.flags] as [string, Record<string, unknown>]] : []),
    ...(state.current_activity.sortie ? [['출정', state.current_activity.sortie.trip_flags] as [string, Record<string, unknown>]] : []),
  ]
  for (const [where, bag] of flagSets) {
    for (const key of Object.keys(bag).sort()) if (!known(key)) log('B13', `${where} 플래그 '${key}'가 등록표에 없다(보존)`)
  }

  // B15 생애의 책 형식. 원본 일상 기록이 지워졌으므로 다시 엮지 않고 그대로 보여 준다
  for (const rec of state.family.chronicle) {
    if (rec.book !== null && typeof rec.book !== 'object') log('B15', `${rec.gen}대 생애의 책 형식이 객체가 아니다(그대로 둔다)`)
  }

  return out
}

