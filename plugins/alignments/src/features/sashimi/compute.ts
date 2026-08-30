import {
  SPLICE_MOTIF_UNKNOWN,
  spliceMotifAt,
  spliceMotifStrand,
} from './motif.ts'

import type { CoverageGap } from '@jbrowse/alignments-core'

// Which strand tints a junction whose reads disagree. Only tagged reads vote:
// `unknown` is "no strand tag", i.e. an abstention, not a third competing
// strand — 3 forward-tagged + 3 untagged reads is a forward junction, not an
// ambiguous one. A junction with no votes at all (fwd === rev === 0) falls back
// to the strand its splice motif implies, which is what an aligner's XS tag was
// derived from anyway; contradictory votes (fwd === rev > 0, e.g. overlapping
// antisense genes) are genuinely ambiguous and stay 0.
//
// The result is a plain +1/-1/0 strand — the same vocabulary as
// `getEffectiveStrand`, `SashimiArc.strand`, the tooltip, and the detail widget
// — so it crosses the worker boundary as-is.
function junctionStrand(fwd: number, rev: number, motif: number) {
  return fwd > rev
    ? 1
    : rev > fwd
      ? -1
      : fwd === 0
        ? spliceMotifStrand(motif)
        : 0
}

// The reference bases the junction motifs are read from, absent when the
// assembly has no sequence adapter or the fetch was skipped.
export interface JunctionReference {
  sequence: string
  start: number
}

// Bucket skip-gaps by (start,end) and emit one arc per junction, counting every
// supporting read and tinting by the dominant strand. The junction Map is keyed
// by string concat — gap counts are typically small, so the string-key cost is
// negligible vs needing two parallel maps.
//
// One arc per *junction*, not per (junction, strand): the arc's geometry in
// `computeOverlay.ts` derives purely from start/end, so a per-strand split drew
// two or three arcs with a byte-identical path `d`. The extra copies were dead —
// stacked on the same pixels, only the last-painted one visible or hoverable —
// while their count labels piled up on one point and the visible arc advertised
// only its own strand's share (a 20-fwd/3-rev/2-untagged junction read as "20"
// on 25 reads). Mixed strands at one junction are ordinary: `getEffectiveStrand`
// returns 0 for any read without an XS/TS/ts tag, so a merged BAM, or minimap2
// emitting `ts` only for recognized motifs, routinely yields tagged and untagged
// reads on the same junction.
//
// Worker-side compute. SVG-overlay geometry (`projectSashimiArcs`) lives in
// `./computeOverlay.ts` (intentionally SVG-only — see
// LinearAlignmentsDisplay/CLAUDE.md).
export function computeSashimiJunctions(
  gaps: CoverageGap[],
  reference?: JunctionReference,
) {
  const junctions = new Map<
    string,
    { start: number; end: number; fwd: number; rev: number; total: number }
  >()

  for (const gap of gaps) {
    if (gap.type !== 'skip') {
      continue
    }
    const key = `${gap.start}:${gap.end}`
    let j = junctions.get(key)
    if (!j) {
      j = { start: gap.start, end: gap.end, fwd: 0, rev: 0, total: 0 }
      junctions.set(key, j)
    }
    // gap.strand is the transcript strand from getEffectiveStrand: +1/-1 when a
    // strand tag (XS/TS/ts) was present, 0 when the read carried none (e.g.
    // default STAR output without --outSAMstrandField).
    if (gap.strand === 1) {
      j.fwd++
    } else if (gap.strand === -1) {
      j.rev++
    }
    j.total++
  }

  const n = junctions.size
  const sashimiX1 = new Uint32Array(n)
  const sashimiX2 = new Uint32Array(n)
  const sashimiStrands = new Int8Array(n)
  const sashimiCounts = new Uint32Array(n)
  const sashimiMotifs = new Uint8Array(n)

  let i = 0
  for (const j of junctions.values()) {
    const motif = reference
      ? spliceMotifAt(j.start, j.end, reference.sequence, reference.start)
      : SPLICE_MOTIF_UNKNOWN
    sashimiX1[i] = j.start
    sashimiX2[i] = j.end
    sashimiStrands[i] = junctionStrand(j.fwd, j.rev, motif)
    sashimiCounts[i] = j.total
    sashimiMotifs[i] = motif
    i++
  }

  return {
    sashimiX1,
    sashimiX2,
    sashimiStrands,
    sashimiCounts,
    sashimiMotifs,
  }
}
