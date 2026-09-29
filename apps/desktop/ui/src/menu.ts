// 기본 창의 작은 메뉴(03 §2.6 태도 빠른 메뉴). 누른 표식 아래에 펼치고, 항목을 고르거나 바깥을 누르거나 Esc면 닫는다
export type MenuItem = { label: string; checked?: boolean; run: () => void } | 'sep'

export class QuickMenu {
  constructor(private readonly root: HTMLElement) {
    root.hidden = true
    root.setAttribute('role', 'menu')
    document.addEventListener('click', (e) => { if (!root.contains(e.target as Node)) this.close() })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close() })
  }

  // 데스크톱(D85): 메뉴는 기본 창 바로 위의 판이라(position static) 가로 자리만 누른 곳에 맞춘다
  private placeStatic(x: number): boolean {
    if (getComputedStyle(this.root).position !== 'static') return false
    const app = this.root.parentElement!.getBoundingClientRect()
    this.root.style.marginLeft = `${Math.max(0, Math.min(x - app.left, app.width - this.root.offsetWidth))}px`
    ;(this.root.querySelector('button') as HTMLElement | null)?.focus()
    return true
  }

  // 우클릭 메뉴(03 §2.6): 누른 자리에 펼친다(데스크톱은 기본 창 바로 위, 누른 가로 자리)
  openAt(x: number, y: number, items: MenuItem[]): void {
    this.fill(items)
    if (this.placeStatic(x)) return
    this.root.style.left = `${x + scrollX}px`
    this.root.style.top = `${y + scrollY}px`
    ;(this.root.querySelector('button') as HTMLElement | null)?.focus()
  }

  open(anchor: HTMLElement, items: MenuItem[]): void {
    this.fill(items)
    // 표식이 창 오른쪽 끝에 있으므로 메뉴 오른쪽을 표식 오른쪽에 맞춘다
    const r = anchor.getBoundingClientRect()
    if (this.placeStatic(r.right - this.root.offsetWidth)) return
    this.root.style.left = `${Math.max(0, r.right - this.root.offsetWidth) + scrollX}px`
    this.root.style.top = `${r.bottom + scrollY + 2}px`
    ;(this.root.querySelector('button') as HTMLElement | null)?.focus()
  }

  private fill(items: MenuItem[]): void {
    this.root.replaceChildren(...items.map((it) => {
      if (it === 'sep') return Object.assign(document.createElement('hr'), { role: 'separator' })
      const b = document.createElement('button')
      b.type = 'button'
      b.setAttribute('role', 'menuitemradio')
      b.setAttribute('aria-checked', String(!!it.checked))
      b.textContent = `${it.checked ? '●' : ' '} ${it.label}`
      b.onclick = (e) => {
        e.stopPropagation()
        this.close()
        it.run()
      }
      return b
    }))
    this.root.hidden = false
  }

  close(): void {
    this.root.hidden = true
  }
}
