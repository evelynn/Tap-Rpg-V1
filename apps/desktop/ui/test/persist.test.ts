// 저장·이어하기(13 §8, 03 §9): 브라우저 저장소 흉내로 이어하기·부재 정산·손상 복구·백업 순환을 본다
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { validateContent } from '@tap/content-kit'
import { Content, bodyChecksum, createGameWorld, loadGameWorld, makeSaveRoot, serializeSave, summaryView, type World } from '@tap/core'
import { Saver, loadGame, localBackend } from '../src/persist'

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

const meta = (now: number) => ({ app_version: 't', saved_at_utc: now, content_packs: [{ id: 'base', version: '0' }], content_hash: 'x' })

function newWorld(): World {
  const bg = content.list('background').find((b) => b.unlock === null)!
  return createGameWorld(content, {
    familyName: '모래', familySeed: '00000000000070a1', foundedUtc: 0,
    character: { name: '모라', background: bg.id, appearance: { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null } },
  })
}

before(() => {
  const { bundle } = validateContent([fileURLToPath(new URL('../../../../content/base', import.meta.url))])
  assert.ok(bundle)
  content = Content.fromBundle(JSON.parse(JSON.stringify(bundle)))
})

describe('저장·이어하기', () => {
  it('저장이 없으면 none, 저장하면 같은 가문·일지로 이어진다(A1)', async () => {
    const store = new MemStorage() as unknown as Storage
    const be = localBackend(store)
    assert.equal((await loadGame(be, content, 1000)).kind, 'none')
    const w = newWorld()
    w.advance(3600)
    const saver = new Saver(be, () => w, () => meta(Date.now()))
    await saver.flush()
    const r = await loadGame(be, content, Date.now())
    assert.equal(r.kind, 'ok')
    if (r.kind !== 'ok') return
    assert.equal(r.world.state.family.name, '모래')
    assert.equal(r.world.state.character!.uid, w.state.character!.uid)
    assert.ok(r.world.state.journal.length >= w.state.journal.length)
  })

  it('10분 넘게 비우면 정산하고 요약 문장을 만든다(A2, 8시간 상한)', async () => {
    const store = new MemStorage() as unknown as Storage
    const be = localBackend(store)
    const w = newWorld()
    w.advance(600)
    const saved = 1_800_000_000_000
    await be.write(serializeSave(makeSaveRoot(w.snapshot(), meta(saved))), false, false, 3)
    const r = await loadGame(be, content, saved + 12 * 3600 * 1000)
    assert.equal(r.kind, 'ok')
    if (r.kind !== 'ok' || !r.summary) return assert.fail('정산 요약이 없다')
    assert.ok(r.summary.settled_sec <= 8 * 3600)
    const v = summaryView(r.world, r.summary)
    assert.match(v.head, /^약 .+ 활동 · \d+세 → \d+세$/)
    assert.ok(v.lines.some((l) => l.startsWith('동전 ')))
  })

  it('save.json이 깨지면 백업으로 복구하고 recovered를 알린다(A3)', async () => {
    const store = new MemStorage() as unknown as Storage
    const be = localBackend(store)
    const w = newWorld()
    const saver = new Saver(be, () => w, () => meta(Date.now()))
    await saver.request({ backup: true, force: true })
    w.advance(600)
    await saver.request({ backup: true, force: true }) // save → backup_1, 새 save
    store.setItem('tap.save/save.json', '{"header":')
    const r = await loadGame(be, content, Date.now())
    assert.equal(r.kind, 'ok')
    if (r.kind === 'ok') assert.equal(r.recovered, true)
  })

  it('모든 파일이 깨지면 fail이고 손상 파일을 치운다', async () => {
    const store = new MemStorage() as unknown as Storage
    store.setItem('tap.save/save.json', 'x')
    const r = await loadGame(localBackend(store), content, Date.now())
    assert.equal(r.kind, 'fail')
    assert.equal(store.getItem('tap.save/save.json'), null)
  })

  it('고른 파일로 세계를 만들지 못하면 그 파일만 옮기고 다음 정상 파일로 복구한다(13 §8.5)', async () => {
    const store = new MemStorage() as unknown as Storage
    const be = localBackend(store)
    const w = newWorld()
    const saver = new Saver(be, () => w, () => meta(Date.now()))
    await saver.request({ backup: true, force: true })
    w.advance(600)
    await saver.request({ backup: true, force: true }) // save → backup_1, 새 save
    const backup = store.getItem('tap.save/backup_1.json')
    assert.ok(backup)
    let calls = 0
    const r = await loadGame(be, content, Date.now(), (c, body) => {
      if (calls++ === 0) throw new Error('세계 만들기 실패')
      return loadGameWorld(c, body)
    })
    assert.equal(r.kind, 'ok')
    if (r.kind === 'ok') assert.equal(r.recovered, true)
    assert.equal(store.getItem('tap.save/save.json'), null, '실패한 파일만 옮긴다')
    assert.equal(store.getItem('tap.save/backup_1.json'), backup, '정상 백업은 그대로 둔다')
  })

  it('쓰기가 실패하면 백업·강제 표시를 다음 저장으로 넘긴다', async () => {
    const store = new MemStorage() as unknown as Storage
    const seen: [boolean, boolean][] = []
    const be = { ...localBackend(store), write: async (_t: string, backup: boolean, force: boolean) => {
      seen.push([backup, force])
      if (seen.length === 1) throw new Error('디스크 오류')
    } }
    const w = newWorld()
    const saver = new Saver(be, () => w, () => meta(Date.now()))
    await saver.request({ backup: true, force: true })
    assert.equal(seen.length, 1, '실패한 쓰기를 바로 되풀이하지 않는다')
    await saver.request()
    await saver.request()
    assert.deepEqual(seen, [[true, true], [true, true], [false, false]])
  })

  it('행동 직후 저장은 2초 간격으로 다시 돈다(독립 검증 결함 2: 시계가 달라 첫 저장 뒤 멈추던 것)', async () => {
    const store = new MemStorage() as unknown as Storage
    let writes = 0
    const be = { ...localBackend(store), write: async () => { writes++ } }
    const w = newWorld()
    const saver = new Saver(be, () => w, () => meta(Date.now()))
    await saver.request()
    assert.equal(writes, 1)
    saver.requestThrottled(Date.now() + 1000)
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(writes, 1, '2초 안에는 쓰지 않는다')
    saver.requestThrottled(Date.now() + 2500)
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(writes, 2)
  })

  it('열 수 없는 새 버전 기록은 blocked이고 어떤 파일도 옮기거나 덮지 않는다(독립 재검증 반례 9)', async () => {
    const store = new MemStorage() as unknown as Storage
    const body = { future_field: 1 }
    const text = JSON.stringify({ header: { schema_version: 99, checksum: bodyChecksum(body), saved_at_utc: 0 }, body })
    store.setItem('tap.save/save.json', text)
    const r = await loadGame(localBackend(store), content, Date.now())
    assert.equal(r.kind, 'blocked')
    assert.equal(store.getItem('tap.save/save.json'), text)
  })
})
