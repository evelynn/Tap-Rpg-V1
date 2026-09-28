// 계승 화면(03 §8, 480 × 560, 5단계): 계승 대기 표식이나 상세 창 가문 탭 `계승 진행 ›`으로 연다.
// 1 생애 정리 · 2 생애의 책(책 본문은 M3) · 3 후계자 · 4 물려줄 것 · 5 출발(이름·태도·시작 축복, D78).
// 중간에 닫으면 계승 대기가 그대로 남는다. `출발`만 세계를 바꾼다(succeed).
import {
  SKILL_LABELS, SPEC_LABELS, STAT_LABELS, canTilt, defaultBackground, itemName, pendingSuccession, seedSkills, succeed, talentOffers,
  type BlessingSubject, type Candidate, type StartChoice, type StartKind, type World,
} from '@tap/core'
import { button, h } from './detail/view'

const END_LABEL: Record<string, string> = { died: '사망', retired: '은퇴', long_sleep: '긴 잠' }
const REL_LABEL: Record<string, string> = { direct: '자녀', collateral: '친척', adopted: '가문의 아이' }
const FROM_LABEL: Record<string, string> = { other_parent: '동반자에게', new: '새로' }
const STEPS = ['생애 정리', '생애의 책', '누가 길을 이을까요', '물려줄 것', '출발'] as const
// 01 §19 시작 축복 한 줄 효과
const START_CARDS: { kind: StartKind | null; name: string; note: string }[] = [
  { kind: 'talent', name: '타고난 재능', note: '선천 특성 하나를 더 받는다(유전하지 않음)' },
  { kind: 'tilt', name: '기울어진 재능', note: '출생 능력치 1점을 원하는 곳으로 옮긴다' },
  { kind: 'first_step', name: '첫걸음의 보호', note: '새내기 동안 한 번, 큰 부상과 패배 손실을 막는다' },
  { kind: 'seed', name: '길의 씨앗', note: '숙련 하나를 1단계로 시작한다' },
  { kind: 'handful', name: '별빛 한 줌', note: '별빛을 하나 더 모은다' },
  { kind: null, name: '내리지 않는다', note: '이번에는 지켜보기만 한다' },
]
type Stat = keyof typeof STAT_LABELS
type Skill = keyof typeof SKILL_LABELS

export class SuccessionWindow {
  private step = 0
  private heir: string | null = null
  private name = ''
  private attitude = ''
  private start: StartChoice | null = null
  private readonly body: HTMLElement
  private readonly title: HTMLElement
  private readonly foot: HTMLElement

