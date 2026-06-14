import { slangPass } from '@jbrowse/render-core/slangPass'

import * as modCoverageShader from '../../LinearAlignmentsDisplay/shaders/slang/modCoverage.generated.ts'

export const PASS_MOD_COV = 'modCov'

export const MOD_COVERAGE_PASS = slangPass({
  id: PASS_MOD_COV,
  mod: modCoverageShader,
})

export { packModCovSegmentsForGpu } from '@jbrowse/alignments-core'
