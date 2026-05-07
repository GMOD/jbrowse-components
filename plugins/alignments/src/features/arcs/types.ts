// Worker → main-thread payload for paired-end / split-read arcs and the small
// arc-line dots that mark connector endpoints. Owned by the arcs feature.
export interface ArcsUploadData {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  numArcs: number
  arcLinePositions: Uint32Array
  arcLineYs: Float32Array
  arcLineColorTypes: Uint8Array
  numArcLines: number
}

export function emptyArcsUploadData(): ArcsUploadData {
  return {
    arcX1: new Uint32Array(0),
    arcX2: new Uint32Array(0),
    arcColorTypes: new Uint8Array(0),
    arcShapeTypes: new Uint8Array(0),
    arcYBp: new Uint32Array(0),
    numArcs: 0,
    arcLinePositions: new Uint32Array(0),
    arcLineYs: new Float32Array(0),
    arcLineColorTypes: new Uint8Array(0),
    numArcLines: 0,
  }
}