  constructor(private readonly root: HTMLElement, private readonly world: World, private readonly onDone: () => void) {
    this.title = h('div', { class: 'd-title' })
    this.body = h('div', { class: 'd-body' })
    this.foot = h('div', { class: 'd-foot' })
    root.replaceChildren(h('div', { class: 'd-head' }, this.title, button('×', () => this.hide(), { title: '닫기 (계승 대기는 남습니다)' })), this.body, this.foot)
    root.hidden = true
    root.tabIndex = -1
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide() })
  }

  get visible(): boolean {
    return !this.root.hidden
  }

  show(): void {
    const plan = pendingSuccession(this.world)
    if (!plan) return
    const was = this.visible
    if (!was) {
      this.step = 0
      const def = plan.candidates.find((c) => c.uid === plan.defaultHeirUid) ?? plan.candidates[0] ?? null
      this.heir = def?.uid ?? null
      this.name = def?.name ?? ''
      this.attitude = this.world.state.policies.attitude
      this.start = null
    }
    this.root.hidden = false
    this.render()
    if (!was) this.root.focus()
  }

  hide(): void {
    this.root.hidden = true
  }

  render(): void {
    if (!this.visible) return
    const plan = pendingSuccession(this.world)
    if (!plan) return this.hide()
    this.title.textContent = `계승 ${this.step + 1}/5 · ${STEPS[this.step]}`
    const content = [this.lifeStep, this.bookStep, this.heirStep, this.relicStep, this.departStep][this.step]!.call(this)
    this.body.replaceChildren(...content)
    const last = this.step === 4
    const ready = this.startReady()
    this.foot.replaceChildren(
      last ? h('span', { class: 'd-dim' }, ready ? '출발하면 되돌릴 수 없습니다' : '고른 축복의 세부를 마저 고르세요') : h('span', {}),
      h('span', { class: 'd-acts' },
        this.step > 0 ? button('이전', () => { this.step -= 1; this.render() }) : null,
        last ? button('출발', () => this.depart(), { disabled: !this.heir || !this.name.trim() || !ready }) : button('다음', () => { this.step += 1; this.render() })),
    )
  }

  private get plan() {
    return pendingSuccession(this.world)!
  }

  // 1단계: 생애 정리 — 걸어온 길 요약, 사망이면 끝에 이른 까닭
  private lifeStep(): Node[] {
    const { content, state } = this.world
    const r = this.plan.record
    const spec = r.specialization === 'none' ? '초보' : `${SPEC_LABELS[r.specialization]}${r.job2 && content.balance.second_jobs[r.job2] ? ` · ${content.balance.second_jobs[r.job2]!.name}` : ''}`
    const s = r.summary
    const luck = state.journal.filter((e) => e.char_uid === r.char_uid && e.sub === 'blessing').length
    const out: Node[] = [
      h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, `${r.gen}대 ${r.name}`),
        h('div', {}, `${content.balance.time.start_age}~${r.end_age}세 · ${END_LABEL[r.end_kind] ?? r.end_kind} · ${spec} · Lv ${r.peak_level}`)),
      h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '걸어온 길'),
        h('div', { class: 'd-sub' }, `· 출정 ${s.sorties}번 · 발견 ${s.discoveries}곳 · 쓰러진 적 ${s.defeats}번 · 중상 ${s.serious_injuries}번`),
        h('div', { class: 'd-sub' }, `· 번 동전 ${s.coins_earned.toLocaleString('ko-KR')}`),
        r.techniques.length ? h('div', { class: 'd-sub' }, `· 익힌 기술: ${r.techniques.map((t) => content.balance.techniques[t]?.name ?? t).join(', ')}`) : null,
        luck ? h('div', { class: 'd-sub' }, `· 이상한 행운 ${luck}번`) : null), // 사용자는 알고 인물은 모르는 표현(D78)
    ]
    if (r.cause) {
      const c = r.cause
      const place = content.has('region', c.location) ? content.get('region', c.location).name : c.location
      out.push(h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '끝에 이른 까닭'),
        h('div', { class: 'd-sub' }, `· 진입: ${place}${c.lethal_source ? ' (치명)' : ''}`),
        c.decisive_check ? h('div', { class: 'd-sub' }, `· 결정: 최후 판정 ${c.decisive_check.total}/${c.decisive_check.dc}`) : null))
    }
    return out
  }

  // 2단계: 생애의 책(18). 책 본문·서가는 M3에서 만든다. 지금은 별칭과 주요 기록을 보인다
  private bookStep(): Node[] {
    const { state } = this.world
    const r = this.plan.record
    const byId = new Map(state.journal.map((e) => [e.id, e]))
    const majors = r.major_entry_ids.map((id) => byId.get(id)).filter((e) => e !== undefined).sort((a, b) => a.id - b.id)
    return [
      h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, `${state.family.name} 가문 · 제${r.gen}권`), h('div', {}, `「${r.epithet}」`)),
      h('div', { class: 'd-sec' }, ...majors.map((e) => h('div', { class: 'd-sub' }, `· ${e.age}세 ${e.line}`))),
      h('div', { class: 'd-note' }, '생애의 책 본문과 서가는 다음 단계(M3)에서 열립니다.'),
    ]
  }

  // 3단계: 후계자 카드(최대 3장이 한 줄, 넘치면 줄을 바꾼다)
  private heirStep(): Node[] {
    const cards = h('div', { class: 'd-cards' })
    for (const c of this.plan.candidates) {
      const card = h('div', { class: `d-card${this.heir === c.uid ? ' on' : ''}`, role: 'radio', tabindex: '0', 'aria-checked': String(this.heir === c.uid) },
        h('div', { class: 'd-strong' }, `${c.uid === this.plan.defaultHeirUid ? '★ ' : ''}${c.name} · ${REL_LABEL[c.relation] ?? c.relation}`),
        ...c.traits.map((t) => h('div', {}, `${this.world.content.get('trait', t.id).name} (${FROM_LABEL[t.from] ?? `${this.plan.record.name}에게`})`)),
        c.relation === 'adopted' && !c.traits.length ? h('div', { class: 'd-dim' }, '가문의 가르침을 받았다') : null,
        h('div', { class: 'd-dim' }, topStats(c)),
        ...c.episodes.slice(0, 2).map((e) => h('div', { class: 'd-note' }, e)))
      const pick = (): void => {
        this.heir = c.uid
        this.name = c.name
        this.start = null // 축복 후보는 후계자마다 다르다
        this.render()
      }
      card.onclick = pick
      card.onkeydown = (e) => { if (e.key === 'Enter') pick() }
      cards.append(card)
    }
    return [cards]
  }

  // 4단계: 유품·동전·기념품
  private relicStep(): Node[] {
    const { state } = this.world
    const p = this.plan
    const st = p.settlement
    const relics = p.relicUids.map((u) => state.item_instances[u]).filter((i) => i !== undefined)
    return [
      h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, `유품 (${END_LABEL[p.record.end_kind] ?? ''}: ${relics.length}개)`),
        ...(relics.length ? relics.map((i, n) => h('div', { class: 'd-sub' }, `★${n + 1} ${itemName(this.world, i)}`)) : [h('div', { class: 'd-dim' }, '남긴 유품이 없습니다')])),
      h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '동전'),
        h('div', { class: 'd-sub' }, `(소지금 ${st.coins.toLocaleString('ko-KR')} + 처분한 장비 ${st.soldValue.toLocaleString('ko-KR')}) × ${Math.round(st.ratio * 100)}%`),
        h('div', { class: 'd-sub' }, `= ${Math.floor(st.total * st.ratio).toLocaleString('ko-KR')} → ${st.transferred.toLocaleString('ko-KR')}${st.capped ? ' (상한)' : ''}`)),
      st.keepsakes.length ? h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '기념품'),
        ...st.keepsakes.map((i) => h('div', { class: 'd-sub' }, `· ${itemName(this.world, i)}`))) : h('div', {}),
    ]
  }

  // 5단계: 이름·태도·시작 축복(D78)
  private departStep(): Node[] {
    const w = this.world
    const cand = this.plan.candidates.find((c) => c.uid === this.heir)
    if (!cand) return [h('div', { class: 'd-dim' }, '후계자를 먼저 고르세요.')]
    const name = h('input', { type: 'text', value: this.name, maxlength: '6' }) as HTMLInputElement
    name.oninput = () => { this.name = name.value; this.foot.querySelector<HTMLButtonElement>('button:last-child')!.disabled = !this.name.trim() }
    const att = h('select', {}, ...[...w.content.list('attitude')].sort((a, b) => a.order - b.order).map((a) => {
      const o = h('option', { value: a.id }, a.name) as HTMLOptionElement
      o.selected = a.id === this.attitude
      return o
    })) as HTMLSelectElement
    att.onchange = () => { this.attitude = att.value }
    const subj = subjectFor(w, cand)
    const cards = h('div', { class: 'd-cards' })
    for (const c of START_CARDS) {
      const on = (this.start?.kind ?? null) === c.kind
      const off = c.kind === 'talent' && !talentOffers(w, subj).length
      const card = h('div', { class: `d-card${on ? ' on' : ''}`, role: 'radio', tabindex: '0', 'aria-checked': String(on), ...(off ? { title: '선천 특성이 이미 셋입니다' } : {}) },
        h('div', { class: 'd-strong' }, `${c.kind ? '✦ ' : ''}${c.name}`), h('div', { class: 'd-note' }, c.note))
      if (!off) {
        const pick = (): void => {
          this.start = c.kind ? defaultStart(w, c.kind, subj) : null
          this.render()
        }
        card.onclick = pick
        card.onkeydown = (e) => { if (e.key === 'Enter') pick() }
      } else card.classList.add('d-off')
      cards.append(card)
    }
    return [
      h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, '이름'), name),
      h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, '태도'), att),
      h('div', { class: 'd-sec' }, h('div', { class: 'd-strong' }, '시작 축복'), h('div', { class: 'd-note' }, '인물은 모르는 축복을 하나 내릴 수 있습니다.'), cards, ...this.startDetail(subj)),
    ]
  }

  // 고른 축복의 세부 후보(03 §8: 타고난 재능·기울어진 재능·길의 씨앗은 줄 아래에 펼친다)
  private startDetail(subj: BlessingSubject): Node[] {
    const w = this.world
    const s = this.start
    if (!s) return []
    const seg = <T extends string>(label: string, opts: [T, string][], cur: T | undefined, set: (v: T) => void, ok: (v: T) => boolean = () => true): HTMLElement =>
      h('div', { class: 'd-line' }, h('span', { class: 'd-label' }, label), h('span', { class: 'd-seg' },
        ...opts.map(([v, t]) => button(t, () => { set(v); this.render() }, { on: cur === v, disabled: !ok(v) }))))
    if (s.kind === 'talent') {
      return [seg('특성', talentOffers(w, subj).map((id) => [id, w.content.get('trait', id).name] as [string, string]), s.trait, (v) => { s.trait = v }),
        ...(s.trait ? [h('div', { class: 'd-note' }, w.content.get('trait', s.trait).effect_text)] : [])]
    }
    if (s.kind === 'tilt') {
      const stats = (Object.keys(STAT_LABELS) as Stat[]).map((k) => [k, `${STAT_LABELS[k]} ${subj.birthStats[k]}`] as [Stat, string])
      return [
        seg('덜어 낼 곳', stats, s.from, (v) => { s.from = v; if (s.to === v) delete s.to }, (v) => (Object.keys(STAT_LABELS) as Stat[]).some((t) => canTilt(w, v, t, subj))),
        seg('더할 곳', stats, s.to, (v) => { s.to = v }, (v) => s.from !== undefined && canTilt(w, s.from, v, subj)),
      ]
    }
    if (s.kind === 'seed') {
      return [seg('숙련', seedSkills(w, subj).map((k) => [k, SKILL_LABELS[k as Skill]] as [Skill, string]), s.skill as Skill | undefined, (v) => { s.skill = v })]
    }
    return []
  }

  // 고른 축복의 세부(특성·능력치 두 곳·숙련)가 다 정해졌는가. 규칙 검사는 코어가 한다
  private startReady(): boolean {
    const s = this.start
    return !s || (!!(s.kind !== 'talent' || s.trait) && !!(s.kind !== 'tilt' || (s.from && s.to)) && !!(s.kind !== 'seed' || s.skill))
  }

  private depart(): void {
    const w = this.world
    if (!this.heir || !this.startReady()) return
    succeed(w, { uid: this.heir, name: this.name.trim().slice(0, 6), attitude: this.attitude, blessing: this.start })
    this.hide()
    this.onDone()
  }
}

