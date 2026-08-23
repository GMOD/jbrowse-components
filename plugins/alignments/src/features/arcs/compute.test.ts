import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { basePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { ARC_COLOR_SHORT_INSERT } from '../../shaders/slang/arc.consts.generated.ts'
import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.consts.generated.ts'
import { namesToBlock } from '../../shared/readNameBlock.ts'
import { nextRefsToTable } from '../../shared/readNextRefs.ts'
import { arcColorLegendCategory, arcPaintRank } from './arcColors.ts'
import { arcsToRegionResult, groupArcsByRef } from './arcRegions.ts'
import { computeArcsByGroup, computeArcsFromPileupData } from './compute.ts'
import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
} from './shapes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ComputedLine, ComputedArc } from './arcTypes.ts'

// Find the junction under test rather than indexing into `arcs`. The array is
// in PAINT order — ascending support, then by dedup key — which is deliberately
// not the order the reads produced the arcs in, so an index pins something no
// assertion here means. Throws with the junctions it did find, so a genuine
// miss still reads like a failed assertion rather than an undefined deref.
function arcAt(arcs: ComputedArc[], p1Bp: number, p2Bp: number) {
  const found = arcs.find(a => a.p1.bp === p1Bp && a.p2.bp === p2Bp)
  if (!found) {
    throw new Error(
      `no arc ${p1Bp}->${p2Bp}; got ${arcs
        .map(a => `${a.p1.bp}->${a.p2.bp}`)
        .join(', ')}`,
    )
  }
  return found
}

function makePileupData(
  overrides: Partial<PileupDataResult>,
): PileupDataResult {
  const n = (overrides.readPositions?.length ?? 0) / 2
  return {
    ...basePileupDataResult(n),
    ...overrides,
  }
}

// A connector tick, for the packing tests below. `support`/`partnerRefNames`
// are what `resolveArcs` coalesces onto one, so the shorthand takes the single
// -read form and the cases that care override it.
function tick(
  refName: string,
  bp: number,
  partner: string,
  support = 1,
): ComputedLine {
  return { x: { refName, bp }, support, partnerRefNames: [partner] }
}

