import { getOrCreate } from '../../shared/util.ts'

import type { PendingArc } from './arcTypes.ts'

// Arc identity and the interchromosomal support count.

// Two stages that both answer "how many reads stand behind this", by the two
// rules each family's evidence actually needs: same-chromosome connections
// coalesce on an exact `arcKey`, interchromosomal ones cluster inside a
// fragment-length window. `ComputedArc.support` carries why they differ.

// The identity of a drawn arc: two endpoints, a colour, a shape and the Y it
// plots at. Two connections agreeing on all five produce the same pixels, which
// is what makes them summable.
//
// `yBp` IS part of the key, and the argument for leaving it out — that it is
// derived from the endpoints and the shape, so arcs agreeing on the rest agree
// on it — holds in arc mode and fails in read cloud. There a mate link's Y is
// |TLEN|, a field of the record rather than a function of the drawn endpoints,
// and the two diverge exactly where the cloud is interesting: an outward-facing
// (RL) pair anchors at its mates' inner edges while TLEN spans their outer
// ones, so two RL pairs sharing those inner edges and differing in read length
// carry different template lengths. They drew as two lines at two heights and
// coalesced into one, which loses a line and reports the survivor as supported
// by both reads. In arc mode `yBp` is the half-span, so adding it here groups
// nothing differently.
//
// EXACT COORDINATES, deliberately, and it is the same rule sashimi's
// `junctionKey` follows for the same reason. A tolerance looks like the obvious
// improvement — aligners do wobble a junction by a base or two — but junctions
// genuinely cluster at this scale: over the HG002 chr12 fold-back the reads put
// feet at 86,845,554 / 86,846,342 / 86,846,818 / 86,847,127 / 86,847,804, five
// distinct events inside 2.3 kb. Merging on tolerance would draw them as one
// thick arc, which states something the data does not.
// The separator is NUL because a refName may contain any printable character —
// including the ':' and '-' a locstring uses — and two fields that can collide
// under a printable separator collapse two junctions into one arc. It must stay
// written as the ESCAPE `\0`: as a raw NUL byte in the source (which is how it
// was first committed) the file reads as binary, so `grep`, `rg` and every
// editor search silently skip all 1000 lines of it.
export function arcKey(a: {
  p1Ref: string
  p1Bp: number
  p2Ref: string
  p2Bp: number
  colorType: number
  shapeType: number
  yBp: number
}) {
  // ENDPOINT ORDER IS NORMALIZED, because the drawn arc is symmetric in it and
  // so the key has to be. `strokeArcMark` centres on (p1+p2)/2 with |p2-p1|/2 as its
  // half-width and `arcShape.test.ts` pins that as endpoint-order independent;
  // the shader takes min/max of the two. A junction whose reads name the mates
  // the other way round therefore paints the identical pixels.
  //
  // Keying on the raw order did not fold those together, and that halved the
  // very channel this key exists to feed. Measured over the HG02768 inverted
  // duplication (1:39,658,200-39,661,800): the junction at 39,658,994 /
  // 39,660,047 resolved as TWO arcs, support 7 and support 4, drawn on top of
  // each other in the same opaque colour — so its stroke width reported 7 reads
  // (or 4, whichever painted last) at a junction 11 reads support. Which of the
  // two you saw depended on nothing the reader can see.
  const swap = a.p1Ref === a.p2Ref ? a.p2Bp < a.p1Bp : a.p2Ref < a.p1Ref
  const [r1, b1, r2, b2] = swap
    ? [a.p2Ref, a.p2Bp, a.p1Ref, a.p1Bp]
    : [a.p1Ref, a.p1Bp, a.p2Ref, a.p2Bp]
  return `${r1}\0${b1}\0${r2}\0${b2}\0${a.colorType}\0${a.shapeType}\0${a.yBp}`
}

// The Y an interchromosomal arc plots at: the top of the band, at every zoom.
//
// Arc mode's axis is GENOMIC RADIUS, and an interchromosomal connection has no
// radius — but the ceiling is not an invented position on it either. It is
// exactly where a maximally-far same-chromosome pair already ends up:
// `arcYOffsetPx` clamps its offset to `availH`, and in arc mode the domain is
// the bp span that FITS the band at the current zoom, so any pair wider than
// that is already drawn there. The arc says "as far as this axis goes" rather
// than claiming a distance it does not have.
//
// Uint32 max, because it has to exceed that zoom-dependent domain at every zoom
// (the largest it reaches is ~availH * bpPerPx, three orders below this even on
// a whole-genome view of a mammalian assembly) and because `arcYBp` is a
// Uint32Array — which an interchromosomal arc never reaches, being cross-region
// by construction, but the value should not be the thing that depends on it.
export const INTERCHROM_ARC_YBP = 0xffffffff

