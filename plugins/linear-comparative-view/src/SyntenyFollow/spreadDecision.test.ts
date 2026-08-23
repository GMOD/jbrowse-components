import { decideSpread, partialShare, spreadCoverage } from './spreadDecision.ts'

import type { FollowWindow } from './followAnchorWindow.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { Region } from '@jbrowse/core/util/types'

// Nine chromosomes of a megabase, so the gap between two answers is countable
const CONTIG = 1_000_000
const regions: Region[] = Array.from({ length: 9 }, (_, i) => ({
  refName: `chr${i + 1}`,
  start: 0,
  end: CONTIG,
  assemblyName: 'a',
}))

function block(refName: string, widthPx: number): ContentBlock {
  return {
    type: 'ContentBlock',
    key: refName,
    offsetPx: 0,
    widthPx,
    assemblyName: 'a',
    refName,
    start: 0,
    end: CONTIG,
  }
}

const win = (refName: string, start: number, end: number): FollowWindow => ({
  refName,
  start,
  end,
})

describe('whole contigs against cut ones', () => {
  test('an overview is whole contigs, so nothing is partial', () => {
    expect(
      partialShare({
        blocks: [block('chr1', 400), block('chr2', 400)],
        regions,
        windows: [win('chr1', 0, CONTIG), win('chr2', 0, CONTIG)],
      }),
    ).toBe(0)
  })

  // Block edges come off pixels, so a fully visible contig reports an end a hair
  // short of its region's. Live, on a `showAllRegions` panel, five of eight
  // contigs read as cut — which is not something that panel can contain.
  test('a contig a rounding short of its end is still whole', () => {
    expect(
      partialShare({
        blocks: [block('chr1', 800)],
        regions,
        windows: [win('chr1', 0, CONTIG - 2)],
      }),
    ).toBe(0)
  })

  test('a junction straddle is partial on both sides', () => {
    expect(
      partialShare({
        blocks: [block('chr1', 1331), block('chr2', 657)],
        regions,
        windows: [win('chr1', 900_000, CONTIG), win('chr2', 0, 100_000)],
      }),
    ).toBe(1)
  })

  // by pixels, not by count: the two an overview's screen edges cut are a small
  // part of it and a straddle's two are all of it
  test('the two contigs an overview cuts do not carry it over the floor', () => {
    expect(
      partialShare({
        blocks: [
          block('chr1', 100),
          block('chr2', 400),
          block('chr3', 400),
          block('chr4', 100),
        ],
        regions,
        windows: [
          win('chr1', 500_000, CONTIG),
          win('chr2', 0, CONTIG),
          win('chr3', 0, CONTIG),
          win('chr4', 0, 500_000),
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

describe('the decision', () => {
  const straddle = {
    blocks: [block('chr1', 1331), block('chr2', 657)],
    stayingRegions: regions,
    movingRegions: regions,
    windows: [win('chr1', 900_000, CONTIG), win('chr2', 0, 100_000)],
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
        blocks: [block('chr1', 400), block('chr9', 400)],
        stayingRegions: regions,
        movingRegions: regions,
        windows: [win('chr1', 0, CONTIG), win('chr9', 0, CONTIG)],
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
          blocks: [block('chr1', 980), block('chr2', 1008)],
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
          blocks: [block('chr1', 400), block('chr2', 1600)],
          spans: [
            { refName: 'chr1', start: 0, end: CONTIG },
            { refName: 'chr9', start: 0, end: CONTIG },
          ],
          previous: refused,
        }),
      ).toMatchObject({ onto: 'chr2' })
    })
  })
})
