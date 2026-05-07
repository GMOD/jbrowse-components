import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as indicatorShader from '../../shaders/slang/indicator.generated.ts'

export const PASS_INDICATOR = 'indicator'

export const INDICATOR_PASS = slangPass({
  id: PASS_INDICATOR,
  mod: indicatorShader,
})

export { packIndicatorsForGpu } from '@jbrowse/alignments-core'
