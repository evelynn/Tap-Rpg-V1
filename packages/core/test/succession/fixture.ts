// 계승 테스트 도우미: 가정·자녀를 갖춘 인물과, 대본을 그대로 따르는 난수.
import { createItemInstance, type World } from '../../src/index'
import { createChildCandidate, makePartner } from '../../src/succession/index'
import { lifeWorld, setAge } from '../life/fixture'

export { lifeWorld, setAge }

// 12 §9.2처럼 굴림을 그대로 지정하는 난수. 떨어지면 예외
export function scripted(script: { chance?: boolean[]; index?: number[]; bounded?: number[]; frac?: number[] }) {
  const chance = [...(script.chance ?? [])]
  const index = [...(script.index ?? [])]
  const bounded = [...(script.bounded ?? [])]
  const frac = [...(script.frac ?? [])]
  const take = (list: number[] | boolean[], what: string) => {
    if (!list.length) throw new Error(`scripted: 예정에 없던 ${what} 호출`)
    return list.shift()!
  }
  return {
    // weightedPick이 쓰는 값: r = u32 / 2^32 × 합
    nextU32: () => Math.floor((take(frac, 'nextU32') as number) * 0x100000000),
    bounded: () => take(bounded, 'bounded') as number,
    int: (min: number) => min,
    d20: () => 10,
    chance: () => take(chance, 'chance') as boolean,
    weightedIndex: () => take(index, 'weightedIndex') as number,
    pick: <T>(items: readonly T[]) => items[0]!,
  }
}

// 가정과 자녀 n명을 갖춘 인물
export function withFamily(w: World, children = 2): World {
  makePartner(w, w.rng.life)
  for (let i = 0; i < children; i++) createChildCandidate(w, w.rng.life)
  return w
}

// 시작 소지품(W01·A01)을 치운다. 12 §6.2 예시는 노년 인물이라 시작 장비가 남아 있지 않다
export function stripStartingKit(w: World): void {
  const inv = w.state.inventory
  for (const [slot, uid] of Object.entries(inv.equipped)) {
    if (uid && w.state.item_instances[uid]?.acquired.source === 'start') {
      delete w.state.item_instances[uid]
      inv.equipped[slot as 'weapon'] = null
    }
  }
  inv.bag = inv.bag.filter((u) => w.state.item_instances[u]?.acquired.source !== 'start')
  inv.consumables = {}
}

export function give(w: World, defId: string, grade: 'common' | 'good' | 'rare' | 'legendary', to: 'equip' | 'bag'): string {
  const ch = w.state.character!
  const inst = createItemInstance(w.content, w.state, defId, grade, {
    gen: ch.generation, char_uid: ch.uid, age: 30, location: ch.location, source: 'test',
  })
  const slot = w.content.get('item', defId).slot
  if (to === 'equip') w.state.inventory.equipped[slot] = inst.uid
  else w.state.inventory.bag.push(inst.uid)
  return inst.uid
}
