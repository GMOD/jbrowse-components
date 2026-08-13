import * as modificationShader from '../../shaders/slang/packedColorQuad.generated.ts'
import { instancePass } from '../../shared/instancePass.ts'

import type { ModificationUploadData } from './types.ts'

export const PASS_MOD = 'modification'

// Pass descriptor exported so GpuAlignmentsRenderer's pileup-layer registry can
// name it without re-importing the shader module — keeps the modification
// shader, its pass shape and its packer in one place.
export const MODIFICATION_PASS = instancePass({
  id: PASS_MOD,
  mod: modificationShader,
  pack: packModifications,
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
