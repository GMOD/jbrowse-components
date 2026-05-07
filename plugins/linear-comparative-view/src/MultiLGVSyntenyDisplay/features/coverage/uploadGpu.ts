import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as coverageShader from '../../shaders/slang/multiSyntenyCoverage.generated.ts'

import type { BlockCoverageUploadData } from './packGpu.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export const PASS_COVERAGE = 'coverage'

export const COVERAGE_PASS = slangPass({
  id: PASS_COVERAGE,
  mod: coverageShader,
})

export function uploadCoverageToGpu(
  hal: GpuHal,
  idx: number,
  data: BlockCoverageUploadData,
  maxDepth: number,
) {
  hal.setRegionMeta(idx, { maxDepth })
  hal.uploadBuffer(idx, PASS_COVERAGE, data.buffer, data.binCount)
}
