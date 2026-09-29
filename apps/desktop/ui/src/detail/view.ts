// 상세 창(03 §5, 480 × 560) DOM. 탭 4개(일지·인물·방침·가문), Esc 닫기, Ctrl+1~4 탭 전환.
// 세계를 바꾸는 조작은 코어 함수만 부른다(잠금·유품·장착·태도·방침 값). 글자는 모두 textContent로 넣는다.
import {
  acceptEquipSuggestion, arm, armBlock, cancelEquipOrder, charges, healBlock, healNow, isArmed, unarm, designateRelic, dismissSuggestion, seasonKey as seasonKeyOf, type Slot, equipManual, orderEquip, renderTemplate, setAttitude, setLock, undesignateRelic, unequip, type Policies, type World,
} from '@tap/core'
import { BookViewer, asBook, shelfView } from '../book'
import * as core from '@tap/core'
import {
  FILTERS, attitudeNote, characterModel, destinationModel, familyModel, lockedPlaces, journalModel, policyModel, codexModel, recentModel, relicsModel, suggestionsModel, treeModel, type Filter, type ItemRow,
} from './model'

export const TABS = ['일지', '인물', '방침', '가문'] as const
const FAMILY_SUBS = ['연대기', '서가', '가계도', '도감', '유품'] as const
type FamilySub = (typeof FAMILY_SUBS)[number]
export type Tab = (typeof TABS)[number]

type Kids = (Node | string | null | false | undefined)[]

export function h(tag: string, attrs: Record<string, string> = {}, ...kids: Kids): HTMLElement {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const k of kids) if (k !== null && k !== false && k !== undefined) el.append(k)
  return el
}

// 책을 처음 펼치면 opened(18 §7.2 덧붙임 전용). 코어 API가 있으면 그것으로
function markOpened(world: World, gen: number): void {
  const r = world.state.family.chronicle.find((x) => x.gen === gen)
  const b = r ? core.bookOf(r) : null
  if (b) core.markBookOpened(b)
}

export function button(label: string, onClick: () => void, opts: { on?: boolean; disabled?: boolean; title?: string } = {}): HTMLElement {
  const b = h('button', { type: 'button', ...(opts.title ? { title: opts.title } : {}) }, label) as HTMLButtonElement
  if (opts.on) b.classList.add('on')
  b.disabled = !!opts.disabled
  b.onclick = (e) => {
    e.stopPropagation()
    onClick()
  }
  return b
}

// 방침 설명 문구(03 §5.4 표 원문 일부)
const HELP: Partial<Record<keyof Policies, string>> = {
  attitude: '태도는 무엇을 하며 살지를 정합니다. 바꾸면 다음 행동부터 적용됩니다. 진행 중인 전투는 그대로 끝납니다.',
  auto_equip: '끄면 장비를 스스로 사거나 바꾸지 않고, 바꿀 만한 장비를 일지에 제안만 남깁니다.',
  family_formation: '끄면 가정을 꾸리는 사건이 일어나지 않습니다. 후계자는 친척이나 가문이 맞아들인 아이 가운데서 나옵니다.',
  auto_succession: '켜면 생애가 끝났을 때 기본 후보로 바로 다음 세대를 시작합니다. 끝난 생애의 기록은 언제든 다시 볼 수 있습니다.',
  offline_progress: '프로그램을 닫아 둔 동안에도 최대 8시간까지 같은 규칙으로 살아갑니다.',
  stage_boundary_stop: '오프라인 동안 30세, 50세, 65세 문턱을 넘으면 그 자리에서 멈춥니다.',
  destination: '특정 장소를 고르면 태도와 상관없이 그곳을 우선합니다. 위험 허용 상한을 넘거나 무모한 곳은 한 번 확인한 뒤 고를 수 있습니다. 목숨을 걸어야 하는 관문은 치명 위험 허용이 켜져 있어야 도전합니다.',
}

// 가호 문구(03 §5.4, D78)
const BLESSING_HELP = '인물은 알지 못하는 도움입니다. 걸어 둔 가호는 조건이 오는 순간 스스로 일어납니다. 켜 두어서 차오르지 않고, 인물이 고비를 넘길 때와 세대가 바뀔 때 차오릅니다.'
const ARMED_NAME = { final_save: '최후의 순간을 지킨다', miracle: '기적의 주사위', mitigate: '궂은일을 누그러뜨린다' } as const
const ARMED_NOTE = {
  final_save: '치명 관문에서 쓰러져도 한 번 살아 돌아옵니다(생애 1번)',
  miracle: '중요한 판정이 실패하면 한 번 더 굴립니다',
  mitigate: '다음 패배의 손실을 막고 큰 부상을 가볍게 합니다',
} as const
const BLOCK_TEXT: Record<string, string> = {
  no_charge: '별빛이 모자랍니다', life_cap: '이번 생애에는 더 쓸 수 없습니다(3번)', armed: '이미 걸어 두었습니다',
  used: '이번 생애에 이미 썼습니다', no_target: '지금은 쓸 곳이 없습니다',
}

