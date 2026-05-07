import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as indicatorShader from '../../shaders/slang/multiSyntenyIndicator.generated.ts'

import type { BlockIndicatorUploadData } from './packGpu.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export const PASS_INDICATORS = 'indicators'

export const INDICATORS_PASS = slangPass({
  id: PASS_INDICATORS,
  mod: indicatorShader,
})

export function uploadIndicatorsToGpu(
  hal: GpuHal,
  idx: number,
  data: BlockIndicatorUploadData,
) {
  hal.uploadBuffer(idx, PASS_INDICATORS, data.buffer, data.indicatorCount)
}