describe('computeArcsFromPileupData', () => {
  test('returns empty result for empty data', () => {
    const result = computeArcsFromPileupData(new Map(), [], {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })
    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('paired-end same-chromosome produces arc', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([2000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.p1.refName).toBe('chr1')
    expect(result.arcs[0]!.p2.refName).toBe('chr1')
    // p1 is the read's own outer (5') edge (1000), not its inner 3' edge
    // (1100) — matching the TLEN span, not the gap between the reads.
    expect(result.arcs[0]!.p1.bp).toBe(1000)
    expect(result.arcs[0]!.p2.bp).toBe(2000)
  })

  test('inter-chromosomal paired-end produces vertical lines when drawInter=true', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr2']),
      readNextPositions: new Uint32Array([5000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines.length).toBe(2)
    expect(result.lines[0]!.x.refName).toBe('chr1')
    expect(result.lines[1]!.x.refName).toBe('chr2')
    // A tick carries no color of its own — every one paints
    // ARC_COLOR_INTERCHROM, which arcLine.slang names directly — so "the
    // interchromosomal slot under the insert-size schemes" is now structural
    // rather than a per-instance value to assert. What still needs pinning is
    // that the slot means the interchrom swatch; see the legend test below.
    expect(arcColorLegendCategory(ARC_COLOR_INTERCHROM, 'insertSize')).toBe(
      'interchrom',
    )
  })

  test('inter-chromosomal draws ticks, not an orientation-colored arc', () => {
    // RL orientation (2) would resolve to the RL slot (6) for a same-chromosome
    // arc; across chromosomes "pair orientation" is meaningless. The pair must
    // therefore leave the arc path entirely and come out as two ticks — which,
    // carrying no color, cannot pick up the RL slot however the scheme is set.
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([2]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr2']),
      readNextPositions: new Uint32Array([5000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines.length).toBe(2)
  })

  test('reads over one translocation coalesce into one counted tick', () => {
    // Three reads naming the same breakpoint. Opaque marks at one x, so N of
    // them draw the same picture as one — and the GPU pass shades its edges by
    // coverage, so the duplicates composited into a wider, harder-edged tick
    // than the opaque Canvas2D mirror strokes. Coalescing is what puts the
    // count somewhere it can be drawn and reported instead of thrown away.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100, 1000, 1100, 1000, 1100]),
      readFlags: new Uint16Array(3).fill(SAM_FLAG_PAIRED),
      readStrands: new Int8Array([1, 1, 1]),
      readInsertSizes: new Float32Array([0, 0, 0]),
      readPairOrientations: new Uint8Array([1, 1, 1]),
      ...namesToBlock(['readA', 'readB', 'readC']),
      ...nextRefsToTable(['chr2', 'chr2', 'chr2']),
      readNextPositions: new Uint32Array([5000, 5000, 5000]),
    })

    const result = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 }],
      {
        colorByType: 'insertSize',
        drawInter: true,
        drawLongRange: true,
      },
    )

    // One tick per breakpoint, each carrying the three reads and naming the
    // chromosome on the OTHER side — which is the direction that makes the pair
    // two different marks rather than a mirrored one.
    expect(result.lines).toEqual([
      {
        x: { refName: 'chr1', bp: 1000 },
        support: 3,
        partnerRefNames: ['chr2'],
      },
      {
        x: { refName: 'chr2', bp: 5000 },
        support: 3,
        partnerRefNames: ['chr1'],
      },
    ])
  })

  // A mate-pair breakpoint is not localized to a base: the mates straddle it, so
  // supporting reads land scattered across roughly a fragment length rather than
  // stacked on a coordinate. `arcKey`'s exact count is therefore ~1 for every
  // one of them, and a floor over it would delete a real translocation as
  // thoroughly as the noise. These pin the windowed count that makes the floor
  // mean "this breakpoint has evidence" instead of "two reads started on the
  // same base".
  describe('minInterchromSupport counts over a window, not a coordinate', () => {
    const regions = [
      { refName: 'chr1', start: 1000, end: 9000, displayedRegionIndex: 0 },
    ]
    // n pairs whose chr1 ends step across `spread` bp and whose chr2 mates step
    // across the same — the shape a real translocation actually has.
    function scattered(
      starts: number[],
      mateBps: number[],
      insertSizeStats?: { upper: number; lower: number },
    ) {
      return makePileupData({
        readPositions: new Uint32Array(starts.flatMap(s => [s, s + 100])),
        readFlags: new Uint16Array(starts.length).fill(SAM_FLAG_PAIRED),
        readStrands: new Int8Array(starts.length).fill(1),
        readInsertSizes: new Float32Array(starts.length),
        readPairOrientations: new Uint8Array(starts.length).fill(1),
        ...namesToBlock(starts.map((_, i) => `read${i}`)),
        ...nextRefsToTable(starts.map(() => 'chr2')),
        readNextPositions: new Uint32Array(mateBps),
        insertSizeStats,
      })
    }
    const run = (data: PileupDataResult, minInterchromSupport: number) =>
      computeArcsFromPileupData(new Map([[0, data]]), regions, {
        colorByType: 'insertSize',
        drawInter: true,
        drawLongRange: true,
        minInterchromSupport,
      })

    // The case the whole thing exists for. Five pairs agreeing on a breakpoint,
    // no two sharing a coordinate: exact-key support is 1 apiece, so a naive
    // floor of 2 would erase all five.
    test('a scattered but agreeing breakpoint survives a floor of 2', () => {
      const data = scattered(
        [2000, 2130, 2260, 2390, 2520],
        [5000, 5140, 5280, 5410, 5550],
        { upper: 600, lower: 100 },
      )
      expect(
        run(data, 1).lines.filter(l => l.x.refName === 'chr1'),
      ).toHaveLength(5)
      // every tick kept, each still at its own read's coordinate — the cluster
      // is not merged, because merging would have to invent a position for it
      expect(
        run(data, 2).lines.filter(l => l.x.refName === 'chr1'),
      ).toHaveLength(5)
    })

    // The other half of that, and the half the arc fix did not reach: a
    // single-chromosome view of a translocation draws TICKS, so counting a
    // tick's reads at its own coordinate left the whole channel reading 1 in
    // the one view a translocation is usually looked at in — while the floor
    // beside it had already been told this breakpoint carries five.
    test('a tick is drawn with its cluster, not with its coordinate', () => {
      const data = scattered(
        [2000, 2130, 2260, 2390, 2520],
        [5000, 5140, 5280, 5410, 5550],
        { upper: 600, lower: 100 },
      )
      expect(run(data, 2).lines.map(l => l.support)).toEqual([
        5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
      ])
    })

    // Half a junction can be reached by more than one, which is the case a
    // cluster's own size cannot report: two events sharing a chr1 base, one
    // pair each. The larger cluster is 1 and two reads are sitting there.
    test('a coordinate two events reach counts both of them', () => {
      const data = makePileupData({
        readPositions: new Uint32Array([2000, 2100, 2000, 2100]),
        readFlags: new Uint16Array(2).fill(SAM_FLAG_PAIRED),
        readStrands: new Int8Array([1, 1]),
        readInsertSizes: new Float32Array([0, 0]),
        readPairOrientations: new Uint8Array([1, 1]),
        ...namesToBlock(['readA', 'readB']),
        ...nextRefsToTable(['chr2', 'chr3']),
        readNextPositions: new Uint32Array([5000, 900_000]),
        insertSizeStats: { upper: 600, lower: 100 },
      })
      const shared = run(data, 1).lines.find(l => l.x.refName === 'chr1')
      expect(shared?.support).toBe(2)
      expect(shared?.partnerRefNames).toEqual(['chr2', 'chr3'])
      // ...and each far side keeps its own event's weight, not the sum
      expect(
        run(data, 1)
          .lines.filter(l => l.x.refName !== 'chr1')
          .map(l => l.support),
      ).toEqual([1, 1])
    })

    // ...and the noise it is meant to remove: same five chr1 positions, but the
    // mates point all over chr2. Agreeing on one side is not evidence.
    test('reads agreeing on one side only are dropped', () => {
      const data = scattered(
        [2000, 2130, 2260, 2390, 2520],
        [5000, 200_000, 900_000, 1_400_000, 3_000_000],
        { upper: 600, lower: 100 },
      )
      expect(
        run(data, 1).lines.filter(l => l.x.refName === 'chr1'),
      ).toHaveLength(5)
      expect(run(data, 2).lines).toEqual([])
    })

    // The window is the library's own fragment length, so the same reads cluster
    // or not depending on the band the fetch computed — a hardcoded window would
    // be wrong on a mate-pair library at one end and an amplicon one at the other.
    test('the window comes from the insert-size band', () => {
      const starts = [2000, 2500, 3000]
      const mates = [5000, 5500, 6000]
      // 500 bp steps: inside a 600 bp fragment, outside a 200 bp one
      expect(
        run(scattered(starts, mates, { upper: 600, lower: 100 }), 2).lines,
      ).not.toEqual([])
      expect(
        run(scattered(starts, mates, { upper: 200, lower: 50 }), 2).lines,
      ).toEqual([])
    })

    // Real supporting pairs and mismapped ones interleave along the source
    // contig — the noise is not conveniently sorted to one end — and one noise
    // pair landing between two supporting ones must not break their cluster.
    // Chaining a single open cluster along `bpA` did exactly that: the noise
    // entry failed the mate test, closed the cluster it interrupted, and the
    // pairs on either side of it were counted as two events plus a singleton.
    test('a noise pair between supporting ones does not split the cluster', () => {
      const data = scattered(
        [2000, 2050, 2100, 2150, 2200],
        [5000, 900_000, 5100, 5150, 5200],
        { upper: 600, lower: 100 },
      )
      // Four pairs agree on this breakpoint; the fifth agrees with nothing.
      expect(
        run(data, 4)
          .lines.filter(l => l.x.refName === 'chr1')
          .map(l => l.x.bp)
          .sort((a, b) => a - b),
      ).toEqual([2000, 2100, 2150, 2200])
    })

    test('support 1 keeps every connection, as before the setting existed', () => {
      const data = scattered([2000], [5000], { upper: 600, lower: 100 })
      expect(run(data, 1).lines).toHaveLength(2)
    })

    // The two-region SV view, which is what read connections are FOR, and where
    // the count is not free to key on the direction a connection arrived in.
    // With both contigs on screen every supporting pair resolves as a mate link,
    // and `mateLinkArc` puts the FIRST-IN-PAIR mate at p1 — so a translocation
    // reaches `clusteredInterchromSupport` as chr1->chr2 from the pairs whose
    // read1 landed on chr1 and as chr2->chr1 from the rest, which is chance and
    // nothing else.
    //
    // Counted per raw direction, this event scored 1 and 1 rather than 2, and
    // the default floor of 2 took all four of its marks off the screen.
    //
    // Both contigs being displayed is also what makes these ARCS rather than
    // ticks, so this doubles as the floor gating the arc branch: `drawInter` and
    // `minInterchromSupport` used to sit inside the tick push, and an arc branch
    // beside them would have inherited neither.
    test('a translocation counts both mate orders as one cluster', () => {
      const chr1 = makePileupData({
        readPositions: new Uint32Array([2000, 2100, 2100, 2200]),
        readFlags: new Uint16Array([
          SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
          SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
        ]),
        readStrands: new Int8Array([1, 1]),
        readInsertSizes: new Float32Array([0, 0]),
        readPairOrientations: new Uint8Array([1, 1]),
        readKeys: ['c1a', 'c1b'],
        ...namesToBlock(['a', 'b']),
        ...nextRefsToTable(['chr2', 'chr2']),
        readNextPositions: new Uint32Array([5000, 5100]),
        insertSizeStats: { upper: 600, lower: 100 },
      })
      // Pair `b` is the same event seen the other way round: its read1 is the
      // chr2 mate, so its connection is emitted chr2->chr1.
      const chr2 = makePileupData({
        readPositions: new Uint32Array([5000, 5100, 5100, 5200]),
        readFlags: new Uint16Array([
          SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
          SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        ]),
        readStrands: new Int8Array([1, 1]),
        readInsertSizes: new Float32Array([0, 0]),
        readPairOrientations: new Uint8Array([1, 1]),
        readKeys: ['c2a', 'c2b'],
        ...namesToBlock(['a', 'b']),
        ...nextRefsToTable(['chr1', 'chr1']),
        readNextPositions: new Uint32Array([2000, 2100]),
        insertSizeStats: { upper: 600, lower: 100 },
      })
      const twoRegions = [
        { refName: 'chr1', start: 1000, end: 9000, displayedRegionIndex: 0 },
        { refName: 'chr2', start: 4000, end: 9000, displayedRegionIndex: 1 },
      ]
      const bothContigs = (settings: {
        drawInter: boolean
        minInterchromSupport?: number
      }) =>
        computeArcsFromPileupData(
          new Map([
            [0, chr1],
            [1, chr2],
          ]),
          twoRegions,
          {
            colorByType: 'insertSize',
            drawLongRange: true,
            ...settings,
          },
        )
      const { crossRegion, lines } = bothContigs({
        drawInter: true,
        minInterchromSupport: 2,
      })
      // One arc per junction, each spanning the two contigs, and no ticks: both
      // feet are displayed, so the tick's whole claim — "a connection to
      // somewhere you cannot see" — is false here.
      expect(lines).toEqual([])
      expect(
        crossRegion
          .map(a => `${a.p1.refName}:${a.p1.bp}-${a.p2.refName}:${a.p2.bp}`)
          .sort(),
      ).toEqual(['chr1:2000-chr2:5000', 'chr2:5100-chr1:2100'])
      // And the settings still gate them: "Show inter-chromosomal pairs" off
      // takes the arcs too, and so does a floor the cluster cannot clear.
      expect(bothContigs({ drawInter: false }).crossRegion).toEqual([])
      expect(
        bothContigs({ drawInter: true, minInterchromSupport: 3 }).crossRegion,
      ).toEqual([])
    })

    // What the windowed count is FOR, beyond the floor it was written for: it is
    // the number an interchromosomal arc is drawn and reported with. Coalescing
    // counts exact coincidences, which for scattered mate-pair support is 1
    // apiece — so every arc over a four-read translocation drew at a lone
    // mismapping's weight and the hover said "Supported by 1 read".
    //
    // The floor is off here (support 1, the menu's `all`), because the count has
    // to be right when nothing is being filtered.
    test('an interchromosomal arc is weighted by its cluster, not by coincidence', () => {
      const names = ['a', 'b', 'c', 'd']
      const chr1Starts = [2000, 2100, 2200, 2300]
      const chr2Starts = [5000, 5100, 5200, 5300]
      const side = (
        starts: number[],
        mateBps: number[],
        mateRef: string,
        pairBit: number,
        keyPrefix: string,
      ) =>
        makePileupData({
          readPositions: new Uint32Array(starts.flatMap(s => [s, s + 100])),
          readFlags: new Uint16Array(names.length).fill(
            SAM_FLAG_PAIRED | pairBit,
          ),
          readStrands: new Int8Array(names.length).fill(1),
          readInsertSizes: new Float32Array(names.length),
          readPairOrientations: new Uint8Array(names.length).fill(1),
          readKeys: names.map(n => `${keyPrefix}${n}`),
          ...namesToBlock(names),
          ...nextRefsToTable(names.map(() => mateRef)),
          readNextPositions: new Uint32Array(mateBps),
          insertSizeStats: { upper: 600, lower: 100 },
        })
      const { crossRegion } = computeArcsFromPileupData(
        new Map([
          [
            0,
            side(chr1Starts, chr2Starts, 'chr2', SAM_FLAG_FIRST_IN_PAIR, 'c1'),
          ],
          [
            1,
            side(chr2Starts, chr1Starts, 'chr1', SAM_FLAG_SECOND_IN_PAIR, 'c2'),
          ],
        ]),
        [
          { refName: 'chr1', start: 1000, end: 9000, displayedRegionIndex: 0 },
          { refName: 'chr2', start: 4000, end: 9000, displayedRegionIndex: 1 },
        ],
        { colorByType: 'insertSize', drawInter: true, drawLongRange: true },
      )
      // Four arcs, no two of them coalescing — and every one carrying the four
      // reads behind the event rather than the one at its own bp.
      expect(crossRegion.map(a => a.support)).toEqual([4, 4, 4, 4])
    })
  })

  // A connection between two chromosomes draws as ONE arc when both of its ends
  // are on screen, and as the two ticks it always drew otherwise. The decision
  // is per connection, so a breakpoint reaching one displayed and one
  // undisplayed chromosome gets an arc AND a tick and both counts stay honest.
  describe('an interchromosomal connection with both feet on screen', () => {
    const bothContigs = [
      { refName: 'chr1', start: 1000, end: 9000, displayedRegionIndex: 0 },
      { refName: 'chr2', start: 4000, end: 9000, displayedRegionIndex: 1 },
    ]
    const chr1Only = [bothContigs[0]!]

    // n pairs on chr1 whose mates are all at the same chr2 coordinate — the
    // split-read shape, where every supporting read agrees to the base.
    function toChr2(starts: number[], mateBp: number) {
      return makePileupData({
        readPositions: new Uint32Array(starts.flatMap(s => [s, s + 100])),
        readFlags: new Uint16Array(starts.length).fill(SAM_FLAG_PAIRED),
        readStrands: new Int8Array(starts.length).fill(1),
        // TLEN 0, which is what SAM sets across refs — and the input gap 1 turns
        // on.
        readInsertSizes: new Float32Array(starts.length),
        readPairOrientations: new Uint8Array(starts.length).fill(1),
        ...namesToBlock(starts.map((_, i) => `read${i}`)),
        ...nextRefsToTable(starts.map(() => 'chr2')),
        readNextPositions: new Uint32Array(starts.map(() => mateBp)),
      })
    }
    const run = (
      regions: typeof bothContigs,
      data: PileupDataResult,
      cloud = false,
    ) =>
      computeArcsFromPileupData(new Map([[0, data]]), regions, {
        colorByType: 'insertSize',
        cloud,
        drawInter: true,
        drawLongRange: true,
      })

    test('draws as one arc, coalesced and support-weighted', () => {
      // Three reads at the SAME two coordinates: `arcKey` folds them into one
      // arc carrying the count, which is the whole value of drawing this as an
      // arc rather than as ticks — one mark whose stroke width is how many
      // molecules say so.
      const { arcs, crossRegion, lines } = run(
        bothContigs,
        toChr2([2000, 2000, 2000], 5000),
      )
      expect(lines).toEqual([])
      // Never in the per-region feed, whatever else is true — `groupArcsByRef`
      // buckets on p1's refName alone.
      expect(arcs).toEqual([])
      expect(crossRegion).toHaveLength(1)
      expect(crossRegion[0]!.support).toBe(3)
      expect(crossRegion[0]!.p1RegionIndex).toBe(0)
      expect(crossRegion[0]!.p2RegionIndex).toBe(1)
    })

    test('painted the interchromosomal colour, not the pair scheme', () => {
      // The colour is now the ONLY channel saying "crosses chromosomes": a
      // same-chromosome cross-region arc crosses the same panel divider and
      // otherwise looks identical.
      const { crossRegion } = run(bothContigs, toChr2([2000], 5000))
      expect(crossRegion[0]!.colorType).toBe(ARC_COLOR_INTERCHROM)
      // A curve, at the band ceiling — arc mode's axis is genomic radius, which
      // this connection has none of, and the ceiling is where a maximally-far
      // same-chromosome pair already clamps.
      expect(crossRegion[0]!.shapeType).toBe(ARC_SHAPE_ARC)
      expect(crossRegion[0]!.yBp).toBe(0xffffffff)
    })

    test('and keeps the ticks when the far chromosome is not displayed', () => {
      const { crossRegion, lines } = run(chr1Only, toChr2([2000], 5000))
      expect(crossRegion).toEqual([])
      // The chr1 tick is drawn; the chr2 one reaches no region and is dropped
      // downstream by `lineTouchesRegion`.
      expect(lines.map(l => `${l.x.refName}:${l.x.bp}`)).toEqual([
        'chr1:2000',
        'chr2:5000',
      ])
    })

    // Gap 1, and a pixel test cannot catch it. In cloud mode `computeArcShape`
    // returns a FLAT shape whose span falls back to the endpoint gap when TLEN
    // is 0 — which it always is across refs — so an interchromosomal arc would
    // carry |chr2bp - chr1bp| as a `maxFlatArcSpanBp`, `arcsYDomainBp` would max
    // it across every group, and `insertSizeTickSections` would PRINT it on the
    // ruler. The read cloud's Y axis IS insert size and this connection has
    // none, so it keeps the ticks.
    test('but the read cloud keeps the ticks, so nothing sizes its axis', () => {
      const { arcs, crossRegion, lines } = run(
        bothContigs,
        toChr2([2000], 5000),
        true,
      )
      expect(crossRegion).toEqual([])
      expect(arcs).toEqual([])
      expect(lines).toHaveLength(2)
    })
  })

  // At depth the concordant domes stop being context and become the picture —
  // 9138 of 9204 arcs on HG002 300x. The setting drops them, and what it must
  // NOT drop is anything carrying evidence, whatever the flags say.
  describe('drawProperPairArcs hides the ordinary pairs and nothing else', () => {
    const regions = [
      { refName: 'chr1', start: 1000, end: 9000, displayedRegionIndex: 0 },
    ]
    // one pair per entry, each with its own flags/orientation
    function pairs(entries: { flags: number; orientation: number }[]) {
      return makePileupData({
        readPositions: new Uint32Array(
          entries.flatMap((_, i) => [1000 + i * 10, 1100 + i * 10]),
        ),
        readFlags: new Uint16Array(entries.map(e => e.flags)),
        readStrands: new Int8Array(entries.length).fill(1),
        readInsertSizes: new Float32Array(entries.length).fill(500),
        readPairOrientations: new Uint8Array(entries.map(e => e.orientation)),
        ...namesToBlock(entries.map((_, i) => `read${i}`)),
        ...nextRefsToTable(entries.map(() => 'chr1')),
        readNextPositions: new Uint32Array(entries.map(() => 3000)),
      })
    }
    const run = (data: PileupDataResult, drawProperPairArcs: boolean) =>
      computeArcsFromPileupData(new Map([[0, data]]), regions, {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: true,
        drawProperPairArcs,
      })

    const PROPER = SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR

    test('an ordinary concordant pair goes, and comes back when re-ticked', () => {
      const data = pairs([{ flags: PROPER, orientation: 1 }])
      expect(run(data, true).arcs).toHaveLength(1)
      expect(run(data, false).arcs).toHaveLength(0)
    })

    test('an abnormal orientation stays even when flagged proper', () => {
      // RR: the aligner set 0x2, the orientation says otherwise, and the
      // orientation is the evidence
      const data = pairs([{ flags: PROPER, orientation: 3 }])
      expect(run(data, false).arcs).toHaveLength(1)
    })

    test('an unflagged pair stays', () => {
      const data = pairs([{ flags: SAM_FLAG_PAIRED, orientation: 1 }])
      expect(run(data, false).arcs).toHaveLength(1)
    })

    // The second condition, and the one that keeps the setting honest: the
    // aligner's verdict and the arc's colour can disagree, and the colour wins.
    // A pair flagged proper whose |TLEN| falls below the band paints
    // short-insert, and taking a pink arc off the screen under a setting about
    // ordinary pairs reads as a bug — it was 42 of the 48 short-insert arcs in
    // the measured window before this condition existed.
    test('a categorized arc stays even when the flags call it proper', () => {
      const data = makePileupData({
        readPositions: new Uint32Array([1000, 1100, 1200, 1300]),
        readFlags: new Uint16Array(2).fill(PROPER),
        readStrands: new Int8Array([1, 1]),
        // one far below the band, one inside it
        readInsertSizes: new Float32Array([20, 500]),
        readPairOrientations: new Uint8Array([1, 1]),
        ...namesToBlock(['short', 'normal']),
        ...nextRefsToTable(['chr1', 'chr1']),
        readNextPositions: new Uint32Array([3000, 3000]),
        insertSizeStats: { upper: 900, lower: 100 },
      })
      // both are flagged proper and FR; only the one the display paints as
      // routine is hidden
      expect(run(data, true).arcs).toHaveLength(2)
      const kept = run(data, false).arcs
      expect(kept).toHaveLength(1)
      expect(kept[0]!.colorType).toBe(ARC_COLOR_SHORT_INSERT)
    })

    // BWA-MEM propagates 0x2 onto supplementary records because the flag
    // describes the pair, not the segment — so a chimeric read carrying
    // split-read evidence must not be filtered away as routine. Same rule, same
    // reason, as the read filter's.
    test('a supplementary segment is never ordinary', () => {
      const data = pairs([
        { flags: PROPER | SAM_FLAG_SUPPLEMENTARY, orientation: 1 },
      ])
      expect(run(data, false).arcs).toHaveLength(1)
    })

    test('the ordinary ones go while the evidence stays, in one feed', () => {
      const data = pairs([
        { flags: PROPER, orientation: 1 },
        { flags: PROPER, orientation: 1 },
        { flags: PROPER, orientation: 4 },
        { flags: SAM_FLAG_PAIRED, orientation: 1 },
      ])
      expect(run(data, true).arcs).toHaveLength(4)
      expect(run(data, false).arcs).toHaveLength(2)
    })
  })

  test('a breakpoint reaching two chromosomes names both, sorted', () => {
    // A complex rearrangement: the same locus on chr1 has mates on chr9 and on
    // chr2. Collapsing that to whichever arrived first would be a confident
    // wrong answer, and arrival order is not stable across runs, so the list is
    // sorted for the same reason `arcs.sort` carries a total tie-break.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100, 1000, 1100]),
      readFlags: new Uint16Array(2).fill(SAM_FLAG_PAIRED),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([1, 1]),
      ...namesToBlock(['readA', 'readB']),
      ...nextRefsToTable(['chr9', 'chr2']),
      readNextPositions: new Uint32Array([5000, 7000]),
    })

    const { lines } = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 }],
      { colorByType: 'insertSize', drawInter: true, drawLongRange: true },
    )

    const atBreakpoint = lines.find(l => l.x.refName === 'chr1')
    expect(atBreakpoint?.support).toBe(2)
    expect(atBreakpoint?.partnerRefNames).toEqual(['chr2', 'chr9'])
  })

  test('ticks are ordered by support, so the heaviest is painted last', () => {
    // Array order is paint order and the ticks are opaque, exactly as for the
    // arcs — and `hitTestArcBand` reads the same order as its tie-break. Two
    // breakpoints, the lighter one fetched first.
    //
    // TWO ACCEPTORS 45 kb apart, not one: a tick's weight is its clusters'
    // (`pushLine`), so three reads pointing at a single chr2 locus are ONE
    // breakpoint however their chr1 ends scatter, and both its ticks then
    // correctly report all three. Distinguishing the ticks by weight takes
    // distinguishing the events, which is what the comment above always claimed
    // this fixture did.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100, 1500, 1600, 1500, 1600]),
      readFlags: new Uint16Array(3).fill(SAM_FLAG_PAIRED),
      readStrands: new Int8Array([1, 1, 1]),
      readInsertSizes: new Float32Array([0, 0, 0]),
      readPairOrientations: new Uint8Array([1, 1, 1]),
      ...namesToBlock(['readA', 'readB', 'readC']),
      ...nextRefsToTable(['chr2', 'chr2', 'chr2']),
      readNextPositions: new Uint32Array([5000, 50_000, 50_000]),
    })

    const { lines } = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 }],
      { colorByType: 'insertSize', drawInter: true, drawLongRange: true },
    )

    expect(
      lines.filter(l => l.x.refName === 'chr1').map(l => l.support),
    ).toEqual([1, 2])
  })

  test('inter-chromosomal produces nothing when drawInter=false', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr2']),
      readNextPositions: new Uint32Array([5000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  // The two settings are orthogonal predicates and the menu offers them as
  // siblings, so either alone has to be able to produce a connection. They were
  // layered instead — `drawLongRange` gated EMISSION and `drawInter` filtered
  // the result — and the case that broke is the ordinary one: a view showing a
  // single chromosome never loads the far mate of a translocation, so unticking
  // off-screen mates silently unticked inter-chromosomal pairs too.
  describe('drawInter and drawLongRange are independent gates', () => {
    const regions = [
      { refName: 'chr1', start: 1000, end: 20000, displayedRegionIndex: 0 },
    ]
    // One read on chr1 whose mate is recorded on chr2, and one whose mate is
    // 8 kb away on chr1 — the two kinds of not-loaded partner, in one fetch, so
    // each setting's answer is visible against the other's.
    const offScreenMates = makePileupData({
      readPositions: new Uint32Array([1000, 1100, 2000, 2100]),
      readFlags: new Uint16Array(2).fill(SAM_FLAG_PAIRED),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([0, 8000]),
      readPairOrientations: new Uint8Array([0, 1]),
      ...namesToBlock(['translocated', 'farMate']),
      ...nextRefsToTable(['chr2', 'chr1']),
      readNextPositions: new Uint32Array([5000, 10000]),
    })
    const run = (drawInter: boolean, drawLongRange: boolean) =>
      computeArcsFromPileupData(new Map([[0, offScreenMates]]), regions, {
        colorByType: 'insertSizeAndOrientation',
        drawInter,
        drawLongRange,
      })

    test('inter alone still draws the translocation ticks', () => {
      const { arcs, lines } = run(true, false)
      // THE REGRESSION: these were empty, because the tick could only be
      // filtered by `drawInter` after `drawLongRange` had agreed to emit it.
      expect(lines.map(l => l.x.refName)).toEqual(['chr1', 'chr2'])
      // and the gate has not leaked — the same-chromosome off-screen mate is
      // still the other setting's to allow.
      expect(arcs).toEqual([])
    })

    test('long-range alone still draws the same-chromosome mate', () => {
      const { arcs, lines } = run(false, true)
      expect(arcs.map(a => [a.p1.bp, a.p2.bp])).toEqual([[2000, 10000]])
      expect(lines).toEqual([])
    })

    test('both off draws neither', () => {
      const { arcs, lines } = run(false, false)
      expect(arcs).toEqual([])
      expect(lines).toEqual([])
    })

    test('both on draws both', () => {
      const { arcs, lines } = run(true, true)
      expect(arcs.map(a => [a.p1.bp, a.p2.bp])).toEqual([[2000, 10000]])
      expect(lines.map(l => l.x.refName)).toEqual(['chr1', 'chr2'])
    })
  })

  test('a split read reaching another chromosome draws on drawInter alone', () => {
    // A translocation supported by an SA segment rather than by a mate. It
    // reaches its far chromosome exactly the way an off-screen mate does, so it
    // takes the same gate — otherwise "Show inter-chromosomal pairs" had no
    // split-read evidence to draw whenever off-screen mates were off.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      ...namesToBlock(['splitRead']),
      readClipAtStart: new Uint32Array([0]),
      readSuppAlignments: ['chr2,9000,+,500S500M,60,0;'],
    })
    const { arcs, lines } = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 1000, end: 20000, displayedRegionIndex: 0 }],
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: true,
        drawLongRange: false,
      },
    )

    expect(arcs).toEqual([])
    expect(lines.map(l => l.x.refName)).toEqual(['chr1', 'chr2'])
  })

  // ONE DONOR, TWO ACCEPTORS — K562's BCR-ABL1 in miniature, which is one donor
  // and 24 acceptors spread over ~154 kb (reference/DEMO_DATASETS.md). A split
  // read knows its breakpoint to the base, so two acceptors 600 bp apart are two
  // junctions and the reader's question is which of them carries the reads.
  //
  // The windowed count was keyed on interchromosomal-ness, which put split
  // evidence under a fragment-length window and chained the acceptors: every
  // mark reported 5, the sum of both. Same rule, same reason, as `arcKey`'s
  // refusal to merge on a tolerance — it cites five distinct events inside
  // 2.3 kb, every gap of which is under the default window.
  test('two split acceptors inside one window stay two junctions', () => {
    const acceptors = [9000, 9000, 9000, 9600, 9600]
    const data = makePileupData({
      readPositions: new Uint32Array(acceptors.flatMap(() => [1000, 1500])),
      readFlags: new Uint16Array(acceptors.length),
      readStrands: new Int8Array(acceptors.length).fill(1),
      ...namesToBlock(acceptors.map((_, i) => `split${i}`)),
      readClipAtStart: new Uint32Array(acceptors.length),
      readSuppAlignments: acceptors.map(bp => `chr2,${bp},+,500S500M,60,0;`),
    })
    const { lines } = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 1000, end: 20000, displayedRegionIndex: 0 }],
      { colorByType: 'insertSize', drawInter: true, drawLongRange: true },
    )

    // each acceptor carries its own reads...
    expect(
      lines
        .filter(l => l.x.refName === 'chr2')
        .map(l => [l.x.bp, l.support])
        .sort((a, b) => a[0]! - b[0]!),
    ).toEqual([
      // 8999/9599, not 9000/9600: an SA tag's POS is 1-based and these are the
      // interbase coordinates it converts to.
      [8999, 3],
      [9599, 2],
    ])
    // ...and the donor, which every read really does share to the base, carries
    // all five — the distinct-cluster sum, with the two acceptors' clusters both
    // reaching it.
    expect(lines.find(l => l.x.refName === 'chr1')?.support).toBe(5)
  })

  test('single-region reads with drawLongRange=false are skipped', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([2000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: false,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('mate-unmapped reads are skipped for paired-end arcs', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_MATE_UNMAPPED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      ...namesToBlock(['readA']),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('lone on-screen secondary alignment draws no mate arc', () => {
    // A secondary alignment (0x100) survives the default flag filter (1540 omits
    // 0x100), so a multimapper whose primary + mate are off-screen can be the
    // lone on-screen entry. It is an alternate mapping, not the read's true
    // locus, and carries unset TLEN / orientation — no mate link should anchor
    // at it, matching how every other path drops secondary alignments.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_SECONDARY]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([2000]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })

    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('supplementary alignment SA tag produces arcs for long reads', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      ...namesToBlock(['readA']),
      readSuppAlignments: ['chr1,3001,+,200M,60,0;'],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.p1.bp).toBe(1500)
    expect(result.arcs[0]!.p2.bp).toBe(3000)
  })

  test('lone paired read with a mapped mate AND an SA tag draws both links', () => {
    // Mate mapped off-screen at chr1:2000 and a supplementary block at
    // chr1:3001. Both the mate link and the SA split junction must be emitted —
    // the mate being off-screen must not suppress the within-read junction.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([2000]),
      readSuppAlignments: ['chr1,3001,+,200M,60,0;'],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    // The mate link uses the read's own outer (5') edge (1000), matching its
    // TLEN span; the split junction still leaves from its 3' edge (1500) to
    // the supplementary block's 5' edge (3000).
    const byP2 = new Map(result.arcs.map(a => [a.p2.bp, a.p1.bp]))
    expect(byP2.get(2000)).toBe(1000)
    expect(byP2.get(3000)).toBe(1500)
  })

  test('malformed SA tag entries are skipped, not emitted as NaN arcs', () => {
    // Three semicolon-separated entries: one truncated (3 fields), one with a
    // placeholder CIGAR, one with a non-numeric position. None should produce
    // an arc; the unrelated trailing valid entry should be the only one drawn.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      ...namesToBlock(['readA']),
      readSuppAlignments: [
        'chr1,3001,+;chr1,4001,+,*,60,0;chr1,abc,+,200M,60,0;chr1,5001,+,200M,60,0;',
      ],
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    // One arc per consecutive SA-chain pair; the three malformed entries are
    // skipped, leaving only primary→(chr1:5001..5201) → 1 arc.
    expect(result.arcs).toHaveLength(1)
    expect(result.arcs[0]!.p1.bp).toBe(1500)
    expect(result.arcs[0]!.p2.bp).toBe(5000)
    expect(Number.isNaN(result.arcs[0]!.p2.bp)).toBe(false)
  })

  test('cross-region reads (same name in two regions) produce arcs', () => {
    const data0 = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
    })
    const data1 = makePileupData({
      readPositions: new Uint32Array([5000, 5100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
    })

    // Mates are distinct records: distinct fileOffsets => distinct f.id(). (The
    // helper's per-array id${i} would collide both on 'id0', which can't happen
    // in real data and would trip the same-read cross-region dedup.)
    data0.readKeys[0] = 'readA-mate1'
    data1.readKeys[0] = 'readA-mate2'

    const rpcDataMap = new Map([
      [0, data0],
      [1, data1],
    ])
    const regions = [
      { refName: 'chr1', start: 1000, end: 2000, displayedRegionIndex: 0 },
      { refName: 'chr1', start: 5000, end: 6000, displayedRegionIndex: 1 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: false,
    })

    // The pair is found across the two regions — which is what this test is
    // about — and lands in the CROSS-REGION half, since its feet resolve to two
    // different displayed regions and no per-region pass can join them.
    expect(result.arcs).toHaveLength(0)
    expect(result.crossRegion.length).toBe(1)
    // Each mate's own outer (5') edge (1000, 5000), not its inner 3' edge.
    expect(result.crossRegion[0]!.p1.bp).toBe(1000)
    expect(result.crossRegion[0]!.p2.bp).toBe(5000)
    expect(result.crossRegion[0]!.p1RegionIndex).toBe(0)
    expect(result.crossRegion[0]!.p2RegionIndex).toBe(1)
  })

  test('orientation coloring: RL gives colorType 6', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500]),
      readPairOrientations: new Uint8Array([2]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([500]),
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'orientation',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.colorType).toBe(6)
  })

  test('insert size coloring uses worker-provided insertSizeStats', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([10000]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([500]),
      insertSizeStats: { upper: 500, lower: 100 },
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSize',
      drawInter: false,
      drawLongRange: true,
    })

    expect(result.arcs.length).toBe(1)
    // tlen=10000 > upper=500 → colorType 1 (too long)
    expect(result.arcs[0]!.colorType).toBe(1)
  })

  test('very-long-range pairs are plain arcs (no bp-based line conversion)', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([500000]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([500000]),
      // The color comes from TLEN against this band and from nothing else, so
      // the band has to be here for the pair to read as a long insert. It used
      // not to be: the span alone repainted a far-apart pair long-insert, which
      // is the rule this file's `getArcColorType` no longer has (the read fills
      // never had it, so the two keyed the same pair differently).
      insertSizeStats: { upper: 500, lower: 100 },
    })

    const rpcDataMap = new Map([[0, data]])
    const regions = [
      { refName: 'chr1', start: 0, end: 600000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(rpcDataMap, regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })

    // No bp threshold reshapes far pairs: still a single arc (the renderer draws
    // it as near-vertical lines at this zoom), colored as a long insert.
    expect(result.lines).toEqual([])
    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.shapeType).toBe(ARC_SHAPE_ARC)
    expect(result.arcs[0]!.colorType).toBe(1)
  })

  test('long-range abnormal-orientation pair keeps its orientation color, not long-insert', () => {
    // A far-apart RL (everted) pair is a classic large-SV signature: its
    // orientation is the real signal, so the long-range/large-insert span must
    // not repaint it long-insert (colorType 1). It keeps RL (6) under both the
    // orientation and insertSizeAndOrientation modes — matching the read fill.
    const mkData = () =>
      makePileupData({
        readPositions: new Uint32Array([0, 100]),
        readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
        readStrands: new Int8Array([1]),
        readInsertSizes: new Float32Array([500000]),
        readPairOrientations: new Uint8Array([2]),
        ...namesToBlock(['readA']),
        ...nextRefsToTable(['chr1']),
        readNextPositions: new Uint32Array([500000]),
      })
    const regions = [
      { refName: 'chr1', start: 0, end: 600000, displayedRegionIndex: 0 },
    ]

    for (const colorByType of [
      'orientation',
      'insertSizeAndOrientation',
    ] as const) {
      const result = computeArcsFromPileupData(
        new Map([[0, mkData()]]),
        regions,
        {
          colorByType,
          drawInter: false,
          drawLongRange: true,
        },
      )
      expect(result.arcs.length).toBe(1)
      expect(result.arcs[0]!.colorType).toBe(6)
    }
  })

  test('read cloud colors by orientation like arcs (insertSizeAndOrientation)', () => {
    const mkData = (orient: number) =>
      makePileupData({
        readPositions: new Uint32Array([0, 100]),
        readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
        readStrands: new Int8Array([1]),
        readInsertSizes: new Float32Array([500]),
        readPairOrientations: new Uint8Array([orient]),
        ...namesToBlock(['readA']),
        ...nextRefsToTable(['chr1']),
        readNextPositions: new Uint32Array([500]),
      })
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      cloud: true,
      drawInter: false,
      drawLongRange: true,
    }
    const run = (orient: number) =>
      computeArcsFromPileupData(new Map([[0, mkData(orient)]]), regions, opts)

    // LR/normal (no stats) → default arc slot 0
    const lr = run(1)
    expect(lr.arcs).toHaveLength(1)
    expect(lr.arcs[0]!.colorType).toBe(0)
    // Flat shape + Y ≈ |tlen| (read cloud applies ±8% jitter)
    expect(lr.arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    expect(lr.arcs[0]!.yBp).toBeGreaterThanOrEqual(460)
    expect(lr.arcs[0]!.yBp).toBeLessThanOrEqual(540)

    // Aberrant orientations map to the arc palette: RL→6 (teal), RR→5 (navy),
    // FF→4 (green) — same getOrientationColorIndex as arc mode.
    expect(run(2).arcs[0]!.colorType).toBe(6)
    expect(run(3).arcs[0]!.colorType).toBe(5)
    expect(run(4).arcs[0]!.colorType).toBe(4)
  })

  test('read cloud carries the true insert size beside the jittered Y', () => {
    // `yBp` is where the line draws — |tlen| times a deterministic factor in
    // [0.92, 1.08], so coincident pairs separate instead of stacking. `spanBp`
    // is what that height MEANS, and it is the one a tooltip may report: the
    // hover used to read `yBp` back and call it the template length.
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([10000]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([9900]),
    })
    const arc = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 0, end: 20000, displayedRegionIndex: 0 }],
      {
        colorByType: 'insertSizeAndOrientation',
        cloud: true,
        drawInter: false,
        drawLongRange: true,
      },
    ).arcs[0]!
    expect(arc.shapeType).toBe(ARC_SHAPE_FLAT)
    expect(arc.spanBp).toBe(10000)
    // The jitter really is applied to the drawn Y — otherwise this test would
    // pass with the two fields collapsed back into one.
    expect(arc.yBp).not.toBe(arc.spanBp)
    expect(arc.yBp).toBeGreaterThanOrEqual(9200)
    expect(arc.yBp).toBeLessThanOrEqual(10800)
  })

  test('read cloud keeps two same-endpoint pairs that plot at different Y', () => {
    // Coalescing is keyed on what a connection DRAWS, and in read cloud that
    // includes a Y taken from TLEN rather than from the endpoints. An
    // outward-facing (RL) pair anchors on its mates' inner edges while TLEN
    // spans their outer ones, so two RL pairs can share both endpoints and
    // carry different template lengths — two lines at two heights. Keyed
    // without `yBp` they merged, losing one line and crediting the survivor
    // with both reads.
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100, 0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED, SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([4000, 7000]),
      readPairOrientations: new Uint8Array([2, 2]),
      ...namesToBlock(['readA', 'readB']),
      ...nextRefsToTable(['chr1', 'chr1']),
      readNextPositions: new Uint32Array([5000, 5000]),
    })
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 0, end: 20000, displayedRegionIndex: 0 }],
      {
        colorByType: 'orientation',
        cloud: true,
        drawInter: false,
        drawLongRange: true,
      },
    )
    expect(arcs).toHaveLength(2)
    expect(arcs.map(a => a.support)).toEqual([1, 1])
    expect(arcs.map(a => a.spanBp).sort((a, b) => a - b)).toEqual([4000, 7000])
    // Identical endpoints, so the endpoint-derived half of the key agrees and
    // only the Y separates them.
    expect(arcs[0]!.p1.bp).toBe(arcs[1]!.p1.bp)
    expect(arcs[0]!.p2.bp).toBe(arcs[1]!.p2.bp)
  })

  test('identical read-cloud pairs still coalesce into one supported arc', () => {
    // The converse of the test above, and the reason `yBp` can be keyed on at
    // all: the jitter hashes the endpoints, so two genuinely identical pairs
    // land on the same Y and still sum.
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100, 0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED, SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([4000, 4000]),
      readPairOrientations: new Uint8Array([2, 2]),
      ...namesToBlock(['readA', 'readB']),
      ...nextRefsToTable(['chr1', 'chr1']),
      readNextPositions: new Uint32Array([5000, 5000]),
    })
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, data]]),
      [{ refName: 'chr1', start: 0, end: 20000, displayedRegionIndex: 0 }],
      {
        colorByType: 'orientation',
        cloud: true,
        drawInter: false,
        drawLongRange: true,
      },
    )
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.support).toBe(2)
  })

  test('read cloud colors long inserts red like arcs (slot 1)', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([0, 100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([10000]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([500]),
      insertSizeStats: { upper: 500, lower: 100 },
    })
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation' as const,
      cloud: true,
      drawInter: false,
      drawLongRange: true,
    })
    // tlen 10000 > upper 500 → long-insert slot 1 (red), not a read-cloud DUP color
    expect(result.arcs).toHaveLength(1)
    expect(result.arcs[0]!.colorType).toBe(1)
  })

  test('read cloud drops concordant FR pairs within insert-size stats band', () => {
    const mkPair = (tlen: number) =>
      makePileupData({
        readPositions: new Uint32Array([0, 100]),
        readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
        readStrands: new Int8Array([1]),
        readInsertSizes: new Float32Array([tlen]),
        readPairOrientations: new Uint8Array([1]),
        ...namesToBlock(['readA']),
        ...nextRefsToTable(['chr1']),
        readNextPositions: new Uint32Array([500]),
        insertSizeStats: { upper: 500, lower: 100 },
      })
    const regions = [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      cloud: true,
      drawInter: false,
      drawLongRange: true,
    }
    // tlen=300 ∈ [100, 500] FR → dropped
    expect(
      computeArcsFromPileupData(new Map([[0, mkPair(300)]]), regions, opts)
        .arcs,
    ).toHaveLength(0)
    // tlen=10000 > upper → kept (discordant long-insert)
    expect(
      computeArcsFromPileupData(new Map([[0, mkPair(10000)]]), regions, opts)
        .arcs,
    ).toHaveLength(1)
  })

  test('read cloud plots an unset-TLEN pair at its genomic span, not on the baseline', () => {
    // TLEN 0 is SAM's "information unavailable" encoding, which discordant and
    // supplementary records routinely carry. Trusting it parked exactly the
    // pairs read cloud exists to surface at Y=0 — flat on the axis origin,
    // indistinguishable from a 1bp insert. The span is the trustworthy signal,
    // the same reason getArcColorType prefers it for the long-insert override.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([9000]),
    })
    const regions = [
      { refName: 'chr1', start: 0, end: 10000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      cloud: true,
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    // 8000bp span, ±8% jitter — well clear of the baseline either way.
    expect(arcs[0]!.yBp).toBeGreaterThan(8000 * 0.9)
    expect(arcs[0]!.yBp).toBeLessThan(8000 * 1.1)
  })

  test('read cloud keeps an unset-TLEN pair even when the stats band floors at 0', () => {
    // `getInsertSizeStats` clamps `lower` to `max(0, center - spread)`, so a
    // library with a wide spread hands back lower=0. An unset TLEN then lands
    // inside the band on no evidence, and the concordant-FR filter dropped the
    // pair — making the cloud's contents depend on the fetched set's MAD. The
    // test above covers the same read WITHOUT stats, where the filter is
    // short-circuited, which is why this went unnoticed.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['chr1']),
      readNextPositions: new Uint32Array([9000]),
      insertSizeStats: { upper: 500, lower: 0 },
    })
    const regions = [
      { refName: 'chr1', start: 0, end: 10000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      cloud: true,
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    // Still plotted at the breakpoint gap, not the (untrustworthy) TLEN.
    expect(arcs[0]!.yBp).toBeGreaterThan(8000 * 0.9)
  })

  test('a lone paired read with no recorded mate locus draws no arc', () => {
    // RNEXT `*` / PNEXT 0 (BAM next_refid -1) on a record that still claims a
    // mapped mate: nothing locates the other end. Substituting this read's own
    // refName and bp 0 drew a full-chromosome arc down to the origin.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readA']),
      ...nextRefsToTable(['']),
      readNextPositions: new Uint32Array([0]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 10000, displayedRegionIndex: 0 },
    ]
    const result = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: true,
      drawLongRange: true,
    })
    expect(result.arcs).toEqual([])
    expect(result.lines).toEqual([])
  })

  test('read cloud SA-tag arcs color by strand like arcs (inversion→7, same-strand→8)', () => {
    const mkSplit = (primaryStrand: number, saStrand: '+' | '-') =>
      makePileupData({
        readPositions: new Uint32Array([1000, 1500]),
        readFlags: new Uint16Array([0]),
        readStrands: new Int8Array([primaryStrand]),
        readInsertSizes: new Float32Array([0]),
        readPairOrientations: new Uint8Array([0]),
        ...namesToBlock(['readA']),
        readSuppAlignments: [`chr1,3001,${saStrand},200M,60,0;`],
      })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      cloud: true,
      drawInter: false,
      drawLongRange: true,
    }
    // Same strand (+/+) → split-deletion slot 8 (yellow)
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '+')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(8)
    // Opposite strand (+/-) → split-inversion slot 7 (magenta)
    expect(
      computeArcsFromPileupData(new Map([[0, mkSplit(1, '-')]]), regions, opts)
        .arcs[0]!.colorType,
    ).toBe(7)
  })

  test('read cloud in-view split read (primary + supplementary entries) is dashed at the gap span', () => {
    // The default flag filter does not exclude SUPPLEMENTARY (2048), so an
    // in-view split read arrives as two entries sharing a name — the
    // multi-entry path, not the single-entry SA-tag path. It must render
    // identically: dashed, at the gap span, never collapsed to the baseline
    // by the supplementary's tlen=0.
    const mkInViewSplit = (s1: number, s2: number) =>
      makePileupData({
        readPositions: new Uint32Array([1000, 1500, 3001, 3201]),
        readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
        readStrands: new Int8Array([s1, s2]),
        readInsertSizes: new Float32Array([0, 0]),
        readPairOrientations: new Uint8Array([0, 0]),
        ...namesToBlock(['readA', 'readA']),
      })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const opts = {
      colorByType: 'insertSizeAndOrientation' as const,
      cloud: true,
      drawInter: false,
      drawLongRange: true,
    }

    const inv = computeArcsFromPileupData(
      new Map([[0, mkInViewSplit(1, -1)]]),
      regions,
      opts,
    ).arcs
    expect(inv).toHaveLength(1)
    // dashed split shape, not solid ARC_SHAPE_FLAT
    expect(inv[0]!.shapeType).toBe(ARC_SHAPE_FLAT_SPLIT)
    // Y is the full breakpoint gap span (~1700, ±8% jitter), so a split SV sits
    // at the same ruler height as an equivalent-span discordant pair — not half
    // of it (~850), and never collapsed to 0 by the supplementary's tlen.
    expect(inv[0]!.yBp).toBeGreaterThan(1400)
    expect(inv[0]!.yBp).toBeLessThan(1850)
    // opposite strands → split-inversion slot 7 (magenta arc)
    expect(inv[0]!.colorType).toBe(7)

    // same strands → split-deletion slot 8, still dashed split
    const del = computeArcsFromPileupData(
      new Map([[0, mkInViewSplit(1, 1)]]),
      regions,
      opts,
    ).arcs
    expect(del[0]!.shapeType).toBe(ARC_SHAPE_FLAT_SPLIT)
    expect(del[0]!.colorType).toBe(8)
  })

  test('in-view split inversion connects a2↔b2, not a2↔b1', () => {
    // Primary fwd a=[1000,1500], supplementary rev b=[3001,3201]. The read
    // traverses a1→a2→b2→b1, so the junction joins a.end (a2=1500) to b.end
    // (b2=3201) — the breakpoint — not b.start (b1=3001), the far edge.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500, 3001, 3201]),
      readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
      readStrands: new Int8Array([1, -1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([0, 0]),
      ...namesToBlock(['readA', 'readA']),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.p1.bp).toBe(1500) // a.end (a2)
    expect(arcs[0]!.p2.bp).toBe(3201) // b.end (b2), not 3001 (b1)
  })

  test('SA-tag split inversion connects a.end↔b.end (b rev)', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      ...namesToBlock(['readA']),
      readSuppAlignments: ['chr1,3001,-,200M,60,0;'],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.p1.bp).toBe(1500) // primary fwd: a.end
    expect(arcs[0]!.p2.bp).toBe(3200) // SA rev (pos 3001→start 3000, end 3200): b.end
  })

  test('canonicalRefName maps an SA-tag refName so a same-chr split reads as an arc, not an inter-chromosomal line', () => {
    // The assembly uses `1`, so fetched reads carry `1`; the BAM's SA tag uses
    // its own naming `chr1`. Without normalization the junction fails the
    // p1Ref===p2Ref test and is misclassified inter-chromosomal (a connector
    // line); the normalizer collapses `chr1`→`1` so it's the intended arc.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500]),
      readFlags: new Uint16Array([0]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([0]),
      ...namesToBlock(['readA']),
      readSuppAlignments: ['chr1,3001,-,200M,60,0;'],
    })
    const regions = [
      { refName: '1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const base = {
      colorByType: 'insertSizeAndOrientation' as const,
      drawInter: true,
      drawLongRange: true,
    }

    const raw = computeArcsFromPileupData(new Map([[0, data]]), regions, base)
    expect(raw.arcs).toHaveLength(0)
    expect(raw.lines.length).toBeGreaterThan(0)

    const norm = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      ...base,
      canonicalRefName: r => (r === 'chr1' ? '1' : r),
    })
    expect(norm.arcs).toHaveLength(1)
    expect(norm.arcs[0]!.p1.refName).toBe('1')
    expect(norm.arcs[0]!.p2.refName).toBe('1')
    expect(norm.lines).toHaveLength(0)
  })

  test('3 split segments chain in read order (clip), not genomic order', () => {
    // Genomic order is seg0<seg1<seg2, but clip-at-start makes read order
    // seg1→seg2→seg0, so the two junctions are (seg1,seg2) and (seg2,seg0).
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1200, 2000, 2200, 3000, 3200]),
      readFlags: new Uint16Array([
        SAM_FLAG_SUPPLEMENTARY,
        0,
        SAM_FLAG_SUPPLEMENTARY,
      ]),
      readStrands: new Int8Array([1, 1, 1]),
      readInsertSizes: new Float32Array([0, 0, 0]),
      readPairOrientations: new Uint8Array([0, 0, 0]),
      ...namesToBlock(['readA', 'readA', 'readA']),
      readClipAtStart: new Uint32Array([200, 0, 100]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 4000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(2)
    // seg1.end (2200) → seg2.start (3000), and seg2.end (3200) → seg0.start
    // (1000). Looked up rather than indexed: see arcAt.
    arcAt(arcs, 2200, 3000)
    arcAt(arcs, 3200, 1000)
  })

  // A read overhanging the region's left edge: its fwd flank starts at 100,
  // well left of the region (900), and its reverse middle segment sits on
  // screen. The flank and the twin named by the middle's SA tag are the same
  // segment, so they must fuse to one chain entry — otherwise the two
  // same-strand copies land adjacent and emit a spurious "deletion" self-arc
  // (slot 8, the orange that used to smear across sv_read_arcs). Fusing is what
  // leaves only the real fwd→rev inversion junction (slot 7).
  //
  // Both cases below carry the flank's TRUE start (100), which is what
  // buildBaseReadArrays now emits; a start clipped to the region (900) would
  // not match the SA twin's 100 and would resurrect the spurious arc. The SA
  // CIGARs are reference-orientation, like an aligner's: the reverse middle's
  // read-start clip (1000) is its TRAILING clip, so its strand-corrected clip
  // matches the fetched record's — which the fusion also keys on, or a read
  // circling one locus would fold its passes together (segLocusKey).
  test.each([
    // clip 38: the flank is preceded by a 38bp soft clip
    { name: 'clipped flank', clip: 38, flankCigar: '38S1900M' },
    // clip 0: the flank IS the read's first segment — the common case for a
    // forward read hanging off the left edge, where the twin pair shares the
    // clip every first segment has
    { name: 'first-segment flank', clip: 0, flankCigar: '1900M' },
  ])(
    'fuses an off-region-edge segment with its SA twin ($name)',
    ({ clip, flankCigar }) => {
      const data = makePileupData({
        // flank (fwd, true start 100, reaching into the region) + rev middle
        readPositions: new Uint32Array([100, 2000, 2001, 2200]),
        readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
        readStrands: new Int8Array([1, -1]),
        readInsertSizes: new Float32Array([0, 0]),
        readPairOrientations: new Uint8Array([0, 0]),
        ...namesToBlock(['readT', 'readT']),
        readClipAtStart: new Uint32Array([clip, 1000]),
        readSuppAlignments: [
          // flank's SA names the reverse middle segment
          'chr1,2002,-,200M1000S,60,0;',
          // middle's SA names the flank at its true start 100
          `chr1,101,+,${flankCigar},60,0;`,
        ],
      })
      const regions = [
        { refName: 'chr1', start: 900, end: 2300, displayedRegionIndex: 0 },
      ]
      const { arcs } = computeArcsFromPileupData(
        new Map([[0, data]]),
        regions,
        {
          colorByType: 'insertSizeAndOrientation',
          drawInter: false,
          drawLongRange: true,
        },
      )
      // no spurious same-strand (deletion, slot 8) self-arc
      expect(arcs.every(a => a.colorType !== 8)).toBe(true)
      // just the one fwd→rev inversion junction (slot 7), on the breakpoint
      expect(arcs).toHaveLength(1)
      expect(arcs[0]!.colorType).toBe(7)
      expect([arcs[0]!.p1.bp, arcs[0]!.p2.bp]).toEqual([2000, 2200])
    },
  )

  // The read's true start survives into the arc endpoint. Read order here is
  // middle (clip 0) then fwd flank (clip 1000), so the flank contributes its
  // read-LEADING edge — its `start`. A start clipped to the region would put
  // this endpoint at 900, the region edge, instead of the true 100.
  test('an off-region-edge segment anchors its arc at its true start', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([100, 2000, 2001, 2200]),
      readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
      readStrands: new Int8Array([1, -1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([0, 0]),
      ...namesToBlock(['readY', 'readY']),
      readClipAtStart: new Uint32Array([1000, 0]),
      readSuppAlignments: [
        // reference-orientation: the reverse middle's read-start clip of 0 is a
        // trailing clip of 0, its read-END clip is the leading 1000S
        'chr1,2002,-,1000S200M,60,0;',
        'chr1,101,+,1000S1900M,60,0;',
      ],
    })
    const regions = [
      { refName: 'chr1', start: 900, end: 2300, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.colorType).toBe(7)
    expect([arcs[0]!.p1.bp, arcs[0]!.p2.bp]).toEqual([2001, 100])
  })

  test('multi-entry split read steps through an off-screen segment, not across it', () => {
    // Two on-screen segments A (clip 0, chr1:1000) and C (clip 200, chr1:5000)
    // of one unpaired read; the middle segment B (clip 100) maps off-screen at
    // chr1:9000 and is known only from the SA tags. The chain must be A→B→C, not
    // a single misleading A→C join across the hidden segment.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1200, 5000, 5200]),
      readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([0, 0]),
      ...namesToBlock(['readA', 'readA']),
      readClipAtStart: new Uint32Array([0, 200]),
      readSuppAlignments: [
        // A's SA names B (off-screen) and C
        'chr1,9001,+,100S200M,60,0;chr1,5001,+,200S200M,60,0;',
        // C's SA names A and B (off-screen)
        'chr1,1001,+,200M200S,60,0;chr1,9001,+,100S200M,60,0;',
      ],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]
    const withLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: true,
      },
    ).arcs
    // A→B (1200→9000) and B→C (9200→5000); never the direct A→C (1200→5000)
    expect(withLongRange.map(a => [a.p1.bp, a.p2.bp])).toEqual([
      [1200, 9000],
      [9200, 5000],
    ])
    expect(withLongRange.some(a => a.p1.bp === 1200 && a.p2.bp === 5000)).toBe(
      false,
    )

    // with long-range off, the flanking segments are not read-adjacent, so
    // nothing is drawn rather than the misleading direct join
    const withoutLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: false,
      },
    ).arcs
    expect(withoutLongRange).toHaveLength(0)
  })

  test('paired + SA-split: split junction colored by its own strands, not pair', () => {
    // read1 (first-in-pair) is SA-split fwd→rev — an inversion junction — and
    // read2 (second-in-pair) is its mate. The dataset is paired (global
    // hasPaired=true), but the split junction must still color by its segment
    // strands (split-inversion slot 7), not fall into the paired insert-size
    // branch.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1200, 3000, 3200, 5000, 5200]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ]),
      readStrands: new Int8Array([1, -1, -1]),
      readInsertSizes: new Float32Array([600, 0, 600]),
      readPairOrientations: new Uint8Array([1, 0, 1]),
      ...namesToBlock(['readA', 'readA', 'readA']),
      readClipAtStart: new Uint32Array([0, 100, 0]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    expect(arcs).toHaveLength(2)
    // read1's fwd→rev split junction (a.end 1200 → b.end 3200), colored
    // split-inversion (7) by its own strands — NOT the paired insert-size
    // default (0) the global hasPaired branch would have produced.
    expect(arcAt(arcs, 1200, 3200).colorType).toBe(7)
    // and the read1↔read2 mate link, still colored by pair semantics. Each
    // mate's own outer edge: fwd read1's start (1000), rev read2's end (5200).
    arcAt(arcs, 1000, 5200)
  })

  test('mate-unmapped paired split read still draws its split junction', () => {
    // read1 is paired but its mate is unmapped (so absent from the fetch), and it
    // is itself SA-split into a primary + supplementary — both flagged
    // mate-unmapped. Both segments are on screen, so the fwd→rev inversion
    // junction must draw even with drawLongRange off, and no mate link is emitted
    // (no second mate present). Regression guard: partitionReadGroup used to drop
    // mate-unmapped reads, deleting this junction while the read fill still
    // colored it a split.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1200, 3000, 3200]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_MATE_UNMAPPED,
        SAM_FLAG_PAIRED |
          SAM_FLAG_FIRST_IN_PAIR |
          SAM_FLAG_SUPPLEMENTARY |
          SAM_FLAG_MATE_UNMAPPED,
      ]),
      readStrands: new Int8Array([1, -1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([0, 0]),
      ...namesToBlock(['readA', 'readA']),
      readClipAtStart: new Uint32Array([0, 100]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: false,
    })
    // Just the fwd→rev split-inversion junction (a.end 1200 → b.end 3200,
    // slot 7), no mate link.
    expect(arcs).toHaveLength(1)
    expect([arcs[0]!.p1.bp, arcs[0]!.p2.bp]).toEqual([1200, 3200])
    expect(arcs[0]!.colorType).toBe(7)
  })

  test('split read whose mate is off screen still draws the off-screen mate link', () => {
    // One mate on screen as TWO segments (primary + supplementary); the other
    // mate is off screen at chr1:8000. Regression guard: the off-screen mate
    // link used to be reached only through an `entries.length === 1` branch, so
    // a read that happened to carry a second on-screen segment of its own
    // silently lost it — exactly the split + discordant reads that carry the
    // most SV evidence. Entry count can't distinguish "both mates present" from
    // "one mate, two segments"; the mate partition can.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500, 3000, 3200]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
      ]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([7000, 7000]),
      readPairOrientations: new Uint8Array([1, 1]),
      ...namesToBlock(['readA', 'readA']),
      readClipAtStart: new Uint32Array([0, 500]),
      ...nextRefsToTable(['chr1', 'chr1']),
      readNextPositions: new Uint32Array([8000, 8000]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 10000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    // The within-read split junction (1500 → 3000) AND the mate link from the
    // read's own outer 5' edge (1000) to the mate's recorded position (8000).
    expect(arcs.map(a => [a.p1.bp, a.p2.bp])).toEqual(
      expect.arrayContaining([
        [1500, 3000],
        [1000, 8000],
      ]),
    )
  })

  test('a split read whose mate is off screen draws no mate link when long-range is off', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1500, 3000, 3200]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
      ]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([7000, 7000]),
      readPairOrientations: new Uint8Array([1, 1]),
      ...namesToBlock(['readA', 'readA']),
      readClipAtStart: new Uint32Array([0, 500]),
      ...nextRefsToTable(['chr1', 'chr1']),
      readNextPositions: new Uint32Array([8000, 8000]),
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 10000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: false,
    })
    // Both split segments are on screen, so their junction always draws; the
    // off-screen mate link is the only thing the setting gates.
    expect(arcs.map(a => [a.p1.bp, a.p2.bp])).toEqual([[1500, 3000]])
  })

  test('paired multi-segment read steps through an off-screen 3rd split segment', () => {
    // First-in-pair read has two on-screen segments A (clip 0, chr1:1000) and C
    // (clip 200, chr1:5000) plus a middle segment B (clip 100) mapped off-screen
    // at chr1:9000, known only from the SA tags. Its mate D (second-in-pair) is
    // on screen at chr1:5500. Previously the ≥2-on-screen paired branch chained
    // only the entries it was handed, so it drew a misleading direct A→C join
    // and never stepped through B. It must now behave like the unpaired path:
    // A→B→C when long-range is on, nothing within the read when it is off.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1200, 5000, 5200, 5500, 5700]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ]),
      readStrands: new Int8Array([1, 1, -1]),
      readInsertSizes: new Float32Array([600, 0, 600]),
      readPairOrientations: new Uint8Array([1, 0, 1]),
      ...namesToBlock(['readA', 'readA', 'readA']),
      readClipAtStart: new Uint32Array([0, 200, 0]),
      readSuppAlignments: [
        // A's SA names B (off-screen) and C
        'chr1,9001,+,100S200M,60,0;chr1,5001,+,200S200M,60,0;',
        // C's SA names A and B (off-screen)
        'chr1,1001,+,200M200S,60,0;chr1,9001,+,100S200M,60,0;',
        // mate D has no supplementary alignments
        '',
      ],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 6000, displayedRegionIndex: 0 },
    ]

    const withLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: true,
      },
    ).arcs
    const pairs = withLongRange.map(a => [a.p1.bp, a.p2.bp])
    // A→B (1200→9000) and B→C (9200→5000) step through the hidden segment...
    expect(pairs).toContainEqual([1200, 9000])
    expect(pairs).toContainEqual([9200, 5000])
    // ...never the direct A→C join (1200→5000) the old branch produced...
    expect(pairs).not.toContainEqual([1200, 5000])
    // ...plus the mate link A↔D, each mate's own outer edge (fwd A's start
    // 1000 → rev D's end 5700), not the gap between them.
    expect(pairs).toContainEqual([1000, 5700])
    expect(withLongRange).toHaveLength(3)

    // With long-range off, B can't be drawn and A/C are not read-adjacent, so no
    // within-read junction is drawn — but the on-screen mate link still is.
    const withoutLongRange = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      {
        colorByType: 'insertSizeAndOrientation',
        drawInter: false,
        drawLongRange: false,
      },
    ).arcs
    expect(withoutLongRange.map(a => [a.p1.bp, a.p2.bp])).toEqual([
      [1000, 5700],
    ])
  })

  test('mixed dataset: a lone unpaired SA read draws its split junction, not a mate arc', () => {
    // A paired pair (idx 0/1, both mates on screen) makes the dataset globally
    // paired, alongside a lone unpaired read (idx 2) carrying an SA tag (its
    // supplementary is off-screen). The single-entry path must key off the
    // read's own PAIRED flag: the lone read is unpaired, so it draws an SA split
    // junction rather than a spurious mate arc to readNextPositions (0 for an
    // unpaired read).
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1200, 1800, 2000, 5000, 5200]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
        0,
      ]),
      readStrands: new Int8Array([1, -1, 1]),
      readInsertSizes: new Float32Array([1000, 1000, 0]),
      readPairOrientations: new Uint8Array([1, 1, 0]),
      ...namesToBlock(['pair', 'pair', 'lone']),
      readSuppAlignments: ['', '', 'chr1,7001,+,200M,60,0;'],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 8000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    // one mate-link arc for the pair + one SA split junction for the lone read
    expect(arcs).toHaveLength(2)
    const loneArc = arcs.find(a => a.p1.bp === 5200)!
    // lone read's SA junction: primary fwd end (5200) → supplementary fwd
    // start (7000), NOT a mate arc to position 0
    expect(loneArc.p2.bp).toBe(7000)
  })

  test('wide inversion split keeps its inversion color in a paired dataset', () => {
    // A paired pair (idx 0/1) makes the dataset globally paired. A lone
    // unpaired read (idx 2) is SA-split fwd→rev spanning >10kb. The split must
    // color by its own strands (split-inversion slot 7) rather than by any
    // paired-insert rule: a junction has no TLEN to classify, so the split
    // branch has to resolve before the insert class either way.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1200, 1400, 1600, 1000, 1500]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
        0,
      ]),
      readStrands: new Int8Array([1, -1, 1]),
      readInsertSizes: new Float32Array([200, 200, 0]),
      readPairOrientations: new Uint8Array([1, 1, 0]),
      ...namesToBlock(['pair', 'pair', 'lone']),
      readSuppAlignments: ['', '', 'chr1,30001,-,200M,60,0;'],
    })
    const regions = [
      { refName: 'chr1', start: 1000, end: 40000, displayedRegionIndex: 0 },
    ]
    const { arcs } = computeArcsFromPileupData(new Map([[0, data]]), regions, {
      colorByType: 'insertSizeAndOrientation',
      drawInter: false,
      drawLongRange: true,
    })
    const loneArc = arcs.find(a => a.p1.bp === 1500)!
    // |30200 - 1500| / 2 ≈ 14350 > 10000 large-insert threshold
    expect(Math.abs((loneArc.p2.bp - loneArc.p1.bp) / 2)).toBeGreaterThan(10000)
    // fwd→rev split junction → split-inversion slot 7, not long-insert 1
    expect(loneArc.colorType).toBe(7)
  })
})

