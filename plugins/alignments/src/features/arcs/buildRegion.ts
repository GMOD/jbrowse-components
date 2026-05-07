import type { ArcsUploadData } from './types.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface ArcsRegionFields {
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

export function buildArcsFields(
  data: ArcsUploadData | undefined,
): ArcsRegionFields {
  if (!data) {
    return emptyArcsFields()
  }
  return {
    arcX1: data.arcX1,
    arcX2: data.arcX2,
    arcColorTypes: data.arcColorTypes,
    arcShapeTypes: data.arcShapeTypes,
    arcYBp: data.arcYBp,
    numArcs: data.numArcs,
    arcLinePositions: data.linePositions,
    arcLineYs: data.lineYs,
    arcLineColorTypes: data.lineColorTypes,
    numArcLines: data.numLines,
  }
}

export function emptyArcsFields(): ArcsRegionFields {
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
