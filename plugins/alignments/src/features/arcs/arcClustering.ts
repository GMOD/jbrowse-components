import { getOrCreate } from '../../shared/util.ts'
import { fragmentEndsKey } from './arcTypes.ts'

import type { PendingArc } from './arcTypes.ts'

// Arc identity and the interchromosomal support count: same-chromosome
// connections coalesce on an exact `arcKey`, interchromosomal ones cluster
// inside a fragment-length window (`ComputedArc.support`).

// The identity of a drawn arc: endpoints, color, shape, Y and reported span.
// Connections agreeing on all of them draw the same pixels and hover, so they
// sum. `spanBp` is keyed because `ARC_SHAPE_FLAT_UNPLACED` collapses both feet
// and pins `yBp` to 0, so without it reads whose partners lie 5 Mb and 80 Mb
// away would coalesce. `yBp` is keyed because in the read cloud it is |TLEN|,
// a record field rather than a function of the drawn endpoints.
//
// Exact coordinates, as sashimi's `junctionKey`: a tolerance is declined
// because junctions genuinely cluster at this scale (the HG002 chr12 fold-back
// has five distinct events inside 2.3 kb). The separator is NUL because a
// refName may contain any printable character, and it must stay written as the
// escape `\0`: a raw NUL byte makes grep, rg and editors treat the file as
// binary.
export function arcKey(a: {
  p1Ref: string
  p1Bp: number
  p2Ref: string
  p2Bp: number
  colorType: number
  shapeType: number
  yBp: number
  spanBp: number
}) {
  // Endpoint order is normalized because the drawn arc is symmetric in it
  // (`strokeArcMark`, the shader's min/max): otherwise one junction whose reads
  // name the mates either way round splits its support over two stacked arcs.
  const swap = a.p1Ref === a.p2Ref ? a.p2Bp < a.p1Bp : a.p2Ref < a.p1Ref
  const [r1, b1, r2, b2] = swap
    ? [a.p2Ref, a.p2Bp, a.p1Ref, a.p1Bp]
    : [a.p1Ref, a.p1Bp, a.p2Ref, a.p2Bp]
  return `${r1}\0${b1}\0${r2}\0${b2}\0${a.colorType}\0${a.shapeType}\0${a.yBp}\0${a.spanBp}`
}

// Fallback mate window when the fetch has no insert-size band (unpaired data,
// too few proper pairs), only so the pass has a finite number.
export const DEFAULT_INTERCHROM_WINDOW_BP = 1000

// One interchromosomal connection, in the endpoint order the clustering keys on:
// `bpA` on the lexicographically-first contig, `bpB` on the other, `index` back
// into the caller's `pendingArcs`.
export interface ClusterEntry {
  index: number
  bpA: number
  bpB: number
}

// The clustering's answer as an identity per connection, because the marks
// spend it differently: an arc is one cluster and reads `sizeOf`, while a tick
// sums the distinct clusters reaching its coordinate (`pushLine`), which no
// per-connection count can answer.
export interface InterchromClusters {
  // Cluster index per `pendingArcs` entry, -1 for an intra-chromosomal one. It
  // spans the whole feed so the caller indexes it by its own loop index.
  clusterOf: number[]
  // Connections in each cluster, indexed by cluster.
  sizeOf: number[]
}

// The window is a property of the evidence, not of the chromosomes. A mate
// link scatters over a fragment length and gets the mate window; a split read
// knows its breakpoint to the base and clusters at window 0, which the same
// walk turns into `arcKey`'s exact coincidence count. A window would chain
// distinct nearby events, such as K562's BCR-ABL1 acceptors spread over ~154 kb
// of chr9.
export function windowFor(arc: PendingArc, mateWindowBp: number) {
  return arc.isSplit ? 0 : mateWindowBp
}

/**
 * Whether one interchromosomal cluster's evidence clears the user's support
 * floor. A split junction is exempt: the floor is for scattered mate-pair
 * mismapping, while a split read crosses the breakpoint and is counted at
 * window 0, and on unpaired long reads it is the only evidence there is.
 * Chimeric mismappings therefore draw at support 1, the thinnest stroke.
 * Exempting splits only when the library is unpaired was declined: it ties an
 * evidence-kind rule to a dataset-wide property.
 */
export function clearsInterchromFloor(
  isSplit: boolean,
  support: number,
  minInterchromSupport: number,
) {
  return isSplit || support >= minInterchromSupport
}

/**
 * Which reads agree on each interchromosomal connection, grouped over a window
 * on both contigs (DEEP_COVERAGE.md). Both marks' `support` comes out of this,
 * so it runs at every floor setting. Single-linkage over both coordinates at
 * once: two connections join when within the window on `bpA` and on `bpB`,
 * transitively. The relation must be symmetric in the two contigs; a
 * hierarchical pass (runs on `bpA`, then `bpB`) depends on which refName sorts
 * first, and chaining one open cluster along `bpA` loses reads to arrival
 * order (`arcClustering.test.ts` holds the transpose). The window bounds the
 * gap between neighbours, not a cluster's diameter, so evenly spaced pairs
 * chain without limit; what that means for the floor at depth is open.
 */
