// Worker → main-thread payload for paired-end / split-read arcs and the
// interchromosomal connector ticks. Owned by the arcs feature.
export interface ArcsUploadData {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  // Reads supporting each arc: how many identical connections `resolveArcs`
  // folded into it, always >= 1. The three draw paths turn it into stroke width
  // through `arcLineWidth` — none of them may re-derive that curve.
  arcSupport: Uint32Array
  numArcs: number
  // How many of `numArcs` are flat (read-cloud) shapes, and the max `arcYBp`
  // across them. Both precomputed in the pass that builds the arrays, so the
  // `arcsYDomainBp` view reduces over regions rather than over every arc and
  // `packArcMarkers` sizes its buffer exactly — in arc mode the count is 0 and
  // the whole endpoint-marker pass is skipped.
  numFlatArcs: number
  maxFlatArcYBp: number
  // One entry per connector tick (interchromosomal breakpoint marker). The tick
  // spans the full arc band, so no Y is stored, and every tick is
  // ARC_COLOR_INTERCHROM, so no color is stored either — see arcLine.slang.
  arcLinePositions: Uint32Array
  numArcLines: number
}

// Whether a group's arc feed paints anything at all, across its regions. Drives
// the per-section arc band: a lane whose reads yield no arc (and no connector
// tick) reserves no band, so its pileup starts right under its coverage instead
// of below an empty strip. `undefined` is a group key with no arc entry, which
// is the same "nothing to draw" answer.
export function anyArcsDrawn(
  regionMap: ReadonlyMap<number, ArcsUploadData> | undefined,
) {
  return regionMap === undefined
    ? false
    : [...regionMap.values()].some(d => d.numArcs > 0 || d.numArcLines > 0)
}

export function emptyArcsUploadData(): ArcsUploadData {
  return {
    arcX1: new Uint32Array(0),
    arcX2: new Uint32Array(0),
    arcColorTypes: new Uint8Array(0),
    arcShapeTypes: new Uint8Array(0),
    arcYBp: new Uint32Array(0),
    arcSupport: new Uint32Array(0),
    numArcs: 0,
    numFlatArcs: 0,
    maxFlatArcYBp: 0,
    arcLinePositions: new Uint32Array(0),
    numArcLines: 0,
  }
}
