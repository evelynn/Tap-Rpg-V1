// 교차 E2E(완성 판정 A26): 첫 실행 → 진행 → 저장 → 부재 뒤 이어하기(정산·요약) → 운명 선택 → 생애 끝·책 → 계승 → 다음 세대 → 다시 이어하기.
// 화면 조작 대신 화면이 부르는 같은 함수(persist·summaryView·bookOf·succeed)를 차례로 부른다.
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { validateContent } from '@tap/content-kit'
import {
  Content, bookOf, createGameWorld, pendingSuccession, setAttitude, submitPendingAuto, succeed, summaryView, type World,
} from '@tap/core'
import { Saver, loadGame, localBackend } from '../src/persist'
import { bookPages } from '../src/book'
import { FirstRunWindow } from '../src/firstrun'
import { HAIR_STYLES, HAIR_TONES } from '../src/hair'
import { sceneFor } from '../src/scenes'

let content: Content
class MemStorage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.get(k) ?? null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, v) }
}

before(() => {
  const { bundle } = validateContent([fileURLToPath(new URL('../../../../content/base', import.meta.url))])
  assert.ok(bundle)
  content = Content.fromBundle(JSON.parse(JSON.stringify(bundle)))
})

describe('교차 E2E(A26)', () => {
  it('한 가문이 첫 실행부터 다음 세대 이어하기까지 예외 없이 이어진다', async () => {
    const store = new MemStorage() as unknown as Storage
    const be = localBackend(store)
    let now = 1_800_000_000_000
    const meta = () => ({ app_version: 't', saved_at_utc: now, content_packs: [{ id: 'base', version: '0' }], content_hash: 'x' })
    // 1 첫 실행(저장 없음 → 첫 실행 창 값으로 새 가문)
    assert.equal((await loadGame(be, content, now)).kind, 'none')
    const bg = content.list('background').find((b) => b.unlock === null)!
    let w: World = createGameWorld(content, {
      familyName: '작은등불', familySeed: '00000000000070a1', foundedUtc: now,
      character: { name: '키아', background: bg.id, appearance: { ...FirstRunWindow.defaultAppearance(), hair: 'HR05', hair_color: 'hair_ash' } },
    })
    setAttitude(w, 'adventurous')
    const saver = new Saver(be, () => w, meta)
    await saver.request({ backup: true })
    // 2 30분 진행 → 저장
    for (let i = 0; i < 300 && w.state.character!.eff_min < 30; i++) {
      if (w.state.pending_choice) submitPendingAuto(w)
      else w.advance(60)
    }
    await saver.flush()
    // 3 2시간 뒤 다시 켬 → 이어짐 + 정산 요약
    now += 2 * 3600 * 1000
    const r = await loadGame(be, content, now)
    assert.equal(r.kind, 'ok')
    if (r.kind !== 'ok') return
    w = r.world
    assert.equal(w.state.family.name, '작은등불')
    assert.equal(w.state.character!.appearance.hair, 'HR05')
    if (r.summary) assert.match(summaryView(w, r.summary).head, /활동/)
    // 4 운명 선택을 풀며 생애 끝까지 → 책
    for (let i = 0; i < 40000 && w.state.current_activity.state !== 'awaiting_succession'; i++) {
      if (w.state.pending_choice) submitPendingAuto(w)
      else w.advance(600)
    }
    assert.equal(w.state.current_activity.state, 'awaiting_succession')
    const rec = w.state.family.chronicle.at(-1)!
    const book = bookOf(rec)
    assert.ok(book, '생애의 책이 엮였다')
    assert.equal(book!.fallback, false)
    assert.ok(bookPages(book!).length >= 5)
    assert.ok(Object.keys(w.state.family.codex.seen).length > 0, '도감 본 적 있음')
    await saver.request({ backup: true, force: true })
    // 5 계승 → 다음 세대 출발, 책 받은 사람
    const plan = pendingSuccession(w)!
    const heir = succeed(w)
    assert.equal(heir.generation, 2)
    assert.equal(bookOf(w.state.family.chronicle.at(-1)!)!.received_by?.char_uid, heir.uid)
    assert.equal(w.state.family.chronicle.at(-1)!.candidates_passed.length, plan.candidates.length - 1)
    // 출발 한 줄(sub depart) → 계승 출발 장면 ES21(D89), 새 인물 머리는 합성할 수 있는 값(D88)
    const depart = w.state.journal.filter((e) => e.sub === 'depart').at(-1)
    assert.ok(depart, '출발 한 줄')
    assert.equal(sceneFor('depart', new Set(['ES21']))?.scene, 'ES21')
    assert.ok((HAIR_STYLES as readonly string[]).includes(heir.appearance.hair), heir.appearance.hair)
    assert.ok(heir.appearance.hair_color in HAIR_TONES, heir.appearance.hair_color)
    for (let i = 0; i < 100; i++) w.advance(60)
    await saver.flush()
    // 6 다시 이어하기: 2대째, 책이 서가에 남아 있다
    now += 60_000
    const r2 = await loadGame(be, content, now)
    assert.equal(r2.kind, 'ok')
    if (r2.kind !== 'ok') return
    assert.equal(r2.world.state.family.generation, 2)
    assert.ok(bookOf(r2.world.state.family.chronicle[0]!))
  })
})
