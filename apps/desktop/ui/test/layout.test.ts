import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { COL, ENEMY_CX, HERO_CX, LAND, SCENE, TEXT, WIN, artScale, fitLines, surface } from '../src/layout'
import { SCENES } from '../src/scenes'
import { measure11 } from './measure'

describe('기본 창 768 × 64 배치(D75)', () => {
  it('풍경 576 + 글자 칸 192, 주인공 x 72, 적 x 168, 장면 판 x 48~175', () => {
    assert.deepEqual(WIN, { w: 768, h: 64 })
    assert.equal(LAND.x + LAND.w, COL.x)
    assert.equal(COL.x + COL.w, WIN.w)
    assert.equal(COL.w, 192)
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

  it('글자 칸 세 줄(상태·아이콘·기록 2줄)이 높이 64 안에 든다', () => {
    assert.equal(TEXT.x + TEXT.w + 4, WIN.w)
    assert.ok(TEXT.status.y + TEXT.lineH <= TEXT.icons.y)
    assert.ok(TEXT.icons.y + TEXT.icons.size <= TEXT.record.y)
    assert.ok(TEXT.record.y + TEXT.record.lines * TEXT.lineH <= WIN.h)
    assert.ok(4 * TEXT.icons.size + 3 * TEXT.icons.gap + 2 * (TEXT.icons.gap + 12) <= TEXT.w, '아이콘 4칸 + 표식 2개')
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
})

describe('글자 칸 글자 맞춤(11px, 폭 182)', () => {
  const W = TEXT.w

  it('28자 기록은 한 줄(182)에 들어가지 않는다 — 11px 한글 한 자가 11px이라 약 257px', () => {
    assert.ok(measure11('가나다라마바가 모닥불 옆에서 낯선 이와 밤을 샜다.') > W)
  })

  it('가장 긴 기록·28자 극단값·안내 문구가 모두 2줄 안에, 줄마다 182 안에 든다(자르지 않는다)', () => {
    const texts = [
      '가나다라마바가 수첩 지도에 새 길을 그려 넣었다.', // 시뮬레이션에서 나온 가장 긴 기록(27자, 이름 6자)
      '가나다라마바가 모닥불 옆에서 낯선 이와 밤을 샜다.', // 28자
      '가'.repeat(28), // 띄어쓰기 없는 28자
      '가나다라마바가나다라마 바가나다라마바가나다라마바', // 긴 어절 둘(어절 접기 3줄 → 글자 접기)
      'ⓘ 일시정지 중입니다. 나이와 진행이 멈췄습니다.',
      'ⓘ 다음 행동부터 안정적으로 움직입니다',
    ]
    for (const t of texts) {
      const lines = fitLines(t, W, measure11)
      assert.ok(lines.length <= 2, `${t} → ${lines.length}줄`)
      for (const l of lines) assert.ok(measure11(l) <= W, `${l} ${measure11(l)}px`)
      assert.equal(lines.join('').replace(/ /g, ''), t.replace(/ /g, ''), '글자를 버리지 않는다')
    }
  })

  it('짧은 기록은 한 줄 그대로, 어절 단위로 먼저 접는다', () => {
    assert.deepEqual(fitLines('들쥐를 쫓아냈다.', W, measure11), ['들쥐를 쫓아냈다.'])
    const two = fitLines('가나다라마바가 수첩 지도에 새 길을 그려 넣었다.', W, measure11)
    assert.deepEqual(two, ['가나다라마바가 수첩 지도에 새 길을', '그려 넣었다.'])
  })

  it('가장 긴 이름·상태 줄(이름 6자 + 두 자리 나이 + 상태 + 조건어, 굵게)이 한 줄에 든다', () => {
    for (const s of ['가나다라마바 45 · 던전 · 체력 위험', '가나다라마바 100 · 선택 대기', '가나다라마바 99 · 계승 · 체력 낮음']) {
      assert.ok(measure11(s) <= W, `${s} ${measure11(s)}px`)
    }
  })
})
