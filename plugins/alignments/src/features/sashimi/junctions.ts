// The junction set behind sashimi arcs, and which sub-band each junction lands
// in. Both questions are answered here, in genomic bp, from the worker's
// `rpcDataMap` alone:
//
//   - the LAYOUT asks whether a lane needs the strip below coverage reserved
//     (`sashimiDownKeysByGroup` -> non-empty set), and must not depend on
//     pan/zoom or the pileup would re-lay-out on every frame;
//   - the OVERLAY/EXPORT asks which side to draw each arc on
//     (`computeSashimiArcs`, which looks its arcs up in the same set).
//
// They used to be two separate O(n^2) crossing passes — a genomic one over every
// loaded region for the layout, a screen-space one over the visible ones for the
// geometry — that were only *argued* to agree ("it only ever over-reserves").
// Nothing enforced it, and under-reservation is the bad direction: the down
// sub-band renders at `sashimiArcsHeight` whether or not the layout reserved it,
// so an arc sent down into an unreserved strip paints over the top of the
// pileup. One decision, read by both, cannot disagree with itself.
//
// Genomic bp rather than screen px is also the more stable answer: interleaving
// survives any monotonic projection, so within a region it matches what a
// screen-space assignment would decide, and it doesn't flip an arc between bands
// as regions scroll in and out of view.

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'

// Sashimi placement, owned here because it selects the assignment algorithm
// below (the display imports it via constants.ts): 'up' draws every arc over the
// coverage band, 'down' in the reserved strip below it, 'auto' splits each
// junction to minimize crossings.
export const SASHIMI_ARCS_MODES = ['up', 'down', 'auto'] as const
export type SashimiArcsMode = (typeof SASHIMI_ARCS_MODES)[number]

// Which sub-band an arc is drawn in: 'up' overlays the coverage histogram,
// 'down' sits in the reserved strip below it. Each side's geometry is in its own
// band-local coordinates, so the overlay/export place each in the matching SVG.
export type SashimiSide = 'up' | 'down'

// A junction's identity, and the ONE spelling of it. The layout's side
// assignment and the geometry's cross-region merge both key on this, so a
// mismatch between them is not expressible. refName is part of the key because
// two chromosomes on screen at once (a fusion view) share nothing but a bp
// number line — without it, chr1:10k-50k and chr2:30k-70k read as one junction's
// worth of interleaving and reserved a strip no arc was ever bound for.
export function junctionKey(refName: string, start: number, end: number) {
  return `${refName}:${start}:${end}`
}

// One junction, merged across every region that re-emitted it.
export interface MergedJunction {
  key: string
  refName: string
  start: number
  end: number
  count: number
  strand: number
}

// The sashimi slice of a worker result. Narrowed to what the merge reads so the
// tests (and `groupedDataMaps`, which walks `GroupedAlignmentsResult`) don't
// have to build a whole WorkerPileupData.
export type SashimiFields = Pick<
  WorkerPileupData,
  'sashimiX1' | 'sashimiX2' | 'sashimiCounts' | 'sashimiStrands'
>

export interface RegionJunctions {
  refName: string
  data: SashimiFields
}

// Bucket the per-region worker output into one entry per junction, dropping
// anything under the score floor.
//
// The duplication being collapsed: the per-region worker re-emits a junction in
// EVERY region its supporting reads reach, because an overlap query matches a
// read's full reference span, which by definition covers the skip gap. So an
// exon-skipping junction turns up in the exons it jumps over too, and collapsed
// introns (one refName -> many displayedRegions) hit this on every gene.
//
// Counts are NOT guaranteed equal, so the merge keeps the max rather than the
// first: a region spanning the junction sees every read carrying it, but one
// merely abutting an end sees only the reads whose alignment reaches into it — a
// strict subset. Every region's count is a lower bound, so the largest is the
// best available estimate, and the heavier copy wins the strand tint with it.
//
// Callers pass different region sets on purpose: the layout merges every LOADED
// region (it must not depend on pan), the geometry merges the VISIBLE ones (a
// junction only an off-screen region reported shouldn't draw at all). Loaded is
// a superset of visible, so every drawn junction is one the layout also saw.
export function mergeJunctions(
  regions: Iterable<RegionJunctions>,
  minSashimiScore: number,
) {
  const out = new Map<string, MergedJunction>()
  for (const { refName, data } of regions) {
    const { sashimiX1, sashimiX2, sashimiCounts, sashimiStrands } = data
    for (let i = 0; i < sashimiX1.length; i++) {
      const count = sashimiCounts[i]!
      if (count < minSashimiScore) {
        continue
      }
      const start = sashimiX1[i]!
      const end = sashimiX2[i]!
      const key = junctionKey(refName, start, end)
      const prev = out.get(key)
      if (prev === undefined) {
        out.set(key, {
          key,
          refName,
          start,
          end,
          count,
          strand: sashimiStrands[i]!,
        })
      } else if (count > prev.count) {
        prev.count = count
        prev.strand = sashimiStrands[i]!
      }
    }
  }
  return out
}

