// 상세 창 뷰 모델(03 §5) — 기반 팩으로 한 생애를 끝까지 돌린 세계에서 탭별 값을 본다.
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { validateContent } from '@tap/content-kit'
import { Content, createGameWorld, submitPendingAuto, succeed, type World } from '@tap/core'
import { FILTERS, attitudeNote, characterModel, checkFormula, destinationModel, familyModel, inFilter, journalModel, policyModel, suggestionsModel } from '../src/detail/model'

let content: Content

function newWorld(): World {
  const bg = content.list('background').find((b) => b.unlock === null)!
  return createGameWorld(content, {
    familyName: '모래', familySeed: '00000000000070a1', foundedUtc: 0,
    character: { name: '모라', background: bg.id, appearance: { body: 'body_base', hair: 'HR03', hair_color: 'hair_chestnut', skin_tone: 'skin_02', decor: [], age_stage_override: null } },
  })
}

// 첫 생애를 끝내고 2대째를 조금 돌린다(연대기 1줄 + 현재 인물)
function secondGen(): World {
  const w = newWorld()
  for (let i = 0; i < 20000 && w.state.family.generation < 2; i++) {
    if (w.state.pending_choice) submitPendingAuto(w)
    else if (w.state.current_activity.state === 'awaiting_succession') succeed(w)
    else w.advance(600)
  }
  w.advance(3600)
  return w
}

before(() => {
  const { bundle } = validateContent([fileURLToPath(new URL('../../../../content/base', import.meta.url))])
  assert.ok(bundle)
  content = Content.fromBundle(JSON.parse(JSON.stringify(bundle)))
})

