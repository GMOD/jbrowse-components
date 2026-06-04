import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'

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
    const depthIdx = pos - coverageStartPos
    const depth =
      depthIdx >= 0 && depthIdx < coverageDepths.length
        ? coverageDepths[depthIdx]!
        : 1
    const key = pos * 256 + mismatchBases[i]!
    const count = posBaseCounts.get(key) ?? 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

function getDepthAt(
  coverageDepths: Float32Array,
  depthIdx: number,
  fallback: number,
) {
  return depthIdx >= 0 && depthIdx < coverageDepths.length
    ? coverageDepths[depthIdx]!
    : fallback
}

// Interbase features (insertions/softclips/hardclips) sit between two bases;
// at coverage cliffs one side may be near zero, so use max(left, right) to
// avoid misleading proportions.
function getInterbaseDepth(
  coverageDepths: Float32Array,
  depthIdx: number,
  fallback: number,
) {
  const leftDepth = getDepthAt(coverageDepths, depthIdx - 1, 0)
  const rightDepth = getDepthAt(coverageDepths, depthIdx, 0)
  const depth = Math.max(leftDepth, rightDepth)
  return depth > 0 ? depth : fallback
}

// Per-position count / total depth. Used for insertions, softclips, hardclips
// (point features), and gap start positions.
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
    const depthIdx = pos - coverageStartPos
    const depth = getInterbaseDepth(coverageDepths, depthIdx, 1)
    const count = posCounts.get(pos) ?? 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
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
    const depthIdx = pos - coverageStartPos
    const depth = interbase
      ? getInterbaseDepth(coverageDepths, depthIdx, 0)
      : getDepthAt(coverageDepths, depthIdx, 0)
    const freq = frequencies[i]! / 255
    const threshold = thresholdFn(depth)
    if (freq < threshold) {
      frequencies[i] = 0
    }
  }
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
  const interbaseFrequencies = computePositionFrequencies(
    interbaseArrays.interbasePositions,
    depths,
    coverageStartPos,
  )
  applyDepthDependentThreshold(
    interbaseFrequencies,
    interbaseArrays.interbasePositions,
    depths,
    coverageStartPos,
    featureFrequencyThreshold,
    true,
  )
  const gapStartPositions = new Uint32Array(gapArrays.gapPositions.length / 2)
  for (let i = 0; i < gapStartPositions.length; i++) {
    gapStartPositions[i] = gapArrays.gapPositions[i * 2]!
  }
  const gapFrequencies = computePositionFrequencies(
    gapStartPositions,
    depths,
    coverageStartPos,
  )
  applyDepthDependentThreshold(
    gapFrequencies,
    gapStartPositions,
    depths,
    coverageStartPos,
    featureFrequencyThreshold,
    true,
  )

  return { mismatchFrequencies, interbaseFrequencies, gapFrequencies }
}
