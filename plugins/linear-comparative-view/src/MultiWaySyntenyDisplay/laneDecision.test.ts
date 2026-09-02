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
    expect(pickRung(1, 1.5)).toBe(1.5)
    expect(pickRung(1.4, 2)).toBe(2)
  })
  test('drops only once a lower rung has clear room', () => {
    expect(pickRung(1, 2)).toBe(1)
    expect(pickRung(1.3, 3)).toBe(1.5)
  })
})

describe('the contig', () => {
  // an alignment source: nameless records, whose evidence is their anchor bp
  const twoContigs = (pp1Bp: number, pp2Bp: number) =>
    groupFeatures([
      new SimpleFeature({
        uniqueId: 'a',
        refName: 'chr1',
        start: 100,
        end: 100 + pp1Bp,
        strand: 1,
        syntenyId: 1,
        mate: { assemblyName: 'peach', refName: 'Pp1', start: 1000, end: 1500 },
      }),
      new SimpleFeature({
        uniqueId: 'b',
        refName: 'chr1',
        start: 400,
        end: 400 + pp2Bp,
        strand: 1,
        syntenyId: 2,
        mate: { assemblyName: 'peach', refName: 'Pp2', start: 1000, end: 1500 },
      }),
    ])

  // a gene table: named rows, one vote each whatever the gene's length
  const genesOn = (pp1: number, pp2: number, pp2GeneBp = 60) =>
    groupFeatures([
      ...Array.from({ length: pp1 }, (_, i) =>
        pair(`a${i}`, `a${i}`, 100 + 80 * i, { start: 1000 + 80 * i }),
      ),
      ...Array.from({ length: pp2 }, (_, i) =>
        pair(`b${i}`, `b${i}`, 100 + 80 * (pp1 + i), {
          refName: 'Pp2',
          start: 1000 + 80 * i,
          end: 1000 + 80 * i + pp2GeneBp,
        }),
      ),
    ])

  test('is the one explaining the most anchor bp of an alignment', () => {
    expect(settle(twoContigs(100, 130)).refName).toBe('Pp2')
  })

  test('is the one holding the most genes of a gene table', () => {
    expect(settle(genesOn(3, 2)).refName).toBe('Pp1')
    expect(settle(genesOn(2, 3)).refName).toBe('Pp2')
  })

  // DPP10 spans 1.4 Mb; the fifteen genes on the other side of the human chr2
  // fusion span 0.4 Mb between them, and they are fifteen orthologs
  test('one long gene does not outvote many short ones', () => {
    const groups = groupFeatures([
      ...Array.from({ length: 6 }, (_, i) =>
        pair(`a${i}`, `a${i}`, 100 + 80 * i, { start: 1000 + 80 * i }),
      ),
      new SimpleFeature({
        uniqueId: 'giant',
        refName: 'chr1',
        start: 600,
        end: 600 + 50_000,
        strand: 1,
        name: 'giant',
        mate: {
          assemblyName: 'peach',
          refName: 'Pp2',
          start: 1000,
          end: 51_000,
        },
      }),
    ])
    expect(settle(groups).refName).toBe('Pp1')
    expect(settle(groups).alsoOn).toEqual([])
  })

  test('holds against a challenger inside the switch margin', () => {
    const previous = new Map([['peach', settle(twoContigs(130, 100))]])
    expect(settle(twoContigs(100, 130), previous).refName).toBe('Pp1')
  })

  test('switches once the challenger clears it', () => {
    const previous = new Map([['peach', settle(twoContigs(130, 100))]])
    expect(settle(twoContigs(100, 160), previous).refName).toBe('Pp2')
  })

  // a second homoeologous copy is a contig the lane will never choose on its
  // own once the first clearly wins, and the reader has to be told it exists;
  // so is the far side of a fusion breakpoint, which holds a quarter of the
  // window's genes for most of a walk across it
  test('names a contig explaining a comparable share, and not a repeat hit', () => {
    expect(settle(twoContigs(200, 130)).alsoOn).toEqual(['Pp2'])
    expect(settle(twoContigs(200, 30)).alsoOn).toEqual([])
    expect(settle(genesOn(8, 2)).alsoOn).toEqual(['Pp2'])
    expect(settle(genesOn(12, 1)).alsoOn).toEqual([])
  })

  test('a pin outranks the vote while the window still places on it', () => {
    const pinned = new Map([['peach', 'Pp2']])
    const groups = twoContigs(200, 30)
    const decision = decideLaneFrames({
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
      previous: new Map(),
      pinned,
    }).get('peach')!
    expect(decision.refName).toBe('Pp2')
    expect(decision.alsoOn).toEqual(['Pp1'])
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

  test('a zoom that changes the rung keeps the pivot while the frame still shows the content', () => {
    // ten collinear genes: at a 900 bp window the fit needs rung 1.5, and
    // the frame pinned at the old pivot still covers every one of them
    const dense = groupFeatures(
      Array.from({ length: 10 }, (_, i) =>
        pair(`${i}`, `g${i}`, 50 + 100 * i, { start: 500_050 + 100 * i }),
      ),
    )
    const wide = settle(dense)
    const zoomedPx = (bp: number) => (bp / 900) * WIDTH
    const zoomed = decideLaneFrames({
      groups: dense,
      assemblyNames: ['peach'],
      anchorX: new Map(
        dense.map(g => [g.key, zoomedPx((g.anchor.start + g.anchor.end) / 2)]),
      ),
      anchorCoordOf: g => ({
        refName: g.anchor.refName,
        coord: (g.anchor.start + g.anchor.end) / 2,
      }),
      pxOfAnchor: c => zoomedPx(c.coord),
      unitBp: 900,
      width: WIDTH,
      previous: new Map([['peach', wide]]),
    }).get('peach')!
    expect(wide.rung).toBe(1)
    expect(zoomed.rung).toBe(1.5)
    expect(zoomed.pivotAnchor).toEqual(wide.pivotAnchor)
    expect(zoomed.pivotLaneBp).toBe(wide.pivotLaneBp)
  })

  test('a settle that changes nothing returns the same decision', () => {
    expect(settle(collinear, previous)).toBe(first)
  })
})
