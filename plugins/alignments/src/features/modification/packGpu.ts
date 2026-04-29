import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as modificationShader from '../../shaders/slang/modification.generated.ts'

import type { ModificationUploadData } from './types.ts'

export const PASS_MOD = 'modification'

// Pass descriptor exported so GpuAlignmentsRenderer's ALIGNMENTS_PASSES can
// list it without re-importing the shader module — keeps the modification
// shader and its pass shape in one place.
export const MODIFICATION_PASS = slangPass({
  id: PASS_MOD,
  mod: modificationShader,
  verticesPerInstance: 6,
})

export function packModifications(data: ModificationUploadData): ArrayBuffer {
  const n = data.modificationPositions.length
  const F = modificationShader.FIELD_OFFSET_F32
  const s32 = modificationShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * modificationShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const pos = data.modificationPositions
  const ys = data.modificationYs
  const colors = data.modificationColors
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.packedColor] = colors[i]!
  }
  return buf
}
