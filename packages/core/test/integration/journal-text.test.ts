// 일지 문장 가드(14 §1·§6, 16 §1.4): 세계 전체를 두 생애(계승 포함) 돌려 기록에 빈 변수·병기 조사·날 템플릿이 남지 않는지 본다.
// 빈 변수는 render가 예외로 막고(I67), 이 테스트는 실제 문맥에서 그 예외가 나지 않는지와 남은 흔적을 함께 본다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { submitPendingAuto, succeed, type World } from '../../src/index'
import { baseContent, makeGame } from './life-fixture'

// 빈 값이 조사를 만나면 병기형, 빈 변수 자리는 겹친 공백·날 중괄호로 남는다. 0개는 동전 구절을 빼는 문형을 쓴다(14 §4·§5.1)
const BAD = ['을(를)', '이(가)', '은(는)', '과(와)', '(으)로', '{', '}', '  ', 'undefined', 'NaN', '동전 0개']
// 문장 전체가 값으로 들어가면 조사가 마침표 뒤에 붙는다("찼다.가 있었다")
const PARTICLE_AFTER_SENTENCE = /[.!?]["”]?(이|가|을|를|은|는|과|와|으로|로)(\s|$)/

interface Hit { where: string; text: string }

function scan(where: string, text: string | undefined, hits: Hit[]): void {
  if (!text) return
  if (BAD.some((b) => text.includes(b)) || PARTICLE_AFTER_SENTENCE.test(text)) hits.push({ where, text })
}

// 두 생애를 끝까지 돌리며 새 기록과 선택 창 문장을 모은다(생애가 끝나면 일상 기록이 지워지므로 그때그때 본다)
// 같은 태그·같은 한 줄이 연달아 나오면 14 §4 묶음이 빠진 것이다. 묶음 기록끼리(던전 3개 방 묶음이 이어짐)만 허용한다.
// 흡혈귀 갈증 반응은 출정당 1회(14 §2), [사망] 원인 기록(07 §8.2)은 S04 한 줄과 다른 문장이다
function playTwoLives(world: World): { hits: Hit[]; long: Hit[]; repeats: Hit[]; lines: number; lives: number } {
  const lineMax = world.content.balance.ui.line_max
  const hits: Hit[] = []
  const long: Hit[] = []
  const repeats: Hit[] = []
  let prev: { tag: string; line: string; bundle: boolean } | null = null
  let lastId = 0
  let lines = 0
  let lives = 0
  const collect = () => {
    for (const e of world.state.journal) {
      if (e.id <= lastId) continue
      lastId = e.id
      lines += 1
      const where = `${e.tag}${e.refs?.event_id ? ` ${e.refs.event_id}` : ''}`
      scan(`${where} 한 줄`, e.line, hits)
      scan(`${where} 상세`, e.detail, hits)
      scan(`${where} 이유`, e.reason, hits)
      if ([...e.line].length > lineMax) long.push({ where, text: e.line })
      const bundle = (e.bundle_count ?? 1) >= 2
      if (prev && prev.tag === e.tag && prev.line === e.line && !(prev.bundle && bundle)) repeats.push({ where, text: e.line })
      prev = { tag: e.tag, line: e.line, bundle }
    }
    const p = world.state.pending_choice
    if (p) {
      const r = p.preview_rendered as { body?: string; note?: string; choices?: Record<string, Record<string, unknown>> }
      scan(`${p.event_id} 선택 창`, r.body, hits)
      scan(`${p.event_id} 선택 창`, r.note, hits)
      for (const c of Object.values(r.choices ?? {})) for (const v of Object.values(c)) if (typeof v === 'string') scan(`${p.event_id} 선택지`, v, hits)
    }
  }
  for (let i = 0; i < 20000 && lives < 2; i++) {
    collect()
    if (world.state.pending_choice) {
      submitPendingAuto(world)
      continue
    }
    if (world.state.current_activity.state === 'awaiting_succession') {
      lives += 1
      if (lives < 2) succeed(world)
      continue
    }
    world.advance(600)
  }
  collect()
  return { hits, long, repeats, lines, lives }
}

const seedOf = (n: number) => (0x7000 + n).toString(16).padStart(16, '0')

describe('일지 문장 가드: 세 태도 × 여러 시드 × 두 생애', () => {
  const cases = [
    ...['stable', 'adventurous', 'challenging'].flatMap((attitude) => [0, 1, 2].map((n) => ({ attitude, seed: seedOf(n), lethal: false }))),
    // 치명 허용으로 첫 생애가 사망(S04 편지·사망 원인 줄)으로 끝나는 시드. 흡혈귀 갈증 기록도 나온다. 행동 길이·판단 순서가 바뀌면 다시 고른다
    { attitude: 'challenging', seed: '0000000000005061', lethal: true },
  ]
  for (const c of cases) {
    it(`${c.attitude} ${c.seed}${c.lethal ? ' 치명 허용' : ''}`, () => {
      const world = makeGame({ seed: c.seed, attitude: c.attitude, lethal: c.lethal })
      const r = playTwoLives(world)
      assert.equal(r.lives, 2, '두 생애를 끝내지 못했다')
      assert.ok(r.lines > 300, `기록이 너무 적다: ${r.lines}`)
      assert.deepEqual(r.hits, [], `빈 변수·병기 조사 흔적 ${r.hits.length}건`)
      assert.deepEqual(r.long, [], `한 줄 ${baseContent().balance.ui.line_max}자 초과 ${r.long.length}건(14 §1)`)
      assert.deepEqual(r.repeats, [], `같은 한 줄 연속 ${r.repeats.length}건(14 §4 묶음)`)
    })
  }
})
