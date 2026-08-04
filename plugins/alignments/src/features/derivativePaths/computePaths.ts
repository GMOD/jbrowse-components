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
// allele, so without folding them together one event turns up as two candidates
// at half the support each. (Observed on COLO829's der(3): two 13-read rows for
// one 26-read event.) The SA segments this reads are not strand-normalized into
// the read's reference orientation, so the two orientations really do both
// occur in one fetch.
function reverseComplementChain(chain: SegAln[]): SegAln[] {
  return [...chain].reverse().map(seg => ({ ...seg, strand: -seg.strand }))
}

// Fold each chain onto one of its two readings. Both are equally true, so the
// rule only has to be stable and unsurprising: present the allele starting from
// the lower of the two reference coordinates it could begin at. Picking by
// signature order instead would be stable but arbitrary, and it read COLO829's
// der(3) backwards from the orientation every published description uses.
//
// The signature comparison is the last resort, for a path whose two ends start
// at the same coordinate; without it the choice could depend on which direction
// happened to be sequenced more, and the grouping would stop converging.
function orientationRank(chain: SegAln[], signature: string) {
  const first = chain[0]!
  return [first.refName, first.start, signature] as const
}

function canonicalize(chain: SegAln[], tolerance: number) {
  const forward = { signature: pathSignature(chain, tolerance), chain }
  const reversed = reverseComplementChain(chain)
  const reverse = {
    signature: pathSignature(reversed, tolerance),
    chain: reversed,
  }
  const a = orientationRank(forward.chain, forward.signature)
  const b = orientationRank(reverse.chain, reverse.signature)
  for (let i = 0; i < a.length; i++) {
    if (a[i]! !== b[i]!) {
      return a[i]! < b[i]! ? forward : reverse
    }
  }
  return forward
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
    const segments = segmentsFromChain(representative, flank)
    candidates.push({
      segments,
      readCount: group.chains.length,
      locString: derivativeLocString(segments),
      refNames: [...new Set(segments.map(seg => seg.refName))],
      extendsOffScreen: representative.some(seg => !seg.onScreen),
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
