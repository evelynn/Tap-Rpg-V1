// 상세 창(03 §5, 480 × 560) DOM. 탭 4개(일지·인물·방침·가문), Esc 닫기, Ctrl+1~4 탭 전환.
// 세계를 바꾸는 조작은 코어 함수만 부른다(잠금·유품·장착·태도·방침 값). 글자는 모두 textContent로 넣는다.
import {
  designateRelic, equipManual, renderTemplate, setAttitude, setLock, undesignateRelic, unequip, type Policies, type World,
} from '@tap/core'
import {
  FILTERS, attitudeNote, characterModel, destinationModel, familyModel, journalModel, policyModel, type Filter, type ItemRow,
} from './model'

export const TABS = ['일지', '인물', '방침', '가문'] as const
export type Tab = (typeof TABS)[number]

type Kids = (Node | string | null | false | undefined)[]

function h(tag: string, attrs: Record<string, string> = {}, ...kids: Kids): HTMLElement {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const k of kids) if (k !== null && k !== false && k !== undefined) el.append(k)
  return el
}

function button(label: string, onClick: () => void, opts: { on?: boolean; disabled?: boolean; title?: string } = {}): HTMLElement {
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

export class DetailWindow {
  tab: Tab = '일지'
  private filter: Filter = '전체'
  private readonly open = new Set<string>() // 펼친 줄(일지 id, 연대기 줄, 장비 uid, 가방)
  private lethalAsk = false
  private destAsk: string | null = null // 확인 칸을 펼친 목적지
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
    const list = h('div', { class: 'd-list' })
    for (const g of journalModel(this.world, this.filter)) {
      list.append(h('div', { class: 'd-group' }, g.head))
      for (const r of g.rows) {
        const key = `j${r.id}`
        const row = h('div', { class: `d-row${r.more.length ? ' more' : ''}` },
          h('span', { class: 'd-tag' }, r.tag), ` ${r.line}`, r.bundle ? h('span', { class: 'd-dim' }, ` (묶음 ×${r.bundle})`) : null,
          r.more.length ? h('span', { class: 'd-caret' }, this.open.has(key) ? '▾' : '▸') : null)
        if (r.more.length) row.onclick = () => this.toggle(key)
        list.append(row)
        if (this.open.has(key)) for (const m of r.more) list.append(h('div', { class: 'd-sub' }, m))
      }
    }
    if (!list.childElementCount) list.append(h('div', { class: 'd-dim' }, '아직 기록이 없습니다.'))
    return [chips, list]
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
    const stats = h('div', { class: 'd-sec d-cols' },
      h('div', {}, h('div', { class: 'd-strong' }, '능력치'), ...m.stats.map((s) => h('div', {}, `${s.label} ${s.value}${s.value !== s.base ? ` (기본 ${s.base})` : ''}`))),
      h('div', {}, h('div', { class: 'd-strong' }, '숙련'), ...m.skills.map((s) => h('div', {}, `${s.label} ${'●'.repeat(s.rank)}${'○'.repeat(s.max - s.rank)} ${s.uses}${s.next !== null ? `/${s.next}` : ''}`))))
    const traits = h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '특성'),
      h('div', { class: 'd-chips' }, ...m.traits.map((t) => h('span', { class: `d-badge${t.negative ? ' neg' : ''}` }, `${t.name} [${t.badge}]`))))
    const inj = m.injuries.length ? h('div', { class: 'd-sec' }, `부상: ${m.injuries.join(', ')}`) : null
    const gear = h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '장비'),
      ...m.equipment.map((e) => ('empty' in e ? h('div', { class: 'd-row' }, `${e.slot}  (비어 있음)`) : this.itemRow(e, m.inTown))))
    const bagKey = 'bag'
    const bag = h('div', { class: 'd-sec' })
    const bagRow = h('div', { class: 'd-row more' }, `가방 ${m.bag.used}/${m.bag.max}${m.bag.consumables ? ` · ${m.bag.consumables}` : ''}`, h('span', { class: 'd-caret' }, this.open.has(bagKey) ? '▾' : '▸'))
    bagRow.onclick = () => this.toggle(bagKey)
    bag.append(bagRow)
    if (this.open.has(bagKey)) for (const it of m.bag.items) bag.append(this.itemRow(it, m.inTown))
    return [head, stats, traits, inj, gear, bag].filter((n): n is HTMLElement => n !== null)
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
      h('span', { class: 'd-caret' }, this.open.has(key) ? '▾' : '▸'))
    row.onclick = () => this.toggle(key)
    wrap.append(row)
    if (this.open.has(key)) {
      const w = this.world
      const town = inTown ? undefined : '마을에서만 할 수 있습니다(출정 중 예약은 다음 조각)'
      const acts = h('div', { class: 'd-acts' },
        it.equipped
          ? button('해제', () => { unequip(w, w.content.get('item', w.state.item_instances[it.uid]!.def_id).slot); this.render() }, { disabled: !inTown || w.state.inventory.bag.length >= w.content.balance.stats.bag_slots, ...(town ? { title: town } : {}) })
          : button('장착', () => { equipManual(w, it.uid); this.render() }, { disabled: !inTown || it.cursed, title: it.cursed ? '저주 장비 확인 칸은 다음 조각입니다' : town ?? '' }),
        button(it.locked ? '잠금 해제' : '잠금', () => { setLock(w, it.uid, !it.locked); this.render() }),
        it.relic
          ? button('유품 해제', () => { undesignateRelic(w, it.uid); this.render() }, { disabled: !inTown, ...(town ? { title: town } : {}) })
          : button('유품 지정', () => this.markRelic(it.uid), { disabled: !inTown || it.cursed, ...(town ? { title: town } : {}) }))
      wrap.append(acts)
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

    const spec = h('select', {}, ...([['none', '없음(보류)'], ['combat_first', '전투형 우선'], ['search_first', '탐색형 우선'], ['higher_skill', '숙련 높은 쪽']] as const)
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
      h('div', { class: 'd-dim' }, '모든 변경은 다음 행동부터 적용됩니다.'),
    ].filter((n): n is HTMLElement => n !== null)
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
      ...[{ id: 'auto', text: '자동' }, ...m.places.map((o) => ({ id: o.id, text: `${o.name} · ${o.grade}` }))].map((o) => {
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
    const wrap = h('div', {}, h('div', { class: 'd-line', title: HELP.destination! }, h('span', { class: 'd-label' }, '목적지'), sel))
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

  // ── 가문(연대기) ──
  private family(): Node[] {
    const f = familyModel(this.world)
    const subs = h('div', { class: 'd-chips' }, button('연대기', () => {}, { on: true }),
      ...['서가', '가계도', '도감', '유품'].map((t) => button(t, () => {}, { disabled: true, title: '다음 조각에서 만듭니다' })))
    const list = h('div', { class: 'd-list' })
    f.rows.forEach((r, i) => {
      const key = `c${i}`
      const row = h('div', { class: `d-row${r.lines.length ? ' more' : ''}` }, r.head, r.lines.length ? h('span', { class: 'd-caret' }, this.open.has(key) ? '▾' : '▸') : null)
      if (r.lines.length) row.onclick = () => this.toggle(key)
      list.append(row)
      if (this.open.has(key)) for (const l of r.lines) list.append(h('div', { class: 'd-sub' }, `· ${l}`))
    })
    return [h('div', { class: 'd-strong' }, f.title), subs, list]
  }
}
