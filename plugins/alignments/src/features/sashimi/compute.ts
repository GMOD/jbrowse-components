import type { CoverageGap } from '../coverage/compute.ts'

// Bucket skip-gaps by (start,end) and emit one arc per (junction, strand). The
// junction Map is keyed by string concat — gap counts are typically small, so
// the string-key cost is negligible vs needing two parallel maps.
//
// Drawing lives in components/sashimiArcs.ts (intentionally SVG-only, see
// LinearAlignmentsDisplay/CLAUDE.md). Only the worker-side compute belongs
// here.
export function computeSashimiJunctions(gaps: CoverageGap[]) {
  const junctions = new Map<
    string,
    { start: number; end: number; fwd: number; rev: number }
  >()

  for (const gap of gaps) {
    if (gap.type !== 'skip') {
      continue
    }
    const key = `${gap.start}:${gap.end}`
    let j = junctions.get(key)
    if (!j) {
      j = { start: gap.start, end: gap.end, fwd: 0, rev: 0 }
      junctions.set(key, j)
    }
    if (gap.strand === 1) {
      j.fwd++
    } else {
      j.rev++
    }
  }

  const arcs: {
    start: number
    end: number
    count: number
    colorType: number
  }[] = []
  for (const j of junctions.values()) {
    if (j.fwd > 0) {
      arcs.push({ start: j.start, end: j.end, count: j.fwd, colorType: 0 })
    }
    if (j.rev > 0) {
      arcs.push({ start: j.start, end: j.end, count: j.rev, colorType: 1 })
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
    numSashimiArcs: n,
  }
}
