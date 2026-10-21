import { preferIncumbent } from './syntenyHysteresis.ts'

// One rule for which stretch of a mate contig a window shows, shared by the
// multi-way lane and the launched panel so the two open the same span. Free of
// the lane's layout, since the launch resolves its panels in the worker.

// a gap wider than this share of the window starts a new cluster
const CLUSTER_GAP = 0.25
// a cluster holding less of the evidence is a stray: it links no two blocks,
// and outside the block it would sit in it counts for nothing
const STRAY_SHARE = 0.05
// a gap wider than this many windows parts one block from the next, unless the
// two together still fit this rung, where showing both costs little
const BLOCK_GAP = 1
const JOINED_RUNG = 1.5
// the share of the stray floor a cluster already drawn needs to stay solid
const HELD_STRAY_RATIO = 0.5

// a mammal liftOver over a human window runs up to 7.5% wider (TNNT3)
const RUNG_TOLERANCE = 0.1

export const rungCovers = (rung: number, need: number) =>
  rung * (1 + RUNG_TOLERANCE) >= need

export interface BpSpan {
  start: number
  end: number
}

export interface Weighed<P extends BpSpan = BpSpan> {
  placement: P
  // vote evidence: anchor bp for an alignment, 1 for a gene
  weight: number
}

export interface Block {
  lo: number
  hi: number
  /** the block's evidence, named for `preferIncumbent` */
  overlap: number
}

function clustersOf<P extends BpSpan>(placements: Weighed<P>[], gapBp: number) {
  const clusters: Weighed<P>[][] = []
  let reach = Number.NEGATIVE_INFINITY
  for (const p of [...placements].sort(
    (a, b) => a.placement.start - b.placement.start,
  )) {
    if (!clusters.length || p.placement.start - reach > gapBp) {
      clusters.push([])
    }
    clusters.at(-1)!.push(p)
    reach = Math.max(reach, p.placement.end)
  }
  return clusters
}

const weightOf = (placements: Weighed[]) =>
  placements.reduce((sum, p) => sum + p.weight, 0)

export function extentOf(placements: Weighed[]) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const { placement } of placements) {
    min = Math.min(min, placement.start)
    max = Math.max(max, placement.end)
  }
  // no margin: rounding up to a rung is the margin
  return { lo: Math.max(0, min), hi: Math.max(max, min + 1) }
}

/**
 * A contig's placements as blocks: clusters a quarter window apart, the strays
 * set aside, and the rest linked across gaps of up to a window. A stray inside
 * a block's span counts toward it; one outside every block counts toward none,
 * so a scatter of small hits can neither chain two blocks nor widen one. Where
 * every cluster is a stray, each is its own block. A cluster already drawn
 * (`held`) stays solid at a lower share, since each step re-clips the pieces at
 * the window's edges and moves their weight.
 */
export function blocksOf(
  placements: Weighed[],
  unitBp: number,
  held?: { lo: number; hi: number },
) {
  const clusters = clustersOf(placements, unitBp * CLUSTER_GAP)
  const floor = STRAY_SHARE * weightOf(placements)
  const solid = clusters.filter(cluster => {
    const { lo, hi } = extentOf(cluster)
    const drawn = held !== undefined && lo < held.hi && hi > held.lo
    return weightOf(cluster) >= (drawn ? floor * HELD_STRAY_RATIO : floor)
  })
  const blocks: Block[] = []
  for (const cluster of solid.length ? solid : clusters) {
    const { lo, hi } = extentOf(cluster)
    const last = blocks.at(-1)
    if (
      solid.length &&
      last &&
      (lo - last.hi <= unitBp * BLOCK_GAP ||
        rungCovers(JOINED_RUNG, (hi - last.lo) / unitBp))
    ) {
      last.hi = Math.max(last.hi, hi)
    } else {
      blocks.push({ lo, hi, overlap: 0 })
    }
  }
  for (const p of placements) {
    const block = blocks[firstEndingAfter(blocks, p.placement.start)]
    if (block && p.placement.end > block.lo) {
      block.overlap += p.weight
    }
  }
  return blocks
}

// blocks come out sorted and disjoint, so one search finds the only block a
// placement can meet first; a scan per placement was quadratic on a launch
// whose hits scatter along the mate
function firstEndingAfter(blocks: Block[], bp: number) {
  let lo = 0
  let hi = blocks.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (blocks[mid]!.hi > bp) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return lo
}

const distanceTo = (block: Block, bp: number) =>
  Math.max(0, block.lo - bp, bp - block.hi)

/**
 * The heaviest block, unless the one holding `incumbentCenter` is within the
 * switch margin; the one nearest `pinnedAt` when a reader pinned one.
 */
export function pickBlock(
  blocks: Block[],
  pinnedAt?: number,
  incumbentCenter?: number,
) {
  if (pinnedAt !== undefined) {
    return blocks.reduce((a, b) =>
      distanceTo(b, pinnedAt) < distanceTo(a, pinnedAt) ? b : a,
    )
  }
  const best = blocks.reduce((a, b) => (b.overlap > a.overlap ? b : a))
  const held =
    incumbentCenter === undefined
      ? undefined
      : blocks.find(b => distanceTo(b, incumbentCenter) === 0)
  return preferIncumbent(best, held)!
}
