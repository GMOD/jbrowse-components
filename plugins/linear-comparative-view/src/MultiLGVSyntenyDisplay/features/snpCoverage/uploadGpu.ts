import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as snpShader from '../../shaders/slang/multiSyntenySnp.generated.ts'

import type { BlockSnpUploadData } from './packGpu.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export const PASS_SNP = 'snp'

export const SNP_PASS = slangPass({
  id: PASS_SNP,
  mod: snpShader,
})

export function uploadSnpCoverageToGpu(
  hal: GpuHal,
  idx: number,
  data: BlockSnpUploadData,
) {
  hal.uploadBuffer(idx, PASS_SNP, data.buffer, data.segmentCount)
}
