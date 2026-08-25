import { assembleLocStringRaw } from '@jbrowse/core/util'

import { getOrCreate } from '../../shared/util.ts'

import type { SegAln } from '../arcs/arcTypes.ts'

// A derivative allele is an ordered, oriented list of reference intervals, and
// that is exactly what a split read's segment chain already is. So the proposal
// needs no caller, no consensus contig and no new alignment: group the reads in
// view by the PATH their chains describe, and the size of each group is that
// path's support.
//
// What this deliberately does NOT do is decide whether a path is real. It ranks
// candidates by how many independent reads describe them and hands the top ones
// back for a person to look at. A confident-looking path built from reads
// mismapped into a repeat looks exactly like a true one here, which is why the
// output is a proposal rather than a call.
//
// The rules this grouping arrived at, stated without the alleles, are
// `agent-docs/mechanisms/derivative-allele-candidates.md`.

export interface DerivativeSegment {
  refName: string
  start: number
  end: number
  // -1 means the segment is traversed against the reference, i.e. it is drawn
  // flipped and its locstring carries `[rev]`
  strand: number
}

export interface DerivativeCandidate {
  /**
   * What the view OPENS on: the reads' segments grown outward by `flank` at the
   * two ends of the path, so the picture carries reference either side of the
   * outermost junctions rather than starting flush against them.
   *
   * Not the evidence. The growth is context this layer added, so anything asking
   * how much reference the reads actually covered reads `observedSegments`
   * instead — see it for why the difference is not cosmetic.
   */
  segments: DerivativeSegment[]
  /**
   * What the READS saw: the same segments without the context flank.
   *
   * The two differ only at the path's two outer edges, and only by `flank`, and
   * that is still enough to invert the judgement the picker asks a reader to
   * make. The caveat above the candidate list says a route whose segments are
   * all about one read long is an aligner splitting a read rather than an
   * allele. A short-read path is TWO segments, so both of them are outer ones:
   * 96bp and 54bp of evidence are drawn as 2096bp and 2054bp, and the row that
   * is supposed to expose the artefact reports two comfortable two-kilobase
   * blocks. The strip and the size summary read this field for that reason.
   */
  observedSegments: DerivativeSegment[]
  /**
   * Opaque identity of the ROUTE: the grouping key itself, built from the
   * clustered junctions alone.
   *
   * Nothing may parse it — its spelling is `pathSignature`'s business. It
   * exists because a consumer holding "which candidate did the user pick" has
   * nothing else honest to hold. `locString` and `segments` both carry the
   * OUTER edges, which come from whichever supporting read was widest, so they
   * move when a wider read lands while the list is on screen; `readCount` and
   * `refNames` move or collide for their own reasons. The junctions are the
   * allele, and this is the junctions.
   *
   * It survives that widening, and `buildClusterOf` labels a cluster by the
   * coordinate most reads gave it so that it survives another read arriving
   * too — but it is not absolutely stable, and a consumer holding one has to
   * cope with losing it: a route whose two reads disagree about a junction has
   * no mode, so a third can still rename it.
   */
  pathId: string
  // Number of distinct reads whose chain describes this path.
  readCount: number
  // Space-separated locstrings, in derivative order, `[rev]` on flipped
  // segments: paste into the location box and the view lays the allele out.
  locString: string
  // Chromosomes touched, in derivative order, deduplicated for a compact label.
  refNames: string[]
  // True when some segment of the representative chain was known only from an
  // SA tag, i.e. the path leaves what is currently displayed. Purely
  // informational: it is the normal case for an interchromosomal event.
  extendsOffScreen: boolean
  /**
   * `pathId` of the most-supported candidate whose junctions contain this one's
   * as a contiguous run, read from either end. A read crossing only the first
   * junction of a three-junction allele describes a route of its own here, and
   * that route is not a competing allele: it is consistent with the longer one
   * and cannot tell it from a simpler event. Its reads stay uncredited to the
   * longer route, since they say nothing about the junctions they did not
   * cross, so this names the relation for the picker to show instead. Absent
   * when no candidate above the floor contains it.
   */
  partOf?: string
}

/**
 * What one chain IS on the display the paths are computed for, which decides
 * how the picker counts, floors and explains them. A read pileup chains reads
 * and can reach segments off screen through their SA tags; an assembly's
 * synteny track chains contigs, of which a locus carries one or two, and a PAF
 * block names nothing the view has not fetched.
 */
