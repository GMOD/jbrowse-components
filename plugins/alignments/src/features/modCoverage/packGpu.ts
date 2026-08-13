import { instancePass } from '@jbrowse/render-core/instancePass'

import * as modCoverageShader from '../../shaders/slang/modCoverage.generated.ts'

import type { ModCoverageUploadData } from '../../shared/uploadTypes.ts'

export const PASS_MOD_COV = 'modCov'

export const MOD_COVERAGE_PASS = instancePass({
  id: PASS_MOD_COV,
  mod: modCoverageShader,
  pack: (data: Pick<ModCoverageUploadData, 'modCovPackedBuffer'>) =>
    data.modCovPackedBuffer,
})

export { packModCovSegmentsForGpu } from '@jbrowse/alignments-core'
