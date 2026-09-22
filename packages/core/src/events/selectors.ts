// 사건 변수 선택자(CONTENT_SCHEMA §4.5). 핸들러는 등록부 contextSelectors와 같은 이름의 SELECTOR_HANDLERS 한 곳에 둔다.
// 선택자는 채우는 변수 전부를 돌려준다. 한 사건 안에서 같은 selector·params는 한 번만 계산한다.
import type { ConditionTest } from '../rules/context'
import { characterOf } from '../rules/context'
import { ACTIVITY_RISKS, chainStageKey } from '../schema/index'
import type { EventPorts } from './ports'
import { ruleContext, type EventWorld } from './scope'

interface SelectorArgs {
  w: EventWorld
  params: Record<string, any>
  vars: Readonly<Record<string, string>>
  ports: EventPorts
  test: ConditionTest
}
type Selector = (a: SelectorArgs) => Record<string, string>

// 위험 등급(01 §7.2): 권장 중앙값 − 인물 레벨을 balance.risk.bands로 가른다. 장비 보정은 활동 결정(T8)의 몫이라 넣지 않는다
function riskGrade(w: EventWorld, levelMid: number): string {
  const diff = levelMid - characterOf(ruleContext(w, () => false)).level
  return w.content.balance.risk.bands.find((b) => b.max === undefined || diff <= b.max)!.grade
}

export const SELECTOR_HANDLERS: Record<string, Selector> = {
  // 해금됐고 미방문이거나 미발견 지점이 남은 장소 중 무작위(event 흐름). 진행 중 줄기가 있으면 chain_next_chance로 다음 단계 장소
  rumor_place: ({ w, params, test }) => {
    const ch = characterOf(ruleContext(w, test))
    const rng = w.rng.event
    const next = w.content.list('chain').flatMap((c) => {
      const stage = ch.flags[chainStageKey(c.id)]
      if (typeof stage !== 'number' || stage < 1 || stage >= c.stages) return []
      const ev = w.content.list('event').find((e) => e.chain?.id === c.id && e.chain.stage === stage + 1)
      return ev?.locations?.slice(0, 1) ?? []
    })
    const toNext = rng.chance(params.chain_next_chance)
    if (toNext && next.length) return { rumor_place: next[0]! }
    const places = w.content.list('region').filter((r) => r.kind !== 'town' && test(r.unlock)
      && (!ch.visited.includes(r.id) || (r.kind === 'adventure_route' && r.discoveries.some((d) => !ch.discoveries.includes(d.id)))))
    const pick = places.length ? places[rng.bounded(places.length)]!.id : ch.location
    return { rumor_place: pick }
  },
  // 해금 사냥터 중 위험 등급 ≤ max_risk인 곳 가운데 권장 중앙값이 가장 높은 곳
  best_hunting_ground: ({ w, params, test }) => {
    const cap = ACTIVITY_RISKS.indexOf(params.max_risk)
    let best: { id: string; mid: number } | undefined
    for (const r of w.content.list('region')) {
      if (r.kind !== 'hunting_ground' || !test(r.unlock)) continue
      if (ACTIVITY_RISKS.indexOf(riskGrade(w, r.level_mid) as 'low') > cap) continue
      if (!best || r.level_mid > best.mid) best = { id: r.id, mid: r.level_mid }
    }
    if (!best) throw new Error('best_hunting_ground: 조건에 맞는 사냥터가 없다')
    return { target_place: best.id }
  },
  // 앞서 채운 장소 변수의 조우 표에서 가중치가 가장 큰 적(같으면 앞)
  main_enemy_of: ({ w, params, vars }) => {
    const r = w.content.get('region', vars[params.place_var]!)
    if (r.kind === 'town') throw new Error(`main_enemy_of: 마을에는 조우 표가 없다(${r.id})`)
    return { enemy: r.encounters.reduce((a, b) => (b.weight > a.weight ? b : a)).enemy_id }
  },
  // 이름 풀에서 가문 인물과 겹치지 않는 이름(life 흐름)
  random_friend_name: ({ w }) => {
    const s = w.state
    const used = new Set([s.character?.name, ...s.family.chronicle.map((r) => r.name), ...Object.values(s.family.candidates).map((c) => c.name)])
    const names = w.content.list('name_pool').flatMap((p) => p.given_names).filter((n) => !used.has(n))
    if (!names.length) throw new Error('random_friend_name: 쓸 수 있는 이름이 없다')
    return { friend: names[w.rng.life.bounded(names.length)]! }
  },
  // 헌납 후보 유물(장비 규칙이 고른다). 없으면 빈 값
  offered_relic: ({ w, ports }) => {
    const r = ports.item.offeredRelic(w)
    const out: Record<string, string> = { relic_name: r?.name ?? '', relic_note: r?.note ?? '' }
    if (r) out.relic_uid = r.uid
    return out
  },
}

// 사건 context_vars를 선언 순서대로 채운다
export function fillContextVars(
  w: EventWorld,
  contextVars: readonly { var: string; selector: string; params?: unknown }[],
  ports: EventPorts,
  test: ConditionTest,
): Record<string, string> {
  const vars: Record<string, string> = {}
  const cache = new Map<string, Record<string, string>>()
  for (const cv of contextVars) {
    const key = `${cv.selector}:${JSON.stringify(cv.params ?? {})}`
    let got = cache.get(key)
    if (!got) {
      const sel = SELECTOR_HANDLERS[cv.selector]
      if (!sel) throw new Error(`변수 선택자 핸들러가 없다: ${cv.selector}`)
      got = sel({ w, params: (cv.params ?? {}) as Record<string, unknown>, vars, ports, test })
      cache.set(key, got)
    }
    Object.assign(vars, got)
  }
  return vars
}
