import {
  colorFwdStrand,
  colorPairLR,
  colorPairLRDark,
  colorRevStrand,
  resolvePalette,
} from '@jbrowse/core/ui/palette'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { SASHIMI_APEX_CLEARANCE_PX, sashimiArcColor } from './computeOverlay.ts'
import { junctionKey } from './junctions.ts'
import { computeSashimiArcs } from './sashimiArcs.fixture.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ComputeSashimiArcsOpts } from './sashimiArcs.fixture.ts'

// Minimal PileupDataResult with only the sashimi fields computeSashimiArcs reads.
function makeData(counts: number[]): PileupDataResult {
  const n = counts.length
  const sashimiX1 = new Uint32Array(n)
  const sashimiX2 = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    sashimiX1[i] = 100 + i * 100
    sashimiX2[i] = 200 + i * 100
  }
  return makePileupDataResult({
    sashimiX1,
    sashimiX2,
    sashimiCounts: new Uint32Array(counts),
    sashimiFwd: new Uint32Array(n),
    sashimiRev: new Uint32Array(n),
    sashimiDonors: new Uint8Array(n),
    sashimiAcceptors: new Uint8Array(n),
  })
}

// Side assignment is `junctions.ts`'s job (one decision, shared with the layout
// that reserves the strip) — here it is an input, so these tests are about
// geometry alone. `down('chr1', 100, 300)` reads as "this junction was sent
// down"; the default is every arc up.
function down(...junctions: [string, number, number][]) {
  return new Set(junctions.map(j => junctionKey(...j)))
}

const baseOpts = (
  rpcData: PileupDataResult,
  minSashimiScore: number,
): ComputeSashimiArcsOpts => ({
  rpcDataMap: new Map([[0, rpcData]]),
  visibleRegions: [{ refName: 'chr1', displayedRegionIndex: 0 }],
  // Wider than anything these fixtures project to, so the off-screen cull never
  // fires — every test below is about geometry, and the cull has its own.
  viewWidthPx: 10_000,
  coverageHeight: 100,
  sashimiArcsHeight: 40,
  minSashimiScore,
  showNonCanonicalJunctions: true,
  downJunctionKeys: down(),
})

test('shows all arcs when minSashimiScore is 0', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([1, 5, 10]), 0))
  expect(arcs.map(a => a.score)).toEqual([1, 5, 10])
})

// The feed's order IS the paint order, which decides both which arc is on top
// and, the hit test walking it back to front, which one answers a hover.
// Junctions arrive in the worker's order, which says nothing about count, so
// this is the only thing standing between a 1-read junction and the tooltip of
// the 200-read one it overlaps.
test('arcs are emitted heaviest-last, whatever order the junctions arrived in', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([200, 1, 40]), 0))
  expect(arcs.map(a => a.score)).toEqual([1, 40, 200])
})

test('filters arcs below minSashimiScore', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([1, 5, 10]), 5))
  expect(arcs.map(a => a.score)).toEqual([5, 10])
})

test('keeps arcs whose count equals minSashimiScore (>= boundary)', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([4, 5]), 5))
  expect(arcs.map(a => a.score)).toEqual([5])
})

test('drops every arc when threshold exceeds all counts', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([1, 2, 3]), 100))
  expect(arcs).toHaveLength(0)
})

test('wider junctions get taller arcs (span-scaled nesting)', () => {
  // Three junctions of increasing span share a start at bp 100.
  const data = makePileupDataResult({
    sashimiX1: new Uint32Array([100, 100, 100]),
    sashimiX2: new Uint32Array([150, 300, 1100]),
    sashimiCounts: new Uint32Array([5, 5, 5]),
    sashimiFwd: new Uint32Array([0, 0, 0]),
    sashimiRev: new Uint32Array([0, 0, 0]),
    sashimiDonors: new Uint8Array([0, 0, 0]),
    sashimiAcceptors: new Uint8Array([0, 0, 0]),
  })
  const arcs = computeSashimiArcs(baseOpts(data, 0))
  expect(arcs[0]!.y).toBeLessThan(arcs[1]!.y)
  expect(arcs[1]!.y).toBeLessThan(arcs[2]!.y)
})

