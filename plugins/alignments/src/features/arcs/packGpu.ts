import { slangPass } from '@jbrowse/render-core/slangPass'

import * as arcShader from '../../LinearAlignmentsDisplay/shaders/slang/arc.generated.ts'
import * as arcLineShader from '../../LinearAlignmentsDisplay/shaders/slang/arcLine.generated.ts'
import * as arcMarkerShader from '../../LinearAlignmentsDisplay/shaders/slang/arcMarker.generated.ts'
import { isFlatArcShape } from './compute.ts'

import type { ArcsUploadData } from './types.ts'

export const PASS_ARC = 'arc'
export const PASS_ARC_LINE = 'arcLine'
export const PASS_ARC_MARKER = 'arcMarker'

export const ARC_PASS = slangPass({
  id: PASS_ARC,
  mod: arcShader,
  topology: 'triangle-strip',
})

// Default triangle-list topology — the tick is an antialiased 6-vertex quad,
// not a native line (see arcLine.slang).
export const ARC_LINE_PASS = slangPass({
  id: PASS_ARC_LINE,
  mod: arcLineShader,
})

// Default triangle-list topology — each marker is a 6-vertex quad.
export const ARC_MARKER_PASS = slangPass({
  id: PASS_ARC_MARKER,
  mod: arcMarkerShader,
})

// Field-for-field packing is delegated to the generated packInstances so the
// instance layout can never drift from the shader struct.
export function packArcs(data: ArcsUploadData): ArrayBuffer {
  return arcShader.packInstances(
    {
      x1: data.arcX1,
      x2: data.arcX2,
      colorType: data.arcColorTypes,
      shapeType: data.arcShapeTypes,
      yBp: data.arcYBp,
    },
    data.numArcs,
  )
}

export function packArcLines(data: ArcsUploadData): ArrayBuffer {
  return arcLineShader.packInstances(
    {
      position: data.arcLinePositions,
      colorType: data.arcLineColorTypes,
    },
    data.numArcLines,
  )
}

// Two endpoint-square markers per flat (read-cloud) arc — one at each end.
// Regular curved arcs carry no markers (their endpoints sit on the baseline),
// so in arc mode `numFlatArcs` is 0 and the caller skips this entirely rather
// than scanning every arc to discover there is nothing to draw.
export function packArcMarkers(data: ArcsUploadData): ArrayBuffer {
  const count = data.numFlatArcs * 2
  const position = new Uint32Array(count)
  const colorType = new Uint8Array(count)
  const yBp = new Uint32Array(count)
  let n = 0
  for (let i = 0; i < data.numArcs; i++) {
    if (isFlatArcShape(data.arcShapeTypes[i]!)) {
      const c = data.arcColorTypes[i]!
      const y = data.arcYBp[i]!
      position[n] = data.arcX1[i]!
      colorType[n] = c
      yBp[n] = y
      n++
      position[n] = data.arcX2[i]!
      colorType[n] = c
      yBp[n] = y
      n++
    }
  }
  return arcMarkerShader.packInstances({ position, colorType, yBp }, count)
}
