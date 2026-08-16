import { interbaseDepthAt } from '@jbrowse/alignments-core'

import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'
import { GAP_DELETION } from '../shaders/slang/gap.consts.generated.ts'

function getDepthAt(
  coverageDepths: Float32Array,
  depthIdx: number,
  fallback: number,
) {
  return depthIdx >= 0 && depthIdx < coverageDepths.length
    ? coverageDepths[depthIdx]!
    : fallback
}

// A, C, G, T and N take a fixed lane of the flat count array below; -1 is
// everything else. "Everything else" is real but vanishingly rare — a BAM's SEQ
// alphabet also carries the IUPAC ambiguity codes, and a SAM may carry any of
// `[A-Za-z=.]` — and it has to keep its OWN count rather than fold into N,
// because this frequency is per exact base. So it falls back to a Map, exactly
// the split `features/modCoverage/readBaseCounts.ts` makes for the same reason:
// the common path stays a table index and the answer is unconditionally the
// same.
const MISMATCH_LANE = new Int8Array(256).fill(-1)
MISMATCH_LANE[65] = 0 // A
MISMATCH_LANE[67] = 1 // C
MISMATCH_LANE[71] = 2 // G
MISMATCH_LANE[84] = 3 // T
MISMATCH_LANE[78] = 4 // N
const MISMATCH_LANES = 5

