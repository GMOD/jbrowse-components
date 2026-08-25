import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { computeSashimiArcs } from './computeOverlay.ts'
import { downJunctionKeys, mergeJunctions } from './junctions.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ComputeSashimiArcsOpts } from './computeOverlay.ts'

// Collapsed introns (plugins/canvas CollapseIntronsDialog) are the one routine
// way a single refName becomes many displayedRegions: each exon is padded by a
// window (100bp by default) and the merged result becomes the region list, so
// the introns between them vanish from screen space entirely. A minus-strand
// gene additionally defaults to `flip`, which marks every region `reversed` and
// lists them in DESCENDING genomic order.
//
// Every other test in this folder projects with an identity `bpToScreenX`, which
// exercises none of that. These build the real piecewise projection instead.

interface TestRegion {
  start: number
  end: number
  reversed?: boolean
}

// Faithful stand-in for `makeBpToScreenX` -> `Base1DUtils.bpToPx`: walk the
// regions in order accumulating their widths, take the FIRST region whose
// [start, end] inclusively contains the coordinate, and offset within it from
// the correct edge. A coordinate in a collapsed intron is in no region at all,
// so it comes back undefined and the whole arc is dropped — there is no pixel
// on screen for it to hang from.
function projectionOver(regions: TestRegion[]) {
  return (_refName: string, bp: number) => {
    let bpSoFar = 0
    for (const r of regions) {
      if (bp >= r.start && bp <= r.end) {
        return bpSoFar + (r.reversed ? r.end - bp : bp - r.start)
      }
      bpSoFar += r.end - r.start
    }
    return undefined
  }
}

// Three exons of one gene, padded by 100bp each, as CollapseIntronsDialog emits
// them. Exons are [1000,1200], [2000,2200], [3000,3200].
const EXONS: TestRegion[] = [
  { start: 900, end: 1300 },
  { start: 1900, end: 2300 },
  { start: 2900, end: 3300 },
]

const FLIPPED_EXONS: TestRegion[] = [...EXONS]
  .map(r => ({ ...r, reversed: true }))
  .reverse()

// The worker emits one entry per junction per region, in absolute genomic bp.
function junctions(specs: [number, number, number][]): PileupDataResult {
  return makePileupDataResult({
    sashimiX1: new Uint32Array(specs.map(s => s[0])),
    sashimiX2: new Uint32Array(specs.map(s => s[1])),
    sashimiCounts: new Uint32Array(specs.map(s => s[2])),
    sashimiStrands: new Int8Array(specs.length),
    sashimiMotifs: new Uint8Array(specs.length),
  })
}

// A read carrying a junction spans it, so a BAM overlap query returns that read
// for EVERY region intersecting its span — including regions the read has no
// aligned bases in. So each of the three exon regions re-emits the same
// junctions, which is exactly the duplication `computeSashimiArcs` merges.
function collapsedOpts(
  perRegion: PileupDataResult[],
  regions = EXONS,
  overrides: Partial<Parameters<typeof computeSashimiArcs>[0]> = {},
) {
  return {
    rpcDataMap: new Map(perRegion.map((d, i) => [i, d])),
    visibleRegions: perRegion.map((_d, i) => ({
      refName: 'chr1',
      displayedRegionIndex: i,
    })),
    bpToScreenX: projectionOver(regions),
    // Wider than the regions above project to (three 400bp windows, so 1200px),
    // so the off-screen cull never fires — these tests are about the merge and
    // the piecewise projection.
    viewWidthPx: 10_000,
    coverageHeight: 100,
    sashimiArcsHeight: 40,
    minSashimiScore: 0,
    hideNonCanonicalJunctions: false,
    downJunctionKeys: new Set<string>(),
    ...overrides,
  }
}

// The side assignment the display would hand these regions in 'auto': merged in
// genomic bp over every loaded region, exactly as `buildSashimiDownKeys` does it
// for the layout. Used where a test is about the two agreeing.
function autoDownKeys(perRegion: PileupDataResult[]) {
  return downJunctionKeys(
    mergeJunctions(
      perRegion.map(data => ({ refName: 'chr1', data })),
      { minSashimiScore: 0, hideNonCanonicalJunctions: false },
    ).values(),
    'auto',
  )
}