// The tallest arc a band can hold: a 100kb junction (>= SPAN_REF_MAX_BP) pins
// MAX_ARC_FRAC, and sending it down puts its label at the apex in a band-local
// space whose baseline is 0, so the numbers below read directly against the
// 40px strip. The test region draws 1px per bp, so its label sits past the
// test's default box.
const deepestDownArc = () => {
  const data = makePileupDataResult({
    sashimiX1: new Uint32Array([100]),
    sashimiX2: new Uint32Array([100_100]),
    sashimiCounts: new Uint32Array([5]),
    sashimiFwd: new Uint32Array([0]),
    sashimiRev: new Uint32Array([0]),
    sashimiDonors: new Uint8Array([0]),
    sashimiAcceptors: new Uint8Array([0]),
  })
  return computeSashimiArcs({
    ...baseOpts(data, 0),
    viewWidthPx: 200_000,
    downJunctionKeys: down(['chr1', 100, 100_100]),
  })[0]!
}

test('an arc rises to the band fraction it asks for', () => {
  const arc = deepestDownArc()
  // down band: baseline 0, so the apex IS 0.95 of the drawable strip — the 40px
  // band less the room its label needs past the apex.
  expect(arc.side).toBe('down')
  expect(arc.y).toBeCloseTo(0.95)
  expect(arc.label!.y).toBeCloseTo(0.95 * (40 - SASHIMI_APEX_CLEARANCE_PX))
})

test('the up band spends its whole height on the arc, clearance-free', () => {
  // The clearance is the CLIPPED band's alone. The up band overlays the coverage
  // histogram with overflow visible, so nothing there is ever cut and its label
  // draws into the scalebar margin the histogram already reserves — charging it
  // the same clearance took 16% off every arc in the default 45px band (35px of
  // drawable height) to buy a rare left-edge overlap with the axis text.
  const data = makePileupDataResult({
    sashimiX1: new Uint32Array([100]),
    sashimiX2: new Uint32Array([100_100]),
    sashimiCounts: new Uint32Array([5]),
    sashimiFwd: new Uint32Array([0]),
    sashimiRev: new Uint32Array([0]),
    sashimiDonors: new Uint8Array([0]),
    sashimiAcceptors: new Uint8Array([0]),
  })
  const arc = computeSashimiArcs({
    ...baseOpts(data, 0),
    viewWidthPx: 200_000,
  })[0]!
  // baseline is the histogram's own zero line at effectiveHeight (100 - 2*5),
  // and the apex rises MAX_ARC_FRAC of that full height above it.
  expect(arc.side).toBe('up')
  expect(arc.label!.y).toBeCloseTo(90 - 0.95 * 90)
})

test('the deepest down arc keeps its label inside the clipped strip', () => {
  // The down sub-band renders with overflow:hidden — it must not paint over the
  // pileup below it — so an apex placed at MAX_ARC_FRAC of the RAW height had
  // the lower half of its count label clipped off. The label is centered on the
  // apex, so what has to fit below it is the clearance.
  expect(
    deepestDownArc().label!.y + SASHIMI_APEX_CLEARANCE_PX,
  ).toBeLessThanOrEqual(40)
})

test('a sashimi band shorter than its label clearance labels nothing', () => {
  // Same failure mode as the too-short coverage band below: nothing floors a
  // config-declared `sashimiArcsHeight`, and a band under the clearance made the
  // drawable height negative, curving every down arc up through the coverage
  // histogram. The mark draws no arc in such a band (`sashimiBandsOf`), so no
  // count stands there either.
  const arcs = computeSashimiArcs({
    ...baseOpts(makeData([5]), 0),
    sashimiArcsHeight: 3,
    downJunctionKeys: down(['chr1', 100, 200]),
  })
  expect(arcs[0]!.label).toBeUndefined()
})

test('suppresses the count label on sub-pixel-narrow junctions', () => {
  const data = makePileupDataResult({
    sashimiX1: new Uint32Array([100, 100]),
    sashimiX2: new Uint32Array([105, 400]),
    sashimiCounts: new Uint32Array([5, 5]),
    sashimiFwd: new Uint32Array([0, 0]),
    sashimiRev: new Uint32Array([0, 0]),
    sashimiDonors: new Uint8Array([0, 0]),
    sashimiAcceptors: new Uint8Array([0, 0]),
  })
  const arcs = computeSashimiArcs(baseOpts(data, 0))
  expect(arcs[0]!.label).toBeUndefined()
  expect(arcs[1]!.label).toBeDefined()
})