export interface DerivativePathEvidence {
  noun: string
  minReads: number
  namesOffScreenSegments: boolean
}

export interface ComputeDerivativePathsOpts {
  chains: SegAln[][]
  /**
   * How far apart two reads may place one junction and still be describing the
   * same one, in bp. They agree only to within the aligner's placement of the
   * breakpoint, so endpoints are clustered at this width before being compared
   * (`buildClusterOf`). Too tight and one event splits into many one-read
   * candidates; too loose and neighbouring events merge, which on COLO829's
   * chr9 fold-back means two real alleles reported as one.
   */
  tolerance?: number
  /**
   * Drop paths with less support than this.
   *
   * A presentation floor, not a verdict: it is what makes a row "a route
   * several reads agree on" rather than "a route", and the dialog says so in
   * those words. It is emphatically NOT a judgement that a one-read chain is
   * mismapped — this file has no way to know that, and the moment this number
   * is defended as quality control it has become a caller's FILTER column with
   * no way to see what it removed.
   */
  minReads?: number
  /**
   * Context to show beyond the outermost junctions. The interior segments are
   * pinned by junctions on both sides, but the first and last are open — a read
   * starts and ends wherever it happens to — so they are extended by this much
   * rather than ending at one arbitrary read's edge.
   */
  flank?: number
}

const DEFAULTS = {
  tolerance: 20,
  minReads: 2,
  flank: 2000,
}

/**
 * #api
 * The reference coordinate the path ARRIVES at this segment by.
 *
 * The read enters a forward segment at its lower coordinate and a reverse one at
 * its higher. Read order is not genomic order, so every edge here is asked for
 * by ROLE (entry/exit along the read), never by min/max — and this pair is
 * exported because the rule has a consumer outside the grouping: a drawing that
 * opens one panel per segment has to point each panel at the junction that
 * segment carries. Spelled a second time there, nothing held the two spellings
 * against each other, and getting one backwards is invisible rather than loud —
 * the panel opens a segment-length from where the reads land and simply draws no
 * connections.
 */
export function segmentEntryBp(seg: {
  start: number
  end: number
  strand: number
}) {
  return seg.strand === -1 ? seg.end : seg.start
}

/**
 * #api
 * The reference coordinate the path LEAVES this segment by.
 *
 * The mirror of {@link segmentEntryBp}, and exported for the same consumer.
 */
export function segmentExitBp(seg: {
  start: number
  end: number
  strand: number
}) {
  return seg.strand === -1 ? seg.start : seg.end
}

// Where a junction endpoint sits, to within the tolerance. A lookup rather than
// arithmetic, because arithmetic cannot express "within N bp of each other":
// `Math.round(bp / tolerance)` asks which fixed bucket a coordinate falls in, so
// two endpoints 1 bp apart get different answers whenever they straddle a bucket
// edge, and two 10 bp apart do so half the time. The failure is silent and it
// bites real data — swept over the 20 offsets of one bucket, the COLO829 der(3)
// fixture reports its support as anything from 24 to 28 reads and grows a
// spurious second candidate at 14 of them, purely from where the locus sits
// relative to a multiple of 20.
//
// So the endpoints are collected up front and clustered per refName, seeded at
// the coordinates MOST reads placed a junction at, ties to the lower: each
// seed, taken in descending-count order, claims every unclaimed endpoint
// within the tolerance of it, and unclaimed endpoints seed in their turn.
// Reads stack exactly on an unambiguous breakpoint, so the modes ARE the
// junctions and the jitter joins whichever junction it lies within tolerance
// of. The cut points are decided by the data's own weight, so the answer moves
// neither when the whole locus does nor when a stray endpoint lands beside it.
//
// The stray endpoint is why this is mode-seeded rather than the leader sweep it
// replaces (sorted ascending, a new cluster opened when an endpoint is further
// than the tolerance from the one that OPENED the current one). A leader sweep
// anchors each cluster on the LOWEST endpoint anybody supplied, so one
// jittered read landing just left of a stacked junction re-anchored the whole
// cluster and cut the junction's own upper placements off into a second one —
// one allele reported as two candidates with its support divided, caused by a
// single 1-read chain the `minReads` floor was about to discard anyway.
//
// And it is mode-seeded rather than single linkage for the reason the leader
// sweep was: linking each endpoint to its nearest neighbour lets clusters
// chain, and COLO829's chr9 fold-back is a real case where they do. Two
// distinct junctions sit 28 bp apart there (the breakage-fusion-bridge
// re-break `realReads.foldback` is about), and read-placement jitter between
// them bridges the two into one cluster, merging two alleles into one
// candidate. A seed claims only what lies within the tolerance of the seed
// itself, and two junctions further apart than the tolerance are two modes, so
// each seeds its own cluster and the jitter between them joins one or the
// other rather than fusing them.
//
// The seed doubles as the cluster's label — what `pathSignature` spells, i.e.
// what `pathId` is, i.e. what the picker holds a user's chosen route by over a
// streaming pileup. The mode is the stable choice for that too: labelled by
// the sweep's own leader, the real COLO829 chains renamed the der(3) route a
// mean of 2.98 times per run over 40 arrival orders; labelled by the mode,
// 0.10. SV_MULTIHOP.md has the measurement.
type ClusterOf = (refName: string, bp: number) => number

