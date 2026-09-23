// 사냥 조우 1회(04 §7.2, 07 §3). 확정 결과에 전투·드롭·재료를 모두 담는다.
import { addFatigue } from '../rules/fatigue'
import { characterOf } from '../rules/context'
import { addToBundle, bundleRow } from '../journal/index'
import type { JournalDraft } from '../state/journal'
import type { ActionResolver, ResolvedDraft } from '../sim/world'
import type { World } from '../sim/world'
import { applyEncounterStep, breather, resolveEncounterStep, rollEnemies, type EncounterOutcome, type EncounterSpec } from './encounter'
import { tickSortieBody } from './field'
import { fieldPoint, takePendingSec } from './judgment'
import { line } from './lines'
import { renderTemplate } from '../text/index'
import { currentSortie } from './sortie'

// 드롭 표 이름은 balance.economy.drops의 키다(I50 (2) 재검토 대상)
export const DROP_TABLE = { hunt: 'hunt', dungeon: 'dungeon_combat', chest: 'treasure_chest', elite: 'elite_gate', boss: 'boss_gate' } as const

export function encounterSpec(world: World): EncounterSpec {
  const s = currentSortie(world)
  const enemies = rollEnemies(world, s.location_id)
  return {
    place: s.location_id,
    enemies,
    activity: s.activity === 'adventure' ? 'adventure' : 'hunt',
    dropTable: DROP_TABLE.hunt,
    encounterNo: s.progress + 1,
  }
}

// 승리 문장: 적 정의의 victory_lines(07 §4.2), 없으면 코어 문형
export function encounterJournal(world: World, spec: EncounterSpec, out: EncounterOutcome): JournalDraft[] {
  const { content } = world
  const s = currentSortie(world)
  const enemy = content.get('enemy', spec.enemies[0]!.id)
  const place = content.get('region', spec.place)
  const coins = out.combat.rewards.reduce((a, r) => a + r.coins, 0)
  const tag = s.activity === 'adventure' ? 'adventure' : 'hunt'
  // 승리가 아닌 조우(패배·교착·도주)에는 승리 문형을 쓰지 않는다. 패배 기록은 전투 쪽(구조자 줄·부상)이 남긴다.
  // 전용 문형 슬롯은 콘텐츠(14·11) 몫이라 여기서는 비워 둔다(IMPL_DECISIONS 참조)
  if (out.combat.outcome !== 'win') return []
  const seq = s.progress
  // 동전을 얻지 못한 승리는 동전 구절을 뺀 문형을 쓴다(14 §5.1, "동전 0개" 금지)
  return [{
    tag,
    line: renderTemplate(enemy.victory_lines[seq % enemy.victory_lines.length]!, { enemy: enemy.name }),
    detail: line(content, coins > 0 ? 'hunt_win_detail' : 'hunt_win_detail_no_coins', { name: characterOf(world).name, place: place.name, enemy: enemy.name, coins }, seq),
    refs: { location_id: spec.place, sortie_id: s.id },
  }]
}

// 사냥 출정의 승리는 한 줄씩 남기지 않고 묶는다(14 §4: 같은 사냥터 연속 10회 또는 출정 종료). 모험 중 조우는 묶지 않는다([모험] 묶음 불가)
function bundleWin(world: World, spec: EncounterSpec, out: EncounterOutcome): void {
  const [single] = encounterJournal(world, spec, out)
  if (!single) return
  const enemy = world.content.get('enemy', spec.enemies[0]!.id).name
  addToBundle(world, {
    tag: 'hunt',
    single,
    coins: out.combat.rewards.reduce((a, r) => a + r.coins, 0),
    depth: 0,
    row: bundleRow(world.content, enemy, out.combat.round_count, out.combat.hp_start - out.combat.hp_end),
  })
}

// 조우 1회 = 전투 + 숨 고르기(04 §7.2). 판단 지점은 적용 끝에서 처리한다
export const encounterResolver: ActionResolver = {
  resolve(world: World): ResolvedDraft {
    const b = world.content.balance
    const spec = encounterSpec(world)
    const out = resolveEncounterStep(world, spec)
    const act = spec.enemies.length >= 2 ? b.actions.pair_encounter : b.actions.hunt_encounter
    const sec = world.rng.world.int(act.sec[0], act.sec[1]) + b.actions.breather.sec[0] + takePendingSec(world)
    return {
      duration_sec: sec,
      outcome: out.combat.outcome,
      effects: [{ ...out, spec: { ...spec } }],
      journal: currentSortie(world).activity === 'hunt' ? [] : encounterJournal(world, spec, out),
    }
  },
  apply(world: World, action): void {
    const b = world.content.balance
    const payload = action.effects[0] as unknown as EncounterOutcome & { spec: EncounterSpec }
    const s = currentSortie(world)
    // 승리를 먼저 묶음에 넣어야 이 조우의 드롭·성장(B 이상) 기록이 이 조우까지 담은 묶음을 닫는다(14 §4)
    if (s.activity === 'hunt') bundleWin(world, payload.spec, payload)
    applyEncounterStep(world, payload.spec, payload)
    addFatigue(world, payload.spec.enemies.length >= 2 ? b.actions.pair_encounter.fatigue : b.actions.hunt_encounter.fatigue)
    tickSortieBody(world, action.duration_sec / 60)
    s.progress += 1
    if (payload.defeat) {
      // 패배는 01 §6.3대로 바로 귀환한다(07 §8.1)
      world.state.current_activity.state = 'return'
      return
    }
    breather(world)
    fieldPoint(world, 'after_encounter', { encounter: s.progress })
  },
}
