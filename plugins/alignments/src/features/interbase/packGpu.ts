import * as interbaseShader from '../../shaders/slang/interbaseHistogram.generated.ts'
import { instancePass } from '../../shared/instancePass.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

export const PASS_INTERBASE = 'interbase'

// `interbaseCov*` / `interbasePackedBuffer` are the coverage-area arrays; the
// plain `interbase*` ones on CigarUploadData are the row-instanced marks, a
// different pass.
export const INTERBASE_PASS = instancePass({
  id: PASS_INTERBASE,
  mod: interbaseShader,
  pack: (data: Pick<CoverageUploadData, 'interbasePackedBuffer'>) =>
    data.interbasePackedBuffer,
})

export { packInterbaseSegmentsForGpu } from '@jbrowse/alignments-core'
