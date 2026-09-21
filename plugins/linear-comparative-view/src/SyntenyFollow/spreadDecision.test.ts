import { decideSpread, partialShare, spreadCoverage } from './spreadDecision.ts'

import type { AnchorWindow } from './followAnchorWindow.ts'
import type { Region } from '@jbrowse/core/util/types'

// Nine chromosomes of a megabase, so the gap between two answers is countable
const CONTIG = 1_000_000
const regions: Region[] = Array.from({ length: 9 }, (_, i) => ({
  refName: `chr${i + 1}`,
  start: 0,
  end: CONTIG,
  assemblyName: 'a',
}))

const win = (
  refName: string,
  start: number,
  end: number,
  widthPx: number,
): AnchorWindow => ({ refName, start, end, widthPx })

describe('whole contigs against cut ones', () => {
  test('an overview is whole contigs, so nothing is partial', () => {
    expect(
      partialShare({
        regions,
        windows: [win('chr1', 0, CONTIG, 400), win('chr2', 0, CONTIG, 400)],
      }),
    ).toBe(0)
  })

  // Block edges come off pixels, so a fully visible contig reports an end a hair
  // short of its region's. Live, on a `showAllRegions` panel, five of eight
  // contigs read as cut — which is not something that panel can contain.
  test('a contig a rounding short of its end is still whole', () => {
    expect(
      partialShare({
        regions,
        windows: [win('chr1', 0, CONTIG - 2, 800)],
      }),
    ).toBe(0)
  })

  test('a junction straddle is partial on both sides', () => {
    expect(
      partialShare({
        regions,
        windows: [
          win('chr1', 900_000, CONTIG, 1331),
          win('chr2', 0, 100_000, 657),
        ],
      }),
    ).toBe(1)
  })

  // by pixels, not by count: the two an overview's screen edges cut are a small
  // part of it and a straddle's two are all of it
  test('the two contigs an overview cuts do not carry it over the floor', () => {
    expect(
      partialShare({
        regions,
        windows: [
          win('chr1', 500_000, CONTIG, 100),
          win('chr2', 0, CONTIG, 400),
          win('chr3', 0, CONTIG, 400),
          win('chr4', 0, 500_000, 100),
        ],
      }),
    ).toBeLessThan(0.5)
  })
})

describe('how much of the placed row is answer', () => {
  test('two adjacent answers cover nearly all of what they place', () => {
    expect(
      spreadCoverage(regions, [
        { refName: 'chr1', start: 0, end: CONTIG },
        { refName: 'chr2', start: 0, end: CONTIG },
      ]),
    ).toBe(1)
  })

  test('two answers a genome apart cover almost none of it', () => {
    // chr1 and chr9 of nine, so seven whole contigs of filler
    expect(
      spreadCoverage(regions, [
        { refName: 'chr1', start: 0, end: CONTIG },
        { refName: 'chr9', start: 0, end: CONTIG },
      ]),
    ).toBeCloseTo(2 / 9)
  })

  test('two tracks answering on one contig are one stretch of screen', () => {
    expect(
      spreadCoverage(regions, [
        { refName: 'chr1', start: 0, end: 600_000 },
        { refName: 'chr1', start: 400_000, end: CONTIG },
      ]),
    ).toBe(1)
  })
})

// the anchor contigs that answered, each on the mate contig of the same name
const answered = (...refNames: string[]) =>
  new Map(refNames.map(refName => [refName, refName]))

