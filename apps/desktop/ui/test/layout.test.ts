import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { COL, ENEMY_CX, HERO_CX, LAND, SCENE, TEXT, WIN, WINDOW_SCALES, artScale, drawDue, surface, windowScale } from '../src/layout'
import { SCENES } from '../src/scenes'
import { measure11 } from './measure'

describe('기본 창 768 × 64 배치(D75)', () => {
  it('풍경 496 + 글자 칸 272, 주인공 x 72, 적 x 168, 장면 판 x 48~175', () => {
    assert.deepEqual(WIN, { w: 768, h: 64 })
    assert.equal(LAND.x + LAND.w, COL.x)
    assert.equal(COL.x + COL.w, WIN.w)
    assert.equal(COL.w, 272)
    assert.equal(HERO_CX, 72)
    assert.equal(ENEMY_CX, 168)
    assert.equal(SCENE.x + SCENE.w, 176)
    assert.ok(ENEMY_CX + 24 <= LAND.w && HERO_CX - 24 >= 0, '인물 셀(48)이 풍경 안에 든다')
  })

  it('장면 표의 주인공 x(장면 판 기준)가 창에서 주인공 자리 근처에 온다(L09 x 24 → 72)', () => {
    assert.equal(SCENE.x + SCENES.L09!.hero!.x, HERO_CX)
    for (const row of Object.values(SCENES)) {
      if (!row.hero) continue
      const cx = SCENE.x + row.hero.x
      assert.ok(cx >= 64 && cx <= 90, `${row.scene} 주인공 창 x ${cx}`)
    }
  })

  it('글자 칸 작은 글자 2줄: 안쪽 x 501 폭 262, 1줄 이름·상태 175 + 아이콘·표식 84, 2줄 기록, 세로 가운데', () => {
    assert.deepEqual([TEXT.x, TEXT.w], [501, 262])
    assert.equal(TEXT.x + TEXT.w + 5, WIN.w)
    const { size, gap, markGap, w } = TEXT.icons
    assert.equal(4 * size + 3 * gap + markGap + size + 2 + size, w, '아이콘 4칸 + 중요 표식 + 태도 표식')
    assert.ok(TEXT.statusW + 3 + w <= TEXT.w)
    assert.equal(TEXT.row1.y + TEXT.lineH, 30)
    assert.ok(TEXT.row1.y + TEXT.lineH < TEXT.row2.y)
    assert.equal(TEXT.row1.y, WIN.h - (TEXT.row2.y + TEXT.lineH), '위아래 여백이 같다')
  })
})

describe('그리기 상한(01 §16, D76)', () => {
  it('60Hz 프레임(16.67ms 간격, ±0.3 떨림)이면 1초에 30번 그린다', () => {
    let last = -Infinity
    let draws = 0
    for (let i = 0; i < 60; i++) {
      const now = i * (1000 / 60) + (i % 2 ? 0.3 : -0.3)
      if (drawDue(now, last)) {
        draws++
        last = now
      }
    }
    assert.equal(draws, 30)
  })

  it('144Hz에서도 초당 30번을 넘지 않는다', () => {
    let last = -Infinity
    let draws = 0
    for (let i = 0; i < 144; i++) {
      const now = i * (1000 / 144)
      if (drawDue(now, last)) {
        draws++
        last = now
      }
    }
    assert.ok(draws <= 30 && draws >= 28, `${draws}번`)
  })
})