export class DetailWindow {
  tab: Tab = '일지'
  private filter: Filter = '전체'
  private readonly open = new Set<string>() // 펼친 줄(장비 uid, 가방, 도감 칸, 교체 제안). 세부 글은 펼침 없이 늘 보인다(D77)
  private readonly folded = new Set<string>() // 접은 연대기 줄(연대기 주요 기록은 기본으로 펼쳐 둔다, D77)
  private lethalAsk = false
  private cursedAsk: string | null = null // 확인 칸을 펼친 저주 장비 uid
  private familySub: FamilySub = '연대기'
  private reader: BookViewer | null = null // 책 보기(03 §5.6)
  private destAsk: string | null = null // 확인 칸을 펼친 목적지
  onSuccession: (() => void) | null = null // 가문 탭 `계승 진행 ›`(03 §5.5)
  onSettings: (() => void) | null = null // 방침 탭 `창 설정 열기`(03 §1)
  private readonly body: HTMLElement
  private readonly tabBar: HTMLElement
  private readonly title: HTMLElement
  private readonly foot: HTMLElement

  // onNote: 기본 창 한 줄 기록 자리에 안내(ⓘ)를 띄운다(03 §11.2)
  constructor(private readonly root: HTMLElement, private readonly world: World, private readonly onNote: (text: string) => void, private readonly togglePause: () => void) {
    this.title = h('div', { class: 'd-title' })
    const close = button('×', () => this.hide(), { title: '닫기 (Esc)' })
    this.tabBar = h('div', { class: 'd-tabs', role: 'tablist' })
    this.body = h('div', { class: 'd-body' })
    this.foot = h('div', { class: 'd-foot' })
    root.replaceChildren(h('div', { class: 'd-head' }, this.title, close), this.tabBar, this.body, this.foot)
    root.hidden = true
    root.tabIndex = -1
    root.addEventListener('keydown', (e) => {
      // 책 보기 조작(03 §5.6): ←→·PageUp/Down·Home·End, Esc는 서가로
      if (this.reader && this.tab === '가문' && this.reader.key(e)) {
        e.preventDefault()
        return
      }
      if (e.key === 'Escape') this.hide()
      else if (e.ctrlKey && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        this.show(TABS[Number(e.key) - 1]!)
      }
    })
  }

  get visible(): boolean {
    return !this.root.hidden
  }

  show(tab: Tab = this.tab): void {
    const was = this.visible
    this.tab = tab
    this.root.hidden = false
    this.render()
    if (!was) this.root.focus() // 상세 창은 연 순간에만 포커스를 가져간다(03 §1)
  }

  hide(): void {
    this.root.hidden = true
  }

  // 열려 있을 때 주기적으로 부른다. 스크롤 위치·펼침 상태는 유지한다
  render(): void {
    if (!this.visible) return
    const ch = this.world.state.character
    this.title.textContent = ch ? `${ch.name} · ${ch.generation}대` : this.world.state.family.name
    this.tabBar.replaceChildren(...TABS.map((t, i) => {
      const b = button(t, () => this.show(t), { on: t === this.tab, title: `Ctrl+${i + 1}` })
      b.setAttribute('role', 'tab')
      b.setAttribute('aria-selected', String(t === this.tab))
      return b
    }))
    const scroll = this.body.scrollTop
    this.body.replaceChildren(...this.content())
    this.body.scrollTop = scroll
    this.foot.replaceChildren(h('span', {}, '시제품: 저장하지 않습니다'), button(this.world.state.current_activity.state === 'paused' ? '다시 진행' : '일시정지', () => {
      this.togglePause()
      this.render()
    }))
  }

  private content(): Node[] {
    switch (this.tab) {
      case '일지': return this.journal()
      case '인물': return this.character()
      case '방침': return this.policies()
      case '가문': return this.family()
    }
  }

  private toggle(key: string): void {
    if (this.open.has(key)) this.open.delete(key)
    else this.open.add(key)
    this.render()
  }

  // ── 일지 ──
  private journal(): Node[] {
    const chips = h('div', { class: 'd-chips' }, ...FILTERS.map((f) => button(f, () => {
      this.filter = f
      this.render()
    }, { on: f === this.filter })))
    // 최근 요약 3개(03 §5.2, 14 §1.1). 첫 출정 전에는 칸을 그리지 않는다
    const recent = recentModel(this.world)
    const summary = recent.length
      ? h('div', { class: 'd-sec d-summary' }, h('div', { class: 'd-strong' }, '최근 요약'),
        ...recent.map((r) => h('div', { class: 'd-sum' }, h('div', { class: 'd-group' }, r.head),
          ...r.lines.map((l, i) => h('div', { class: i === r.lines.length - 1 ? 'd-sub d-num' : 'd-sub' }, l)))))
      : null
    // 기록마다 한 줄 문장 아래에 세부 내역을 늘 보인다(D77)
    const list = h('div', { class: 'd-list' })
    for (const g of journalModel(this.world, this.filter)) {
      list.append(h('div', { class: 'd-group' }, g.head))
      for (const r of g.rows) {
        list.append(h('div', { class: 'd-row' },
          h('span', { class: 'd-tag' }, r.tag), ` ${r.line}`, r.bundle ? h('span', { class: 'd-dim' }, ` (묶음 ×${r.bundle})`) : null))
        for (const m of r.more) list.append(h('div', { class: 'd-sub' }, m))
      }
    }
    if (!list.childElementCount) list.append(h('div', { class: 'd-dim' }, '아직 기록이 없습니다.'))
    return [summary, chips, list].filter((n): n is HTMLElement => n !== null)
  }

