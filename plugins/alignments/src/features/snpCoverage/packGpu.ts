import { slangPass } from '@jbrowse/render-core/slangPass'

import * as snpCoverageShader from '../../shaders/slang/snpCoverage.generated.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Packed worker-side by `packSnpSegmentsForGpu` (single linear pass into the
// GPU-layout buffer) and uploaded verbatim.
export const SNP_COVERAGE_PASS = {
  ...slangPass({
    id: 'snpCov',
    mod: snpCoverageShader,
  }),
  pack: (data: Pick<CoverageUploadData, 'snpPackedBuffer'>) =>
    data.snpPackedBuffer,
}

export { packSnpSegmentsForGpu } from '@jbrowse/alignments-core'
