import { PASS_INTERBASE } from './packGpu.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadInterbase(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: CoverageUploadData,
) {
  // `interbaseCov*` are the coverage-area arrays; the plain `interbase*` ones
  // on CigarUploadData are the row-instanced marks, a different pass.
  const n = data.interbaseCovPositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_INTERBASE,
      data.interbasePackedBuffer,
      n,
    )
  }
}