function junctionEndpoints(chain: SegAln[]) {
  const out: { refName: string; bp: number }[] = []
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i]!
    const b = chain[i + 1]!
    out.push({ refName: a.refName, bp: segmentExitBp(a) })
    out.push({ refName: b.refName, bp: segmentEntryBp(b) })
  }
  return out
}

function lowestIndexAtOrAbove(sorted: number[], value: number) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < value) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

function buildClusterOf(chains: SegAln[][], tolerance: number): ClusterOf {
  const byRef = new Map<string, Map<number, number>>()
  for (const chain of chains) {
    for (const { refName, bp } of junctionEndpoints(chain)) {
      const counts = getOrCreate(
        byRef,
        refName,
        () => new Map<number, number>(),
      )
      counts.set(bp, (counts.get(bp) ?? 0) + 1)
    }
  }
  const ids = new Map<string, number>()
  for (const [refName, counts] of byRef) {
    const sorted = [...counts.keys()].sort((a, b) => a - b)
    const seeds = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )
    for (const [seedBp] of seeds) {
      if (!ids.has(`${refName}:${seedBp}`)) {
        for (
          let i = lowestIndexAtOrAbove(sorted, seedBp - tolerance);
          i < sorted.length && sorted[i]! <= seedBp + tolerance;
          i++
        ) {
          const key = `${refName}:${sorted[i]!}`
          if (!ids.has(key)) {
            ids.set(key, seedBp)
          }
        }
      }
    }
  }
  // The fallback is unreachable by construction — a chain and its reverse
  // complement ask about the same coordinates, since reversing swaps which
  // segment's entry and which segment's exit a junction is named by without
  // moving either — and is here so that a caller passing a chain the clusters
  // were not built from degrades to exact matching rather than to `undefined`.
  return (refName, bp) => ids.get(`${refName}:${bp}`) ?? bp
}

// Identity of a path, and the one piece of judgement in this file. It is built
// from the JUNCTIONS only, never from the chain's outer edges: two reads
// crossing the same rearrangement agree on where the pieces join and disagree on
// where each read happens to start and stop, so folding the outer edges in would
// give every read its own signature and every candidate a support of 1.
function junctionParts(chain: SegAln[], clusterOf: ClusterOf) {
  const parts: string[] = []
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i]!
    const b = chain[i + 1]!
    parts.push(
      `${a.refName}:${clusterOf(a.refName, segmentExitBp(a))}:${a.strand}>${
        b.refName
      }:${clusterOf(b.refName, segmentEntryBp(b))}:${b.strand}`,
    )
  }
  return parts
}

function pathSignature(chain: SegAln[], clusterOf: ClusterOf) {
  return junctionParts(chain, clusterOf).join('|')
}

function isContiguousRun(sub: string[], sup: string[]) {
  if (sub.length >= sup.length) {
    return false
  }
  for (let offset = 0; offset + sub.length <= sup.length; offset++) {
    if (sub.every((part, i) => part === sup[offset + i])) {
      return true
    }
  }
  return false
}

function totalSpan(chain: SegAln[]) {
  return chain.reduce((sum, seg) => sum + (seg.end - seg.start), 0)
}

