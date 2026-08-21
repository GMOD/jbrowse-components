import {
  OFFSCREEN_MATE_NAV_MIN_BP,
  navLocString,
  takeFollowAnchor,
} from './offscreenMateNav.ts'

// a locstring is 1-based and inclusive, so its width is end - start + 1
function width(loc: string) {
  const [start, end] = loc.split(':')[1]!.split('-').map(Number)
  return end! - start! + 1
}

describe('navLocString', () => {
  it('is the bare contig with no locus to aim at', () => {
    expect(navLocString('ctgB')).toBe('ctgB')
  })

  it('keeps a locus wider than the floor at its own span', () => {
    const loc = navLocString('ctgB', { start: 200_000, end: 260_000 })
    expect(width(loc)).toBe(60_000)
  })

  it('widens a narrow locus to the floor, centred on it', () => {
    const loc = navLocString('ctgB', { start: 200_000, end: 200_500 })
    expect(width(loc)).toBe(OFFSCREEN_MATE_NAV_MIN_BP)
    expect(loc).toBe('ctgB:190251-210250')
  })

  // the case the pad-then-clip form got wrong: half the window fell off the
  // start of the contig and was simply lost
  it('slides a near-origin window right instead of trimming it', () => {
    const loc = navLocString('ctgB', { start: 100, end: 600 })
    expect(width(loc)).toBe(OFFSCREEN_MATE_NAV_MIN_BP)
    expect(loc).toBe('ctgB:1-20000')
  })

  it('never names a coordinate before the first base', () => {
    for (const start of [0, 1, 50, 5_000, 12_000]) {
      const loc = navLocString('ctgB', { start, end: start + 200 })
      expect(Number(loc.split(':')[1]!.split('-')[0])).toBeGreaterThanOrEqual(1)
      expect(width(loc)).toBe(OFFSCREEN_MATE_NAV_MIN_BP)
    }
  })
})

describe('takeFollowAnchor', () => {
  const host = (followSynteny: boolean, followAnchorIndex: number) => ({
    followSynteny,
    followAnchorIndex,
    setFollowAnchorIndex(idx: number) {
      this.followAnchorIndex = idx
    },
  })

  it('takes the anchor for a followed row that does not hold it', () => {
    const h = host(true, 0)
    const anchor = takeFollowAnchor(h, 1, () => true)

    expect(anchor.taken).toBe(true)
    expect(h.followAnchorIndex).toBe(1)
    anchor.release()
    expect(h.followAnchorIndex).toBe(0)
  })

  it('takes nothing on the row that already holds it', () => {
    const h = host(true, 1)
    expect(takeFollowAnchor(h, 1, () => true).taken).toBe(false)
    expect(h.followAnchorIndex).toBe(1)
  })

  // the anchor is a persisted setting this click never touched, so writing a
  // value back would re-point it at whichever row a mark was last clicked on
  it('takes nothing, and releases nothing, with the follow off', () => {
    const h = host(false, 0)
    const anchor = takeFollowAnchor(h, 1, () => true)
    expect(anchor.taken).toBe(false)

    h.followAnchorIndex = 2
    anchor.release()
    expect(h.followAnchorIndex).toBe(2)
  })

  // snackbars stack: an older one's cleanup must not drag the anchor off a row
  // a later click moved it to
  it('releases nothing once a later take has moved the anchor on', () => {
    const h = host(true, 0)
    const first = takeFollowAnchor(h, 1, () => true)
    const second = takeFollowAnchor(h, 2, () => true)

    first.release()
    expect(h.followAnchorIndex).toBe(2)
    second.release()
    expect(h.followAnchorIndex).toBe(1)
  })

  it('is idempotent, and silent once the view is gone', () => {
    const h = host(true, 0)
    const anchor = takeFollowAnchor(h, 1, () => true)
    anchor.release()
    anchor.release()
    expect(h.followAnchorIndex).toBe(0)

    const dead = host(true, 0)
    takeFollowAnchor(dead, 1, () => false).release()
    expect(dead.followAnchorIndex).toBe(1)
  })
})