describe('computeArcsByGroup', () => {
  const regions = [
    { refName: 'chr1', start: 0, end: 2_000_000, displayedRegionIndex: 0 },
  ]
  const settings = {
    colorByType: 'orientation' as const,
    drawInter: false,
    drawLongRange: true,
  }

  // One LR pair per span, laid out end to end from `from`.
  function lrPairs(from: number, spans: number[], tag: string) {
    const positions: number[] = []
    const flags: number[] = []
    const strands: number[] = []
    const orientations: number[] = []
    const inserts: number[] = []
    const names: string[] = []
    spans.forEach((span, i) => {
      const a = from + i * 4000
      const b = a + span
      positions.push(a, a + 100, b, b + 100)
      flags.push(
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      )
      strands.push(1, -1)
      orientations.push(1, 1)
      inserts.push(span, span)
      names.push(`${tag}${i}`, `${tag}${i}`)
    })
    return makePileupData({
      readPositions: new Uint32Array(positions),
      readFlags: new Uint16Array(flags),
      readStrands: new Int8Array(strands),
      readPairOrientations: new Uint8Array(orientations),
      readInsertSizes: new Float32Array(inserts),
      ...namesToBlock(names),
    })
  }

  // A tight ~2kb cluster of LR pairs — enough rows for the grouped and
  // ungrouped entry points to have something non-trivial to agree on.
  const CLUSTER = [1800, 1900, 2000, 2000, 2000, 2100, 2100, 2200, 1950, 2050]

  test('one visible lane matches the single-group entry point exactly', () => {
    const data = lrPairs(1000, CLUSTER, 'a')
    const { byGroup } = computeArcsByGroup(
      new Map([['only', new Map([[0, data]])]]),
      { loaded: regions, displayed: regions },
      settings,
    )
    const { arcs, lines } = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      settings,
    )
    expect(byGroup.get('only')!.get(0)).toEqual(arcsToRegionResult(arcs, lines))
  })
})

