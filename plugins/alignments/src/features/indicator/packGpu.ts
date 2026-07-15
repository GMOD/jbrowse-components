import { slangPass } from '@jbrowse/render-core/slangPass'

import * as indicatorShader from '../../LinearAlignmentsDisplay/shaders/slang/indicator.generated.ts'

export const PASS_INDICATOR = 'indicator'

export const INDICATOR_PASS = slangPass({
  id: PASS_INDICATOR,
  mod: indicatorShader,
})

export { packIndicatorsForGpu } from '@jbrowse/alignments-core'