// [1200,2000] and [2000,3000] are the two collapsed introns; [1200,3000] skips
// the middle exon.
const ADJACENT_A: [number, number, number] = [1200, 2000, 30]
const ADJACENT_B: [number, number, number] = [2000, 3000, 25]
const EXON_SKIP: [number, number, number] = [1200, 3000, 4]

// WHICH junctions draw, not in what order — `computeSashimiArcs` emits ascending
// by score so the heaviest paints last, and that is `computeOverlay.test.ts`'s to
// pin. The count is half the claim here: three distinct spans AND three arcs is
// "each exactly once", where a set alone would hide a duplicate.
test('every region re-emits the gene’s junctions; each draws exactly once', () => {
  const all = junctions([ADJACENT_A, ADJACENT_B, EXON_SKIP])
  const arcs = computeSashimiArcs(collapsedOpts([all, all, all]))
  expect(arcs).toHaveLength(3)
  expect(new Set(arcs.map(a => `${a.start}-${a.end}`))).toEqual(
    new Set(['1200-2000', '2000-3000', '1200-3000']),
  )
})

test('a collapsed intron leaves its junction a narrow arc, not a zero-width spike', () => {
  // The padding is what keeps this drawable: the junction's donor sits 100bp
  // inside one region and its acceptor 100bp inside the next, so the collapsed
  // intron is 200bp of screen space rather than nothing. Without padding the two
  // endpoints would project to the same x.
  const arcs = computeSashimiArcs(collapsedOpts([junctions([ADJACENT_A])]))
  const [arc] = arcs
  expect(arc!.d).not.toContain('NaN')
  // 1200 is 300bp into region 0; 2000 is 100bp into region 1, which starts at
  // screen 400 -> a 200px span, the two paddings.
  expect(arc!.labelX).toBe(400)
})

test('an exon-skipping junction draws wider and taller than the introns it spans', () => {
  const arcs = computeSashimiArcs(
    collapsedOpts([junctions([ADJACENT_A, ADJACENT_B, EXON_SKIP])]),
  )
  const byStart = new Map(arcs.map(a => [`${a.start}-${a.end}`, a]))
  const skip = byStart.get('1200-3000')!
  const adjacent = byStart.get('1200-2000')!
  // up-mode: a taller arc rises further, so its apex labelY is smaller. Height
  // scales on GENOMIC span, which collapsing does not change, so the nesting
  // order survives the projection.
  expect(skip.labelY).toBeLessThan(adjacent.labelY)
})

test('a junction reaching into a collapsed intron is dropped, not clamped', () => {
  // An unannotated donor at 1500 sits in the intron this view collapsed away,
  // so there is no pixel to anchor that end of the arc to. Drawing it against a
  // clamped edge would assert a splice site at a coordinate not on screen.
  const arcs = computeSashimiArcs(
    collapsedOpts([junctions([[1500, 3000, 9], ADJACENT_A])]),
  )
  expect(arcs.map(a => a.start)).toEqual([1200])
})

test('a flipped (minus-strand) gene keeps arcs in screen order', () => {
  // `flip` reverses the region list and marks each region reversed, so screen x
  // runs against genomic coordinate. `screenSpan` normalizes each arc, so
  // left <= right still holds and the cubic is well formed.
  const arcs = computeSashimiArcs(
    collapsedOpts([junctions([ADJACENT_A, EXON_SKIP])], FLIPPED_EXONS),
  )
  for (const arc of arcs) {
    const [, left, , right] = /M (\S+) (\S+) C .*, (\S+) (\S+)$/.exec(arc.d)!
    expect(Number(left)).toBeLessThanOrEqual(Number(right))
  }
  // and the wider (exon-skipping) junction is still the wider arc on screen
  const spans = new Map(arcs.map(a => [a.end - a.start, a.labelX]))
  expect(spans.size).toBe(2)
})