// A region's buffer holds the arcs that can paint ink in ITS block, which
// refName equality does not decide. Two displayed regions on one chromosome is
// the multi-region SV view — the thing read connections exist for — and there
// each region used to receive every arc on the chromosome, multiplying the pack,
// the upload and the per-mousemove hit-test walk by the region count.
describe('an arc is uploaded only to the regions it reaches', () => {
  const settings = {
    colorByType: 'insertSize' as const,
    drawInter: false,
    drawLongRange: false,
  }
  // Two windows on chr1, 900kb apart, each holding a pair local to itself.
  const regions = [
    { refName: 'chr1', start: 0, end: 2000, displayedRegionIndex: 0 },
    { refName: 'chr1', start: 899000, end: 901000, displayedRegionIndex: 1 },
  ]

  function localPair(base: number, name: string, ids: [string, string]) {
    const data = makePileupData({
      readPositions: new Uint32Array([
        base,
        base + 100,
        base + 400,
        base + 500,
      ]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([500, 500]),
      readPairOrientations: new Uint8Array([1, 1]),
      ...namesToBlock([name, name]),
    })
    data.readKeys[0] = ids[0]
    data.readKeys[1] = ids[1]
    return data
  }

  test('each region gets its own arc and not the other region’s', () => {
    const { byGroup } = computeArcsByGroup(
      new Map([
        [
          '',
          new Map([
            [0, localPair(1000, 'readA', ['a1', 'a2'])],
            [1, localPair(900000, 'readB', ['b1', 'b2'])],
          ]),
        ],
      ]),
      { loaded: regions, displayed: regions },
      settings,
    )
    const regionMap = byGroup.get('')!
    expect([...regionMap.get(0)!.arcX1]).toEqual([1000])
    expect([...regionMap.get(1)!.arcX1]).toEqual([900000])
  })

  test('an arc straddling both leaves both buffers for the overlay', () => {
    // One pair with a mate in each window. This used to go to BOTH regions, on
    // the reasoning that each block paints the foot it holds and the leg leaving
    // toward the other. They do not join: each block maps bp to x through its
    // own range, so the far foot is extrapolated to a place the other block is
    // not, and the reader gets two half-curves pointing at nothing. It is now
    // held out of both and drawn once across the view — see `CrossRegionArc`.
    const near = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([899000]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readC']),
    })
    near.readKeys[0] = 'c1'
    const far = makePileupData({
      readPositions: new Uint32Array([900000, 900100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([899000]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readC']),
    })
    far.readKeys[0] = 'c2'

    const { byGroup, crossRegionByGroup } = computeArcsByGroup(
      new Map([
        [
          '',
          new Map([
            [0, near],
            [1, far],
          ]),
        ],
      ]),
      { loaded: regions, displayed: regions },
      settings,
    )
    const regionMap = byGroup.get('')!
    expect(regionMap.get(0)!.numArcs).toBe(0)
    expect(regionMap.get(1)!.numArcs).toBe(0)
    // …and it is in the overlay's half, carrying the region each foot resolved
    // to, which is the whole thing a per-block pass cannot know.
    const cross = crossRegionByGroup.get('')!
    expect(cross).toHaveLength(1)
    expect(cross[0]!.p1.bp).toBe(1000)
    expect(cross[0]!.p2.bp).toBe(900000)
    expect(cross[0]!.p1RegionIndex).toBe(0)
    expect(cross[0]!.p2RegionIndex).toBe(1)
  })

  // The off-screen-partner case, which looks like the one above and is not: one
  // foot is in no displayed region at all, so there is no second pixel to draw
  // to and the leg rising toward the screen edge is the correct picture. It
  // must stay in the per-region feed, or the fix for the seam deletes it.
  test('a foot in no displayed region is not cross-region', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([400000]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readE']),
      ...nextRefsToTable(['chr1']),
      // 400kb away — between the two windows, so displayed by neither
      readNextPositions: new Uint32Array([400000]),
    })
    const { byGroup, crossRegionByGroup } = computeArcsByGroup(
      new Map([['', new Map([[0, data]])]]),
      { loaded: regions, displayed: regions },
      { ...settings, drawLongRange: true },
    )
    expect(crossRegionByGroup.get('')).toHaveLength(0)
    expect([...byGroup.get('')!.get(0)!.arcX1]).toEqual([1000])
  })

  test('a connector tick goes to the region holding it, and to no other', () => {
    // Both mates off-chromosome, so each end drops a tick; only the one on chr1
    // is in a displayed region at all, and only in the region containing it.
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readD']),
      ...nextRefsToTable(['chr2']),
      readNextPositions: new Uint32Array([5000]),
    })
    const regionMap = computeArcsByGroup(
      new Map([['', new Map([[0, data]])]]),
      { loaded: regions, displayed: regions },
      { ...settings, drawInter: true, drawLongRange: true },
    ).byGroup.get('')!
    expect([...regionMap.get(0)!.arcLinePositions]).toEqual([1000])
    expect(regionMap.get(1)!.numArcLines).toBe(0)
  })
})

