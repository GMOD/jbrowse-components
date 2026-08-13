import * as snpCoverageShader from '../../shaders/slang/snpCoverage.generated.ts'
import { instancePass } from '../../shared/instancePass.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

export const PASS_SNP_COV = 'snpCov'

// Packed worker-side by `packSnpSegmentsForGpu` (single linear pass into the
// GPU-layout buffer) and uploaded verbatim.
export const SNP_COVERAGE_PASS = instancePass({
  id: PASS_SNP_COV,
  mod: snpCoverageShader,
  pack: (data: Pick<CoverageUploadData, 'snpPackedBuffer'>) =>
    data.snpPackedBuffer,
})

export { packSnpSegmentsForGpu } from '@jbrowse/alignments-core'
