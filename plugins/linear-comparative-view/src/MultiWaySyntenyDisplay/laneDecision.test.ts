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

function decide(
  groups: ReturnType<typeof groupFeatures>,
  {
    assemblyNames = ['peach'],
    previous = new Map<string, LaneDecision | undefined>(),
    pinned,
    anchorReversed = false,
  }: {
    assemblyNames?: string[]
    previous?: Map<string, LaneDecision | undefined>
    pinned?: Map<string, string>
    anchorReversed?: boolean
  } = {},
) {
  const pxOf = (bp: number) => (anchorReversed ? WIDTH - px(bp) : px(bp))
  return decideLaneFrames({
    groups,
    assemblyNames,
    anchorX: new Map(
      groups.map(g => [g.key, pxOf((g.anchor.start + g.anchor.end) / 2)]),
    ),
    anchorCoordOf: g => ({
      refName: g.anchor.refName,
      coord: (g.anchor.start + g.anchor.end) / 2,
    }),
    pxOfAnchor: c => pxOf(c.coord),
    unitBp: SPAN_BP,
    width: WIDTH,
    anchorReversed,
    previous,
    pinned,
  })
}

function settle(
  groups: ReturnType<typeof groupFeatures>,
  previous = new Map<string, LaneDecision | undefined>(),
) {
  return decide(groups, { previous }).get('peach')!
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
    const under = decide(collinear, { anchorReversed: true }).get('peach')!
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

  // A fragmented assembly scatters one window over its scaffolds, and each of
  // them clears the share against every other, so the uncapped list was as
  // long as the assembly. The header draws unclipped in an SVG export and the
  // menu offers one item per entry, so the list is capped and the rest counted
  test('names only the strongest few of a window scattered over many scaffolds', () => {
    let n = 0
    const scattered = groupFeatures(
      Array.from({ length: 10 }, (_, s) =>
        Array.from({ length: 10 - s }, (_, i) =>
          pair(`s${s}-${i}`, `s${s}-${i}`, 100 + 80 * n++, {
            refName: `scaffold_${s}`,
            start: 1000 + 80 * i,
          }),
        ),
      ).flat(),
    )
    const decision = settle(scattered)
    expect(decision.refName).toBe('scaffold_0')
    expect(decision.alsoOn).toEqual(['scaffold_1', 'scaffold_2', 'scaffold_3'])
    expect(decision.alsoOnMore).toBe(5)
  })

  test('a pin outranks the vote while the window still places on it', () => {
    const pinned = new Map([['peach', 'Pp2']])
    const decision = decide(twoContigs(200, 30), { pinned }).get('peach')!
    expect(decision.refName).toBe('Pp2')
    expect(decision.pinned).toBe(true)
    expect(decision.alsoOn).toEqual(['Pp1'])
  })

  // The case a pin exists for is two comparable copies, and comparable is
  // inside the switch margin: a released pin that stayed the incumbent was
  // held there by the margin, so "let the lane choose" chose nothing
  test('releasing a pin lets the lane vote fresh rather than hold the pinned contig', () => {
    const groups = twoContigs(180, 130)
    const pinned = decide(groups, { pinned: new Map([['peach', 'Pp2']]) })
    expect(pinned.get('peach')!.refName).toBe('Pp2')

    const released = decide(groups, { previous: pinned }).get('peach')!
    expect(released.refName).toBe('Pp1')
    expect(released.pinned).toBe(false)

    // and once it has voted, the vote holds the way any decision does
    const held = decide(groups, {
      previous: new Map([['peach', released]]),
    }).get('peach')!
    expect(held).toBe(released)
  })

  test('a contig the vote chose is held by the margin, pin or no pin', () => {
    const groups = twoContigs(180, 130)
    const voted = decide(twoContigs(100, 130))
    expect(voted.get('peach')!.refName).toBe('Pp2')
    expect(decide(groups, { previous: voted }).get('peach')!.refName).toBe(
      'Pp2',
    )
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

  // An alignment cut into runs at its large indels: four heavy forward runs
  // of one chain with small reversed repeat hits between them. Paired only
  // with its neighbours, every pair was weighed by the hit and the chain read
  // backwards on a few hundred bp
  test('heavy forward runs are not outvoted by the small reversed hits between them', () => {
    const chainRun = (i: number, start: number) =>
      new SimpleFeature({
        uniqueId: `chain/${i}`,
        syntenyId: `chain/${i}`,
        refName: 'chr1',
        start,
        end: start + 100,
        strand: 1,
        assemblyName: 'anchor',
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 500_000 + start,
          end: 500_000 + start + 100,
        },
      })
    const hit = (i: number, start: number, mateStart: number) =>
      new SimpleFeature({
        uniqueId: `hit/${i}`,
        syntenyId: `hit/${i}`,
        refName: 'chr1',
        start,
        end: start + 2,
        strand: -1,
        assemblyName: 'anchor',
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: mateStart,
          end: mateStart + 2,
        },
      })
    const interleaved = groupFeatures([
      chainRun(0, 100),
      hit(0, 210, 500_900),
      chainRun(1, 300),
      hit(1, 410, 500_050),
      chainRun(2, 500),
      hit(2, 610, 500_950),
      chainRun(3, 700),
      hit(3, 810, 500_020),
    ])
    expect(settle(interleaved).flipped).toBe(false)
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

function frameOf(decision: LaneDecision, anchorReversed = false) {
  const coord = decision.pivotAnchor.coord
  return frameFromDecision(
    decision,
    anchorReversed ? WIDTH - px(coord) : px(coord),
    SPAN_BP,
    WIDTH,
    anchorReversed,
  )
}

// A group the lane places twice was one sample over the two copies' bounding
// box, weighted by its width: two copies 300 bp apart in a 1000 bp frame
// outweighed the four collinear genes together and slid the lane to put the
// gap between the copies under the anchor gene
describe('a group placed twice on a lane', () => {
  const twoCopies = groupFeatures([
    ...[100, 300, 500, 700].map((start, i) =>
      pair(`${i}`, `g${i}`, start, { start: 500_000 + start }),
    ),
    pair('dup-a', 'dup', 530, { start: 500_530 }),
    pair('dup-b', 'dup', 530, { start: 500_830 }),
  ])

  test('is two placements, so the collinear genes still sit under the anchor', () => {
    const frame = frameOf(settle(twoCopies))
    for (const start of [100, 300, 500, 700]) {
      expect(rowFrameX(frame, 500_030 + start, WIDTH)).toBeCloseTo(
        px(start + 30),
      )
    }
  })

  test('keeps the same decision as the lane without the second copy', () => {
    const one = frameOf(settle(collinear))
    const two = frameOf(settle(twoCopies))
    expect(two.min).toBeCloseTo(one.min)
    expect(two.flipped).toBe(one.flipped)
  })
})

function pairOn(
  assemblyName: string,
  name: string,
  start: number,
  mateStart: number,
  { refName = 'X1', strand = 1 } = {},
) {
  return new SimpleFeature({
    uniqueId: `${name}-${assemblyName}`,
    refName: 'chr1',
    start,
    end: start + 60,
    strand,
    name,
    assemblyName: 'anchor',
    mate: {
      assemblyName,
      refName,
      start: mateStart,
      end: mateStart + 60,
    },
  })
}

describe('a stack of two mate lanes', () => {
  const anchors = [100, 250, 400, 550, 700, 850]
  const lanes = ['peach', 'cacao']
  const stacked = (
    peachStarts: number[],
    cacaoStarts: number[],
    cacaoStrand = 1,
  ) =>
    groupFeatures([
      ...anchors.map((start, i) =>
        pairOn('peach', `g${i}`, start, 500_000 + peachStarts[i]!),
      ),
      ...anchors.map((start, i) =>
        pairOn('cacao', `g${i}`, start, 900_000 + cacaoStarts[i]!, {
          strand: cacaoStrand,
        }),
      ),
    ])
  const reversed = [...anchors].reverse()
  const bothCollinear = stacked(anchors, anchors)

  test('the lower lane lines up under the lane above, not under the anchor', () => {
    const first = decide(bothCollinear, { assemblyNames: lanes })
    // peach's content drifts 60 bp and its hold keeps it drawn where it was,
    // so its genes now sit 48 px right of the anchor's; a fresh cacao
    // follows peach there rather than the anchor
    const drifted = stacked(
      anchors.map(start => start + 60),
      anchors,
    )
    const second = decide(drifted, {
      assemblyNames: lanes,
      previous: new Map([['peach', first.get('peach')]]),
    })
    const peach = frameOf(second.get('peach')!)
    const cacao = frameOf(second.get('cacao')!)
    for (const [i, start] of anchors.entries()) {
      const peachX = rowFrameX(peach, 500_030 + start + 60, WIDTH)
      const cacaoX = rowFrameX(cacao, 900_030 + anchors[i]!, WIDTH)
      expect(peachX).toBeCloseTo(px(start + 30) + 48)
      expect(cacaoX).toBeCloseTo(peachX)
    }
  })

  test('orientation composes across a flipped middle lane', () => {
    // peach reads backwards against the anchor; cacao collinear with PEACH
    // is backwards against the anchor too, and cacao collinear with the
    // anchor reads backwards against peach's mirrored frame
    const withPeach = decide(stacked(reversed, reversed, -1), {
      assemblyNames: lanes,
    })
    expect(withPeach.get('peach')!.flipped).toBe(true)
    expect(withPeach.get('cacao')!.flipped).toBe(true)

    const withAnchor = decide(stacked(reversed, anchors), {
      assemblyNames: lanes,
    })
    expect(withAnchor.get('peach')!.flipped).toBe(true)
    expect(withAnchor.get('cacao')!.flipped).toBe(false)
  })

  test('under a reversed anchor both lanes mirror with it and decide nothing', () => {
    const decisions = decide(bothCollinear, {
      assemblyNames: lanes,
      anchorReversed: true,
    })
    const peach = decisions.get('peach')!
    const cacao = decisions.get('cacao')!
    expect(peach.flipped).toBe(false)
    expect(cacao.flipped).toBe(false)
    const peachFrame = frameOf(peach, true)
    const cacaoFrame = frameOf(cacao, true)
    expect(peachFrame.flipped).toBe(true)
    expect(cacaoFrame.flipped).toBe(true)
    for (const start of anchors) {
      const x = WIDTH - px(start + 30)
      expect(rowFrameX(peachFrame, 500_030 + start, WIDTH)).toBeCloseTo(x)
      expect(rowFrameX(cacaoFrame, 900_030 + start, WIDTH)).toBeCloseTo(x)
    }
  })
})
