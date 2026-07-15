import { interbaseDepthAt } from '@jbrowse/alignments-core'

import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'

function getDepthAt(
  coverageDepths: Float32Array,
  depthIdx: number,
  fallback: number,
) {
  return depthIdx >= 0 && depthIdx < coverageDepths.length
    ? coverageDepths[depthIdx]!
    : fallback
}

// Per-mismatch base count / total depth at that position. Drives the shader
// fade for low-frequency SNPs at large bpPerPx.
export function computeMismatchFrequencies(
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) {
  const n = mismatchPositions.length
  const frequencies = new Uint8Array(n)
  const posBaseCounts = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const key = mismatchPositions[i]! * 256 + mismatchBases[i]!
    posBaseCounts.set(key, (posBaseCounts.get(key) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const pos = mismatchPositions[i]!
    const depth = getDepthAt(coverageDepths, pos - coverageStartPos, 1)
    const key = pos * 256 + mismatchBases[i]!
    const count = posBaseCounts.get(key) ?? 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

// Per-position count / total depth. Used for insertions, softclips, hardclips
// (point features), and gap start positions. Depth basis is interbaseDepthAt
// (deeper of the two flanking bins); a zero-depth position falls back to 1 so a
// stray event there reads as full frequency rather than dividing by zero.
export function computePositionFrequencies(
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) {
  const n = positions.length
  const frequencies = new Uint8Array(n)
  const posCounts = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const pos = positions[i]!
    posCounts.set(pos, (posCounts.get(pos) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const pos = positions[i]!
    const localDepth = interbaseDepthAt(coverageDepths, coverageStartPos, pos)
    const depth = localDepth > 0 ? localDepth : 1
    const count = posCounts.get(pos) ?? 1
    frequencies[i] = Math.min(255, Math.round((count / depth) * 255))
  }
  return frequencies
}

// Zeroes out frequencies below a depth-dependent threshold. In-place.
export function applyDepthDependentThreshold(
  frequencies: Uint8Array,
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  thresholdFn: (depth: number) => number,
  interbase?: boolean,
) {
  for (let i = 0; i < frequencies.length; i++) {
    const pos = positions[i]!
    const depth = interbase
      ? interbaseDepthAt(coverageDepths, coverageStartPos, pos)
      : getDepthAt(coverageDepths, pos - coverageStartPos, 0)
    const freq = frequencies[i]! / 255
    const threshold = thresholdFn(depth)
    if (freq < threshold) {
      frequencies[i] = 0
    }
  }
}

// Interbase point features (insertions, clips, gap starts) all share one
// recipe: per-position frequency against the interbase depth, then the
// depth-dependent threshold zeroing the noise floor.
function thresholdedPositionFrequencies(
  positions: Uint32Array,
  depths: Float32Array,
  coverageStartPos: number,
) {
  const frequencies = computePositionFrequencies(
    positions,
    depths,
    coverageStartPos,
  )
  applyDepthDependentThreshold(
    frequencies,
    positions,
    depths,
    coverageStartPos,
    featureFrequencyThreshold,
    true,
  )
  return frequencies
}

export function computeFrequenciesAndThresholds(
  mismatchArrays: { mismatchPositions: Uint32Array; mismatchBases: Uint8Array },
  interbaseArrays: { interbasePositions: Uint32Array },
  gapArrays: { gapPositions: Uint32Array },
  depths: Float32Array,
  coverageStartPos: number,
) {
  const mismatchFrequencies = computeMismatchFrequencies(
    mismatchArrays.mismatchPositions,
    mismatchArrays.mismatchBases,
    depths,
    coverageStartPos,
  )
  applyDepthDependentThreshold(
    mismatchFrequencies,
    mismatchArrays.mismatchPositions,
    depths,
    coverageStartPos,
    featureFrequencyThreshold,
  )
  // gapPositions stores [start, end] pairs; a gap's frequency is anchored at
  // its start.
  const gapStartPositions = new Uint32Array(gapArrays.gapPositions.length / 2)
  for (let i = 0; i < gapStartPositions.length; i++) {
    gapStartPositions[i] = gapArrays.gapPositions[i * 2]!
  }
  return {
    mismatchFrequencies,
    interbaseFrequencies: thresholdedPositionFrequencies(
      interbaseArrays.interbasePositions,
      depths,
      coverageStartPos,
    ),
    gapFrequencies: thresholdedPositionFrequencies(
      gapStartPositions,
      depths,
      coverageStartPos,
    ),
  }
}