test('flipped regions still split a crossing pair across bands in auto mode', () => {
  // Sides are assigned in genomic bp, so the reversed projection can't change
  // the decision — which is the point: the strip the layout reserved off the
  // same genomic scan is the strip these arcs draw into. (Screen-space
  // assignment had to normalize the flipped pair by hand, and before it did, it
  // read them as non-interleaving and left both arcs on 'up'.)
  const crossing = junctions([
    [1200, 3000, 20],
    [2000, 3200, 20],
  ])
  const arcs = computeSashimiArcs(
    collapsedOpts([crossing], FLIPPED_EXONS, {
      downJunctionKeys: autoDownKeys([crossing]),
    }),
  )
  const byStart = new Map(arcs.map(a => [a.start, a.side]))
  expect(byStart.get(1200)).not.toBe(byStart.get(2000))
})

test('a junction the layout never reserved for is drawn up, not into the pileup', () => {
  // The down sub-band renders at `sashimiArcsHeight` whether or not the layout
  // reserved it, so an arc placed down without a strip paints over the pileup.
  // Sides come from the layout's own set, so the only junctions that go down are
  // ones it reserved for — an unlisted junction takes the side that needs no
  // strip.
  const arcs = computeSashimiArcs(
    collapsedOpts([junctions([ADJACENT_A])], EXONS, {
      downJunctionKeys: new Set(['chr1:9999:99999']),
    }),
  )
  expect(arcs.map(a => a.side)).toEqual(['up'])
})

test('a flanking region that clips only some supporting reads cannot lower the count', () => {
  // Regions spanning the junction see every read carrying it (the read spans the
  // junction, so it spans them). A region that merely abuts one end sees only
  // the reads whose alignment reaches into it — a strict subset. Each region's
  // count is therefore a lower bound and the max is the best available estimate;
  // taking the first or the last would under-report on a real gene.
  const spanning = junctions([EXON_SKIP])
  const clipping = junctions([[EXON_SKIP[0], EXON_SKIP[1], 1]])
  expect(
    computeSashimiArcs(collapsedOpts([clipping, spanning]))[0]!.score,
  ).toBe(EXON_SKIP[2])
  expect(
    computeSashimiArcs(collapsedOpts([spanning, clipping]))[0]!.score,
  ).toBe(EXON_SKIP[2])
})

test('only the regions actually on screen contribute arcs', () => {
  // rpcDataMap keeps every fetched region, but scrolling one out of view drops
  // it from visibleRegions. A junction only the dropped region reported must go
  // with it rather than keep drawing at a stale x.
  const opts = collapsedOpts([
    junctions([ADJACENT_A]),
    junctions([ADJACENT_B]),
    junctions([EXON_SKIP]),
  ])
  // Sorted, for the same reason as above: the emitted order is by score.
  const ends = (o: ComputeSashimiArcsOpts) =>
    computeSashimiArcs(o)
      .map(a => a.end)
      .toSorted((p, q) => p - q)
  expect(ends(opts)).toEqual([2000, 3000, 3000])
  expect(
    ends({ ...opts, visibleRegions: opts.visibleRegions.slice(0, 2) }),
  ).toEqual([2000, 3000])
})

test('a refName displayed twice anchors arcs to its first occurrence', () => {
  // Not a collapsed-intron shape, but the other way one refName lands in several
  // displayedRegions: `navToLocString('chr1:1-1000 chr1:500-1500')` stores both
  // verbatim (nothing sorts, merges or dedupes displayedRegions). A bp inside
  // the overlap is then painted at two screen x's, and `bpToPx` resolves it to
  // the first — the same first-occurrence rule `resolveNavEndpoint` follows for
  // navigation. Pinned here so sashimi is known to share that convention rather
  // than to have picked one by accident.
  const overlapping: TestRegion[] = [
    { start: 0, end: 1000 },
    { start: 500, end: 1500 },
  ]
  const data = junctions([[700, 1200, 5]])
  const arcs = computeSashimiArcs(
    collapsedOpts([data, data], overlapping, {
      bpToScreenX: projectionOver(overlapping),
    }),
  )
  expect(arcs).toHaveLength(1)
  // 700 resolves in region 0 (x 700), not its second painting inside region 1;
  // 1200 exists only in region 1, at 1000 + (1200 - 500) = 1700.
  expect(arcs[0]!.d).toMatch(/^M 700 \S+ C 700 \S+, 1700 \S+, 1700 \S+$/)
  expect(arcs[0]!.labelX).toBe(1200)
})
