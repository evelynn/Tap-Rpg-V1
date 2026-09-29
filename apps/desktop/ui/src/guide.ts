// 첫 실행 안내(03 §11.2·§12.2): 한 줄 기록 자리에 `ⓘ` 8초, 60초에 한 번까지(겹치면 미룬다), 일지에 남기지 않는다.
// 첫 가문의 첫 인물에게만 나오고, 모두 보이면 끝(설정 `안내 다시 보기`로 다시 켠다). 문구는 03 §12.2 원문.
import { retreatHpRatio, type Content, type JournalEntry, type World } from '@tap/core'

export const GUIDE_GAP_MS = 60_000

type Trigger = (e: JournalEntry) => boolean
interface Guide { id: string; text: (w: World) => string; when: 'start' | Trigger | 'risky' }

export const GUIDES: Guide[] = [
  { id: 'start', when: 'start', text: () => 'ⓘ 스스로 사냥하고 쉬고 돌아옵니다. 그냥 두셔도 됩니다.' },
  { id: 'journal', when: (e) => e.tag === 'hunt', text: () => 'ⓘ 캐릭터를 누르면 지금까지의 일지를 볼 수 있습니다.' },
  { id: 'check', when: (e) => e.tag === 'check', text: () => 'ⓘ [판정] 기록을 누르면 주사위를 어떻게 굴렸는지 볼 수 있습니다.' },
  { id: 'gear', when: (e) => e.tag === 'gear', text: () => 'ⓘ 장비는 스스로 고릅니다. 바꾼 이유는 일지에 남습니다.' },
  { id: 'rest', when: (e) => e.tag === 'rest', text: () => 'ⓘ 쉬는 동안에도 시간이 흐릅니다. 12분이 지나면 한 살을 먹습니다.' },
  { id: 'attitude', when: (e) => e.tag === 'town', text: () => 'ⓘ 태도를 바꾸면 다음 행동부터 달라집니다. 오른쪽 저울 표식을 눌러 보세요.' },
  { id: 'retreat', when: 'risky', text: (w) => `ⓘ 체력이 ${Math.round(retreatHpRatio(w) * 100)}% 아래로 내려가면 스스로 돌아옵니다. 태도에 따라 기준이 다릅니다.` },
  { id: 'injury', when: 'risky', text: () => 'ⓘ 쓰러져도 목숨을 잃지는 않습니다. 대신 다쳐서 치료나 휴식이 필요할 수 있습니다.' },
]

export class GuideScheduler {
  private seen = new Set<string>()
  private queue: string[] = []
  private lastShown = -Infinity
  private lastId = -1
  private started = false

  // seen0·onSeen: 본 안내 id를 설정에 남겨, 다시 켜도 처음부터 반복하지 않는다
  constructor(private readonly content: Content, private readonly note: (text: string) => void, private readonly done: () => boolean, private readonly markDone: () => void,
    seen0: readonly string[] = [], private readonly onSeen: (ids: string[]) => void = () => {}) {
    for (const id of seen0) this.seen.add(id)
    if (seen0.includes('start')) this.started = true
  }

  replay(): void {
    this.seen.clear()
    this.queue = []
    this.started = false
    this.lastId = -1
  }

  // 첫 가문 첫 인물인가(연대기가 비어 있고 1대)
  private eligible(w: World): boolean {
    return !this.done() && w.state.family.generation === 1 && w.state.family.chronicle.length === 0 && w.state.character !== null
  }

  tick(w: World, now: number): void {
    if (!this.eligible(w)) return
    const j = w.state.journal
    if (this.lastId < 0) {
      // 처음 볼 때: 지난 기록은 건너뛰고(다시 켜도 옛 기록으로 몰아 뜨지 않게) 시작 안내만 세운다
      this.lastId = j.at(-1)?.id ?? 0
      if (!this.started) { this.started = true; this.enqueue('start') }
    }
    let from = j.length
    while (from > 0 && j[from - 1]!.id > this.lastId) from--
    for (const e of j.slice(from)) { // 일어난 차례대로
      for (const g of GUIDES) if (typeof g.when === 'function' && g.when(e)) this.enqueue(g.id)
    }
    this.lastId = j.at(-1)?.id ?? this.lastId
    // 위험 활동 전 퇴각·부상 안내: 두 번째 출정부터(첫 출정은 H1 사냥으로 고정, 03 §12.2)
    const sortie = w.state.current_activity.sortie
    if (sortie && Number(sortie.id.replace(/\D/g, '')) >= 2) { this.enqueue('retreat'); this.enqueue('injury') }
    if (this.queue.length && now - this.lastShown >= GUIDE_GAP_MS) {
      const id = this.queue.shift()!
      this.note(GUIDES.find((g) => g.id === id)!.text(w))
      this.lastShown = now
      this.seen.add(id)
      this.onSeen([...this.seen]) // 실제로 띄운 안내만 기억한다(대기열에 남은 채 끄면 다음에 다시 뜬다)
      if (this.seen.size === GUIDES.length && !this.queue.length) this.markDone()
    }
  }

  private enqueue(id: string): void {
    if (this.seen.has(id) || this.queue.includes(id)) return
    this.queue.push(id)
  }
}
