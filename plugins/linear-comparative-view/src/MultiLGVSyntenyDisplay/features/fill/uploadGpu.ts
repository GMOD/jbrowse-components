import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as fillShader from '../../shaders/slang/multiSyntenyFill.generated.ts'

import type { BlockGeometryData } from './packGpu.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export const PASS_FILL = 'fill'

export const FILL_PASS = slangPass({
  id: PASS_FILL,
  mod: fillShader,
})

export function uploadFillToGpu(
  hal: GpuHal,
  idx: number,
  data: BlockGeometryData,
) {
  hal.uploadBuffer(idx, PASS_FILL, data.buffer, data.instanceCount)
}