// Two junctions "cross" when their spans strictly interleave (a < c < b < d) —
// not nested and not disjoint. Nested/disjoint pairs never visually collide once
// heights are span-scaled, so only crossings need pulling onto opposite sides.
// Junctions sharing an endpoint (same donor or same acceptor, common in
// alternative splicing) are nested, not crossing, so `x.start < y.start` must be
// strict — otherwise a shared-start pair gets needlessly split across bands.
function crosses(a: MergedJunction, b: MergedJunction) {
  const [x, y] = a.start <= b.start ? [a, b] : [b, a]
  return x.start < y.start && y.start < x.end && x.end < y.end
}

// How many already-placed junctions on one side this one would interleave with.
function countCrossings(placed: MergedJunction[], a: MergedJunction) {
  let n = 0
  for (const o of placed) {
    if (crosses(a, o)) {
      n++
    }
  }
  return n
}

// Greedy 2-coloring for 'auto': place each junction on the side it crosses
// least, so interleaving junctions separate above/below the coverage. Processed
// heaviest-first (ties broken by start) so when a crossing forces a split the
// higher-count junction claims the upper band and the lighter one drops.
//
// O(n^2) is fine — this runs over MERGED junctions, so the collapsed-intron case
// that re-emits one gene's junctions in each of its exon regions costs what one
// region's worth costs, not N^2 times it.
function autoDownKeys(junctions: MergedJunction[]) {
  const up: MergedJunction[] = []
  const down: MergedJunction[] = []
  const heaviestFirst = [...junctions].sort(
    (p, q) => q.count - p.count || p.start - q.start,
  )
  for (const j of heaviestFirst) {
    if (countCrossings(up, j) <= countCrossings(down, j)) {
      up.push(j)
    } else {
      down.push(j)
    }
  }
  return down
}

// Junctions bucketed by chromosome. Each refName's displayed regions occupy
// their own screen range, so junctions on different ones cannot visually
// collide and must not influence each other's side.
function byRefName(junctions: Iterable<MergedJunction>) {
  const out = new Map<string, MergedJunction[]>()
  for (const j of junctions) {
    const list = out.get(j.refName)
    if (list) {
      list.push(j)
    } else {
      out.set(j.refName, [j])
    }
  }
  return out
}

const NO_DOWN_KEYS: ReadonlySet<string> = new Set()

// Which of these junctions the current mode sends to the strip below coverage,
// as a set of `junctionKey`s. 'up' sends none (and allocates nothing — it is the
// default), 'down' sends all, 'auto' runs the greedy 2-coloring per chromosome.
// The set being non-empty is exactly "this lane needs the strip reserved".
export function downJunctionKeys(
  junctions: Iterable<MergedJunction>,
  mode: SashimiArcsMode,
): ReadonlySet<string> {
  if (mode === 'up') {
    return NO_DOWN_KEYS
  }
  const out = new Set<string>()
  if (mode === 'down') {
    for (const j of junctions) {
      out.add(j.key)
    }
  } else {
    for (const perRef of byRefName(junctions).values()) {
      for (const j of autoDownKeys(perRef)) {
        out.add(j.key)
      }
    }
  }
  return out
}
