import { slangPass } from '@jbrowse/render-core/slangPass'

import * as arcShader from '../../LinearAlignmentsDisplay/shaders/slang/arc.generated.ts'
import * as arcLineShader from '../../LinearAlignmentsDisplay/shaders/slang/arcLine.generated.ts'

import type { ArcsUploadData } from './types.ts'

export const PASS_ARC = 'arc'
export const PASS_ARC_LINE = 'arcLine'

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