  // ── 인물 ──
  private character(): Node[] {
    const m = characterModel(this.world)
    if (!m) return [h('div', { class: 'd-dim' }, '지금 인물이 없습니다.')]
    const lv = m.level
    const bar = h('progress', { max: String(lv.next ?? 1), value: String(lv.next ? lv.xp : 1) })
    const head = h('div', { class: 'd-sec' },
      h('div', { class: 'd-strong' }, m.title),
      h('div', {}, `Lv ${lv.lv} `, bar, lv.next ? ` ${lv.xp.toLocaleString('ko-KR')} / ${lv.next.toLocaleString('ko-KR')}` : ' 최고 레벨'),
      h('div', {}, m.line2), h('div', {}, m.line3))
    // 능력치·숙련 줄 아래에 쓰임과 더하는 판정을 늘 보인다(03 §5.3, D77)
    const stats = h('div', { class: 'd-sec d-cols' },
      h('div', { class: 'd-col' }, h('div', { class: 'd-strong' }, '능력치'), ...m.stats.map((s) => h('div', { class: 'd-item' },
        h('div', {}, `${s.label} ${s.value}${s.value !== s.base ? ` (기본 ${s.base})` : ''}`), s.use ? h('div', { class: 'd-note' }, s.use) : null))),
      h('div', { class: 'd-col' }, h('div', { class: 'd-strong' }, '숙련'), ...m.skills.map((s) => h('div', { class: 'd-item' },
        h('div', {}, `${s.label} ${'●'.repeat(s.rank)}${'○'.repeat(s.max - s.rank)} ${Math.floor(s.uses)}${s.next !== null ? `/${s.next}` : ''}`),
        s.effect ? h('div', { class: 'd-note' }, s.effect) : null))))
    // 직업·기술 칸(03 §5.3, D79): 직업 이름과 효과 글, 익힌 기술마다 이름·얻은 곳·효과
    const job = h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, `직업 · ${m.job.name}`),
      ...m.job.lines.map((l) => h('div', { class: 'd-note' }, l)),
      h('div', { class: 'd-strong' }, '기술'),
      ...(m.techniques.length
        ? m.techniques.map((t) => h('div', { class: 'd-item' }, h('div', {}, `${t.name} `, h('span', { class: 'd-dim' }, `(${t.source})`)), h('div', { class: 'd-note' }, t.effect)))
        : [h('div', { class: 'd-dim' }, '아직 익힌 기술이 없습니다.')]))
    // 특성은 한 줄에 하나, 얻은 나이와 효과 글을 늘 보인다(03 §5.3, D77)
    const traits = h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '특성'),
      ...m.traits.map((t) => h('div', { class: `d-item${t.inactive ? ' d-off' : ''}` },
        h('div', {}, h('span', { class: `d-badge${t.negative ? ' neg' : ''}` }, `${t.name} [${t.badge}]`),
          h('span', { class: 'd-dim' }, t.inactive ? ` (${t.inactive})` : ` ${t.since}세부터`)),
        t.inactive ? null : h('div', { class: 'd-note' }, t.effect))))
    const inj = m.injuries.length ? h('div', { class: 'd-sec' }, `부상: ${m.injuries.join(', ')}`) : null
    const gear = h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '장비'),
      ...m.equipment.map((e) => ('empty' in e ? h('div', { class: 'd-row' }, `${e.slot}  (비어 있음)`) : this.itemRow(e, m.inTown))))
    const sugs = suggestionsModel(this.world)
    if (sugs) {
      const sk = 'sugs'
      const sr = h('div', { class: 'd-row more' }, `교체 제안 ${sugs.length}건 ${this.open.has(sk) ? '▾' : '›'}`)
      sr.onclick = () => this.toggle(sk)
      gear.append(sr)
      if (this.open.has(sk)) {
        const seasonKey = seasonKeyOf(this.world)
        for (const s of sugs) {
          gear.append(h('div', { class: 'd-sub' }, s.line))
          gear.append(h('div', { class: 'd-acts' }, ...(s.pending
            ? [h('span', { class: 'd-dim' }, s.pending)]
            : [button('수락', () => { acceptEquipSuggestion(this.world, s.slotId as Slot); this.render() }),
              button('무시', () => { dismissSuggestion(this.world, s.slotId as Slot, seasonKey); this.render() })])))
        }
      }
    }
    const bagKey = 'bag'
    const bag = h('div', { class: 'd-sec' })
    const bagRow = h('div', { class: 'd-row more' }, `가방 ${m.bag.used}/${m.bag.max}${m.bag.consumables ? ` · ${m.bag.consumables}` : ''}`, h('span', { class: 'd-caret' }, this.open.has(bagKey) ? '▾' : '▸'))
    bagRow.onclick = () => this.toggle(bagKey)
    bag.append(bagRow)
    if (this.open.has(bagKey)) {
      // 가방 20칸 격자(찬 칸은 등급 색 테두리, 가리키면 이름) → 목록 → 수령 대기함(03 §5.3)
      bag.append(h('div', { class: 'd-bag-grid' }, ...Array.from({ length: m.bag.max }, (_, i) => {
        const it = m.bag.items[i]
        return it ? h('div', { class: 'd-bag-cell full', title: it.name, style: `border-color:${it.grade.color}` }, it.slot.slice(0, 1)) : h('div', { class: 'd-bag-cell' })
      })))
      for (const it of m.bag.items) bag.append(this.itemRow(it, m.inTown))
      if (m.bag.pending.length) {
        bag.append(h('div', { class: 'd-strong' }, `수령 대기함 ${m.bag.pending.length}`))
        for (const it of m.bag.pending) bag.append(this.itemRow(it, m.inTown))
      }
    }
    return [head, stats, job, traits, inj, gear, bag].filter((n): n is HTMLElement => n !== null)
  }

  // 장비 줄: 누르면 동작 단추를 줄 아래에 펼친다(팝업 아님, 03 §5.3.1)
  private itemRow(it: ItemRow, inTown: boolean): Node {
    const key = `i${it.uid}`
    const wrap = h('div', {})
    const row = h('div', { class: 'd-row more' },
      it.equipped ? `${it.slot}  ` : '',
      h('span', {}, it.name), it.cursed ? ' (저주)' : '', ' ',
      h('span', { class: 'd-grade', style: `color:${it.grade.color}` }, it.grade.label),
      it.locked ? ' 🔒' : '', it.relic ? ` ★${it.relic}` : ' ☆',
      it.order ? h('span', { class: 'd-dim' }, it.order === 'equip' ? ' · 다음 마을 도착 때 장착' : ' · 다음 마을 도착 때 해제') : null,
      h('span', { class: 'd-caret' }, this.open.has(key) ? '▾' : '▸'))
    row.onclick = () => this.toggle(key)
    wrap.append(row, h('div', { class: 'd-note d-indent' }, it.desc)) // 장비 설명은 늘 보인다(D77)
    if (this.open.has(key)) {
      // 장비 주석(16 §2.5 lore, D80): 사연·주인·얻는 곳, 공개된 비밀
      wrap.append(...it.lore.map((l) => h('div', { class: `d-note d-indent${l.startsWith('비밀 · ') ? ' d-strong' : ''}` }, l)))
      const w = this.world
      const town = inTown ? undefined : '마을에서만 할 수 있습니다'
      const bagFull = w.state.inventory.bag.length >= w.content.balance.stats.bag_slots
      // 장착·해제: 마을이면 즉시, 출정 중이면 다음 마을 도착 때로 예약(03 §5.3.1)
      const equip = (confirmed = false): void => {
        if (it.cursed && !confirmed) {
          this.cursedAsk = it.uid
          return this.render()
        }
        this.cursedAsk = null
        if (inTown) equipManual(w, it.uid, it.cursed)
        else orderEquip(w, it.uid, 'equip', it.cursed)
        this.render()
      }
      const off = (): void => {
        if (inTown) unequip(w, w.content.get('item', w.state.item_instances[it.uid]!.def_id).slot)
        else orderEquip(w, it.uid, 'unequip')
        this.render()
      }
      const acts = h('div', { class: 'd-acts' },
        it.order
          ? button('예약 취소', () => { cancelEquipOrder(w, it.uid); this.render() })
          : it.equipped
            ? button(inTown ? '해제' : '해제 예약', off, { disabled: bagFull, ...(bagFull ? { title: '가방이 가득합니다' } : {}) })
            : button(inTown ? '장착' : '장착 예약', () => equip()),
        button(it.locked ? '잠금 해제' : '잠금', () => { setLock(w, it.uid, !it.locked); this.render() }),
        it.relic
          ? button('유품 해제', () => { undesignateRelic(w, it.uid); this.render() }, { disabled: !inTown, ...(town ? { title: town } : {}) })
          : button('유품 지정', () => this.markRelic(it.uid), { disabled: !inTown || it.cursed, ...(town ? { title: town } : {}) }),
        it.equipped && bagFull && !it.order ? h('span', { class: 'd-dim' }, '가방이 가득합니다') : null)
      wrap.append(acts)
      // 저주 장비 장착 확인 칸(03 §5.3.1, 팝업 아님)
      if (this.cursedAsk === it.uid) {
        const def = w.content.get('item', w.state.item_instances[it.uid]!.def_id)
        wrap.append(h('div', { class: 'd-confirm' },
          h('div', { class: 'd-strong' }, '⚠ 저주가 걸린 장비입니다.'),
          h('div', {}, `${it.name}: ${def.description}`),
          h('div', {}, '벗을 수는 있지만 착용 중에는 저주가 따릅니다.'),
          h('div', { class: 'd-acts' }, button('취소', () => { this.cursedAsk = null; this.render() }), button(inTown ? '장착합니다' : '다음 마을에서 장착합니다', () => equip(true)))))
      }
    }
    return wrap
  }

  private markRelic(uid: string): void {
    const inv = this.world.state.inventory
    const used = new Set(inv.relic_designations.map((r) => r.priority))
    const free = ([1, 2] as const).find((p) => !used.has(p))
    if (!free) {
      this.onNote('ⓘ 유품은 두 개까지 남길 수 있습니다. 먼저 하나를 해제하세요.')
      return
    }
    designateRelic(this.world, uid, free)
    this.render()
  }

  // ── 방침 ──
  private policies(): Node[] {
    const w = this.world
    const p = w.state.policies
    const m = policyModel(w)
    const set = <K extends keyof Policies>(k: K, v: Policies[K]): void => {
      p[k] = v
      this.render()
    }
    const seg = <K extends keyof Policies>(label: string, key: K, opts: [Policies[K], string][], disabled = false): HTMLElement =>
      h('div', { class: 'd-line', title: HELP[key] ?? '' }, h('span', { class: 'd-label' }, label),
        h('span', { class: 'd-seg' }, ...opts.map(([v, t]) => button(t, () => set(key, v), { on: p[key] === v, disabled }))))
    const toggle = (label: string, key: 'auto_equip' | 'family_formation' | 'auto_succession' | 'offline_progress' | 'stage_boundary_stop', disabled = false): HTMLElement =>
      h('div', { class: 'd-line', title: HELP[key] ?? '' }, h('span', { class: 'd-label' }, label), button(p[key] ? '켬' : '끔', () => set(key, !p[key]), { on: p[key], disabled }))

    const attitude = h('div', { class: 'd-sec' },
      h('div', { class: 'd-line', title: HELP.attitude! }, h('span', { class: 'd-label' }, '태도'),
        h('span', { class: 'd-seg' }, ...m.attitudes.map((a) => button(a.name, () => {
          if (a.on) return
          setAttitude(w, a.id)
          this.onNote(attitudeNote(a.name))
          this.render()
        }, { on: a.on })))),
      h('div', { class: 'd-dim' }, m.attitudeLine))

    const reserve = h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, '구매 예약금'),
      h('span', { class: 'd-seg' },
        button('태도 기본', () => set('reserve_mode', 'attitude_default'), { on: p.reserve_mode === 'attitude_default' }),
        button('직접', () => set('reserve_mode', 'custom'), { on: p.reserve_mode === 'custom' })))
    if (p.reserve_mode === 'custom') {
      const r = h('input', { type: 'range', min: '10', max: '60', step: '5', value: String(Math.round(p.reserve_custom * 100)) }) as HTMLInputElement
      r.onchange = () => set('reserve_custom', Number(r.value) / 100)
      reserve.append(r, ` ${Math.round(p.reserve_custom * 100)}%`)
    }

    // 치명 위험: 켤 때는 줄 아래에 확인 칸을 펼친다(팝업 아님, 03 §5.4)
    const lethal = h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, '치명 위험'),
      button(p.lethal_allowed ? '켬' : '끔', () => {
        if (p.lethal_allowed) set('lethal_allowed', false)
        else {
          this.lethalAsk = true
          this.render()
        }
      }, { on: p.lethal_allowed }))
    const name = w.state.character?.name ?? '인물'
    const ask = this.lethalAsk && !p.lethal_allowed
      ? h('div', { class: 'd-confirm' },
        h('div', { class: 'd-strong' }, '⚠ 치명 위험을 허용할까요?'),
        h('div', {}, renderTemplate('{name:은/는} 체력이 다했을 때 최후 판정에 실패하면 목숨을 잃을 수 있습니다. 죽음은 되돌릴 수 없습니다. 가문은 다음 세대로 이어집니다. 이 방침은 프로그램을 닫아 둔 동안의 오프라인 진행에도 똑같이 적용됩니다.', { name })),
        h('div', { class: 'd-acts' }, button('취소', () => { this.lethalAsk = false; this.render() }), button('허용합니다', () => {
          this.lethalAsk = false
          p.lethal_allowed = true
          p.lethal_scope.gate_battles = true
          this.render()
        })))
      : null

    const spec = h('select', {}, ...([['none', '없음(보류)'], ['combat_first', '전투형 우선'], ['search_first', '탐색형 우선'], ['care_first', '돌봄형 우선'], ['trade_first', '거래형 우선'], ['higher_skill', '숙련 높은 쪽']] as const)
      .map(([v, t]) => { const o = h('option', { value: v }, t) as HTMLOptionElement; o.selected = p.auto_specialization === v; return o })) as HTMLSelectElement
    spec.onchange = () => set('auto_specialization', spec.value as Policies['auto_specialization'])

    return [
      attitude,
      h('div', { class: 'd-sec' },
        reserve,
        seg('위험 허용', 'risk_cap', [['attitude_default', '태도 기본'], ['low', '낮음'], ['normal', '보통'], ['high', '높음']]),
        lethal, ask),
      h('div', { class: 'd-sec' },
        seg('운명 사건', 'fate_handling', [['hold', '보류하고 기다림'], ['decline_and_continue', '거절하고 계속']]),
        h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, '자동 전문화'), spec),
        toggle('장비 자동 교체', 'auto_equip'),
        this.destination()),
      h('div', { class: 'd-sec' },
        toggle('가정 형성', 'family_formation'),
        toggle('자동 계승', 'auto_succession'),
        toggle('오프라인 진행', 'offline_progress'),
        toggle('  생애 단계 경계 정지', 'stage_boundary_stop', !p.offline_progress)),
      this.blessing(),
      this.onSettings ? h('div', { class: 'd-acts' }, button('창 설정 열기', () => this.onSettings?.())) : null, // 03 §1
      h('div', { class: 'd-dim' }, '모든 변경은 다음 행동부터 적용됩니다.'),
    ].filter((n): n is HTMLElement => n !== null)
  }

  // 가호 칸(03 §5.4, 04 §10.3, D78): 별빛, 이번 생애 사용, 걸어 둔 가호(걸기 ↔ 풀기), 상처 치유, 자동 사용 방침
  private blessing(): HTMLElement {
    const w = this.world
    const b = w.content.balance.blessing
    const ch = w.state.character
    const sec = h('div', { class: 'd-sec', title: BLESSING_HELP }, h('div', { class: 'd-strong' }, '가호'))
    if (!ch) return sec
    const n = charges(w)
    sec.append(h('div', {}, `별빛 ${'✦'.repeat(n)}${'✧'.repeat(Math.max(0, b.cap - n))} (${n}/${b.cap}) · 이번 생애 ${ch.blessing.uses + ch.blessing.armed.length}/${b.life_uses}`))
    const why = (r: string | null): string | undefined => (r ? BLOCK_TEXT[r] : undefined)
    const armedRow = (kind: 'final_save' | 'miracle' | 'mitigate'): HTMLElement => {
      const on = isArmed(w, kind)
      const block = on ? null : armBlock(w, kind)
      return h('div', { class: 'd-item' },
        h('div', { class: 'd-line' }, h('span', { class: 'd-grow' }, `${ARMED_NAME[kind]} · 별빛 ${b.costs[kind]}`),
          button(on ? '걸어 둠 · 풀기' : '걸기', () => {
            if (on) unarm(w, kind)
            else arm(w, kind)
            this.render()
          }, { on, disabled: block !== null, ...(why(block) ? { title: why(block)! } : {}) })),
        h('div', { class: 'd-note' }, ARMED_NOTE[kind]))
    }
    const hb = healBlock(w)
    sec.append(
      armedRow('final_save'), armedRow('miracle'), armedRow('mitigate'),
      h('div', { class: 'd-item' },
        h('div', { class: 'd-line' }, h('span', { class: 'd-grow' }, `상처를 낫게 한다 · 별빛 ${b.costs.heal}`),
          button('지금 쓰기', () => { healNow(w); this.render() }, { disabled: hb !== null, ...(why(hb) ? { title: why(hb)! } : {}) })),
        h('div', { class: 'd-note' }, '중상 하나를 바로 낫게 합니다')),
      h('div', { class: 'd-line', title: '치명 관문에 들어갈 때 별빛이 2개 이상이면 최후의 순간을 스스로 걸어 둡니다.' }, h('span', { class: 'd-label' }, '가호 자동 사용'),
        h('span', { class: 'd-seg' }, ...([['off', '끔'], ['final_only', '최후의 순간만']] as const).map(([v, t]) =>
          button(t, () => { w.state.policies.blessing_auto = v; this.render() }, { on: w.state.policies.blessing_auto === v })))),
      // 시작 축복 자동(01 §18.2): 자동 계승일 때 앞 세대가 받은 축복 종류를 다시 내린다(독립 검증 D78-10)
      h('div', { class: 'd-line', title: '자동 계승일 때 앞 세대가 받은 시작 축복을 같은 종류로 내립니다. 기울어진 재능은 사람이 고릅니다.' }, h('span', { class: 'd-label' }, '시작 축복 자동'),
        h('span', { class: 'd-seg' }, ...([['none', '없음'], ['repeat', '지난번과 같게']] as const).map(([v, t]) =>
          button(t, () => { w.state.policies.start_blessing_auto = v; this.render() }, { on: w.state.policies.start_blessing_auto === v })))),
      h('div', { class: 'd-note' }, BLESSING_HELP),
    )
    return sec
  }

  // 목적지: 상한을 넘거나 무모한 곳은 줄 아래 확인 칸을 펼친 뒤 정한다(03 §5.4, 01 §7.1). 확인은 고를 때 한 번만
  private destination(): HTMLElement {
    const w = this.world
    const p = w.state.policies
    const m = destinationModel(w)
    const fix = (id: string, ack: boolean): void => {
      this.destAsk = null
      p.destination = id
      p.destination_warning_ack = ack
      this.onNote(`ⓘ 다음 행동부터 ${id === 'auto' ? '태도대로 장소를 고릅니다' : renderTemplate('{place:으로/로} 향합니다', { place: w.content.get('region', id).name })}`)
      this.render()
    }
    const sel = h('select', {},
      ...[{ id: 'auto', text: '자동' }, ...m.places.map((o) => ({ id: o.id, text: o.grade ? `${o.name} · ${o.grade}` : o.name }))].map((o) => {
        const opt = h('option', { value: o.id }, o.text) as HTMLOptionElement
        opt.selected = (this.destAsk ?? m.current) === o.id
        return opt
      })) as HTMLSelectElement
    sel.onchange = () => {
      const o = m.places.find((x) => x.id === sel.value)
      if (o?.ask) {
        this.destAsk = o.id
        this.render()
      } else fix(sel.value, false)
    }
    const locked = lockedPlaces(w)
    const wrap = h('div', {}, h('div', { class: 'd-line', title: HELP.destination! }, h('span', { class: 'd-label' }, '목적지'), sel),
      ...(locked.length ? [h('div', { class: 'd-note' }, `아직 갈 수 없는 곳: ${locked.map((l) => `${l.name}(${l.why})`).join(', ')}`)] : []))
    const o = m.places.find((x) => x.id === this.destAsk)
    if (o) {
      const name = w.state.character?.name ?? '인물'
      wrap.append(h('div', { class: 'd-confirm' },
        h('div', { class: 'd-strong' }, renderTemplate('⚠ {place:은/는} 지금 {name}에게 {grade} 위험입니다.', { place: o.name, name, grade: o.grade })),
        h('div', {}, o.reckless ? '태도와 상관없이 스스로는 가지 않을 만큼 위험합니다.' : `방침의 위험 허용 상한(${o.cap})을 넘습니다.`),
        h('div', {}, '자주 다치고 쓰러질 수 있습니다. 쓰러져도 목숨을 잃지는 않습니다.'),
        h('div', { class: 'd-acts' }, button('취소', () => { this.destAsk = null; this.render() }), button('이곳으로 정합니다', () => fix(o.id, true)))))
    }
    return wrap
  }

  // ── 가문: 하위 탭 5칸(03 §5.5). 서가는 M3(생애의 책) ──
  private family(): Node[] {
    const f = familyModel(this.world)
    const ready: Record<FamilySub, boolean> = { 연대기: true, 서가: true, 가계도: true, 도감: true, 유품: true }
    // 책 보기(03 §5.6)가 열려 있으면 가문 머리·하위 탭 대신 책 면
    if (this.reader) return this.reader.view()
    const subs = h('div', { class: 'd-chips' }, ...FAMILY_SUBS.map((t) => button(t, () => { this.familySub = t; this.render() },
      { on: t === this.familySub, disabled: !ready[t], ...(ready[t] ? {} : { title: '아직 만들지 않았습니다' }) })))
    const body = this.familySub === '가계도' ? this.tree() : this.familySub === '유품' ? this.relics() : this.familySub === '도감' ? this.codex() : this.familySub === '서가' ? this.shelf() : this.chronicle(f.rows)
    // 계승 대기 중이면 탭 위에 `계승 진행 ›`(03 §5.5)
    const go = this.world.state.current_activity.state === 'awaiting_succession' && this.onSuccession
      ? h('div', { class: 'd-acts' }, button('계승 진행 ›', () => this.onSuccession?.()))
      : null
    return [h('div', { class: 'd-strong' }, f.title), go, subs, ...body].filter((n): n is HTMLElement => n !== null)
  }

  // 서가(03 §5.5): 끝난 생애의 책. 책등을 누르면 책 보기
  private shelf(): Node[] {
    const s = this.world.state
    const living = s.character && !s.family.chronicle.some((r) => r.char_uid === s.character!.uid) ? s.character.name : null
    return [shelfView([...s.family.chronicle].sort((a, b) => a.gen - b.gen), living, (gen) => this.openBook(gen), () => this.show('일지'))]
  }

  // 책 보기를 연다(서가·연대기 `책 ›`·복귀 요약 `생애의 책`)
  openBook(gen?: number): void {
    const recs = [...this.world.state.family.chronicle].sort((a, b) => a.gen - b.gen)
    const r = gen === undefined ? recs.at(-1) : recs.find((x) => x.gen === gen)
    const b = r ? asBook(r) : null
    this.familySub = '서가'
    if (r && b) {
      this.reader = new BookViewer(r.gen, b, () => { this.reader = null; this.render() }, () => markOpened(this.world, r.gen), () => this.render())
    }
    this.show('가문')
  }

  // 세로 가계도: 플레이 인물은 굵은 테두리, 방계·입양은 점선. 누르면 연대기의 그 줄을 펼친다
  private tree(): Node[] {
    const list = h('div', { class: 'd-tree' })
    for (const n of treeModel(this.world)) {
      if (list.childElementCount) list.append(h('div', { class: 'd-tree-link', 'aria-hidden': 'true' }, '│'))
      const box = h('div', { class: `d-tree-node${n.dashed ? ' dashed' : ''}`, role: 'button', tabindex: '0' },
        `${n.gen}대 ${n.name}`, h('span', { class: 'd-dim' }, ` · ${n.role}${n.current ? ' · 현재' : ''}`),
        n.partner ? h('span', { class: 'd-dim' }, `  ♡ ${n.partner}`) : null)
      const go = (): void => {
        this.familySub = '연대기'
        this.folded.delete(`c${n.gen}`)
        this.render()
      }
      box.onclick = go
      box.onkeydown = (e) => { if (e.key === 'Enter') go() }
      // 뽑히지 않은 후계 후보는 그 대 곁에 가는 테두리로(03 §5.5, D87)
      const row = h('div', { class: 'd-tree-row' }, box, ...n.passed.map((c) => h('div', { class: 'd-tree-node thin', title: '후계 후보였던 인물' }, c.name, h('span', { class: 'd-dim' }, ` · ${c.role}`))))
      list.append(row)
    }
    return [list, h('div', { class: 'd-dim' }, '굵은 테두리는 가문을 이은 인물, 가는 테두리는 후계 후보였던 인물, 점선은 방계·입양입니다.')]
  }

  private codex(): Node[] {
    const m = codexModel(this.world)
    const out: Node[] = m.sections.map((s) => {
      const key = `x${s.title}`
      const head = h('div', { class: `d-row${s.rows.length ? ' more' : ''}` }, h('span', { class: 'd-strong' }, s.title), ` ${s.found} / ${s.total}`,
        s.rows.length ? h('span', { class: 'd-caret' }, this.open.has(key) ? '▾' : '▸') : null)
      if (s.rows.length) head.onclick = () => this.toggle(key)
      const sec = h('div', { class: 'd-sec' }, head)
      if (this.open.has(key)) {
        s.rows.forEach((r, i) => {
          sec.append(h('div', { class: `d-sub${r === '???' || s.states?.[i] === 'seen' ? ' d-dim' : ''}` }, r))
          for (const l of s.notes?.[i] ?? []) sec.append(h('div', { class: 'd-note d-indent2' }, l))
        })
      }
      return sec
    })
    out.push(h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '가문 해금'),
      m.unlocks.length ? h('div', {}, m.unlocks.join(' · ')) : h('div', { class: 'd-dim' }, '아직 없습니다.')))
    return out
  }

  private relics(): Node[] {
    const m = relicsModel(this.world)
    const slots = h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '지금 남길 유품'),
      ...m.slots.map((s, i) => h('div', { class: 'd-row' }, `★${i + 1}  ${s ?? '(비어 있음)'}`)))
    const past = h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '대를 건너온 유품'))
    if (!m.past.length) past.append(h('div', { class: 'd-dim' }, '아직 물려준 유품이 없습니다.'))
    for (const r of m.past) {
      past.append(h('div', { class: 'd-row' }, r.name, ' ', h('span', { class: 'd-grade', style: `color:${r.grade.color}` }, r.grade.label)))
      for (const l of r.lines) past.append(h('div', { class: 'd-sub' }, `· ${l}`))
      for (const l of r.lore) past.append(h('div', { class: 'd-note d-indent' }, l))
    }
    return [slots, past]
  }

  private chronicle(rows: ReturnType<typeof familyModel>['rows']): Node[] {
    const list = h('div', { class: 'd-list' })
    // 주요 기록은 기본으로 펼쳐 두고, 머리줄을 누르면 접는다(03 §5.5, D77)
    rows.forEach((r) => {
      const key = `c${r.gen}`
      const shown = !this.folded.has(key)
      const row = h('div', { class: `d-row${r.lines.length ? ' more' : ''}` }, h('span', { class: 'd-tag' }, r.head), r.lines.length ? h('span', { class: 'd-caret' }, shown ? '▾' : '▸') : null)
      if (r.lines.length) {
        row.onclick = () => {
          if (shown) this.folded.add(key)
          else this.folded.delete(key)
          this.render()
        }
      }
      list.append(row)
      if (shown) for (const l of r.lines) list.append(h('div', { class: 'd-sub' }, `· ${l}`))
      // 끝난 생애는 그 책으로(03 §5.5 연대기 `책 ›`)
      const rec = this.world.state.family.chronicle.find((x) => x.gen === r.gen)
      if (shown && rec && asBook(rec)) list.append(h('div', { class: 'd-acts' }, button('책 ›', () => this.openBook(r.gen))))
    })
    return [list]
  }
}