// Per-mismatch base count / total depth at that position. Drives the shader
// fade for low-frequency SNPs at large bpPerPx.
//
// Counts go into a flat per-bp lane array indexed by offset into the coverage
// window, not a `Map` keyed by `position * 256 + base`. That is the same change
// `computeSNPCoverage` documents at its own count array, made for the same
// reason and on a hotter path: this runs on EVERY fetch — the frequencies feed
// the pileup's mismatch fade and are deliberately computed before the
// showCoverage gate — where the SNP segments only run when the band is drawn.
// A long-read pileup reaches here with hundreds of thousands of mismatches and
// paid two hash lookups apiece.
export function computeMismatchFrequencies(
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) {
  const n = mismatchPositions.length
  const frequencies = new Uint8Array(n)
  const windowLength = coverageDepths.length
  // The lane array covers the span the mismatches OCCUPY, not the coverage
  // window. Sizing it by the window would trade a Map sized by the data for an
  // array sized by the region — 20 bytes per bp of it — and this function is
  // ungated by showCoverage, so a synteny block or a zoomed-out pileup would
  // pay that for a handful of events. `spanOf` is a bare typed-array scan.
  const { min: base, length: span } = spanOf(
    mismatchPositions,
    coverageStartPos,
    windowLength,
  )
  const counts = new Uint32Array(span * MISMATCH_LANES)
  // Out-of-window positions and non-ACGTN bases. Left undefined on the ordinary
  // fetch, where neither occurs.
  let rare: Map<number, number> | undefined
  for (let i = 0; i < n; i++) {
    const offset = mismatchPositions[i]! - coverageStartPos
    const lane = MISMATCH_LANE[mismatchBases[i]!]!
    if (lane >= 0 && offset >= 0 && offset < windowLength) {
      counts[(offset - base) * MISMATCH_LANES + lane]!++
    } else {
      const key = mismatchPositions[i]! * 256 + mismatchBases[i]!
      rare ??= new Map()
      rare.set(key, (rare.get(key) ?? 0) + 1)
    }
  }
  for (let i = 0; i < n; i++) {
    const pos = mismatchPositions[i]!
    const offset = pos - coverageStartPos
    const lane = MISMATCH_LANE[mismatchBases[i]!]!
    const inWindow = offset >= 0 && offset < windowLength
    const count =
      lane >= 0 && inWindow
        ? counts[(offset - base) * MISMATCH_LANES + lane]!
        : (rare?.get(pos * 256 + mismatchBases[i]!) ?? 1)
    const depth = inWindow ? coverageDepths[offset]! : 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

// The [min, max] offset range the in-window entries of `positions` occupy, as a
// base and a length. An empty range yields length 0, so the count array it
// sizes is empty and every entry takes the `rare` path — which is the right
// answer, since there is nothing in the window to count.
function spanOf(
  positions: Uint32Array,
  coverageStartPos: number,
  windowLength: number,
) {
  let min = windowLength
  let max = -1
  for (let i = 0; i < positions.length; i++) {
    const offset = positions[i]! - coverageStartPos
    if (offset >= 0 && offset < windowLength) {
      if (offset < min) {
        min = offset
      }
      if (offset > max) {
        max = offset
      }
    }
  }
  return { min, length: max < min ? 0 : max - min + 1 }
}

// Per-position count / total depth. Used for insertions, softclips, hardclips
// (point features), and gap start positions. Depth basis is interbaseDepthAt
// (deeper of the two flanking bins); a zero-depth position falls back to 1 so a
// stray event there reads as full frequency rather than dividing by zero.
//
// Same flat-count shape as computeMismatchFrequencies above, one lane per bp
// since there is no base to key on. Neither can be a run-walk over contiguous
// equal positions the way `computeSNPCoverage` is — these positions are
// ascending only WITHIN each of the three interbase blocks the caller
// concatenates, and one position can appear in more than one block. The
// mismatch pass upstairs *could* and is measurably worse for it; see
// `benches/coverageFrequencies.bench.ts`.
export function computePositionFrequencies(
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) {
  const n = positions.length
  const frequencies = new Uint8Array(n)
  const windowLength = coverageDepths.length
  const { min: base, length: span } = spanOf(
    positions,
    coverageStartPos,
    windowLength,
  )
  const counts = new Uint32Array(span)
  let rare: Map<number, number> | undefined
  for (let i = 0; i < n; i++) {
    const offset = positions[i]! - coverageStartPos
    if (offset >= 0 && offset < windowLength) {
      counts[offset - base]!++
    } else {
      rare ??= new Map()
      rare.set(positions[i]!, (rare.get(positions[i]!) ?? 0) + 1)
    }
  }
  for (let i = 0; i < n; i++) {
    const pos = positions[i]!
    const offset = pos - coverageStartPos
    const localDepth = interbaseDepthAt(coverageDepths, coverageStartPos, pos)
    const depth = localDepth > 0 ? localDepth : 1
    const count =
      offset >= 0 && offset < windowLength
        ? counts[offset - base]!
        : (rare?.get(pos) ?? 1)
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

/**
 * Per-deletion frequency, one entry per GAP with a zero at every skip — the
 * packers index this by gap index.
 *
 * Only a deletion has a frequency to draw: `gapFrequencies` is read in the
 * deletion branch of gap.slang and of drawGaps, and nowhere else. Anchoring a
 * skip's start in the same per-bp buckets therefore bought nothing and cost
 * correctness twice over — a deletion beginning at a splice donor had every
 * spliced read's skip added to its own count, so it read as more frequent than
 * it is and drew opaque past the fade; and the walk computed and thresholded a
 * frequency per skip, which on a long-read RNA pileup is most of the array.
 */
function deletionStartFrequencies(
  gapPositions: Uint32Array,
  gapTypes: Uint8Array,
  depths: Float32Array,
  coverageStartPos: number,
) {
  const numGaps = gapPositions.length / 2
  let numDeletions = 0
  for (let i = 0; i < numGaps; i++) {
    if (gapTypes[i] === GAP_DELETION) {
      numDeletions++
    }
  }
  // gapPositions stores [start, end] pairs; a deletion's frequency is anchored
  // at its start.
  const starts = new Uint32Array(numDeletions)
  const gapIndices = new Uint32Array(numDeletions)
  let w = 0
  for (let i = 0; i < numGaps; i++) {
    if (gapTypes[i] === GAP_DELETION) {
      starts[w] = gapPositions[i * 2]!
      gapIndices[w] = i
      w++
    }
  }
  const deletionFrequencies = thresholdedPositionFrequencies(
    starts,
    depths,
    coverageStartPos,
  )
  const frequencies = new Uint8Array(numGaps)
  for (let k = 0; k < numDeletions; k++) {
    frequencies[gapIndices[k]!] = deletionFrequencies[k]!
  }
  return frequencies
}

export function computeFrequenciesAndThresholds(
  mismatchArrays: { mismatchPositions: Uint32Array; mismatchBases: Uint8Array },
  interbaseArrays: { interbasePositions: Uint32Array },
  gapArrays: { gapPositions: Uint32Array; gapTypes: Uint8Array },
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
  return {
    mismatchFrequencies,
    interbaseFrequencies: thresholdedPositionFrequencies(
      interbaseArrays.interbasePositions,
      depths,
      coverageStartPos,
    ),
    gapFrequencies: deletionStartFrequencies(
      gapArrays.gapPositions,
      gapArrays.gapTypes,
      depths,
      coverageStartPos,
    ),
  }
}
