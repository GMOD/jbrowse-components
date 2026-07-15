import { slangPass } from '@jbrowse/render-core/slangPass'

import { isFlatArcShape } from './compute.ts'
import * as arcShader from '../../LinearAlignmentsDisplay/shaders/slang/arc.generated.ts'
import * as arcLineShader from '../../LinearAlignmentsDisplay/shaders/slang/arcLine.generated.ts'
import * as arcMarkerShader from '../../LinearAlignmentsDisplay/shaders/slang/arcMarker.generated.ts'

import type { ArcsUploadData } from './types.ts'

export const PASS_ARC = 'arc'
export const PASS_ARC_LINE = 'arcLine'
export const PASS_ARC_MARKER = 'arcMarker'

export const ARC_PASS = slangPass({
  id: PASS_ARC,
  mod: arcShader,
  topology: 'triangle-strip',
})

export const ARC_LINE_PASS = slangPass({
  id: PASS_ARC_LINE,
  mod: arcLineShader,
  topology: 'line-list',
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

// Two endpoint-square markers per flat (read-cloud) arc — one at each end. Regular
// curved arcs carry no markers (their endpoints sit on the baseline). Allocates
// the worst case (2 per arc) and fills+counts in a single pass; `packInstances`
// only reads the first `count` entries, so the tail is ignored. `count` is 0
// when no arc is flat, so the caller skips the upload entirely.
export function packArcMarkers(data: ArcsUploadData): {
  buffer: ArrayBuffer
  count: number
} {
  const maxCount = data.numArcs * 2
  const position = new Uint32Array(maxCount)
  const colorType = new Uint8Array(maxCount)
  const yBp = new Uint32Array(maxCount)
  let count = 0
  for (let i = 0; i < data.numArcs; i++) {
    if (isFlatArcShape(data.arcShapeTypes[i]!)) {
      const c = data.arcColorTypes[i]!
      const y = data.arcYBp[i]!
      position[count] = data.arcX1[i]!
      colorType[count] = c
      yBp[count] = y
      count++
      position[count] = data.arcX2[i]!
      colorType[count] = c
      yBp[count] = y
      count++
    }
  }
  return {
    buffer: arcMarkerShader.packInstances({ position, colorType, yBp }, count),
    count,
  }
}
