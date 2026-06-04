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

// Bucket skip-gaps by (start,end) and emit one arc per (junction, strand). The
// junction Map is keyed by string concat — gap counts are typically small, so
// the string-key cost is negligible vs needing two parallel maps.
//
// Worker-side compute. SVG-overlay geometry (`computeSashimiArcs`) lives in
// `./computeOverlay.ts` (intentionally SVG-only — see
// LinearAlignmentsDisplay/CLAUDE.md).
export function computeSashimiJunctions(gaps: CoverageGap[]) {
  const junctions = new Map<
    string,
    { start: number; end: number; fwd: number; rev: number; unknown: number }
  >()

  for (const gap of gaps) {
    if (gap.type !== 'skip') {
      continue
    }
    const key = `${gap.start}:${gap.end}`
    let j = junctions.get(key)
    if (!j) {
      j = { start: gap.start, end: gap.end, fwd: 0, rev: 0, unknown: 0 }
      junctions.set(key, j)
    }
    // gap.strand is the transcript strand from getEffectiveStrand: +1/-1 when a
    // strand tag (XS/TS/ts) was present, 0 when the read carried none (e.g.
    // default STAR output without --outSAMstrandField). Keep the three states
    // distinct so untagged junctions render as "unknown", not reverse.
    if (gap.strand === 1) {
      j.fwd++
    } else if (gap.strand === -1) {
      j.rev++
    } else {
      j.unknown++
    }
  }

  const arcs: {
    start: number
    end: number
    count: number
    colorType: number
  }[] = []
  for (const j of junctions.values()) {
    const { start, end } = j
    if (j.fwd > 0) {
      arcs.push({ start, end, count: j.fwd, colorType: SASHIMI_FORWARD })
    }
    if (j.rev > 0) {
      arcs.push({ start, end, count: j.rev, colorType: SASHIMI_REVERSE })
    }
    if (j.unknown > 0) {
      arcs.push({ start, end, count: j.unknown, colorType: SASHIMI_UNKNOWN })
    }
  }

  const n = arcs.length
  const sashimiX1 = new Uint32Array(n)
  const sashimiX2 = new Uint32Array(n)
  const sashimiScores = new Float32Array(n)
  const sashimiColorTypes = new Uint8Array(n)
  const sashimiCounts = new Uint32Array(n)

  for (let i = 0; i < n; i++) {
    const arc = arcs[i]!
    sashimiX1[i] = arc.start
    sashimiX2[i] = arc.end
    sashimiScores[i] = Math.log(arc.count + 1)
    sashimiColorTypes[i] = arc.colorType
    sashimiCounts[i] = arc.count
  }

  return {
    sashimiX1,
    sashimiX2,
    sashimiScores,
    sashimiColorTypes,
    sashimiCounts,
  }
}
