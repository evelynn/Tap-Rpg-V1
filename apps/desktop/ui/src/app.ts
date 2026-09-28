// 기본 창 한 프레임 만들기: 세계 구동 → 한 줄 기록·장면 → 연출 → FrameView. DOM이 없어 헤드리스로도 돈다.
import { journalGrade, type World } from '@tap/core'
import { actViewOf, direct, type Stage } from './director'
import { Driver } from './driver'
import { ENEMY_CX, HERO_CX, SCENE } from './layout'
import { Animator } from './motion'
import { LineQueue } from './records'
import type { FrameView } from './render'
import { SceneTracker } from './scenes'
import { HERO_CLIPS, STRIPS, enemyClips, spriteFamily, type EnemyMotion, type Motion } from './sprites'
import { pickBackground } from './background'
import { icons, statusLine, statusViewOf } from './status'

const SCROLL_PX_SEC = 20 // 층 나누기 전 합성 띠라 중간 층 속도 하나로 흘린다(15 §8.2)
export const PAUSE_LINE = 'ⓘ 일시정지 중입니다. 나이와 진행이 멈췄습니다.'

export class App {
  readonly driver: Driver
  readonly lines: LineQueue
  private readonly scenes: SceneTracker
  private readonly hero = new Animator<Motion>(HERO_CLIPS, 'idle', 'idle')
  private enemy: { anim: Animator<EnemyMotion>; key: number } | null = null
  private offset = 0
  private stage: Stage
  private notes = 0

  // sceneFiles: 장면 id → 그림 파일(그림이 있는 장면만)
  // backgrounds: 불러온 장소 배경 띠(background.ts가 장소·계절·시간대로 고른다)
  constructor(readonly world: World, private readonly sceneFiles: Record<string, string>, private readonly backgrounds: ReadonlySet<string> = new Set()) {
    this.driver = new Driver(world)
    const ui = world.content.balance.ui
    this.lines = new LineQueue({ minSec: ui.line_min_sec, importantSec: ui.important_line_sec, queueMax: ui.line_queue_max })
    this.scenes = new SceneTracker(new Set(Object.keys(sceneFiles)))
    this.stage = direct(actViewOf(world), 0)
  }

  // 안내(03 §11.2): 한 줄 기록 자리에 8초, 일지에는 남기지 않는다. id는 기록 id와 겹치지 않게 아주 큰 수에서 센다
  note(text: string): void {
    this.lines.push({ id: Number.MAX_SAFE_INTEGER - this.notes++, text, grade: 'A' })
  }

  // now: 실시간 밀리초, dt: 지난 프레임부터 흐른 실시간
  step(now: number, dt: number, dark = false): FrameView {
    const { world, driver, lines } = this
    for (const e of driver.tick(dt)) {
      lines.push({
        id: e.id, text: e.line, grade: journalGrade(e),
        ...(e.refs?.event_id ? { eventId: e.refs.event_id } : {}),
        ...(e.tag === 'gear' && e.sub === 'rare_gain' ? { long: true } : {}), // 드롭 순간(D76)
      })
    }
    if (lines.update(now)) this.scenes.onLine(lines.current?.eventId, now)

    const paused = driver.paused
    const scene = this.scenes.at(now)
    if (!paused) this.animate(now, dt, scene?.row.hero?.motion ?? null, scene !== null)

    const sv = statusViewOf(world)
    const heroShown = scene ? scene.row.hero !== null : this.stage.hero !== null
    const hero = this.hero
    const foe = this.enemy?.anim
    return {
      bg: { file: this.backgrounds.size ? pickBackground(world, this.backgrounds) : STRIPS.bg, offset: this.offset },
      scene: scene ? { file: this.sceneFiles[scene.row.scene]!, frame: scene.frame } : null,
      paused,
      hero: heroShown ? {
        sheet: hero.clip.sheet, cell: hero.cell, cx: scene?.row.hero ? SCENE.x + scene.row.hero.x : HERO_CX, flip: !scene && this.stage.flip, // 장면 표의 x는 장면 판 기준
        flash: hero.motion === 'hit' && hero.frame === 0,
      } : null,
      enemy: foe && !scene && !(foe.motion === 'exit' && foe.done) ? {
        sheet: foe.clip.sheet, cell: foe.cell, cx: ENEMY_CX, flip: false, flash: foe.motion === 'hit' && foe.frame === 0,
      } : null,
      status: sv ? statusLine(sv) : world.state.family.name,
      icons: sv ? icons(sv) : [],
      line: paused ? PAUSE_LINE : lines.current?.text ?? '',
      mark: world.state.pending_choice ? 'choice' : world.state.current_activity.state === 'awaiting_succession' ? 'succession' : null,
      attitude: world.content.get('attitude', world.state.policies.attitude).name,
      dark,
    }
  }

  private animate(now: number, dt: number, sceneHero: Motion | null, inScene: boolean): void {
    const stage = (this.stage = direct(actViewOf(this.world), now))
    const want = inScene ? sceneHero : stage.hero
    if (want) this.hero.request(want)
    this.hero.update(dt)
    if (!stage.enemy) this.enemy = null
    else if (!inScene) {
      if (this.enemy?.key !== stage.enemy.key) {
        this.enemy = { anim: new Animator<EnemyMotion>(enemyClips(spriteFamily(stage.enemy.family)), 'move', 'idle'), key: stage.enemy.key }
      }
      this.enemy.anim.request(stage.enemy.motion)
      this.enemy.anim.update(dt)
    }
    // 장면이 풍경을 대신하는 동안은 흐름을 멈춘다
    if (!inScene) this.offset += (stage.scroll * SCROLL_PX_SEC * dt) / 1000
  }
}