describe('the decision', () => {
  const straddle = {
    stayingRegions: regions,
    movingRegions: regions,
    windows: [win('chr1', 900_000, CONTIG, 1331), win('chr2', 0, 100_000, 657)],
    mapped: answered('chr1', 'chr2'),
  }

  test('a straddle whose answers are a genome apart is refused', () => {
    expect(
      decideSpread({
        ...straddle,
        spans: [
          { refName: 'chr1', start: 0, end: CONTIG },
          { refName: 'chr9', start: 0, end: CONTIG },
        ],
      }),
    ).toMatchObject({ spreading: false, onto: 'chr1' })
  })

  test('the same straddle stands when its answers are neighbours', () => {
    expect(
      decideSpread({
        ...straddle,
        spans: [
          { refName: 'chr1', start: 0, end: CONTIG },
          { refName: 'chr2', start: 0, end: CONTIG },
        ],
      }),
    ).toMatchObject({ spreading: true })
  })

  // the case the rung exists for, and the one no coverage threshold can be
  // trusted with: measured live, an honest overview covers 26-40% of what it
  // places, which is under any floor that would catch the straddle above
  test('an overview is never refused, however little of it is answer', () => {
    expect(
      decideSpread({
        stayingRegions: regions,
        movingRegions: regions,
        windows: [win('chr1', 0, CONTIG, 400), win('chr9', 0, CONTIG, 400)],
        mapped: answered('chr1', 'chr9'),
        spans: [
          { refName: 'chr1', start: 0, end: 100_000 },
          { refName: 'chr9', start: 0, end: 100_000 },
        ],
      }),
    ).toMatchObject({ spreading: true })
  })

  test('a refused spread names the contig the eye is on, not the widest answer', () => {
    // chr2 owns a third of the panel and maps to the bigger span; chr1 is where
    // the reader is looking
    expect(
      decideSpread({
        ...straddle,
        spans: [
          { refName: 'chr1', start: 0, end: 100_000 },
          { refName: 'chr9', start: 0, end: CONTIG },
        ],
      }),
    ).toMatchObject({ onto: 'chr1' })
  })

  describe('once refused', () => {
    const refused = { spreading: false, onto: 'chr1' }

    test('it takes more than the floor to win the screen back', () => {
      // 52% covered — one contig of filler: over the floor, under the band
      const spans = [
        { refName: 'chr1', start: 0, end: CONTIG },
        { refName: 'chr3', start: 0, end: 100_000 },
      ]
      expect(decideSpread({ ...straddle, spans })).toMatchObject({
        spreading: true,
      })
      expect(
        decideSpread({ ...straddle, spans, previous: refused }),
      ).toMatchObject({ spreading: false })
    })

    test('a clear answer still wins it back', () => {
      expect(
        decideSpread({
          ...straddle,
          spans: [
            { refName: 'chr1', start: 0, end: CONTIG },
            { refName: 'chr2', start: 0, end: CONTIG },
          ],
          previous: refused,
        }),
      ).toMatchObject({ spreading: true })
    })

    test('the contig it was refused onto is held against a near-equal rival', () => {
      // chr2 is now marginally the wider of the two, which a pan produces and
      // a re-decision per settle would act on
      expect(
        decideSpread({
          ...straddle,
          windows: [
            win('chr1', 900_000, CONTIG, 980),
            win('chr2', 0, 100_000, 1008),
          ],
          spans: [
            { refName: 'chr1', start: 0, end: CONTIG },
            { refName: 'chr9', start: 0, end: CONTIG },
          ],
          previous: refused,
        }),
      ).toMatchObject({ onto: 'chr1' })
    })

    test('but a rival the reader has really panned onto takes it', () => {
      expect(
        decideSpread({
          ...straddle,
          windows: [
            win('chr1', 900_000, CONTIG, 400),
            win('chr2', 0, 100_000, 1600),
          ],
          spans: [
            { refName: 'chr1', start: 0, end: CONTIG },
            { refName: 'chr9', start: 0, end: CONTIG },
          ],
          previous: refused,
        }),
      ).toMatchObject({ onto: 'chr2' })
    })
  })

  // The reader reaches a refused answer by scrolling the anchor onto the contig
  // that carries it, so a contig carrying none is advice that cannot be taken.
  test('the contigs it names are the ones that answered', () => {
    expect(
      decideSpread({
        ...straddle,
        windows: [
          win('chr1', 900_000, CONTIG, 500),
          win('chr2', 0, 100_000, 400),
          win('chr3', 0, 100_000, 400),
        ],
        // chr3 is on screen and aligns to nothing in the file
        mapped: answered('chr1', 'chr2'),
        spans: [
          { refName: 'chr1', start: 0, end: CONTIG },
          { refName: 'chr9', start: 0, end: CONTIG },
        ],
      }),
    ).toMatchObject({ onto: 'chr1', elsewhere: ['chr2'] })
  })

  // Refused onto the widest window regardless, an unaligned contig owning half
  // the panel left the rung below with nothing to place from: every row held,
  // and the header said nothing aligned while naming two contigs that did.
  test('it is refused onto a contig that answered, not the widest unaligned one', () => {
    expect(
      decideSpread({
        ...straddle,
        windows: [
          win('chr1', 100, 1100, 400),
          win('chr2', 100, 600, 200),
          win('chr3', 100, 600, 200),
        ],
        mapped: answered('chr2', 'chr3'),
        spans: [
          { refName: 'chr1', start: 0, end: 1000 },
          { refName: 'chr5', start: 0, end: 1000 },
        ],
      }),
    ).toMatchObject({ spreading: false, onto: 'chr2', elsewhere: ['chr3'] })
  })
})

// A second window with no alignment is filler: spread, the row was placed by a
// union of one contig's answer, with no walk and no strand.
test('one contig answering demotes to the rung below, with nothing elsewhere', () => {
  expect(
    decideSpread({
      stayingRegions: regions,
      movingRegions: regions,
      windows: [win('chr1', 0, CONTIG, 1331), win('chr2', 0, CONTIG, 657)],
      spans: [{ refName: 'chr1', start: 0, end: CONTIG }],
      mapped: answered('chr1'),
    }),
  ).toEqual({ spreading: false, onto: 'chr1', elsewhere: [] })
})