describe('groupArcsByRef', () => {
  test('buckets arcs and lines by refName', () => {
    const arcs = [
      {
        p1: { refName: 'chr1', bp: 1100 },
        p2: { refName: 'chr1', bp: 1500 },
        colorType: 0,
        shapeType: 0,
        yBp: 200,
        spanBp: 200,
        support: 1,
        key: 'chr1\u00001100\u0000chr1\u00001500\u00000\u00000',
      },
      {
        p1: { refName: 'chr2', bp: 5000 },
        p2: { refName: 'chr2', bp: 6000 },
        colorType: 1,
        shapeType: 1,
        yBp: 500,
        spanBp: 500,
        support: 1,
        key: 'chr2\u00005000\u0000chr2\u00006000\u00001\u00001',
      },
    ]
    const lines = [tick('chr1', 1200, 'chr2'), tick('chr2', 5500, 'chr1')]
    const { arcsByRef, linesByRef } = groupArcsByRef(arcs, lines)
    expect(arcsByRef.get('chr1')?.length).toBe(1)
    expect(arcsByRef.get('chr2')?.length).toBe(1)
    expect(linesByRef.get('chr1')?.length).toBe(1)
    expect(linesByRef.get('chr2')?.length).toBe(1)
    expect(arcsByRef.get('chr3')).toBeUndefined()
  })

  // The invariant this function is keyed on, pinned at its source rather than
  // argued in a comment. Bucketing on `p1.refName` alone and `arcTouchesRegion`
  // comparing raw bp are both safe only while nothing two-refName reaches the
  // per-region feed — such an arc would be filed under one chromosome and then
  // projected at a garbage x inside it, with nothing to see but a wrong picture.
  //
  // What keeps it out is the REGION partition (two refNames cannot share a
  // displayed region), not the interchromosomal branch, and the difference
  // matters because that branch is exactly what an interchromosomal arc has to
  // change. Two contigs displayed, one connection between them.
  test('no two-refName arc reaches the per-region feed', () => {
    const data = makePileupData({
      readPositions: new Uint32Array([1000, 1100]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1]),
      readInsertSizes: new Float32Array([0]),
      readPairOrientations: new Uint8Array([1]),
      ...namesToBlock(['readX']),
      ...nextRefsToTable(['chr2']),
      readNextPositions: new Uint32Array([5000]),
    })
    const both = [
      { refName: 'chr1', start: 0, end: 2000, displayedRegionIndex: 0 },
      { refName: 'chr2', start: 4000, end: 6000, displayedRegionIndex: 1 },
    ]
    const result = computeArcsFromPileupData(new Map([[0, data]]), both, {
      colorByType: 'insertSize',
      drawInter: true,
      drawLongRange: true,
    })
    expect(result.arcs.filter(a => a.p1.refName !== a.p2.refName)).toHaveLength(
      0,
    )
  })
})

