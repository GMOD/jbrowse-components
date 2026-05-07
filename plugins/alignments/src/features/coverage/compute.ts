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

function getFeatureExtent(
  features: { start: number; end: number }[],
  regionStart: number,
  regionEnd: number,
) {
  const maxExtension = regionEnd - regionStart
  let actualStart = regionStart
  let actualEnd = regionEnd
  for (const f of features) {
    if (f.start < actualStart && f.start >= regionStart - maxExtension) {
      actualStart = f.start
    }
    if (f.end > actualEnd && f.end <= regionEnd + maxExtension) {
      actualEnd = f.end
    }
  }
  return { actualStart, actualEnd }
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

  const extent = getFeatureExtent(features, regionStart, regionEnd)
  const actualStart = Math.max(extent.actualStart, regionStart)
  const actualEnd = extent.actualEnd
  const startPos = actualStart
  const numBins = actualEnd - actualStart
  const binSize = 1

  const allEvents: { pos: number; delta: number }[] = []
  for (const f of features) {
    allEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
  }
  for (const g of gaps) {
    allEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
  }
  const depths = sweepDepths(allEvents, numBins, actualStart, binSize)
  let maxDepth = 0
  for (let i = 0; i < numBins; i++) {
    if (depths[i]! > maxDepth) {
      maxDepth = depths[i]!
    }
  }

  let fwdDepths: Float32Array | undefined
  let revDepths: Float32Array | undefined
  if (trackStrands) {
    const fwdEvents: { pos: number; delta: number }[] = []
    const revEvents: { pos: number; delta: number }[] = []
    for (const f of features) {
      const s = f.strand ?? 0
      if (s === 1) {
        fwdEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
      } else if (s === -1) {
        revEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
      } else {
        fwdEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
        revEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
      }
    }
    for (const g of gaps) {
      if (g.featureStrand === 1) {
        fwdEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
      } else if (g.featureStrand === -1) {
        revEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
      } else {
        fwdEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
        revEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
      }
    }
    fwdDepths = sweepDepths(fwdEvents, numBins, actualStart, binSize)
    revDepths = sweepDepths(revEvents, numBins, actualStart, binSize)
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

// Sweep-line depth pass: applies sorted +1/-1 events bin-by-bin.
function sweepDepths(
  events: { pos: number; delta: number }[],
  numBins: number,
  actualStart: number,
  binSize: number,
) {
  events.sort((a, b) => a.pos - b.pos)
  const depths = new Float32Array(numBins)
  let depth = 0
  let eventIdx = 0
  for (let binIdx = 0; binIdx < numBins; binIdx++) {
    const binEnd = actualStart + (binIdx + 1) * binSize
    while (eventIdx < events.length && events[eventIdx]!.pos < binEnd) {
      depth += events[eventIdx]!.delta
      eventIdx++
    }
    depths[binIdx] = Math.max(0, depth)
  }
  return depths
}
