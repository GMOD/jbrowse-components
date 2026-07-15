import { slangPass } from '@jbrowse/render-core/slangPass'

import * as interbaseShader from '../../LinearAlignmentsDisplay/shaders/slang/interbaseHistogram.generated.ts'

export const PASS_INTERBASE = 'interbase'

export const INTERBASE_PASS = slangPass({
  id: PASS_INTERBASE,
  mod: interbaseShader,
})

export { packInterbaseSegmentsForGpu } from '@jbrowse/alignments-core'
