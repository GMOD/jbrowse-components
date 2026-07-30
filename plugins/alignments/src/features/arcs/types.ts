// Worker → main-thread payload for paired-end / split-read arcs and the
// interchromosomal connector ticks. Owned by the arcs feature.
export interface ArcsUploadData {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  numArcs: number
  // Max `arcYBp` across flat (read-cloud) arcs. Precomputed so the `arcsYDomainBp`
  // view reduces over regions, not over every arc.
  maxFlatArcYBp: number
  // One entry per connector tick (interchromosomal breakpoint marker). The tick
  // spans the full arc band, so no Y is stored — see arcLine.slang.
  arcLinePositions: Uint32Array
  arcLineColorTypes: Uint8Array
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
    numArcs: 0,
    maxFlatArcYBp: 0,
    arcLinePositions: new Uint32Array(0),
    arcLineColorTypes: new Uint8Array(0),
    numArcLines: 0,
  }
}
