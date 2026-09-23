// 시뮬레이터 실행과 보고(17 §5). 소수 생애(태도별 2생애 × 120분)로 잰다
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../src/args'
import { toCsv, toMarkdown, CSV_COLUMNS } from '../src/report'
import { lifeCap, resolveAttitudes, runSim } from '../src/run'
import { baseContent, BASE_PACK } from './fixture'

const ARGV = ['--seeds', '1-2', '--minutes', '120', '--content', BASE_PACK, '--rules', 'test']
// 소요 시간은 보고 안에서만 달라지므로 시계를 고정해 두 실행을 그대로 비교한다
const FROZEN = () => 0

const run = () => runSim(parseArgs(ARGV), FROZEN)

describe('실행 범위', () => {
  it('생애당 상한은 인자가 없으면 콘텐츠의 생애 길이에서 낸다', () => {
    const content = baseContent()
    const t = content.balance.time
    assert.equal(lifeCap(content, 0), (t.base_retire_age - t.start_age) * t.min_per_year * 3)
    assert.equal(lifeCap(content, 120), 120)
  })

  it('--attitude all은 콘텐츠의 태도를 order 순으로 편다', () => {
    const content = baseContent()
    assert.deepEqual(resolveAttitudes(content, 'all'), ['stable', 'adventurous', 'challenging'])
    assert.deepEqual(resolveAttitudes(content, 'challenging'), ['challenging'])
    assert.throws(() => resolveAttitudes(content, '없는태도'))
  })
})

describe('태도별 2생애 × 120분', () => {
  const { rows, report } = run()

  it('태도 3종 × 시드 2개 = 6생애가 나온다', () => {
    assert.equal(rows.length, 6)
    assert.deepEqual([...new Set(rows.map((r) => r.attitude))], ['stable', 'adventurous', 'challenging'])
    assert.deepEqual([...new Set(rows.map((r) => r.seed))].sort(), [1, 2])
    for (const r of rows) {
      assert.equal(r.gen, 1)
      assert.ok(r.minutes > 0 && r.minutes <= 120, `유효 진행 분 ${r.minutes}`)
    }
  })

  it('규칙 코드를 그대로 돌려 관측값이 채워진다', () => {
    for (const r of rows) {
      assert.ok(r.combat_rounds !== null && r.combat_rounds > 0, '전투 라운드')
      assert.ok(r.combat_hp_loss !== null, '체력 손실')
      assert.ok(r.sortie_minutes !== null && r.sortie_minutes > 0, '출정 길이')
      assert.ok(r.share_hunt !== null, '활동 비중')
      assert.equal(Math.round((r.share_hunt ?? 0) + (r.share_adventure ?? 0) + (r.share_dungeon ?? 0)), 100)
      assert.ok(r.income > 0 && r.spend > 0, '수입·지출')
      assert.equal(r.expense_ratio, Math.round((100000 * r.spend) / r.income) / 1000)
      assert.ok(r.sorties > 0, '출정 횟수')
      // 첫 5분·첫 10분 보장은 새 가문 첫 인물에서만 0/1로 잰다(01 §17)
      for (const v of [r.first5_level2, r.first5_equip, r.first10_check, r.first10_return, r.first10_rest]) {
        assert.ok(v === 0 || v === 1, '첫 5분·10분 항목')
      }
    }
  })

  it('보고에 01 §17 지표가 모두 있고 태도마다 집계된다', () => {
    const keys = report.metrics.map((m) => m.key)
    for (const k of ['combat_rounds', 'combat_hp_loss', 'sortie_minutes', 'level10_age', 'level20_age',
      'retire_level', 'share_hunt', 'share_adventure', 'share_dungeon', 'normal_defeats', 'fate_offers',
      'expense_ratio', 'first5_level2', 'first5_equip', 'first10_check', 'first10_return', 'first10_rest']) {
      assert.ok(keys.includes(k), `지표 ${k}가 없다`)
    }
    for (const m of report.metrics) {
      assert.deepEqual(Object.keys(m.by_attitude), report.attitudes)
      for (const a of report.attitudes) assert.equal(m.by_attitude[a]!.lives <= 2, true)
    }
    assert.equal(report.life_count, 6)
    assert.equal(report.rules, 'test')
    assert.ok(report.content_hash.length > 0)
  })

  it('경보(17 §8)는 잴 수 없는 것을 발동으로 세지 않는다', () => {
    const ids = report.alerts.map((a) => a.id)
    assert.deepEqual(ids, ['R1', 'R2', 'R3', 'R4', 'R8', 'R9', 'R10', 'R11'])
    const r3 = report.alerts.find((a) => a.id === 'R3')!
    assert.equal(r3.fired, null, '2대 이후 생애가 없으면 잴 수 없다')
  })

  it('CSV는 생애마다 한 줄이고 열이 헤더와 같다', () => {
    const lines = toCsv(rows).trimEnd().split('\n')
    assert.equal(lines.length, rows.length + 1)
    assert.equal(lines[0], CSV_COLUMNS.join(','))
    for (const line of lines.slice(1)) assert.equal(line.split(',').length, CSV_COLUMNS.length)
  })

  it('Markdown 요약에 17 §5.3 머리글·판정·경보가 있다', () => {
    const md = toMarkdown(report)
    assert.match(md, /시뮬레이션 보고 · 규칙 버전 test/)
    assert.match(md, /시드 1~2 · 6생애/)
    assert.match(md, /\| 지표 \| stable \| adventurous \| challenging \| 목표 \| 판정 \|/)
    assert.match(md, /불합격 지표: /)
    assert.match(md, /## 경보\(17 §8\)/)
    assert.match(md, /## 관찰 지표/)
  })
})

describe('결정성(13 §8.3)', () => {
  it('같은 시드를 두 번 돌리면 같은 보고가 나온다', () => {
    const a = run()
    const b = run()
    assert.equal(toCsv(a.rows), toCsv(b.rows))
    assert.equal(toMarkdown(a.report), toMarkdown(b.report))
    assert.deepEqual(a.report, b.report)
  })

  it('태도를 따로 돌려도 같은 시드면 같은 줄이 나온다', () => {
    const one = runSim(parseArgs(['--attitude', 'challenging', '--seeds', '1-2', '--minutes', '120', '--content', BASE_PACK]), FROZEN)
    const all = run().rows.filter((r) => r.attitude === 'challenging')
    assert.deepEqual(one.rows, all)
  })
})
