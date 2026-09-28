// D77: 레벨업·숙련 상승 [성장] 기록과 좋아진 점, 비어 있던 상세, 최근 요약(14 §1.1)이 실제 생애에서 남는가.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { growthNotes, growthSeenOf, submitPendingAuto, type JournalEntry, type World } from '../../src/index'
import { makeGame } from './life-fixture'

// 일상 기록은 인물당 300개로 잘리므로(14 §1) 도는 동안 남은 기록을 모두 모아 돌려준다
function run(w: World, steps: number): JournalEntry[] {
  const all = new Map<number, JournalEntry>()
  for (let i = 0; i < steps; i++) {
    if (w.state.pending_choice) submitPendingAuto(w)
    else w.advance(600)
    for (const e of w.state.journal) all.set(e.id, e)
  }
  return [...all.values()].sort((a, b) => a.id - b.id)
}

describe('성장 기록과 상세 글(D77)', () => {
  it('레벨이 오를 때마다 [성장] 한 줄과 좋아진 점(최대 체력·배분 능력치·다음 배분 레벨)을 남긴다', () => {
    const w = makeGame()
    const seen = run(w, 40)
    const ch = w.state.character!
    assert.ok(ch.level >= 4, `레벨 ${ch.level}`)
    const levels = seen.filter((e) => e.tag === 'growth' && /레벨 \d+(이|가) 되었다$/.test(e.line))
    assert.equal(levels.length, ch.level - 1, '레벨 2부터 지금까지 하나씩')
    for (const e of levels) assert.match(e.detail!, /최대 체력이 \d+ 늘/)
    // 배분 레벨(4)은 오른 능력치와 그 쓰임을 쓴다
    const four = levels.find((e) => e.line.includes('레벨 4'))!
    assert.match(four.detail!, /(힘|민첩|지식|의지|사교|행운)이 1 올랐다\.\n\S+[은는] .+에 쓰인다\./)
    assert.ok(ch.stat_growth.some((g) => g.level === 4))
    // 레벨 5는 주요(18 §4.1 level5)
    const five = levels.find((e) => e.line.includes('레벨 5'))
    if (five) assert.deepEqual([five.sub, five.importance], ['level5', 'major'])
  })

  it('숙련 단계가 오르면 [성장] 기록에 더하는 판정과 다음 단계까지 남은 횟수를 쓴다', () => {
    const w = makeGame()
    const ranks = run(w, 40).filter((e) => e.tag === 'growth' && e.line.endsWith('솜씨가 한 단계 늘었다'))
    assert.ok(ranks.length > 0)
    for (const e of ranks) assert.match(e.detail!, /숙련이 \d단계가 되었다\. .+ 판정에 \d(을|를) 더한다\.\n(다음 단계까지 \d+번을 더 겪어야 한다|이제 더 오를 단계가 없다)\./)
  })

  it('알린 값을 저장해 같은 성장을 두 번 쓰지 않고, 다른 인물이면 기록 없이 맞춘다', () => {
    const w = makeGame()
    run(w, 10)
    const seen = growthSeenOf(w)
    assert.deepEqual(growthNotes(w, seen).drafts, [])
    assert.deepEqual(growthNotes(w, { ...seen, char_uid: 'ch_9999' }).drafts, [])
    assert.deepEqual(growthNotes(w, null).drafts, [])
    const back = growthNotes(w, { ...seen, level: seen.level - 1 })
    assert.equal(back.drafts.length, 1)
    assert.equal(back.levelFrom, seen.level - 1)
  })

  it('휴식·줍기·교체·길드 등급 기록이 상세 문장을 가진다(14 §1)', () => {
    const w = makeGame()
    const mine = run(w, 60)
    const lacking = mine.filter((e) => ['rest', 'gear', 'growth'].includes(e.tag) && !e.detail && !(e.bundle_count && e.bundle_count > 1))
    assert.deepEqual(lacking.map((e) => e.line), [])
    const rest = mine.find((e) => e.tag === 'rest' && !(e.bundle_count && e.bundle_count > 1))!
    assert.match(rest.detail!, /쉬었다/)
  })

  it('최근 요약: 출정·마을 체류마다 1~4문장, 마지막 줄은 숫자 줄, 최근 10개만', () => {
    const w = makeGame()
    run(w, 80)
    const rs = w.state.character!.recent_summaries
    assert.equal(rs.length, w.content.balance.ui.recent_summary_keep)
    assert.ok(rs.some((r) => r.kind === 'sortie') && rs.some((r) => r.kind === 'town'))
    for (const r of rs) {
      assert.ok(r.lines.length >= 2 && r.lines.length <= 4, r.lines.join(' / '))
      for (const l of r.lines.slice(0, -1)) assert.ok([...l].length <= 40, l)
      assert.match(r.lines.at(-1)!, r.kind === 'sortie' ? /^동전 \+\d+ · 경험 \+\d+ · 체력 \d+% · / : /^동전 [+−]\d+ · 체력 \d+% · /)
    }
    assert.ok(rs.every((r, i) => i === 0 || r.eff_min >= rs[i - 1]!.eff_min), '최신이 뒤')
  })
})
