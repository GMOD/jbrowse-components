import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as noncovShader from '../../shaders/slang/noncovHistogram.generated.ts'

export const PASS_NONCOV = 'noncov'

export const NONCOV_PASS = slangPass({
  id: PASS_NONCOV,
  mod: noncovShader,
})

export { packNoncovSegmentsForGpu } from '@jbrowse/alignments-core'
