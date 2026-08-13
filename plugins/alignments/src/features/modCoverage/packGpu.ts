import { slangPass } from '@jbrowse/render-core/slangPass'

import * as modCoverageShader from '../../shaders/slang/modCoverage.generated.ts'

import type { ModCoverageUploadData } from '../../shared/uploadTypes.ts'

export const MOD_COVERAGE_PASS = {
  ...slangPass({
    id: 'modCov',
    mod: modCoverageShader,
  }),
  pack: (data: Pick<ModCoverageUploadData, 'modCovPackedBuffer'>) =>
    data.modCovPackedBuffer,
}

export { packModCovSegmentsForGpu } from '@jbrowse/alignments-core'