// Fallback clustering window when the fetch produced no insert-size band —
// unpaired data, or too few proper pairs to characterize one. A translocation
// found by split reads rather than by mates has its evidence at the breakpoint
// itself, so a window is not what it needs; this is only so the pass has a
// finite number when `stats` is absent.
export const DEFAULT_INTERCHROM_WINDOW_BP = 1000

// Which reads agree on each interchromosomal connection, grouped over a WINDOW
// rather than at a coordinate — see `InterchromClusters` for the shape and why
// it is an identity rather than the count it returned first.
//
// BOTH MARKS' OWN `support` COMES OUT OF THIS, not just the floor's input — see
// `ComputedArc.support` and `pushLine` — which is why it runs at every setting
// rather than only above the floor.
//
// A mate-pair breakpoint is not localized to a base. The two mates straddle it,
// so a read supporting a translocation can start anywhere within about one
// fragment length of it, and the fetched pairs land scattered across that span
// rather than stacked on a coordinate. `arcKey` counts exact coincidences, which
// is right for the split junctions it was written for (a split read KNOWS the
// breakpoint to the base — see its comment, and the HG002 chr12 fold-back it
// cites) and counts almost nothing here: measured on HG002 300x over 200 kb at
// 1:2,000,000, 862 of 865 interchromosomal connections were the sole occupant of
// their coordinate.
//
// So a support floor over `arcKey`'s count would delete a real translocation as
// thoroughly as the noise — every one of its hundred supporting pairs is a
// singleton at its own bp. Counting over a window is what makes the floor mean
// "this breakpoint has evidence" instead of "two reads happened to start on the
// same base".
//
// BOTH SIDES have to agree, and that is the discriminator. Real supporting pairs
// cluster at the source AND point into the same window on the partner
// chromosome; mismapping clusters at neither. A one-sided window would instead
// merge unrelated breakpoints that happen to sit near each other, manufacturing
// support out of local density — which is exactly how the same-chromosome
// version of this idea failed when it was measured (see
// `agent-docs/reference/DEEP_COVERAGE.md`), and is why this is offered for the
// interchromosomal family only.
//
// SINGLE-LINKAGE OVER BOTH COORDINATES AT ONCE — two connections join when they
// are within the window on `bpA` AND on `bpB`, and a cluster is the transitive
// closure of that. A run of reads stepping across the span therefore stays one
// cluster, which is the property the whole pass exists for.
//
// It is stated that way because the relation is SYMMETRIC IN THE TWO CONTIGS and
// the implementation has to be. Running the rule hierarchically — group into runs
// on `bpA`, then re-run it on `bpB` within each run — is not the same relation
// and is not symmetric: a `bpA` gap splits a run before `bpB` is ever consulted,
// so two connections that agree on both coordinates can land in different
// clusters because a third connection sat between them on one axis only. Which
// axis is `bpA` is decided by `swap` below, i.e. by which contig NAME sorts
// first, so the answer depended on refName spelling. The same three connections
// scored `[2, 1]` one way round and `[1, 1, 1]` transposed — and at the default
// floor of 2 that is the difference between a breakpoint drawn and a breakpoint
// deleted. `arcClustering.test.ts` holds the transpose.
//
// Chaining ONE open cluster along `bpA` and testing each entry's `bpB` against
// its members is what the hierarchical form itself replaced, and it lost reads to
// the order they arrived in. Real support and mismapping interleave along the
// source contig, so a noise entry sorts into the middle of a real cluster;
// failing the mate test, it closed that cluster and opened its own, and the
// supporting pairs after it were counted as a separate event. Measured on the
// five-pair fixture in `compute.test.ts`, a four-read breakpoint scored 1 and 3.
//
// WHAT IS STILL SINGLE-LINKAGE'S TO OWN: the window bounds the GAP between
// neighbours, not the DIAMETER of the cluster, so 40 pairs spaced exactly one
// window apart chain into one cluster spanning 39 of them. The comment above
// reads as a diameter claim ("how far a supporting read can sit from the
// breakpoint is one fragment length") and the rule is a density one. That is a
// live question about what the floor means at depth rather than a slip —
// `agent-docs/ideas/bound-an-interchromosomal-clusters-diameter.md`.
// One interchromosomal connection, in the endpoint order the clustering keys on:
// `bpA` on the lexicographically-first contig, `bpB` on the other, `index` back
// into the caller's `pendingArcs`.
export interface ClusterEntry {
  index: number
  bpA: number
  bpB: number
}