describe('픽셀 그림 정수 배율(03 §14)', () => {
  it('k = floor(dpr × 확대), 1 미만은 1', () => {
    assert.deepEqual([1, 1.25, 1.5, 2].map((d) => artScale(d)), [1, 1, 1, 2])
    assert.equal(artScale(1, 3), 3)
    assert.equal(artScale(1.25, 2), 2)
    assert.equal(artScale(0.9), 1)
    assert.equal(artScale(1.1 * 3), 3) // 3.3000000000000003
  })

  it('100%: 캔버스 = 768 × 64 장치 픽셀, 그림 1:1, CSS 크기 = 장치 크기', () => {
    assert.deepEqual(surface(1), { k: 1, devW: 768, devH: 64, cssW: 768, cssH: 64, artY: 0, logicalW: 768 })
  })

  it('125·150%: 그림은 ×1 그대로, 남는 폭은 배경을 더 이어 그리고 남는 높이는 위쪽 하늘', () => {
    assert.deepEqual(surface(1.25), { k: 1, devW: 960, devH: 80, cssW: 768, cssH: 64, artY: 16, logicalW: 960 })
    assert.deepEqual(surface(1.5), { k: 1, devW: 1152, devH: 96, cssW: 768, cssH: 64, artY: 32, logicalW: 1152 })
  })

  it('200%: 그림 ×2, 빈자리 없음', () => {
    assert.deepEqual(surface(2), { k: 2, devW: 1536, devH: 128, cssW: 768, cssH: 64, artY: 0, logicalW: 768 })
  })

  it('화면 배율(D81): 100·200·300%만, 창 전체가 s배이고 그림은 정수배 k = 내림(표시 배율 × s)', () => {
    assert.deepEqual([...WINDOW_SCALES], [1, 2, 3])
    assert.deepEqual([1, 2, 3, '2', 1.5, 4, 0, undefined, null, 'x'].map(windowScale), [1, 2, 3, 2, 1, 1, 1, 1, 1, 1])
    assert.deepEqual(surface(1, 2), { k: 2, devW: 1536, devH: 128, cssW: 1536, cssH: 128, artY: 0, logicalW: 768 })
    assert.deepEqual(surface(1, 3), { k: 3, devW: 2304, devH: 192, cssW: 2304, cssH: 192, artY: 0, logicalW: 768 })
    // 표시 배율 150% 모니터에서 200%: k = 3, 그림 1:1 정수배로 빈자리 없음
    assert.deepEqual(surface(1.5, 2), { k: 3, devW: 2304, devH: 192, cssW: 1536, cssH: 128, artY: 0, logicalW: 768 })
    // 125%에서 200%: k = 2(2.5 내림), 남는 폭은 배경을 더 잇고 남는 높이는 하늘
    const s = surface(1.25, 2)
    assert.equal(s.k, 2)
    assert.equal(s.artY, 160 - 128)
    assert.equal(s.logicalW, 960)
  })
})

describe('글자 칸 글자 폭(11px 대역)', () => {
  it('띄어쓰기가 있는 28자 기록과 안내 문구는 2줄 한 줄(262)에 든다', () => {
    for (const t of [
      '가나다라마바가 수첩 지도에 새 길을 그려 넣었다.', // 시뮬레이션에서 나온 가장 넓은 기록(27자, 이름 6자, 246)
      '가나다라마바가 모닥불 옆에서 낯선 이와 밤을 샜다.', // 28자, 띄어쓰기 6(약 257)
      'ⓘ 일시정지 중입니다. 나이와 진행이 멈췄습니다.',
      'ⓘ 다음 행동부터 안정적으로 움직입니다',
    ]) assert.ok(measure11(t) <= TEXT.w, `${t} ${measure11(t)}px`)
  })

  it('글자 수 한도(28자)만으로는 폭이 보장되지 않는다 — 한글만 28자는 308이라 폭은 픽셀로 검사한다(03 §2.5)', () => {
    assert.ok(measure11('가'.repeat(28)) > TEXT.w)
  })

  it('가장 긴 이름·상태 줄(이름 6자 + 나이 + 상태 + 조건어, 굵게)이 1줄 글자 자리 175에 든다', () => {
    for (const s of ['가나다라마바 45 · 던전 · 체력 위험', '가나다라마바 100 · 선택 대기', '가나다라마바 99 · 계승 · 체력 낮음', '가나다라마바 99 · 치료 · 선택 대기']) {
      assert.ok(measure11(s) <= TEXT.statusW, `${s} ${measure11(s)}px`)
    }
  })
})
