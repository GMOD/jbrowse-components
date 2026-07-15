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

  // strand 0 (undefined) contributes to both fwd and rev; +1 selects fwd, -1
  // rev, 0 both. `wantStrand` picks which sweep a feature/gap lands in.
  const depths = sweepDepths(features, gaps, numBins, actualStart, 0)
  let maxDepth = 0
  for (let i = 0; i < numBins; i++) {
    if (depths[i]! > maxDepth) {
      maxDepth = depths[i]!
    }
  }

  let fwdDepths: Float32Array | undefined
  let revDepths: Float32Array | undefined
  if (trackStrands) {
    fwdDepths = sweepDepths(features, gaps, numBins, actualStart, 1)
    revDepths = sweepDepths(features, gaps, numBins, actualStart, -1)
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

// Difference-array + prefix-sum depth pass. binSize is always 1 and positions
// are integers, so bin index == pos - actualStart: a read is +1 at start / -1
// at end, a gap (deletion/skip) carves depth with -1 at start / +1 at end.
// Accumulating into the diff array is O(features + gaps) with no per-event
// object allocation or sort (the old sweep-line paid both). Positions clamp
// into [0, numBins] the same way the sweep did — a read overhanging regionStart
// counts from bin 0, one overhanging the right edge stays counted to the end.
//
// wantStrand: 0 = all reads (total depth), 1 = fwd only, -1 = rev only.
// strand 0 (undefined) is ambiguous so it lands in every sweep.
function sweepDepths(
  features: CoverageFeature[],
  gaps: CoverageGap[],
  numBins: number,
  actualStart: number,
  wantStrand: number,
) {
  const depths = new Float32Array(numBins)
  for (const f of features) {
    const strand = f.strand ?? 0
    if (wantStrand === 0 || strand === 0 || strand === wantStrand) {
      const s = f.start - actualStart
      const e = f.end - actualStart
      if (s < numBins && e > 0) {
        depths[s > 0 ? s : 0]! += 1
        if (e < numBins) {
          depths[e]! -= 1
        }
      }
    }
  }
  for (const g of gaps) {
    const strand = g.featureStrand
    if (wantStrand === 0 || strand === 0 || strand === wantStrand) {
      const s = g.start - actualStart
      const e = g.end - actualStart
      if (s < numBins && e > 0) {
        depths[s > 0 ? s : 0]! -= 1
        if (e < numBins) {
          depths[e]! += 1
        }
      }
    }
  }
  // Prefix-sum in place; the running total stays unclamped (a transient
  // negative from a left-overhanging gap must still cancel later opens) while
  // each stored bin clamps to 0, matching the old per-bin Math.max(0, depth).
  let acc = 0
  for (let i = 0; i < numBins; i++) {
    acc += depths[i]!
    depths[i] = acc > 0 ? acc : 0
  }
  return depths
}
