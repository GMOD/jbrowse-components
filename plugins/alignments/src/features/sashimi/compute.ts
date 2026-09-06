import { DINUCLEOTIDE_UNKNOWN, spliceMotifDinucleotides } from './motif.ts'

import type { CoverageGap } from '@jbrowse/alignments-core'

// The reference bases the junction motifs are read from, absent when the
// assembly has no sequence adapter or the fetch was skipped.
export interface JunctionReference {
  sequence: string
  start: number
}

// Bucket skip-gaps by (start,end) and emit one arc per junction, counting every
// supporting read. The junction Map is keyed by string concat — gap counts are
// typically small, so the string-key cost is negligible vs needing two parallel
// maps.
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
// The per-strand read tallies and the two motif halves ship RAW: the strand a
// junction is tinted by depends on its motif, and the motif on both ends being
// resolved, and a region holding only one end can settle neither. Both decisions
// are `mergeJunctions`', once every region has contributed what it saw.
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
  const sashimiCounts = new Uint32Array(n)
  const sashimiFwd = new Uint32Array(n)
  const sashimiRev = new Uint32Array(n)
  const sashimiDonors = new Uint8Array(n)
  const sashimiAcceptors = new Uint8Array(n)

  let i = 0
  for (const j of junctions.values()) {
    const { donor, acceptor } = reference
      ? spliceMotifDinucleotides(
          j.start,
          j.end,
          reference.sequence,
          reference.start,
        )
      : { donor: DINUCLEOTIDE_UNKNOWN, acceptor: DINUCLEOTIDE_UNKNOWN }
    sashimiX1[i] = j.start
    sashimiX2[i] = j.end
    sashimiCounts[i] = j.total
    sashimiFwd[i] = j.fwd
    sashimiRev[i] = j.rev
    sashimiDonors[i] = donor
    sashimiAcceptors[i] = acceptor
    i++
  }

  return {
    sashimiX1,
    sashimiX2,
    sashimiCounts,
    sashimiFwd,
    sashimiRev,
    sashimiDonors,
    sashimiAcceptors,
  }
}