describe('arcsToRegionResult', () => {
  test('packs arcs and lines into typed arrays', () => {
    const regionArcs = [
      {
        p1: { refName: 'chr1', bp: 1100 },
        p2: { refName: 'chr1', bp: 1500 },
        colorType: 0,
        shapeType: 0,
        yBp: 200,
        spanBp: 200,
        support: 1,
        key: 'chr1\u00001100\u0000chr1\u00001500\u00000\u00000',
      },
    ]
    const regionLines = [tick('chr1', 1200, 'chr2')]

    const result = arcsToRegionResult(regionArcs, regionLines)

    expect(result.numArcs).toBe(1)
    expect(result.arcX1[0]).toBe(1100)
    expect(result.arcX2[0]).toBe(1500)
    expect(result.numArcLines).toBe(1)
    expect(result.arcLinePositions[0]).toBe(1200)
  })

  test('returns empty arrays for empty inputs', () => {
    const result = arcsToRegionResult([], [])

    expect(result.numArcs).toBe(0)
    expect(result.arcX1.length).toBe(0)
    expect(result.numArcLines).toBe(0)
  })

  test('one entry per connector line, packed in order', () => {
    const lines = [tick('chr1', 1500, 'chr9'), tick('chr1', 2500, 'chr9')]
    const result = arcsToRegionResult([], lines)

    expect(result.numArcLines).toBe(2)
    expect(Array.from(result.arcLinePositions)).toEqual([1500, 2500])
  })

  // `arcsYDomainBp` is built from this and `insertSizeTicks` LABELS its top tick
  // with that domain, so a max taken off the drawn `yBp` printed the largest
  // insert size times the read cloud's ±8% jitter — a template length no read
  // in view has, and reproducibly so, since the factor is a hash of the
  // endpoints. Same defect the hover had before it moved to `spanBp`.
  test('the flat max is the insert size, not the jittered Y it plots at', () => {
    const flat = (spanBp: number, yBp: number) => ({
      p1: { refName: 'chr1', bp: 1000 },
      p2: { refName: 'chr1', bp: 1000 + spanBp },
      colorType: 0,
      shapeType: ARC_SHAPE_FLAT,
      yBp,
      spanBp,
      support: 1,
      key: `k${spanBp}`,
    })
    // The widest pair jitters DOWN and a narrower one jitters UP, so the two
    // maxima disagree in both directions at once: 10000 is the answer, 10500 is
    // what reading the drawn position gives.
    const result = arcsToRegionResult(
      [flat(10000, 9300), flat(9800, 10500)],
      [],
    )

    expect(result.numFlatArcs).toBe(2)
    expect(result.maxFlatArcSpanBp).toBe(10000)
  })

  test('a curved arc contributes no flat max', () => {
    // Arc mode emits no flat shape at all, so the read cloud's axis must not be
    // sized by one — `numFlatArcs` 0 is also what lets the marker pass be
    // skipped wholesale.
    const result = arcsToRegionResult(
      [
        {
          p1: { refName: 'chr1', bp: 1000 },
          p2: { refName: 'chr1', bp: 90000 },
          colorType: 0,
          shapeType: ARC_SHAPE_ARC,
          yBp: 44500,
          spanBp: 44500,
          support: 1,
          key: 'curve',
        },
      ],
      [],
    )

    expect(result.numFlatArcs).toBe(0)
    expect(result.maxFlatArcSpanBp).toBe(0)
  })
})