// The same allele read from its other end: reverse the segment order and flip
// every strand. Two reads crossing one molecule in opposite directions describe
// exactly this pair, and an allele and its reverse complement are the SAME
// allele, so the two have to be folded together before anything is counted. The
// SA segments this reads are not strand-normalized into the read's reference
// orientation, so both readings really do occur in one fetch: on COLO829's
// der(3), 16 reads describe it one way and 10 the other.
function reverseComplementChain(chain: SegAln[]): SegAln[] {
  return [...chain].reverse().map(seg => ({ ...seg, strand: -seg.strand }))
}

// Fold each chain onto one of its two readings, so that two reads crossing one
// molecule in opposite directions land in one group.
//
// The choice is made from the SIGNATURES, i.e. from junctions alone, for the
// same reason the signature itself excludes the outer edges: those edges are
// where a read happens to start and stop, so any rule that consults them is
// answering a question about the read rather than about the allele. Ranking by
// the first segment's start — the obvious "present it from its lower coordinate"
// rule — does exactly that, and it splits an allele in two: a read covering a
// long stretch of the first arm ranks its forward reading lower, a read that
// clips early in that arm but runs far down the last one ranks its reverse
// reading lower, and the two are then counted as separate events. On COLO829's
// der(3) that reported one 26-read allele as a 16-read and a 10-read candidate,
// which is the bug the folding was added to prevent (`realReads.colo829.test.ts`
// pins the merged count against the records themselves).
//
// Which of the two readings wins is arbitrary — an allele and its reverse
// complement are the same allele — so the presentation orientation is chosen
// separately, per candidate, in `orientForDisplay`.
function canonicalize(chain: SegAln[], clusterOf: ClusterOf) {
  const forward = { signature: pathSignature(chain, clusterOf), chain }
  const reversed = reverseComplementChain(chain)
  const reverse = {
    signature: pathSignature(reversed, clusterOf),
    chain: reversed,
  }
  return forward.signature <= reverse.signature ? forward : reverse
}

// Which end to show the allele from. Cosmetic by construction: it runs on the
// group's representative AFTER the grouping is settled, so unlike the rule it
// replaces it cannot move a read from one candidate to another, and it is free
// to consult the read extent the signature deliberately ignores.
//
// The rule is "start from the lower of the two ends the allele could begin at",
// compared by refName first and only then by coordinate — the two readings begin
// on different chromosomes whenever the path is interchromosomal, and there is no
// coordinate comparison to make across two of them. Lexicographic, so `chr10`
// sorts under `chr3`; that is arbitrary, and allowed to be, because nothing but
// the drawing reads it. It puts COLO829's der(3) in the orientation its published
// description and `sv_multihop.py derive` both use.
function orientForDisplay(chain: SegAln[]) {
  const reversed = reverseComplementChain(chain)
  const a = chain[0]!
  const b = reversed[0]!
  if (a.refName !== b.refName) {
    return a.refName < b.refName ? chain : reversed
  }
  return a.start <= b.start ? chain : reversed
}

// Turn one chain into the candidate's drawable segments. Interior segments are
// used as they stand — their edges ARE the junctions — while the two outer ones
// grow outward for context. The growth is applied by READ role (the first
// segment's entry edge, the last one's exit edge) and only then mapped onto
// low/high coordinates, so a reversed segment grows away from its junction
// rather than through it.
function segmentsFromChain(chain: SegAln[], flank: number) {
  const last = chain.length - 1
  return chain.map((seg, i) => {
    const growEntry = i === 0 ? flank : 0
    const growExit = i === last ? flank : 0
    const growLow = seg.strand === -1 ? growExit : growEntry
    const growHigh = seg.strand === -1 ? growEntry : growExit
    return {
      refName: seg.refName,
      // clamped at 0: a breakpoint near the start of a chromosome would
      // otherwise produce a negative coordinate that no locstring parses.
      //
      // Not clamped at the other end, which is a limit rather than an
      // oversight: 0 is a universal lower bound and there is no universal upper
      // one, so a contig length would have to come from an assembly this layer
      // has no access to. What overruns is context, never a junction, and it
      // costs a few kb of empty ruler on the synteny launch's reference panel —
      // `navToLocString` clamps for everyone else.
      start: Math.max(0, seg.start - growLow),
      end: seg.end + growHigh,
      strand: seg.strand,
    }
  })
}

