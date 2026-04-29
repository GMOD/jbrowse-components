// Worker → main-thread payload for paired-end / split-read arcs and the small
// arc-line dots that mark connector endpoints. Owned by the arcs feature.
export interface ArcsUploadData {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  numArcs: number
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColorTypes: Uint8Array
  numLines: number
}