// The clustering's answer, as an IDENTITY per connection rather than the bare
// count it used to be, because the two marks spend it differently. An arc is a
// whole junction, so its number is its own cluster's size and an index into
// `sizeOf` says it. A tick is half a junction and several clusters can reach one
// coordinate, so it sums the DISTINCT ones — which no per-connection number can
// answer, since adding two connections of one cluster would double it. See
// `pushLine`.
export interface InterchromClusters {
  // Cluster index per `pendingArcs` entry, -1 for an intra-chromosomal one.
  // Those are never read: the caller asks only from inside its own
  // interchromosomal branch, so walking the whole array is what lets the two
  // agree BY INDEX rather than by a counter kept in step with a filter.
  clusterOf: number[]
  // Connections in each cluster, indexed by cluster.
  sizeOf: number[]
}

// THE WINDOW IS A PROPERTY OF THE EVIDENCE, NOT OF THE CHROMOSOMES.
//
// A window is the right answer for a MATE LINK and the wrong one for a SPLIT
// JUNCTION, and this pass keyed on interchromosomal-ness — which correlates with
// neither. The comment above already states the principle ("a split read KNOWS
// the breakpoint to the base") and `arcKey` is written on it at length: over the
// HG002 chr12 fold-back the reads put feet at 86,845,554 / 86,846,342 /
// 86,846,818 / 86,847,127 / 86,847,804, FIVE DISTINCT EVENTS INSIDE 2.3 kb, and
// merging on a tolerance "would draw them as one thick arc, which states
// something the data does not". Every gap there is under 1 kb, so the default
// window would have chained all five into one cluster reporting 5.
//
// That is not hypothetical on the interchromosomal side either. K562's BCR-ABL1
// is ONE donor and 24 ACCEPTORS (reference/DEMO_DATASETS.md): the chr22 donor is
// exact to a few bases while the chr9 sites spread over ~154 kb, and whether the
// 154-read site is an alternative acceptor or an alignment artefact is exactly
// the question a reader brings to that figure. Chaining acceptors under a
// fragment-length window answers it for them, wrongly.
//
// So a split junction clusters at WINDOW 0, which the same single-linkage walk
// already expresses: a run ends wherever consecutive values differ at all, so
// runs become groups sharing both coordinates exactly — `arcKey`'s coincidence
// count, arrived at through this pass so the floor, the arc's weight and the
// tick's sum all keep reading one number.
export function windowFor(arc: PendingArc, mateWindowBp: number) {
  return arc.isSplit ? 0 : mateWindowBp
}

/**
 * Whether one interchromosomal cluster's evidence clears the user's support
 * floor — and a SPLIT junction is exempt from it outright.
 *
 * THE FLOOR HAS THE SAME AXIS AS THE WINDOW, and only the window had been given
 * it. `windowFor` above is the whole argument, one step further on: a floor over
 * scattered mate pairs means "this breakpoint gathered evidence", and the
 * windowing exists so that it can. Over a split junction it means something else
 * entirely — "fewer than N reads broke at this exact base" — which nothing here
 * measured and which the count cannot support, because a split junction is
 * counted at window 0 and two reads whose aligner placed the same junction three
 * bases apart are two clusters of one.
 *
 * `DEFAULT_MIN_INTERCHROM_SUPPORT` is measured on mate pairs — HG002 300x, 844
 * of 856 breakpoints carrying exactly one read — and mismapping is what that
 * measures. A split read is not indirect evidence that scatters; it CROSSES the
 * breakpoint. Inheriting the mate floor meant a translocation carried by one
 * chimeric read drew nothing at all, by default, which on unpaired long-read
 * data is the only evidence there is.
 *
 * The trade, so it can be dialled back if a deep short-read view gets noisy: a
 * chimeric alignment to another contig is itself a mismapping mode, and those
 * now draw at support 1 — the base stroke width, the thinnest mark the band has,
 * and still behind "Show inter-chromosomal pairs". Making the exemption
 * conditional on `hasPaired` was the alternative considered; it ties an
 * evidence-kind rule to a dataset-wide property, and a paired library whose
 * chimeric reads carry the real signal is exactly the cancer case.
 */
export function clearsInterchromFloor(
  isSplit: boolean,
  support: number,
  minInterchromSupport: number,
) {
  return isSplit || support >= minInterchromSupport
}

