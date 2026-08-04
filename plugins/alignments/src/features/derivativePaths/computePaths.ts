import { assembleLocStringRaw } from '@jbrowse/core/util'

import type { SegAln } from '../arcs/compute.ts'

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

export interface DerivativeSegment {
  refName: string
  start: number
  end: number
  // -1 means the segment is traversed against the reference, i.e. it is drawn
  // flipped and its locstring carries `[rev]`
  strand: number
}

export interface DerivativeCandidate {
  segments: DerivativeSegment[]
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
}

export interface ComputeDerivativePathsOpts {
  chains: SegAln[][]
  /**
   * Junction coordinates from two reads describing one event agree only to
   * within the aligner's placement of the breakpoint, so they are bucketed
   * before being compared. Too tight and one event splits into many
   * one-read candidates; too loose and neighbouring events merge.
   */
  tolerance?: number
  /** Drop paths with less support than this. */
  minReads?: number
  maxCandidates?: number
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
  maxCandidates: 10,
  flank: 2000,
}

// The read enters a forward segment at its lower coordinate and a reverse one at
// its higher. Read order is not genomic order, so every edge below is asked for
// by ROLE (entry/exit along the read), never by min/max.
function entryBp(seg: SegAln) {
  return seg.strand === -1 ? seg.end : seg.start
}

function exitBp(seg: SegAln) {
  return seg.strand === -1 ? seg.start : seg.end
}

// Identity of a path, and the one piece of judgement in this file. It is built
// from the JUNCTIONS only, never from the chain's outer edges: two reads
// crossing the same rearrangement agree on where the pieces join and disagree on
// where each read happens to start and stop, so folding the outer edges in would
// give every read its own signature and every candidate a support of 1.
function pathSignature(chain: SegAln[], tolerance: number) {
  const bucket = (bp: number) => Math.round(bp / tolerance)
  const parts: string[] = []
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i]!
    const b = chain[i + 1]!
    parts.push(
      `${a.refName}:${bucket(exitBp(a))}:${a.strand}>${b.refName}:${bucket(
        entryBp(b),
      )}:${b.strand}`,
    )
  }
  return parts.join('|')
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
function canonicalize(chain: SegAln[], tolerance: number) {
  const forward = { signature: pathSignature(chain, tolerance), chain }
  const reversed = reverseComplementChain(chain)
  const reverse = {
    signature: pathSignature(reversed, tolerance),
    chain: reversed,
  }
  return forward.signature <= reverse.signature ? forward : reverse
}

// Which end to show the allele from. Cosmetic by construction: it runs on the
// group's representative AFTER the grouping is settled, so unlike the rule it
// replaces it cannot move a read from one candidate to another, and it is free
// to consult the read extent the signature deliberately ignores.
//
// The rule is "start from the lower of the two reference coordinates the allele
// could begin at", which reads COLO829's der(3) in the orientation its published
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
      // otherwise produce a negative coordinate that no locstring parses
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
 */
export function computeDerivativePaths(
  opts: ComputeDerivativePathsOpts,
): DerivativeCandidate[] {
  const { chains } = opts
  const tolerance = opts.tolerance ?? DEFAULTS.tolerance
  const minReads = opts.minReads ?? DEFAULTS.minReads
  const maxCandidates = opts.maxCandidates ?? DEFAULTS.maxCandidates
  const flank = opts.flank ?? DEFAULTS.flank

  const groups = new Map<string, { chains: SegAln[][] }>()
  for (const chain of chains) {
    if (chain.length < 2) {
      continue
    }
    const { signature, chain: oriented } = canonicalize(chain, tolerance)
    let group = groups.get(signature)
    if (!group) {
      group = { chains: [] }
      groups.set(signature, group)
    }
    group.chains.push(oriented)
  }

  const candidates: DerivativeCandidate[] = []
  for (const group of groups.values()) {
    if (group.chains.length < minReads) {
      continue
    }
    // The representative is the widest chain rather than an average of them:
    // every chain in the group already agrees on the junctions, so the only
    // thing left to choose is how much reference context the candidate carries,
    // and the widest read is the one that saw the most. Averaging would invent
    // a boundary no read observed.
    const representative = group.chains.reduce((best, chain) =>
      totalSpan(chain) > totalSpan(best) ? chain : best,
    )
    const oriented = orientForDisplay(representative)
    const segments = segmentsFromChain(oriented, flank)
    candidates.push({
      segments,
      readCount: group.chains.length,
      locString: derivativeLocString(segments),
      refNames: [...new Set(segments.map(seg => seg.refName))],
      extendsOffScreen: oriented.some(seg => !seg.onScreen),
    })
  }

  return candidates
    .sort(
      (a, b) =>
        // support first; then more hops, since a 3-junction path is the
        // interesting one when two candidates are equally well supported
        b.readCount - a.readCount || b.segments.length - a.segments.length,
    )
    .slice(0, maxCandidates)
}
