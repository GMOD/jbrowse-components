import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as snpCoverageShader from '../../shaders/slang/snpCoverage.generated.ts'

export const PASS_SNP_COV = 'snpCov'

export const SNP_COVERAGE_PASS = slangPass({
  id: PASS_SNP_COV,
  mod: snpCoverageShader,
})

// Worker-side pack from alignments-core. Single linear pass into the
// GPU-layout buffer; consumed by uploadSnpCoverage on the main thread.
export { packSnpSegmentsForGpu } from '@jbrowse/alignments-core'
