import * as indicatorShader from '../../shaders/slang/indicator.generated.ts'
import { instancePass } from '../../shared/instancePass.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

export const PASS_INDICATOR = 'indicator'

export const INDICATOR_PASS = instancePass({
  id: PASS_INDICATOR,
  mod: indicatorShader,
  pack: (data: Pick<CoverageUploadData, 'indicatorPackedBuffer'>) =>
    data.indicatorPackedBuffer,
})

export { packIndicatorsForGpu } from '@jbrowse/alignments-core'
