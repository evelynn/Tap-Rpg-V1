// 창 껍데기·설정·안내(03 §7·§10·§12, D85)의 계산 부분
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Content, JournalEntry, World } from '@tap/core'
import { DEFAULT_SETTINGS, readSettings } from '../src/settings'
import { GUIDES, GUIDE_GAP_MS, GuideScheduler } from '../src/guide'
import { MAGNET, MARGIN, clampInto, defaultAnchor, magnet } from '../src/window'

const wa = { x: 0, y: 0, w: 1920, h: 1152 }
const basic = { width: 768, height: 128 }

describe('창 위치(03 §10)', () => {
  it('기본 위치: 작업 영역 오른쪽 16, 작업 표시줄 위 8(기본 창 왼쪽 아래 기준)', () => {
    assert.deepEqual(defaultAnchor(wa, 768), { x: 1920 - MARGIN.right - 768, y: 1152 - MARGIN.bottom })
  })
  it('가장자리 자석: 12 안이면 붙고, 밖이면 그대로', () => {
    assert.deepEqual(magnet({ x: 5, y: 1150 }, basic, wa), { x: 0, y: 1152 })
    assert.deepEqual(magnet({ x: 1920 - 768 - 11, y: 600 }, basic, wa), { x: 1920 - 768, y: 600 })
    assert.deepEqual(magnet({ x: MAGNET + 1, y: 600 }, basic, wa), { x: MAGNET + 1, y: 600 })
  })
  it('작업 영역 밖으로 16 넘게 나가면 안으로 끌어들인다', () => {
    assert.deepEqual(clampInto({ x: -400, y: 1500 }, basic, wa), { x: 0, y: 1152 })
    assert.deepEqual(clampInto({ x: -10, y: 600 }, basic, wa), { x: -10, y: 600 })
  })
})

describe('설정(03 §7)', () => {
  it('옛 설정·틀린 값은 기본값, 아는 칸만 읽는다', () => {
    assert.deepEqual(readSettings(null), DEFAULT_SETTINGS)
    const s = readSettings({ window_scale: 2, text_scale: 1.25, theme: 'dark', record_strip: false, window_pos: { monitor: 'A', rx: 0.5, rb: 1 }, junk: 1 })
    assert.equal(s.window_scale, 2)
    assert.equal(s.text_scale, 1.25)
    assert.equal(s.theme, 'dark')
    assert.equal(s.record_strip, false)
    assert.deepEqual(s.window_pos, { monitor: 'A', rx: 0.5, rb: 1 })
    assert.equal(readSettings({ window_scale: 5, text_scale: 2, theme: 'neon' }).window_scale, 1)
    assert.equal(readSettings({ text_scale: 2 }).text_scale, 1)
    assert.equal(readSettings({ theme: 'neon' }).theme, 'system')
    assert.equal(readSettings({ window_width: 99999 }).window_width, 1536, '손상된 너비는 범위 안으로')
    assert.deepEqual(readSettings({ guides_seen: ['start', 3] }).guides_seen, ['start'])
  })
})

describe('첫 실행 안내(03 §11.2·§12.2)', () => {
  const mkWorld = (journal: Partial<JournalEntry>[], gen = 1, sortie: string | null = null): World => ({
    state: { family: { generation: gen, chronicle: [] }, character: {}, journal, current_activity: { sortie: sortie ? { id: sortie } : null }, policies: { attitude: 'stable' } },
    content: {} as Content,
  }) as unknown as World
  it('시작 안내 뒤 새 기록마다 한 번, 60초 간격으로만', () => {
    const shown: string[] = []
    let done = false
    const g = new GuideScheduler({} as Content, (t) => shown.push(t), () => done, () => { done = true })
    const j: Partial<JournalEntry>[] = [{ id: 1, tag: 'travel' }]
    g.tick(mkWorld(j), 0)
    assert.equal(shown.length, 1)
    j.push({ id: 2, tag: 'hunt' }, { id: 3, tag: 'check' })
    g.tick(mkWorld(j), 1000)
    assert.equal(shown.length, 1, '60초 안에는 미룬다')
    g.tick(mkWorld(j), GUIDE_GAP_MS)
    g.tick(mkWorld(j), GUIDE_GAP_MS + 10)
    assert.equal(shown.length, 2)
    assert.match(shown[1]!, /일지/)
    j.push({ id: 4, tag: 'hunt' })
    g.tick(mkWorld(j), GUIDE_GAP_MS * 2)
    g.tick(mkWorld(j), GUIDE_GAP_MS * 3)
    assert.equal(shown.filter((s) => /일지/.test(s)).length, 1, '같은 안내는 한 번만')
  })
  it('이미 본 안내는 다시 켜도 뜨지 않고, 새로 본 안내는 알린다', () => {
    const shown: string[] = []
    let saved: string[] = []
    const g = new GuideScheduler({} as Content, (t) => shown.push(t), () => false, () => {}, ['start', 'journal'], (ids) => { saved = ids })
    g.tick(mkWorld([{ id: 1, tag: 'travel' }]), 0)
    g.tick(mkWorld([{ id: 1, tag: 'travel' }, { id: 2, tag: 'hunt' }, { id: 3, tag: 'check' }]), 0)
    assert.equal(shown.length, 1)
    assert.match(shown[0]!, /판정/)
    assert.ok(saved.includes('check'))
  })
  it('대기열에만 있는 안내는 본 것으로 저장하지 않는다(독립 재검증 반례 6)', () => {
    let saved: string[] = []
    const g = new GuideScheduler({} as Content, () => {}, () => false, () => {}, [], (ids) => { saved = ids })
    const j: Partial<JournalEntry>[] = [{ id: 1, tag: 'travel' }]
    g.tick(mkWorld(j), 0)
    assert.deepEqual(saved, ['start'])
    j.push({ id: 2, tag: 'hunt' }, { id: 3, tag: 'check' })
    g.tick(mkWorld(j), 1000)
    assert.deepEqual(saved, ['start'], '60초 안에 대기 중인 안내는 아직 저장하지 않는다')
  })
  it('두 번째 인물(연대기 있음)·안내를 다 본 뒤에는 뜨지 않는다', () => {
    const shown: string[] = []
    const g = new GuideScheduler({} as Content, (t) => shown.push(t), () => false, () => {})
    const w = mkWorld([{ id: 1, tag: 'hunt' }], 2)
    g.tick(w, 0)
    assert.equal(shown.length, 0)
    const g2 = new GuideScheduler({} as Content, (t) => shown.push(t), () => true, () => {})
    g2.tick(mkWorld([{ id: 1 }]), 0)
    assert.equal(shown.length, 0)
    assert.equal(GUIDES.length, 8)
  })
})
