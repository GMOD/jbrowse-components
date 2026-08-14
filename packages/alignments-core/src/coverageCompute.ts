/**
 * Coverage depth computation. Sweep-line over feature start/end events plus
 * gap (deletion/skip) start/end events. All positions in and out are absolute
 * genomic coordinates; depths[i] covers [startPos + i, startPos + i + 1).
 */

export interface CoverageFeature {
  start: number
  end: number
  strand?: number
}

export interface CoverageGap {
  start: number
  end: number
  type: 'deletion' | 'skip'
  strand: number
  featureStrand: number
}

// Coverage always starts at regionStart: a read starting left of the region
// still contributes to the first bins via the sweep line, so no leftward
// extension is needed. We only extend the right edge so reads overhanging
// regionEnd keep their depth (up to one region-width past the edge).
function getFeatureEnd(
  features: { end: number }[],
  regionStart: number,
  regionEnd: number,
) {
  const maxExtension = regionEnd - regionStart
  let actualEnd = regionEnd
  for (const f of features) {
    if (f.end > actualEnd && f.end <= regionEnd + maxExtension) {
      actualEnd = f.end
    }
  }
  return actualEnd
}

export function computeCoverage(
  features: CoverageFeature[],
  gaps: CoverageGap[],
  regionStart: number,
  regionEnd: number,
  trackStrands?: boolean,
) {
  if (features.length === 0) {
    return {
      depths: new Float32Array(0),
      fwdDepths: undefined as Float32Array | undefined,
      revDepths: undefined as Float32Array | undefined,
      maxDepth: 0,
      binSize: 1,
      startPos: 0,
    }
  }

  const actualStart = regionStart
  const actualEnd = getFeatureEnd(features, regionStart, regionEnd)
  const startPos = actualStart
  const numBins = actualEnd - actualStart
  const binSize = 1

  const { depths, fwdDepths, revDepths } = sweepDepths(
    features,
    gaps,
    numBins,
    actualStart,
    trackStrands,
  )
  let maxDepth = 0
  for (let i = 0; i < numBins; i++) {
    if (depths[i]! > maxDepth) {
      maxDepth = depths[i]!
    }
  }

  return {
    depths,
    fwdDepths,
    revDepths,
    maxDepth: maxDepth || 1,
    binSize,
    startPos,
  }
}

// One span's contribution to a difference array: +1/-1 at the edges, with the
// right edge dropped when the span runs past the last bin so the depth stays
// counted to the end. `lo` is pre-clamped by the caller because all three
// arrays share it.
function bumpSpan(
  diff: Float32Array,
  lo: number,
  end: number,
  numBins: number,
  delta: number,
) {
  diff[lo]! += delta
  if (end < numBins) {
    diff[end]! -= delta
  }
}

// Difference-array + prefix-sum depth pass. binSize is always 1 and positions
// are integers, so bin index == pos - actualStart: a read is +1 at start / -1
// at end, a gap (deletion/skip) carves depth with -1 at start / +1 at end.
// Accumulating into the diff array is O(features + gaps) with no per-event
// object allocation or sort (the old sweep-line paid both). Positions clamp
// into [0, numBins] the same way the sweep did — a read overhanging regionStart
// counts from bin 0, one overhanging the right edge stays counted to the end.
//
// All three sweeps are filled in ONE walk of the reads. They differ only in
// which reads they skip — a read lands in the total always, in fwd when its
// strand is +1 or 0, in rev when it is -1 or 0 (strand 0, e.g. a synteny block,
// is ambiguous and so lands in both) — and this used to be spelled as three
// calls with a `wantStrand` filter, i.e. the read array walked three times to
// vary a predicate. The per-strand pair exists only to back the coverage
// tooltip's strand breakdown, and it is on by default with the band, so that
// was two extra full passes over every read of every fetch.
function sweepDepths(
  features: CoverageFeature[],
  gaps: CoverageGap[],
  numBins: number,
  actualStart: number,
  trackStrands: boolean | undefined,
) {
  const depths = new Float32Array(numBins)
  const fwdDepths = trackStrands ? new Float32Array(numBins) : undefined
  const revDepths = trackStrands ? new Float32Array(numBins) : undefined
  for (const f of features) {
    const s = f.start - actualStart
    const e = f.end - actualStart
    if (s < numBins && e > 0) {
      const lo = s > 0 ? s : 0
      const strand = f.strand ?? 0
      bumpSpan(depths, lo, e, numBins, 1)
      if (fwdDepths && (strand === 0 || strand === 1)) {
        bumpSpan(fwdDepths, lo, e, numBins, 1)
      }
      if (revDepths && (strand === 0 || strand === -1)) {
        bumpSpan(revDepths, lo, e, numBins, 1)
      }
    }
  }
  for (const g of gaps) {
    const s = g.start - actualStart
    const e = g.end - actualStart
    if (s < numBins && e > 0) {
      const lo = s > 0 ? s : 0
      const strand = g.featureStrand
      bumpSpan(depths, lo, e, numBins, -1)
      if (fwdDepths && (strand === 0 || strand === 1)) {
        bumpSpan(fwdDepths, lo, e, numBins, -1)
      }
      if (revDepths && (strand === 0 || strand === -1)) {
        bumpSpan(revDepths, lo, e, numBins, -1)
      }
    }
  }
  prefixSumClamped(depths, numBins)
  if (fwdDepths) {
    prefixSumClamped(fwdDepths, numBins)
  }
  if (revDepths) {
    prefixSumClamped(revDepths, numBins)
  }
  return { depths, fwdDepths, revDepths }
}

// Prefix-sum in place; the running total stays unclamped (a transient negative
// from a left-overhanging gap must still cancel later opens) while each stored
// bin clamps to 0, matching the old per-bin Math.max(0, depth).
function prefixSumClamped(diff: Float32Array, numBins: number) {
  let acc = 0
  for (let i = 0; i < numBins; i++) {
    acc += diff[i]!
    diff[i] = acc > 0 ? acc : 0
  }
}