test('suppresses the count label when the digits, not the span, overflow', () => {
  // Same 30px span, different counts. A flat span threshold showed both; a
  // 5-digit count needs ~36px of text and has to stay suppressed.
  const data = makePileupDataResult({
    sashimiX1: new Uint32Array([100, 500]),
    sashimiX2: new Uint32Array([130, 530]),
    sashimiCounts: new Uint32Array([5, 12345]),
    sashimiFwd: new Uint32Array([0, 0]),
    sashimiRev: new Uint32Array([0, 0]),
    sashimiDonors: new Uint8Array([0, 0]),
    sashimiAcceptors: new Uint8Array([0, 0]),
  })
  const arcs = computeSashimiArcs(baseOpts(data, 0))
  const showByStart = new Map(arcs.map(a => [a.start, a.label !== undefined]))
  expect(showByStart.get(100)).toBe(true)
  expect(showByStart.get(500)).toBe(false)
})

test('tints arcs with the read-alignment strand colors, the neutral from the theme', () => {
  const light = resolvePalette().alignmentFill
  const dark = resolvePalette({ themeName: 'darkMinimal' }).alignmentFill
  expect(sashimiArcColor(1, light)).toBe(colorFwdStrand)
  expect(sashimiArcColor(-1, light)).toBe(colorRevStrand)
  expect(sashimiArcColor(0, light)).toBe(colorPairLR)
  expect(sashimiArcColor(0, dark)).toBe(colorPairLRDark)
})

test('places each arc on the side its junction key was assigned', () => {
  const data = makePileupDataResult({
    sashimiX1: new Uint32Array([100, 200, 500]),
    sashimiX2: new Uint32Array([300, 400, 600]),
    sashimiCounts: new Uint32Array([5, 5, 5]),
    sashimiFwd: new Uint32Array([0, 0, 0]),
    sashimiRev: new Uint32Array([0, 0, 0]),
    sashimiDonors: new Uint8Array([0, 0, 0]),
    sashimiAcceptors: new Uint8Array([0, 0, 0]),
  })
  const arcs = computeSashimiArcs({
    ...baseOpts(data, 0),
    downJunctionKeys: down(['chr1', 200, 400]),
  })
  expect(new Map(arcs.map(a => [a.start, a.side]))).toEqual(
    new Map([
      [100, 'up'],
      [200, 'down'],
      [500, 'up'],
    ]),
  )
})

test('a junction key naming another refName does not pull this arc down', () => {
  // The keys carry a refName precisely so two chromosomes on screen at once
  // can't be confused for one another.
  const arcs = computeSashimiArcs({
    ...baseOpts(makeData([5]), 0),
    downJunctionKeys: down(['chr2', 100, 200]),
  })
  expect(arcs[0]!.side).toBe('up')
})

test('dedupes a junction shared across same-refName regions (collapsed introns)', () => {
  // Collapsed introns split one refName into many displayedRegions (exons). A
  // junction spanning exon A -> exon B is a skip-gap in reads that overlap BOTH
  // regions, so both per-region fetches return them and the worker emits the
  // same absolute junction in each region's rpcData. Real counts are identical
  // (the fetch is uncapped); the 5-vs-8 here is synthetic to prove the merge
  // collapses to one arc and keeps the higher count, rather than rendering two
  // arcs that share an identical refName:start:end:strand React key.
  const region0 = makePileupDataResult({
    sashimiX1: new Uint32Array([100]),
    sashimiX2: new Uint32Array([1100]),
    sashimiCounts: new Uint32Array([5]),
    sashimiFwd: new Uint32Array([0]),
    sashimiRev: new Uint32Array([0]),
    sashimiDonors: new Uint8Array([0]),
    sashimiAcceptors: new Uint8Array([0]),
  })
  const region1 = makePileupDataResult({
    sashimiX1: new Uint32Array([100]),
    sashimiX2: new Uint32Array([1100]),
    sashimiCounts: new Uint32Array([8]),
    sashimiFwd: new Uint32Array([0]),
    sashimiRev: new Uint32Array([0]),
    sashimiDonors: new Uint8Array([0]),
    sashimiAcceptors: new Uint8Array([0]),
  })
  const arcs = computeSashimiArcs({
    ...baseOpts(region0, 0),
    rpcDataMap: new Map([
      [0, region0],
      [1, region1],
    ]),
    visibleRegions: [
      { refName: 'chr1', displayedRegionIndex: 0 },
      { refName: 'chr1', displayedRegionIndex: 1 },
    ],
  })
  expect(arcs).toHaveLength(1)
  expect(arcs[0]!.score).toBe(8)
})

