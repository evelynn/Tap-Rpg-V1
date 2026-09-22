// 적 수치 기준식(01 §5.1, balance.enemy_formula). 레벨이 바뀐 적의 런타임 수치와 콘텐츠 검사 V17이 함께 쓴다.
// 반올림은 부록 A(Python round)와 같게 짝수 쪽으로, 올림·내림은 부동소수 잡음(10×1.3)을 없앤 값에 한다(I16).
// 이렇게 해야 01 §5.2 등록부 13종과 모두 맞는다. 레벨 오프셋 0이면 적 정의값을 쓴다(CONTENT_SCHEMA §5.1).
import type { Balance, Enemy } from '../schema/index'

export function enemyStats(f: Balance['enemy_formula'], level: number, rank: Enemy['rank']) {
  const clean = (x: number) => Math.round(x * 1e9) / 1e9
  const apply = (mode: 'round' | 'ceil' | 'floor', x: number) => {
    if (mode !== 'round') return Math[mode](clean(x))
    const lo = Math.floor(x)
    const frac = x - lo
    return frac > 0.5 ? lo + 1 : frac < 0.5 ? lo : lo % 2 === 0 ? lo : lo + 1
  }
  const n = f.normal
  const step = (p: { base: number; div: number }) => p.base + Math.floor(clean(level / p.div))
  const hpRaw = n.hp.base + n.hp.per_level * level
  const xp = apply(f.rounding.base, n.xp.base + n.xp.per_level * level)
  const coins = apply(f.rounding.base, (n.coins.base + n.coins.per_level * level) * n.coins.growth ** level)
  const base = { hp: apply(f.rounding.base, hpRaw), ac: step(n.ac), hit: step(n.hit), dmg_min: step(n.dmg_min), dmg_max: step(n.dmg_max), xp, coins }
  if (rank === 'normal') return base
  const m = f[rank]
  return {
    hp: apply(f.rounding.hp_mult, hpRaw * m.hp_mult),
    ac: base.ac + m.ac_add,
    hit: base.hit + m.hit_add,
    dmg_min: apply(f.rounding.dmg_mult, base.dmg_min * m.dmg_mult),
    dmg_max: apply(f.rounding.dmg_mult, base.dmg_max * m.dmg_mult),
    xp: apply(f.rounding.xp_coins_mult, base.xp * m.xp_mult),
    coins: apply(f.rounding.xp_coins_mult, base.coins * m.coins_mult),
  }
}
