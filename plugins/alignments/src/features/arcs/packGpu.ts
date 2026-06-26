import { slangPass } from '@jbrowse/render-core/slangPass'

import { ARC_SHAPE_FLAT, ARC_SHAPE_FLAT_SPLIT } from './compute.ts'
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

function isFlatShape(shape: number) {
  return shape === ARC_SHAPE_FLAT || shape === ARC_SHAPE_FLAT_SPLIT
}

// Two endpoint-square markers per flat (samplot) arc — one at each end. Regular
// curved arcs carry no markers (their endpoints sit on the baseline).
export function flatArcMarkerCount(data: ArcsUploadData) {
  let n = 0
  for (let i = 0; i < data.numArcs; i++) {
    if (isFlatShape(data.arcShapeTypes[i]!)) {
      n += 2
    }
  }
  return n
}

export function packArcMarkers(
  data: ArcsUploadData,
  count: number,
): ArrayBuffer {
  const position = new Uint32Array(count)
  const colorType = new Uint8Array(count)
  const yBp = new Uint32Array(count)
  let j = 0
  for (let i = 0; i < data.numArcs; i++) {
    if (isFlatShape(data.arcShapeTypes[i]!)) {
      const c = data.arcColorTypes[i]!
      const y = data.arcYBp[i]!
      position[j] = data.arcX1[i]!
      colorType[j] = c
      yBp[j] = y
      j++
      position[j] = data.arcX2[i]!
      colorType[j] = c
      yBp[j] = y
      j++
    }
  }
  return arcMarkerShader.packInstances({ position, colorType, yBp }, count)
}
