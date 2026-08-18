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
// Single-linkage on each side in turn, so a run of reads stepping across the
// span stays one cluster: group the sorted entries into runs on `bpA`, then
// re-sort each run on `bpB` and run the same rule again. Two sorts and two
// linear passes, and no comparison of an entry against a cluster's members.
//
// Chaining ONE open cluster along `bpA` and testing each entry's `bpB` against
// its members is what this replaces, and it lost reads to the order they arrived
// in. Real support and mismapping interleave along the source contig, so a noise
// entry sorts into the middle of a real cluster; failing the mate test, it closed
// that cluster and opened its own, and the supporting pairs after it were counted
// as a separate event. Measured on the five-pair fixture in `compute.test.ts`, a
// four-read breakpoint scored 1 and 3 — below the default floor of 2 for the
// first of them, and below any floor the real count clears.
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
    entries.sort((a, b) => a.bpA - b.bpA)
    forEachRun(
      entries,
      e => e.bpA,
      windowBp,
      run => {
        run.sort((a, b) => a.bpB - b.bpB)
        forEachRun(
          run,
          e => e.bpB,
          windowBp,
          cluster => {
            const id = sizeOf.length
            sizeOf.push(cluster.length)
            for (const m of cluster) {
              clusterOf[m.index] = id
            }
          },
        )
      },
    )
  }
  return { clusterOf, sizeOf }
}

// Single-linkage runs over a list already sorted on `valueOf`: a run ends
// wherever consecutive values are further apart than `windowBp`.
export function forEachRun<T>(
  sorted: T[],
  valueOf: (item: T) => number,
  windowBp: number,
  onRun: (run: T[]) => void,
) {
  let start = 0
  for (let i = 1; i <= sorted.length; i++) {
    if (
      i === sorted.length ||
      valueOf(sorted[i]!) - valueOf(sorted[i - 1]!) > windowBp
    ) {
      onRun(sorted.slice(start, i))
      start = i
    }
  }
}
