import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as modCoverageShader from '../../shaders/slang/modCoverage.generated.ts'

export const PASS_MOD_COV = 'modCov'

export const MOD_COVERAGE_PASS = slangPass({
  id: PASS_MOD_COV,
  mod: modCoverageShader,
})

export { packModCovSegmentsForGpu } from '@jbrowse/alignments-core'