const topStats = (c: Candidate): string => (Object.keys(STAT_LABELS) as Stat[])
  .sort((a, b) => c.birth_stats[b] - c.birth_stats[a]).slice(0, 2).map((k) => `${STAT_LABELS[k]} ${c.birth_stats[k]}`).join(' · ')

// 후계자는 아직 없으므로 후보 카드 값으로 축복을 미리 본다(출신 배경은 기본값, 숙련은 배경 숙련만 1단계)
function subjectFor(w: World, c: Candidate): BlessingSubject {
  const background = defaultBackground(w.content)
  const bgSkill = w.content.get('background', background).start_skill
  return {
    generation: w.state.family.generation + 1, traits: c.traits.map((t) => t.id), birthStats: { ...c.birth_stats }, background,
    ranks: Object.fromEntries((Object.keys(SKILL_LABELS) as Skill[]).map((k) => [k, k === bgSkill ? 1 : 0])) as Record<Skill, number>,
  }
}

function defaultStart(w: World, kind: StartKind, subj: BlessingSubject): StartChoice {
  if (kind === 'talent') return { kind, ...(talentOffers(w, subj)[0] ? { trait: talentOffers(w, subj)[0]! } : {}) }
  if (kind === 'seed') return { kind, ...(seedSkills(w, subj)[0] ? { skill: seedSkills(w, subj)[0]! } : {}) }
  return { kind }
}
