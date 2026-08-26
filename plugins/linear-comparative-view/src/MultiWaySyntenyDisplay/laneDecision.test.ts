import { SimpleFeature } from '@jbrowse/core/util'

import {
  decideLaneFrames,
  frameFromDecision,
  pickRung,
} from './laneDecision.ts'
import { groupFeatures, rowFrameX } from './layoutMultiWay.ts'

import type { LaneDecision } from './laneDecision.ts'

const WIDTH = 800
const SPAN_BP = 1000

function pair(
  uniqueId: string,
  name: string,
  start: number,
  mate: { refName?: string; start: number; end?: number },
) {
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end: start + 60,
    strand: 1,
    name,
    assemblyName: 'anchor',
    mate: {
      assemblyName: 'peach',
      refName: mate.refName ?? 'Pp1',
      start: mate.start,
      end: mate.end ?? mate.start + 60,
      name: `p-${name}`,
    },
  })
}

const px = (bp: number) => (bp / SPAN_BP) * WIDTH

function settle(
  groups: ReturnType<typeof groupFeatures>,
  previous = new Map<string, LaneDecision | undefined>(),
) {
  return decideLaneFrames({
    groups,
    assemblyNames: ['peach'],
    anchorX: new Map(
      groups.map(g => [g.key, px((g.anchor.start + g.anchor.end) / 2)]),
    ),
    anchorCoordOf: g => ({
      refName: g.anchor.refName,
      coord: (g.anchor.start + g.anchor.end) / 2,
    }),
    pxOfAnchor: c => px(c.coord),
    unitBp: SPAN_BP,
    width: WIDTH,
    previous,
  }).get('peach')!
}

// four orthologs, anchor and lane spaced alike, so the lane sits at rung 1
// and its ribbons go straight down
const collinear = groupFeatures(
  [100, 300, 500, 700].map((start, i) =>
    pair(`${i}`, `g${i}`, start, { start: 500_000 + start }),
  ),
)

describe('a settled lane under the view transform', () => {
  const decision = settle(collinear)
  const pivotPx = px(decision.pivotAnchor.coord)
  const at = frameFromDecision(decision, pivotPx, SPAN_BP, WIDTH)

  test('a pan moves the lane by exactly the anchor movement', () => {
    const panned = frameFromDecision(decision, pivotPx - 120, SPAN_BP, WIDTH)
    const bp = decision.pivotLaneBp + 200
    expect(rowFrameX(panned, bp, WIDTH)).toBeCloseTo(
      rowFrameX(at, bp, WIDTH) - 120,
    )
  })

  test('a pan moves a flipped lane the same way', () => {
    const flipped = { ...decision, flipped: true }
    const before = frameFromDecision(flipped, pivotPx, SPAN_BP, WIDTH)
    const after = frameFromDecision(flipped, pivotPx - 120, SPAN_BP, WIDTH)
    const bp = decision.pivotLaneBp + 200
    expect(rowFrameX(after, bp, WIDTH)).toBeCloseTo(
      rowFrameX(before, bp, WIDTH) - 120,
    )
  })

  test('a zoom scales the lane about its pivot', () => {
    const zoomed = frameFromDecision(decision, pivotPx, SPAN_BP * 2, WIDTH)
    expect(rowFrameX(zoomed, decision.pivotLaneBp, WIDTH)).toBeCloseTo(pivotPx)
    const bp = decision.pivotLaneBp + 200
    expect(rowFrameX(zoomed, bp, WIDTH) - pivotPx).toBeCloseTo(
      (rowFrameX(at, bp, WIDTH) - pivotPx) / 2,
    )
  })

  test('the pivot is the ortholog nearest the middle of the window', () => {
    expect(decision.pivotAnchor).toEqual({ refName: 'chr1', coord: 530 })
  })

  test('a horizontally flipped view mirrors the lane about its pivot', () => {
    const mirrored = frameFromDecision(decision, pivotPx, SPAN_BP, WIDTH, true)
    expect(mirrored.flipped).toBe(true)
    expect(rowFrameX(mirrored, decision.pivotLaneBp, WIDTH)).toBeCloseTo(
      pivotPx,
    )
    const bp = decision.pivotLaneBp + 200
    expect(rowFrameX(mirrored, bp, WIDTH) - pivotPx).toBeCloseTo(
      pivotPx - rowFrameX(at, bp, WIDTH),
    )
  })

  test('a decision made under a flipped view still reads against the anchor', () => {
    const reversedPx = (bp: number) => WIDTH - px(bp)
    const under = decideLaneFrames({
      groups: collinear,
      assemblyNames: ['peach'],
      anchorX: new Map(
        collinear.map(g => [
          g.key,
          reversedPx((g.anchor.start + g.anchor.end) / 2),
        ]),
      ),
      anchorCoordOf: g => ({
        refName: g.anchor.refName,
        coord: (g.anchor.start + g.anchor.end) / 2,
      }),
      pxOfAnchor: c => reversedPx(c.coord),
      unitBp: SPAN_BP,
      width: WIDTH,
      anchorReversed: true,
      previous: new Map(),
    }).get('peach')!
    expect(under.flipped).toBe(false)
  })
})

