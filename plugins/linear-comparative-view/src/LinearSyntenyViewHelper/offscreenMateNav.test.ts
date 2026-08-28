import { destroy, types } from '@jbrowse/mobx-state-tree'

import {
  OFFSCREEN_MATE_NAV_MIN_BP,
  mateFlightAllowed,
  navSpan,
  takeFollowAnchor,
} from './offscreenMateNav.ts'

// The contig the window is framed in. Wide enough that the floor and the
// padding are what decide the answer, except where a test says otherwise.
const CTG = { start: 0, end: 1_000_000 }

function width({ start, end }: { start: number; end: number }) {
  return end - start
}

describe('navSpan', () => {
  it('is the whole contig with no locus to aim at', () => {
    expect(navSpan(CTG)).toEqual(CTG)
  })

  it('pads a locus already wider than the floor', () => {
    expect(width(navSpan(CTG, { start: 200_000, end: 260_000 }))).toBe(84_000)
  })

  // the padding lives inside the floor, so this is the width the row lands at
  // rather than 1.4x it
  it('widens a narrow locus to the floor, centred on it, and does not then pad it', () => {
    expect(navSpan(CTG, { start: 200_000, end: 200_500 })).toEqual({
      start: 190_250,
      end: 210_250,
    })
  })

  // the case the pad-then-clip form got wrong: half the window fell off the
  // start of the contig and was simply lost
  it('slides a near-origin window right instead of trimming it', () => {
    expect(navSpan(CTG, { start: 100, end: 600 })).toEqual({
      start: 0,
      end: 20_000,
    })
  })

  // ...and the mirror, which the locstring form could not do at all: it had no
  // contig to measure against, so a locus near the end framed past it
  it('slides a near-end window left instead of running off the contig', () => {
    expect(navSpan(CTG, { start: 999_000, end: 999_500 })).toEqual({
      start: 980_000,
      end: 1_000_000,
    })
  })

  // a contig shorter than the floor is framed whole rather than widened past
  // its own end in both directions
  it('gives a contig narrower than the floor its own bounds', () => {
    const tiny = { start: 0, end: 5_000 }
    expect(navSpan(tiny, { start: 100, end: 600 })).toEqual(tiny)
  })

  it('never names a coordinate before the first base', () => {
    for (const start of [0, 1, 50, 5_000, 12_000]) {
      const span = navSpan(CTG, { start, end: start + 200 })
      expect(span.start).toBeGreaterThanOrEqual(0)
      expect(width(span)).toBe(OFFSCREEN_MATE_NAV_MIN_BP)
    }
  })
})

// The two halves of the click's flight decision that are not about the mark:
// what the reader asked for, and the one arrangement of the stack where the arc
// would tear it apart.
describe('mateFlightAllowed', () => {
  it('flies when the reader wants motion and the rows are their own', () => {
    expect(mateFlightAllowed({ linkViews: false }, 'enabled')).toBe(true)
  })

  it('jumps when the reader has turned motion off', () => {
    expect(mateFlightAllowed({ linkViews: false }, 'disabled')).toBe(false)
  })

  // `installLinkedViewSync` replays a row's zoomTo onto every other row and its
  // scroll onto none of them, so the arc's pull-back would land on the whole
  // stack while only the clicked row travelled.
  it('jumps when the rows are locked together in pixels', () => {
    expect(mateFlightAllowed({ linkViews: true }, 'enabled')).toBe(false)
  })
})

describe('takeFollowAnchor', () => {
  // a real node, because `release` guards on the liveness of what it WRITES
  const HostModel = types
    .model({
      followSynteny: types.boolean,
      followAnchorIndex: types.number,
      views: types.array(types.model({ name: types.string })),
    })
    .actions(self => ({
      setFollowAnchorIndex(idx: number) {
        self.followAnchorIndex = idx
      },
      removeRow(idx: number) {
        self.views.splice(idx, 1)
        self.followAnchorIndex = Math.min(
          Math.max(self.followAnchorIndex, 0),
          Math.max(self.views.length - 1, 0),
        )
      },
    }))
  const host = (followSynteny: boolean, followAnchorIndex: number, rows = 4) =>
    HostModel.create({
      followSynteny,
      followAnchorIndex,
      views: Array.from({ length: rows }, (_, i) => ({ name: `row${i}` })),
    })

  it('takes the anchor for a followed row that does not hold it', () => {
    const h = host(true, 0)
    const anchor = takeFollowAnchor(h, 1)

    expect(anchor.taken).toBe(true)
    expect(h.followAnchorIndex).toBe(1)
    anchor.release()
    expect(h.followAnchorIndex).toBe(0)
  })

  it('takes nothing on the row that already holds it', () => {
    const h = host(true, 1)
    expect(takeFollowAnchor(h, 1).taken).toBe(false)
    expect(h.followAnchorIndex).toBe(1)
  })

  // the anchor is a persisted setting this click never touched, so writing a
  // value back would re-point it at whichever row a mark was last clicked on
  it('takes nothing, and releases nothing, with the follow off', () => {
    const h = host(false, 0)
    const anchor = takeFollowAnchor(h, 1)
    expect(anchor.taken).toBe(false)

    h.setFollowAnchorIndex(2)
    anchor.release()
    expect(h.followAnchorIndex).toBe(2)
  })

  // snackbars stack: an older one's cleanup must not drag the anchor off a row
  // a later click moved it to
  it('releases nothing once a later take has moved the anchor on', () => {
    const h = host(true, 0)
    const first = takeFollowAnchor(h, 1)
    const second = takeFollowAnchor(h, 2)

    first.release()
    expect(h.followAnchorIndex).toBe(2)
    second.release()
    expect(h.followAnchorIndex).toBe(1)
  })

  // a removal renumbers the rows, so the original `row` stops naming ours
  it('still releases after a removal renumbered the anchored row', () => {
    const h = host(true, 0, 3)
    const anchor = takeFollowAnchor(h, 2)
    expect(h.followAnchorIndex).toBe(2)

    h.removeRow(0)
    expect(h.followAnchorIndex).toBe(1)
    expect(h.views[1]!.name).toBe('row2')

    anchor.release()
    expect(h.followAnchorIndex).toBe(0)
  })

  it('releases nothing once the anchored row is gone', () => {
    const h = host(true, 0, 3)
    const anchor = takeFollowAnchor(h, 2)

    h.removeRow(2)
    anchor.release()
    expect(h.followAnchorIndex).toBe(1)
  })

  it('is idempotent', () => {
    const h = host(true, 0)
    const anchor = takeFollowAnchor(h, 1)
    anchor.release()
    anchor.release()
    expect(h.followAnchorIndex).toBe(0)
  })

  // the guard is on the HOST, the node release writes. Given the navigated
  // row's liveness instead, the exit that most needs releasing — the row died
  // mid-flight, while the view holding the anchor did not — read false and kept
  // the anchor on a row nobody chose.
  it('does not write once the host itself is gone', () => {
    const dead = host(true, 0)
    const anchor = takeFollowAnchor(dead, 1)
    destroy(dead)
    expect(() => {
      anchor.release()
    }).not.toThrow()
  })
})