// The arc/read-cloud colors get their own legend section, keyed off these — the
// read-fill categories describe a different vocabulary entirely, so
// the arc-only split-junction buckets (which no read fill emits outside chain
// mode) would be missing. These map the arc color slots back to legend
// categories; each returned category's swatch must equal the plotted mark's
// color (see ARC_SLOT_CATEGORY / swatchPaletteKeys).
describe('arcColorLegendCategory', () => {
  test('split junctions map to the cloud-only categories', () => {
    // COLOR_SPLIT_INVERSION = 7, COLOR_SPLIT_DELETION = 8
    expect(arcColorLegendCategory(7, 'insertSizeAndOrientation')).toBe(
      'splitInversion',
    )
    expect(arcColorLegendCategory(8, 'insertSizeAndOrientation')).toBe(
      'splitDeletion',
    )
  })
  test('insert-size + orientation slots map to their read-fill categories', () => {
    expect(arcColorLegendCategory(1, 'insertSize')).toBe('longInsert')
    expect(arcColorLegendCategory(2, 'insertSize')).toBe('shortInsert')
    expect(arcColorLegendCategory(3, 'orientation')).toBe('interchrom')
    expect(arcColorLegendCategory(4, 'orientation')).toBe('pairLL')
    expect(arcColorLegendCategory(5, 'orientation')).toBe('pairRR')
    expect(arcColorLegendCategory(6, 'orientation')).toBe('pairRL')
  })
  test('the default slot labels by coloring mode (both colorPairLR)', () => {
    expect(arcColorLegendCategory(0, 'insertSize')).toBe('normalInsert')
    expect(arcColorLegendCategory(0, 'insertSizeAndOrientation')).toBe(
      'normalInsert',
    )
    expect(arcColorLegendCategory(0, 'orientation')).toBe('pairLR')
  })
})

