import { basePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { namesToBlock } from '../../shared/readNameBlock.ts'
import { clusteredInterchromSupport } from './arcClustering.ts'
import { computeArcsFromPileupData } from './compute.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { PendingArc } from './arcTypes.ts'

const WINDOW = 600

function link(p1Ref: string, p1Bp: number, p2Ref: string, p2Bp: number) {
  return {
    p1Ref,
    p1Bp,
    p1Strand: 1,
    p1Dir: 1,
    p2Ref,
    p2Bp,
    p2Strand: 1,
    p2Dir: 1,
    isSplit: false,
    pairOrientationNum: 1,
    tlen: 0,
    flags: 1,
  } satisfies PendingArc
}

// Cluster sizes, sorted, so the assertion is about the PARTITION and not about
// which cluster the union-find happened to build first.
function clusterSizes(arcs: PendingArc[]) {
  return [...clusteredInterchromSupport(arcs, WINDOW).sizeOf].sort(
    (a, b) => a - b,
  )
}

describe('clusteredInterchromSupport is symmetric in the two contigs', () => {
  // Which coordinate the pass calls `bpA` is decided by `swap`, i.e. by which
  // contig NAME sorts first — nothing about the biology. So the same set of
  // connections described with the contigs' roles exchanged has to partition the
  // same way, and under the hierarchical two-pass form it did not: grouping into
  // runs on `bpA` split a run before `bpB` was ever consulted.
  const points: [number, number][] = [
    [0, 0],
    [500, 1000],
    [1000, 0],
  ]

  test('the transpose gives the same partition', () => {
    const asIs = points.map(([a, b]) => link('chr1', a, 'chr2', b))
    const transposed = points.map(([a, b]) => link('chr1', b, 'chr2', a))
    expect(clusterSizes(asIs)).toEqual(clusterSizes(transposed))
  })

  // And the partition it agrees on is the right one. No two of these three are
  // within the window on BOTH coordinates: (0,0) and (1000,0) share `bpB` and
  // are 1000 bp apart on `bpA`. The hierarchical form merged them anyway,
  // because (500,1000) bridged the `bpA` run and then dropped out on `bpB` —
  // manufacturing a cluster of 2, out of a pair further apart than the window,
  // via a third connection in neither's cluster. At the default floor of 2 that
  // is the difference between a breakpoint drawn and one deleted.
  test('a bridging connection does not merge two the window separates', () => {
    expect(
      clusterSizes(points.map(([a, b]) => link('chr1', a, 'chr2', b))),
    ).toEqual([1, 1, 1])
  })

  test('connections within the window on both axes still chain', () => {
    const stepping = [0, 500, 1000, 1500].map(bp =>
      link('chr1', 2000 + bp, 'chr2', 9000 + bp),
    )
    expect(clusterSizes(stepping)).toEqual([4])
  })
})

// ---------------------------------------------------------------------------

function makePileupData(
  overrides: Partial<PileupDataResult>,
): PileupDataResult {
  const n = (overrides.readPositions?.length ?? 0) / 2
  return { ...basePileupDataResult(n), ...overrides }
}

const region = {
  refName: 'chr1',
  start: 0,
  end: 100000,
  displayedRegionIndex: 0,
}

function ticksAt(data: PileupDataResult, minInterchromSupport: number) {
  return computeArcsFromPileupData(new Map([[0, data]]), [region], {
    colorByType: 'insertSize',
    drawInter: true,
    drawLongRange: true,
    minInterchromSupport,
  }).lines.map(l => `${l.x.refName}:${l.x.bp} n=${l.support}`)
}

// Split reads over a chr1->chr2 junction, one donor coordinate, acceptors as
// given.
function splitReads(donor: number, acceptors: number[]) {
  return makePileupData({
    readPositions: new Uint32Array(
      acceptors.flatMap(() => [donor, donor + 500]),
    ),
    readFlags: new Uint16Array(acceptors.length),
    readStrands: new Int8Array(acceptors.length).fill(1),
    ...namesToBlock(acceptors.map((_, i) => `split${i}`)),
    readClipAtStart: new Uint32Array(acceptors.length),
    readSuppAlignments: acceptors.map(bp => `chr2,${bp},+,500S500M,60,0;`),
  })
}

describe('a tick reports the same support whatever the floor is set to', () => {
  // One donor, a 3-read acceptor and a 1-read acceptor. Four reads cross the
  // donor base under either setting, so the donor tick has to say 4 under either
  // setting. It said 3 at the default floor, because the floor was applied to
  // each contributing cluster before `pushLine` summed them — so a display
  // filter was changing the number the hover reported about the data.
  const data = splitReads(2000, [9000, 9000, 9000, 40000])

  test('the donor keeps its full count when an acceptor is filtered out', () => {
    expect(ticksAt(data, 1)).toContain('chr1:2500 n=4')
    expect(ticksAt(data, 2)).toContain('chr1:2500 n=4')
  })
})

describe('the support floor does not reach split-read evidence', () => {
  // A chimeric read CROSSES the breakpoint. The floor is measured on mate pairs,
  // whose evidence scatters and whose singletons are mismapping; inheriting it
  // meant one split read over a translocation drew nothing by default, which on
  // unpaired long-read data is the only evidence there is.
  test('a single split read still draws its breakpoint', () => {
    const ticks = ticksAt(splitReads(2000, [9000]), 2)
    expect(ticks).toEqual(
      expect.arrayContaining(['chr1:2500 n=1', 'chr2:8999 n=1']),
    )
  })

  // Two reads agreeing on a junction whose acceptor the aligner placed 3 bp
  // apart are two clusters of one, since a split junction clusters at window 0
  // (`windowFor`) — so neither addend cleared a floor of 2 and the donor
  // coordinate, which two reads agree on to the base, drew nothing.
  test('wobbled acceptors still leave the donor drawn', () => {
    expect(ticksAt(splitReads(2000, [9000, 9003]), 2)).toContain(
      'chr1:2500 n=2',
    )
  })
})