// `assembleLocStringRaw`, not `assembleLocString`: this string is handed back to
// `parseLocString` via navToLocString, and the formatted spelling carries
// thousand separators that shift with the `numberGrouping` display preference.
export function derivativeLocString(segments: DerivativeSegment[]) {
  return segments
    .map(seg =>
      assembleLocStringRaw({
        refName: seg.refName,
        start: seg.start,
        end: seg.end,
        reversed: seg.strand === -1,
      }),
    )
    .join(' ')
}

/**
 * #api
 * Rank the derivative paths the reads in view describe, most-supported first.
 *
 * Every path above `minReads` is returned, not a top-N: how MANY paths a window
 * produces is itself evidence about all of them. One or two is what a real event
 * looks like; forty is a repeat, and a caller that had already truncated to ten
 * could not tell a reader that. Presenting a shorter list is the picker's job,
 * and it says what it left out.
 */
export function computeDerivativePaths(
  opts: ComputeDerivativePathsOpts,
): DerivativeCandidate[] {
  const {
    chains,
    tolerance = DEFAULTS.tolerance,
    minReads = DEFAULTS.minReads,
    flank = DEFAULTS.flank,
  } = opts

  const linked = chains.filter(chain => chain.length > 1)
  const clusterOf = buildClusterOf(linked, tolerance)
  const groups = new Map<string, SegAln[][]>()
  for (const chain of linked) {
    const { signature, chain: oriented } = canonicalize(chain, clusterOf)
    getOrCreate(groups, signature, () => []).push(oriented)
  }

  const entries: { candidate: DerivativeCandidate; readings: string[][] }[] = []
  for (const [signature, group] of groups) {
    if (group.length < minReads) {
      continue
    }
    // The representative is the widest chain rather than an average of them:
    // every chain in the group already agrees on the junctions, so the only
    // thing left to choose is how much reference context the candidate carries,
    // and the widest read is the one that saw the most. Averaging would invent
    // a boundary no read observed.
    const representative = group.reduce((best, chain) =>
      totalSpan(chain) > totalSpan(best) ? chain : best,
    )
    const oriented = orientForDisplay(representative)
    const segments = segmentsFromChain(oriented, flank)
    entries.push({
      candidate: {
        segments,
        observedSegments: segmentsFromChain(oriented, 0),
        pathId: signature,
        readCount: group.length,
        locString: derivativeLocString(segments),
        refNames: [...new Set(segments.map(seg => seg.refName))],
        extendsOffScreen: oriented.some(seg => !seg.onScreen),
      },
      readings: [
        junctionParts(oriented, clusterOf),
        junctionParts(reverseComplementChain(oriented), clusterOf),
      ],
    })
  }

  entries.sort(
    ({ candidate: a }, { candidate: b }) =>
      // Support first, then the segment count, then the path id — and the LAST
      // of the three is what actually makes the order deterministic. The other
      // two are not a total order: two routes can agree on both, which is the
      // ordinary shape of a window holding several two-segment, two-read
      // candidates. What separated them was then `groups`' insertion order,
      // i.e. the order the reads were walked, which is the order their fetches
      // completed — so the same window ranked the same two alleles either way
      // round on different runs.
      //
      // That is not only untidy. The picker shows the first `MAX_SHOWN` rows,
      // so an unstable tail decides WHICH candidates a person is offered, and
      // the dialog is opened over a pileup that is often still streaming — the
      // same hazard the selection already holds a `pathId` rather than a row
      // index for. `pathId` IS the group key, unique by construction, so this
      // is the tie-break `resolveArcs` makes on `arcKey` for the same reason.
      //
      // None of the three is a claim about likelihood. This file ranks by how
      // many reads say a thing and never by how interesting the thing is, and
      // at COLO829's chr9 fold-back the segment count duly puts a three-segment
      // route above the two-segment allele the tutorial is about. That is why
      // the picker's rows carry a `derivative-path-<refNames>` testid and every
      // spec selects by it: rank is stable, but it is not meaningful, so
      // nothing may key on position.
      b.readCount - a.readCount ||
      b.segments.length - a.segments.length ||
      (a.pathId < b.pathId ? -1 : 1),
  )

  for (const entry of entries) {
    const container = entries.find(
      other =>
        other !== entry &&
        other.readings.some(sup => isContiguousRun(entry.readings[0]!, sup)),
    )
    if (container) {
      entry.candidate.partOf = container.candidate.pathId
    }
  }
  return entries.map(entry => entry.candidate)
}
