import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as modificationShader from '../../LinearAlignmentsDisplay/shaders/slang/packedColorQuad.generated.ts'

import type { ModificationUploadData } from './types.ts'

export const PASS_MOD = 'modification'

// Pass descriptor exported so GpuAlignmentsRenderer's ALIGNMENTS_PASSES can
// list it without re-importing the shader module — keeps the modification
// shader and its pass shape in one place.
export const MODIFICATION_PASS = slangPass({
  id: PASS_MOD,
  mod: modificationShader,
})

export function packModifications(data: ModificationUploadData): ArrayBuffer {
  // Pure field-for-field copy — delegate to the generated packInstances so the
  // instance layout (offsets, stride, per-field view) can't drift from the
  // shader struct.
  return modificationShader.packInstances(
    {
      position: data.modificationPositions,
      y: data.modificationYs,
      packedColor: data.modificationColors,
    },
    data.modificationPositions.length,
  )
}