describe('the ladder rung', () => {
  test('rounds a fresh fit up', () => {
    expect(pickRung(1.2)).toBe(1.5)
    expect(pickRung(1.6)).toBe(2)
    expect(pickRung(100)).toBe(100)
  })
  test('grows when the fit no longer fits', () => {
    expect(pickRung(1.6, 1.5)).toBe(2)
  })
  test('holds a rung the fit still nearly fills', () => {
    expect(pickRung(1.0, 1.5)).toBe(1.5)
    expect(pickRung(1.4, 2)).toBe(2)
  })
  test('drops only once a lower rung has clear room', () => {
    expect(pickRung(1.0, 2)).toBe(1)
    expect(pickRung(1.3, 3)).toBe(1.5)
  })
})

describe('the contig', () => {
  const twoContigs = (pp1Bp: number, pp2Bp: number) =>
    groupFeatures([
      new SimpleFeature({
        uniqueId: 'a',
        refName: 'chr1',
        start: 100,
        end: 100 + pp1Bp,
        strand: 1,
        name: 'a',
        mate: { assemblyName: 'peach', refName: 'Pp1', start: 1000, end: 1500 },
      }),
      new SimpleFeature({
        uniqueId: 'b',
        refName: 'chr1',
        start: 400,
        end: 400 + pp2Bp,
        strand: 1,
        name: 'b',
        mate: { assemblyName: 'peach', refName: 'Pp2', start: 1000, end: 1500 },
      }),
    ])

  test('is the one explaining the most anchor bp', () => {
    expect(settle(twoContigs(100, 130)).refName).toBe('Pp2')
  })

  test('holds against a challenger inside the switch margin', () => {
    const previous = new Map([['peach', settle(twoContigs(130, 100))]])
    expect(settle(twoContigs(100, 130), previous).refName).toBe('Pp1')
  })

  test('switches once the challenger clears it', () => {
    const previous = new Map([['peach', settle(twoContigs(130, 100))]])
    expect(settle(twoContigs(100, 160), previous).refName).toBe('Pp2')
  })
})

describe('the orientation', () => {
  const anchors = [100, 250, 400, 550, 700, 850]
  const laneOrder = (mateStarts: number[]) =>
    groupFeatures(
      anchors.map((start, i) =>
        pair(`${i}`, `g${i}`, start, { start: 500_000 + mateStarts[i]! }),
      ),
    )
  const forwards = laneOrder(anchors)
  const mostlyBackwards = laneOrder([700, 550, 400, 250, 100, 850])
  const backwards = laneOrder([...anchors].reverse())
  const fewBackwards = groupFeatures(
    [100, 300, 500].map((start, i) =>
      pair(`${i}`, `g${i}`, start, { start: 500_000 + 600 - start }),
    ),
  )

  test('follows the majority on a fresh lane', () => {
    expect(settle(forwards).flipped).toBe(false)
    expect(settle(mostlyBackwards).flipped).toBe(true)
  })

  test('holds against a mixed window', () => {
    const previous = new Map([['peach', settle(forwards)]])
    expect(settle(mostlyBackwards, previous).flipped).toBe(false)
  })

  test('mirrors once nearly everything reads the other way', () => {
    const previous = new Map([['peach', settle(forwards)]])
    expect(settle(backwards, previous).flipped).toBe(true)
  })

  test('does not mirror a lane on three reversed genes', () => {
    expect(settle(fewBackwards).flipped).toBe(true)
    const previous = new Map([['peach', settle(forwards)]])
    expect(settle(fewBackwards, previous).flipped).toBe(false)
  })

  test('carries across a contig change rather than re-guessing', () => {
    const previous = new Map([['peach', settle(backwards)]])
    const mixed = [250, 100, 400, 550, 850, 700]
    const elsewhere = groupFeatures(
      anchors.map((start, i) =>
        pair(`${i}`, `g${i}`, start, {
          refName: 'Pp2',
          start: 900_000 + mixed[i]!,
        }),
      ),
    )
    const moved = settle(elsewhere, previous)
    expect(moved.refName).toBe('Pp2')
    expect(moved.flipped).toBe(true)
  })
})

describe('the placement', () => {
  const shifted = (bp: number) =>
    groupFeatures(
      [100, 300, 500, 700].map((start, i) =>
        pair(`${i}`, `g${i}`, start, { start: 500_000 + start + bp }),
      ),
    )
  const first = settle(collinear)
  const previous = new Map([['peach', first]])

  test('holds while its frame still shows what it placed', () => {
    for (const bp of [12, 125]) {
      const held = settle(shifted(bp), previous)
      expect(held.pivotLaneBp).toBe(first.pivotLaneBp)
      expect(held.pivotAnchor).toEqual(first.pivotAnchor)
    }
  })

  test('re-aligns once what it should show has left the frame', () => {
    const slid = settle(shifted(700), previous)
    expect(slid.pivotLaneBp).not.toBe(first.pivotLaneBp)
    const frame = frameFromDecision(
      slid,
      px(slid.pivotAnchor.coord),
      SPAN_BP,
      WIDTH,
    )
    // lined up again: the ortholog under the pivot draws at the anchor's x
    expect(rowFrameX(frame, 500_000 + 530 + 700, WIDTH)).toBeCloseTo(px(530))
  })

  test('a settle that changes nothing returns the same decision', () => {
    expect(settle(collinear, previous)).toBe(first)
  })
})