test('a shared junction whose copies disagree on strand still renders once', () => {
  // Same collapsed-intron duplication as above, but the two regions resolved
  // different dominant strands. Keying the merge on the strand as well left two
  // identical arcs stacked on the same pixels — the very
  // per-strand duplication `computeSashimiJunctions` collapses within a region.
  // The heavier copy wins the tint along with the count.
  const region = (count: number, strand: number) =>
    makePileupDataResult({
      sashimiX1: new Uint32Array([100]),
      sashimiX2: new Uint32Array([1100]),
      sashimiCounts: new Uint32Array([count]),
      sashimiFwd: new Uint32Array([strand === 1 ? count : 0]),
      sashimiRev: new Uint32Array([strand === -1 ? count : 0]),
      sashimiDonors: new Uint8Array([0]),
      sashimiAcceptors: new Uint8Array([0]),
    })
  const arcs = computeSashimiArcs({
    ...baseOpts(region(5, -1), 0),
    rpcDataMap: new Map([
      [0, region(5, -1)],
      [1, region(8, 1)],
    ]),
    visibleRegions: [
      { refName: 'chr1', displayedRegionIndex: 0 },
      { refName: 'chr1', displayedRegionIndex: 1 },
    ],
  })
  expect(arcs).toHaveLength(1)
  expect(arcs[0]!.score).toBe(8)
  expect(arcs[0]!.strand).toBe(1)
})

test('a coverage band too short for its scalebar margins labels nothing', () => {
  // clampBandHeight's 20px drag floor does not bind a config-declared height, so
  // coverageHeight can be under 2*YSCALEBAR_LABEL_OFFSET. The subtraction went
  // negative and flipped the arc direction, curving every 'up' arc down through
  // the pileup.
  const arcs = computeSashimiArcs({
    ...baseOpts(makeData([5]), 0),
    coverageHeight: 4,
  })
  expect(arcs[0]!.label).toBeUndefined()
})

describe('a count label whose apex is outside the box is culled', () => {
  // A region is FETCHED by block and blocks run past the viewport, so
  // `rpcDataMap` carries junctions for sequence the reader cannot see. The
  // arcs are the mark's to cull (`linkMark` reaches no instance whose feet miss
  // the canvas); a label is a DOM node, so this is where one off screen stops
  // being reconciled on every pan frame.
  const junction = (x1: number, x2: number) =>
    makePileupDataResult({
      sashimiX1: new Uint32Array([x1]),
      sashimiX2: new Uint32Array([x2]),
      sashimiCounts: new Uint32Array([5]),
      sashimiFwd: new Uint32Array([0]),
      sashimiRev: new Uint32Array([0]),
      sashimiDonors: new Uint8Array([0]),
      sashimiAcceptors: new Uint8Array([0]),
    })

  // the test region draws 1px per bp from x 0, so a bp IS a screen x
  const labelled = (x1: number, x2: number, viewWidthPx: number) => {
    const data = junction(x1, x2)
    return computeSashimiArcs({
      ...baseOpts(data, 0),
      rpcDataMap: new Map([[0, data]]),
      viewWidthPx,
    }).filter(arc => arc.label)
  }

  it('keeps one inside the box and drops one past its right edge', () => {
    expect(labelled(100, 300, 500)).toHaveLength(1)
    expect(labelled(600, 800, 500)).toHaveLength(0)
  })

  it('keeps the arc of a junction whose label is culled', () => {
    const data = junction(600, 800)
    expect(
      computeSashimiArcs({ ...baseOpts(data, 0), viewWidthPx: 500 }),
    ).toHaveLength(1)
  })
})
