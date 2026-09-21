import {
  OFFSCREEN_MATE_NAV_MIN_BP,
  mateFlightAllowed,
  navSpan,
} from './offscreenMateNav.ts'

// The contig the window is framed in. Wide enough that the floor and the
// padding are what decide the answer, except where a test says otherwise.
const CTG = { start: 0, end: 1_000_000 }

function width({ start, end }: { start: number; end: number }) {
  return end - start
}

describe('navSpan', () => {
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

  // The clamp is to the REGION, not to zero, and every other case here uses a
  // contig starting at the origin, where the two are the same number.
  it('slides a near-edge window inside a region that does not start at zero', () => {
    expect(
      navSpan(
        { start: 100_000, end: 200_000 },
        { start: 100_100, end: 100_600 },
      ),
    ).toEqual({ start: 100_000, end: 120_000 })
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