export function clusteredInterchromSupport(
  arcs: PendingArc[],
  mateWindowBp: number,
): InterchromClusters {
  const clusterOf = new Array<number>(arcs.length).fill(-1)
  const sizeOf: number[] = []
  // ENDPOINT ORDER IS NORMALIZED before anything is keyed or compared, on
  // refName, which is `arcKey`'s rule and is here for the same reason: the
  // event is symmetric in endpoint order, so the count over it has to be.
  //
  // Which direction a connection arrives in is chance. `mateLinkArc` puts the
  // FIRST-IN-PAIR mate at p1, and which mate of a pair landed on which contig
  // is nothing but which end of the fragment was sequenced first, so one
  // translocation reaches here as chr1->chr7 from some of its pairs and as
  // chr7->chr1 from the others. Keyed raw, those are two clusters carrying half
  // the support each — and at the default floor of 2 an event supported by one
  // pair in each direction vanishes outright, both clusters counting 1. That is
  // the ordinary two-region SV view, where both contigs are on screen and every
  // pair therefore resolves as a mate link rather than as an off-screen one.
  //
  // Only the COUNTING is folded. Each tick still draws at the coordinate its own
  // read put it at — see the caller.
  //
  // The normalized endpoints are carried on one small record per
  // INTERCHROMOSOMAL arc rather than in two arrays sized to `arcs`: intra-chrom
  // connections outnumber these by ~10:1 on deep short-read data (9204 arcs, 865
  // of them interchromosomal, measured at 1:2,000,000 on HG002 300x), and only
  // `clusterOf` has to span the whole feed.
  // Keyed on the WINDOW as well as the contig pair, so two kinds of evidence
  // never land in one bucket to be walked at one of their windows. Keyed on the
  // window itself rather than on `isSplit` because the window IS the grouping
  // criterion: kinds that agree on it can share a bucket safely, and one that
  // does not cannot.
  //
  // A breakpoint carrying both kinds therefore yields a split cluster and a mate
  // cluster, each counted the way its own evidence localizes. That is two
  // measurements reported separately, not a double count — they are different
  // marks, at the coordinates their own reads put them at.
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
      sizeOf.push(cluster.length)
      for (const m of cluster) {
        clusterOf[m.index] = id
      }
    }
  }
  return { clusterOf, sizeOf }
}

// One cell of a `windowBp`-sized grid over the two coordinates, and the
// connections in it. The cell size is the window itself, which is what makes the
// intra-cell union free: two points inside one cell differ by less than
// `windowBp` on both axes by construction, so they join without a comparison,
// and any two points that DO qualify are in the same cell or in one of its eight
// neighbours.
//
// `cx`/`cy` are carried rather than parsed back out of the map key, since the
// neighbour walk needs them as numbers and a key that has to be re-split is a
// second encoding of the same two values.
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
 * The connections of one contig pair, grouped into single-linkage clusters under
 * the symmetric rule: within `windowBp` on BOTH coordinates, transitively.
 *
 * Grid + union-find rather than a sweep, because the sweep's cost is the local
 * density squared and the density is exactly what a real event maximises: a
 * translocation at 300x puts ~100 pairs inside one fragment length, and a repeat
 * pileup can put far more. Cells are the window's own size, so every point in a
 * cell joins for free and only the eight neighbouring cells need comparisons —
 * and since a cell is already ONE component, the first qualifying cross pair
 * merges both cells whole and the rest of that pair's comparisons are skipped.
 *
 * `windowBp` 0 is the split-junction case and takes the same shape with no
 * neighbourhood at all: the cell key is then the exact coordinate pair, which is
 * `arcKey`'s coincidence count arrived at through this pass — see `windowFor`.
 */
function linkWithinWindow(entries: ClusterEntry[], windowBp: number) {
  const parent = entries.map((_, i) => i)
  function find(i: number): number {
    let root = i
    while (parent[root] !== root) {
      root = parent[root]!
    }
    // Path-halving, so a long chain of near-neighbours does not make each later
    // lookup walk it again.
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

  // Window 0 has no neighbourhood: a cell is then one exact coordinate pair, and
  // the grid degenerates to the coincidence grouping `arcKey` does — which is
  // `windowFor`'s split-junction arm arriving here rather than being a second
  // code path. Sizing the cells at 1 keeps that a case of the same expression.
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
      // Free: same cell means within the window on both axes.
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

// Merge two adjacent cells if any pair across them is within the window on both
// coordinates. ONE qualifying pair settles it and the scan stops there: each cell
// is already a single component, so that union merges both whole and every
// further comparison between them is answering a question with no consequence.
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
