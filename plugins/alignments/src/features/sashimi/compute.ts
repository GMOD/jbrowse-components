import type { CoverageGap } from '@jbrowse/alignments-core'

// colorType encoding for a sashimi arc, shared with `computeOverlay.ts`: the
// worker packs these into the `sashimiColorTypes` Uint8Array and the overlay
// decodes them via `colorTypeToStrand`. Keeping both ends on these constants
// stops the producer/consumer mapping from drifting across the worker boundary.
export const SASHIMI_FORWARD = 0
export const SASHIMI_REVERSE = 1
export const SASHIMI_UNKNOWN = 2

export function colorTypeToStrand(colorType: number) {
  return colorType === SASHIMI_FORWARD
    ? 1
    : colorType === SASHIMI_REVERSE
      ? -1
      : 0
}

// Which strand tints a junction whose reads disagree. Only tagged reads vote:
// `unknown` is "no strand tag", i.e. an abstention, not a third competing
// strand — 3 forward-tagged + 3 untagged reads is a forward junction, not an
// ambiguous one. A junction with no votes at all (fwd === rev === 0) is
// untagged and stays "unknown" rather than defaulting to reverse; contradictory
// votes (fwd === rev > 0, e.g. overlapping antisense genes) are genuinely
// ambiguous and get the same neutral color.
function dominantColorType(fwd: number, rev: number) {
  return fwd > rev
    ? SASHIMI_FORWARD
    : rev > fwd
      ? SASHIMI_REVERSE
      : SASHIMI_UNKNOWN
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
// Worker-side compute. SVG-overlay geometry (`computeSashimiArcs`) lives in
// `./computeOverlay.ts` (intentionally SVG-only — see
// LinearAlignmentsDisplay/CLAUDE.md).
export function computeSashimiJunctions(gaps: CoverageGap[]) {
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
  const sashimiColorTypes = new Uint8Array(n)
  const sashimiCounts = new Uint32Array(n)

  let i = 0
  for (const j of junctions.values()) {
    sashimiX1[i] = j.start
    sashimiX2[i] = j.end
    sashimiColorTypes[i] = dominantColorType(j.fwd, j.rev)
    sashimiCounts[i] = j.total
    i++
  }

  return {
    sashimiX1,
    sashimiX2,
    sashimiColorTypes,
    sashimiCounts,
  }
}