describe('상세 창 뷰 모델(03 §5)', () => {
  it('일지: 최신이 위, 나이·계절 머리줄로 묶고, 필터는 전체의 부분집합이다', () => {
    const w = newWorld()
    w.advance(3 * 3600)
    const all = journalModel(w, '전체')
    const rows = all.flatMap((g) => g.rows)
    assert.ok(rows.length > 10)
    assert.ok(rows.every((r, i) => i === 0 || r.id < rows[i - 1]!.id), '최신이 위')
    assert.match(all[0]!.head, /^\d+세 (봄|여름|가을|겨울)$/)
    for (const f of FILTERS) {
      const n = journalModel(w, f).flatMap((g) => g.rows).length
      assert.ok(n <= rows.length, f)
    }
    assert.ok(journalModel(w, '전투').flatMap((g) => g.rows).every((r) => ['[사냥]', '[던전]', '[부상]', '[판정]'].includes(r.tag)))
  })

  it('판정 식은 01 §3.1 형식으로 펼친다', () => {
    assert.equal(
      checkFormula({ dice: 12, parts: [{ label: '지식', value: 2 }, { label: '예민한 귀', value: 2 }, { label: '지침', value: -1 }], total: 15, dc: 15, result: 'success' }),
      '주사위 12 + 지식 2 + 예민한 귀 2 − 지침 1 = 15 / 난이도 15 · 성공',
    )
  })

  it('중요 필터는 [중요]·[사망]·[은퇴]·[계승]·[발견]만', () => {
    const e = { tag: 'hunt' } as Parameters<typeof inFilter>[0]
    assert.equal(inFilter(e, '중요'), false)
    assert.equal(inFilter({ ...e, tag: 'discovery' }, '중요'), true)
  })

  it('인물: 머리 세 줄, 능력치 6·숙련 5, 장비 4칸, 가방 n/20', () => {
    const w = newWorld()
    w.advance(3600)
    const m = characterModel(w)!
    assert.match(m.title, /^모라 · \d+세 · (새내기|전성기|숙련기|노년기)$/)
    assert.match(m.line3, /^체력 \d+\/\d+ · 피로 \d+ · 동전 [\d,]+$/)
    assert.equal(m.stats.length, 6)
    assert.equal(m.skills.length, 5)
    assert.equal(m.equipment.length, 4)
    assert.equal(m.bag.max, 20)
    const worn = m.equipment.filter((e) => !('empty' in e))
    assert.ok(worn.length >= 2, '시작 장비')
    for (const it of worn) if (!('empty' in it)) assert.ok(['일반', '좋은', '희귀', '전설'].includes(it.grade.label))
    // 출정 중 예약은 줄에 표시한다(03 §5.3.1)
    const weapon = w.state.inventory.equipped.weapon!
    w.state.inventory.equip_orders = [{ uid: weapon, op: 'unequip' }]
    assert.equal((characterModel(w)!.equipment[0] as { order: string | null }).order, 'unequip')
  })

  it('교체 제안: 자동 교체가 꺼져 있을 때만, 슬롯 · 장비(출처) · 개선률 · 요인 한 줄', () => {
    const w = newWorld()
    w.state.inventory.equip_suggestions = [{ slot: 'weapon', source: { shop_def_id: 'W02', grade: 'common', price: 1200 }, improvement: 0.123, reason: 'weapon_hit', created_eff_min: 0 }]
    assert.equal(suggestionsModel(w), null) // 기본은 자동 교체 켬
    w.state.policies.auto_equip = false
    const [row] = suggestionsModel(w)!
    assert.equal(row!.line, `무기 · ${w.content.get('item', 'W02').name}(상점 1,200) · +12.3% · 무기 명중`)
    assert.equal(row!.pending, null)
    w.state.inventory.equip_suggestions[0]!.accepted = true
    assert.equal(suggestionsModel(w)![0]!.pending, '다음 정비 때 삽니다')
  })

  it('방침: 태도 3칸 중 하나만 켜지고 가중치·퇴각 줄을 보인다', () => {
    const w = newWorld()
    const p = policyModel(w)
    assert.equal(p.attitudes.length, 3)
    assert.equal(p.attitudes.filter((a) => a.on).length, 1)
    assert.match(p.attitudeLine, /^사냥 \d+ · 모험 \d+ · 던전 \d+ \/ 체력 \d+%에 퇴각$/)
    assert.equal(attitudeNote('안정적'), 'ⓘ 다음 행동부터 안정적으로 움직입니다') // 03 §2.6 원문
  })

  it('목적지: 마을 빼고 해금 장소만, 상한을 넘거나 무모한 곳만 확인을 묻는다', () => {
    const w = newWorld()
    const m = destinationModel(w)
    assert.equal(m.current, 'auto')
    assert.ok(m.places.length > 0)
    assert.ok(m.places.every((o) => w.content.get('region', o.id).kind !== 'town'))
    assert.ok(m.places.every((o) => ['매우 낮음', '낮음', '보통', '높음', '무모'].includes(o.grade)))
    assert.ok(m.places.every((o) => !o.reckless || o.ask), '무모는 늘 확인')
    assert.ok(m.places.some((o) => !o.ask), '새내기에게도 확인 없이 고를 곳이 있다')
    // 상한을 '높음'으로 올리면 높음 장소는 더 묻지 않는다
    w.state.policies.risk_cap = 'high'
    assert.ok(destinationModel(w).places.every((o) => o.ask === o.reckless))
  })

  it('가문: 2대째면 현재 인물 줄 + 끝난 생애 줄, 끝난 생애는 주요 기록을 나이순으로 펼친다', () => {
    const w = secondGen()
    const f = familyModel(w)
    assert.equal(f.title, '모래 가문 · 2대째')
    assert.equal(f.rows.length, 2)
    assert.match(f.rows[0]!.head, /^2대 .+ · 현재 · /)
    assert.match(f.rows[1]!.head, /^1대 모라  18~\d+세 · (은퇴|사망|긴 잠) · /)
    const ages = f.rows[1]!.lines.filter((l) => /^\d+세 /.test(l)).map((l) => Number(l.split('세')[0]))
    assert.ok(ages.length > 0, '주요 기록')
    assert.deepEqual(ages, [...ages].sort((a, b) => a - b))
  })
})