export function clusteredInterchromSupport(
  arcs: PendingArc[],
  mateWindowBp: number,
): InterchromClusters {
  const clusterOf = new Array<number>(arcs.length).fill(-1)
  const sizeOf: number[] = []
  // Endpoint order is normalized on refName, as in `arcKey`: which mate is p1
  // is chance, so one translocation arrives as both chr1->chr7 and chr7->chr1
  // and keyed raw would split its support. Each tick still draws at its own
  // read's coordinate. Bucketed by window as well as contig pair, so split and
  // mate evidence at one breakpoint are two clusters, each counted the way its
  // own evidence localizes. Records are kept per interchromosomal arc only;
  // `clusterOf` alone spans the feed.
  const byContigPair = new Map<
    string,
    { windowBp: number; entries: ClusterEntry[] }
  >()
  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i]!
    if (arc.p1Ref === arc.p2Ref) {
      continue
    }
    const swap = arc.p2Ref < arc.p1Ref
    const windowBp = windowFor(arc, mateWindowBp)
    const key = swap
      ? `${windowBp}\0${arc.p2Ref}\0${arc.p1Ref}`
      : `${windowBp}\0${arc.p1Ref}\0${arc.p2Ref}`
    getOrCreate(byContigPair, key, () => ({
      windowBp,
      entries: [],
    })).entries.push({
      index: i,
      bpA: swap ? arc.p2Bp : arc.p1Bp,
      bpB: swap ? arc.p1Bp : arc.p2Bp,
    })
  }
  for (const { windowBp, entries } of byContigPair.values()) {
    for (const cluster of linkWithinWindow(entries, windowBp)) {
      const id = sizeOf.length
      // Fragments, not records: a PCR or optical copy adds nothing.
      sizeOf.push(
        cluster.length === 1
          ? 1
          : new Set(cluster.map(m => fragmentEndsKey(arcs[m.index]!, m.index)))
              .size,
      )
      for (const m of cluster) {
        clusterOf[m.index] = id
      }
    }
  }
  return { clusterOf, sizeOf }
}

// One cell of a `windowBp`-sized grid over the two coordinates, and the
// connections in it. Two points in one cell are within the window on both
// axes, and any qualifying pair is in the same or a neighbouring cell.
interface GridCell {
  cx: number
  cy: number
  members: number[]
}

// The four neighbours that, walked from every cell, visit each unordered pair of
// adjacent cells exactly once.
const FORWARD_NEIGHBORS = [
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
] as const

/**
 * The connections of one contig pair, grouped into single-linkage clusters
 * within `windowBp` on both coordinates, transitively. Grid plus union-find
 * rather than a sweep, whose cost is the local density squared, which a real
 * event maximises. `windowBp` 0 is the split-junction case: each cell is then
 * one exact coordinate pair (`windowFor`).
 */
function linkWithinWindow(entries: ClusterEntry[], windowBp: number) {
  const parent = entries.map((_, i) => i)
  function find(i: number): number {
    let root = i
    while (parent[root] !== root) {
      root = parent[root]!
    }
    while (parent[i] !== root) {
      const next = parent[i]!
      parent[i] = root
      i = next
    }
    return root
  }
  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) {
      return false
    }
    parent[rb] = ra
    return true
  }

  const cellSize = windowBp > 0 ? windowBp : 1
  const cells = new Map<string, GridCell>()
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    const cx = Math.floor(e.bpA / cellSize)
    const cy = Math.floor(e.bpB / cellSize)
    const cell = getOrCreate(cells, `${cx}\0${cy}`, () => ({
      cx,
      cy,
      members: [],
    }))
    if (cell.members.length > 0) {
      union(cell.members[0]!, i)
    }
    cell.members.push(i)
  }

  if (windowBp > 0) {
    for (const cell of cells.values()) {
      for (const [dx, dy] of FORWARD_NEIGHBORS) {
        const other = cells.get(`${cell.cx + dx}\0${cell.cy + dy}`)
        if (other) {
          joinCells(entries, cell.members, other.members, windowBp, union)
        }
      }
    }
  }

  const byRoot = new Map<number, ClusterEntry[]>()
  for (let i = 0; i < entries.length; i++) {
    getOrCreate(byRoot, find(i), () => []).push(entries[i]!)
  }
  return byRoot.values()
}

// Merge two adjacent cells if any pair across them is within the window on
// both coordinates. Each cell is already one component, so the first
// qualifying pair settles it.
function joinCells(
  entries: ClusterEntry[],
  cell: number[],
  other: number[],
  windowBp: number,
  union: (a: number, b: number) => boolean,
) {
  for (const i of cell) {
    const a = entries[i]!
    for (const j of other) {
      const b = entries[j]!
      if (
        Math.abs(a.bpA - b.bpA) <= windowBp &&
        Math.abs(a.bpB - b.bpB) <= windowBp
      ) {
        union(i, j)
        return
      }
    }
  }
}