// Coalescing. Every read over a junction used to be its own instance, and arc
// colors are opaque, so N identical arcs painted as one and the support was
// simply lost. These pin the fold: the same junction sums, a neighbouring one
// does not.
describe('identical arcs coalesce and carry their support', () => {
  // n paired reads describing the SAME pair of endpoints, which is what a
  // junction with n-read support looks like coming out of the fetch.
  function pairedReadsAt(starts: number[], mateBp: number) {
    return makePileupData({
      readPositions: new Uint32Array(starts.flatMap(s => [s, s + 100])),
      readFlags: new Uint16Array(starts.map(() => SAM_FLAG_PAIRED)),
      readStrands: new Int8Array(starts.map(() => 1)),
      readInsertSizes: new Float32Array(starts.map(() => 500)),
      readPairOrientations: new Uint8Array(starts.map(() => 1)),
      ...namesToBlock(starts.map((_, i) => `read${i}`)),
      ...nextRefsToTable(starts.map(() => 'chr1')),
      readNextPositions: new Uint32Array(starts.map(() => mateBp)),
    })
  }
  const regions = [
    { refName: 'chr1', start: 1000, end: 3000, displayedRegionIndex: 0 },
  ]
  const settings = {
    colorByType: 'insertSizeAndOrientation' as const,
    drawInter: false,
    drawLongRange: true,
  }

  test('three reads over one junction are one arc of support 3', () => {
    const result = computeArcsFromPileupData(
      new Map([[0, pairedReadsAt([1000, 1000, 1000], 2000)]]),
      regions,
      settings,
    )
    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.support).toBe(3)
  })

  test('a junction one base over is a second arc, not more support', () => {
    const result = computeArcsFromPileupData(
      new Map([[0, pairedReadsAt([1000, 1000, 1001], 2000)]]),
      regions,
      settings,
    )
    expect(result.arcs.length).toBe(2)
    expect(result.arcs.map(a => a.support).sort()).toEqual([1, 2])
  })

  test('a lone connection keeps support 1', () => {
    const result = computeArcsFromPileupData(
      new Map([[0, pairedReadsAt([1000], 2000)]]),
      regions,
      settings,
    )
    expect(result.arcs[0]!.support).toBe(1)
  })

  // The same junction, but the reads sit on the RIGHT side of it and name the
  // left breakpoint as their mate — so the connection resolves with the two
  // endpoints the other way round. It draws the identical arc (strokeArcMark is
  // endpoint-order independent, pinned in arcShape.test.ts), so it has to fold
  // into the same one.
  //
  // Found on real data rather than reasoned about: over the HG02768 inverted
  // duplication a junction with 11 supporting reads came out as arcs of 7 and 4
  // stacked in the same opaque colour, so the stroke width — the entire point of
  // coalescing — under-reported it and no reader could tell.
  test('a junction folds regardless of which mate the reads name first', () => {
    const result = computeArcsFromPileupData(
      new Map([
        [
          0,
          makePileupData({
            // two reads at 1000 pointing right to 2000, two at 2000 pointing
            // left to 1000 — one junction, four reads
            readPositions: new Uint32Array([
              1000, 1100, 1000, 1100, 2000, 2100, 2000, 2100,
            ]),
            readFlags: new Uint16Array(
              Array.from({ length: 4 }, () => SAM_FLAG_PAIRED),
            ),
            readStrands: new Int8Array([1, 1, 1, 1]),
            readInsertSizes: new Float32Array([500, 500, 500, 500]),
            readPairOrientations: new Uint8Array([1, 1, 1, 1]),
            ...namesToBlock(['a', 'b', 'c', 'd']),
            ...nextRefsToTable(Array.from({ length: 4 }, () => 'chr1')),
            readNextPositions: new Uint32Array([2000, 2000, 1000, 1000]),
          }),
        ],
      ]),
      regions,
      settings,
    )
    expect(result.arcs.length).toBe(1)
    expect(result.arcs[0]!.support).toBe(4)
  })

  test('support reaches the upload arrays in feed order', () => {
    const { arcs, lines } = computeArcsFromPileupData(
      new Map([[0, pairedReadsAt([1000, 1001, 1001], 2000)]]),
      regions,
      settings,
    )
    const region = arcsToRegionResult(arcs, lines)
    expect(region.numArcs).toBe(2)
    expect(Array.from(region.arcSupport)).toEqual([1, 2])
  })

  // Array order is paint order and the strokes are opaque, so whichever arc is
  // last keeps the pixels the two share. Reads arrive in no particular order
  // with respect to support, so without the sort a singleton fetched after a
  // heavy junction draws over it — and `hitTestArcBand` resolves the overlap the
  // same way, which is how a hover on the strongest junction in the band
  // reported "1 read".
  test('the heavier junction packs last, whatever order the reads arrived in', () => {
    const { arcs, lines } = computeArcsFromPileupData(
      // The 3-read junction is seen FIRST, and the singleton last.
      new Map([[0, pairedReadsAt([1000, 1000, 1000, 1001], 2000)]]),
      regions,
      settings,
    )
    expect(Array.from(arcsToRegionResult(arcs, lines).arcSupport)).toEqual([
      1, 3,
    ])
  })

  // ...but support is the SECOND key. A deep short-read pileup is almost all
  // concordant pairs, so ordering on support alone let a wall of grey arcs
  // punch through the few arcs that carry a category — the ones the band is
  // drawn for. Category first, so the signal survives the noise crossing it.
  test('a categorized arc packs over a heavier uncategorized one', () => {
    // Three reads on one concordant (LR) junction, one read on an RR junction.
    // The singleton is the only arc here that says anything.
    const data = makePileupData({
      readPositions: new Uint32Array([
        1000, 1100, 1000, 1100, 1000, 1100, 1500, 1600,
      ]),
      readFlags: new Uint16Array(new Array(4).fill(SAM_FLAG_PAIRED)),
      readStrands: new Int8Array([1, 1, 1, 1]),
      readInsertSizes: new Float32Array([500, 500, 500, 500]),
      readPairOrientations: new Uint8Array([1, 1, 1, 3]),
      ...namesToBlock(['a', 'b', 'c', 'rr']),
      ...nextRefsToTable(new Array(4).fill('chr1')),
      readNextPositions: new Uint32Array([2000, 2000, 2000, 2500]),
    })
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, data]]),
      regions,
      settings,
    )
    expect(arcs.map(a => a.support)).toEqual([3, 1])
    expect(arcs.map(a => arcPaintRank(a.colorType))).toEqual([0, 1])
  })
})

// A mate link's GEOMETRY comes from the two segments actually on screen, but its
// pair-level fields (orientation, template length) describe the fragment. A
// supplementary answers those differently from its own primary — @gmod/bam
// derives `pair_orientation` from the record's own reverse bit and position —
// while the two PRIMARIES of a pair always agree. So sourcing them from a
// primary is a no-op whenever both are on screen, and only bites when a mate's
// primary is off-screen and `primaryOf` fell back to its supplementary segment.
//
// This is the rule the read fills already follow: `buildChainResultFields`
// overwrites a supplementary's `readPairOrientations` entry with the chain
// primary's. Arcs read that same array, so in CHAIN mode the correction was
// already applied upstream and in pileup mode it was not — the same reads at the
// same locus painting a different arc colour depending on a layout setting.
describe('a mate link reads its pair fields off a primary, not a supplementary', () => {
  const regions = [
    { refName: 'chr1', start: 0, end: 10000, displayedRegionIndex: 0 },
  ]

  // read1's primary is off-screen, so only its supplementary segment is loaded;
  // read2's primary is on screen. The pair is RL (orientation 2); read1's
  // supplementary, having flipped at the split junction, computes LR (1).
  const splitMateOffScreenPrimary = makePileupData({
    readPositions: new Uint32Array([1000, 1100, 5000, 5100]),
    readFlags: new Uint16Array([
      SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
      SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
    ]),
    readStrands: new Int8Array([1, -1]),
    readInsertSizes: new Float32Array([0, 4100]),
    readPairOrientations: new Uint8Array([1, 2]),
    ...namesToBlock(['readA', 'readA']),
  })

  test('orientation comes from the primary mate (RL), not the supplementary (LR)', () => {
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, splitMateOffScreenPrimary]]),
      regions,
      { colorByType: 'orientation', drawInter: false, drawLongRange: false },
    )
    expect(arcs).toHaveLength(1)
    // COLOR_PAIR_RL. The supplementary's own orientation (1/LR) has no slot and
    // would have fallen through to COLOR_DEFAULT (0) — the neutral grey that
    // says "ordinary pair" over exactly the discordant pair the arc exists for.
    expect(arcs[0]!.colorType).toBe(6)
  })

  test('template length comes from the primary mate, so insert-size colour is not lost', () => {
    const withStats = {
      ...splitMateOffScreenPrimary,
      insertSizeStats: { upper: 500, lower: 100 },
    }
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, withStats]]),
      regions,
      {
        colorByType: 'insertSize',
        drawInter: false,
        drawLongRange: false,
      },
    )
    expect(arcs).toHaveLength(1)
    // tlen 4100 > upper 500 → COLOR_LONG_INSERT. The supplementary carries
    // tlen 0, which `classifyInsertSize` sorts into `normal` (0 is neither above
    // upper nor inside the open short interval) — so the arc painted the default
    // over a pair 8x the modal insert.
    expect(arcs[0]!.colorType).toBe(1)
  })

  test('is a no-op when both primaries are on screen', () => {
    // Same pair, both primaries loaded. Each primary already carries the pair's
    // own orientation, so which endpoint is read makes no difference — this is
    // the case that must not move.
    const bothPrimaries = makePileupData({
      readPositions: new Uint32Array([1000, 1100, 5000, 5100]),
      readFlags: new Uint16Array([
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ]),
      readStrands: new Int8Array([1, -1]),
      readInsertSizes: new Float32Array([4100, 4100]),
      readPairOrientations: new Uint8Array([2, 2]),
      ...namesToBlock(['readA', 'readA']),
    })
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, bothPrimaries]]),
      regions,
      { colorByType: 'orientation', drawInter: false, drawLongRange: false },
    )
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.colorType).toBe(6)
  })
})
